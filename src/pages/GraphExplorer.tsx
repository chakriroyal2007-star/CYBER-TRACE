import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Activity, ArrowDownLeft, ArrowRight, ArrowUpRight, CheckCircle2, ChevronRight,
  Copy, Expand, Filter, GitBranch, Layers, Link2, LoaderCircle, Minus,
  Network, Play, Plus, RefreshCw, RotateCcw, Route, Search, ShieldAlert,
  ShieldCheck, Sparkles, Target, Zap, Clock, AlertTriangle, Eye
} from 'lucide-react';
import { api, navigate, shortAddress } from '../api';
import '../workspace.css';

interface NodeData {
  id: string;
  label: string;
  timeStep: number | null;
  knownLabel: 'illicit' | 'licit' | 'unknown';
  predictedClass: string;
  probability: number;
  riskScore: number;
  inDegree: number;
  outDegree: number;
  depth?: number;
  isCenter?: boolean;
  x?: number;
  y?: number;
}

interface EdgeData {
  id: string;
  source: string;
  target: string;
  highlighted?: boolean;
}

interface DatasetStats {
  totalNodes: number;
  totalEdges: number;
  classes: { illicit: number; licit: number; unknown: number };
  inMemoryNodes?: number;
}

const PRESET_TXS = [
  { id: '232629023', label: 'Tx 232629023', type: 'illicit', desc: 'Confirmed Illicit (Risk 85/100)' },
  { id: '232438397', label: 'Tx 232438397', type: 'illicit', desc: 'Confirmed Illicit (Risk 85/100)' },
  { id: '232042459', label: 'Tx 232042459', type: 'illicit', desc: 'Confirmed Illicit (TimeStep 36)' },
  { id: '232840507', label: 'Tx 232840507', type: 'illicit', desc: 'Confirmed Illicit (TimeStep 37)' },
  { id: '230425980', label: 'Tx 230425980', type: 'licit', desc: 'Verified Licit Exchange Node' },
  { id: '230425981', label: 'Tx 230425981', type: 'licit', desc: 'Verified Licit (Risk 20/100)' },
  { id: '1076', label: 'Tx 1076', type: 'unknown', desc: 'Unlabeled Research Node (Step 13)' },
];

