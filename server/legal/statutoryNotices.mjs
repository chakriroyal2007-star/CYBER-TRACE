import { createHash, randomBytes } from 'node:crypto';

/**
 * Statutory Notices & Legal Document Requisition Generator
 *
 * Implements legal templates under current Indian criminal laws:
 * - Section 106 Bharatiya Nagarik Suraksha Sanhita, 2023 (BNSS) [formerly Section 102 Cr.P.C.]
 *   (Power of Police Officer to seize/freeze property / accounts)
 * - Section 94 Bharatiya Nagarik Suraksha Sanhita, 2023 (BNSS) [formerly Section 91 Cr.P.C.]
 *   (Summons to produce document, KYC, IP logs, or other thing)
 * - Section 63 Bharatiya Sakshya Adhiniyam, 2023 (BSA) [formerly Section 65B Indian Evidence Act]
 *   (Certificate for admissibility of electronic records)
 * - Information Technology Act, 2000 (Section 69 / 79)
 * - Prevention of Money Laundering Act, 2002 (PMLA)
 *
 * MANDATORY HONESTY PRINCIPLE:
 * All templates are explicitly marked "DRAFT FOR LEGAL REVIEW - NOT A DIRECT PLATFORM FREEZE".
 * The platform has no judicial authority to freeze funds; it prepares legally grounded requisitions
 * for authorized Investigating Officers and Magistrates.
 */

export const DISCLAIMER_BANNER = `
********************************************************************************
IMPORTANT NOTICE / STATUTORY DISCLAIMER:
DRAFT FOR LEGAL REVIEW - NOT A DIRECT PLATFORM FREEZE.
This document is a computer-generated forensic requisition prepared to assist
authorized law enforcement officers. It does not constitute a self-executing judicial
attachment order. Final issuance requires verification, signature, and dispatch by
an authorized Investigating Officer (IO) or endorsement by a competent Magistrate.
********************************************************************************
`.trim();

/**
 * Generates Section 106 BNSS 2023 (Seizure / Freeze Notice)
 */
