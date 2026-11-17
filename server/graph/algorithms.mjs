/**
 * Cyber Trace - Graph Analytics Algorithms Engine
 * 
 * Implements:
 * 1. PriorityQueue (Binary Heap - Min/Max)
 * 2. Breadth-First Search (BFS) - Shortest-hop path & Reachability
 * 3. Depth-First Search (DFS) - Network exploration & Cycle detection
 * 4. Dijkstra's Algorithm - Weighted shortest path with priority queue
 * 5. Union-Find (Disjoint Set Union) with path compression and union by rank
 * 6. Top-K Suspicious Transaction Ranking using Priority Queue
 * 7. Sliding Window Temporal Analysis over time steps
 * 8. Graph Neighborhood & Centrality
 */

// ============================================================================
// 1. PRIORITY QUEUE (Binary Heap)
// Time Complexity: Push O(log n), Pop O(log n), Peek O(1)
// Space Complexity: O(n)
// ============================================================================
export class PriorityQueue {
  /**
   * @param {Function} comparator - (a, b) => negative if a has higher priority than b
   */
  constructor(comparator = (a, b) => a.priority - b.priority) {
    this.heap = [];
    this.comparator = comparator;
  }

  size() {
    return this.heap.length;
  }

  isEmpty() {
    return this.heap.length === 0;
  }

  peek() {
    return this.heap[0] ?? null;
  }

  push(element) {
    this.heap.push(element);
    this._bubbleUp(this.heap.length - 1);
  }

  pop() {
    if (this.isEmpty()) return null;
    const top = this.heap[0];
    const bottom = this.heap.pop();
    if (this.heap.length > 0 && bottom !== undefined) {
      this.heap[0] = bottom;
      this._bubbleDown(0);
    }
    return top;
  }

  _bubbleUp(index) {
    while (index > 0) {
      const parentIndex = Math.floor((index - 1) / 2);
      if (this.comparator(this.heap[index], this.heap[parentIndex]) < 0) {
        [this.heap[index], this.heap[parentIndex]] = [this.heap[parentIndex], this.heap[index]];
        index = parentIndex;
      } else {
        break;
      }
    }
  }

  _bubbleDown(index) {
    const length = this.heap.length;
    while (true) {
      const leftChild = 2 * index + 1;
      const rightChild = 2 * index + 2;
      let smallest = index;

      if (leftChild < length && this.comparator(this.heap[leftChild], this.heap[smallest]) < 0) {
        smallest = leftChild;
      }
      if (rightChild < length && this.comparator(this.heap[rightChild], this.heap[smallest]) < 0) {
        smallest = rightChild;
      }

      if (smallest !== index) {
        [this.heap[index], this.heap[smallest]] = [this.heap[smallest], this.heap[index]];
        index = smallest;
      } else {
        break;
      }
    }
  }
}

// ============================================================================
// 2. BREADTH-FIRST SEARCH (BFS)
// Time Complexity: O(V + E)
// Space Complexity: O(V)
// ============================================================================
export function bfsTraversal(graph, startTxId, options = {}) {
  const startTime = Date.now();
  const maxDepth = options.maxDepth ?? 5;
  const targetTxId = options.targetTxId ?? null;
  const limit = options.limit ?? 200;

  if (!graph || !startTxId) {
    throw new TypeError('Graph and startTxId are required for BFS.');
  }
  if (!graph.hasNode(startTxId)) {
    return {
      found: false,
      error: `Transaction ${startTxId} not found in graph.`,
      path: [],
      hops: 0,
      visitedCount: 0,
      traversalTimeMs: 0
    };
  }

  const queue = [{ txId: startTxId, depth: 0, path: [startTxId], parentTxId: null }];
  const visited = new Set([startTxId]);
  const visitedNodes = [];
  const traversedEdges = [];
  let foundPath = null;

  while (queue.length > 0) {
    const { txId, depth, path, parentTxId } = queue.shift();
    const nodeData = graph.getNode(txId);
    visitedNodes.push({
      txId,
      depth,
      parentTxId,
      label: nodeData?.label || 'unknown',
      timeStep: nodeData?.timeStep ?? null,
      riskScore: nodeData?.riskScore ?? null,
      predictedClass: nodeData?.predictedClass || 'unknown'
    });

    if (targetTxId && txId === targetTxId) {
      foundPath = path;
      break;
    }

    if (visitedNodes.length >= limit) {
      break;
    }

    if (depth < maxDepth) {
      const neighbors = graph.getNeighbors(txId);
      for (const nextId of neighbors) {
        traversedEdges.push({ source: txId, target: nextId, depth: depth + 1 });
        if (!visited.has(nextId)) {
          visited.add(nextId);
          queue.push({
            txId: nextId,
            depth: depth + 1,
            path: [...path, nextId],
            parentTxId: txId
          });
        }
      }
    }
  }

  const durationMs = Date.now() - startTime;
  const targetFound = targetTxId ? Boolean(foundPath) : true;
  const illicitCount = visitedNodes.filter(n => n.label === 'illicit' || (n.riskScore && n.riskScore >= 70)).length;
  const licitCount = visitedNodes.filter(n => n.label === 'licit').length;
  const unknownCount = visitedNodes.length - illicitCount - licitCount;

  return {
    startTxId,
    targetTxId,
    found: targetFound,
    path: foundPath || (targetTxId ? [] : [startTxId]),
    hops: foundPath ? foundPath.length - 1 : 0,
    visitedNodes,
    reachableNodes: visitedNodes,
    visitedCount: visitedNodes.length,
    visitedNodesCount: visitedNodes.length,
    traversedEdges,
    maxDepthReached: Math.max(...visitedNodes.map(n => n.depth), 0),
    traversalTimeMs: durationMs,
    illicitCount,
    licitCount,
    unknownCount,
    explanation: targetTxId
      ? (foundPath
          ? `Shortest directed path of ${foundPath.length - 1} hops identified via BFS (${durationMs}ms).`
          : `No directed path exists from ${startTxId} to ${targetTxId} within depth limit ${maxDepth}.`)
      : `BFS explored ${visitedNodes.length} reachable downstream transactions up to depth ${maxDepth} (${durationMs}ms). Discovered ${illicitCount} illicit / high-risk nodes.`,
    evidence: {
      algorithm: 'Breadth-First Search (BFS)',
      timeComplexity: 'O(V + E)',
      spaceComplexity: 'O(V)',
      note: targetTxId
        ? (foundPath ? `Shortest directed path of ${foundPath.length - 1} hops identified.` : 'No directed path exists within the specified depth limit.')
        : `Explored ${visitedNodes.length} reachable downstream transactions up to depth ${maxDepth}.`
    }
  };
}

