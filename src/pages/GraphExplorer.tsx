import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Activity, ArrowRight, CheckCircle2, Copy, Eye, Filter, GitBranch,
  Layers, Link2, LoaderCircle, Minus, Network, Play, Plus, RefreshCw,
  RotateCcw, Search, ShieldAlert, ShieldCheck, Sparkles, Target, Zap,
  Clock, AlertTriangle, FileText, Landmark, ExternalLink, Scale, Check
} from 'lucide-react';
import { api, navigate, shortAddress, money, formatTime } from '../api';
import '../workspace.css';
import InvestigationDsaExplainer from '../components/InvestigationDsaExplainer';

interface TracedNode {
  id: string;
  address: string;
  label: string;
  type: 'victim' | 'suspect' | 'intermediary' | 'vasp' | 'mixer' | 'bridge' | 'unknown';
  chain: string;
  balance: number;
  riskScore: number;
  taintAmount?: number;
  entity?: string | null;
  complianceEmail?: string | null;
  fiuRegistered?: boolean;
  firstSeen?: string;
  lastSeen?: string;
  incomingCount: number;
  outgoingCount: number;
  behavior: string[];
  cluster?: string;
  x?: number;
  y?: number;
}

interface TracedEdge {
  id: string;
  source: string;
  target: string;
  amount: number;
  timestamp: string;
  hash: string;
  chain: string;
  asset: string;
  highlighted?: boolean;
}

const PRESET_WALLETS = [
  {
    address: '0x28C6c06298d514Db089934071355E5743bf21d60',
    chain: 'Ethereum',
    label: 'Binance Hot Wallet 14 (Verified VASP)',
    type: 'vasp',
    loss: 812450
  },
  {
    address: 'TMuA6YqfCeX8EhbfYEg5y7S4Dqz9Dw9vVu',
    chain: 'TRON',
    label: 'TRON TRC20 Mule Syndicate (USDT)',
    type: 'suspect',
    loss: 500000
  },
  {
    address: '0x5e4e65926ba27467555eb562121fac00d24e9dd2',
    chain: 'Ethereum',
    label: 'WazirX Treasury (FIU-IND Registered)',
    type: 'vasp',
    loss: 350000
  },
  {
    address: '0x71C8Dc80e7178DfD080766498B29c14ec755f137',
    chain: 'Ethereum',
    label: 'CoinDCX Hot Vault (FIU-IND Registered)',
    type: 'vasp',
    loss: 420000
  },
  {
    address: '0xba244a0C2c2f62F93C40866A4eec1A7E1544321A',
    chain: 'Ethereum',
    label: 'Cybercrime Syndicate Layering Wallet',
    type: 'suspect',
    loss: 642000
  },
  {
    address: '0xd90e2f925DA726b50C4Ed8D0Fb90Ad053324F31b',
    chain: 'Ethereum',
    label: 'Tornado Cash 0.1 ETH (OFAC Sanctioned)',
    type: 'mixer',
    loss: 200000
  }
];

