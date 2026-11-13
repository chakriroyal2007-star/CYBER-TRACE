/**
 * DSA Study Studio - Educational Simulation Engine & 14 Algorithm Demonstrators
 * Generates step-by-step state snapshots for interactive animation:
 * - Play / Pause / Step Forward / Step Back
 * - State inspection: data structures (heap, queue, stack, disjoint sets, distances)
 * - Forensic context: Why this algorithm is used in CYBER-TRACE
 */

import {
  PriorityQueue,
  UnionFind,
  detectCycles,
  tarjanSCC,
  computePageRank,
  topologicalSortKahn,
  aStarSearch
} from './algorithms.mjs';

export const DSA_CATALOG = [
  {
    id: 'priority-queue',
    name: 'Priority Queue (Binary Min/Max Heap)',
    category: 'Core Data Structures',
    timeComplexity: 'Push: O(log N) | Pop: O(log N) | Peek: O(1)',
    spaceComplexity: 'O(N)',
    whyInCyberTrace: 'Drives taint-cost traversal in multi-hop tracing and powers Top-K suspicious wallet selection without sorting entire million-transaction datasets.',
    concept: 'A complete binary tree maintained in array storage where every parent node satisfies the heap property relative to its children (A[parent] <= A[child] for min-heap).',
    pseudocode: `class MinHeap:
  def push(val):
    heap.append(val)
    bubble_up(len(heap) - 1)

  def pop():
    swap(heap[0], heap[-1])
    root = heap.pop()
    bubble_down(0)
    return root`,
    realApplication: 'Maintains optimal candidate fronts when prioritizing highest-risk or lowest-taint-loss paths.'
  },
  {
    id: 'bfs',
    name: 'Breadth-First Search (BFS)',
    category: 'Graph Traversal',
    timeComplexity: 'O(V + E)',
    spaceComplexity: 'O(V)',
    whyInCyberTrace: 'Calculates minimum transfer hops between a victim wallet and known exchange deposit addresses to measure distance to cashout.',
    concept: 'Explores vertices level-by-level using a FIFO queue, guaranteeing the minimum number of hops in unweighted graphs.',
    pseudocode: `queue = [start]
visited = {start}
while queue:
  node = queue.pop(0)
  for neighbor in adj[node]:
    if neighbor not in visited:
      visited.add(neighbor)
      queue.append(neighbor)`,
    realApplication: 'Determines whether stolen tokens reached a centralized exchange within the statutory 3-to-5 hop freeze window.'
  },
  {
    id: 'dfs',
    name: 'Depth-First Search (DFS)',
    category: 'Graph Traversal',
    timeComplexity: 'O(V + E)',
    spaceComplexity: 'O(V)',
    whyInCyberTrace: 'Exhaustively explores peel chains and deep laundering paths where a fraudster repeatedly peels small amounts across dozens of wallets.',
    concept: 'Explores as deep as possible along each branch before backtracking using a LIFO stack or recursion.',
    pseudocode: `stack = [start]
visited = set()
while stack:
  node = stack.pop()
  if node not in visited:
    visited.add(node)
    for neighbor in adj[node]:
      stack.append(neighbor)`,
    realApplication: 'Deep peel-chain exploration following fractional change outputs through mixer pipelines.'
  },
  {
    id: 'dijkstra',
    name: "Dijkstra's Algorithm",
    category: 'Shortest Path',
    timeComplexity: 'O((V + E) log V)',
    spaceComplexity: 'O(V)',
    whyInCyberTrace: 'Finds the path of minimum resistance or minimum taint-loss from the victim to a cashout point using weighted transaction edges.',
    concept: 'Greedy algorithm that finds shortest paths from a source to all other vertices in a directed graph with non-negative edge weights using a priority queue.',
    pseudocode: `dist = {v: infinity for v in V}; dist[source] = 0
pq = MinHeap([(0, source)])
while pq:
  d, u = pq.pop()
  if d > dist[u]: continue
  for v, weight in adj[u]:
    if dist[u] + weight < dist[v]:
      dist[v] = dist[u] + weight
      pq.push((dist[v], v))`,
    realApplication: 'Determines the highest-probability money trail weighted by transaction amount retention and latency.'
  },
  {
    id: 'union-find',
    name: 'Union-Find (Disjoint Set Union - DSU)',
    category: 'Set Operations',
    timeComplexity: 'O(α(N)) amortized per operation',
    spaceComplexity: 'O(N)',
    whyInCyberTrace: 'Clusters multi-input transactions and deposit sweeps to attribute multiple pseudo-anonymous addresses to a single controller entity.',
    concept: 'Maintains partitioned disjoint sets with near-constant time Find (with path compression) and Union (by rank/size).',
    pseudocode: `def find(x):
  if parent[x] != x:
    parent[x] = find(parent[x]) # Path compression
  return parent[x]

def union(x, y):
  rootX, rootY = find(x), find(y)
  if rank[rootX] < rank[rootY]: parent[rootX] = rootY
  else: parent[rootY] = rootX`,
    realApplication: 'Satoshi Nakamoto multi-input co-spending heuristic for clustering suspect wallet syndicates.'
  },
  {
    id: 'connected-components',
    name: 'Weakly Connected Components',
    category: 'Graph Decomposition',
    timeComplexity: 'O(V + E)',
    spaceComplexity: 'O(V)',
    whyInCyberTrace: 'Isolates independent money laundering syndicates into self-contained operational clusters for individual case generation.',
    concept: 'Decomposes an arbitrary directed graph into subgraphs where any two vertices are connected by an undirected path.',
    pseudocode: `uf = UnionFind(nodes)
for u, v in edges:
  uf.union(u, v)
components = group_by_root(uf)`,
    realApplication: 'Groups thousands of suspicious transactions into isolated crime syndicate dossiers.'
  },
  {
    id: 'top-k',
    name: 'Top-K Min-Heap Selection',
    category: 'Selection & Ranking',
    timeComplexity: 'O(N log K)',
    spaceComplexity: 'O(K)',
    whyInCyberTrace: 'Extracts the top 10 most critical high-risk wallets or transactions from millions of records without sorting the entire dataset.',
    concept: 'Maintains a min-heap of fixed size K. For every incoming item, if its score exceeds the heap root, replace the root and sift down.',
    pseudocode: `min_heap = []
for item in dataset:
  if len(min_heap) < K:
    min_heap.push(item)
  elif item.score > min_heap.peek().score:
    min_heap.pop()
    min_heap.push(item)`,
    realApplication: 'Instant real-time leaderboards of high-risk transactions for officer triage.'
  },
  {
    id: 'sliding-window',
    name: 'Sliding Window Temporal Burst Analysis',
    category: 'Stream & Time Series',
    timeComplexity: 'O(T + W)',
    spaceComplexity: 'O(W)',
    whyInCyberTrace: 'Identifies sudden surges in transaction frequency that signal pump-and-dump events or automated wallet drainer activity.',
    concept: 'Maintains a moving time range [t, t + W - 1] to calculate localized rolling rates and detect rate anomalies against historical baselines.',
    pseudocode: `window_sum = sum(transactions[0:W])
for i in range(W, total_timesteps):
  window_sum += transactions[i] - transactions[i - W]
  if window_sum / W > baseline * threshold:
    flag_burst(i)`,
    realApplication: 'Detects rapid automated sweeps executing within 15-minute intervals.'
  },
  {
    id: 'neighborhood',
    name: 'Graph Neighborhood & Degree Centrality',
    category: 'Network Analysis',
    timeComplexity: 'O(deg(V))',
    spaceComplexity: 'O(deg(V))',
    whyInCyberTrace: 'Extracts the immediate 1-to-2 hop transaction sphere around a suspect wallet to discover immediate counterparties.',
    concept: 'Finds all incoming and outgoing adjacent vertices and calculates in-degree (fan-in), out-degree (fan-out), and total degree centrality.',
    pseudocode: `incoming = [u for u in V if node in adj[u]]
outgoing = adj[node]
centrality = len(incoming) + len(outgoing)`,
    realApplication: 'Distinguishes money mule fan-in collectors from mixer peel fan-out distributors.'
  },
  {
    id: 'cycle-detection',
    name: 'Cycle Detection (3-Coloring DFS)',
    category: 'Graph Traversal',
    timeComplexity: 'O(V + E)',
    spaceComplexity: 'O(V)',
    whyInCyberTrace: 'Unmasks circular layering, wash trading, and artificial volume inflation where funds return to earlier syndicate wallets.',
    concept: 'Colors vertices White (unvisited), Gray (currently in recursive DFS call stack), and Black (completed). An edge pointing to a Gray node is a back-edge and proves a cycle.',
    pseudocode: `def dfs(u):
  color[u] = GRAY
  for v in adj[u]:
    if color[v] == GRAY: report_cycle(u, v)
    elif color[v] == WHITE: dfs(v)
  color[u] = BLACK`,
    realApplication: 'Detects wash-trading bots inflating NFT/token volume to defraud retail investors.'
  },
  {
    id: 'tarjan-scc',
    name: "Tarjan's Strongly Connected Components",
    category: 'Graph Decomposition',
    timeComplexity: 'O(V + E)',
    spaceComplexity: 'O(V)',
    whyInCyberTrace: 'Partitions complex transaction topologies into closed feedback loops where all members can exchange funds with each other.',
    concept: 'Single-pass DFS tracking discovery index and low-link values with a stack to isolate maximal strongly connected subgraphs in linear time.',
    pseudocode: `def strongconnect(u):
  index[u] = lowlink[u] = next_index++
  stack.push(u); on_stack[u] = True
  for v in adj[u]:
    if v not in index:
      strongconnect(v)
      lowlink[u] = min(lowlink[u], lowlink[v])
    elif on_stack[v]:
      lowlink[u] = min(lowlink[u], index[v])
  if lowlink[u] == index[u]:
    pop_scc_until(u)`,
    realApplication: 'Uncovers syndicates with closed-loop liquidity pooling.'
  },
  {
    id: 'pagerank',
    name: 'PageRank Power Iteration',
    category: 'Link Analysis',
    timeComplexity: 'O(K · (V + E))',
    spaceComplexity: 'O(V)',
    whyInCyberTrace: 'Identifies dominant aggregator hubs and primary liquidity centers by modeling random flow of stolen cryptocurrency.',
    concept: 'Iteratively distributes probability mass across directed edges with a damping factor (default 0.85) until stationary distribution converges.',
    pseudocode: `PR = {v: 1/N for v in V}
repeat:
  next_PR = {v: (1 - d)/N for v in V}
  for u in V:
    for v in adj[u]:
      next_PR[v] += d * PR[u] / out_degree[u]
  PR = next_PR
until convergence`,
    realApplication: 'Ranks the most critical intermediary nodes for law enforcement Section 91 notices.'
  },
  {
    id: 'topological-sort',
    name: "Topological Sort (Kahn's In-Degree Algorithm)",
    category: 'Causal Ordering',
    timeComplexity: 'O(V + E)',
    spaceComplexity: 'O(V)',
    whyInCyberTrace: 'Reconstructs strict chronological, cause-and-effect sequences of stolen fund movements across unspent transaction DAGs.',
    concept: 'Identifies vertices with 0 in-degree, enqueues them, removes their outgoing edges, and repeats to produce a linear causal dependency ordering.',
    pseudocode: `in_degree = compute_in_degrees(G)
queue = [v for v in V if in_degree[v] == 0]
order = []
while queue:
  u = queue.pop(0)
  order.append(u)
  for v in adj[u]:
    in_degree[v] -= 1
    if in_degree[v] == 0: queue.append(v)`,
    realApplication: 'Builds court-admissible chronological timelines proving causal link from theft to exchange exit.'
  },
  {
    id: 'a-star',
    name: 'A* Heuristic Directed Search',
    category: 'Targeted Search',
    timeComplexity: 'O((V + E) log V)',
    spaceComplexity: 'O(V)',
    whyInCyberTrace: 'Rapidly traces optimal routes toward high-value target entities (e.g. Binance/WazirX hot wallets) using exchange affinity heuristics.',
    concept: 'Best-first search selecting nodes that minimize f(n) = g(n) + h(n), where g(n) is actual cost from origin and h(n) is admissible heuristic estimate to target.',
    pseudocode: `open_set = MinHeap([(f(start), start)])
g_score[start] = 0
while open_set:
  curr = open_set.pop()
  if curr == goal: return reconstruct_path()
  for neighbor, weight in adj[curr]:
    tentative_g = g_score[curr] + weight
    if tentative_g < g_score[neighbor]:
      g_score[neighbor] = tentative_g
      f_score = tentative_g + h(neighbor)
      open_set.push((f_score, neighbor))`,
    realApplication: 'Fast-path recovery when law enforcement already knows which exchange hot wallet received the final deposit.'
  }
];