// ============================================================================
// 3. DEPTH-FIRST SEARCH (DFS)
// Time Complexity: O(V + E)
// Space Complexity: O(V)
// ============================================================================
export function dfsTraversal(graph, startTxId, options = {}) {
  const startTime = Date.now();
  const maxDepth = options.maxDepth ?? 8;
  const targetTxId = options.targetTxId ?? null;
  const limit = options.limit ?? 200;

  if (!graph || !startTxId) {
    throw new TypeError('Graph and startTxId are required for DFS.');
  }
  if (!graph.hasNode(startTxId)) {
    return {
      found: false,
      error: `Transaction ${startTxId} not found in graph.`,
      path: [],
      traversalTimeMs: 0
    };
  }

  const visited = new Set();
  const recStack = new Set();
  const traversalOrder = [];
  let foundPath = null;
  let cycleDetected = false;
  const cycleEdges = [];

  function dfs(currentId, depth, currentPath) {
    if (traversalOrder.length >= limit || (foundPath && targetTxId)) return;
    if (depth > maxDepth) return;

    visited.add(currentId);
    recStack.add(currentId);
    const nodeData = graph.getNode(currentId);

    traversalOrder.push({
      txId: currentId,
      depth,
      label: nodeData?.label || 'unknown',
      timeStep: nodeData?.timeStep ?? null,
      riskScore: nodeData?.riskScore ?? null
    });

    if (targetTxId && currentId === targetTxId) {
      foundPath = [...currentPath];
      recStack.delete(currentId);
      return;
    }

    const neighbors = graph.getNeighbors(currentId);
    for (const nextId of neighbors) {
      if (recStack.has(nextId)) {
        cycleDetected = true;
        cycleEdges.push({ source: currentId, target: nextId });
      } else if (!visited.has(nextId)) {
        dfs(nextId, depth + 1, [...currentPath, nextId]);
        if (foundPath && targetTxId) {
          recStack.delete(currentId);
          return;
        }
      }
    }

    recStack.delete(currentId);
  }

  dfs(startTxId, 0, [startTxId]);
  const durationMs = Date.now() - startTime;

  return {
    startTxId,
    targetTxId,
    found: targetTxId ? Boolean(foundPath) : true,
    path: foundPath || (targetTxId ? [] : [startTxId]),
    visitedCount: traversalOrder.length,
    traversalOrder,
    cycleDetected,
    cycleEdges,
    traversalTimeMs: durationMs,
    evidence: {
      algorithm: 'Depth-First Search (DFS)',
      timeComplexity: 'O(V + E)',
      spaceComplexity: 'O(V)',
      note: cycleDetected
        ? `Cycle detected in transaction graph (${cycleEdges.length} circular reference edges).`
        : 'Acyclic transaction flow observed in explored subgraph.'
    }
  };
}

