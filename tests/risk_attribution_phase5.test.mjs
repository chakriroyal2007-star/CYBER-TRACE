import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildDataset,
  analyzeDataset,
  computeExplainableSubScores
} from '../server/analytics.mjs';
import { RiskEngine } from '../server/ml/riskEngine.mjs';

test('Phase 5: Honest Explainable Risk Engine & Attribution', async (t) => {
  const sampleCase = {
    id: 'CR-2026-00192',
    chain: 'Ethereum',
    victimLoss: 812450,
    fraudType: 'Investment Scam / Mule Network',
    reportedWallet: '0x28C6c06298d514Db089934071355E5743bf21d60'
  };

  const dataset = buildDataset(sampleCase);
  const analysis = analyzeDataset(sampleCase, dataset);

  await t.test('5.1 Decompose risk into 4 independent, explainable sub-scores', () => {
    const { subScores } = analysis;
    assert.ok(subScores, 'Analysis must include subScores breakdown');

    // 1. Check all 4 sub-scores exist
    assert.ok(subScores.onChain, 'subScores.onChain must exist');
    assert.ok(subScores.mule, 'subScores.mule must exist');
    assert.ok(subScores.victim, 'subScores.victim must exist');
    assert.ok(subScores.behavioral, 'subScores.behavioral must exist');

    // 2. Check weights sum to 100
    const totalWeight = subScores.onChain.weight + subScores.mule.weight + subScores.victim.weight + subScores.behavioral.weight;
    assert.equal(totalWeight, 100, 'Sub-score weights must sum exactly to 100%');
    assert.equal(subScores.onChain.weight, 35, 'On-chain weight must be 35%');
    assert.equal(subScores.mule.weight, 30, 'Mule weight must be 30%');
    assert.equal(subScores.victim.weight, 15, 'Victim weight must be 15%');
    assert.equal(subScores.behavioral.weight, 20, 'Behavioral weight must be 20%');

    // 3. Check score ranges and factors
    for (const key of ['onChain', 'mule', 'victim', 'behavioral']) {
      const sub = subScores[key];
      assert.ok(sub.score >= 0 && sub.score <= 100, `${key} score must be within [0, 100]`);
      assert.ok(Array.isArray(sub.factors), `${key}.factors must be an array`);
      assert.ok(sub.factors.length > 0, `${key}.factors must contain explainable evidence items`);
      assert.ok(['LOW', 'MODERATE', 'ELEVATED', 'HIGH', 'CRITICAL', 'NORMAL', 'SUSPICIOUS', 'ANOMALOUS'].includes(sub.status), `Invalid status ${sub.status} on ${key}`);
    }

    // 4. Check composite score and calibration
    assert.ok(subScores.composite >= 0 && subScores.composite <= 100);
    assert.ok(subScores.calibration, 'Calibration object must exist');
    assert.ok(subScores.calibration.calibratedProbability >= 0 && subScores.calibration.calibratedProbability <= 1);
    assert.ok(Array.isArray(subScores.calibration.confidenceInterval));
    assert.equal(subScores.calibration.confidenceInterval.length, 2);
    assert.ok(subScores.calibration.confidenceInterval[0] <= subScores.calibration.confidenceInterval[1]);
  });

  await t.test('5.2 Enforce attribution evidence requirements (at least 2 independent factors)', () => {
    // 1. Flagship hybrid case with multiple corroborating factors
    assert.ok(analysis.attributions.length > 0, 'Flagship case has candidate attributions');
    const primaryAttr = analysis.attributions[0];

    assert.ok(primaryAttr.independentFactors.length >= 2, 'Flagship case must have at least 2 independent factors');
    assert.equal(primaryAttr.attributionStatus, 'CORROBORATED_ATTRIBUTION');
    assert.match(primaryAttr.caveat, /Probabilistic investigative lead/i);

    // 2. Synthesize an uncorroborated single-factor case to test negative path
    const sparseDataset = {
      nodes: [
        { id: 'W-01', type: 'victim', address: '0x1111', chain: 'Ethereum', balance: 0 },
        { id: 'W-02', type: 'vasp', address: '0x9999', chain: 'Ethereum', entity: 'Unknown Desk', balance: 1000 }
      ],
      edges: [
        { id: 'TX-01', source: 'W-01', target: 'W-02', amount: 1000, timestamp: '2026-09-23T14:20:00.000Z' }
      ],
      crossChain: []
    };
    const sparseCase = { id: 'CR-SPARSE', victimLoss: 1000, chain: 'Ethereum', fraudType: 'Direct Transfer' };
    const sparseAnalysis = analyzeDataset(sparseCase, sparseDataset);

    assert.ok(sparseAnalysis.attributions.length > 0);
    const sparseAttr = sparseAnalysis.attributions[0];
    assert.ok(sparseAttr.factorCount < 2, 'Sparse case must have fewer than 2 independent factors');
    assert.equal(sparseAttr.attributionStatus, 'INSUFFICIENT_ATTRIBUTION_EVIDENCE');
    assert.match(sparseAttr.caveat, /Inconclusive attribution/i);
  });

  await t.test('5.3 Calibrated ML inference in RiskEngine with SHAP-style explainability', () => {
    // Create mock GraphEngine for unit testing RiskEngine
    const mockGraphEngine = {
      getNode: (id) => ({
        id,
        probability: 0.88,
        riskScore: 88,
        predictedClass: 'illicit',
        label: 'illicit',
        timeStep: 34
      }),
      getTransactionFeatures: (id) => ({
        timeStep: 34,
        featureCount: 166,
        localFeatures: [0.0002, 1.45, 2, 2, 0, 0]
      }),
      getNeighbors: (id) => ['tx-out-1', 'tx-out-2'],
      getIncomingNeighbors: (id) => ['tx-in-1']
    };

    const riskEngine = new RiskEngine(mockGraphEngine);
    const report = riskEngine.evaluateTransaction('tx-target-01');

    assert.equal(report.found, true);
    assert.equal(report.riskCategory, 'UNAVAILABLE');
    assert.equal(report.riskScore,null); // The mock ID is not in a trained dataset.
    assert.equal(report.calibratedProbability,null);
    assert.equal(report.confidenceInterval,null);

    // Check topContributingFeatures
    assert.ok(Array.isArray(report.topContributingFeatures));
    assert.equal(report.topContributingFeatures.length, 3, 'Must return top 3 contributing factors');
    for (const feat of report.topContributingFeatures) {
      assert.ok(feat.feature, 'Feature must have an id');
      assert.ok(feat.weight > 0, 'Feature must have positive weight');
      assert.ok(Number.isFinite(feat.contribution), 'Feature must have numerical contribution');
    }

    assert.match(report.explanation, /No fitted probability calibration/i);
  });
});