export function generateSection106Notice({
  noticeReference = null,
  caseId,
  incidentType = 'Cyber Fraud',
  reportedLoss = 0,
  currency = 'INR',
  targetInstitution = 'Virtual Asset Service Provider / Banking Intermediary',
  accountIdentifier,
  suspectName = 'Beneficiary / Account Holder',
  officerName = 'Investigating Officer',
  officerDesignation = 'Inspector of Police',
  officerUnit = 'Cyber Crime Police Station / CBI Cyber Division',
  evidenceFiles = [],
  transactionHashes = []
}) {
  const ref = noticeReference || `NOTICE-BNSS106-${caseId || 'REF'}-${Date.now().toString().slice(-6)}`;
  const dateStr = new Date().toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'long',
    year: 'numeric'
  });

  const sealPayload = `${ref}:${caseId}:${accountIdentifier}:${reportedLoss}:${dateStr}`;
  const sha256Seal = createHash('sha256').update(sealPayload).digest('hex');

  const text = `
${DISCLAIMER_BANNER}

FORMAL STATUTORY NOTICE OF SEIZURE / ACCOUNT DEBIT FREEZE
UNDER SECTION 106 OF THE BHARATIYA NAGARIK SURAKSHA SANHITA, 2023 (BNSS)
[FORMERLY SECTION 102 OF THE CODE OF CRIMINAL PROCEDURE, 1973 (Cr.P.C.)]
READ WITH SECTION 69 / 79 OF THE INFORMATION TECHNOLOGY ACT, 2000

Notice Dispatch Reference : ${ref}
Case / Crime Number       : ${caseId || 'CR-2026-NCRP'}
Date of Notice            : ${dateStr}
Issuing Agency & Unit     : ${officerUnit}

TO:
The Nodal Officer / Grievance Officer / Legal Compliance Desk
${targetInstitution}

SUBJECT: URGENT STATUTORY ORDER FOR IMMEDIATE DEBIT FREEZE / LIEN MARKING ON SUSPECT ACCOUNT / CRYPTO WALLET UNDER SECTION 106 BNSS, 2023

1. PREAMBLE & STATUTORY AUTHORITY:
   WHEREAS, an investigation is being conducted into an offence involving financial cyber fraud,
   criminal breach of trust, and illicit electronic diversion of funds punishable under the Bharatiya
   Nyaya Sanhita, 2023 (BNS) and the Information Technology Act, 2000;

   AND WHEREAS, credible forensic evidence indicates that proceeds of crime amounting to approximately
   ${currency} ${Number(reportedLoss).toLocaleString('en-IN')} have been routed into or are presently held in the
   following account / wallet under your custodial jurisdiction:

   - Target Account / Wallet Identifier : ${accountIdentifier}
   - Purported Beneficiary Name        : ${suspectName}
   - Alleged Offence Category           : ${incidentType}

2. STATUTORY DIRECTION FOR IMMEDIATE DEBIT FREEZE:
   NOW THEREFORE, by virtue of the powers conferred upon the Investigating Officer under Section 106
   of the Bharatiya Nagarik Suraksha Sanhita, 2023 (BNSS), YOU ARE HEREBY ORDERED AND DIRECTED TO:

   (a) IMMEDIATE DEBIT FREEZE: Immediately place a total debit freeze / administrative lien on the
       above-mentioned account, cryptographic wallet, or sub-account, preventing any outward debit,
       withdrawal, token transfer, or disposal of funds pending further orders.
   (b) PRESERVE BALANCE: Safely hold the existing balance of funds/cryptocurrency to the extent of
       ${currency} ${Number(reportedLoss).toLocaleString('en-IN')}, and report the exact balance seized.
   (c) PREVENT LIQUIDATION: Prevent any conversion of cryptographic assets to fiat currency or
       transfer across private unhosted wallets.

3. REPORT OF SEIZURE TO MAGISTRATE:
   Pursuant to Section 106(3) BNSS, 2023, the seizure of this property will forthwith be reported to
   the Court of the competent Chief Judicial Magistrate / Metropolitan Magistrate having jurisdiction.

4. COMPLIANCE & LEGAL NOTICE:
   Compliance confirmation along with the exact frozen balance and institutional reference number
   must be communicated to the undersigned officer within TWENTY-FOUR (24) HOURS.
   Failure to comply with this lawful order constitutes an offence under the Bharatiya Nyaya Sanhita,
   2023, and may attract proceedings under the Information Technology Act, 2000.

________________________________________________________________________________
FORENSIC INTEGRITY & EVIDENCE ANNEXURE SEAL:
Cryptographic SHA-256 Digest : ${sha256Seal}
Associated Blockchain / UTR  : ${transactionHashes.join(', ') || 'Documented in forensic case file'}
Evidence Attachments Filed   : ${evidenceFiles.length} item(s) sealed
________________________________________________________________________________

Prepared & Recommended By:
${officerName}
${officerDesignation}
${officerUnit}

[PLACEHOLDER FOR MAGISTRATE ENDORSEMENT / JUDICIAL SEAL]
Court of the Chief Judicial Magistrate / Special Cyber Judge:
Case Number: _____________________  Endorsement Date: _____________________
Signature / Seal: ___________________________________________________________
`.trim();

  return {
    documentType: 'SECTION_106_BNSS_FREEZE_NOTICE',
    statutorySection: 'Section 106 BNSS 2023 (formerly Section 102 Cr.P.C.)',
    noticeReference: ref,
    caseId,
    targetInstitution,
    accountIdentifier,
    requestedAmount: reportedLoss,
    sha256Seal,
    generatedAt: new Date().toISOString(),
    isDraftForReview: true,
    disclaimer: 'DRAFT FOR LEGAL REVIEW - NOT A DIRECT PLATFORM FREEZE',
    text
  };
}

/**
 * Generates Section 94 BNSS 2023 (Summons to Produce Documents & Records)
 */