// ============================================================================
// 4. DIJKSTRA'S ALGORITHM
// Time Complexity: O((V + E) log V) with Priority Queue
// Space Complexity: O(V)
// ============================================================================
export function dijkstraShortestPath(graph, startTxId, targetTxId, weightType = 'hop') {
  const startTime = Date.now();

  if (!graph || !startTxId || !targetTxId) {
    throw new TypeError('Graph, startTxId, and targetTxId are required for Dijkstra.');
  }
  if (!graph.hasNode(startTxId) || !graph.hasNode(targetTxId)) {
    return {
      found: false,
      error: `One or both transactions (${startTxId}, ${targetTxId}) not found in graph.`,
      path: [],
      cumulativeCost: Infinity,
      traversalTimeMs: 0
    };
  }

  // Weight computation function
  function getEdgeCost(sourceId, targetId) {
    const sNode = graph.getNode(sourceId);
    const tNode = graph.getNode(targetId);

    if (weightType === 'hop') {
      return 1.0;
    } else if (weightType === 'time') {
      const sTime = sNode?.timeStep ?? 1;
      const tTime = tNode?.timeStep ?? 1;
      const diff = Math.abs(tTime - sTime);
      return diff + 1.0; // Non-negative temporal difference
    } else if (weightType === 'risk') {
      // Risk-weighted traversal cost: paths through high-risk nodes have lower cost for fraud tracing
      const risk = tNode?.riskScore ?? 50;
      const cost = Math.max(0.1, (100 - risk) / 10 + 1.0);
      return cost;
    } else {
      throw new TypeError(`Unknown weightType: ${weightType}. Supported: 'hop', 'time', 'risk'`);
    }
  }

  const distances = new Map();
  const previous = new Map();
  const visited = new Set();
  const pq = new PriorityQueue((a, b) => a.distance - b.distance);

  distances.set(startTxId, 0);
  pq.push({ txId: startTxId, distance: 0 });

  let found = false;

  while (!pq.isEmpty()) {
    const current = pq.pop();
    if (!current) break;
    const { txId, distance } = current;

    if (visited.has(txId)) continue;
    visited.add(txId);

    if (txId === targetTxId) {
      found = true;
      break;
    }

    const neighbors = graph.getNeighbors(txId);
    for (const nextId of neighbors) {
      if (visited.has(nextId)) continue;

      const edgeCost = getEdgeCost(txId, nextId);
      if (edgeCost < 0) {
        throw new RangeError(`Negative edge weight encountered (${edgeCost}) for edge ${txId} -> ${nextId}. Dijkstra requires non-negative weights.`);
      }

      const newDist = distance + edgeCost;
      const oldDist = distances.get(nextId) ?? Infinity;

      if (newDist < oldDist) {
        distances.set(nextId, newDist);
        previous.set(nextId, txId);
        pq.push({ txId: nextId, distance: newDist });
      }
    }
  }

  // Reconstruct path and detailed hop breakdown
  const path = [];
  const hopBreakdown = [];
  if (found) {
    let curr = targetTxId;
    while (curr) {
      path.unshift(curr);
      curr = previous.get(curr);
    }

    let runningCost = 0;
    for (let i = 0; i < path.length - 1; i++) {
      const u = path[i];
      const v = path[i + 1];
      const edgeCost = getEdgeCost(u, v);
      runningCost += edgeCost;
      const uNode = graph.getNode(u);
      const vNode = graph.getNode(v);

      hopBreakdown.push({
        hopNumber: i + 1,
        fromTx: u,
        toTx: v,
        edgeCost: Number(edgeCost.toFixed(4)),
        cumulativeCost: Number(runningCost.toFixed(4)),
        fromTimeStep: uNode?.timeStep ?? 1,
        toTimeStep: vNode?.timeStep ?? 1,
        timeStepGap: Math.abs((vNode?.timeStep ?? 1) - (uNode?.timeStep ?? 1)),
        toRiskScore: vNode?.riskScore ?? 50,
        toLabel: vNode?.label ?? 'unknown',
        toPredictedClass: vNode?.predictedClass ?? 'unknown'
      });
    }
  }

  const durationMs = Date.now() - startTime;
  const cost = found ? Number((distances.get(targetTxId) ?? 0).toFixed(4)) : Infinity;

  const weightExplanation = weightType === 'hop'
    ? `Uniform hop count: each edge cost is 1.0. Total ${path.length - 1} hops = cost ${cost}.`
    : weightType === 'time'
    ? `Temporal step gap (|t_target - t_source| + 1.0). Total cumulative time cost = ${cost}.`
    : `Risk traversal cost ((100 - riskScore) / 10 + 1.0). Lower cost prioritizes high-risk illicit flow. Total cumulative cost = ${cost}.`;

  const explanation = found
    ? `Identified optimal weighted path of ${path.length - 1} hops with cumulative ${weightType} cost ${cost}. ${weightExplanation}`
    : `No directed path exists from ${startTxId} to ${targetTxId} in the graph.`;

  return {
    startTxId,
    targetTxId,
    found,
    path,
    hops: found ? path.length - 1 : 0,
    cumulativeCost: cost,
    weightType,
    hopBreakdown,
    visitedNodesCount: visited.size,
    explanation,
    traversalTimeMs: durationMs,
    evidence: {
      algorithm: "Dijkstra's Shortest Path",
      timeComplexity: 'O((V + E) log V)',
      spaceComplexity: 'O(V)',
      weightType,
      metricDescription: weightType === 'hop'
        ? 'Uniform hop distance (1.0 per edge)'
        : weightType === 'time'
        ? 'Temporal step difference (|Δt| + 1.0)'
        : 'Inverse risk score penalty ((100 - risk) / 10 + 1.0)'
    }
  };
}

