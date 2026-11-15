import test from 'node:test';
import assert from 'node:assert/strict';
import {
  generateSection106Notice,
  generateSection94Notice,
  generateBsa63Certificate,
  computeMasterCourtPackageSeal,
  verifyCourtPackage
} from '../server/legal/statutoryNotices.mjs';

test('Phase 8: Court Packages, Statutory Reports & Cryptographic Hash Seals', async (t) => {
  const caseId = 'CR-2026-00192';

  await t.test('8.1 Section 106 BNSS 2023 Seizure & Debit Freeze Notice', () => {
    const notice = generateSection106Notice({
      caseId,
      incidentType: 'UPI-to-Crypto Mule Laundering',
      reportedLoss: 812450,
      accountIdentifier: '0x28C6c06298d514Db089934071355E5743bf21d60',
      officerName: 'Insp. Rajesh Sharma',
      officerUnit: 'CBI Cyber Crime Division'
    });

    assert.equal(notice.documentType, 'SECTION_106_BNSS_FREEZE_NOTICE');
    assert.match(notice.statutorySection, /Section 106 BNSS 2023/);
    assert.ok(notice.sha256Seal, 'Must compute SHA-256 seal');
    assert.match(notice.text, /SECTION 106 OF THE BHARATIYA NAGARIK SURAKSHA SANHITA, 2023/);
    assert.match(notice.text, /DRAFT FOR LEGAL REVIEW - NOT A DIRECT PLATFORM FREEZE/);
    assert.equal(notice.isDraftForReview, true);
  });

  await t.test('8.2 Section 94 BNSS 2023 Summons to Produce Documents & Records', () => {
    const summons = generateSection94Notice({
      caseId,
      targetInstitution: 'WazirX / Binance Compliance Gateway',
      identifiers: ['0x28C6c06298d514Db089934071355E5743bf21d60', 'mule1@hdfcbank'],
      officerName: 'Insp. Rajesh Sharma'
    });

    assert.equal(summons.documentType, 'SECTION_94_BNSS_SUMMONS');
    assert.match(summons.statutorySection, /Section 94 BNSS 2023/);
    assert.match(summons.text, /SUBSCRIBER KYC/);
    assert.match(summons.text, /IP ACCESS LOGS & DEVICE FINGERPRINTS/);
    assert.ok(summons.sha256Seal);
  });

  await t.test('8.3 Section 63 BSA 2023 Certificate of Electronic Evidence', () => {
    const evidenceItems = [
      { filename: 'bank_statement.pdf', sha256: 'a1b2c3d4e5f607182930415263748596a1b2c3d4e5f607182930415263748596' },
      { filename: 'screenshot_upi.png', sha256: 'f6e5d4c3b2a109876543210fedcba987f6e5d4c3b2a109876543210fedcba987' }
    ];

    const cert = generateBsa63Certificate({
      caseId,
      officerName: 'Insp. Rajesh Sharma',
      officerDesignation: 'Inspector of Police (CBI Cyber Crime)',
      evidenceItems,
      graphHash: '0x6e9f456860d5b1be2c24efca92837f485db56fbf30cf5634ca3b5c6e7368d447'
    });

    assert.equal(cert.documentType, 'SECTION_63_BSA_CERTIFICATE');
    assert.match(cert.statutorySection, /Section 63 Bharatiya Sakshya Adhiniyam/);
    assert.ok(cert.certHash);
    assert.match(cert.text, /CERTIFICATE FOR ADMISSIBILITY OF ELECTRONIC RECORDS/);
    assert.match(cert.text, /operating properly during[\s\S]*the relevant period/);
  });

  await t.test('8.4 Master Court Package Hash Seal & Tamper Verification', () => {
    const sec106 = generateSection106Notice({ caseId, reportedLoss: 812450 });
    const sec94 = generateSection94Notice({ caseId });
    const bsa63 = generateBsa63Certificate({ caseId, officerName: 'Insp. Rajesh Sharma', officerDesignation: 'Inspector' });

    const courtPackage = {
      caseId,
      packageReference: `CRT-PKG-${caseId}-TEST01`,
      compiledAt: '2026-11-15T18:00:00.000Z',
      compiledBy: 'Insp. Rajesh Sharma',
      documents: {
        section106Notice: sec106,
        section94Summons: sec94,
        section63BsaCertificate: bsa63
      },
      disclaimer: 'DRAFT FOR LEGAL REVIEW - NOT A DIRECT PLATFORM FREEZE'
    };

    // Compute master seal
    const masterSeal = computeMasterCourtPackageSeal(courtPackage);
    courtPackage.masterPackageSha256 = masterSeal;
    courtPackage.sealStatus = 'CRYPTOGRAPHICALLY_VERIFIED';

    // 1. Valid package verification
    const verification = verifyCourtPackage(courtPackage);
    assert.equal(verification.verified, true, 'Original package must be cryptographically verified');
    assert.equal(verification.tampered, false);
    assert.equal(verification.sealAlgorithm, 'SHA-256');

    // 2. Tampered package verification (modify loss amount)
    const tamperedPackage = structuredClone(courtPackage);
    tamperedPackage.documents.section106Notice.reportedLoss = 99999999;
    const tamperedVerification = verifyCourtPackage(tamperedPackage);
    assert.equal(tamperedVerification.verified, false, 'Tampered package must fail cryptographic verification');
    assert.equal(tamperedVerification.tampered, true);
    assert.notEqual(tamperedVerification.expectedHash, tamperedVerification.actualHash);
  });
});