export function generateSection94Notice({
  noticeReference = null,
  caseId,
  targetInstitution = 'Virtual Asset Service Provider / Banking Intermediary',
  identifiers = [],
  officerName = 'Investigating Officer',
  officerDesignation = 'Inspector of Police',
  officerUnit = 'Cyber Crime Police Station / CBI Cyber Division'
}) {
  const ref = noticeReference || `SUMMONS-BNSS94-${caseId || 'REF'}-${Date.now().toString().slice(-6)}`;
  const dateStr = new Date().toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'long',
    year: 'numeric'
  });

  const sha256Seal = createHash('sha256').update(`${ref}:${caseId}:${identifiers.join(',')}:${dateStr}`).digest('hex');

  const text = `
${DISCLAIMER_BANNER}

SUMMONS TO PRODUCE DOCUMENTS / ELECTRONIC RECORDS
UNDER SECTION 94 OF THE BHARATIYA NAGARIK SURAKSHA SANHITA, 2023 (BNSS)
[FORMERLY SECTION 91 OF THE CODE OF CRIMINAL PROCEDURE, 1973 (Cr.P.C.)]
READ WITH SECTION 69 OF THE INFORMATION TECHNOLOGY ACT, 2000

Summons Reference No. : ${ref}
FIR / Case Reference  : ${caseId || 'CR-2026-NCRP'}
Date of Summons       : ${dateStr}
Issuing Authority     : ${officerUnit}

TO:
The Authorised Signatory / Head of Legal & Regulatory Compliance
${targetInstitution}

SUBJECT: STATUTORY SUMMONS FOR PRODUCTION OF SUBSCRIBER KYC, TRANSACTION HISTORIES,
AND ELECTRONIC LOGS UNDER SECTION 94 BNSS, 2023

WHEREAS, the production of certified electronic records and KYC documentation relating to the
undermentioned subject accounts/wallets is deemed necessary and desirable for the purposes of the
investigation into the above-referenced cyber crime:

SUBJECT IDENTIFIERS:
${identifiers.map((id, i) => `${i + 1}. ${id}`).join('\n') || 'Refer to Case Dossier'}

YOU ARE HEREBY REQUIRED AND DIRECTED under Section 94 BNSS, 2023 to furnish the following
requisitioned documents and electronic evidence within SEVENTY-TWO (72) HOURS:

1. CERTIFIED SUBSCRIBER KYC:
   Full registered name, physical address, verified contact phone, email address, Aadhaar/PAN/Passport
   details, and date of account opening.

2. DETAILED TRANSACTION LEDGER:
   Comprehensive statement of all incoming and outgoing fiat transfers (bank/UPI) and cryptocurrency
   deposits/withdrawals from account opening to present, including counterparty addresses and TX hashes.

3. IP ACCESS LOGS & DEVICE FINGERPRINTS:
   Source IP addresses with port numbers, timestamped connection logs, MAC addresses, and device
   identifiers for all logins and transaction authorization sessions.

4. SECTION 63 BSA ELECTRONIC EVIDENCE CERTIFICATE:
   A formal certificate signed by the authorized system custodian under Section 63 of the
   Bharatiya Sakshya Adhiniyam, 2023 (formerly Section 65B of the Indian Evidence Act, 1872)
   certifying the authenticity and unbroken custody of the electronic records produced.

Failure to attend or produce the documents requisitioned without lawful excuse may render the
intermediary and its responsible officers liable to penal consequences under the Bharatiya Nyaya
Sanhita, 2023.

________________________________________________________________________________
FORENSIC SEAL: ${sha256Seal}
________________________________________________________________________________

Issued Under the Hand and Seal of:
${officerName}
${officerDesignation}
${officerUnit}
`.trim();

  return {
    documentType: 'SECTION_94_BNSS_SUMMONS',
    statutorySection: 'Section 94 BNSS 2023 (formerly Section 91 Cr.P.C.)',
    noticeReference: ref,
    caseId,
    targetInstitution,
    identifiers,
    sha256Seal,
    generatedAt: new Date().toISOString(),
    isDraftForReview: true,
    disclaimer: 'DRAFT FOR LEGAL REVIEW - NOT A DIRECT PLATFORM FREEZE',
    text
  };
}

/**
 * Generates Section 63 BSA 2023 (formerly 65B IEA) Certificate of Electronic Evidence
 */
export function generateBsa63Certificate({
  caseId,
  officerName,
  officerDesignation,
  evidenceItems = [],
  graphHash = null
}) {
  const dateStr = new Date().toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'long',
    year: 'numeric'
  });

  const certHash = createHash('sha256').update(`${caseId}:${evidenceItems.map(e => e.sha256).join(':')}:${graphHash}`).digest('hex');

  const text = `
CERTIFICATE FOR ADMISSIBILITY OF ELECTRONIC RECORDS
UNDER SECTION 63 OF THE BHARATIYA SAKSHYA ADHINIYAM, 2023 (BSA)
[FORMERLY SECTION 65B OF THE INDIAN EVIDENCE ACT, 1872]

Case Reference: ${caseId}
Date: ${dateStr}

I, ${officerName}, ${officerDesignation}, do hereby solemnly state and affirm as follows:

1. I am in lawful command of the cyber forensic analytics workstation and electronic evidence
   repository utilized for reconstructing the money trail in Case No. ${caseId}.
2. The computer systems, server appliances, and software modules used in the production of the
   forensic graphs, blockchain ledger traces, and evidence annexures were operating properly during
   the relevant period of data acquisition and analytical inference.
3. The electronic records, transaction extracts, and SHA-256 digests set out in the annexure hereto
   were reproduced in the ordinary course of lawful official investigation from verified public
   blockchain nodes and authenticated citizen uploads without alteration or tampering.
4. Cryptographic Master Integrity Digest for Case ${caseId}:
   SHA-256: ${certHash}

Evidence Items Certified:
${evidenceItems.map((e, i) => `${i + 1}. [${e.filename}] SHA-256: ${e.sha256 || 'N/A'}`).join('\n') || 'None'}

Deponent:
${officerName}
${officerDesignation}
`.trim();

  return {
    documentType: 'SECTION_63_BSA_CERTIFICATE',
    statutorySection: 'Section 63 Bharatiya Sakshya Adhiniyam, 2023',
    caseId,
    certHash,
    generatedAt: new Date().toISOString(),
    text
  };
}

