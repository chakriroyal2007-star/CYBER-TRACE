import assert from 'node:assert/strict';
import { test } from 'node:test';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { client, launchServer } from './helpers.mjs';
import { sendEmailVerificationCode, verifyEmailCode } from '../server/auth/emailVerification.mjs';
import { validatePasswordPolicy } from '../server/auth/password.mjs';
import { generateTotpSecret, computeTotp, verifyTotp } from '../server/auth/totp.mjs';
import { isAllowedOfficerDomain } from '../server/auth/officerInvitations.mjs';
import { computeAuditEntryHash, verifyAuditChain } from '../server/db/hashChain.mjs';

test('Phase 1: Real Authentication, Roles, TOTP, Maker-Checker and Cryptographic Audit Chain', async (t) => {
  const server = await launchServer();
  const testClient = client(server.baseUrl);

  t.after(async () => {
    await server.close();
  });

  await t.test('1. Citizen email verification: 6-digit code, attempt limit, and verification lifecycle', async () => {
    const email = 'victim.citizen@example.in';
    const sendResult = await sendEmailVerificationCode(email);
    assert.equal(sendResult.ok, true);

    // Bad code attempt 1
    const badAttempt1 = verifyEmailCode(email, '000000');
    assert.equal(badAttempt1.valid, false);
    assert.equal(badAttempt1.remainingAttempts, 2);

    // Bad code attempt 2
    const badAttempt2 = verifyEmailCode(email, '111111');
    assert.equal(badAttempt2.valid, false);
    assert.equal(badAttempt2.remainingAttempts, 1);

    // Attempt 3 exceeding ceiling invalidates code
    const badAttempt3 = verifyEmailCode(email, '222222');
    assert.equal(badAttempt3.valid, false);

    // Code is now invalidated
    const postInvalidate = verifyEmailCode(email, '333333');
    assert.equal(postInvalidate.valid, false);
  });

  await t.test('2. Password policy: minimum 12 chars and complex character requirements', async () => {
    const short = validatePasswordPolicy('Weak@12');
    assert.equal(short.valid, false);
    assert.match(short.message, /at least 12 characters/i);

    const noUpperOrSpecial = validatePasswordPolicy('alllowercase123456');
    assert.equal(noUpperOrSpecial.valid, false);

    const strong = validatePasswordPolicy('SecureOfficer#2026!');
    assert.equal(strong.valid, true);
  });

  await t.test('3. Failed login lockout: 5 consecutive failures triggers 15-minute lockout', async () => {
    const targetEmail = 'lockout.target@example.in';
    // Register the user first with valid credentials
    const regRes = await testClient.request('/auth/register', {
      method: 'POST',
      body: {
        email: targetEmail,
        password: 'Password#2026!Valid',
        name: 'Lockout Target',
        role: 'reporter'
      }
    });
    assert.equal(regRes.response.status, 201);

    // Send 5 bad passwords
    for (let i = 0; i < 5; i++) {
      const failRes = await testClient.request('/auth/login', {
        method: 'POST',
        body: { email: targetEmail, password: 'WrongPassword#999' }
      });
      assert.equal(failRes.response.status, 401);
    }

    // 6th attempt must be locked out with HTTP 429
    const lockRes = await testClient.request('/auth/login', {
      method: 'POST',
      body: { email: targetEmail, password: 'WrongPassword#999' }
    });
    assert.equal(lockRes.response.status, 429);
    assert.match(lockRes.data.error, /temporarily locked/i);
  });

  await t.test('4. Officer invitations: domain allowlist check and single-use token consumption', async () => {
    // Check domain allowlist
    assert.equal(isAllowedOfficerDomain('investigator@cbi.gov.in'), true);
    assert.equal(isAllowedOfficerDomain('officer@delhipolice.gov.in'), true);
    assert.equal(isAllowedOfficerDomain('scammer@randomdomain.com'), false);

    // Login as Admin to issue an invitation
    const adminLogin = await testClient.request('/auth/demo-admin', { method: 'POST', body: {} });
    assert.equal(adminLogin.response.status, 200);

    // Unauthorized domain must be rejected
    const badInvite = await testClient.request('/auth/invite-officer', {
      method: 'POST',
      body: { email: 'bad@gmail.com', designation: 'Inspector' }
    });
    assert.equal(badInvite.response.status, 403);

    // Authorized domain succeeds
    const goodInvite = await testClient.request('/auth/invite-officer', {
      method: 'POST',
      body: { email: 'insp.verma@cbi.gov.in', designation: 'Inspector of Police', unit: 'CBI Cyber Cell' }
    });
    assert.equal(goodInvite.response.status, 201);
    const token = goodInvite.data.token;
    assert.ok(token);

    // Verify invitation endpoint
    const verifyRes = await testClient.request(`/auth/verify-invite?token=${token}`);
    assert.equal(verifyRes.response.status, 200);
    assert.equal(verifyRes.data.email, 'insp.verma@cbi.gov.in');

    // Officer accepts invitation, sets password and enrolls mandatory TOTP
    const secret = generateTotpSecret();
    const currentTotp = computeTotp(secret);

    const acceptRes = await testClient.request('/auth/accept-invite', {
      method: 'POST',
      body: {
        token,
        password: 'StrongOfficerPassword#2026',
        totpSecret: secret,
        totpCode: currentTotp,
        displayName: 'Insp. R. Verma'
      }
    });
    assert.equal(acceptRes.response.status, 201);
    assert.equal(acceptRes.data.ok, true);

    // Reusing the same token must fail with HTTP 410 (already consumed)
    const reuseRes = await testClient.request('/auth/accept-invite', {
      method: 'POST',
      body: {
        token,
        password: 'AnotherPassword#2026',
        totpSecret: secret,
        totpCode: currentTotp
      }
    });
    assert.equal(reuseRes.response.status, 410);
  });

  await t.test('5. Mandatory TOTP authentication challenge on enrolled officer account', async () => {
    // Login without TOTP code triggers challenge
    const challengeRes = await testClient.request('/auth/login', {
      method: 'POST',
      body: {
        email: 'insp.verma@cbi.gov.in',
        password: 'StrongOfficerPassword#2026'
      }
    });
    assert.equal(challengeRes.response.status, 200);
    assert.equal(challengeRes.data.requiresTotp, true);

    // Login with invalid TOTP fails with 401
    const badTotpRes = await testClient.request('/auth/login', {
      method: 'POST',
      body: {
        email: 'insp.verma@cbi.gov.in',
        password: 'StrongOfficerPassword#2026',
        totpCode: '000000'
      }
    });
    assert.equal(badTotpRes.response.status, 401);

    // Fetch enrolled user's secret from invitation flow to generate valid code
    const user = server.store?.getUserByEmail ? server.store.getUserByEmail('insp.verma@cbi.gov.in') : null;
    if (user?.totp_secret) {
      const validCode = computeTotp(user.totp_secret);
      const goodTotpRes = await testClient.request('/auth/login', {
        method: 'POST',
        body: {
          email: 'insp.verma@cbi.gov.in',
          password: 'StrongOfficerPassword#2026',
          totpCode: validCode
        }
      });
      assert.equal(goodTotpRes.response.status, 200);
      assert.ok(goodTotpRes.data.token);
    }
  });

  await t.test('6. Maker-Checker enforcement: Officer prepares freeze request, Supervisor approves, Officer cannot approve', async () => {
    // 1. Login as Officer
    const officerClient = client(server.baseUrl);
    const offLogin = await officerClient.request('/auth/demo-officer', { method: 'POST', body: {} });
    assert.equal(offLogin.response.status, 200);

    // 2. Officer drafts a freeze requisition for a case
    const caseId = 'CR-2026-00192';
    const prepRes = await officerClient.request(`/cases/${caseId}/freeze-requests`, {
      method: 'POST',
      body: {
        institutionId: 'VASP-WAZIRX-CUSTODY',
        accountIdentifier: '0x5d34...5910',
        requestedAmount: 642000,
        legalBasis: 'Section 102 Cr.P.C. / Section 106 BNSS (Requisition for Attachment of Proceeds of Crime)'
      }
    });
    assert.equal(prepRes.response.status, 201);
    const reqId = prepRes.data.id;
    assert.equal(prepRes.data.status, 'DRAFT');

    // 3. Officer attempts self-approval -> Maker-Checker violation: MUST FAIL with 403
    const selfApprove = await officerClient.request(`/cases/${caseId}/freeze-requests/${reqId}/approve`, {
      method: 'POST',
      body: {}
    });
    assert.equal(selfApprove.response.status, 403);
    assert.match(selfApprove.data.error, /Maker-Checker Violation/i);

    // 4. Supervisor logs in and approves -> MUST SUCCEED with 200
    const supervisorClient = client(server.baseUrl);
    const supLogin = await supervisorClient.request('/auth/demo-supervisor', { method: 'POST', body: {} });
    assert.equal(supLogin.response.status, 200);

    const approveRes = await supervisorClient.request(`/cases/${caseId}/freeze-requests/${reqId}/approve`, {
      method: 'POST',
      body: {}
    });
    assert.equal(approveRes.response.status, 200);
    assert.equal(approveRes.data.status, 'SUPERVISOR_APPROVED');
  });

  await t.test('7. Cryptographic hash-chained audit log and tamper detection', async () => {
    // Test hash-chain verification with untampered entries
    const entries = [];
    let prev = '0'.repeat(64);
    for (let i = 0; i < 5; i++) {
      const id = `entry-${i}`;
      const stamp = new Date(Date.now() + i * 1000).toISOString();
      const hash = computeAuditEntryHash(prev, id, stamp, 'USER-1', 'ACTION', 'TARGET', '{}');
      entries.push({ id, prev_hash: prev, entry_hash: hash, timestamp: stamp, user_id: 'USER-1', action: 'ACTION', object: 'TARGET', metadata: '{}' });
      prev = hash;
    }

    const validCheck = verifyAuditChain(entries);
    assert.equal(validCheck.valid, true);
    assert.equal(validCheck.totalEntries, 5);

    // Simulate tampering of entry #2's action
    const tamperedEntries = JSON.parse(JSON.stringify(entries));
    tamperedEntries[2].action = 'TAMPERED_ACTION';

    const tamperedCheck = verifyAuditChain(tamperedEntries);
    assert.equal(tamperedCheck.valid, false);
    assert.equal(tamperedCheck.brokenAtIndex, 2);

    // Verify /api/audit/verify endpoint works
    const auditVerifyRes = await testClient.request('/audit/verify');
    assert.equal(auditVerifyRes.response.status, 200);
    assert.equal(auditVerifyRes.data.valid, true);
  });

  await t.test('8. Suspended account: immediate session invalidation and login prohibition', async () => {
    // Register and login an officer
    const offEmail = 'suspended.target@cbi.gov.in';
    const regRes = await testClient.request('/auth/register', {
      method: 'POST',
      body: {
        email: offEmail,
        password: 'ValidOfficerPassword#2026',
        name: 'Officer ToSuspend',
        role: 'reporter'
      }
    });
    assert.equal(regRes.response.status, 201);
    const token = regRes.data.token;
    assert.ok(token);

    // Verify session is active
    const meRes = await testClient.request('/auth/me');
    assert.equal(meRes.response.status, 200);

    // Suspend user directly in child server's SQLite DB
    const db = new DatabaseSync(join(server.directory, 'test.sqlite'));
    db.prepare("UPDATE system_users SET status='SUSPENDED' WHERE email=?").run(offEmail);
    db.close();

    // Immediate session invalidation check: must fail with 403
    const postSuspendMe = await testClient.request('/auth/me');
    assert.equal(postSuspendMe.response.status, 403);
    assert.match(postSuspendMe.data.error, /suspended/i);

    // Login must be forbidden with 403
    const loginAttempt = await testClient.request('/auth/login', {
      method: 'POST',
      body: { email: offEmail, password: 'ValidOfficerPassword#2026' }
    });
    assert.equal(loginAttempt.response.status, 403);
    assert.match(loginAttempt.data.error, /suspended/i);
  });

  await t.test('9. Production DEMO_MODE safety: demo routes refused when NODE_ENV=production', async () => {
    const prodServer = await launchServer({ NODE_ENV: 'production' });
    const prodClient = client(prodServer.baseUrl);
    try {
      const prodDemoRes = await prodClient.request('/auth/demo', { method: 'POST', body: {} });
      assert.equal(prodDemoRes.response.status, 403);
      assert.match(prodDemoRes.data.error, /disabled in production/i);
    } finally {
      await prodServer.close();
    }
  });
});
