import assert from 'node:assert/strict';
import { test } from 'node:test';
import { client, launchServer } from './helpers.mjs';

test('Cyber Trace India: 19-Step End-to-End Investigation Lifecycle', async (t) => {
  const server = await launchServer();
  const reporter = client(server.baseUrl);
  const officer = client(server.baseUrl);
  const currentYear = new Date().getFullYear();

  let caseId;
  let reporterUserId;
  let officerUserId;
  let evidenceId;
  let realCaseId;

  t.after(async () => {
    await server.close();
  });

  // Step 1: Citizen registration and login
  await t.test('Step 1: Citizen registration and authentication', async () => {
    const regRes = await reporter.request('/auth/register', {
      method: 'POST',
      body: {
        name: 'Priya Nair',
        email: 'priya.demo@example.in',
        password: 'Password@2026',
        role: 'reporter',
        phone: '+91 98765 43210'
      }
    });
    assert.equal(regRes.response.status, 201);
    assert.equal(regRes.data.user.email, 'priya.demo@example.in');
    assert.equal(regRes.data.user.role, 'reporter');
    reporterUserId = regRes.data.user.id;

    // CBI Officer login
    const offRes = await officer.request('/auth/demo-officer', {
      method: 'POST',
      body: {}
    });
    assert.equal(offRes.response.status, 200);
    assert.equal(offRes.data.user.role, 'officer');
    officerUserId = offRes.data.user.id;
  });

  // Step 2: Form validation failure on invalid input
  await t.test('Step 2: Backend rejects invalid complaint inputs', async () => {
    // Missing incident type
    const resNoType = await reporter.request('/complaints', {
      method: 'POST',
      body: {
        description: 'Valid description here but missing incidentType',
        reportedLoss: 10000
      }
    });
    assert.equal(resNoType.response.status, 400);

    // Missing / too short description
    const resShortDesc = await reporter.request('/complaints', {
      method: 'POST',
      body: {
        incidentType: 'Investment Scam',
        description: 'hi',
        reportedLoss: 10000
      }
    });
    assert.equal(resShortDesc.response.status, 400);
  });

  // Step 3: Successful complaint submission (Fictional Priya Nair WhatsApp scam)
  await t.test('Step 3: Successful complaint submission', async () => {
    const submitRes = await reporter.request('/complaints', {
      method: 'POST',
      body: {
        incidentType: 'Investment Scam',
        incidentDate: '2026-03-01',
        reportedLoss: 642000,
        currency: 'INR',
        chain: 'Bitcoin',
        reportedWallet: '1A1zP1eP5QGefi2DMPTfTL5SLmv7DivfNa',
        transactionHash: '232629023',
        incidentChannel: 'WhatsApp / Web',
        is_demo: 1,
        description: 'Victim was approached via WhatsApp with promises of automated 35% weekly cryptocurrency arbitrage yields by AlphaTrade Global. Transferred ₹6,42,000 INR converted to Bitcoin.',
        attachments: [
          {
            filename: 'WhatsApp_Chat_AlphaTrade.pdf',
            fileType: 'application/pdf',
            fileSize: 245760,
            description: 'Exported chat transcript with fraudulent broker'
          }
        ]
      }
    });

    assert.equal(submitRes.response.status, 201);
    assert.ok(submitRes.data.caseId);
    caseId = submitRes.data.caseId;
  });

  // Step 4: Correct sequential Case ID format (CR-${year}-${seq})
  await t.test('Step 4: Sequential Case ID adheres to CR-YYYY-XXXXX format', async () => {
    const idPattern = new RegExp(`^CR-${currentYear}-\\d{5}$`);
    assert.match(caseId, idPattern, `Case ID ${caseId} must match CR-YYYY-XXXXX`);
  });

  // Step 5: Correct storage of all fields in SQLite
  await t.test('Step 5: Complaint fields stored accurately in database', async () => {
    const getRes = await reporter.request(`/complaints/${caseId}`);
    assert.equal(getRes.response.status, 200);
    const c = getRes.data;
    assert.equal(c.caseId, caseId);
    assert.equal(c.incidentType, 'Investment Scam');
    assert.equal(c.reportedLoss, 642000);
    assert.equal(c.currency, 'INR');
    assert.equal(c.chain, 'Bitcoin');
    assert.equal(c.reportedWallet, '1A1zP1eP5QGefi2DMPTfTL5SLmv7DivfNa');
    assert.equal(c.transactionHash, '232629023');
    assert.equal(c.status, 'Submitted');
    assert.equal(c.priority, 'High'); // >= 500000 is High
  });

  // Step 6: Evidence file upload with SHA-256 hash
  await t.test('Step 6: Evidence file upload with SHA-256 integrity hash', async () => {
    const evRes = await reporter.request(`/complaints/${caseId}/evidence`, {
      method: 'POST',
      body: {
        filename: 'Bank_Transfer_UTR_Receipt.pdf',
        fileType: 'application/pdf',
        fileSize: 182400,
        description: 'Bank UTR transfer voucher for ₹6,42,000'
      }
    });

    assert.equal(evRes.response.status, 201);
    assert.ok(evRes.data.id);
    assert.ok(evRes.data.sha256);
    assert.equal(evRes.data.sha256.length, 64); // Valid SHA-256 hex length
    evidenceId = evRes.data.id;
  });

  // Step 7: Immediate appearance in CBI Officer incoming queue
  await t.test('Step 7: Officer immediately sees complaint in incoming queue', async () => {
    const queueRes = await officer.request('/complaints');
    assert.equal(queueRes.response.status, 200);
    const found = queueRes.data.find(c => c.caseId === caseId);
    assert.ok(found, `Case ${caseId} must be present in officer incoming queue`);
    assert.equal(found.status, 'Submitted');
  });

  // Step 8: Filter queue by status, network, priority
  await t.test('Step 8: Officer filters queue by status, network, priority', async () => {
    const filteredRes = await officer.request(`/complaints?status=Submitted&chain=Bitcoin&priority=High`);
    assert.equal(filteredRes.response.status, 200);
    const match = filteredRes.data.find(c => c.caseId === caseId);
    assert.ok(match, 'Filtered query must return the matching case');

    // Mismatched filter returns empty or excludes this case
    const mismatchRes = await officer.request(`/complaints?chain=Solana`);
    assert.equal(mismatchRes.response.status, 200);
    const absent = mismatchRes.data.find(c => c.caseId === caseId);
    assert.equal(absent, undefined);
  });

  // Step 9: Case assignment to investigator and acceptance
  await t.test('Step 9: Officer accepts complaint and assigns case to investigator', async () => {
    const acceptRes = await officer.request(`/complaints/${caseId}/status`, {
      method: 'POST',
      body: {
        status: 'Accepted',
        reason: 'Complaint reviewed and verified by CBI intake team.'
      }
    });
    assert.equal(acceptRes.response.status, 200);
    assert.equal(acceptRes.data.status, 'Accepted');

    const assignRes = await officer.request(`/complaints/${caseId}/assign`, {
      method: 'POST',
      body: {
        officerId: officerUserId,
        officerName: 'Insp. Rajesh Sharma (CBI Officer)',
        notes: 'Assigned for priority forensic graph tracing.'
      }
    });
    assert.equal(assignRes.response.status, 200);
    assert.equal(assignRes.data.assignedOfficerId, officerUserId);
  });

  // Step 10: Status change to Under Investigation
  await t.test('Step 10: Officer transitions status to Under Investigation', async () => {
    const statusRes = await officer.request(`/complaints/${caseId}/status`, {
      method: 'POST',
      body: {
        status: 'Under Investigation',
        reason: 'Forensic wallet analysis authorized under Section 91 CrPC.'
      }
    });
    assert.equal(statusRes.response.status, 200);
    assert.equal(statusRes.data.status, 'Under Investigation');
  });

  // Step 11: Evidence request generation
  await t.test('Step 11: Officer generates formal evidence request', async () => {
    const reqRes = await officer.request(`/complaints/${caseId}/request-evidence`, {
      method: 'POST',
      body: {
        requestedItems: 'Provide official stamped bank account statement showing debit of ₹6,42,000.'
      }
    });
    assert.equal(reqRes.response.status, 200);
    assert.equal(reqRes.data.status, 'Evidence Requested');
  });

  // Step 12: Reporter notification of evidence request
  await t.test('Step 12: Reporter receives notification for evidence request', async () => {
    const notifRes = await reporter.request('/notifications');
    assert.equal(notifRes.response.status, 200);
    const targetNotif = notifRes.data.find(n => n.caseId === caseId);
    assert.ok(targetNotif, 'Reporter must receive a notification for the case');
    assert.equal(targetNotif.type, 'EVIDENCE_REQUESTED');
  });

  // Step 13: Reporter submission of additional evidence
  await t.test('Step 13: Reporter responds by uploading requested document', async () => {
    const uploadRes = await reporter.request(`/complaints/${caseId}/evidence`, {
      method: 'POST',
      body: {
        filename: 'HDFC_Bank_Stamped_Statement.pdf',
        fileType: 'application/pdf',
        fileSize: 312000,
        description: 'Stamped HDFC account statement confirming ₹6,42,000 debit.'
      }
    });
    assert.equal(uploadRes.response.status, 201);
  });

  // Step 14: Automatic transition to Evidence Received
  await t.test('Step 14: Case status automatically advances to Evidence Received', async () => {
    const caseRes = await reporter.request(`/complaints/${caseId}`);
    assert.equal(caseRes.response.status, 200);
    assert.equal(caseRes.data.status, 'Evidence Received');
  });

  // Step 15: Officer internal note creation
  await t.test('Step 15: Officer logs confidential internal note', async () => {
    const noteRes = await officer.request(`/complaints/${caseId}/notes`, {
      method: 'POST',
      body: {
        note: 'INTERNAL CONFIDENTIAL: Suspect wallet identified in laundering hop. Exchange KYC freeze requested.'
      }
    });
    assert.equal(noteRes.response.status, 201);
    assert.ok(noteRes.data.isInternal);
  });

  // Step 16: Verification that internal note is NOT returned to reporter
  await t.test('Step 16: Strict RBAC filters confidential internal notes from reporter', async () => {
    // Officer sees internal notes
    const officerCase = await officer.request(`/complaints/${caseId}`);
    assert.equal(officerCase.response.status, 200);
    const officerNotes = officerCase.data.updates.filter(u => u.isInternal);
    assert.ok(officerNotes.length > 0, 'Officer must be able to view internal notes');

    // Reporter MUST NOT see internal notes
    const reporterCase = await reporter.request(`/complaints/${caseId}`);
    assert.equal(reporterCase.response.status, 200);
    const reporterInternal = (reporterCase.data.updates || []).filter(u => u.isInternal);
    assert.equal(reporterInternal.length, 0, 'Internal notes must NEVER be exposed to reporters');
  });

  // Step 17: Transaction analytics execution (Risk Score, Elliptic dataset integration)
  await t.test('Step 17: Cyber Trace transaction analytics computes risk score', async () => {
    const analyticsRes = await officer.request(`/complaints/${caseId}/analyze`, {
      method: 'POST',
      body: {}
    });
    assert.equal(analyticsRes.response.status, 200);
    assert.ok(analyticsRes.data.riskScore !== undefined);
    assert.ok(analyticsRes.data.riskCategory);
    assert.ok(analyticsRes.data.readinessScore !== undefined);
    assert.ok(analyticsRes.data.modelParameters);
  });

  // Step 18: Case resolution with reason and history logging
  await t.test('Step 18: Officer resolves case with audit logging', async () => {
    const resolveRes = await officer.request(`/complaints/${caseId}/status`, {
      method: 'POST',
      body: {
        status: 'Resolved',
        reason: 'Forensic graph analysis completed. Exchange freeze notice served under Section 91.'
      }
    });
    assert.equal(resolveRes.response.status, 200);
    assert.equal(resolveRes.data.status, 'Resolved');

    // Verify history timeline contains status transitions
    const finalCase = await officer.request(`/complaints/${caseId}`);
    const statusChanges = finalCase.data.updates.filter(u => u.updateType === 'STATUS_CHANGE');
    assert.ok(statusChanges.length >= 3, 'Must record full status transition history in updates');
  });

  // Step 19: Demo reset cleans up demo data while preserving real cases
  await t.test('Step 19: Demo reset safely purges demo cases while preserving real cases', async () => {
    // 1. Create a non-demo (real) complaint
    const realRes = await reporter.request('/complaints', {
      method: 'POST',
      body: {
        incidentType: 'Phishing',
        description: 'Real citizen complaint that must survive demo reset.',
        reportedLoss: 75000,
        is_demo: 0
      }
    });
    assert.equal(realRes.response.status, 201);
    realCaseId = realRes.data.caseId;

    // 2. Trigger demo reset
    const resetRes = await reporter.request('/demo/reset', {
      method: 'POST',
      body: {}
    });
    assert.equal(resetRes.response.status, 200);
    assert.equal(resetRes.data.ok, true);
    assert.ok(resetRes.data.caseIds.includes(caseId), 'Demo case must be in purged list');
    assert.ok(!resetRes.data.caseIds.includes(realCaseId), 'Real case must NOT be in purged list');

    // 3. Confirm demo case is gone
    const getDemoRes = await officer.request(`/complaints/${caseId}`);
    assert.equal(getDemoRes.response.status, 404);

    // 4. Confirm real case is preserved
    const getRealRes = await officer.request(`/complaints/${realCaseId}`);
    assert.equal(getRealRes.response.status, 200);
    assert.equal(getRealRes.data.caseId, realCaseId);
  });
});
