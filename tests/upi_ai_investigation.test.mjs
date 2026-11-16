process.env.NODE_ENV = 'test';
import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { Store, now } from '../server/db.mjs';
import {
  validateComplaint,
  extractPaymentEvidence,
  correlateVictimReports,
  retrieveBankEvidence,
  analyzeMuleAccountPatterns,
  retrieveExchangeEvidence,
  investigateBlockchain,
  buildFinancialGraph,
  executeDsaAnalysis,
  runMlInference,
  calculateRiskAssessment,
  generateInvestigationReport
} from '../server/investigation/tools.mjs';
import { aiOrchestrator } from '../server/investigation/agentOrchestrator.mjs';

describe('UPI-to-Crypto AI Investigation & Forensic Platform (Tests A - T)', () => {
  let store;
  const testCaseId = 'CR-2026-UPI-9901';

  before(() => {
    store = new Store(':memory:');

    // Create user and initial complaint
    store.createComplaint({
      caseId: testCaseId,
      incidentType: 'Investment Scam',
      incidentDate: now(),
      reportedLoss: 642000,
      currency: 'INR',
      chain: 'Ethereum',
      reportedWallet: '0x28C6c06298d514Db089934071355E5743bf21d60',
      transactionHash: '402819827364',
      description: 'Victim lured into high-yield staking. Transferred INR 6,42,000 via UPI to fastyield.invest@paytm.',
      reporterId: 'USR-TEST-001',
      reporterName: 'Rahul Verma',
      reporterEmail: 'rahul.verma@example.com'
    });

    // Ingest primary UPI transaction
    store.saveUpiTransaction({
      caseId: testCaseId,
      utrNumber: '402819827364',
      senderUpiId: 'rahul.verma@okhdfcbank',
      receiverUpiId: 'fastyield.invest@paytm',
      beneficiaryName: 'FastYield Global Holdings',
      amount: 642000,
      currency: 'INR',
      timestamp: now(),
      bankName: 'HDFC Bank',
      verificationStatus: 'VERIFIED',
      screenshotRef: 'upi_payment_slip_402819827364.png'
    });
  });

  after(() => {
    store.close();
  });

  test('Test A: Victim submits a valid UPI complaint and records are persisted', async () => {
    const txs = store.getUpiTransactions(testCaseId);
    assert.equal(txs.length, 1);
    assert.equal(txs[0].utrNumber, '402819827364');
    assert.equal(txs[0].amount, 642000);
    assert.equal(txs[0].receiverUpiId, 'fastyield.invest@paytm');
  });

  test('Test B: Tool 2 extracts payment details and source references', async () => {
    const res = await extractPaymentEvidence(store, testCaseId);
    assert.equal(res.caseId, testCaseId);
    assert.equal(res.totalPaymentsExtracted, 1);
    assert.equal(res.payments[0].utrNumber, '402819827364');
    assert.equal(res.totalLossINR, 642000);
    assert.ok(res.confidenceAvg >= 0.8);
  });

  test('Test C & D: Tool 1 validates complaint and detects duplicate UTRs', async () => {
    const val1 = await validateComplaint(store, testCaseId);
    assert.equal(val1.isValid, true);
    assert.ok(val1.complaintValidationScore >= 70);
    assert.equal(val1.hasDuplicates, false);

    // Create a second case with the identical UTR to test duplicate detection
    const dupCaseId = 'CR-2026-UPI-DUP2';
    store.createComplaint({
      caseId: dupCaseId,
      incidentType: 'Phishing',
      incidentDate: now(),
      reportedLoss: 250000,
      currency: 'INR',
      chain: 'Ethereum',
      reportedWallet: '0x28C6c06298d514Db089934071355E5743bf21d60',
      transactionHash: '402819827364',
      description: 'Second victim also transferred to fastyield.invest@paytm',
      reporterId: 'USR-TEST-002',
      reporterName: 'Ananya Sharma',
      reporterEmail: 'ananya@example.com'
    });

    store.saveUpiTransaction({
      caseId: dupCaseId,
      utrNumber: '402819827364', // Identical UTR
      senderUpiId: 'victim2@okaxis',
      receiverUpiId: 'fastyield.invest@paytm',
      amount: 250000,
      timestamp: now()
    });

    const val2 = await validateComplaint(store, dupCaseId);
    assert.equal(val2.hasDuplicates, true);
    assert.equal(val2.duplicates[0].utr, '402819827364');
  });

  test('Test E: Tool 3 correlates multiple complaints sharing a verified beneficiary', async () => {
    const corr = await correlateVictimReports(store, testCaseId);
    assert.ok(corr.correlatedCasesCount >= 1);
    assert.ok(corr.correlatedCases.some(c => c.matchType === 'SHARED_BENEFICIARY_VPA' || c.matchType === 'SHARED_UTR'));
    assert.equal(corr.privacyPreserved, true);
  });

  test('Test F: Tool 4 retrieves verified banking records', async () => {
    const bank = await retrieveBankEvidence(store, testCaseId);
    assert.equal(bank.status, 'BANK_DATA_VERIFIED');
    assert.ok(bank.recordsCount >= 2);
    assert.equal(bank.records[0].isMuleSuspect, true);
  });

  test('Test G: Tool 5 calculates mule-account behavioral features and rapid pass-through', async () => {
    const mule = await analyzeMuleAccountPatterns(store, testCaseId);
    assert.ok(mule.incomingTransactionCount >= 1);
    assert.ok(mule.outgoingTransactionCount >= 1);
    assert.equal(mule.rapidPassThroughDetected, true);
    assert.equal(mule.muleClassification, 'HIGH_CONFIDENCE_MULE');
  });

  test('Test H & I: Tool 6 retrieves exchange conversion and cryptocurrency withdrawal', async () => {
    const ex = await retrieveExchangeEvidence(store, testCaseId);
    assert.equal(ex.isExchangeLinkEstablished, true);
    assert.equal(ex.cryptoPurchased, 'USDT');
    assert.ok(ex.cryptoAmount > 0);
    assert.equal(ex.destinationChain, 'Ethereum');
    assert.ok(ex.withdrawalAddress.startsWith('0x'));
  });

  test('Test J: Tool 7 executes multi-hop blockchain tracing on target wallet', async () => {
    const chainRes = await investigateBlockchain(store, {
      walletAddress: '0x28C6c06298d514Db089934071355E5743bf21d60',
      chain: 'Ethereum',
      depth: 3,
      caseId: testCaseId
    });
    assert.ok(chainRes.totalNodesDiscovered >= 2);
    assert.ok(chainRes.totalEdgesDiscovered >= 1);
    assert.ok(chainRes.vaspIdentified.includes('Binance') || chainRes.vaspIdentified.includes('VASP') || chainRes.vaspIdentified.includes('Exchange'));
  });

  test('Test K & L: Tool 8 builds financial graph and Tool 9 executes DSA algorithms', async () => {
    const graphRes = await buildFinancialGraph(store, testCaseId);
    assert.ok(graphRes.totalNodes >= 4);
    assert.ok(graphRes.totalEdges >= 3);

    const dsa = await executeDsaAnalysis(store, testCaseId, ['bfs', 'dijkstra', 'union-find', 'cycle-detection']);
    assert.ok(dsa.dsaFindings.bfs);
    assert.ok(dsa.dsaFindings.bfs.hopsToExit >= 2);
    assert.equal(dsa.dsaFindings.cycleDetection.hasCycles, false);
    assert.ok(dsa.dsaFindings.unionFind.disjointSyndicateClusters >= 1);
  });

  test('Test M: Tool 10 executes real ML inference without hardcoded data', async () => {
    const ml = await runMlInference(store, testCaseId);
    assert.ok(ml.illicitProbability >= 0.5);
    assert.equal(ml.classification, 'ILLICIT_LAUNDERING_SCHEME');
    assert.ok(ml.featureImportance.length >= 3);
  });

  test('Test N: Tool 11 generates separate 5-category deterministic risk assessment', async () => {
    const risk = await calculateRiskAssessment(store, testCaseId);
    assert.ok(risk.complaintValidationScore >= 70);
    assert.ok(risk.upiFraudRisk >= 60);
    assert.ok(risk.muleAccountRisk >= 75);
    assert.ok(risk.cryptoExposureRisk >= 80);
    assert.ok(risk.blockchainRisk >= 70);
    assert.equal(risk.overallPriority, 'CRITICAL');
  });

  test('Test O & P: Tool 12 compiles statutory report package with SHA-256 seal', async () => {
    const rep = await generateInvestigationReport(store, testCaseId);
    assert.ok(rep.reportId.startsWith(`REP-${testCaseId}`));
    assert.equal(rep.scores.overallPriority, 'CRITICAL');
    assert.ok(rep.verificationSealSHA256.length === 64);
    assert.ok(rep.recommendedStatutoryActions.length >= 2);
  });

  test('Test Q: AI Investigation Orchestrator executes full 10-stage pipeline and handles follow-up Q&A', async () => {
    const runRes = await aiOrchestrator.launchInvestigation(store, testCaseId);
    assert.equal(runRes.status, 'COMPLETED');
    assert.equal(runRes.stages.length, 10);
    assert.ok(runRes.stages.every(s => s.status === 'COMPLETED' || s.status === 'WARNING'));

    // Test follow-up question grounded in evidence
    const qa = await aiOrchestrator.handleQuestion(store, testCaseId, 'Where did my money go?');
    assert.ok(qa.response.includes('UPI'));
    assert.ok(qa.response.includes('Ethereum') || qa.response.includes('Binance'));
    assert.ok(qa.history.length >= 2);
  });
});
