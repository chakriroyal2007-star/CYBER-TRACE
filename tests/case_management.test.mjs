import assert from 'node:assert/strict';
import { test } from 'node:test';
import { client, launchServer } from './helpers.mjs';

test('Reporter and CBI Officer Case Management Workflow', async (t) => {
  const server = await launchServer();
  const reporterClient = client(server.baseUrl);
  const otherReporterClient = client(server.baseUrl);
  const officerClient = client(server.baseUrl);
  let createdCaseId;
  let reporterId;
  let otherReporterId;
  let officerId;

  t.after(async () => {
    await server.close();
  });

  await t.test('registers and logs in a new Reporter', async () => {
    const regRes = await reporterClient.request('/auth/register', {
      method: 'POST',
      body: {
        email: 'ananya.sen@example.in',
        password: 'Password@123',
        name: 'Ananya Sen',
        role: 'reporter',
        phone: '+91 98450 12345'
      }
    });

    assert.equal(regRes.response.status, 201);
    assert.equal(regRes.data.user.email, 'ananya.sen@example.in');
    assert.equal(regRes.data.user.role, 'reporter');
    assert.equal(regRes.data.mode, 'REPORTER PORTAL');
    reporterId = regRes.data.user.id;

    const meRes = await reporterClient.request('/auth/me');
    assert.equal(meRes.response.status, 200);
    assert.equal(meRes.data.user.role, 'reporter');

    const otherRes = await otherReporterClient.request('/auth/register', {
      method: 'POST',
      body: {
        email: 'rohit.gupta@example.in',
        password: 'Password@123',
        name: 'Rohit Gupta',
        role: 'reporter'
      }
    });
    assert.equal(otherRes.response.status, 201);
    otherReporterId = otherRes.data.user.id;
  });

  await t.test('logs in CBI Officer using demo-officer or official credentials', async () => {
    const officerLogin = await officerClient.request('/auth/demo-officer', {
      method: 'POST',
      body: {}
    });

    assert.equal(officerLogin.response.status, 200);
    assert.equal(officerLogin.data.user.role, 'officer');
    assert.equal(officerLogin.data.mode, 'CBI OFFICER PORTAL');
    officerId = officerLogin.data.user.id;
  });

  await t.test('allows Reporter to submit a cybercrime complaint and receives unique Case ID', async () => {
    const complaintData = {
      incidentType: 'Fake Trading Exchange Scam',
      incidentDate: '2026-10-22T10:00:00.000Z',
      description: 'Lured into fraudulent trading website offering algorithmic returns on USDT. Transferred 3.2 lakh INR equivalent in crypto.',
      reportedLoss: 320000,
      currency: 'INR',
      chain: 'Ethereum',
      reportedWallet: '0x3f5ce5fbfe3e9af3971dd833d26ba9b5c936f0be',
      transactionHash: '0x9b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1b2c',
      attachments: [
        {
          name: 'bank_debit_utr.pdf',
          type: 'application/pdf',
          size: 142050,
          description: 'Bank payment UTR receipt'
        }
      ]
    };

    const res = await reporterClient.request('/complaints', {
      method: 'POST',
      body: complaintData
    });

    assert.equal(res.response.status, 201);
    assert.ok(res.data.caseId);
    assert.match(res.data.caseId, /^CR-2026-\d{5}$/);
    assert.equal(res.data.status, 'Submitted');
    assert.equal(res.data.reporterId, reporterId);
    assert.equal(res.data.reportedLoss, 320000);
    createdCaseId = res.data.caseId;

    const notesRes = await reporterClient.request('/notifications');
    assert.equal(notesRes.response.status, 200);
    assert.ok(notesRes.data.some(n => n.caseId === createdCaseId && n.type === 'CASE_FILED'));
  });

  await t.test('immediately surfaces the new complaint in CBI Officer incoming reports queue', async () => {
    const listRes = await officerClient.request('/complaints?status=Submitted');
    assert.equal(listRes.response.status, 200);
    assert.ok(Array.isArray(listRes.data));
    const found = listRes.data.find(c => c.caseId === createdCaseId);
    assert.ok(found, 'Newly submitted case must be present in incoming reports');
    assert.equal(found.status, 'Submitted');
    assert.equal(found.reportedLoss, 320000);
  });

  await t.test('enforces RBAC: Reporter can only view their own complaints', async () => {
    const myCasesRes = await reporterClient.request('/complaints');
    assert.equal(myCasesRes.response.status, 200);
    assert.ok(myCasesRes.data.some(c => c.caseId === createdCaseId));
    assert.ok(myCasesRes.data.every(c => c.reporterId === reporterId));

    const forbiddenRes = await otherReporterClient.request(`/complaints/${createdCaseId}`);
    assert.equal(forbiddenRes.response.status, 403);

    const officerView = await officerClient.request(`/complaints/${createdCaseId}`);
    assert.equal(officerView.response.status, 200);
    assert.equal(officerView.data.caseId, createdCaseId);
  });

  await t.test('validates state transitions and records status changes', async () => {
    // Reject invalid transition: Submitted -> Resolved directly must fail with 400
    const invalidTrans = await officerClient.request(`/complaints/${createdCaseId}/status`, {
      method: 'POST',
      body: { status: 'Resolved' }
    });
    assert.equal(invalidTrans.response.status, 400);

    // Valid transition: Submitted -> Pending Review
    const reviewRes = await officerClient.request(`/complaints/${createdCaseId}/status`, {
      method: 'POST',
      body: { status: 'Pending Review', reason: 'Assigned to preliminary evaluation desk.' }
    });
    assert.equal(reviewRes.response.status, 200);
    assert.equal(reviewRes.data.status, 'Pending Review');

    // Valid transition: Pending Review -> Accepted
    const acceptRes = await officerClient.request(`/complaints/${createdCaseId}/status`, {
      method: 'POST',
      body: { status: 'Accepted', reason: 'Complaint accepted for formal cybercrime inquiry.' }
    });
    assert.equal(acceptRes.response.status, 200);
    assert.equal(acceptRes.data.status, 'Accepted');

    // Transition to Under Investigation
    const investRes = await officerClient.request(`/complaints/${createdCaseId}/status`, {
      method: 'POST',
      body: { status: 'Under Investigation', reason: 'Active on-chain trace initiated.' }
    });
    assert.equal(investRes.response.status, 200);
    assert.equal(investRes.data.status, 'Under Investigation');
  });

  await t.test('allows Officer to assign case to an investigator', async () => {
    const officers = (await officerClient.request('/officers')).data;
    assert.ok(officers.length >= 1);

    const assignRes = await officerClient.request(`/complaints/${createdCaseId}/assign`, {
      method: 'POST',
      body: {
        officerId: officers[0].id,
        officerName: officers[0].name,
        notes: 'Lead investigator for cross-border fund movement'
      }
    });

    assert.equal(assignRes.response.status, 200);
    assert.equal(assignRes.data.assignedOfficerId, officers[0].id);
    assert.equal(assignRes.data.assignedOfficerName, officers[0].name);
  });

  await t.test('supports Evidence Request from Officer and Evidence Submission by Reporter', async () => {
    const reqRes = await officerClient.request(`/complaints/${createdCaseId}/request-evidence`, {
      method: 'POST',
      body: { requestedItems: 'Complete Telegram chat export and Binance deposit transaction hash' }
    });
    assert.equal(reqRes.response.status, 200);
    assert.equal(reqRes.data.status, 'Evidence Requested');

    const reporterNotes = (await reporterClient.request('/notifications')).data;
    assert.ok(reporterNotes.some(n => n.caseId === createdCaseId && n.type === 'EVIDENCE_REQUESTED'));

    const uploadRes = await reporterClient.request(`/complaints/${createdCaseId}/evidence`, {
      method: 'POST',
      body: {
        filename: 'telegram_chat_export.zip',
        fileType: 'application/zip',
        fileSize: 450890,
        description: 'Complete unredacted chat export with fraudster handle'
      }
    });
    assert.equal(uploadRes.response.status, 201);
    assert.ok(uploadRes.data.sha256);

    const updatedCase = (await reporterClient.request(`/complaints/${createdCaseId}`)).data;
    assert.equal(updatedCase.status, 'Evidence Received');
  });

  await t.test('guarantees internal note privacy: internal notes are NEVER visible to reporters', async () => {
    const noteRes = await officerClient.request(`/complaints/${createdCaseId}/notes`, {
      method: 'POST',
      body: { note: 'CONFIDENTIAL: Suspect wallet correlates with high-yield syndicates identified in NCRP bulletin #491.' }
    });
    assert.equal(noteRes.response.status, 201);
    assert.equal(noteRes.data.isInternal, 1);

    const officerCase = (await officerClient.request(`/complaints/${createdCaseId}`)).data;
    assert.ok(officerCase.updates.some(u => u.isInternal === 1 && u.message.includes('CONFIDENTIAL')));

    const reporterCase = (await reporterClient.request(`/complaints/${createdCaseId}`)).data;
    assert.ok(
      !reporterCase.updates.some(u => u.isInternal === 1),
      'Internal notes must NEVER be exposed to reporters'
    );
    assert.ok(
      !reporterCase.updates.some(u => u.message.includes('CONFIDENTIAL')),
      'Confidential content must not leak to reporters'
    );
  });

  await t.test('runs Cyber Trace transaction analytics from officer complaint view', async () => {
    const analyzeRes = await officerClient.request(`/complaints/${createdCaseId}/analyze`, {
      method: 'POST',
      body: {}
    });

    assert.equal(analyzeRes.response.status, 200);
    assert.ok(analyzeRes.data.riskScore >= 0 && analyzeRes.data.riskScore <= 100);
    assert.ok(analyzeRes.data.readinessScore >= 0 && analyzeRes.data.readinessScore <= 100);
    assert.ok(analyzeRes.data.mode);
    assert.ok(analyzeRes.data.disclaimer);

    const updatedComp = (await officerClient.request(`/complaints/${createdCaseId}`)).data;
    assert.ok(updatedComp.updates.some(u => u.updateType === 'ANALYTICS_EXECUTED'));
  });

  await t.test('validates Rejection flow with formal reason requirement', async () => {
    const comp2 = (await reporterClient.request('/complaints', {
      method: 'POST',
      body: {
        incidentType: 'Civil Contract Dispute',
        incidentDate: '2026-10-15T08:00:00.000Z',
        description: 'Dispute over freelance coding payment in tokens; counterparty paid 50% instead of agreed 100%.',
        reportedLoss: 45000,
        chain: 'Ethereum',
        reportedWallet: '0x1111111111111111111111111111111111111111'
      }
    })).data;

    const failReject = await officerClient.request(`/complaints/${comp2.caseId}/status`, {
      method: 'POST',
      body: { status: 'Rejected' }
    });
    assert.equal(failReject.response.status, 400);

    const rejectSuccess = await officerClient.request(`/complaints/${comp2.caseId}/status`, {
      method: 'POST',
      body: {
        status: 'Rejected',
        reason: 'Civil breach of contract outside criminal cyber fraud jurisdiction. Advised to seek civil remedy.'
      }
    });
    assert.equal(rejectSuccess.response.status, 200);
    assert.equal(rejectSuccess.data.status, 'Rejected');
    assert.match(rejectSuccess.data.rejectionReason, /Civil breach/i);
  });
});