// ============================================================================
// 5. UNION-FIND (Disjoint Set Union)
// Time Complexity: O(α(N)) amortized per operation
// Space Complexity: O(N)
// ============================================================================
export class UnionFind {
  constructor(elements = []) {
    this.parent = new Map();
    this.rank = new Map();
    this.size = new Map();
    this.numComponents = 0;

    for (const el of elements) {
      this.makeSet(el);
    }
  }

  makeSet(x) {
    if (!this.parent.has(x)) {
      this.parent.set(x, x);
      this.rank.set(x, 0);
      this.size.set(x, 1);
      this.numComponents++;
    }
  }

  /**
   * Find with path compression.
   */
  find(x) {
    if (!this.parent.has(x)) {
      this.makeSet(x);
      return x;
    }
    let root = x;
    while (root !== this.parent.get(root)) {
      root = this.parent.get(root);
    }
    // Path compression
    let curr = x;
    while (curr !== root) {
      const next = this.parent.get(curr);
      this.parent.set(curr, root);
      curr = next;
    }
    return root;
  }

  /**
   * Union by rank.
   */
  union(x, y) {
    const rootX = this.find(x);
    const rootY = this.find(y);

    if (rootX === rootY) return false;

    const rankX = this.rank.get(rootX) || 0;
    const rankY = this.rank.get(rootY) || 0;
    const sizeX = this.size.get(rootX) || 1;
    const sizeY = this.size.get(rootY) || 1;

    if (rankX < rankY) {
      this.parent.set(rootX, rootY);
      this.size.set(rootY, sizeX + sizeY);
    } else if (rankX > rankY) {
      this.parent.set(rootY, rootX);
      this.size.set(rootX, sizeX + sizeY);
    } else {
      this.parent.set(rootY, rootX);
      this.rank.set(rootX, rankX + 1);
      this.size.set(rootX, sizeX + sizeY);
    }

    this.numComponents--;
    return true;
  }

  connected(x, y) {
    return this.find(x) === this.find(y);
  }

  getComponentSize(x) {
    const root = this.find(x);
    return this.size.get(root) || 1;
  }
}

/**
 * Finds weakly connected components for a set of transaction IDs or subgraph.
 */
export function findConnectedComponents(graph, transactionIds) {
  const startTime = Date.now();
  const txSet = new Set(transactionIds);
  const uf = new UnionFind(transactionIds);

  for (const txId of transactionIds) {
    const neighbors = graph.getNeighbors(txId);
    for (const nextId of neighbors) {
      if (txSet.has(nextId)) {
        uf.union(txId, nextId);
      }
    }
  }

  // Group by component root
  const componentsMap = new Map();
  for (const txId of transactionIds) {
    const root = uf.find(txId);
    if (!componentsMap.has(root)) {
      componentsMap.set(root, []);
    }
    componentsMap.get(root).push(txId);
  }

  const components = [];
  let compIndex = 1;
  for (const [root, members] of componentsMap.entries()) {
    // Calculate risk stats for component
    let illicitCount = 0;
    let licitCount = 0;
    let unknownCount = 0;
    let totalRisk = 0;

    for (const tid of members) {
      const node = graph.getNode(tid);
      if (node) {
        if (node.label === 'illicit') illicitCount++;
        else if (node.label === 'licit') licitCount++;
        else unknownCount++;
        totalRisk += node.riskScore || 0;
      }
    }

    components.push({
      componentId: `COMP-${compIndex++}`,
      rootTxId: root,
      size: members.length,
      transactionIds: members,
      illicitCount,
      licitCount,
      unknownCount,
      meanRiskScore: members.length > 0 ? Number((totalRisk / members.length).toFixed(1)) : 0
    });
  }

  components.sort((a, b) => b.size - a.size);
  const durationMs = Date.now() - startTime;

  return {
    totalTransactions: transactionIds.length,
    componentCount: components.length,
    components,
    largestComponentSize: components[0]?.size || 0,
    calculationTimeMs: durationMs,
    evidence: {
      algorithm: 'Union-Find with Path Compression & Union by Rank',
      timeComplexity: 'O(α(N)) amortized per union/find',
      spaceComplexity: 'O(N)'
    }
  };
}

