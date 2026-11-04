import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { PriorityQueue, UnionFind, bfsTraversal, dfsTraversal, dijkstraShortestPath, findConnectedComponents, getTopSuspiciousTransactions, slidingWindowAnalysis } from '../server/graph/algorithms.mjs';
import { getGraphEngine } from '../server/graph/graphEngine.mjs';
import { RiskEngine } from '../server/ml/riskEngine.mjs';
import { DatasetIngestionPipeline } from '../server/dataset/ingestion.mjs';
import { answerQuestion } from '../server/assistant.mjs';

describe('Graph Analytics Engine & DSA Algorithms', () => {
  it('PriorityQueue maintains correct heap order and handles edge cases', () => {
    const minPq = new PriorityQueue((a, b) => a.priority - b.priority);
    assert.equal(minPq.isEmpty(), true);
    assert.equal(minPq.pop(), null);
    assert.equal(minPq.peek(), null);

    minPq.push({ id: 'A', priority: 50 });
    minPq.push({ id: 'B', priority: 10 });
    minPq.push({ id: 'C', priority: 30 });
    minPq.push({ id: 'D', priority: 5 });

    assert.equal(minPq.size(), 4);
    assert.equal(minPq.peek().id, 'D');

    const popped = [];
    while (!minPq.isEmpty()) {
      popped.push(minPq.pop());
    }

    assert.deepEqual(popped.map(p => p.id), ['D', 'B', 'C', 'A']);
    assert.deepEqual(popped.map(p => p.priority), [5, 10, 30, 50]);
  });

  it('Union-Find correctly manages sets with path compression and union by rank', () => {
    const uf = new UnionFind(['T1', 'T2', 'T3', 'T4', 'T5']);
    assert.equal(uf.connected('T1', 'T2'), false);
    assert.equal(uf.getComponentSize('T1'), 1);

    uf.union('T1', 'T2');
    uf.union('T2', 'T3');
    assert.equal(uf.connected('T1', 'T3'), true);
    assert.equal(uf.connected('T1', 'T4'), false);
    assert.equal(uf.getComponentSize('T1'), 3);

    uf.union('T4', 'T5');
    assert.equal(uf.getComponentSize('T4'), 2);
    assert.equal(uf.connected('T3', 'T5'), false);

    uf.union('T3', 'T4');
    assert.equal(uf.connected('T1', 'T5'), true);
    assert.equal(uf.getComponentSize('T1'), 5);
  });

  it('BFS and DFS handle cyclic and disconnected graphs without infinite loops', () => {
    // Construct small test graph with a cycle
    const mockGraph = {
      nodeIndex: new Map([
        ['N1', { txId: 'N1', label: 'licit', timeStep: 1, riskScore: 10 }],
        ['N2', { txId: 'N2', label: 'unknown', timeStep: 1, riskScore: 40 }],
        ['N3', { txId: 'N3', label: 'illicit', timeStep: 2, riskScore: 90 }],
        ['N4', { txId: 'N4', label: 'licit', timeStep: 2, riskScore: 15 }],
        ['ISOLATED', { txId: 'ISOLATED', label: 'unknown', timeStep: 1, riskScore: 50 }]
      ]),
      hasNode(id) { return this.nodeIndex.has(id); },
      getNode(id) { return this.nodeIndex.get(id); },
      getNeighbors(id) {
        // N1 -> N2 -> N3 -> N1 (cycle) and N3 -> N4
        const edges = { N1: ['N2'], N2: ['N3'], N3: ['N1', 'N4'], N4: [], ISOLATED: [] };
        return edges[id] || [];
      }
    };

    // BFS test
    const bfs = bfsTraversal(mockGraph, 'N1', { targetTxId: 'N4', maxDepth: 5 });
    assert.equal(bfs.found, true);
    assert.deepEqual(bfs.path, ['N1', 'N2', 'N3', 'N4']);
    assert.equal(bfs.hops, 3);

    // BFS to disconnected node
    const bfsIso = bfsTraversal(mockGraph, 'N1', { targetTxId: 'ISOLATED', maxDepth: 5 });
    assert.equal(bfsIso.found, false);
    assert.deepEqual(bfsIso.path, []);

    // DFS with cycle detection
    const dfs = dfsTraversal(mockGraph, 'N1', { maxDepth: 10 });
    assert.equal(dfs.cycleDetected, true);
    assert.ok(dfs.cycleEdges.length > 0);
    assert.ok(dfs.visitedCount >= 4);

    // Depth limit test
    const bfsShallow = bfsTraversal(mockGraph, 'N1', { targetTxId: 'N4', maxDepth: 1 });
    assert.equal(bfsShallow.found, false);
  });

  it('Dijkstra computes optimal weighted path and rejects negative weights', () => {
    const mockGraph = {
      nodeIndex: new Map([
        ['A', { txId: 'A', timeStep: 1, riskScore: 20 }],
        ['B', { txId: 'B', timeStep: 2, riskScore: 90 }], // high risk
        ['C', { txId: 'C', timeStep: 5, riskScore: 10 }], // time gap
        ['D', { txId: 'D', timeStep: 6, riskScore: 10 }]
      ]),
      hasNode(id) { return this.nodeIndex.has(id); },
      getNode(id) { return this.nodeIndex.get(id); },
      getNeighbors(id) {
        // A -> B -> D and A -> C -> D
        const edges = { A: ['B', 'C'], B: ['D'], C: ['D'], D: [] };
        return edges[id] || [];
      }
    };

    // Hop cost test (both 2 hops)
    const dijHop = dijkstraShortestPath(mockGraph, 'A', 'D', 'hop');
    assert.equal(dijHop.found, true);
    assert.equal(dijHop.hops, 2);
    assert.equal(dijHop.cumulativeCost, 2.0);

    // Time-weighted cost: A->B->D has steps 1->2->6 (cost: (2-1+1) + (6-2+1) = 2 + 5 = 7)
    // A->C->D has steps 1->5->6 (cost: (5-1+1) + (6-5+1) = 5 + 2 = 7)
    const dijTime = dijkstraShortestPath(mockGraph, 'A', 'D', 'time');
    assert.equal(dijTime.found, true);
    assert.equal(dijTime.hops, 2);

    // Negative weight rejection
    assert.throws(() => {
      dijkstraShortestPath(mockGraph, 'A', 'D', 'invalid-weight-type');
    }, /Unknown weightType/);
  });
});