export default function GraphExplorer({ initialTxId = '232629023' }: { initialTxId?: string }) {
  const [currentTxId, setCurrentTxId] = useState(initialTxId);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Graph state
  const [nodes, setNodes] = useState<NodeData[]>([]);
  const [edges, setEdges] = useState<EdgeData[]>([]);
  const [stats, setStats] = useState<DatasetStats | null>(null);
  const [selectedNode, setSelectedNode] = useState<NodeData | null>(null);
  const [selectedEdge, setSelectedEdge] = useState<EdgeData | null>(null);

  // Pathfinding & algorithms state
  const [sourceTx, setSourceTx] = useState(initialTxId);
  const [targetTx, setTargetTx] = useState('231573972');
  const [weightType, setWeightType] = useState<'hop' | 'time' | 'risk'>('hop');
  const [bfsDepth, setBfsDepth] = useState(3);
  const [algoRunning, setAlgoRunning] = useState(false);
  const [pathResult, setPathResult] = useState<any>(null);
  const [topSuspicious, setTopSuspicious] = useState<any[]>([]);
  const [showTopModal, setShowTopModal] = useState(false);
  const [temporalBursts, setTemporalBursts] = useState<any>(null);
  const [showBurstModal, setShowBurstModal] = useState(false);

  // Canvas zoom & pan
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [hoveredNode, setHoveredNode] = useState<NodeData | null>(null);
  const dragRef = useRef<{ x: number; y: number; px: number; py: number } | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);

  const notify = (message: string, type = 'success') =>
    window.dispatchEvent(new CustomEvent('toast', { detail: { message, type } }));

  // Load dataset stats once
  useEffect(() => {
    api<DatasetStats>('/dataset/stats')
      .then(s => setStats(s))
      .catch(() => {});
  }, []);

  // Load subgraph for currentTxId
  const loadGraph = async (txId: string) => {
    setLoading(true);
    setError('');
    setPathResult(null);
    try {
      const res = await api(`/analytics/subgraph?txId=${encodeURIComponent(txId)}&depth=2&limit=50`);
      if (!res.found || !res.nodes?.length) {
        // Fallback to transaction endpoint if subgraph not found
        const tx = await api(`/transactions/${encodeURIComponent(txId)}`);
        if (tx.found) {
          const center: NodeData = {
            id: tx.txId,
            label: `Tx ${tx.txId}`,
            timeStep: tx.timeStep,
            knownLabel: tx.knownLabel,
            predictedClass: tx.modelPrediction,
            probability: tx.modelConfidence / 100,
            riskScore: tx.riskScore,
            inDegree: tx.graphFindings?.inDegree || 0,
            outDegree: tx.graphFindings?.outDegree || 0,
            isCenter: true
          };
          const neighbors: NodeData[] = [
            ...(tx.graphFindings?.incomingTransactions || []).map((id: string) => ({
              id,
              label: `Tx ${id}`,
              timeStep: tx.timeStep,
              knownLabel: 'unknown' as const,
              predictedClass: 'licit',
              probability: 0.5,
              riskScore: 50,
              inDegree: 0,
              outDegree: 1
            })),
            ...(tx.graphFindings?.outgoingTransactions || []).map((id: string) => ({
              id,
              label: `Tx ${id}`,
              timeStep: tx.timeStep,
              knownLabel: 'unknown' as const,
              predictedClass: 'licit',
              probability: 0.5,
              riskScore: 50,
              inDegree: 1,
              outDegree: 0
            }))
          ];
          const newEdges: EdgeData[] = [
            ...(tx.graphFindings?.incomingTransactions || []).map((inId: string) => ({
              id: `E-${inId}->${tx.txId}`,
              source: inId,
              target: tx.txId,
              highlighted: false
            })),
            ...(tx.graphFindings?.outgoingTransactions || []).map((outId: string) => ({
              id: `E-${tx.txId}->${outId}`,
              source: tx.txId,
              target: outId,
              highlighted: false
            }))
          ];
          setNodes([center, ...neighbors]);
          setEdges(newEdges);
          setSelectedNode(center);
          setSourceTx(tx.txId);
          if (neighbors.length > 0) setTargetTx(neighbors[0].id);
          return;
        }
        setError(`Transaction ${txId} was not found in the Elliptic Research Dataset.`);
        return;
      }

      setNodes(res.nodes);
      setEdges(res.edges.map((e: any) => ({ ...e, highlighted: false })));
      const center = res.nodes.find((n: any) => n.id === txId) || res.nodes[0];
      setSelectedNode(center);
      setSourceTx(txId);

      // Select first reachable outgoing neighbor as default target
      const outEdge = res.edges.find((e: any) => e.source === txId);
      if (outEdge) {
        setTargetTx(outEdge.target);
      } else {
        const other = res.nodes.find((n: any) => n.id !== txId);
        if (other) setTargetTx(other.id);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to retrieve transaction graph.');
    } finally {
      setLoading(false);
      setZoom(1);
      setPan({ x: 0, y: 0 });
    }
  };

  useEffect(() => {
    loadGraph(currentTxId);
  }, [currentTxId]);

  // Reachable downstream targets from sourceTx within the current graph
  const downstreamTargets = useMemo(() => {
    const list: { id: string; hops: number; label: string; risk: number }[] = [];
    const seen = new Set<string>([sourceTx]);
    const queue: { id: string; d: number }[] = [{ id: sourceTx, d: 0 }];

    while (queue.length > 0) {
      const { id, d } = queue.shift()!;
      if (d > 0) {
        const node = nodes.find(n => n.id === id);
        list.push({
          id,
          hops: d,
          label: node?.knownLabel || 'unknown',
          risk: node?.riskScore ?? 50
        });
      }
      if (d < 5) {
        for (const e of edges.filter(e => e.source === id)) {
          if (!seen.has(e.target)) {
            seen.add(e.target);
            queue.push({ id: e.target, d: d + 1 });
          }
        }
      }
    }
    return list;
  }, [sourceTx, edges, nodes]);

  // Compute Layout for Nodes
  const layout = useMemo(() => {
    if (!nodes.length) return { nodes: [], map: new Map<string, NodeData & { x: number; y: number }>() };

    const arranged: (NodeData & { x: number; y: number })[] = [];
    const map = new Map<string, NodeData & { x: number; y: number }>();

    // 1. If Dijkstra or BFS found a directed path of >= 2 nodes, arrange the path horizontally
    if (pathResult?.path && pathResult.path.length > 1) {
      const pathSet = new Set(pathResult.path);
      const pathNodes = pathResult.path.map((pid: string) => nodes.find(n => n.id === pid) || {
        id: pid,
        label: `Tx ${pid}`,
        timeStep: null,
        knownLabel: 'unknown' as const,
        predictedClass: 'licit',
        probability: 0.5,
        riskScore: 50,
        inDegree: 1,
        outDegree: 1
      });

      const totalHops = pathNodes.length - 1;
      pathNodes.forEach((n: any, idx: number) => {
        const x = 160 + (idx / Math.max(1, totalHops)) * 720;
        const y = 220;
        arranged.push({ ...n, x, y, isCenter: idx === 0 });
      });

      // Place other non-path nodes above and below the path line
      const nonPathNodes = nodes.filter(n => !pathSet.has(n.id));
      nonPathNodes.forEach((n, idx) => {
        const isTop = idx % 2 === 0;
        const col = Math.floor(idx / 2);
        arranged.push({
          ...n,
          x: 140 + (col % 6) * 150,
          y: isTop ? Math.max(40, 90 - Math.floor(col / 6) * 60) : Math.min(400, 340 + Math.floor(col / 6) * 60)
        });
      });

      arranged.forEach(n => map.set(n.id, n));
      return { nodes: arranged, map };
    }

    // 2. If BFS downstream exploration without single target (tree layout)
    if (pathResult?.algo === 'bfs' && pathResult.visitedNodes?.length > 1) {
      const depthGroups = new Map<number, NodeData[]>();
      nodes.forEach(n => {
        const v = pathResult.visitedNodes.find((vn: any) => vn.txId === n.id);
        const d = v ? v.depth : (n.id === sourceTx ? 0 : 1);
        if (!depthGroups.has(d)) depthGroups.set(d, []);
        depthGroups.get(d)!.push(n);
      });

      const maxD = Math.max(...Array.from(depthGroups.keys()), 1);
      depthGroups.forEach((groupNodes, depth) => {
        const x = 140 + (depth / Math.max(1, maxD)) * 760;
        groupNodes.forEach((n, idx) => {
          const step = 340 / Math.max(groupNodes.length + 1, 2);
          const y = 50 + (idx + 1) * step;
          arranged.push({ ...n, x, y, isCenter: depth === 0 });
        });
      });

      arranged.forEach(n => map.set(n.id, n));
      return { nodes: arranged, map };
    }

    // 3. Default Center + Counterparty Neighbor Layout
    const centerNode = nodes.find(n => n.id === currentTxId) || nodes[0];
    const incomingIds = new Set(edges.filter(e => e.target === centerNode.id).map(e => e.source));
    const outgoingIds = new Set(edges.filter(e => e.source === centerNode.id).map(e => e.target));
    const otherNodes = nodes.filter(n => n.id !== centerNode.id && !incomingIds.has(n.id) && !outgoingIds.has(n.id));

    // Center node in middle
    arranged.push({ ...centerNode, x: 525, y: 220, isCenter: true });

    // Incoming nodes on the left column
    const inList = nodes.filter(n => incomingIds.has(n.id));
    inList.forEach((n, idx) => {
      const step = 360 / Math.max(inList.length + 1, 2);
      arranged.push({ ...n, x: 220, y: 50 + (idx + 1) * step });
    });

    // Outgoing nodes on the right column
    const outList = nodes.filter(n => outgoingIds.has(n.id));
    outList.forEach((n, idx) => {
      const step = 360 / Math.max(outList.length + 1, 2);
      arranged.push({ ...n, x: 830, y: 50 + (idx + 1) * step });
    });

    // Outer 2-hop nodes on the far left and far right
    otherNodes.forEach((n, idx) => {
      const isLeft = idx % 2 === 0;
      arranged.push({
        ...n,
        x: isLeft ? 80 : 970,
        y: 60 + Math.floor(idx / 2) * 80
      });
    });

    arranged.forEach(n => map.set(n.id, n));
    return { nodes: arranged, map };
  }, [nodes, edges, currentTxId, pathResult, sourceTx]);

  // Dijkstra Shortest Path execution
  const handleRunDijkstra = async (overrideTarget?: string, overrideWeight?: 'hop' | 'time' | 'risk') => {
    const tgt = (overrideTarget || targetTx).trim();
    const wt = overrideWeight || weightType;
    if (!sourceTx.trim() || !tgt || algoRunning) return;
    setAlgoRunning(true);
    setPathResult(null);
    try {
      const res = await api(`/analytics/dijkstra?start=${encodeURIComponent(sourceTx.trim())}&target=${encodeURIComponent(tgt)}&weight=${wt}`);
      setPathResult({
        ...res,
        algo: 'dijkstra',
        chosenWeight: wt
      });

      if (res.found && res.path?.length) {
        // Highlight path edges in graph
        const pathSet = new Set<string>();
        for (let i = 0; i < res.path.length - 1; i++) {
          pathSet.add(`${res.path[i]}->${res.path[i + 1]}`);
        }

        // Add any missing path nodes into graph
        const existingNodeIds = new Set(nodes.map(n => n.id));
        const newNodes = [...nodes];
        const newEdges = [...edges];

        for (let i = 0; i < res.path.length; i++) {
          const pId = res.path[i];
          if (!existingNodeIds.has(pId)) {
            newNodes.push({
              id: pId,
              label: `Tx ${pId}`,
              timeStep: null,
              knownLabel: 'unknown',
              predictedClass: 'licit',
              probability: 0.5,
              riskScore: 50,
              inDegree: 1,
              outDegree: 1
            });
            existingNodeIds.add(pId);
          }
          if (i > 0) {
            const prevId = res.path[i - 1];
            const edgeExists = newEdges.some(e => e.source === prevId && e.target === pId);
            if (!edgeExists) {
              newEdges.push({
                id: `PATH-${prevId}->${pId}`,
                source: prevId,
                target: pId,
                highlighted: true
              });
            }
          }
        }

        // Update highlight status of all edges
        const updatedEdges = newEdges.map(e => ({
          ...e,
          highlighted: pathSet.has(`${e.source}->${e.target}`)
        }));

        setNodes(newNodes);
        setEdges(updatedEdges);
        notify(res.explanation || `Shortest path found: ${res.hops} hops | Cost: ${res.cumulativeCost} (${res.traversalTimeMs}ms)`);
      } else {
        notify(res.explanation || 'No directed path found between these transactions.', 'info');
      }
    } catch (err) {
      notify(err instanceof Error ? err.message : 'Dijkstra execution failed.', 'error');
    } finally {
      setAlgoRunning(false);
    }
  };

  // BFS Downstream execution
  const handleRunBfs = async () => {
    if (!sourceTx.trim() || algoRunning) return;
    setAlgoRunning(true);
    setPathResult(null);
    try {
      const url = targetTx.trim()
        ? `/analytics/bfs?start=${encodeURIComponent(sourceTx.trim())}&target=${encodeURIComponent(targetTx.trim())}&depth=${bfsDepth}&limit=50`
        : `/analytics/bfs?start=${encodeURIComponent(sourceTx.trim())}&depth=${bfsDepth}&limit=50`;
      const res = await api(url);
      setPathResult({
        ...res,
        algo: 'bfs'
      });

      const visited = res.visitedNodes || res.reachableNodes || [];
      if (visited.length > 0) {
        // Expand nodes and edges
        const existingNodeIds = new Set(nodes.map(n => n.id));
        const newNodes = [...nodes];
        const newEdges = [...edges];

        for (const item of visited) {
          if (!existingNodeIds.has(item.txId)) {
            newNodes.push({
              id: item.txId,
              label: `Tx ${item.txId}`,
              timeStep: item.timeStep,
              knownLabel: item.label || 'unknown',
              predictedClass: item.predictedClass || (item.label === 'illicit' ? 'illicit' : 'licit'),
              probability: item.label === 'illicit' ? 0.9 : 0.2,
              riskScore: item.riskScore || (item.label === 'illicit' ? 90 : 30),
              inDegree: 1,
              outDegree: 0,
              depth: item.depth
            });
            existingNodeIds.add(item.txId);
          }
          if (item.parentTxId) {
            const edgeExists = newEdges.some(e => e.source === item.parentTxId && e.target === item.txId);
            if (!edgeExists) {
              newEdges.push({
                id: `BFS-${item.parentTxId}->${item.txId}`,
                source: item.parentTxId,
                target: item.txId,
                highlighted: true
              });
            }
          }
        }

        // If BFS path was found to target, highlight that specific path
        if (res.found && res.path?.length > 1) {
          const pathSet = new Set<string>();
          for (let i = 0; i < res.path.length - 1; i++) {
            pathSet.add(`${res.path[i]}->${res.path[i + 1]}`);
          }
          for (const e of newEdges) {
            if (pathSet.has(`${e.source}->${e.target}`)) {
              e.highlighted = true;
            }
          }
        }

        setNodes(newNodes);
        setEdges(newEdges);
        notify(res.explanation || `BFS complete: ${visited.length} transactions explored (${res.traversalTimeMs}ms)`);
      } else {
        notify(res.explanation || 'No reachable transactions discovered.', 'info');
      }
    } catch (err) {
      notify(err instanceof Error ? err.message : 'BFS traversal failed.', 'error');
    } finally {
      setAlgoRunning(false);
    }
  };

  // Load Top Suspicious
  const handleLoadTopSuspicious = async () => {
    try {
      const res = await api('/analytics/top-suspicious?k=15');
      setTopSuspicious(res.topSuspicious || []);
      setShowTopModal(true);
    } catch (err) {
      notify('Could not load top suspicious list.', 'error');
    }
  };

  // Load Temporal Bursts
  const handleLoadTemporalBursts = async () => {
    try {
      const res = await api('/analytics/temporal?window=3&threshold=1.3');
      setTemporalBursts(res);
      setShowBurstModal(true);
    } catch (err) {
      notify('Could not load temporal burst analysis.', 'error');
    }
  };

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const clean = searchQuery.trim();
    if (!clean) return;
    setCurrentTxId(clean);
  };

  const zoomBy = (factor: number) => setZoom(z => Math.max(0.4, Math.min(3.5, z * factor)));

  const handleNodeClick = (node: NodeData) => {
    setSelectedNode(node);
    setSelectedEdge(null);
  };

  const handleEdgeClick = (edge: EdgeData) => {
    setSelectedEdge(edge);
    setSelectedNode(null);
  };

  const copy = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      notify('Copied transaction ID');
    } catch {}
  };

  return (
    <div className="investigation-page" style={{ padding: '1rem 1.5rem', minHeight: '100vh', background: '#070f18' }}>
      {/* 1. Header with Live Dataset Telemetry */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', flexWrap: 'wrap', gap: '0.8rem' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '11px', color: '#6882a0', fontWeight: 600, letterSpacing: '0.5px' }}>
            <Network size={14} style={{ color: '#4fd7c1' }} />
            <span>TRANSACTION GRAPH FORENSICS · REAL DATASET DSA ENGINE</span>
            <span style={{ background: '#13283f', color: '#56c8b2', padding: '2px 8px', borderRadius: '4px', fontSize: '10px' }}>
              ELLIPTIC BENCHMARK
            </span>
          </div>
          <h1 style={{ margin: '0.2rem 0', fontSize: '1.6rem', color: '#ffffff', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
            Bitcoin Flow Visualizer
            <span style={{ fontSize: '12px', background: '#1c2e44', color: '#a0b9d6', padding: '3px 10px', borderRadius: '12px', fontWeight: 500 }}>
              {nodes.length} Visible Nodes · {edges.length} Directed Transfers
            </span>
          </h1>
          <p style={{ margin: 0, color: '#7a92ad', fontSize: '12px' }}>
            Direct adjacency graph of Bitcoin transaction dependencies. Nodes model transaction hashes (V = 203,769, E = 234,355).
          </p>
        </div>

        {/* Global Dataset Stats Counter Badges */}
        <div style={{ display: 'flex', gap: '0.6rem', flexWrap: 'wrap' }}>
          <div style={{ background: '#111f30', border: '1px solid #1f344e', borderRadius: '8px', padding: '6px 12px', fontSize: '12px' }}>
            <span style={{ color: '#8ca1b8', display: 'block', fontSize: '10px' }}>TOTAL NODES (V)</span>
            <strong style={{ color: '#fff', fontSize: '14px' }}>{stats?.totalNodes?.toLocaleString() || '203,769'}</strong>
          </div>
          <div style={{ background: '#111f30', border: '1px solid #1f344e', borderRadius: '8px', padding: '6px 12px', fontSize: '12px' }}>
            <span style={{ color: '#8ca1b8', display: 'block', fontSize: '10px' }}>TOTAL EDGES (E)</span>
            <strong style={{ color: '#fff', fontSize: '14px' }}>{stats?.totalEdges?.toLocaleString() || '234,355'}</strong>
          </div>
          <div style={{ background: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.3)', borderRadius: '8px', padding: '6px 12px', fontSize: '12px' }}>
            <span style={{ color: '#f87171', display: 'block', fontSize: '10px' }}>🔴 ILLICIT NODES</span>
            <strong style={{ color: '#fca5a5', fontSize: '14px' }}>4,545</strong>
          </div>
          <div style={{ background: 'rgba(16, 185, 129, 0.1)', border: '1px solid rgba(16, 185, 129, 0.3)', borderRadius: '8px', padding: '6px 12px', fontSize: '12px' }}>
            <span style={{ color: '#34d399', display: 'block', fontSize: '10px' }}>🟢 LICIT NODES</span>
            <strong style={{ color: '#6ee7b7', fontSize: '14px' }}>42,019</strong>
          </div>
          <button className="ws-btn" onClick={handleLoadTopSuspicious} style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '12px' }}>
            <AlertTriangle size={13} style={{ color: '#f59e0b' }} /> Top Suspicious
          </button>
          <button className="ws-btn" onClick={handleLoadTemporalBursts} style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '12px' }}>
            <Clock size={13} style={{ color: '#38bdf8' }} /> Sliding Window
          </button>
        </div>
      </div>

      {/* 2. Quick Preset Chips & Search Bar */}
      <div style={{ background: '#0e1927', border: '1px solid #1b2e45', borderRadius: '8px', padding: '8px 12px', marginBottom: '1rem', display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: '0.6rem' }}>
        <span style={{ fontSize: '12px', color: '#7a92ad', fontWeight: 600 }}>QUICK LOAD TX:</span>
        {PRESET_TXS.map(p => (
          <button
            key={p.id}
            className={`ws-btn ${currentTxId === p.id ? 'primary' : ''}`}
            style={{ padding: '4px 10px', fontSize: '11px', display: 'flex', alignItems: 'center', gap: '4px' }}
            onClick={() => setCurrentTxId(p.id)}
            title={p.desc}
          >
            <span>{p.type === 'illicit' ? '🔴' : p.type === 'licit' ? '🟢' : '⚪'}</span>
            <strong>{p.id}</strong>
          </button>
        ))}

        {/* Search Input for Any of the 203k nodes */}
        <form onSubmit={handleSearchSubmit} style={{ display: 'flex', gap: '4px', marginLeft: 'auto' }}>
          <input
            style={{ background: '#142233', border: '1px solid #23374f', borderRadius: '4px', color: '#fff', padding: '4px 8px', fontSize: '12px', width: '200px' }}
            placeholder="Search any Tx ID (e.g. 232629023)…"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
          />
          <button type="submit" className="ws-btn primary" style={{ padding: '4px 12px', fontSize: '12px' }}>
            Inspect
          </button>
        </form>
      </div>

      {/* 3. Algorithm Execution Toolbar */}
      <div style={{ background: '#0b1623', border: '1px solid #1a2c41', borderRadius: '8px', padding: '10px 14px', marginBottom: '1rem', display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: '0.8rem', fontSize: '12px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '4px', color: '#4fd7c1', fontWeight: 600 }}>
          <Zap size={14} />
          <span>DIJKSTRA & BFS TRACER:</span>
        </div>

        {/* Source Tx Input */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
          <span style={{ color: '#8ca1b8', fontSize: '11px' }}>Source:</span>
          <input
            style={{ background: '#122030', border: '1px solid #24384e', borderRadius: '4px', color: '#fff', padding: '3px 8px', fontSize: '11px', width: '110px' }}
            value={sourceTx}
            onChange={e => setSourceTx(e.target.value)}
          />
        </div>

        {/* Target Tx Input */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
          <span style={{ color: '#8ca1b8', fontSize: '11px' }}>Target:</span>
          <input
            style={{ background: '#122030', border: '1px solid #24384e', borderRadius: '4px', color: '#fff', padding: '3px 8px', fontSize: '11px', width: '110px' }}
            value={targetTx}
            onChange={e => setTargetTx(e.target.value)}
          />
        </div>

        {/* Weight Selector */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
          <span style={{ color: '#8ca1b8', fontSize: '11px' }}>Weight:</span>
          <select
            style={{ background: '#122030', border: '1px solid #24384e', borderRadius: '4px', color: '#fff', padding: '3px 6px', fontSize: '11px' }}
            value={weightType}
            onChange={e => setWeightType(e.target.value as any)}
          >
            <option value="hop">Hop Count (Uniform = 1.0)</option>
            <option value="time">Time Step Gap (|Δt| + 1.0)</option>
            <option value="risk">Risk-Weighted (Prioritize High Risk)</option>
          </select>
        </div>

        {/* Run Dijkstra Button */}
        <button
          className="ws-btn primary"
          style={{ padding: '4px 12px', fontSize: '11px', display: 'flex', alignItems: 'center', gap: '4px' }}
          disabled={algoRunning}
          onClick={() => handleRunDijkstra()}
        >
          {algoRunning ? <LoaderCircle size={12} className="ws-spin" /> : <Play size={11} />}
          <strong>Run Dijkstra (Priority Queue)</strong>
        </button>

        {/* Run BFS Button */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
          <span style={{ color: '#8ca1b8', fontSize: '11px' }}>BFS Depth:</span>
          <select
            style={{ background: '#122030', border: '1px solid #24384e', borderRadius: '4px', color: '#fff', padding: '3px 6px', fontSize: '11px' }}
            value={bfsDepth}
            onChange={e => setBfsDepth(Number(e.target.value))}
          >
            <option value={1}>1 Hop</option>
            <option value={2}>2 Hops</option>
            <option value={3}>3 Hops</option>
            <option value={5}>5 Hops</option>
          </select>
          <button
            className="ws-btn"
            style={{ padding: '4px 10px', fontSize: '11px' }}
            disabled={algoRunning}
            onClick={handleRunBfs}
          >
            Run BFS
          </button>
        </div>

        {/* Path Result Summary Pill */}
        {pathResult && (
          <div style={{ marginLeft: 'auto', background: pathResult.found ? 'rgba(79, 215, 193, 0.15)' : 'rgba(239, 68, 68, 0.15)', border: `1px solid ${pathResult.found ? '#4fd7c1' : '#ef4444'}`, borderRadius: '6px', padding: '3px 10px', fontSize: '11px', color: pathResult.found ? '#4fd7c1' : '#fca5a5' }}>
            {pathResult.found
              ? `✓ ${pathResult.algo === 'bfs' ? 'BFS' : 'Dijkstra'}: ${pathResult.hops} hops | Cost: ${pathResult.cumulativeCost ?? pathResult.hops} (${pathResult.traversalTimeMs}ms)`
              : pathResult.explanation || 'No directed path found within bounds'}
          </div>
        )}

        {/* Reachable Targets Quick Select Bar */}
        {downstreamTargets.length > 0 && (
          <div style={{ width: '100%', display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap', paddingTop: '6px', borderTop: '1px solid #16263b', fontSize: '11px' }}>
            <span style={{ color: '#7a92ad', fontWeight: 600 }}>🎯 REACHABLE TARGETS:</span>
            {downstreamTargets.slice(0, 5).map(opt => (
              <button
                key={opt.id}
                className="ws-btn"
                style={{
                  padding: '2px 8px',
                  fontSize: '11px',
                  background: targetTx === opt.id ? '#1e3852' : '#101d2d',
                  borderColor: targetTx === opt.id ? '#4fd7c1' : '#23374e',
                  color: targetTx === opt.id ? '#4fd7c1' : '#cbd5e1'
                }}
                onClick={() => {
                  setTargetTx(opt.id);
                  handleRunDijkstra(opt.id);
                }}
                title={`Click to set target and trace path from ${sourceTx} to ${opt.id}`}
              >
                <span>{opt.label === 'illicit' ? '🔴' : opt.label === 'licit' ? '🟢' : '⚪'}</span>
                <strong>Tx {opt.id}</strong>
                <span style={{ color: '#6bb6d8', fontSize: '10px' }}>({opt.hops} hop{opt.hops > 1 ? 's' : ''})</span>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* 4. Main Two-Column Graph & Intelligence Workspace */}
      <div style={{ display: 'grid', gridTemplateColumns: selectedNode || selectedEdge ? '1fr 340px' : '1fr', gap: '1rem' }}>
        {/* Graph Canvas Panel */}
        <div className="ws-card" style={{ padding: 0, overflow: 'hidden', border: '1px solid #1a2c42', position: 'relative', background: '#0a1420' }}>
          {/* Top Canvas Bar */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 14px', borderBottom: '1px solid #16263b', background: '#09131e', fontSize: '12px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#a0b9d6' }}>
              <span className="ws-pulse" />
              <span>Center Focus: <strong style={{ color: '#fff' }}>Tx {currentTxId}</strong></span>
              <span style={{ color: '#5b7694' }}>·</span>
              <span style={{ color: '#7a96b5' }}>Scroll to zoom · Click node to inspect</span>
            </div>
            <div style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
              <button className="ws-btn" style={{ padding: '2px 8px', fontSize: '11px' }} onClick={() => zoomBy(0.8)} title="Zoom out"><Minus size={12} /></button>
              <span style={{ fontSize: '11px', color: '#7a96b5', padding: '0 4px' }}>{Math.round(zoom * 100)}%</span>
              <button className="ws-btn" style={{ padding: '2px 8px', fontSize: '11px' }} onClick={() => zoomBy(1.25)} title="Zoom in"><Plus size={12} /></button>
              <button className="ws-btn" style={{ padding: '2px 8px', fontSize: '11px' }} onClick={() => { setZoom(1); setPan({ x: 0, y: 0 }); }} title="Reset view"><RotateCcw size={12} /></button>
            </div>
          </div>

          {/* SVG Interactive Canvas */}
          {loading ? (
            <div style={{ height: '480px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '0.8rem', color: '#7a92ad' }}>
              <LoaderCircle size={32} className="ws-spin" style={{ color: '#4fd7c1' }} />
              <span>Constructing transaction subgraph from 203,769 nodes…</span>
            </div>
          ) : error ? (
            <div style={{ height: '480px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '0.8rem', color: '#f87171' }}>
              <ShieldAlert size={36} />
              <span>{error}</span>
              <button className="ws-btn" onClick={() => loadGraph('232629023')}>Load Default Illicit Tx 232629023</button>
            </div>
          ) : (
            <svg
              ref={svgRef}
              viewBox="0 0 1050 440"
              style={{ width: '100%', height: '480px', background: '#09131e', cursor: 'grab' }}
              onWheel={e => zoomBy(e.deltaY > 0 ? 0.92 : 1.08)}
              onPointerDown={e => {
                dragRef.current = { x: e.clientX, y: e.clientY, px: pan.x, py: pan.y };
                e.currentTarget.setPointerCapture(e.pointerId);
              }}
              onPointerMove={e => {
                if (!dragRef.current) return;
                const ratio = 1050 / (svgRef.current?.getBoundingClientRect().width || 1050);
                setPan({
                  x: dragRef.current.px + (e.clientX - dragRef.current.x) * ratio,
                  y: dragRef.current.py + (e.clientY - dragRef.current.y) * ratio
                });
              }}
              onPointerUp={() => { dragRef.current = null; }}
              onPointerCancel={() => { dragRef.current = null; }}
            >
              <defs>
                <pattern id="graph-grid" width="22" height="22" patternUnits="userSpaceOnUse">
                  <circle cx="1" cy="1" r="0.8" fill="#1b2a3d" />
                </pattern>
                <marker id="arrow-standard" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="5" markerHeight="5" orient="auto-start-reverse">
                  <path d="M0 0L10 5L0 10Z" fill="#3b526d" />
                </marker>
                <marker id="arrow-highlight" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
                  <path d="M0 0L10 5L0 10Z" fill="#4fd7c1" />
                </marker>
                <filter id="glow" x="-20%" y="-20%" width="140%" height="140%">
                  <feGaussianBlur stdDeviation="3" result="blur" />
                  <feComposite in="SourceGraphic" in2="blur" operator="over" />
                </filter>
              </defs>

              <rect width="1050" height="440" fill="url(#graph-grid)" />

              <g transform={`translate(${pan.x + 525} ${pan.y + 220}) scale(${zoom}) translate(-525 -220)`}>
                {/* Directed Edges */}
                {edges.map((edge, idx) => {
                  const source = layout.map.get(edge.source);
                  const target = layout.map.get(edge.target);
                  if (!source || !target) return null;

                  const dx = target.x - source.x;
                  const dy = target.y - source.y;
                  const d = Math.max(1, Math.hypot(dx, dy));
                  const x1 = source.x + (dx / d) * 24;
                  const y1 = source.y + (dy / d) * 24;
                  const x2 = target.x - (dx / d) * 26;
                  const y2 = target.y - (dy / d) * 26;

                  const isHigh = edge.highlighted;
                  const isSel = selectedEdge?.id === edge.id;
                  const path = `M${x1} ${y1} L${x2} ${y2}`;

                  return (
                    <g key={`${edge.id}-${idx}`} onClick={() => handleEdgeClick(edge)} style={{ cursor: 'pointer' }}>
                      {/* Transparent click target */}
                      <path d={path} stroke="transparent" strokeWidth="16" fill="none" />
                      {/* Line with arrowhead */}
                      <path
                        d={path}
                        fill="none"
                        stroke={isHigh ? '#4fd7c1' : isSel ? '#f59e0b' : '#2b4058'}
                        strokeWidth={isHigh ? 2.5 : isSel ? 2.5 : 1.2}
                        markerEnd={`url(#${isHigh ? 'arrow-highlight' : 'arrow-standard'})`}
                        strokeDasharray={isHigh ? '4 2' : undefined}
                      />
                    </g>
                  );
                })}

                {/* Transaction Nodes */}
                {layout.nodes.map(node => {
                  const isSel = selectedNode?.id === node.id;
                  const isCenter = node.id === currentTxId;
                  const isIllicit = node.knownLabel === 'illicit' || node.riskScore >= 70;
                  const isLicit = node.knownLabel === 'licit';

                  const nodeColor = isIllicit ? '#ef4444' : isLicit ? '#10b981' : '#64748b';
                  const fillBg = isCenter ? '#122538' : '#0e1c2b';

                  return (
                    <g
                      key={node.id}
                      transform={`translate(${node.x} ${node.y})`}
                      onClick={() => handleNodeClick(node)}
                      onMouseEnter={() => setHoveredNode(node)}
                      onMouseLeave={() => setHoveredNode(null)}
                      style={{ cursor: 'pointer' }}
                    >
                      {/* Halo for center node or selected node */}
                      {(isCenter || isSel) && (
                        <circle r="34" fill="none" stroke={isCenter ? '#4fd7c1' : '#f59e0b'} strokeWidth="1.5" strokeOpacity="0.4" strokeDasharray="3 3" />
                      )}

                      {/* Main node circle */}
                      <circle r="22" fill={fillBg} stroke={nodeColor} strokeWidth={isSel ? 2.5 : isCenter ? 2 : 1.4} />

                      {/* Risk score badge inside node */}
                      <text textAnchor="middle" y="4" fill={nodeColor} fontSize="10" fontWeight="700" fontFamily="sans-serif">
                        {node.riskScore}
                      </text>

                      {/* Node classification indicator dot */}
                      <circle cx="15" cy="-15" r="4" fill={nodeColor} stroke="#09131e" strokeWidth="1.5" />

                      {/* Tx ID label below */}
                      <rect x="-42" y="26" width="84" height="15" rx="3" fill="#09131e" fillOpacity="0.9" />
                      <text y="37" textAnchor="middle" fill={isSel ? '#ffffff' : '#94a3b8'} fontSize="9" fontWeight="600" fontFamily="monospace">
                        Tx {shortAddress(node.id, 4)}
                      </text>

                      {/* Label badge */}
                      <text y="50" textAnchor="middle" fill={nodeColor} fontSize="8" fontWeight="600" letterSpacing="0.5">
                        {node.knownLabel.toUpperCase()}
                      </text>
                    </g>
                  );
                })}

                {/* Hover Tooltip */}
                {hoveredNode && layout.map.get(hoveredNode.id) && (
                  <g transform={`translate(${layout.map.get(hoveredNode.id)!.x} ${layout.map.get(hoveredNode.id)!.y - 50})`} pointerEvents="none">
                    <rect x="-85" y="-20" width="170" height="36" rx="4" fill="#0f2236" stroke="#253e5b" />
                    <text y="-6" textAnchor="middle" fill="#fff" fontSize="10" fontWeight="600" fontFamily="monospace">
                      Tx {hoveredNode.id}
                    </text>
                    <text y="8" textAnchor="middle" fill={hoveredNode.knownLabel === 'illicit' ? '#f87171' : '#34d399'} fontSize="9">
                      {hoveredNode.knownLabel.toUpperCase()} · Risk {hoveredNode.riskScore}/100
                    </text>
                  </g>
                )}
              </g>
            </svg>
          )}

          {/* Canvas Footer Legend */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 14px', borderTop: '1px solid #16263b', background: '#09131e', fontSize: '11px', color: '#7a92ad' }}>
            <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                <i style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#ef4444', display: 'inline-block' }} /> 🔴 Illicit / High Risk (≥ 70)
              </span>
              <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                <i style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#10b981', display: 'inline-block' }} /> 🟢 Licit / Exchange (&lt; 40)
              </span>
              <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                <i style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#64748b', display: 'inline-block' }} /> ⚪ Unknown (40 - 69)
              </span>
              <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                <i style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#4fd7c1', display: 'inline-block' }} /> 🔵 Traced Path
              </span>
            </div>
            <span>Click any node to inspect intelligence or set path targets</span>
          </div>
        </div>

        {/* 5. Selected Node Intelligence Drawer */}
        {selectedNode && (
          <div className="ws-card" style={{ background: '#0d1825', border: '1px solid #1b2e45', padding: '1rem', display: 'flex', flexDirection: 'column', gap: '0.8rem', fontSize: '12px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #1a2c41', paddingBottom: '0.6rem' }}>
              <div>
                <span style={{ fontSize: '10px', color: '#64748b', fontWeight: 600 }}>TRANSACTION INTELLIGENCE</span>
                <h3 style={{ margin: 0, color: '#fff', fontSize: '15px', fontFamily: 'monospace', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  Tx {selectedNode.id}
                  <button className="ws-icon-button" onClick={() => copy(selectedNode.id)} title="Copy Tx ID"><Copy size={12} /></button>
                </h3>
              </div>
              <span style={{
                background: selectedNode.riskScore >= 70 ? 'rgba(239, 68, 68, 0.2)' : selectedNode.riskScore >= 40 ? 'rgba(245, 158, 11, 0.2)' : 'rgba(16, 185, 129, 0.2)',
                color: selectedNode.riskScore >= 70 ? '#f87171' : selectedNode.riskScore >= 40 ? '#fbbf24' : '#34d399',
                padding: '2px 8px', borderRadius: '4px', fontWeight: 600, fontSize: '11px'
              }}>
                {selectedNode.riskScore}/100 {selectedNode.riskScore >= 70 ? 'HIGH' : selectedNode.riskScore >= 40 ? 'MED' : 'LOW'}
              </span>
            </div>

            {/* Quick Metrics */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
              <div style={{ background: '#122030', padding: '6px 8px', borderRadius: '4px' }}>
                <span style={{ color: '#6882a0', fontSize: '10px', display: 'block' }}>GROUND TRUTH</span>
                <strong style={{ color: selectedNode.knownLabel === 'illicit' ? '#f87171' : selectedNode.knownLabel === 'licit' ? '#34d399' : '#94a3b8' }}>
                  {selectedNode.knownLabel.toUpperCase()}
                </strong>
              </div>
              <div style={{ background: '#122030', padding: '6px 8px', borderRadius: '4px' }}>
                <span style={{ color: '#6882a0', fontSize: '10px', display: 'block' }}>ML PREDICTION</span>
                <strong style={{ color: '#fff' }}>{selectedNode.predictedClass.toUpperCase()}</strong>
              </div>
              <div style={{ background: '#122030', padding: '6px 8px', borderRadius: '4px' }}>
                <span style={{ color: '#6882a0', fontSize: '10px', display: 'block' }}>IN / OUT DEGREE</span>
                <strong style={{ color: '#fff' }}>{selectedNode.inDegree} in · {selectedNode.outDegree} out</strong>
              </div>
              <div style={{ background: '#122030', padding: '6px 8px', borderRadius: '4px' }}>
                <span style={{ color: '#6882a0', fontSize: '10px', display: 'block' }}>TIME STEP</span>
                <strong style={{ color: '#fff' }}>{selectedNode.timeStep ?? 'Step 1'}</strong>
              </div>
            </div>

            {/* Graph Actions */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem', marginTop: '0.4rem' }}>
              <button
                className="ws-btn"
                style={{ justifyContent: 'center', fontSize: '11px' }}
                onClick={() => { setSourceTx(selectedNode.id); notify(`Set ${selectedNode.id} as Dijkstra source.`); }}
              >
                Set as Dijkstra Source
              </button>
              <button
                className="ws-btn"
                style={{ justifyContent: 'center', fontSize: '11px' }}
                onClick={() => { setTargetTx(selectedNode.id); notify(`Set ${selectedNode.id} as Dijkstra target.`); }}
              >
                Set as Dijkstra Target
              </button>
              <button
                className="ws-btn primary"
                style={{ justifyContent: 'center', fontSize: '11px' }}
                onClick={() => setCurrentTxId(selectedNode.id)}
              >
                Center & Expand Subgraph
              </button>
            </div>

            <div style={{ borderTop: '1px solid #1a2c41', paddingTop: '0.6rem', color: '#6882a0', fontSize: '11px' }}>
              <ShieldCheck size={12} style={{ verticalAlign: 'middle', marginRight: '4px' }} />
              Ground truth derived from Weber et al. Elliptic Research Dataset.
            </div>
          </div>
        )}
      </div>

      {/* 5. Algorithm Forensic Output & Route Cost Analysis Panel */}
      {pathResult && (
        <div className="ws-card" style={{ marginTop: '1rem', background: '#0b1624', border: '1px solid #1c324b', padding: '1.2rem', borderRadius: '8px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.8rem', borderBottom: '1px solid #1c324b', paddingBottom: '0.8rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <div style={{ background: '#16314f', padding: '6px', borderRadius: '6px', color: '#4fd7c1', display: 'flex' }}>
                <Zap size={18} />
              </div>
              <div>
                <h3 style={{ margin: 0, color: '#fff', fontSize: '15px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  {pathResult.algo === 'dijkstra' ? "Dijkstra's Shortest Path Traversal" : 'Breadth-First Search (BFS) Traversal'}
                  <span style={{ fontSize: '11px', background: pathResult.found ? 'rgba(79, 215, 193, 0.2)' : 'rgba(239, 68, 68, 0.2)', color: pathResult.found ? '#4fd7c1' : '#f87171', padding: '2px 8px', borderRadius: '4px' }}>
                    {pathResult.found ? 'ROUTE VERIFIED' : 'NO PATH FOUND'}
                  </span>
                </h3>
                <p style={{ margin: '2px 0 0 0', color: '#8ca1b8', fontSize: '12px' }}>
                  {pathResult.explanation}
                </p>
              </div>
            </div>

            <div style={{ display: 'flex', gap: '0.6rem', flexWrap: 'wrap' }}>
              <div style={{ background: '#112236', padding: '4px 10px', borderRadius: '6px', fontSize: '11px' }}>
                <span style={{ color: '#7a92ad', display: 'block', fontSize: '10px' }}>METRIC WEIGHT</span>
                <strong style={{ color: '#4fd7c1' }}>
                  {pathResult.chosenWeight === 'hop' ? 'Hop Count (Uniform = 1.0)' : pathResult.chosenWeight === 'time' ? 'Time Step Gap (|Δt| + 1.0)' : pathResult.chosenWeight === 'risk' ? 'Inverse Risk Penalty' : 'BFS Shortest Hops'}
                </strong>
              </div>
              <div style={{ background: '#112236', padding: '4px 10px', borderRadius: '6px', fontSize: '11px' }}>
                <span style={{ color: '#7a92ad', display: 'block', fontSize: '10px' }}>TOTAL HOPS</span>
                <strong style={{ color: '#fff' }}>{pathResult.hops ?? 0} hops</strong>
              </div>
              {pathResult.cumulativeCost !== undefined && (
                <div style={{ background: '#112236', padding: '4px 10px', borderRadius: '6px', fontSize: '11px' }}>
                  <span style={{ color: '#7a92ad', display: 'block', fontSize: '10px' }}>CUMULATIVE COST</span>
                  <strong style={{ color: '#fbbf24' }}>{pathResult.cumulativeCost}</strong>
                </div>
              )}
              <div style={{ background: '#112236', padding: '4px 10px', borderRadius: '6px', fontSize: '11px' }}>
                <span style={{ color: '#7a92ad', display: 'block', fontSize: '10px' }}>TIME / COMPLEXITY</span>
                <strong style={{ color: '#fff' }}>{pathResult.traversalTimeMs}ms · {pathResult.evidence?.timeComplexity || 'O(V + E)'}</strong>
              </div>
            </div>
          </div>

          {/* Hop-by-Hop Breakdown Table for Path Results */}
          {pathResult.hopBreakdown && pathResult.hopBreakdown.length > 0 && (
            <div style={{ marginTop: '1rem' }}>
              <h4 style={{ margin: '0 0 0.5rem 0', color: '#fff', fontSize: '13px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <Route size={14} style={{ color: '#4fd7c1' }} />
                Hop-by-Hop Cost &amp; Forensic Parameter Breakdown
              </h4>
              <div style={{ overflowX: 'auto' }}>
                <table className="ws-table" style={{ width: '100%', fontSize: '12px' }}>
                  <thead>
                    <tr>
                      <th style={{ textAlign: 'left' }}>Hop #</th>
                      <th style={{ textAlign: 'left' }}>Origin Transaction</th>
                      <th style={{ textAlign: 'left' }}>Destination Transaction</th>
                      <th style={{ textAlign: 'right' }}>Edge Weight Cost</th>
                      <th style={{ textAlign: 'right' }}>Cumulative Cost</th>
                      <th style={{ textAlign: 'center' }}>TimeStep Sequence</th>
                      <th style={{ textAlign: 'center' }}>Destination Risk &amp; Ground Truth</th>
                    </tr>
                  </thead>
                  <tbody>
                    {pathResult.hopBreakdown.map((hop: any) => (
                      <tr key={hop.hopNumber}>
                        <td><strong style={{ color: '#4fd7c1' }}>Hop {hop.hopNumber}</strong></td>
                        <td>
                          <button className="ws-btn" style={{ padding: '2px 6px', fontSize: '11px', fontFamily: 'monospace' }} onClick={() => setCurrentTxId(hop.fromTx)}>
                            Tx {hop.fromTx}
                          </button>
                        </td>
                        <td>
                          <button className="ws-btn" style={{ padding: '2px 6px', fontSize: '11px', fontFamily: 'monospace' }} onClick={() => setCurrentTxId(hop.toTx)}>
                            Tx {hop.toTx}
                          </button>
                        </td>
                        <td style={{ textAlign: 'right', fontFamily: 'monospace', color: '#fbbf24', fontWeight: 600 }}>
                          +{hop.edgeCost}
                        </td>
                        <td style={{ textAlign: 'right', fontFamily: 'monospace', color: '#fff', fontWeight: 700 }}>
                          {hop.cumulativeCost}
                        </td>
                        <td style={{ textAlign: 'center' }}>
                          <span style={{ background: '#122030', padding: '2px 6px', borderRadius: '4px', fontSize: '11px' }}>
                            Step {hop.fromTimeStep} → Step {hop.toTimeStep} (Δt = {hop.timeStepGap})
                          </span>
                        </td>
                        <td style={{ textAlign: 'center' }}>
                          <span style={{
                            background: hop.toRiskScore >= 70 ? 'rgba(239, 68, 68, 0.2)' : hop.toRiskScore >= 40 ? 'rgba(245, 158, 11, 0.2)' : 'rgba(16, 185, 129, 0.2)',
                            color: hop.toRiskScore >= 70 ? '#f87171' : hop.toRiskScore >= 40 ? '#fbbf24' : '#34d399',
                            padding: '2px 8px', borderRadius: '4px', fontSize: '11px', fontWeight: 600
                          }}>
                            Risk {hop.toRiskScore}/100 · {hop.toLabel.toUpperCase()}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* BFS Exploration Breakdown Card */}
          {pathResult.algo === 'bfs' && pathResult.visitedNodes && (
            <div style={{ marginTop: '1rem' }}>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '0.6rem', marginBottom: '0.8rem' }}>
                <div style={{ background: '#112236', padding: '8px 12px', borderRadius: '6px' }}>
                  <span style={{ color: '#7a92ad', fontSize: '10px' }}>EXPLORED NODES</span>
                  <strong style={{ color: '#fff', fontSize: '15px', display: 'block' }}>{pathResult.visitedCount}</strong>
                </div>
                <div style={{ background: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.25)', padding: '8px 12px', borderRadius: '6px' }}>
                  <span style={{ color: '#f87171', fontSize: '10px' }}>ILLICIT / HIGH RISK</span>
                  <strong style={{ color: '#fca5a5', fontSize: '15px', display: 'block' }}>{pathResult.illicitCount ?? 0}</strong>
                </div>
                <div style={{ background: 'rgba(16, 185, 129, 0.1)', border: '1px solid rgba(16, 185, 129, 0.25)', padding: '8px 12px', borderRadius: '6px' }}>
                  <span style={{ color: '#34d399', fontSize: '10px' }}>LICIT TRANSFERS</span>
                  <strong style={{ color: '#6ee7b7', fontSize: '15px', display: 'block' }}>{pathResult.licitCount ?? 0}</strong>
                </div>
                <div style={{ background: '#112236', padding: '8px 12px', borderRadius: '6px' }}>
                  <span style={{ color: '#7a92ad', fontSize: '10px' }}>UNKNOWN RESEARCH NODES</span>
                  <strong style={{ color: '#94a3b8', fontSize: '15px', display: 'block' }}>{pathResult.unknownCount ?? 0}</strong>
                </div>
              </div>

              <div style={{ maxHeight: '200px', overflowY: 'auto', display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                {pathResult.visitedNodes.map((vn: any) => (
                  <button
                    key={vn.txId}
                    className="ws-btn"
                    style={{
                      padding: '4px 8px',
                      fontSize: '11px',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '4px',
                      background: vn.label === 'illicit' || (vn.riskScore && vn.riskScore >= 70) ? 'rgba(239, 68, 68, 0.15)' : '#0d1c2d',
                      borderColor: vn.label === 'illicit' || (vn.riskScore && vn.riskScore >= 70) ? 'rgba(239, 68, 68, 0.4)' : '#1e334c'
                    }}
                    onClick={() => {
                      setCurrentTxId(vn.txId);
                      setSelectedNode(nodes.find(n => n.id === vn.txId) || null);
                    }}
                  >
                    <span>{vn.label === 'illicit' || (vn.riskScore && vn.riskScore >= 70) ? '🔴' : vn.label === 'licit' ? '🟢' : '⚪'}</span>
                    <span style={{ fontFamily: 'monospace' }}>Tx {vn.txId}</span>
                    <span style={{ color: '#7a92ad', fontSize: '10px' }}>(Depth {vn.depth})</span>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Top Suspicious Modal */}
      {showTopModal && (
        <div className="ws-modal-backdrop" onClick={() => setShowTopModal(false)}>
          <div className="ws-evidence-modal" style={{ maxWidth: '600px' }} onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #1a2c41', paddingBottom: '0.8rem' }}>
              <h2 style={{ margin: 0, fontSize: '16px', color: '#fff', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <AlertTriangle size={16} style={{ color: '#f59e0b' }} />
                Top-K Suspicious Transactions (Min-Heap Retrieval)
              </h2>
              <button className="ws-icon-button" onClick={() => setShowTopModal(false)}>✕</button>
            </div>
            <p style={{ color: '#8ca1b8', fontSize: '12px', margin: '0.6rem 0' }}>
              Extracted via O(N log K) binary min-heap ranking across the 203,769 transactions. Click any transaction to inspect its directed graph.
            </p>
            <div style={{ maxHeight: '360px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
              {topSuspicious.map((item, idx) => (
                <div
                  key={item.txId}
                  style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#0e1b2b', padding: '8px 12px', borderRadius: '6px', cursor: 'pointer' }}
                  onClick={() => {
                    setCurrentTxId(item.txId);
                    setShowTopModal(false);
                  }}
                >
                  <div>
                    <strong style={{ color: '#fff', fontFamily: 'monospace' }}>Tx {item.txId}</strong>
                    <div style={{ fontSize: '11px', color: item.label === 'illicit' ? '#f87171' : '#fbbf24' }}>
                      {item.label?.toUpperCase()} · TimeStep {item.timeStep}
                    </div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <span style={{ background: 'rgba(239, 68, 68, 0.2)', color: '#f87171', padding: '2px 8px', borderRadius: '4px', fontWeight: 700, fontSize: '12px' }}>
                      Risk {item.riskScore}/100
                    </span>
                    <span style={{ display: 'block', fontSize: '10px', color: '#6882a0', marginTop: '2px' }}>
                      Click to load →
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Sliding Window Burst Analysis Modal */}
      {showBurstModal && temporalBursts && (
        <div className="ws-modal-backdrop" onClick={() => setShowBurstModal(false)}>
          <div className="ws-evidence-modal" style={{ maxWidth: '640px' }} onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #1a2c41', paddingBottom: '0.8rem' }}>
              <h2 style={{ margin: 0, fontSize: '16px', color: '#fff', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <Clock size={16} style={{ color: '#38bdf8' }} />
                Temporal Burst Analysis (Sliding Window Algorithm)
              </h2>
              <button className="ws-icon-button" onClick={() => setShowBurstModal(false)}>✕</button>
            </div>
            <p style={{ color: '#8ca1b8', fontSize: '12px', margin: '0.6rem 0' }}>
              Sliding window temporal rate analysis O(W + T) over 49 discrete intervals detecting transaction bursts and rapid forwarding spikes.
            </p>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.6rem', marginBottom: '0.8rem' }}>
              <div style={{ background: '#0e1b2b', padding: '8px', borderRadius: '6px' }}>
                <span style={{ color: '#6882a0', fontSize: '10px' }}>TOTAL WINDOWS</span>
                <strong style={{ display: 'block', color: '#fff', fontSize: '14px' }}>{temporalBursts.totalWindows}</strong>
              </div>
              <div style={{ background: '#0e1b2b', padding: '8px', borderRadius: '6px' }}>
                <span style={{ color: '#6882a0', fontSize: '10px' }}>BURST INTERVALS</span>
                <strong style={{ display: 'block', color: '#f59e0b', fontSize: '14px' }}>{temporalBursts.burstCount}</strong>
              </div>
              <div style={{ background: '#0e1b2b', padding: '8px', borderRadius: '6px' }}>
                <span style={{ color: '#6882a0', fontSize: '10px' }}>PEAK BURST RATIO</span>
                <strong style={{ display: 'block', color: '#ef4444', fontSize: '14px' }}>{temporalBursts.peakWindow?.burstRatio}x</strong>
              </div>
            </div>
            <div style={{ maxHeight: '280px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
              {temporalBursts.windows?.filter((w: any) => w.isBurst).map((w: any, idx: number) => (
                <div key={idx} style={{ background: '#0e1b2b', padding: '8px 12px', borderRadius: '6px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '12px' }}>
                  <div>
                    <strong style={{ color: '#fff' }}>Steps {w.startStep} → {w.endStep}</strong>
                    <div style={{ color: '#6882a0', fontSize: '11px' }}>
                      {w.totalTransactions} transactions ({w.illicitCount} illicit, {w.illicitPercentage}%)
                    </div>
                  </div>
                  <span style={{ background: 'rgba(245, 158, 11, 0.2)', color: '#fbbf24', padding: '2px 8px', borderRadius: '4px', fontWeight: 600 }}>
                    {w.burstRatio}x Burst
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