export const PRESET_GRAPHS = {
  'mule-ring': {
    name: 'Money Mule Ring & Layering',
    description: 'Victim funds pass through multiple intermediary mules before pooling at a centralized cashout point with a circular kickback.',
    nodes: [
      { id: 'Victim', label: 'Victim (Source)', role: 'victim', risk: 10 },
      { id: 'Mule-1', label: 'Mule 1 (Layer 1)', role: 'intermediary', risk: 75 },
      { id: 'Mule-2', label: 'Mule 2 (Layer 2)', role: 'intermediary', risk: 85 },
      { id: 'Mule-3', label: 'Mule 3 (Layer 2)', role: 'intermediary', risk: 80 },
      { id: 'Aggregator', label: 'Aggregator Hub', role: 'intermediary', risk: 92 },
      { id: 'VASP-Binance', label: 'Binance Deposit', role: 'vasp', risk: 40 }
    ],
    edges: [
      { from: 'Victim', to: 'Mule-1', amount: 500000, weight: 1.0 },
      { from: 'Mule-1', to: 'Mule-2', amount: 250000, weight: 1.2 },
      { from: 'Mule-1', to: 'Mule-3', amount: 240000, weight: 1.1 },
      { from: 'Mule-2', to: 'Aggregator', amount: 245000, weight: 0.9 },
      { from: 'Mule-3', to: 'Aggregator', amount: 235000, weight: 0.9 },
      { from: 'Aggregator', to: 'VASP-Binance', amount: 470000, weight: 0.5 },
      { from: 'Aggregator', to: 'Mule-1', amount: 10000, weight: 2.0 } // Circular kickback loop
    ]
  },
  'wash-trading-cycle': {
    name: 'Wash Trading & Circular Layering',
    description: 'Circular transactions designed to simulate trade volume or obscure provenance of stolen funds.',
    nodes: [
      { id: 'Wallet-A', label: 'Syndicate A', role: 'suspect', risk: 88 },
      { id: 'Wallet-B', label: 'Syndicate B', role: 'suspect', risk: 82 },
      { id: 'Wallet-C', label: 'Syndicate C', role: 'suspect', risk: 90 },
      { id: 'Wallet-D', label: 'Syndicate D', role: 'suspect', risk: 78 },
      { id: 'Exit-Node', label: 'DEX Liquidity Pool', role: 'dex', risk: 60 }
    ],
    edges: [
      { from: 'Wallet-A', to: 'Wallet-B', amount: 100000, weight: 1.0 },
      { from: 'Wallet-B', to: 'Wallet-C', amount: 98000, weight: 1.0 },
      { from: 'Wallet-C', to: 'Wallet-D', amount: 95000, weight: 1.0 },
      { from: 'Wallet-D', to: 'Wallet-A', amount: 92000, weight: 1.0 }, // Loop
      { from: 'Wallet-C', to: 'Exit-Node', amount: 25000, weight: 1.5 }
    ]
  },
  'deposit-sweep': {
    name: 'Multi-Victim Deposit Sweep',
    description: 'Multiple victim addresses swept into a single collector wallet, then fanned out to an exchange.',
    nodes: [
      { id: 'Victim-1', label: 'Victim 1', role: 'victim', risk: 10 },
      { id: 'Victim-2', label: 'Victim 2', role: 'victim', risk: 10 },
      { id: 'Victim-3', label: 'Victim 3', role: 'victim', risk: 10 },
      { id: 'Collector', label: 'Sweep Collector', role: 'intermediary', risk: 95 },
      { id: 'Split-1', label: 'Mule Split 1', role: 'intermediary', risk: 70 },
      { id: 'Split-2', label: 'Mule Split 2', role: 'intermediary', risk: 70 },
      { id: 'WazirX-Hot', label: 'WazirX Hot Wallet', role: 'vasp', risk: 35 }
    ],
    edges: [
      { from: 'Victim-1', to: 'Collector', amount: 150000, weight: 1.0 },
      { from: 'Victim-2', to: 'Collector', amount: 300000, weight: 1.0 },
      { from: 'Victim-3', to: 'Collector', amount: 120000, weight: 1.0 },
      { from: 'Collector', to: 'Split-1', amount: 280000, weight: 1.2 },
      { from: 'Collector', to: 'Split-2', amount: 280000, weight: 1.2 },
      { from: 'Split-1', to: 'WazirX-Hot', amount: 275000, weight: 0.8 },
      { from: 'Split-2', to: 'WazirX-Hot', amount: 275000, weight: 0.8 }
    ]
  }
};