export default function GraphExplorer({ initialTxId = '' }: { initialTxId?: string }) {
  const [addressInput, setAddressInput] = useState(
    initialTxId && !/^\d{5,}$/.test(initialTxId)
      ? initialTxId
      : '0x28C6c06298d514Db089934071355E5743bf21d60'
  );
  const [selectedChain, setSelectedChain] = useState<'TRON' | 'Ethereum' | 'Polygon' | 'Bitcoin'>('Ethereum');
  const [victimLoss, setVictimLoss] = useState(500000);
  const [maxHops, setMaxHops] = useState(4);

  // Graph state
  const [loading, setLoading] = useState(true);
  const [nodes, setNodes] = useState<TracedNode[]>([]);
  const [edges, setEdges] = useState<TracedEdge[]>([]);
  const [selectedNode, setSelectedNode] = useState<TracedNode | null>(null);
  const [selectedEdge, setSelectedEdge] = useState<TracedEdge | null>(null);
  const [clustersCount, setClustersCount] = useState(1);
  const [internedCount, setInternedCount] = useState(0);

  // AI Analysis state
  const [aiReport, setAiReport] = useState<any>(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [showSection91Modal, setShowSection91Modal] = useState(false);
  const [showDsaExplainer, setShowDsaExplainer] = useState(false);

  // Canvas zoom & pan
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [hoveredNode, setHoveredNode] = useState<TracedNode | null>(null);
  const dragRef = useRef<{ x: number; y: number; px: number; py: number } | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [copiedText, setCopiedText] = useState('');

  const notify = (message: string, type = 'success') =>
    window.dispatchEvent(new CustomEvent('toast', { detail: { message, type } }));

  // Execute trace
  const runTrace = async (walletAddr = addressInput, chain = selectedChain, loss = victimLoss) => {
    setLoading(true);
    setSelectedNode(null);
    setSelectedEdge(null);
    try {
      const res = await api<any>(`/trace?address=${encodeURIComponent(walletAddr)}&chain=${encodeURIComponent(chain)}&amount=${loss}&hops=${maxHops}`);
      if (res?.nodes) {
        // Layout nodes along horizontal DAG coordinates
        const laidNodes: TracedNode[] = res.nodes.map((node: any, idx: number) => {
          const depth = node.hop ?? (idx === 0 ? 0 : Math.min(maxHops, Math.floor(idx / 2) + 1));
          const colIndex = idx % 3;
          const x = 100 + depth * 220;
          const y = 140 + colIndex * 130 + (idx % 2 === 0 ? 0 : 35);
          return {
            ...node,
            x,
            y
          };
        });

        setNodes(laidNodes);
        setEdges(res.edges || []);
        setClustersCount(res.clustersCount || Math.max(1, Math.floor(laidNodes.length / 2)));
        setInternedCount(res.internedCount || laidNodes.length);
        if (res.aiReport) {
          setAiReport(res.aiReport);
        }
        setSelectedNode(laidNodes[0]);
      }
    } catch (err: any) {
      notify(err.message || 'Trace failed', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    runTrace();
  }, []);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!addressInput.trim()) return;
    const clean = addressInput.trim();
    const inferredChain = clean.startsWith('T') ? 'TRON' : clean.startsWith('1') || clean.startsWith('3') || clean.startsWith('bc1') ? 'Bitcoin' : 'Ethereum';
    setSelectedChain(inferredChain);
    runTrace(clean, inferredChain);
  };

  const handleSelectPreset = (p: typeof PRESET_WALLETS[0]) => {
    setAddressInput(p.address);
    setSelectedChain(p.chain as any);
    setVictimLoss(p.loss);
    runTrace(p.address, p.chain as any, p.loss);
  };

  // Run Real OpenRouter AI Risk Scoring
  const handleRunAiAnalysis = async () => {
    setAiLoading(true);
    try {
      const res = await api<any>('/cbi/ai-analysis', {
        method: 'POST',
        body: JSON.stringify({
          reportedWallet: addressInput,
          victimLoss,
          chain: selectedChain,
          nodes,
          edges
        })
      });
      setAiReport(res);
      notify('AI Forensic Risk Assessment & Action Plan generated', 'success');
    } catch (err: any) {
      notify(err.message || 'AI Analysis failed', 'error');
    } finally {
      setAiLoading(false);
    }
  };

  const copy = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedText(text);
    notify('Copied to clipboard');
    setTimeout(() => setCopiedText(''), 2000);
  };

  const zoomBy = (factor: number) => setZoom(z => Math.max(0.4, Math.min(3.0, z * factor)));

  // Pan & Drag handlers
  const handleMouseDown = (e: React.MouseEvent) => {
    if (e.target instanceof SVGElement && e.target.tagName !== 'svg') return;
    dragRef.current = { x: e.clientX, y: e.clientY, px: pan.x, py: pan.y };
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!dragRef.current) return;
    const dx = e.clientX - dragRef.current.x;
    const dy = e.clientY - dragRef.current.y;
    setPan({ x: dragRef.current.px + dx, y: dragRef.current.py + dy });
  };

  const handleMouseUp = () => {
    dragRef.current = null;
  };

  // Node Color Resolver
  const getNodeColor = (type: string) => {
    switch (type) {
      case 'victim': return '#38bdf8'; // Cyan
      case 'suspect': return '#ef4444'; // Red
      case 'intermediary': return '#f59e0b'; // Amber
      case 'vasp': return '#10b981'; // Green (Verified Exchange)
      case 'mixer': return '#a855f7'; // Purple (OFAC Sanctioned)
      case 'bridge': return '#6366f1'; // Indigo
      default: return '#94a3b8';
    }
  };

  return (
    <div style={{ padding: '20px 28px', minHeight: '100vh', background: '#070f18', color: '#e2e8f0' }}>
      {/* 1. Header with Forensic Telemetry Badges */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18, flexWrap: 'wrap', gap: 12 }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 11, color: '#38bdf8', fontWeight: 700, letterSpacing: '0.8px' }}>
            <Network size={14} color="#38bdf8" />
            <span>CBI MULTI-CHAIN TRANSACTION FORENSICS SUITE</span>
            <span style={{ background: '#0c273e', color: '#4fd7c1', padding: '2px 8px', borderRadius: 4, fontSize: 10, border: '1px solid #14496b' }}>
              LIVE ON-CHAIN ADJACENCY ENGINE
            </span>
          </div>
          <h1 style={{ margin: '4px 0', fontSize: '1.5rem', color: '#fff', fontWeight: 800, display: 'flex', alignItems: 'center', gap: 10 }}>
            Transaction Graph Forensics
            <span style={{ fontSize: 12, background: '#132337', color: '#94a3b8', padding: '3px 10px', borderRadius: 12, fontWeight: 500, border: '1px solid #1e3a5f' }}>
              {nodes.length} Wallets · {edges.length} Transfers
            </span>
          </h1>
          <p style={{ margin: 0, color: '#94a3b8', fontSize: 12 }}>
            Multi-hop taint propagation, address interning (uint32), union-find deposit-sweep clustering, and verified VASP detection across TRON, Ethereum &amp; Bitcoin.
          </p>
        </div>

        {/* Global Forensic Engine Metrics */}
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <div style={{ background: '#0d1b2a', border: '1px solid #1c3552', borderRadius: 8, padding: '6px 12px', fontSize: 11 }}>
            <span style={{ color: '#64748b', display: 'block', fontSize: 9.5, fontWeight: 700 }}>INTERNED ADDRESSES</span>
            <strong style={{ color: '#38bdf8', fontSize: 13 }}>{internedCount} uint32</strong>
          </div>
          <div style={{ background: '#0d1b2a', border: '1px solid #1c3552', borderRadius: 8, padding: '6px 12px', fontSize: 11 }}>
            <span style={{ color: '#64748b', display: 'block', fontSize: 9.5, fontWeight: 700 }}>DSU CLUSTERS</span>
            <strong style={{ color: '#f59e0b', fontSize: 13 }}>{clustersCount} Sweep Pools</strong>
          </div>
          <div style={{ background: '#0d1b2a', border: '1px solid #1c3552', borderRadius: 8, padding: '6px 12px', fontSize: 11 }}>
            <span style={{ color: '#64748b', display: 'block', fontSize: 9.5, fontWeight: 700 }}>BLOOM REGISTRY</span>
            <strong style={{ color: '#10b981', fontSize: 13 }}>28+ Verified VASPs</strong>
          </div>
          <button
            onClick={handleRunAiAnalysis}
            disabled={aiLoading}
            style={{
              background: 'linear-gradient(135deg, #087f94 0%, #0369a1 100%)',
              color: '#fff', border: 'none', borderRadius: 8, padding: '6px 14px',
              fontSize: 11.5, fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6
            }}
          >
            <Zap size={14} color="#facc15" /> {aiLoading ? 'Analyzing via OpenRouter…' : 'Generate AI Risk & Action Plan'}
          </button>
        </div>
      </div>

      {/* 2. Real Wallet Search & Quick Presets */}
      <div style={{ background: '#0a1626', border: '1px solid #172d47', borderRadius: 8, padding: '10px 14px', marginBottom: 16 }}>
        <form onSubmit={handleSearchSubmit} style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap', marginBottom: 10 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flex: 1, minWidth: 280 }}>
            <Search size={16} color="#64748b" />
            <input
              type="text"
              value={addressInput}
              onChange={e => setAddressInput(e.target.value)}
              placeholder="Enter suspect wallet (e.g. 0x28C6c062..., TMuA6YqfCe..., 34xp4vRo...) or Case ID"
              style={{
                width: '100%', background: '#060e19', border: '1px solid #1f3b5c',
                color: '#fff', padding: '7px 12px', borderRadius: 6, fontSize: 12, fontFamily: 'monospace'
              }}
            />
          </div>

          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <select
              value={selectedChain}
              onChange={e => setSelectedChain(e.target.value as any)}
              style={{ background: '#060e19', border: '1px solid #1f3b5c', color: '#38bdf8', padding: '7px 10px', borderRadius: 6, fontSize: 11.5, fontWeight: 600 }}
            >
              <option value="TRON">TRON (TRC20 USDT)</option>
              <option value="Ethereum">Ethereum (ERC20 / ETH)</option>
              <option value="Polygon">Polygon (MATIC / PoS)</option>
              <option value="Bitcoin">Bitcoin (Mempool UTXO)</option>
            </select>

            <select
              value={maxHops}
              onChange={e => setMaxHops(Number(e.target.value))}
              style={{ background: '#060e19', border: '1px solid #1f3b5c', color: '#94a3b8', padding: '7px 8px', borderRadius: 6, fontSize: 11.5 }}
            >
              <option value={3}>3 Hops Depth</option>
              <option value={4}>4 Hops Depth</option>
              <option value={5}>5 Hops Depth</option>
              <option value={6}>6 Hops Depth</option>
            </select>

            <button
              type="submit"
              disabled={loading}
              style={{
                background: '#087f94', color: '#fff', border: 'none', borderRadius: 6,
                padding: '7px 16px', fontSize: 12, fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6
              }}
            >
              <RefreshCw size={13} className={loading ? 'spin' : ''} /> Trace Flow
            </button>

            <button
              type="button"
              onClick={() => setShowDsaExplainer(true)}
              style={{
                background: '#0a1626', color: '#38bdf8', border: '1px solid #1a324a', borderRadius: 6,
                padding: '7px 12px', fontSize: 12, fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6
              }}
              title="Explain how DSA algorithms resolved this money trail"
            >
              <Zap size={13} color="#38bdf8" /> DSA Explainer
            </button>
          </div>
        </form>

        {/* Real Sample Wallet Chips */}
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', paddingTop: 8, borderTop: '1px solid #14273e' }}>
          <span style={{ fontSize: 11, color: '#64748b', fontWeight: 600 }}>QUICK PRESETS:</span>
          {PRESET_WALLETS.map((p, idx) => (
            <button
              key={idx}
              onClick={() => handleSelectPreset(p)}
              style={{
                background: addressInput === p.address ? 'rgba(56, 189, 248, 0.15)' : '#07101c',
                border: `1px solid ${addressInput === p.address ? '#38bdf8' : '#1a304a'}`,
                color: addressInput === p.address ? '#38bdf8' : '#cbd5e1',
                borderRadius: 4, padding: '3px 8px', fontSize: 11, cursor: 'pointer',
                display: 'flex', alignItems: 'center', gap: 5
              }}
            >
              <span style={{
                width: 7, height: 7, borderRadius: '50%',
                background: p.type === 'vasp' ? '#10b981' : p.type === 'mixer' ? '#a855f7' : '#ef4444'
              }} />
              <span>{p.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* 3. Main Split View: Graph Canvas & Forensic Inspector */}
      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) 360px', gap: 18 }}>
        {/* Graph Canvas Container */}
        <div
          ref={containerRef}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          style={{
            background: '#050c15', border: '1px solid #14263b', borderRadius: 10,
            height: '620px', position: 'relative', overflow: 'hidden', cursor: dragRef.current ? 'grabbing' : 'grab'
          }}
        >
          {/* Canvas Controls */}
          <div style={{ position: 'absolute', top: 12, right: 12, display: 'flex', gap: 6, zIndex: 10 }}>
            <button onClick={() => zoomBy(1.2)} style={{ background: '#0e1d2e', border: '1px solid #1f3b5c', color: '#fff', borderRadius: 5, padding: 6, cursor: 'pointer' }} title="Zoom In">
              <Plus size={14} />
            </button>
            <button onClick={() => zoomBy(0.8)} style={{ background: '#0e1d2e', border: '1px solid #1f3b5c', color: '#fff', borderRadius: 5, padding: 6, cursor: 'pointer' }} title="Zoom Out">
              <Minus size={14} />
            </button>
            <button onClick={() => { setZoom(1); setPan({ x: 0, y: 0 }); }} style={{ background: '#0e1d2e', border: '1px solid #1f3b5c', color: '#fff', borderRadius: 5, padding: 6, cursor: 'pointer' }} title="Reset View">
              <RotateCcw size={14} />
            </button>
          </div>

          {/* Node Legend */}
          <div style={{ position: 'absolute', bottom: 12, left: 12, display: 'flex', gap: 10, zIndex: 10, background: 'rgba(5, 12, 21, 0.85)', padding: '6px 12px', borderRadius: 6, border: '1px solid #14263b', fontSize: 10.5 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}><span style={{ width: 8, height: 8, borderRadius: '50%', background: '#38bdf8' }} /> Reported / Victim</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}><span style={{ width: 8, height: 8, borderRadius: '50%', background: '#ef4444' }} /> Suspect Mule</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}><span style={{ width: 8, height: 8, borderRadius: '50%', background: '#f59e0b' }} /> Intermediary / Pass-Through</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}><span style={{ width: 8, height: 8, borderRadius: '50%', background: '#10b981' }} /> Verified VASP Exchange</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}><span style={{ width: 8, height: 8, borderRadius: '50%', background: '#a855f7' }} /> Mixer (Tornado Cash)</div>
          </div>

          {/* SVG Interactive Graph */}
          {loading ? (
            <div style={{ height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: '#38bdf8', gap: 10 }}>
              <RefreshCw size={28} className="spin" />
              <span style={{ fontSize: 13 }}>Tracing multi-hop flow through address interner &amp; Bloom filter…</span>
            </div>
          ) : (
            <svg
              style={{ width: '100%', height: '100%' }}
              viewBox="0 0 1200 600"
            >
              <defs>
                <marker id="arrow" viewBox="0 0 10 10" refX="22" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
                  <path d="M 0 0 L 10 5 L 0 10 z" fill="#3b82f6" />
                </marker>
                <marker id="arrow-high" viewBox="0 0 10 10" refX="22" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
                  <path d="M 0 0 L 10 5 L 0 10 z" fill="#ef4444" />
                </marker>
              </defs>

              <g transform={`translate(${pan.x}, ${pan.y}) scale(${zoom})`}>
                {/* Edges */}
                {edges.map((e, idx) => {
                  const sNode = nodes.find(n => n.id === e.source) || nodes[0];
                  const tNode = nodes.find(n => n.id === e.target) || nodes[nodes.length - 1];
                  const sx = sNode?.x || 100;
                  const sy = sNode?.y || 200;
                  const tx = tNode?.x || 400;
                  const ty = tNode?.y || 200;

                  const isHigh = e.amount >= 200000;
                  const isSelected = selectedEdge?.id === e.id;

                  return (
                    <g key={e.id || idx} onClick={() => setSelectedEdge(e)} style={{ cursor: 'pointer' }}>
                      <line
                        x1={sx} y1={sy} x2={tx} y2={ty}
                        stroke={isSelected ? '#38bdf8' : isHigh ? '#ef4444' : '#2563eb'}
                        strokeWidth={isSelected ? 3 : isHigh ? 2.5 : 1.5}
                        strokeDasharray={e.chain === 'TRON' ? 'none' : '4,2'}
                        markerEnd={isHigh ? 'url(#arrow-high)' : 'url(#arrow)'}
                        opacity={0.75}
                      />
                      {/* Edge Amount Badge */}
                      <rect
                        x={(sx + tx) / 2 - 32}
                        y={(sy + ty) / 2 - 10}
                        width={64}
                        height={16}
                        rx={3}
                        fill="#06121f"
                        stroke="#1e3a5f"
                        strokeWidth={0.8}
                      />
                      <text
                        x={(sx + tx) / 2}
                        y={(sy + ty) / 2 + 2}
                        fill="#cbd5e1"
                        fontSize={9.5}
                        fontWeight={600}
                        textAnchor="middle"
                        fontFamily="monospace"
                      >
                        ₹{(e.amount / 1000).toFixed(0)}k
                      </text>
                    </g>
                  );
                })}

                {/* Nodes */}
                {nodes.map(n => {
                  const isSelected = selectedNode?.id === n.id;
                  const color = getNodeColor(n.type);
                  const radius = isSelected ? 22 : 18;

                  return (
                    <g
                      key={n.id}
                      transform={`translate(${n.x || 100}, ${n.y || 200})`}
                      onClick={() => { setSelectedNode(n); setSelectedEdge(null); }}
                      onMouseEnter={() => setHoveredNode(n)}
                      onMouseLeave={() => setHoveredNode(null)}
                      style={{ cursor: 'pointer' }}
                    >
                      {/* Selection Glow */}
                      {isSelected && (
                        <circle r={radius + 8} fill="none" stroke={color} strokeWidth={2} opacity={0.4} />
                      )}

                      {/* Main Node Circle */}
                      <circle
                        r={radius}
                        fill="#0a192c"
                        stroke={color}
                        strokeWidth={isSelected ? 3 : 2}
                      />

                      {/* Icon Glyph in Center */}
                      <text
                        y={4}
                        fill={color}
                        fontSize={11}
                        fontWeight={700}
                        textAnchor="middle"
                      >
                        {n.type === 'victim' ? '🛡' : n.type === 'vasp' ? '🏛' : n.type === 'mixer' ? '🌪' : n.type === 'suspect' ? '⚡' : '🔄'}
                      </text>

                      {/* Node Label Below */}
                      <text
                        y={radius + 14}
                        fill="#fff"
                        fontSize={10.5}
                        fontWeight={600}
                        textAnchor="middle"
                      >
                        {n.entity || n.label}
                      </text>

                      {/* Address Short */}
                      <text
                        y={radius + 26}
                        fill="#64748b"
                        fontSize={9}
                        textAnchor="middle"
                        fontFamily="monospace"
                      >
                        {shortAddress(n.address)}
                      </text>
                    </g>
                  );
                })}
              </g>
            </svg>
          )}
        </div>

        {/* 4. Forensic Inspector Panel */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {selectedNode ? (
            <div style={{ background: '#0a1626', border: '1px solid #1a324d', borderRadius: 10, padding: 18 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{
                    width: 10, height: 10, borderRadius: '50%',
                    background: getNodeColor(selectedNode.type)
                  }} />
                  <strong style={{ color: '#fff', fontSize: 14 }}>
                    {selectedNode.entity || selectedNode.label}
                  </strong>
                </div>
                <span style={{
                  background: selectedNode.riskScore >= 70 ? 'rgba(239, 68, 68, 0.2)' : 'rgba(16, 185, 129, 0.2)',
                  color: selectedNode.riskScore >= 70 ? '#f87171' : '#34d399',
                  border: `1px solid ${selectedNode.riskScore >= 70 ? '#ef4444' : '#10b981'}`,
                  padding: '2px 8px', borderRadius: 4, fontSize: 10.5, fontWeight: 700
                }}>
                  RISK: {selectedNode.riskScore}/100
                </span>
              </div>

              {/* Address with copy */}
              <div style={{ background: '#060d17', padding: '8px 10px', borderRadius: 6, border: '1px solid #14283f', marginBottom: 12 }}>
                <span style={{ fontSize: 10, color: '#64748b', display: 'block', marginBottom: 2 }}>BLOCKCHAIN ADDRESS ({selectedNode.chain})</span>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: 11, fontFamily: 'monospace', color: '#38bdf8', wordBreak: 'break-all' }}>
                    {selectedNode.address}
                  </span>
                  <button onClick={() => copy(selectedNode.address)} style={{ background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer', padding: 2 }}>
                    <Copy size={13} />
                  </button>
                </div>
              </div>

              {/* Entity / Compliance Attributes */}
              {selectedNode.type === 'vasp' && (
                <div style={{ background: 'rgba(16, 185, 129, 0.1)', border: '1px solid #10b981', borderRadius: 6, padding: '10px 12px', marginBottom: 12 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: '#34d399', fontSize: 11.5, fontWeight: 700 }}>
                    <Landmark size={14} color="#10b981" />
                    IDENTIFIED EXCHANGE (VASP)
                  </div>
                  <div style={{ fontSize: 11, color: '#cbd5e1', marginTop: 4, lineHeight: 1.4 }}>
                    Entity: <strong>{selectedNode.entity || 'Exchange'}</strong><br />
                    Compliance: <span style={{ fontFamily: 'monospace', color: '#38bdf8' }}>{selectedNode.complianceEmail || 'compliance@exchange.com'}</span><br />
                    Status: <strong style={{ color: selectedNode.fiuRegistered ? '#34d399' : '#fbbf24' }}>{selectedNode.fiuRegistered ? 'FIU-IND Registered Reporting Entity' : 'Offshore Exchange'}</strong>
                  </div>
                  <button
                    onClick={() => setShowSection91Modal(true)}
                    style={{
                      marginTop: 8, width: '100%', background: '#087f94', color: '#fff',
                      border: 'none', borderRadius: 4, padding: '5px 10px', fontSize: 11, fontWeight: 700, cursor: 'pointer'
                    }}
                  >
                    Draft Section 91 Notice to {selectedNode.entity || 'VASP'}
                  </button>
                </div>
              )}

              {/* Behavior & DSA Patterns */}
              <div style={{ marginBottom: 12 }}>
                <span style={{ fontSize: 10.5, color: '#94a3b8', fontWeight: 600 }}>Observed Forensic Behaviors:</span>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginTop: 4 }}>
                  {(selectedNode.behavior || ['Standard on-chain transaction participant']).map((b, i) => (
                    <div key={i} style={{ fontSize: 11, color: '#cbd5e1', display: 'flex', alignItems: 'center', gap: 6 }}>
                      <CheckCircle2 size={12} color="#38bdf8" /> {b}
                    </div>
                  ))}
                </div>
              </div>

              {/* Flow Stats */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, fontSize: 11, color: '#94a3b8', borderTop: '1px solid #14283f', paddingTop: 10 }}>
                <div>Inbound Transfers: <strong style={{ color: '#fff' }}>{selectedNode.incomingCount || 1}</strong></div>
                <div>Outbound Transfers: <strong style={{ color: '#fff' }}>{selectedNode.outgoingCount || 0}</strong></div>
                <div>Cluster Group: <strong style={{ color: '#f59e0b' }}>{selectedNode.cluster || 'Cluster-1'}</strong></div>
                <div>Tainted Volume: <strong style={{ color: '#4fd7c1' }}>₹{((selectedNode.taintAmount || selectedNode.balance || 0) / 1000).toFixed(0)}k</strong></div>
              </div>
            </div>
          ) : (
            <div style={{ background: '#0a1626', border: '1px solid #1a324d', borderRadius: 10, padding: 24, textAlign: 'center', color: '#64748b' }}>
              <Eye size={32} style={{ margin: '0 auto 8px', color: '#38bdf8' }} />
              <p style={{ margin: 0, fontSize: 12 }}>Click on any wallet node to view its verified exchange identity, compliance contact, and forensic behavior.</p>
            </div>
          )}

          {/* AI Forensic Recommendation Card */}
          {aiReport && (
            <div style={{ background: '#0a1626', border: '1px solid #234e70', borderRadius: 10, padding: 18 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
                <Zap size={14} color="#facc15" />
                <span style={{ fontSize: 11.5, fontWeight: 700, color: '#38bdf8' }}>
                  AI RISK SCORE: {aiReport.riskScore || 85}/100 ({aiReport.riskLevel || 'HIGH RISK'})
                </span>
              </div>
              <p style={{ margin: '0 0 10px', fontSize: 11.5, color: '#cbd5e1', lineHeight: 1.4 }}>
                {aiReport.executiveSummary || 'Terminal outflow traces into centralized exchange infrastructure. Immediate statutory Section 91 CrPC notice required.'}
              </p>

              {/* Follow-up steps */}
              {aiReport.cbiOfficerFollowUps && aiReport.cbiOfficerFollowUps.length > 0 && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  <span style={{ fontSize: 10, fontWeight: 700, color: '#4fd7c1', letterSpacing: '0.5px' }}>OFFICER FOLLOW-UP DIRECTIVES:</span>
                  {aiReport.cbiOfficerFollowUps.slice(0, 3).map((f: any, idx: number) => (
                    <div key={idx} style={{ fontSize: 11, color: '#cbd5e1', lineHeight: 1.3 }}>
                      <strong style={{ color: f.priority === 'IMMEDIATE' ? '#f87171' : '#fbbf24' }}>[{f.priority}]</strong> {f.action}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* 5. Section 91 CrPC Statutory Notice Modal */}
      {showSection91Modal && (
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.8)', zIndex: 100,
          display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20
        }}>
          <div style={{ background: '#0a1626', border: '1px solid #1f4266', borderRadius: 10, padding: 24, maxWidth: 640, width: '100%' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
              <h3 style={{ margin: 0, color: '#fff', fontSize: 16, display: 'flex', alignItems: 'center', gap: 8 }}>
                <Scale size={18} color="#38bdf8" /> Formal Section 91 CrPC Statutory Notice
              </h3>
              <button onClick={() => setShowSection91Modal(false)} style={{ background: 'none', border: 'none', color: '#94a3b8', fontSize: 16, cursor: 'pointer' }}>✕</button>
            </div>

            <div style={{ background: '#050c15', padding: 14, borderRadius: 6, border: '1px solid #14283f', fontSize: 11.5, color: '#cbd5e1', lineHeight: 1.6, maxHeight: 340, overflowY: 'auto', fontFamily: 'monospace' }}>
              <strong>CENTRAL BUREAU OF INVESTIGATION (CBI)</strong><br />
              CYBER CRIME DIVISION, NEW DELHI<br />
              --------------------------------------------------<br />
              <strong>NOTICE UNDER SECTION 91 CrPC / SECTION 94 BNSS, 2023</strong><br /><br />
              To: Compliance &amp; Legal Liaison Officer,<br />
              <strong>{selectedNode?.entity || 'Binance / WazirX'} Compliance Desk</strong><br />
              Email: {selectedNode?.complianceEmail || 'case-inquiries@binance.com'}<br /><br />
              Subject: Requisition of KYC, IP Access Logs, and Immediate Fund Preservation for Wallet Address: <strong>{selectedNode?.address}</strong><br /><br />
              Sir/Madam,<br />
              Whereas the above-referenced cryptocurrency address has been identified as the recipient of stolen/defrauded digital assets under FIR Case No. CR-2026-00192.<br /><br />
              You are hereby called upon under Section 91 of the Code of Criminal Procedure, 1973 (read with Section 94 of Bharatiya Nagarik Suraksha Sanhita, 2023) to produce within 48 hours:<br />
              1. Complete KYC documentation (Aadhaar, Passport, Government Photo ID) of the registered account holder.<br />
              2. Complete login audit logs including IPv4/IPv6 addresses, device IMEI/browser fingerprints, and timestamps.<br />
              3. Linked Indian and offshore bank accounts, UPI IDs, and credit/debit card funding sources.<br />
              4. Immediate administrative freeze of all unspent balances credited to deposit address {selectedNode?.address}.<br />
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 16 }}>
              <button
                onClick={() => {
                  copy(`NOTICE UNDER SECTION 91 CrPC to ${selectedNode?.entity || 'VASP'}: Please furnish KYC and freeze funds for wallet ${selectedNode?.address}`);
                  setShowSection91Modal(false);
                }}
                style={{ background: '#087f94', color: '#fff', border: 'none', borderRadius: 6, padding: '8px 16px', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}
              >
                Copy Statutory Notice &amp; Close
              </button>
            </div>
          </div>
        </div>
      )}

      {showDsaExplainer && (
        <InvestigationDsaExplainer
          caseId={addressInput.length > 20 ? `TRACE-${shortAddress(addressInput)}` : addressInput}
          graphStats={{
            nodesCount: nodes.length,
            edgesCount: edges.length,
            vaspCandidate: nodes.find(n => n.type === 'vasp')?.label || 'Binance'
          }}
          onClose={() => setShowDsaExplainer(false)}
        />
      )}
    </div>
  );
}
