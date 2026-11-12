import assert from 'node:assert/strict';
import { test } from 'node:test';
import { AddressInterner, MinHeap, UnionFind, ForensicTracer } from '../server/tracing/tracer.mjs';
import { BloomFilter, LabelStore } from '../server/tracing/labelStore.mjs';
import { OpenRouterRiskEngine } from '../server/ml/openrouterRiskEngine.mjs';
import { server } from '../server/index.mjs';

const PORT = 8003;
const BASE = `http://127.0.0.1:${PORT}`;

test('Real Tracing Engine, Bloom Filter, DSA & OpenRouter AI Evaluation', async (t) => {
  let appServer;

  await t.test('Start test server on port 8003', async () => {
    await new Promise((resolve) => {
      appServer = server.listen(PORT, '127.0.0.1', () => resolve());
    });
  });

  t.after(() => {
    if (appServer) appServer.close();
  });

  await t.test('AddressInterner correctly assigns 32-bit integer IDs and maps back', () => {
    const interner = new AddressInterner();
    const id1 = interner.intern('0x28c6c06298d514db089934071355e5743bf21d60');
    const id2 = interner.intern('0x28C6C06298D514DB089934071355E5743BF21D60'); // Case insensitive
    const id3 = interner.intern('1NdNk9q3k24Awb5G2E2h6Vw8E3W1N7e4K');

    assert.equal(id1, id2, 'Same address with different casing returns identical intern ID');
    assert.equal(id1, 0, 'First interned address gets index 0');
    assert.equal(id3, 1, 'Second distinct address gets index 1');
    assert.equal(interner.resolve(0), '0x28c6c06298d514db089934071355e5743bf21d60');
    assert.equal(interner.size(), 2);
  });

  await t.test('Bloom Filter has zero false negatives for known exchange addresses', () => {
    const bloom = new BloomFilter(16384);
    const binanceHot = '0x28C6c06298d514Db089934071355E5743bf21d60';
    const wazirxCold = '0xd841ca39c05877f8084a44b360b93bf81cb8d67b';
    const unknownWallet = '0x1234567890abcdef1234567890abcdef12345678';

    bloom.add(binanceHot);
    bloom.add(wazirxCold);

    assert.equal(bloom.mightContain(binanceHot), true, 'Binance address matches');
    assert.equal(bloom.mightContain(wazirxCold), true, 'WazirX address matches');
    assert.equal(bloom.mightContain(unknownWallet), false, 'Unknown wallet correctly rejected');
  });

  await t.test('LabelStore identifies real public exchange deposits and mixers', () => {
    const store = new LabelStore();
    const binance = store.lookup('0x28C6c06298d514Db089934071355E5743bf21d60');
    assert.ok(binance !== null, 'Binance hot wallet found');
    assert.equal(binance.entity, 'Binance');
    assert.equal(binance.type, 'vasp');

    const tornado = store.lookup('0xd90e2f925DA726b50C4Ed8D0Fb90Ad053324F31b');
    assert.ok(tornado !== null, 'Tornado cash pool found');
    assert.equal(tornado.type, 'mixer');

    const unknown = store.lookup('0x9999999999999999999999999999999999999999');
    assert.equal(unknown, null, 'Unknown address returns null');
  });

  await t.test('MinHeap maintains strict minimum order for taint-cost traversal', () => {
    const heap = new MinHeap();
    heap.push({ addrId: 1, cost: 15 });
    heap.push({ addrId: 2, cost: 3 });
    heap.push({ addrId: 3, cost: 8 });

    assert.equal(heap.pop().cost, 3, 'Smallest cost popped first');
    assert.equal(heap.pop().cost, 8, 'Second smallest popped');
    assert.equal(heap.pop().cost, 15, 'Largest popped last');
    assert.equal(heap.isEmpty(), true);
  });

  await t.test('UnionFind performs path compression and rank-based union', () => {
    const uf = new UnionFind(10);
    assert.equal(uf.find(1), 1);

    uf.union(1, 2);
    uf.union(2, 3);
    assert.equal(uf.find(1), uf.find(3), 'Transitive elements share same root cluster');

    uf.union(4, 5);
    assert.notEqual(uf.find(1), uf.find(4), 'Independent clusters remain separate');
  });

  await t.test('ForensicTracer executes dynamic multi-hop trace without static fixtures', async () => {
    const tracer = new ForensicTracer();
    const result = await tracer.trace('0xba244a0C2c2f62F93C40866A4eec1A7E1544321A', 500000);

    assert.ok(result.nodes.length >= 3, 'Discovers multiple forward hops');
    assert.ok(result.edges.length >= 2, 'Builds forward transaction edges');
    assert.ok(result.internedCount >= 3, 'Interns discovered addresses');
    assert.ok(result.vaspCandidate, 'Attributed candidate VASP exit');
    assert.ok(result.clustersCount >= 1, 'Computes DSU clusters');
  });

  await t.test('OpenRouterRiskEngine evaluates case with AI and generates officer action plan', async () => {
    const engine = new OpenRouterRiskEngine();
    const result = await engine.evaluateCase({
      id: 'TEST-CASE-001',
      reportedLoss: 750000,
      incidentType: 'Investment Scam',
      chain: 'TRON',
      reportedWallet: 'TMuA6YqfCeX8EhbfYEg5y7S4Dqz9Dw9vVu',
      description: 'Victim deceived into transferring 7,50,000 INR into fake crypto mining contract.'
    }, {
      graphNodesCount: 5,
      hops: 3,
      vaspCandidate: 'Binance TRC20 Hot Wallet'
    });

    assert.ok(result.riskScore >= 0 && result.riskScore <= 100, 'Valid risk score range');
    assert.ok(result.readinessScore.overall >= 0, 'Investigation readiness overall score generated');
    assert.ok(result.readinessScore.breakdown.topologyDepth !== undefined, 'Readiness breakdown present');
    assert.ok(Array.isArray(result.cbiOfficerFollowUps), 'Officer follow-up action plan generated');
    assert.ok(result.cbiOfficerFollowUps.length >= 1, 'At least 1 follow-up action step');
    assert.ok(result.cbiOfficerFollowUps[0].legalBasis, 'Legal basis provided for action');
  });

  await t.test('Multi-Role Authentication: Supervisor and Admin endpoints succeed', async () => {
    const supRes = await fetch(`${BASE}/api/auth/demo-supervisor`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: '{}'
    });
    assert.equal(supRes.status, 200);
    const supData = await supRes.json();
    assert.equal(supData.user.role, 'supervisor');
    assert.equal(supData.mode, 'SUPERVISORY OVERSIGHT PORTAL');

    const admRes = await fetch(`${BASE}/api/auth/demo-admin`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: '{}'
    });
    assert.equal(admRes.status, 200);
    const admData = await admRes.json();
    assert.equal(admData.user.role, 'admin');
    assert.equal(admData.mode, 'EXECUTIVE INTELLIGENCE ADMIN');
  });
});
