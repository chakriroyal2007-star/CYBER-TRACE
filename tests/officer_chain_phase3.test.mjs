import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { launchServer, client as createClient } from './helpers.mjs';
import { generateSection106Notice, generateSection94Notice, generateBsa63Certificate, DISCLAIMER_BANNER } from '../server/legal/statutoryNotices.mjs';

test('Phase 3: Officer Investigation Chain, Case Scoping, State Machine & Maker-Checker', async (t) => {
  let server;
  let client;
  let db;

  t.before(async () => {
    server = await launchServer();
    client = createClient(server.baseUrl);
    db = new DatabaseSync(join(server.directory, 'test.sqlite'));
  });

  t.after(async () => {
    if (server) await server.close();
  });

  let reporterToken;
  let officerToken;
  let officer2Token;
  let supervisorToken;
  let auditorToken;
  let caseId;

  await t.test('3.0 Auth Setup: Register Reporter, Officer, Officer2, Supervisor, Auditor', async () => {
    // 1. Reporter
    const repRes = await client.request('/auth/register', {
      method: 'POST',
      body: {
        email: 'victim.citizen.p3@example.in',
        password: 'Password@2026!Strong',
        name: 'Karan Singhania',
        role: 'reporter',
        phone: '+919876543210'
      }
    });
    assert.equal(repRes.response.status, 201);
    reporterToken = repRes.data.token;

    // 2. Primary Investigating Officer
    const offLogin = await client.request('/auth/demo-officer', { method: 'POST' });
    assert.equal(offLogin.response.status, 200);
    officerToken = offLogin.data.token;

    // 3. Supervisor
    const supLogin = await client.request('/auth/demo-supervisor', { method: 'POST' });
    assert.equal(supLogin.response.status, 200);
    supervisorToken = supLogin.data.token;

    // 4. Secondary Officer for scoping tests
    const token2 = 'sess-token-officer-2';
    const token2Hash = createHash('sha256').update(token2).digest('hex');
    db.prepare(`
      INSERT OR REPLACE INTO system_users (id, email, password_hash, display_name, role, agency, badge_number, unit, status, created_at)
      VALUES ('USR-OFF-02', 'io2.delhi@cbi.gov.in', 'hash', 'Insp. Sunita Rao', 'officer', 'Central Bureau of Investigation', 'CBI-7712', 'South Delhi Cyber Cell', 'ACTIVE', datetime('now'))
    `).run();
    db.prepare(`
      INSERT OR REPLACE INTO users (id, display_name, role, created_at)
      VALUES ('USR-OFF-02', 'Insp. Sunita Rao', 'officer', datetime('now'))
    `).run();
    db.prepare(`
      INSERT INTO sessions (id, token_hash, user_id, created_at, expires_at, weights)
      VALUES ('sess-id-2', ?, 'USR-OFF-02', datetime('now'), datetime('now', '+24 hours'), '{}')
    `).run(token2Hash);
    officer2Token = token2;

    // 5. Auditor
    const audToken = 'sess-token-auditor-1';
    const audTokenHash = createHash('sha256').update(audToken).digest('hex');
    db.prepare(`
      INSERT OR REPLACE INTO system_users (id, email, password_hash, display_name, role, agency, badge_number, unit, status, created_at)
      VALUES ('USR-AUD-01', 'auditor.cag@gov.in', 'hash', 'Sunil Mathur (CAG Auditor)', 'auditor', 'Comptroller & Auditor General', 'CAG-092', 'Forensic Audit', 'ACTIVE', datetime('now'))
    `).run();
    db.prepare(`
      INSERT OR REPLACE INTO users (id, display_name, role, created_at)
      VALUES ('USR-AUD-01', 'Sunil Mathur (CAG Auditor)', 'auditor', datetime('now'))
    `).run();
    db.prepare(`
      INSERT INTO sessions (id, token_hash, user_id, created_at, expires_at, weights)
      VALUES ('sess-id-aud', ?, 'USR-AUD-01', datetime('now'), datetime('now', '+24 hours'), '{}')
    `).run(audTokenHash);
    auditorToken = audToken;

    // 6. Submit a test complaint
    const compRes = await client.request('/complaints', {
      method: 'POST',
      headers: { authorization: `Bearer ${reporterToken}` },
      body: {
        incidentType: 'Fake Trading Exchange Scam',
        incidentDate: '2026-10-25T11:00:00.000Z',
        description: 'Victim persuaded to deposit ₹5,00,000 into fraudulent investment portal. Multiple pass-through transfers to suspected mule account.',
        reportedLoss: 500000,
        currency: 'INR',
        chain: 'Ethereum',
        reportedWallet: '0x28c6c06298d514db089934071355e5743bf21d60',
        suspectUpi: 'invest.profit99@icici',
        suspectPhone: '+919988776655',
        utrNumber: '529819283741'
      }
    });
    assert.equal(compRes.response.status, 201);
    caseId = compRes.data.caseId;
    assert.ok(caseId);
  });

  await t.test('3.1 Officer queue: priority sorting (high-loss first), linkage badges, and 24h SLA timer', async () => {
    const listRes = await client.request('/complaints?sortBy=loss', {
      headers: { authorization: `Bearer ${officerToken}` }
    });
    assert.equal(listRes.response.status, 200);
    assert.ok(Array.isArray(listRes.data));
    assert.ok(listRes.data.length > 0);

    const target = listRes.data.find(c => c.caseId === caseId);
    assert.ok(target, 'Target complaint must appear in officer incoming reports queue');

    // 1. Verify 24h statutory SLA calculation
    assert.ok(target.sla, 'Complaint in officer queue must contain SLA tracking object');
    assert.equal(target.sla.windowHours, 24);
    assert.ok(typeof target.sla.remainingHours === 'number');
    assert.ok(target.sla.remainingHours > 20, 'Newly submitted case should have ~24 hours remaining');
    assert.equal(target.sla.isBreached, false);
    assert.equal(target.sla.urgency, 'STANDARD');

    // 2. Verify linkage badges
    assert.ok(target.linkageBadges, 'Complaint must contain linkage badges object');
    assert.ok(typeof target.linkageBadges.linkedCount === 'number');

    // 3. Verify priority loss sorting
    const losses = listRes.data.map(c => Number(c.reportedLoss || 0));
    for (let i = 0; i < losses.length - 1; i++) {
      assert.ok(losses[i] >= losses[i + 1], 'Officer queue sorted by loss must list high-loss cases first');
    }
  });

  await t.test('3.2 Case scoping: Officer claims unassigned case, Supervisor reassigns, Auditor justification enforcement', async () => {
    // 1. Investigating Officer claims unassigned case
    const claimRes = await client.request(`/complaints/${caseId}/claim`, {
      method: 'POST',
      headers: { authorization: `Bearer ${officerToken}` }
    });
    assert.equal(claimRes.response.status, 200);
    assert.equal(claimRes.data.status, 'Assigned');
    assert.ok(claimRes.data.assignedOfficerId);

    // 2. Second officer tries to claim already assigned case -> Conflict (409)
    const conflictRes = await client.request(`/complaints/${caseId}/claim`, {
      method: 'POST',
      headers: { authorization: `Bearer ${officer2Token}` }
    });
    assert.equal(conflictRes.response.status, 404); // Out-of-scope case is concealed.

    // 3. Supervisor can reassign case to Officer 2
    const reassignRes = await client.request(`/complaints/${caseId}/assign`, {
      method: 'POST',
      headers: { authorization: `Bearer ${supervisorToken}` },
      body: {
        officerId: 'USR-OFF-02',
        officerName: 'Insp. Sunita Rao',
        notes: 'Transferred to South Delhi Cyber Cell for local mule interrogation.'
      }
    });
    assert.equal(reassignRes.response.status, 200);
    assert.equal(reassignRes.data.assignedOfficerId, 'USR-OFF-02');

    // Reassign back to primary officer for remainder of test
    await client.request(`/complaints/${caseId}/assign`, {
      method: 'POST',
      headers: { authorization: `Bearer ${supervisorToken}` },
      body: { officerId: 'USR-OFFICER-001', officerName: 'Insp. Rajesh Sharma' }
    });

    // 4. Auditor Access: Without justification header -> 400 Bad Request
    const unauthAuditor = await client.request(`/complaints/${caseId}`, {
      headers: { authorization: `Bearer ${auditorToken}` }
    });
    assert.equal(unauthAuditor.response.status, 400, 'Auditor access without justification must be rejected');

    // 5. Auditor Access: With justification header -> 200 OK + logged in audit trail
    const authAuditor = await client.request(`/complaints/${caseId}`, {
      headers: {
        authorization: `Bearer ${auditorToken}`,
        'x-audit-justification': 'Statutory Q4 compliance inspection under Section 19 CAG Act'
      }
    });
    assert.equal(authAuditor.response.status, 200);
    assert.equal(authAuditor.data.caseId, caseId);

    // 6. Citizen isolation: Another reporter cannot see cases belonging to others
    const rep2Res = await client.request('/auth/register', {
      method: 'POST',
      body: {
        email: 'other.victim@example.in',
        password: 'Password@2026!Strong',
        name: 'Rahul Varma',
        role: 'reporter',
        phone: '+919876543299'
      }
    });
    const repScopingRes = await client.request(`/complaints/${caseId}`, {
      headers: { authorization: `Bearer ${rep2Res.data.token}` }
    });
    assert.equal(repScopingRes.response.status, 404, 'Citizen must not be authorized to view other citizens cases');
  });

  await t.test('3.3 Full Case State Machine transitions with audit log validation', async () => {
    // Current status: 'Assigned'
    // Move: Assigned -> Trace in Progress
    const t1 = await client.request(`/complaints/${caseId}/status`, {
      method: 'POST',
      headers: { authorization: `Bearer ${officerToken}` },
      body: { status: 'Trace in Progress', reason: 'Forensic multi-hop graph reconstruction commenced.' }
    });
    assert.equal(t1.response.status, 200);
    assert.equal(t1.data.status, 'Trace in Progress');

    // Move: Trace in Progress -> Evidence Requested
    const t2 = await client.request(`/complaints/${caseId}/status`, {
      method: 'POST',
      headers: { authorization: `Bearer ${officerToken}` },
      body: { status: 'Evidence Requested', reason: 'Bank transaction slip required from victim.' }
    });
    assert.equal(t2.response.status, 200);
    assert.equal(t2.data.status, 'Evidence Requested');

    // Move: Evidence Requested -> Evidence Received
    const t3 = await client.request(`/complaints/${caseId}/status`, {
      method: 'POST',
      headers: { authorization: `Bearer ${officerToken}` },
      body: { status: 'Evidence Received', reason: 'Victim submitted certified bank debit statement.' }
    });
    assert.equal(t3.response.status, 200);
    assert.equal(t3.data.status, 'Evidence Received');

    // Invalid transition: Evidence Received -> Freeze Confirmed (skipping Freeze Requested)
    const invalidTrans = await client.request(`/complaints/${caseId}/status`, {
      method: 'POST',
      headers: { authorization: `Bearer ${officerToken}` },
      body: { status: 'Freeze Confirmed', reason: 'Illegal shortcut' }
    });
    assert.equal(invalidTrans.response.status, 400, 'Invalid state transition must be rejected with 400');
  });

  await t.test('3.6 Statutory freeze package generator: Section 106 BNSS & Section 94 BNSS requisitions', async () => {
    // 1. Generate Section 106 BNSS 2023 Notice (Seizure / Account Debit Freeze)
    const s106 = generateSection106Notice({
      caseId,
      incidentType: 'Fake Trading Exchange Scam',
      reportedLoss: 500000,
      currency: 'INR',
      targetInstitution: 'Axis Bank / WazirX Digital Custody',
      accountIdentifier: '0x28c6c06298d514db089934071355e5743bf21d60',
      officerName: 'Insp. Rajesh Sharma',
      officerDesignation: 'Inspector of Police',
      officerUnit: 'CBI Cyber Crime Division'
    });

    assert.equal(s106.documentType, 'SECTION_106_BNSS_FREEZE_NOTICE');
    assert.equal(s106.isDraftForReview, true);
    assert.ok(s106.text.includes(DISCLAIMER_BANNER), 'Must contain mandatory legal disclaimer');
    assert.ok(s106.text.includes('DRAFT FOR LEGAL REVIEW - NOT A DIRECT PLATFORM FREEZE'));
    assert.ok(s106.text.includes('SECTION 106 OF THE BHARATIYA NAGARIK SURAKSHA SANHITA, 2023 (BNSS)'));
    assert.ok(s106.text.includes('SECTION 102 OF THE CODE OF CRIMINAL PROCEDURE, 1973'));
    assert.ok(s106.text.includes('MAGISTRATE ENDORSEMENT'));
    assert.ok(s106.sha256Seal.length === 64);

    // 2. Generate Section 94 BNSS 2023 Notice (Summons for Documents & Logs)
    const s94 = generateSection94Notice({
      caseId,
      targetInstitution: 'WazirX Compliance Desk',
      identifiers: ['0x28c6c06298d514db089934071355e5743bf21d60', 'invest.profit99@icici'],
      officerName: 'Insp. Rajesh Sharma'
    });

    assert.equal(s94.documentType, 'SECTION_94_BNSS_SUMMONS');
    assert.ok(s94.text.includes('SECTION 94 OF THE BHARATIYA NAGARIK SURAKSHA SANHITA, 2023'));
    assert.ok(s94.text.includes('SECTION 91 OF THE CODE OF CRIMINAL PROCEDURE, 1973'));

    // 3. API endpoint for statutory notices
    const apiNoticeRes = await client.request(`/complaints/${caseId}/statutory-notice?type=bnss106`, {
      headers: { authorization: `Bearer ${officerToken}` }
    });
    assert.equal(apiNoticeRes.response.status, 200);
    assert.equal(apiNoticeRes.data.statutorySection, 'Section 106 BNSS 2023 (formerly Section 102 Cr.P.C.)');
  });

  await t.test('3.7 Maker-Checker Freeze Workflow: Officer drafts, Officer cannot self-approve, Supervisor approves, Officer dispatches', async () => {
    // 1. Officer drafts freeze request
    const draftRes = await client.request(`/complaints/${caseId}/freeze-requests`, {
      method: 'POST',
      headers: { authorization: `Bearer ${officerToken}` },
      body: {
        institutionId: 'Binance / WazirX Gateway',
        accountIdentifier: '0x28c6c06298d514db089934071355e5743bf21d60',
        requestedAmount: 500000,
        legalBasis: 'Section 106 BNSS 2023 read with Section 69 IT Act 2000'
      }
    });
    assert.equal(draftRes.response.status, 201);
    const freezeReqId = draftRes.data.id;
    assert.ok(freezeReqId);
    assert.equal(draftRes.data.status, 'DRAFT');

    // 2. Officer attempts to self-approve -> Forbidden (403 Maker-Checker violation)
    const selfApprove = await client.request(`/complaints/${caseId}/freeze-requests/${freezeReqId}/approve`, {
      method: 'POST',
      headers: { authorization: `Bearer ${officerToken}` },
      body: { notes: 'Attempting self-approval' }
    });
    assert.equal(selfApprove.response.status, 403, 'Investigating officer must not be permitted to self-approve freeze requests');

    // 3. Attempting to dispatch unapproved request to Nodal -> Bad Request (400)
    const unapprovedSend = await client.request(`/complaints/${caseId}/freeze-requests/${freezeReqId}/send`, {
      method: 'POST',
      headers: { authorization: `Bearer ${officerToken}` }
    });
    assert.equal(unapprovedSend.response.status, 400, 'Cannot send unapproved freeze request to nodal officer');

    // 4. Supervisor approves freeze request
    const supApprove = await client.request(`/complaints/${caseId}/freeze-requests/${freezeReqId}/approve`, {
      method: 'POST',
      headers: { authorization: `Bearer ${supervisorToken}` },
      body: { notes: 'Evidence nexus confirmed with suspect Binance withdrawal. Requisition approved for dispatch.' }
    });
    assert.equal(supApprove.response.status, 200);
    assert.equal(supApprove.data.status, 'SUPERVISOR_APPROVED');

    // 5. Officer dispatches approved freeze request to Nodal
    const sendRes = await client.request(`/complaints/${caseId}/freeze-requests/${freezeReqId}/send`, {
      method: 'POST',
      headers: { authorization: `Bearer ${officerToken}` }
    });
    assert.equal(sendRes.response.status, 200);
    assert.equal(sendRes.data.status, 'SENT_TO_NODAL');

    // Verify complaint transitioned to 'Freeze Requested'
    const compCheck = await client.request(`/complaints/${caseId}`, {
      headers: { authorization: `Bearer ${officerToken}` }
    });
    assert.equal(compCheck.data.status, 'Freeze Requested');
  });

  await t.test('3.8 Nodal Portal Response: Record institutional action, transition case to Freeze Confirmed / Partially Frozen', async () => {
    const freezeList = await client.request(`/complaints/${caseId}/freeze-requests`, {
      headers: { authorization: `Bearer ${officerToken}` }
    });
    const freezeReq = freezeList.data[0];
    assert.ok(freezeReq);

    // Bank/Exchange Nodal Desk records compliance response
    const nodalResponse = await client.request(`/complaints/${caseId}/freeze-requests/${freezeReq.id}/nodal-response`, {
      method: 'POST',
      headers: { authorization: `Bearer ${officerToken}` },
      body: {
        action: 'Account Frozen',
        referenceNumber: 'AXIS-CYBER-FRZ-88991',
        amountFrozen: 485000,
        nodalName: 'Mr. Arvind Saxena (Nodal Officer, Axis Bank)',
        complianceNotes: 'Debit freeze placed on Account No. 918020048192837. Remaining balance ₹4,85,000 secured.'
      }
    });

    assert.equal(nodalResponse.response.status, 200);
    assert.equal(nodalResponse.data.status, 'FREEZE_CONFIRMED');
    assert.equal(nodalResponse.data.amount_frozen, 485000);
    assert.equal(nodalResponse.data.response_reference, 'AXIS-CYBER-FRZ-88991');

    // Case status automatically advanced to Freeze Confirmed
    const updatedComp = await client.request(`/complaints/${caseId}`, {
      headers: { authorization: `Bearer ${officerToken}` }
    });
    assert.equal(updatedComp.data.status, 'Freeze Confirmed');
  });

  await t.test('3.9 Court Package Compilation with Section 63 BSA Certificate', async () => {
    const courtPkgRes = await client.request(`/complaints/${caseId}/court-package`, {
      method: 'POST',
      headers: { authorization: `Bearer ${officerToken}` }
    });

    assert.equal(courtPkgRes.response.status, 200);
    const pkg = courtPkgRes.data;
    assert.ok(pkg.packageReference);
    assert.match(pkg.packageReference, /^CRT-PKG-/);
    assert.ok(pkg.documents.section106Notice);
    assert.ok(pkg.documents.section94Summons);
    assert.ok(pkg.documents.section63BsaCertificate);
    assert.equal(pkg.disclaimer, 'DRAFT FOR LEGAL REVIEW - NOT A DIRECT PLATFORM FREEZE');

    // Case status advanced to Court Package Generated
    const finalComp = await client.request(`/complaints/${caseId}`, {
      headers: { authorization: `Bearer ${officerToken}` }
    });
    assert.equal(finalComp.data.status, 'Court Package Generated');
  });
});