describe('Dataset Ingestion & Integrity', () => {
  it('verifies actual Elliptic dataset characteristics without hardcoding', async () => {
    const pipeline = new DatasetIngestionPipeline();
    const result = await pipeline.execute();

    assert.equal(result.stats.totalNodes, 203769, 'Total nodes must equal 203,769');
    assert.equal(result.stats.totalEdges, 234355, 'Total edges must equal 234,355');
    assert.equal(result.stats.classes.illicit, 4545, 'Illicit transactions must equal 4,545');
    assert.equal(result.stats.classes.licit, 42019, 'Licit transactions must equal 42,019');
    assert.equal(result.stats.classes.unknown, 157205, 'Unknown transactions must equal 157,205');
    assert.equal(result.stats.validationErrors.length, 0, 'No validation errors in clean dataset');

    // Verify time steps 1 to 49
    for (let t = 1; t <= 49; t++) {
      assert.ok(result.stats.timeSteps[t] > 0, `Time step ${t} must contain transactions`);
    }

    // Verify unknown transactions are not marked as licit
    const unknownNode = result.nodeMap.get('230425980');
    assert.ok(unknownNode);
    assert.equal(unknownNode.label, 'unknown');
    assert.notEqual(unknownNode.label, 'licit');
  });
});

describe('Explainable Risk Scoring Engine', () => {
  it('correctly categorizes and explains illicit, licit, and unknown transactions', async () => {
    const graph = await getGraphEngine();
    const riskEngine = new RiskEngine(graph);

    // 1. Confirmed Illicit transaction (232629023)
    const illicitReport = riskEngine.evaluateTransaction('232629023');
    assert.equal(illicitReport.found, true);
    assert.equal(illicitReport.knownLabel, 'illicit');
    assert.equal(illicitReport.isGroundTruthIllicit, true);
    assert.equal(illicitReport.riskCategory, 'HIGH RISK');
    assert.ok(illicitReport.riskScore >= 70);
    assert.equal(illicitReport.dataSource, 'Elliptic Research Dataset');

    // 2. Confirmed Licit transaction (232438397)
    const licitReport = riskEngine.evaluateTransaction('232438397');
    assert.equal(licitReport.found, true);
    assert.equal(licitReport.knownLabel, 'licit');
    assert.equal(licitReport.isGroundTruthLicit, true);
    assert.equal(licitReport.riskCategory, 'LOW RISK');
    assert.ok(licitReport.riskScore < 40);

    // 3. Unknown transaction (230425980)
    const unknownReport = riskEngine.evaluateTransaction('230425980');
    assert.equal(unknownReport.found, true);
    assert.equal(unknownReport.knownLabel, 'unknown');
    assert.equal(unknownReport.isUnknown, true);
    assert.ok(unknownReport.evidenceIndicators.length >= 4);

    // 4. Missing transaction
    const missingReport = riskEngine.evaluateTransaction('0000000000');
    assert.equal(missingReport.found, false);
    assert.match(missingReport.error, /not found/i);
  });
});

describe('Data-Grounded Chatbot Assistant', () => {
  it('answers transaction questions using actual backend data and evidence citations', async () => {
    // 1. Transaction risk explanation
    const res1 = await answerQuestion(null, 'Why is transaction 232629023 suspicious?');
    assert.ok(res1.answer.includes('232629023'));
    assert.ok(res1.answer.includes('ILLICIT'));
    assert.ok(res1.citations.length >= 2);

    // 2. Shortest path
    const res2 = await answerQuestion(null, 'Show the shortest path between 230425980 and 5530458');
    assert.ok(res2.answer.includes('230425980 → 5530458'));
    assert.equal(res2.citations.length, 2);

    // 3. Top suspicious transactions
    const res3 = await answerQuestion(null, 'Find the top 5 suspicious transactions');
    assert.ok(res3.answer.includes('Top 5 suspicious'));
    assert.equal(res3.citations.length, 5);

    // 4. Scoring methodology
    const res4 = await answerQuestion(null, 'Explain how the risk score was calculated');
    assert.ok(res4.answer.includes('Random Forest'));
    assert.ok(res4.answer.includes('PR-AUC'));

    // 5. Non-existent transaction question
    const res5 = await answerQuestion(null, 'Why is transaction 99999999999 suspicious?');
    assert.ok(res5.answer.includes('not found in the Elliptic Research Dataset'));
  });
});

