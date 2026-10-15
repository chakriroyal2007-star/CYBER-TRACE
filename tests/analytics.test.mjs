import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { DEFAULT_WEIGHTS, analyzeDataset, buildDataset, correlateCases, shortestPath } from '../server/analytics.mjs';

const complaint = overrides => ({
  id: 'CR-2026-00192', reportedWallet: `0x${'a'.repeat(40)}`, victimLoss: 812450,
  chain: 'Ethereum', fraudType: 'Investment Scam', ...overrides,
});
const investigation = record => {
  const dataset = buildDataset(record);
  return { case: record, ...dataset, ...analyzeDataset(record, dataset) };
};

describe('Deterministic analytical engine', () => {
  it('preserves funds at every wallet and across the synthetic bridge', () => {
    for (const record of [complaint(), complaint({ id: 'SCALE-1', victimLoss: 321987.45 }), complaint({ id: 'TRON-1', chain: 'TRON' })]) {
      const dataset = buildDataset(record);
      assert.deepEqual(dataset, buildDataset(record), 'Identical inputs produce an identical synthetic trace');
      let terminalTotal = 0;
      for (const node of dataset.nodes) {
        const incoming = dataset.edges.filter(edge => edge.target === node.id).reduce((sum, edge) => sum + edge.amount, 0);
        const outgoing = dataset.edges.filter(edge => edge.source === node.id).reduce((sum, edge) => sum + edge.amount, 0);
        const opening = node.type === 'victim' ? record.victimLoss : 0;
        assert.ok(node.balance >= -0.001, `${node.id} has no fabricated negative funds`);
        assert.ok(Math.abs(opening + incoming - outgoing - node.balance) < 0.011, `${node.id} conserves funds to a paisa`);
        terminalTotal += node.balance;
      }
      assert.ok(Math.abs(terminalTotal - record.victimLoss) < 0.02, 'Funds remaining throughout the network equal the single victim input');
      for (const transfer of dataset.crossChain) {
        const matches = dataset.edges.filter(edge => edge.hash === transfer.transactionHash);
        assert.equal(matches.length, 1, 'A bridge transfer is counted once in the flow network');
        assert.equal(matches[0].amount, transfer.amount);
      }
    }
  });

  it('computes the confidence from documented weighted evidence and rejects invalid weights', () => {
    const record = complaint();
    const dataset = buildDataset(record);
    const analysis = analyzeDataset(record, dataset);
    const evidence = analysis.attributions[0].evidence;
    assert.equal(evidence.reduce((sum, item) => sum + item.weight, 0), 100);
    assert.equal(Math.round(evidence.reduce((sum, item) => sum + item.weight * item.score / 100, 0)), 91);
    assert.equal(analysis.confidence, 91);
    const externalOnly = { cluster: 0, pattern: 0, deposit: 0, temporal: 0, crossChain: 0, historical: 0, external: 100 };
    assert.equal(analyzeDataset(record, dataset, externalOnly).confidence, evidence.find(item => item.id === 'EV-external').score);
    assert.throws(() => analyzeDataset(record, dataset, { ...DEFAULT_WEIGHTS, cluster: -25 }), /weights/i);
    assert.throws(() => analyzeDataset(record, dataset, { ...DEFAULT_WEIGHTS, external: 6 }), /sum/i);
  });

  it('changes risk and attribution when transaction timing changes', () => {
    const record = complaint();
    const rapid = buildDataset(record);
    const slow = structuredClone(rapid);
    slow.edges.forEach((edge, index) => { edge.timestamp = new Date(Date.UTC(2026, 8, 20) + index * 2 * 3600000).toISOString(); });
    const original = analyzeDataset(record, rapid);
    const delayed = analyzeDataset(record, slow);
    assert.ok(delayed.fingerprint.features.averageHoldingTime > 60);
    assert.ok(delayed.riskScore < original.riskScore, 'Long holding periods remove the rapid-forwarding risk contribution');
    assert.ok(delayed.confidence < original.confidence, 'Temporal attribution responds to observed evidence');
    assert.ok(!delayed.riskIndicators.some(item => item.id === 'EV-risk-velocity'));
    assert.equal(delayed.tracedAmount, original.tracedAmount, 'Timing changes preserve terminal value');
  });

  it('never claims a VASP exit or deanonymization beyond the privacy-exposure fixture', () => {
    const record = complaint({ id: 'PRIVACY-1', fraudType: 'Ransomware', chain: 'Bitcoin' });
    const result = investigation(record);
    assert.ok(result.nodes.some(node => node.type === 'mixer'));
    assert.equal(result.attributions.length, 0);
    assert.equal(result.confidence, 0);
    assert.equal(result.vaspCandidate, null);
    assert.ok(result.riskIndicators.some(item => item.id === 'EV-risk-privacy'));
    assert.ok(result.recommendations.some(text => /confidence|unknown/i.test(text)));
  });

  it('finds a directed shortest path and does not loop on cyclic data', () => {
    const dataset = buildDataset(complaint());
    const source = dataset.nodes.find(node => node.type === 'victim').id;
    const target = dataset.nodes.find(node => node.type === 'vasp').id;
    const path = shortestPath(dataset, source, target);
    assert.equal(path[0], source);
    assert.equal(path.at(-1), target);
    assert.equal(path.length, 9);
    for (let i = 1; i < path.length; i++) assert.ok(dataset.edges.some(edge => edge.source === path[i - 1] && edge.target === path[i]));
    assert.deepEqual(shortestPath({ edges: [{ source: 'A', target: 'B' }, { source: 'B', target: 'A' }] }, 'A', 'C'), []);
  });

  it('correlates observed shared cluster evidence and ignores a VASP match alone', () => {
    const main = investigation(complaint());
    const related = investigation(complaint({ id: 'CR-2026-00193' }));
    const unrelated = investigation(complaint({ id: 'UNRELATED-1' }));
    const matches = correlateCases(main.case, [main, related, unrelated]);
    assert.equal(matches.length, 1);
    assert.equal(matches[0].caseId, related.case.id);
    assert.equal(matches[0].sharedCluster, 'C-14');
    assert.ok(matches[0].sharedWallet);
    assert.deepEqual(correlateCases(main.case, [main, unrelated]), []);
  });

  it('keeps all evidence and knowledge-graph relationships referentially valid', () => {
    for (const record of [complaint(), complaint({ id: 'PRIVACY-1', fraudType: 'Ransomware', chain: 'Bitcoin' })]) {
      const result = investigation(record);
      const walletIds = new Set(result.nodes.map(node => node.id));
      const transactionIds = new Set(result.edges.map(edge => edge.id));
      const evidence = [...result.riskIndicators, ...result.attributions.flatMap(item => item.evidence)];
      const evidenceIds = new Set(evidence.map(item => item.id));
      for (const item of evidence) {
        assert.ok(item.walletIds.every(id => walletIds.has(id)));
        assert.ok(item.transactionIds.every(id => transactionIds.has(id)));
      }
      for (const pattern of result.fingerprint.patterns) assert.ok(pattern.evidenceIds.every(id => evidenceIds.has(id)));
      const knowledgeIds = new Set(result.knowledgeGraph.nodes.map(node => node.id));
      assert.equal(knowledgeIds.size, result.knowledgeGraph.nodes.length);
      assert.ok(result.knowledgeGraph.edges.every(edge => knowledgeIds.has(edge.source) && knowledgeIds.has(edge.target)));
    }
  });
});