// ============================================================================
// 6. TOP-K SUSPICIOUS TRANSACTION RETRIEVAL
// Time Complexity: O(N log K) using a Min-Heap of size K
// Space Complexity: O(K)
// ============================================================================
export function getTopSuspiciousTransactions(graph, k = 10, filter = {}) {
  const startTime = Date.now();
  const timeStep = filter.timeStep !== undefined ? Number(filter.timeStep) : null;
  const labelFilter = filter.label || null;

  // Min-heap to maintain the top-k highest risk transactions
  const pq = new PriorityQueue((a, b) => a.riskScore - b.riskScore);

  let processedCount = 0;
  for (const [txId, node] of graph.nodeIndex.entries()) {
    if (timeStep !== null && node.timeStep !== timeStep) continue;
    if (labelFilter && node.label !== labelFilter) continue;

    processedCount++;
    const item = {
      txId,
      timeStep: node.timeStep,
      label: node.label,
      predictedClass: node.predictedClass || 'licit',
      riskScore: node.riskScore || 0,
      probability: node.probability || 0,
      inDegree: node.inDegree || 0,
      outDegree: node.outDegree || 0
    };

    if (pq.size() < k) {
      pq.push(item);
    } else if (item.riskScore > pq.peek().riskScore) {
      pq.pop();
      pq.push(item);
    }
  }

  const results = [];
  while (!pq.isEmpty()) {
    results.unshift(pq.pop());
  }

  const durationMs = Date.now() - startTime;
  return {
    k,
    totalScanned: processedCount,
    transactions: results,
    retrievalTimeMs: durationMs,
    evidence: {
      algorithm: 'Binary Heap Priority Queue Top-K Selection',
      timeComplexity: `O(N log ${k})`,
      spaceComplexity: `O(${k})`
    }
  };
}

// ============================================================================
// 7. SLIDING WINDOW TEMPORAL ANALYSIS
// Time Complexity: O(W + T) where W = windows, T = total timesteps
// Space Complexity: O(W)
// ============================================================================
export function slidingWindowAnalysis(graph, windowSize = 3, thresholdBurst = 1.3) {
  const startTime = Date.now();
  const timeStepCounts = {};
  const illicitCounts = {};

  // Aggregate stats per time step (1 to 49)
  for (let t = 1; t <= 49; t++) {
    timeStepCounts[t] = 0;
    illicitCounts[t] = 0;
  }

  for (const node of graph.nodeIndex.values()) {
    const t = node.timeStep;
    if (t >= 1 && t <= 49) {
      timeStepCounts[t]++;
      if (node.label === 'illicit' || (node.riskScore && node.riskScore >= 70)) {
        illicitCounts[t]++;
      }
    }
  }

  // Calculate sliding windows
  const windows = [];
  const maxStep = 49;
  const globalMean = 203769 / 49; // ~4158 txs per step

  for (let start = 1; start <= maxStep - windowSize + 1; start++) {
    const end = start + windowSize - 1;
    let windowTxCount = 0;
    let windowIllicitCount = 0;

    for (let s = start; s <= end; s++) {
      windowTxCount += timeStepCounts[s];
      windowIllicitCount += illicitCounts[s];
    }

    const avgTxs = windowTxCount / windowSize;
    const burstRatio = Number((avgTxs / globalMean).toFixed(2));
    const illicitRatio = windowTxCount > 0 ? Number((windowIllicitCount / windowTxCount).toFixed(4)) : 0;
    const isBurst = burstRatio >= thresholdBurst;

    windows.push({
      startStep: start,
      endStep: end,
      windowSize,
      totalTransactions: windowTxCount,
      illicitOrHighRiskCount: windowIllicitCount,
      illicitPercentage: Number((illicitRatio * 100).toFixed(2)),
      burstRatio,
      isBurst
    });
  }

  windows.sort((a, b) => b.totalTransactions - a.totalTransactions);
  const peakWindow = windows[0];
  windows.sort((a, b) => a.startStep - b.startStep);

  const durationMs = Date.now() - startTime;
  return {
    windowSize,
    totalWindows: windows.length,
    windows,
    peakWindow,
    burstCount: windows.filter(w => w.isBurst).length,
    analysisTimeMs: durationMs,
    evidence: {
      algorithm: 'Sliding Window Temporal Rate Analysis',
      timeComplexity: 'O(W + T)',
      spaceComplexity: 'O(W)',
      note: `Sliding window of ${windowSize} time steps identified ${windows.filter(w => w.isBurst).length} transaction bursts.`
    }
  };
}

