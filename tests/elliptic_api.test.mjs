import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { launchServer, client } from './helpers.mjs';

describe('Elliptic Dataset & Analytics API Integration', { concurrency: false }, () => {
  let server;
  let investigator;

  before(async () => {
    server = await launchServer();
    investigator = client(server.baseUrl);
    const authRes = await investigator.login();
    assert.equal(authRes.response.status, 200);
  });

  after(async () => {
    await server?.close();
  });

  it('serves dataset statistics from actual Elliptic dataset', async () => {
    const res = await investigator.request('/dataset/stats');
    assert.equal(res.response.status, 200);
    assert.equal(res.data.totalNodes, 203769);
    assert.equal(res.data.totalEdges, 234355);
    assert.equal(res.data.classes.illicit, 4545);
    assert.equal(res.data.classes.licit, 42019);
    assert.equal(res.data.classes.unknown, 157205);
  });

  it('looks up transaction and returns calibrated score and evidence', async () => {
    // Illicit transaction
    const illicitRes = await investigator.request('/transactions/232629023');
    assert.equal(illicitRes.response.status, 200);
    assert.equal(illicitRes.data.txId, '232629023');
    assert.equal(illicitRes.data.knownLabel, 'illicit');
    assert.equal(illicitRes.data.riskCategory, 'HIGH RISK');
    assert.ok(illicitRes.data.riskScore >= 70);
    assert.equal(illicitRes.data.dataSource, 'Elliptic Research Dataset');

    // Licit transaction
    const licitRes = await investigator.request('/transactions/232438397');
    assert.equal(licitRes.response.status, 200);
    assert.equal(licitRes.data.knownLabel, 'licit');
    assert.equal(licitRes.data.riskCategory, 'LOW RISK');

    // Unknown transaction
    const unknownRes = await investigator.request('/transactions/230425980');
    assert.equal(unknownRes.response.status, 200);
    assert.equal(unknownRes.data.knownLabel, 'unknown');
    assert.ok(unknownRes.data.evidenceIndicators.length >= 4);

    // Nonexistent transaction (404)
    const notFoundRes = await investigator.request('/transactions/99999999999');
    assert.equal(notFoundRes.response.status, 404);
  });

  it('executes BFS graph traversal with hop bounds and visited node metrics', async () => {
    const res = await investigator.request('/analytics/bfs?start=230425980&depth=2&limit=20');
    assert.equal(res.response.status, 200);
    assert.equal(res.data.startTxId, '230425980');
    assert.ok(res.data.visitedCount > 0);
    assert.equal(res.data.evidence.algorithm, 'Breadth-First Search (BFS)');
  });

  it('executes DFS graph exploration with cycle avoidance', async () => {
    const res = await investigator.request('/analytics/dfs?start=230425980&depth=3&limit=20');
    assert.equal(res.response.status, 200);
    assert.equal(res.data.startTxId, '230425980');
    assert.ok(res.data.visitedCount > 0);
  });

  it('executes Dijkstra weighted shortest path and rejects invalid inputs', async () => {
    const res = await investigator.request('/analytics/dijkstra?start=230425980&target=5530458&weight=time');
    assert.equal(res.response.status, 200);
    assert.equal(res.data.found, true);
    assert.equal(res.data.hops, 1);
    assert.deepEqual(res.data.path, ['230425980', '5530458']);
    assert.ok(res.data.cumulativeCost >= 1.0);

    // Missing target param
    const errRes = await investigator.request('/analytics/dijkstra?start=230425980');
    assert.equal(errRes.response.status, 400);
  });

  it('computes connected components using Union-Find', async () => {
    const res = await investigator.request('/analytics/components', {
      method: 'POST',
      body: { transactionIds: ['230425980', '5530458', '232629023'] }
    });
    assert.equal(res.response.status, 200);
    assert.ok(res.data.componentCount >= 1);
    assert.equal(res.data.evidence.algorithm, 'Union-Find with Path Compression & Union by Rank');
  });

  it('retrieves top-k suspicious transactions using priority queue', async () => {
    const res = await investigator.request('/analytics/top-suspicious?k=5');
    assert.equal(res.response.status, 200);
    assert.equal(res.data.transactions.length, 5);
    assert.ok(res.data.transactions[0].riskScore >= res.data.transactions[4].riskScore);
  });

  it('performs sliding window temporal burst analysis', async () => {
    const res = await investigator.request('/analytics/temporal?window=3&threshold=1.3');
    assert.equal(res.response.status, 200);
    assert.equal(res.data.totalWindows, 47);
    assert.ok(res.data.burstCount > 0);
    assert.ok(res.data.peakWindow);
  });

  it('serves model evaluation metrics on time-aware split', async () => {
    const res = await investigator.request('/analytics/model-eval');
    assert.equal(res.response.status, 200);
    assert.ok(res.data.models.random_forest.f1 > 0.70);
    assert.ok(res.data.models.random_forest.pr_auc > 0.70);
    assert.ok(res.data.models.random_forest.roc_auc > 0.90);
    assert.equal(res.data.split_strategy.includes('Time-aware'), true);
  });

  it('saves and lists transaction investigations in audit history', async () => {
    const saveRes = await investigator.request('/transactions/232629023/investigate', {
      method: 'POST',
      body: {}
    });
    assert.equal(saveRes.response.status, 201);
    assert.equal(saveRes.data.txId, '232629023');

    const listRes = await investigator.request('/transactions/investigations');
    assert.equal(listRes.response.status, 200);
    assert.ok(listRes.data.some(i => i.txId === '232629023'));
  });
});
