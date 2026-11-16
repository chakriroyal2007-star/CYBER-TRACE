import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash, randomUUID } from 'node:crypto';
import { Store } from '../server/db.mjs';
import { processProofUpload, stripImageMetadata, recordCustodyEvent } from '../server/reporting/proofUpload.mjs';
import { extractComplaintParameters, isValidEip55Checksum } from '../server/reporting/extractor.mjs';
import { duplicateDetector } from '../server/reporting/duplicateDetector.mjs';
import { autoTracePublicWallet } from '../server/reporting/autoTracer.mjs';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { launchServer, client as createClient } from './helpers.mjs';

test('Phase 2: Real Citizen Reporting, Proof Custody, Extraction, Tracking and Auto-Trace', async (t) => {
  let server;
  let client;
  let store;

  t.before(async () => {
    server = await launchServer();
    client = createClient(server.baseUrl);
    const db = new DatabaseSync(join(server.directory, 'test.sqlite'));
    store = { db };
    duplicateDetector.seedFromStore(store);
  });

  t.after(async () => {
    if (server) await server.close();
  });

  await t.test('2.1 & 2.2 Proof upload: validates size (<=15MB), strips EXIF, computes SHA-256, and records chain of custody', async () => {
    // Construct simulated JPEG with APP1 EXIF segment (0xFF 0xE1 0x00 0x08 ...)
    const exifMarker = Buffer.from([0xFF, 0xE1, 0x00, 0x08, 0x45, 0x78, 0x69, 0x66, 0x00, 0x00]);
    const imagePayload = Buffer.concat([
      Buffer.from([0xFF, 0xD8]), // SOI
      exifMarker,
      Buffer.from('IMAGE_PIXEL_DATA_PAYLOAD_HERE', 'utf8'),
      Buffer.from([0xFF, 0xD9])  // EOI
    ]);

    const stripped = stripImageMetadata(imagePayload, 'image/jpeg');
    // Ensure APP1 marker was stripped out
    assert.equal(stripped.includes(Buffer.from([0xFF, 0xE1])), false, 'JPEG APP1 EXIF header must be stripped');

    // Test processProofUpload
    const uploadResult = await processProofUpload({
      fileBuffer: imagePayload,
      originalFilename: 'scam_payment_slip.jpg',
      mimeType: 'image/jpeg',
      caseId: 'CR-2026-TEST1',
      uploadedById: 'USR-CITIZEN-01',
      uploadedByName: 'Priya Sharma',
      uploaderRole: 'reporter',
      description: 'Payment slip screenshot showing ₹1,50,000 transfer'
    });

    assert.ok(uploadResult.evidenceId);
    assert.equal(uploadResult.mimeType, 'image/jpeg');
    assert.equal(uploadResult.sha256.length, 64, 'SHA-256 hash must be 64-char hex');
    assert.equal(uploadResult.avScanStatus, 'NOT_SCANNED');
    assert.equal(uploadResult.chainOfCustody.length, 1);
    assert.equal(uploadResult.chainOfCustody[0].action, 'INGEST');
    assert.equal(uploadResult.chainOfCustody[0].actorName, 'Priya Sharma');

    // Test custody chain appending
    const updatedCustody = recordCustodyEvent(uploadResult.chainOfCustody, {
      action: 'FORENSIC_EXAMINATION',
      actorId: 'OFFICER-44',
      actorName: 'Insp. Rajesh Sharma',
      actorRole: 'investigating_officer',
      notes: 'Verified against bank payment gateway timestamps.'
    });
    assert.equal(updatedCustody.length, 2);
    assert.equal(updatedCustody[1].action, 'FORENSIC_EXAMINATION');

    // Test oversized file rejection (>15MB)
    const oversizedBuffer = Buffer.alloc(16 * 1024 * 1024);
    await assert.rejects(
      async () => {
        await processProofUpload({
          fileBuffer: oversizedBuffer,
          originalFilename: 'huge_dump.pdf',
          mimeType: 'application/pdf',
          caseId: 'CR-2026-TEST1',
          uploadedById: 'USR-CITIZEN-01',
          uploadedByName: 'Priya Sharma'
        });
      },
      (err) => err.status === 413 || err.message.includes('exceeds maximum limit of 15MB')
    );

    // Test unpermitted MIME type rejection
    await assert.rejects(
      async () => {
        await processProofUpload({
          fileBuffer: Buffer.from('binary-exe-contents'),
          originalFilename: 'malware.exe',
          mimeType: 'application/x-msdownload',
          caseId: 'CR-2026-TEST1',
          uploadedById: 'USR-CITIZEN-01',
          uploadedByName: 'Priya Sharma'
        });
      },
      (err) => err.status === 415 || err.message.includes('Unsupported file type')
    );
  });

  await t.test('2.3 Structured extraction: parses UTR, INR amounts, UPI VPA, crypto wallets, and flags low confidence', async () => {
    const ocrDumpText = `
      PAYMENT RECEIPT - HDFC BANK
      Transaction Successful
      Amount: INR 1,75,000.00
      Date: 24 Oct 2026 14:32:10 IST
      UTR Number: 429819283741
      Transferred To: fastreturns.bot@paytm
      Beneficiary Contact: +91 9876543210
      Destination Wallet Address: 0x3f5ce5fbfe3e9af3971dd833d26ba9b5c936f0be
      Blockchain TxHash: 0x4a8b7c6d5e4f3a2b1c0d9e8f7a6b5c4d3e2f1a0b9c8d7e6f5a4b3c2d1e0f9a8b
    `;

    const extraction = extractComplaintParameters(ocrDumpText);
    assert.equal(extraction.extracted.utrNumber, '429819283741');
    assert.equal(extraction.extracted.amountINR, 175000);
    assert.equal(extraction.extracted.suspectUpiId, 'fastreturns.bot@paytm');
    assert.equal(extraction.extracted.suspectPhone, '+91 9876543210');
    assert.equal(extraction.extracted.suspectWallet, '0x3f5ce5fbfe3e9af3971dd833d26ba9b5c936f0be');
    assert.equal(extraction.extracted.walletChain, 'Ethereum');
    assert.equal(extraction.extracted.transactionHash, '0x4a8b7c6d5e4f3a2b1c0d9e8f7a6b5c4d3e2f1a0b9c8d7e6f5a4b3c2d1e0f9a8b');
    assert.ok(extraction.confidence >= 0.85);
    assert.equal(extraction.needsConfirmation, false);

    // Extraction endpoint via API
    const apiRes = await client.request('/reporting/extract', {
      method: 'POST',
      body: { text: ocrDumpText }
    });
    assert.equal(apiRes.response.status, 200);
    assert.equal(apiRes.data.success, true);
    assert.equal(apiRes.data.extracted.utrNumber, '429819283741');

    // Ambiguous text: missing core indicators requires citizen confirmation
    const ambiguousText = 'Hello sir someone asked me to send money yesterday on telegram';
    const lowConfidence = extractComplaintParameters(ambiguousText);
    assert.equal(lowConfidence.needsConfirmation, true, 'Low confidence extraction must require citizen confirmation');

    // Checksum validation
    assert.equal(isValidEip55Checksum('0x3f5ce5fbfe3e9af3971dd833d26ba9b5c936f0be'), true);
    assert.equal(isValidEip55Checksum('invalid-non-address'), false);
  });

  await t.test('2.4 Citizen tracking code & private communication: strict quarantine of internal notes', async () => {
    // 1. Citizen registers and submits complaint
    const regRes = await client.request('/auth/register', {
      method: 'POST',
      body: {
        email: 'citizen.tracking.victim@example.in',
        password: 'Password@2026!Strong',
        name: 'Vikas Mehra',
        role: 'reporter',
        phone: '+919876500011'
      }
    });
    const citizenToken = regRes.data.token;

    const compRes = await client.request('/complaints', {
      method: 'POST',
      headers: { authorization: `Bearer ${citizenToken}` },
      body: {
        incidentType: 'Crypto Mule Laundering',
        description: 'Transferred 2.5 lakhs through UPI to mule account which converted to USDT.',
        reportedLoss: 250000,
        currency: 'INR',
        chain: 'Ethereum',
        reportedWallet: '0x28c6c06298d514db089934071355e5743bf21d60',
        suspectUpi: 'mule_target_99@axis',
        suspectPhone: '+919811223344',
        utrNumber: '998877665544'
      }
    });

    assert.equal(compRes.response.status, 201);
    const trackingCode = compRes.data.trackingCode;
    const caseId = compRes.data.caseId;
    assert.ok(trackingCode, 'Complaint must return private tracking code');
    assert.match(trackingCode, /^TRK-[A-F0-9]{32}$/);

    // 2. Officer logs in and writes an internal note (classified police analysis)
    const officerLogin = await client.request('/auth/demo-officer', { method: 'POST' });
    const officerToken = officerLogin.data.token;

    const noteRes = await client.request(`/complaints/${caseId}/notes`, {
      method: 'POST',
      headers: { authorization: `Bearer ${officerToken}` },
      body: { note: 'CONFIDENTIAL: Suspect mule linked to syndicate in Surat. Wiretap request pending.' }
    });
    assert.equal(noteRes.response.status, 201);

    // 3. Officer requests additional evidence
    const reqEvdRes = await client.request(`/complaints/${caseId}/request-evidence`, {
      method: 'POST',
      headers: { authorization: `Bearer ${officerToken}` },
      body: { requestedItems: 'Please provide the complete 6-month bank statement PDF showing the debit entry.' }
    });
    assert.equal(reqEvdRes.response.status, 200);

    // 4. Citizen accesses public tracking endpoint with trackingCode (unauthenticated / public portal)
    const trackRes = await client.request(`/complaints/track/${trackingCode}`);
    assert.equal(trackRes.response.status, 200);
    assert.equal(trackRes.data.caseId, caseId);
    assert.equal(trackRes.data.status, 'Evidence Requested');
    assert.ok(trackRes.data.actionRequired, 'Action required message must be surfaced to citizen');

    // Verify STRICT QUARANTINE: Internal note must NEVER be exposed via tracking portal
    const updates = trackRes.data.updates;
    const hasInternalNote = updates.some(u =>
      (u.message && u.message.includes('CONFIDENTIAL: Suspect mule linked to syndicate')) ||
      u.updateType === 'INTERNAL_NOTE'
    );
    assert.equal(hasInternalNote, false, 'Confidential internal notes must be strictly quarantined from citizen tracking');

    // 5. Citizen responds to officer clarification request
    const respondRes = await client.request(`/complaints/track/${trackingCode}/respond`, {
      method: 'POST',
      body: {
        message: 'Attached the bank statement PDF. The debit occurred on 20th Oct at 11:30 AM.',
        authorName: 'Vikas Mehra'
      }
    });
    assert.equal(respondRes.response.status, 200);
    assert.equal(respondRes.data.status, 'Evidence Received');
  });

  await t.test('2.5 Duplicate & Linkage Detection: O(1) Bloom filter pre-check and multi-attribute linking', async () => {
    // Re-seed from store to pick up complaint committed in 2.4
    duplicateDetector.seedFromStore(store);

    // 1. Check duplicate detection with fresh identifier (no matches)
    const freshCheck = duplicateDetector.checkDuplicates(store, {
      utrNumber: '999999999999',
      suspectWallet: '0x000000000000000000000000000000000000dEaD',
      suspectUpiId: 'completely_unknown_merchant@paytm',
      suspectPhone: '+919999999999'
    });
    assert.equal(freshCheck.hasDuplicates, false);
    assert.equal(freshCheck.bloomHit, false);

    // 2. Check duplicate with the previously submitted complaint identifiers
    // (We previously registered wallet: 0x28c6c06298d514db089934071355e5743bf21d60, upi: mule_target_99@axis, utr: 998877665544)
    const dupCheck = duplicateDetector.checkDuplicates(store, {
      utrNumber: '998877665544',
      suspectWallet: '0x28c6c06298d514db089934071355e5743bf21d60',
      suspectUpiId: 'mule_target_99@axis'
    });

    assert.equal(dupCheck.hasDuplicates, true);
    assert.equal(dupCheck.bloomHit, true);
    assert.ok(dupCheck.linkedCaseIds.length > 0);
    assert.ok(dupCheck.reasons.length > 0);
  });

  await t.test('2.6 Public wallet auto-trace: shallow on-chain trace with strict provenance tags', async () => {
    const trace = await autoTracePublicWallet({
      seedAddress: '0x28c6c06298d514db089934071355e5743bf21d60',
      chain: 'Ethereum',
      amountINR: 500000
    });

    assert.equal(trace.success, true);
    assert.equal(trace.maxHopsExecuted, 2);
    assert.ok(trace.nodes.length >= 1, 'Reported seed remains visible even when providers return no history');

    // Strict Honesty Principle: Seed must be USER_UPLOADED; traversed hops must be REAL_PUBLIC_ONCHAIN
    const seedNode = trace.nodes.find(n => n.address.toLowerCase() === '0x28c6c06298d514db089934071355e5743bf21d60'.toLowerCase());
    assert.ok(seedNode);
    assert.equal(seedNode.provenance, 'USER_UPLOADED');
    assert.equal(seedNode.sourceConfidence, 'CITIZEN_CLAIMED');

    const intermediaryNodes = trace.nodes.filter(n => n.address.toLowerCase() !== '0x28c6c06298d514db089934071355e5743bf21d60'.toLowerCase());
    for (const node of intermediaryNodes) {
      assert.equal(node.provenance, 'REAL_PUBLIC_ONCHAIN');
      assert.equal(node.sourceConfidence, 'BLOCKCHAIN_OBSERVED');
    }

    assert.equal(trace.provenanceSummary.USER_UPLOADED, 1);
    assert.equal(trace.provenanceSummary.REAL_PUBLIC_ONCHAIN,trace.nodes.length-1);
  });
});