// ============================================================================
// 8. GRAPH NEIGHBORHOOD & DEGREE CENTRALITY
// ============================================================================
export function getNeighborhood(graph, txId, maxDepth = 1) {
  if (!graph || !txId || !graph.hasNode(txId)) {
    return { found: false, txId, neighbors: [], inDegree: 0, outDegree: 0 };
  }

  const centerNode = graph.getNode(txId);
  const outgoing = graph.getNeighbors(txId);
  const incoming = graph.getIncomingNeighbors(txId);

  const neighborNodes = [];
  const neighborSet = new Set([...outgoing, ...incoming]);

  for (const nId of neighborSet) {
    const nData = graph.getNode(nId);
    neighborNodes.push({
      txId: nId,
      direction: outgoing.includes(nId) ? (incoming.includes(nId) ? 'bidirectional' : 'outgoing') : 'incoming',
      label: nData?.label || 'unknown',
      timeStep: nData?.timeStep ?? null,
      riskScore: nData?.riskScore ?? null
    });
  }

  return {
    found: true,
    txId,
    centerNode,
    inDegree: incoming.length,
    outDegree: outgoing.length,
    degreeCentrality: incoming.length + outgoing.length,
    totalNeighbors: neighborNodes.length,
    neighbors: neighborNodes
  };
}

// ============================================================================
// 9. CYCLE DETECTION (Directed Graph 3-Coloring / Back-Edges)
// Time Complexity: O(V + E)
// Space Complexity: O(V)
// Used in forensics: Uncovering circular layering & wash trading loops
// ============================================================================
export function detectCycles(nodes, edges) {
  const adj = new Map();
  for (const n of nodes) adj.set(n.id || n, []);
  for (const e of edges) {
    if (adj.has(e.from)) adj.get(e.from).push(e.to);
  }

  // 0 = unvisited (white), 1 = visiting/in stack (gray), 2 = completed (black)
  const color = new Map();
  const parent = new Map();
  for (const n of nodes) color.set(n.id || n, 0);

  const cycles = [];
  const steps = [];

  function dfs(u, path) {
    color.set(u, 1);
    path.push(u);
    steps.push({ step: steps.length + 1, action: 'VISIT', node: u, currentPath: [...path], colorState: 'GRAY' });

    for (const v of adj.get(u) || []) {
      if (color.get(v) === 1) {
        // Back edge found! Cycle detected
        const cycleStartIndex = path.indexOf(v);
        const cycleNodes = path.slice(cycleStartIndex).concat(v);
        cycles.push({
          cycle: cycleNodes,
          length: cycleNodes.length - 1,
          backEdge: { from: u, to: v },
          description: `Circular wash trading loop detected: ${cycleNodes.join(' → ')}`
        });
        steps.push({ step: steps.length + 1, action: 'CYCLE_DETECTED', backEdge: { from: u, to: v }, cycle: cycleNodes });
      } else if (color.get(v) === 0) {
        parent.set(v, u);
        dfs(v, path);
      }
    }

    path.pop();
    color.set(u, 2);
    steps.push({ step: steps.length + 1, action: 'FINISH', node: u, colorState: 'BLACK' });
  }

  for (const n of nodes) {
    const id = n.id || n;
    if (color.get(id) === 0) {
      dfs(id, []);
    }
  }

  return {
    hasCycle: cycles.length > 0,
    cycleCount: cycles.length,
    cycles,
    steps,
    evidence: {
      algorithm: 'DFS Cycle Detection with 3-Coloring (White/Gray/Black)',
      timeComplexity: 'O(V + E)',
      spaceComplexity: 'O(V)',
      practicalRelevance: 'Identifies circular layering, wash trading, and laundering spirals.'
    }
  };
}