/**
 * Runs a step-by-step educational simulation for any of the 14 algorithms
 */
export function runDsaSimulation(params = {}) {
  const {
    algorithm = 'bfs',
    preset = 'mule-ring',
    customGraph = null,
    startNode = 'Victim',
    targetNode = 'VASP-Binance',
    k = 3,
    windowSize = 2,
    damping = 0.85
  } = params;

  const catalogEntry = DSA_CATALOG.find(a => a.id === algorithm) || DSA_CATALOG[1];
  const graph = customGraph && customGraph.nodes?.length ? customGraph : (PRESET_GRAPHS[preset] || PRESET_GRAPHS['mule-ring']);

  const nodes = graph.nodes;
  const edges = graph.edges;
  const adj = new Map();
  for (const n of nodes) adj.set(n.id, []);
  for (const e of edges) {
    if (adj.has(e.from)) adj.get(e.from).push(e);
  }

  const steps = [];
  let summary = {};

  if (algorithm === 'bfs') {
    const queue = [startNode];
    const visited = new Set([startNode]);
    const parent = new Map();
    let stepCount = 1;

    steps.push({
      step: stepCount++,
      action: 'INITIALIZE',
      node: startNode,
      queue: [...queue],
      visited: Array.from(visited),
      explanation: `Initialized BFS. Enqueued start node ${startNode}. Visited set contains {${startNode}}.`
    });

    let foundTarget = false;
    while (queue.length > 0) {
      const curr = queue.shift();
      steps.push({
        step: stepCount++,
        action: 'DEQUEUE_AND_VISIT',
        node: curr,
        queue: [...queue],
        visited: Array.from(visited),
        explanation: `Dequeued ${curr} from FIFO queue. Inspecting outgoing transfer edges.`
      });

      if (curr === targetNode) {
        foundTarget = true;
        steps.push({
          step: stepCount++,
          action: 'TARGET_REACHED',
          node: curr,
          queue: [...queue],
          visited: Array.from(visited),
          explanation: `Target ${targetNode} discovered! BFS guarantees minimum transfer hop distance.`
        });
        break;
      }

      for (const edge of adj.get(curr) || []) {
        if (!visited.has(edge.to)) {
          visited.add(edge.to);
          parent.set(edge.to, curr);
          queue.push(edge.to);
          steps.push({
            step: stepCount++,
            action: 'ENQUEUE_NEIGHBOR',
            node: edge.to,
            activeEdge: { from: curr, to: edge.to, amount: edge.amount },
            queue: [...queue],
            visited: Array.from(visited),
            explanation: `Discovered unvisited adjacent wallet ${edge.to} via edge (${curr} → ${edge.to}). Enqueued for next level.`
          });
        }
      }
    }

    const path = [];
    if (foundTarget || visited.has(targetNode)) {
      let cur = targetNode;
      while (cur) {
        path.unshift(cur);
        cur = parent.get(cur);
      }
    }

    summary = {
      path,
      hopCount: path.length > 0 ? path.length - 1 : 0,
      totalVisited: visited.size,
      foundTarget
    };
  } else if (algorithm === 'dfs') {
    const stack = [startNode];
    const visited = new Set();
    let stepCount = 1;

    steps.push({
      step: stepCount++,
      action: 'INITIALIZE',
      node: startNode,
      stack: [...stack],
      visited: [],
      explanation: `Initialized DFS. Pushed ${startNode} onto call stack.`
    });

    while (stack.length > 0) {
      const curr = stack.pop();
      if (!visited.has(curr)) {
        visited.add(curr);
        steps.push({
          step: stepCount++,
          action: 'POP_AND_VISIT',
          node: curr,
          stack: [...stack],
          visited: Array.from(visited),
          explanation: `Popped ${curr} from stack and marked visited. Exploring deep along its transfer edges.`
        });

        const neighbors = adj.get(curr) || [];
        for (let i = neighbors.length - 1; i >= 0; i--) {
          const edge = neighbors[i];
          if (!visited.has(edge.to)) {
            stack.push(edge.to);
            steps.push({
              step: stepCount++,
              action: 'PUSH_NEIGHBOR',
              node: edge.to,
              activeEdge: { from: curr, to: edge.to },
              stack: [...stack],
              visited: Array.from(visited),
              explanation: `Pushed unvisited neighbor ${edge.to} onto stack.`
            });
          }
        }
      }
    }

    summary = { visitedCount: visited.size, order: Array.from(visited) };
  } else if (algorithm === 'dijkstra') {
    const dist = new Map();
    const prev = new Map();
    for (const n of nodes) dist.set(n.id, Infinity);
    dist.set(startNode, 0);

    const pq = new PriorityQueue((a, b) => a.cost - b.cost);
    pq.push({ id: startNode, cost: 0 });

    let stepCount = 1;
    steps.push({
      step: stepCount++,
      action: 'INITIALIZE',
      node: startNode,
      distances: Object.fromEntries(dist),
      heapState: [{ id: startNode, cost: 0 }],
      explanation: `Initialized Dijkstra. Source ${startNode} has cost 0. All other nodes initialized to Infinity.`
    });

    const visited = new Set();

    while (!pq.isEmpty()) {
      const top = pq.pop();
      const u = top.id;
      if (visited.has(u)) continue;
      visited.add(u);

      steps.push({
        step: stepCount++,
        action: 'POP_MIN_HEAP',
        node: u,
        cost: top.cost,
        distances: Object.fromEntries(dist),
        heapState: [...pq.heap],
        visited: Array.from(visited),
        explanation: `Popped node ${u} with minimum cumulative cost ${top.cost.toFixed(2)} from priority queue.`
      });

      for (const edge of adj.get(u) || []) {
        const v = edge.to;
        const w = Number(edge.weight || 1.0);
        const alt = dist.get(u) + w;

        if (alt < dist.get(v)) {
          dist.set(v, alt);
          prev.set(v, u);
          pq.push({ id: v, cost: alt });
          steps.push({
            step: stepCount++,
            action: 'RELAX_EDGE',
            node: v,
            activeEdge: { from: u, to: v, weight: w },
            distances: Object.fromEntries(dist),
            heapState: [...pq.heap],
            explanation: `Relaxed edge (${u} → ${v}): updated dist[${v}] from Infinity to ${alt.toFixed(2)}. Pushed to priority queue.`
          });
        }
      }
    }

    const path = [];
    let cur = targetNode;
    while (cur) {
      path.unshift(cur);
      cur = prev.get(cur);
    }

    summary = {
      path,
      targetDistance: dist.get(targetNode),
      distances: Object.fromEntries(dist)
    };
  } else if (algorithm === 'priority-queue') {
    const pq = new PriorityQueue((a, b) => a.val - b.val);
    const elementsToInsert = nodes.map((n, i) => ({ id: n.id, val: n.risk || (i + 1) * 15 }));
    let stepCount = 1;

    for (const item of elementsToInsert) {
      pq.push(item);
      steps.push({
        step: stepCount++,
        action: 'HEAP_INSERT',
        node: item.id,
        insertedVal: item.val,
        heapArray: [...pq.heap],
        heapSize: pq.size(),
        explanation: `Inserted ${item.id} (priority: ${item.val}). Sifted up to preserve min-heap invariant.`
      });
    }

    const extracted = [];
    while (!pq.isEmpty()) {
      const top = pq.pop();
      extracted.push(top);
      steps.push({
        step: stepCount++,
        action: 'HEAP_EXTRACT_MIN',
        node: top.id,
        extractedVal: top.val,
        heapArray: [...pq.heap],
        heapSize: pq.size(),
        explanation: `Extracted minimum element ${top.id} (${top.val}). Replaced root with last leaf and sifted down.`
      });
    }

    summary = { sortedByPriority: extracted };
  } else if (algorithm === 'union-find' || algorithm === 'connected-components') {
    const uf = new UnionFind(nodes.map(n => n.id));
    let stepCount = 1;

    steps.push({
      step: stepCount++,
      action: 'INITIALIZE_DISJOINT_SETS',
      parentTable: Object.fromEntries(uf.parent),
      rankTable: Object.fromEntries(uf.rank),
      componentCount: uf.numComponents,
      explanation: `Initialized ${nodes.length} singleton disjoint sets. Each element is its own root.`
    });

    for (const edge of edges) {
      const rootU = uf.find(edge.from);
      const rootV = uf.find(edge.to);
      const merged = uf.union(edge.from, edge.to);

      steps.push({
        step: stepCount++,
        action: merged ? 'UNION_SETS' : 'ALREADY_CONNECTED',
        edge: { from: edge.from, to: edge.to },
        rootA: rootU,
        rootB: rootV,
        parentTable: Object.fromEntries(uf.parent),
        componentCount: uf.numComponents,
        explanation: merged
          ? `Union(${edge.from}, ${edge.to}): Merged root ${rootU} with ${rootV} by rank. Component count reduced to ${uf.numComponents}.`
          : `Nodes ${edge.from} and ${edge.to} already share root ${rootU}. No union needed.`
      });
    }

    const groups = {};
    for (const n of nodes) {
      const root = uf.find(n.id);
      if (!groups[root]) groups[root] = [];
      groups[root].push(n.id);
    }

    summary = {
      finalComponentCount: uf.numComponents,
      components: Object.values(groups)
    };
  } else if (algorithm === 'top-k') {
    const pq = new PriorityQueue((a, b) => a.risk - b.risk);
    let stepCount = 1;

    for (const n of nodes) {
      const risk = n.risk || 50;
      if (pq.size() < k) {
        pq.push({ id: n.id, risk });
        steps.push({
          step: stepCount++,
          action: 'HEAP_FILL',
          node: n.id,
          risk,
          heap: [...pq.heap],
          explanation: `Heap size < K (${k}). Pushed ${n.id} with risk ${risk}.`
        });
      } else if (risk > pq.peek().risk) {
        const discarded = pq.pop();
        pq.push({ id: n.id, risk });
        steps.push({
          step: stepCount++,
          action: 'REPLACE_MIN',
          node: n.id,
          risk,
          discarded: discarded.id,
          heap: [...pq.heap],
          explanation: `Node ${n.id} (risk: ${risk}) is greater than root ${discarded.id} (risk: ${discarded.risk}). Discarded root and sifted down ${n.id}.`
        });
      } else {
        steps.push({
          step: stepCount++,
          action: 'IGNORE_LESSER',
          node: n.id,
          risk,
          minCurrent: pq.peek().risk,
          heap: [...pq.heap],
          explanation: `Node ${n.id} risk (${risk}) is not greater than heap min (${pq.peek().risk}). Ignored.`
        });
      }
    }

    const topKList = [];
    while (!pq.isEmpty()) topKList.unshift(pq.pop());
    summary = { topK: topKList };
  } else if (algorithm === 'cycle-detection') {
    const cycleRes = detectCycles(nodes, edges);
    steps.push(...cycleRes.steps);
    summary = {
      hasCycle: cycleRes.hasCycle,
      cycleCount: cycleRes.cycleCount,
      cycles: cycleRes.cycles
    };
  } else if (algorithm === 'tarjan-scc') {
    const sccRes = tarjanSCC(nodes, edges);
    steps.push(...sccRes.steps);
    summary = {
      sccCount: sccRes.sccCount,
      components: sccRes.components,
      nonTrivialSccs: sccRes.nonTrivialSccs
    };
  } else if (algorithm === 'pagerank') {
    const prRes = computePageRank(nodes, edges, { damping });
    steps.push(...prRes.steps);
    summary = {
      converged: prRes.converged,
      iterations: prRes.iterations,
      ranks: prRes.ranks
    };
  } else if (algorithm === 'topological-sort') {
    const topoRes = topologicalSortKahn(nodes, edges);
    steps.push(...topoRes.steps);
    summary = {
      isDAG: topoRes.isDAG,
      order: topoRes.order,
      hasCycles: topoRes.hasCycles
    };
  } else if (algorithm === 'a-star') {
    const aStarRes = aStarSearch(nodes, edges, startNode, targetNode);
    steps.push(...aStarRes.steps);
    summary = {
      found: aStarRes.found,
      hops: aStarRes.hops,
      cost: aStarRes.cost,
      path: aStarRes.path
    };
  } else {
    // Default fallback
    steps.push({ step: 1, action: 'DEFAULT', explanation: `Simulation ready for ${catalogEntry.name}.` });
    summary = { completed: true };
  }

  return {
    algorithm,
    name: catalogEntry.name,
    category: catalogEntry.category,
    timeComplexity: catalogEntry.timeComplexity,
    spaceComplexity: catalogEntry.spaceComplexity,
    concept: catalogEntry.concept,
    pseudocode: catalogEntry.pseudocode,
    whyInCyberTrace: catalogEntry.whyInCyberTrace,
    realApplication: catalogEntry.realApplication,
    graph: { nodes, edges },
    steps,
    totalSteps: steps.length,
    summary
  };
}
