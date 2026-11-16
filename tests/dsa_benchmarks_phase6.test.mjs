import test from 'node:test';
import assert from 'node:assert/strict';
import {
  generateBenchmarkGraph,
  benchmarkDijkstra,
  benchmarkBfs,
  benchmarkUnionFind,
  benchmarkBloomFilter,
  benchmarkTopK,
  runFullDsaBenchmarks
} from '../server/graph/benchmarkRig.mjs';

test('Phase 6: Explainable DSA Studio & Benchmark Rig', async (t) => {
  const graph = generateBenchmarkGraph(200);

  await t.test('6.1 Synthetic Benchmark Graph generator', () => {
    assert.equal(graph.nodes.length, 200, 'Graph must contain requested 200 vertices');
    assert.ok(graph.edges.length >= 199, 'Graph must contain at least 199 directed edges');
    assert.ok(graph.adj.has('NODE_0'), 'Adjacency map must be populated');
    assert.ok(graph.reverseAdj.has('NODE_199'), 'Reverse adjacency map must be populated');
  });

  await t.test('6.2 Dijkstra Benchmark: MinHeap O((V+E) log V) vs Unsorted Array Scan O(V^2)', () => {
    const res = benchmarkDijkstra(graph);
    assert.equal(res.algorithm, 'Dijkstra Shortest Path');
    assert.equal(res.optimized.dataStructure, 'Binary MinHeap (PriorityQueue)');
    assert.equal(res.optimized.complexity, 'O((V + E) log V)');
    assert.equal(res.baseline.dataStructure, 'Linear Unsorted Array Scan');
    assert.equal(res.baseline.complexity, 'O(V²)');
    assert.ok(res.speedupFactor >= 1, 'Optimized heap must be at least as fast as linear scan');
    assert.ok(res.optimized.timeMs >= 0);
    assert.ok(res.baseline.timeMs >= 0);
    assert.ok(res.theoreticalProof.length > 20);
  });

  await t.test('6.3 BFS Benchmark: Head-Pointer Circular Queue O(1) vs Array.shift() O(V)', () => {
    const res = benchmarkBfs(graph);
    assert.equal(res.algorithm, 'Breadth-First Search (BFS)');
    assert.match(res.optimized.complexity, /O\(V \+ E\)/);
    assert.match(res.baseline.complexity, /O\(V² \+ E\)/);
    assert.ok(res.speedupFactor >= 1);
    assert.ok(res.optimized.operations > 0);
  });

  await t.test('6.4 Union-Find Benchmark: Path Compression + Rank O(alpha(N)) vs Naive DFS', () => {
    const res = benchmarkUnionFind(graph);
    assert.equal(res.algorithm, 'Disjoint Set (Union-Find)');
    assert.match(res.optimized.complexity, /O\(m · α\(n\)\)/);
    assert.ok(res.componentsFound > 0, 'Must find connected components');
    assert.ok(res.speedupFactor >= 1);
  });

  await t.test('6.5 Bloom Filter Benchmark: O(k) Bit Probing vs O(N) Array.includes()', () => {
    const res = benchmarkBloomFilter(2000);
    assert.equal(res.algorithm, 'Bloom Filter Membership Test');
    assert.match(res.optimized.complexity, /O\(k\)/);
    assert.match(res.baseline.complexity, /O\(N\)/);
    assert.ok(res.speedupFactor >= 1);
    assert.ok(res.optimized.memoryBytes > 0);
  });

  await t.test('6.6 Top-K Heap Benchmark: Bounded MinHeap O(N log K) vs Array.sort() O(N log N)', () => {
    const res = benchmarkTopK(5000, 20);
    assert.equal(res.algorithm, 'Top-K Suspicious Entity Extraction');
    assert.equal(res.optimized.complexity, 'O(N log K)');
    assert.equal(res.baseline.complexity, 'O(N log N)');
    assert.ok(res.speedupFactor >= 1);
  });

  await t.test('6.7 Full Benchmark Suite Execution', () => {
    const full = runFullDsaBenchmarks(150);
    assert.ok(full.timestamp);
    assert.equal(full.benchmarkGraph.vertices, 150);
    assert.equal(full.results.length, 5, 'Must benchmark all 5 core DSA modules');
    assert.equal(full.summary.totalAlgorithmsBenchmarked, 5);
  });
});