// ============================================================================
// 10. TARJAN'S STRONGLY CONNECTED COMPONENTS (SCC)
// Time Complexity: O(V + E)
// Space Complexity: O(V)
// Used in forensics: Isolating tightly-knit laundering syndicates and rings
// ============================================================================
export function tarjanSCC(nodes, edges) {
  const adj = new Map();
  for (const n of nodes) adj.set(n.id || n, []);
  for (const e of edges) {
    if (adj.has(e.from)) adj.get(e.from).push(e.to);
  }

  let index = 0;
  const indices = new Map();
  const lowlink = new Map();
  const onStack = new Map();
  const stack = [];
  const sccs = [];
  const steps = [];

  function strongConnect(u) {
    indices.set(u, index);
    lowlink.set(u, index);
    index++;
    stack.push(u);
    onStack.set(u, true);

    steps.push({
      step: steps.length + 1,
      action: 'ENTER_NODE',
      node: u,
      index: indices.get(u),
      lowlink: lowlink.get(u),
      stack: [...stack]
    });

    for (const v of adj.get(u) || []) {
      if (!indices.has(v)) {
        strongConnect(v);
        lowlink.set(u, Math.min(lowlink.get(u), lowlink.get(v)));
        steps.push({
          step: steps.length + 1,
          action: 'UPDATE_LOWLINK_TREE',
          node: u,
          neighbor: v,
          newLowlink: lowlink.get(u)
        });
      } else if (onStack.get(v)) {
        lowlink.set(u, Math.min(lowlink.get(u), indices.get(v)));
        steps.push({
          step: steps.length + 1,
          action: 'UPDATE_LOWLINK_CROSS',
          node: u,
          neighbor: v,
          newLowlink: lowlink.get(u)
        });
      }
    }

    if (lowlink.get(u) === indices.get(u)) {
      const scc = [];
      let w;
      do {
        w = stack.pop();
        onStack.set(w, false);
        scc.push(w);
      } while (w !== u);

      sccs.push(scc);
      steps.push({
        step: steps.length + 1,
        action: 'FOUND_SCC',
        root: u,
        members: [...scc],
        isNonTrivial: scc.length > 1
      });
    }
  }

  for (const n of nodes) {
    const id = n.id || n;
    if (!indices.has(id)) {
      strongConnect(id);
    }
  }

  return {
    sccCount: sccs.length,
    nonTrivialSccs: sccs.filter(s => s.length > 1),
    components: sccs.map((c, i) => ({ id: `SCC-${i + 1}`, size: c.length, members: c })),
    steps,
    evidence: {
      algorithm: "Tarjan's Strongly Connected Components (Low-link DFS)",
      timeComplexity: 'O(V + E)',
      spaceComplexity: 'O(V)',
      practicalRelevance: 'Partitions transaction networks into mutually reachable collusion clusters.'
    }
  };
}

// ============================================================================
// 11. PAGERANK (Power Iteration)
// Time Complexity: O(k * (V + E)) where k = iterations (~20-50)
// Space Complexity: O(V)
// Used in forensics: Identifying primary money mules and liquidity aggregators
// ============================================================================
export function computePageRank(nodes, edges, options = {}) {
  const damping = options.damping ?? 0.85;
  const maxIterations = options.maxIterations ?? 30;
  const tolerance = options.tolerance ?? 1e-5;

  const nodeIds = nodes.map(n => n.id || n);
  const N = nodeIds.length;
  if (N === 0) return { ranks: {}, iterations: 0 };

  const outDegree = new Map();
  const incoming = new Map();
  for (const id of nodeIds) {
    outDegree.set(id, 0);
    incoming.set(id, []);
  }

  for (const e of edges) {
    if (outDegree.has(e.from)) {
      outDegree.set(e.from, outDegree.get(e.from) + 1);
    }
    if (incoming.has(e.to)) {
      incoming.get(e.to).push(e.from);
    }
  }

  let ranks = new Map();
  const initialRank = 1 / N;
  for (const id of nodeIds) ranks.set(id, initialRank);

  const steps = [];

  let iter = 0;
  let diff = Infinity;

  while (iter < maxIterations && diff > tolerance) {
    iter++;
    const nextRanks = new Map();
    let danglingSum = 0;

    for (const id of nodeIds) {
      if (outDegree.get(id) === 0) {
        danglingSum += ranks.get(id);
      }
    }

    diff = 0;
    for (const id of nodeIds) {
      let sumIncoming = 0;
      for (const src of incoming.get(id)) {
        sumIncoming += ranks.get(src) / outDegree.get(src);
      }
      const newRank = (1 - damping) / N + damping * (sumIncoming + danglingSum / N);
      diff += Math.abs(newRank - ranks.get(id));
      nextRanks.set(id, newRank);
    }

    ranks = nextRanks;
    steps.push({
      iteration: iter,
      diff: Number(diff.toFixed(6)),
      topNode: [...ranks.entries()].sort((a, b) => b[1] - a[1])[0]
    });
  }

  const sorted = [...ranks.entries()]
    .map(([id, score]) => ({ id, score: Number(score.toFixed(6)), percentage: Number((score * 100).toFixed(2)) }))
    .sort((a, b) => b.score - a.score);

  return {
    iterations: iter,
    converged: diff <= tolerance,
    finalDiff: Number(diff.toFixed(6)),
    ranks: sorted,
    steps,
    evidence: {
      algorithm: 'PageRank Power Iteration with Damping',
      timeComplexity: 'O(k · (V + E))',
      spaceComplexity: 'O(V)',
      practicalRelevance: 'Identifies central aggregator hubs and high-throughput mixer funnels.'
    }
  };
}

// ============================================================================
// 12. TOPOLOGICAL SORT (Kahn's In-Degree Algorithm)
// Time Complexity: O(V + E)
// Space Complexity: O(V)
// Used in forensics: Reconstructing causal chronological progression of stolen funds
// ============================================================================
export function topologicalSortKahn(nodes, edges) {
  const nodeIds = nodes.map(n => n.id || n);
  const inDegree = new Map();
  const adj = new Map();

  for (const id of nodeIds) {
    inDegree.set(id, 0);
    adj.set(id, []);
  }

  for (const e of edges) {
    if (adj.has(e.from)) adj.get(e.from).push(e.to);
    if (inDegree.has(e.to)) inDegree.set(e.to, inDegree.get(e.to) + 1);
  }

  const queue = [];
  for (const [id, deg] of inDegree.entries()) {
    if (deg === 0) queue.push(id);
  }

  const order = [];
  const steps = [];

  while (queue.length > 0) {
    const curr = queue.shift();
    order.push(curr);

    steps.push({
      step: steps.length + 1,
      action: 'PROCESS_ZERO_INDEGREE',
      node: curr,
      currentOrder: [...order],
      queueState: [...queue]
    });

    for (const neighbor of adj.get(curr) || []) {
      const newDeg = inDegree.get(neighbor) - 1;
      inDegree.set(neighbor, newDeg);
      if (newDeg === 0) {
        queue.push(neighbor);
        steps.push({
          step: steps.length + 1,
          action: 'ENQUEUE_ZERO_INDEGREE',
          node: neighbor
        });
      }
    }
  }

  const isDAG = order.length === nodeIds.length;

  return {
    isDAG,
    order: isDAG ? order : [],
    steps,
    hasCycles: !isDAG,
    evidence: {
      algorithm: "Kahn's In-Degree Topological Sort",
      timeComplexity: 'O(V + E)',
      spaceComplexity: 'O(V)',
      practicalRelevance: 'Orders transactions in strict causal dependency sequence to establish money trail.'
    }
  };
}

// ============================================================================
// 13. A* HEURISTIC SEARCH
// Time Complexity: O((V + E) log V)
// Space Complexity: O(V)
// Used in forensics: Fast targeted route recovery toward known VASP exchange deposit
// ============================================================================
export function aStarSearch(nodes, edges, startId, goalId, heuristicWeights = {}) {
  const adj = new Map();
  for (const n of nodes) adj.set(n.id || n, []);
  for (const e of edges) {
    if (adj.has(e.from)) {
      adj.get(e.from).push({ to: e.to, cost: Number(e.weight || e.amount || 1.0) });
    }
  }

  const gScore = new Map();
  const fScore = new Map();
  const cameFrom = new Map();

  for (const n of nodes) {
    const id = n.id || n;
    gScore.set(id, Infinity);
    fScore.set(id, Infinity);
  }

  // Heuristic function (e.g. estimated hops or risk affinity)
  function h(node) {
    return heuristicWeights[node] ?? 0;
  }

  gScore.set(startId, 0);
  fScore.set(startId, h(startId));

  const openSet = new PriorityQueue((a, b) => a.f - b.f);
  openSet.push({ id: startId, f: fScore.get(startId) });

  const closedSet = new Set();
  const steps = [];

  let found = false;

  while (!openSet.isEmpty()) {
    const current = openSet.pop();
    const currId = current.id;

    steps.push({
      step: steps.length + 1,
      action: 'EXPAND_MIN_F',
      node: currId,
      gScore: gScore.get(currId),
      fScore: current.f,
      openSetSize: openSet.size()
    });

    if (currId === goalId) {
      found = true;
      break;
    }

    closedSet.add(currId);

    for (const edge of adj.get(currId) || []) {
      const neighbor = edge.to;
      if (closedSet.has(neighbor)) continue;

      const tentativeG = gScore.get(currId) + edge.cost;

      if (tentativeG < gScore.get(neighbor)) {
        cameFrom.set(neighbor, currId);
        gScore.set(neighbor, tentativeG);
        const f = tentativeG + h(neighbor);
        fScore.set(neighbor, f);

        openSet.push({ id: neighbor, f });
        steps.push({
          step: steps.length + 1,
          action: 'RELAX_EDGE',
          from: currId,
          to: neighbor,
          newG: tentativeG,
          newF: f
        });
      }
    }
  }

  const path = [];
  if (found) {
    let curr = goalId;
    while (curr) {
      path.unshift(curr);
      curr = cameFrom.get(curr);
    }
  }

  return {
    found,
    startId,
    goalId,
    path,
    hops: found ? path.length - 1 : 0,
    cost: found ? gScore.get(goalId) : Infinity,
    steps,
    evidence: {
      algorithm: 'A* Heuristic Directed Search',
      timeComplexity: 'O((V + E) log V)',
      spaceComplexity: 'O(V)',
      practicalRelevance: 'Rapid targeted route recovery to prioritized exchange deposit addresses.'
    }
  };
}

export { PrefixTrie, TrieNode } from './prefixTrie.mjs';
export { LRUCache, LRUNode } from './lruCache.mjs';

