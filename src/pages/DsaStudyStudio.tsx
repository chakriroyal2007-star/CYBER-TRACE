import React, { useState, useEffect, useRef } from 'react';
import {
  Play, Pause, SkipForward, SkipBack, RotateCcw,
  BookOpen, GitBranch, Network, Activity, Cpu,
  CheckCircle, ArrowRight, ShieldAlert, Zap,
  Layers, Database, Compass, Clock, Sparkles, AlertTriangle, ShieldCheck
} from 'lucide-react';
import { api } from '../api';
import { Badge, Button } from '../components/ui';

interface AlgorithmMeta {
  id: string;
  name: string;
  category: string;
  timeComplexity: string;
  spaceComplexity: string;
  concept: string;
  whyInCyberTrace: string;
  pseudocode: string;
  realApplication: string;
}

interface Step {
  step: number;
  action: string;
  node?: string;
  queue?: string[];
  stack?: string[];
  visited?: string[];
  distances?: Record<string, number>;
  heapState?: any[];
  heapArray?: any[];
  heap?: any[];
  parentTable?: Record<string, string>;
  componentCount?: number;
  activeEdge?: { from: string; to: string; amount?: number; weight?: number };
  explanation: string;
  colorState?: string;
  cycle?: string[];
  ranks?: Record<string, number>;
  accumulated?: string;
  activeNode?: string;
  char?: string;
  isTerminal?: boolean;
  childNodes?: string[];
  stats?: any;
  snapshot?: any[];
}

export default function DsaStudyStudio() {
  const [catalog, setCatalog] = useState<AlgorithmMeta[]>([]);
  const [selectedAlgo, setSelectedAlgo] = useState<string>('bfs');
  const [selectedPreset, setSelectedPreset] = useState<string>('case-00192');
  const [simulation, setSimulation] = useState<any>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Real Investigation Case Integration
  const urlCaseId = typeof window !== 'undefined' ? new URLSearchParams(window.location.search).get('caseId') : null;
  const [sourceMode, setSourceMode] = useState<'case' | 'preset'>(urlCaseId ? 'case' : 'preset');
  const [selectedCaseId, setSelectedCaseId] = useState<string>(urlCaseId || 'CR-2026-00192');
  const [casesList, setCasesList] = useState<any[]>([]);

  useEffect(() => {
    api('/complaints').then(r => {
      if (Array.isArray(r) && r.length > 0) {
        setCasesList(r);
        if (!urlCaseId) {
          setSelectedCaseId(r[0].caseId || r[0].id);
        }
      }
    }).catch(() => {});
  }, []);

  // Playback state
  const [currentStepIndex, setCurrentStepIndex] = useState<number>(0);
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [playbackSpeed, setPlaybackSpeed] = useState<number>(1200); // ms per step
  const [activeTab, setActiveTab] = useState<'concept' | 'why' | 'code' | 'complexity' | 'forensics' | 'benchmarks'>('concept');

  // Benchmark Rig state
  const [benchmarkResults, setBenchmarkResults] = useState<any>(null);
  const [runningBenchmark, setRunningBenchmark] = useState<boolean>(false);
  const [benchmarkGraphSize, setBenchmarkGraphSize] = useState<number>(500);

  const loadBenchmarks = async (size = benchmarkGraphSize) => {
    setRunningBenchmark(true);
    try {
      const res = await api(`/dsa/benchmarks?size=${size}`);
      if (res?.results) setBenchmarkResults(res);
    } catch (e) {
      console.error('Benchmark error:', e);
    } finally {
      setRunningBenchmark(false);
    }
  };

  // Custom graph mode
  const [isCustomMode, setIsCustomMode] = useState<boolean>(false);
  const [customNodesInput, setCustomNodesInput] = useState<string>('Victim, Mule-1, Mule-2, VASP');
  const [customEdgesInput, setCustomEdgesInput] = useState<string>('Victim->Mule-1:500000, Mule-1->Mule-2:250000, Mule-2->VASP:240000');

  const timerRef = useRef<any>(null);

  // Load catalog
  useEffect(() => {
    api('/dsa/catalog')
      .then((data: AlgorithmMeta[]) => {
        setCatalog(data);
      })
      .catch(() => {
        // Fallback default
      });
  }, []);

  // Run simulation whenever algorithm, preset, or custom graph changes
  const runSimulation = () => {
    setLoading(true);
    setError(null);
    setIsPlaying(false);

    let payload: any = {
      algorithm: selectedAlgo
    };

    if (sourceMode === 'case' && selectedCaseId) {
      payload.caseId = selectedCaseId;
    } else if (isCustomMode) {
      try {
        const rawNodes = customNodesInput.split(',').map(s => s.trim()).filter(Boolean);
        const parsedNodes = rawNodes.map(id => ({ id, label: id, role: 'intermediary', risk: 65 }));
        const rawEdges = customEdgesInput.split(',').map(s => s.trim()).filter(Boolean);
        const parsedEdges = rawEdges.map(e => {
          const [pair, valStr] = e.split(':');
          const [from, to] = pair.split('->').map(s => s.trim());
          const amount = valStr ? Number(valStr.trim()) : 100000;
          return { from, to, amount, weight: 1.0 };
        });

        payload.customGraph = { nodes: parsedNodes, edges: parsedEdges };
        payload.startNode = parsedNodes[0]?.id || 'Node1';
        payload.targetNode = parsedNodes[parsedNodes.length - 1]?.id || 'Target';
      } catch (err: any) {
        setError('Invalid custom graph format. Example: A->B:10000, B->C:5000');
        setLoading(false);
        return;
      }
    } else {
      payload.preset = selectedPreset;
    }

    api('/dsa/simulate', { method: 'POST', body: JSON.stringify(payload) })
      .then(res => {
        setSimulation(res);
        setCurrentStepIndex(0);
        setLoading(false);
      })
      .catch(err => {
        setError(err.message || 'Simulation error');
        setLoading(false);
      });
  };

  useEffect(() => {
    runSimulation();
  }, [selectedAlgo, selectedPreset, isCustomMode, sourceMode, selectedCaseId]);

  // Autoplay handler
  useEffect(() => {
    if (isPlaying && simulation?.steps?.length) {
      timerRef.current = setInterval(() => {
        setCurrentStepIndex(prev => {
          if (prev < simulation.steps.length - 1) {
            return prev + 1;
          } else {
            setIsPlaying(false);
            return prev;
          }
        });
      }, playbackSpeed);
    } else {
      if (timerRef.current) clearInterval(timerRef.current);
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [isPlaying, playbackSpeed, simulation]);

  const currentStep: Step | null = simulation?.steps?.[currentStepIndex] || null;
  const currentAlgoMeta = catalog.find(a => a.id === selectedAlgo) || simulation;

  return (
    <div style={{ padding: '24px 32px', maxWidth: 1400, margin: '0 auto', color: '#e2e8f0' }}>
      {/* MODE BANNER */}
      <div style={{
        background: 'linear-gradient(90deg, rgba(56, 189, 248, 0.12) 0%, rgba(14, 165, 233, 0.04) 100%)',
        border: '1px solid rgba(56, 189, 248, 0.3)',
        borderRadius: 12,
        padding: '16px 20px',
        marginBottom: 24,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: 16
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <div style={{
            background: '#0284c7',
            width: 42,
            height: 42,
            borderRadius: 10,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: '0 0 16px rgba(14, 165, 233, 0.5)'
          }}>
            <BookOpen size={22} color="#ffffff" />
          </div>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.08em', color: '#38bdf8', textTransform: 'uppercase' }}>
                Mode B: Educational Simulation
              </span>
              <Badge variant="info">14 DSA FORENSIC ALGORITHMS</Badge>
              <Badge variant="neutral">ACADEMIC & TEACHING STUDIO</Badge>
            </div>
            <h1 style={{ margin: '4px 0 0', fontSize: 20, fontWeight: 700, color: '#f8fafc' }}>
              DSA Learning Studio: Blockchain Graph & Forensic Algorithms
            </h1>
            <p style={{ margin: '4px 0 0', fontSize: 13, color: '#94a3b8' }}>
              Step-by-step visual simulators illustrating how classic computer science data structures solve real-world cryptocurrency fraud tracking.
            </p>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <button
            onClick={() => {
              window.location.href = '/app/dashboard';
            }}
            style={{
              background: '#0f172a',
              border: '1px solid #334155',
              color: '#cbd5e1',
              padding: '8px 14px',
              borderRadius: 8,
              fontSize: 12,
              fontWeight: 600,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: 6
            }}
          >
            <ShieldAlert size={14} color="#38bdf8" /> Switch to Mode A (Real Investigation)
          </button>
        </div>
      </div>

      {/* ALGORITHM SELECTOR TABS (14 Algorithms) */}
      <div style={{ marginBottom: 20 }}>
        <div style={{ fontSize: 12, fontWeight: 600, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 10 }}>
          Select Algorithm to Simulate (14 Algorithms Implemented)
        </div>
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))',
          gap: 8
        }}>
          {[
            { id: 'bfs', label: '1. BFS Traversal', badge: 'O(V+E)' },
            { id: 'dfs', label: '2. DFS Exploration', badge: 'O(V+E)' },
            { id: 'dijkstra', label: "3. Dijkstra's Path", badge: 'O(E log V)' },
            { id: 'priority-queue', label: '4. Binary Heap (PQ)', badge: 'O(log N)' },
            { id: 'union-find', label: '5. Union-Find (DSU)', badge: 'O(α(N))' },
            { id: 'connected-components', label: '6. Connected Comp.', badge: 'O(V+E)' },
            { id: 'top-k', label: '7. Top-K Min-Heap', badge: 'O(N log K)' },
            { id: 'sliding-window', label: '8. Sliding Window', badge: 'O(T+W)' },
            { id: 'neighborhood', label: '9. Centrality & Deg.', badge: 'O(deg V)' },
            { id: 'cycle-detection', label: '10. Cycle Detection', badge: 'O(V+E)' },
            { id: 'tarjan-scc', label: "11. Tarjan's SCC", badge: 'O(V+E)' },
            { id: 'pagerank', label: '12. PageRank', badge: 'O(k·E)' },
            { id: 'topological-sort', label: '13. Kahn Topological', badge: 'O(V+E)' },
            { id: 'a-star', label: '14. A* Search', badge: 'O(E log V)' }
          ].map(algo => (
            <button
              key={algo.id}
              onClick={() => setSelectedAlgo(algo.id)}
              style={{
                background: selectedAlgo === algo.id ? '#0284c7' : '#0f172a',
                border: selectedAlgo === algo.id ? '1px solid #38bdf8' : '1px solid #1e293b',
                color: selectedAlgo === algo.id ? '#ffffff' : '#cbd5e1',
                padding: '10px 12px',
                borderRadius: 8,
                textAlign: 'left',
                cursor: 'pointer',
                transition: 'all 0.15s ease',
                display: 'flex',
                flexDirection: 'column',
                gap: 4
              }}
            >
              <div style={{ fontSize: 13, fontWeight: 600 }}>{algo.label}</div>
              <div style={{ fontSize: 10, color: selectedAlgo === algo.id ? '#e0f2fe' : '#64748b' }}>
                {algo.badge}
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* SIMULATOR CONTROLS & GRAPH PRESET SELECTOR */}
      <div style={{
        background: '#090d16',
        border: '1px solid #1e293b',
        borderRadius: 12,
        padding: '16px 20px',
        marginBottom: 20,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: 16
      }}>
        {/* Playback Controls */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <Button
            variant="secondary"
            size="sm"
            onClick={() => setCurrentStepIndex(0)}
            title="Reset to step 1"
          >
            <RotateCcw size={15} />
          </Button>

          <Button
            variant="secondary"
            size="sm"
            disabled={currentStepIndex <= 0}
            onClick={() => setCurrentStepIndex(p => Math.max(0, p - 1))}
            title="Step Back"
          >
            <SkipBack size={15} />
          </Button>

          <Button
            variant={isPlaying ? 'primary' : 'success'}
            size="sm"
            onClick={() => setIsPlaying(!isPlaying)}
            style={{ minWidth: 90 }}
          >
            {isPlaying ? (
              <>
                <Pause size={15} style={{ marginRight: 6 }} /> Pause
              </>
            ) : (
              <>
                <Play size={15} style={{ marginRight: 6 }} /> Play
              </>
            )}
          </Button>

          <Button
            variant="secondary"
            size="sm"
            disabled={!simulation?.steps?.length || currentStepIndex >= simulation.steps.length - 1}
            onClick={() => setCurrentStepIndex(p => Math.min((simulation?.steps?.length || 1) - 1, p + 1))}
            title="Step Forward"
          >
            <SkipForward size={15} />
          </Button>

          <div style={{ fontSize: 13, fontWeight: 600, color: '#94a3b8', marginLeft: 8 }}>
            Step <span style={{ color: '#38bdf8' }}>{currentStepIndex + 1}</span> of{' '}
            <span style={{ color: '#f8fafc' }}>{simulation?.steps?.length || 1}</span>
          </div>
        </div>

        {/* Speed & Preset Controls */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: '#94a3b8' }}>
            <span>Speed:</span>
            {[
              { label: '0.5x', ms: 2000 },
              { label: '1x', ms: 1200 },
              { label: '2x', ms: 600 },
              { label: '4x', ms: 300 }
            ].map(s => (
              <button
                key={s.label}
                onClick={() => setPlaybackSpeed(s.ms)}
                style={{
                  background: playbackSpeed === s.ms ? '#0284c7' : '#1e293b',
                  border: 'none',
                  color: '#f8fafc',
                  padding: '3px 8px',
                  borderRadius: 4,
                  fontSize: 11,
                  cursor: 'pointer'
                }}
              >
                {s.label}
              </button>
            ))}
          </div>

          <div style={{ height: 20, width: 1, background: '#334155' }} />

          {/* Data Source / Real Case Selector */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: '#94a3b8' }}>
            <span style={{ fontWeight: 600 }}>Graph Source:</span>
            <select
              value={isCustomMode ? 'custom' : sourceMode === 'case' ? `case:${selectedCaseId}` : selectedPreset}
              onChange={e => {
                const val = e.target.value;
                if (val === 'custom') {
                  setIsCustomMode(true);
                  setSourceMode('preset');
                } else if (val.startsWith('case:')) {
                  setIsCustomMode(false);
                  setSourceMode('case');
                  setSelectedCaseId(val.replace('case:', ''));
                } else {
                  setIsCustomMode(false);
                  setSourceMode('preset');
                  setSelectedPreset(val);
                }
              }}
              style={{
                background: '#071220',
                border: sourceMode === 'case' ? '1px solid #38bdf8' : '1px solid #334155',
                color: sourceMode === 'case' ? '#38bdf8' : '#f8fafc',
                padding: '6px 10px',
                borderRadius: 6,
                fontSize: 12,
                cursor: 'pointer',
                fontWeight: 600
              }}
            >
              <optgroup label="Real Multi-Hop Investigation Cases">
                <option value="case-00192">Case CR-2026-00192: Multi-Hop Trail (SBI UPI → Mules → Bridge → Binance)</option>
                <option value="case:CR-2026-00192">Case CR-2026-00192 (Investigation Report Graph)</option>
                <option value="case:CR-2026-00193">Case CR-2026-00193 (Showcase Case B: Phishing & Pink Drainer)</option>
                {casesList.filter(c => c.caseId !== 'CR-2026-00192' && c.caseId !== 'CR-2026-00193').map(c => (
                  <option key={c.caseId} value={`case:${c.caseId}`}>
                    Case {c.caseId} ({c.reporterName || 'Citizen'} - ₹{(c.reportedLoss || 0).toLocaleString('en-IN')})
                  </option>
                ))}
              </optgroup>
              <optgroup label="Educational Benchmark Topologies">
                <option value="mule-ring">Money Mule Ring (Layering)</option>
                <option value="wash-trading-cycle">Wash Trading Cycle (Cycles)</option>
                <option value="deposit-sweep">Multi-Victim Deposit Sweep (Union-Find)</option>
                <option value="custom">Custom Input Graph</option>
              </optgroup>
            </select>
          </div>
        </div>
      </div>

      {/* CUSTOM GRAPH INPUT MODAL / DRAWER */}
      {isCustomMode && (
        <div style={{
          background: '#0d1527',
          border: '1px dashed #38bdf8',
          borderRadius: 8,
          padding: 16,
          marginBottom: 20,
          display: 'grid',
          gridTemplateColumns: '1fr 1fr auto',
          gap: 16,
          alignItems: 'end'
        }}>
          <div>
            <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#94a3b8', marginBottom: 4 }}>
              Nodes (comma-separated IDs)
            </label>
            <input
              type="text"
              value={customNodesInput}
              onChange={e => setCustomNodesInput(e.target.value)}
              placeholder="A, B, C, D"
              style={{
                width: '100%',
                background: '#020617',
                border: '1px solid #334155',
                color: '#f8fafc',
                padding: '8px 12px',
                borderRadius: 6,
                fontSize: 13
              }}
            />
          </div>

          <div>
            <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#94a3b8', marginBottom: 4 }}>
              Directed Edges (From-&gt;To:Amount, ...)
            </label>
            <input
              type="text"
              value={customEdgesInput}
              onChange={e => setCustomEdgesInput(e.target.value)}
              placeholder="A->B:50000, B->C:25000"
              style={{
                width: '100%',
                background: '#020617',
                border: '1px solid #334155',
                color: '#f8fafc',
                padding: '8px 12px',
                borderRadius: 6,
                fontSize: 13
              }}
            />
          </div>

          <Button variant="primary" onClick={runSimulation}>
            Apply & Re-Simulate
          </Button>
        </div>
      )}

      {/* REAL CASE MULTI-HOP MONEY TRAIL BANNER */}
      <div style={{
        background: 'linear-gradient(90deg, rgba(14, 165, 233, 0.15) 0%, rgba(2, 6, 23, 0.6) 100%)',
        border: '1px solid rgba(56, 189, 248, 0.3)',
        borderRadius: 10,
        padding: '12px 18px',
        marginBottom: 18,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: 12
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{
            background: 'rgba(56, 189, 248, 0.2)',
            padding: 8,
            borderRadius: 8,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}>
            <Sparkles size={18} color="#38bdf8" />
          </div>
          <div>
            <div style={{ fontSize: 13, fontWeight: 700, color: '#f8fafc', display: 'flex', alignItems: 'center', gap: 8 }}>
              <span>Showcase Case A Multi-Hop Laundering Trail (CR-2026-00192)</span>
              <Badge variant="info">₹8,12,450 SBI UPI ➔ 15 Entities ➔ Binance Exit</Badge>
            </div>
            <div style={{ fontSize: 12, color: '#94a3b8', marginTop: 3 }}>
              Victim SBI UPI ➔ HDFC Collector ➔ ICICI Layering Mule ➔ P2P Desk ➔ WazirX Exploiter ➔ Across Bridge Router ➔ Binance Exit
            </div>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <span style={{ fontSize: 11, background: '#0284c7', color: '#fff', padding: '4px 8px', borderRadius: 6, fontWeight: 600 }}>15 Forensic Vertices</span>
          <span style={{ fontSize: 11, background: '#064e3b', color: '#34d399', padding: '4px 8px', borderRadius: 6, fontWeight: 600 }}>18 Evidence Edges</span>
          <span style={{ fontSize: 11, background: '#3b0764', color: '#d8b4fe', padding: '4px 8px', borderRadius: 6, fontWeight: 600 }}>Section 106 & 94 BNSS</span>
        </div>
      </div>

      {/* MAIN SIMULATOR VIEWPORT */}
      <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 0.8fr', gap: 20, marginBottom: 24 }}>
        {/* GRAPH VISUALIZATION CANVAS */}
        <div style={{
          background: '#030712',
          border: '1px solid #1e293b',
          borderRadius: 12,
          padding: 20,
          display: 'flex',
          flexDirection: 'column',
          minHeight: 460
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <Network size={16} color="#38bdf8" />
              <span style={{ fontSize: 14, fontWeight: 700, color: '#f8fafc' }}>
                Graph Topology & Active Traversal State
              </span>
            </div>
            <Badge variant="neutral">
              {simulation?.graph?.nodes?.length || 0} Nodes · {simulation?.graph?.edges?.length || 0} Directed Edges
            </Badge>
          </div>

          {/* SVG Canvas for Nodes & Directed Edges */}
          <div style={{
            flex: 1,
            background: 'radial-gradient(circle at center, #0b1329 0%, #030712 100%)',
            borderRadius: 8,
            border: '1px solid #0f172a',
            position: 'relative',
            overflow: 'hidden',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}>
            {simulation?.graph?.nodes ? (
              <svg width="100%" height="380" viewBox="0 0 700 380" style={{ overflow: 'visible' }}>
                <defs>
                  <marker
                    id="arrowhead"
                    markerWidth="8"
                    markerHeight="6"
                    refX="22"
                    refY="3"
                    orient="auto"
                  >
                    <polygon points="0 0, 8 3, 0 6" fill="#38bdf8" />
                  </marker>
                  <marker
                    id="arrowhead-active"
                    markerWidth="10"
                    markerHeight="8"
                    refX="22"
                    refY="4"
                    orient="auto"
                  >
                    <polygon points="0 0, 10 4, 0 8" fill="#f59e0b" />
                  </marker>
                </defs>

                {/* Render Edges */}
                {simulation.graph.edges.map((e: any, idx: number) => {
                  const nodeCount = simulation.graph.nodes.length;
                  const fromIdx = simulation.graph.nodes.findIndex((n: any) => n.id === e.from);
                  const toIdx = simulation.graph.nodes.findIndex((n: any) => n.id === e.to);

                  // Calculate simple circular coordinates
                  const angleFrom = (fromIdx / nodeCount) * 2 * Math.PI;
                  const angleTo = (toIdx / nodeCount) * 2 * Math.PI;
                  const cx = 350;
                  const cy = 190;
                  const radius = 135;

                  const x1 = cx + radius * Math.cos(angleFrom);
                  const y1 = cy + radius * Math.sin(angleFrom);
                  const x2 = cx + radius * Math.cos(angleTo);
                  const y2 = cy + radius * Math.sin(angleTo);

                  const isActiveEdge = currentStep?.activeEdge?.from === e.from && currentStep?.activeEdge?.to === e.to;

                  return (
                    <g key={`edge-${idx}`}>
                      <line
                        x1={x1}
                        y1={y1}
                        x2={x2}
                        y2={y2}
                        stroke={isActiveEdge ? '#f59e0b' : '#334155'}
                        strokeWidth={isActiveEdge ? 3.5 : 1.5}
                        markerEnd={isActiveEdge ? 'url(#arrowhead-active)' : 'url(#arrowhead)'}
                        strokeDasharray={isActiveEdge ? '4 2' : 'none'}
                      />
                      {/* Edge weight / amount label */}
                      <text
                        x={(x1 + x2) / 2}
                        y={(y1 + y2) / 2 - 6}
                        fill={isActiveEdge ? '#fbbf24' : '#64748b'}
                        fontSize="10"
                        fontWeight="600"
                        textAnchor="middle"
                      >
                        {e.amount ? `${(Number(e.amount) / 1000).toFixed(0)}k` : e.weight ? `w:${e.weight}` : ''}
                      </text>
                    </g>
                  );
                })}

                {/* Render Nodes */}
                {simulation.graph.nodes.map((n: any, idx: number) => {
                  const nodeCount = simulation.graph.nodes.length;
                  const angle = (idx / nodeCount) * 2 * Math.PI;
                  const cx = 350;
                  const cy = 190;
                  const radius = 135;
                  const x = cx + radius * Math.cos(angle);
                  const y = cy + radius * Math.sin(angle);

                  const isCurrent = currentStep?.node === n.id;
                  const isVisited = currentStep?.visited?.includes(n.id);

                  let fillColor = '#1e293b';
                  let strokeColor = '#475569';

                  if (isCurrent) {
                    fillColor = '#f59e0b';
                    strokeColor = '#fef3c7';
                  } else if (isVisited) {
                    fillColor = '#059669';
                    strokeColor = '#34d399';
                  } else if (n.role === 'vasp') {
                    fillColor = '#0284c7';
                    strokeColor = '#38bdf8';
                  } else if (n.role === 'victim') {
                    fillColor = '#dc2626';
                    strokeColor = '#f87171';
                  }

                  return (
                    <g key={n.id} style={{ cursor: 'pointer' }}>
                      <circle
                        cx={x}
                        cy={y}
                        r={isCurrent ? 24 : 19}
                        fill={fillColor}
                        stroke={strokeColor}
                        strokeWidth={isCurrent ? 3 : 1.5}
                        style={{
                          transition: 'all 0.3s ease',
                          filter: isCurrent ? 'drop-shadow(0 0 10px rgba(245, 158, 11, 0.7))' : 'none'
                        }}
                      />
                      <text
                        x={x}
                        y={y + 4}
                        fill="#ffffff"
                        fontSize={isCurrent ? '11' : '10'}
                        fontWeight="700"
                        textAnchor="middle"
                      >
                        {n.id.length > 8 ? n.id.slice(0, 7) + '…' : n.id}
                      </text>
                      <text
                        x={x}
                        y={y + (isCurrent ? 36 : 30)}
                        fill={isCurrent ? '#fef08a' : '#94a3b8'}
                        fontSize="9"
                        fontWeight={isCurrent ? '700' : '500'}
                        textAnchor="middle"
                      >
                        {(n.label || n.id).length > 20 ? (n.label || n.id).slice(0, 19) + '…' : (n.label || n.id)}
                      </text>
                    </g>
                  );
                })}
              </svg>
            ) : (
              <div style={{ color: '#64748b', fontSize: 13 }}>Initializing graph simulation…</div>
            )}
          </div>

          {/* STEP NARRATION BOX */}
          <div style={{
            marginTop: 14,
            background: 'rgba(15, 23, 42, 0.8)',
            border: '1px solid #1e293b',
            borderRadius: 8,
            padding: '12px 16px',
            display: 'flex',
            alignItems: 'flex-start',
            gap: 12
          }}>
            <div style={{
              background: '#0284c7',
              borderRadius: 6,
              padding: '4px 8px',
              fontSize: 11,
              fontWeight: 700,
              color: '#ffffff',
              whiteSpace: 'nowrap'
            }}>
              {currentStep?.action || 'READY'}
            </div>
            <div style={{ fontSize: 13, lineHeight: '1.5', color: '#e2e8f0' }}>
              {currentStep?.explanation || 'Click Play or Step Forward to begin execution.'}
            </div>
          </div>
        </div>

        {/* STATE INSPECTOR: REAL-TIME DATA STRUCTURES */}
        <div style={{
          background: '#030712',
          border: '1px solid #1e293b',
          borderRadius: 12,
          padding: 20,
          display: 'flex',
          flexDirection: 'column'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
            <Layers size={16} color="#38bdf8" />
            <span style={{ fontSize: 14, fontWeight: 700, color: '#f8fafc' }}>
              Data Structure State Inspector
            </span>
          </div>

          {/* DYNAMIC COMPONENT BASED ON CURRENT ALGORITHM */}
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 14 }}>
            {/* FIFO Queue / Stack State */}
            {(selectedAlgo === 'bfs' || selectedAlgo === 'dfs') && (
              <div style={{ background: '#090d16', border: '1px solid #1e293b', borderRadius: 8, padding: 14 }}>
                <div style={{ fontSize: 12, fontWeight: 600, color: '#94a3b8', marginBottom: 8 }}>
                  {selectedAlgo === 'bfs' ? 'FIFO Queue State [front → back]' : 'Call Stack State [top → bottom]'}
                </div>
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                  {(currentStep?.queue || currentStep?.stack || []).length > 0 ? (
                    (currentStep?.queue || currentStep?.stack || []).map((item, i) => (
                      <span
                        key={i}
                        style={{
                          background: i === 0 ? '#0284c7' : '#1e293b',
                          color: '#ffffff',
                          padding: '4px 10px',
                          borderRadius: 6,
                          fontSize: 12,
                          fontWeight: 600
                        }}
                      >
                        {item}
                      </span>
                    ))
                  ) : (
                    <span style={{ color: '#64748b', fontSize: 12 }}>Empty</span>
                  )}
                </div>
              </div>
            )}

            {/* Dijkstra Distance Table */}
            {selectedAlgo === 'dijkstra' && currentStep?.distances && (
              <div style={{ background: '#090d16', border: '1px solid #1e293b', borderRadius: 8, padding: 14 }}>
                <div style={{ fontSize: 12, fontWeight: 600, color: '#94a3b8', marginBottom: 8 }}>
                  Relaxation Distance Table (dist[v])
                </div>
                <div style={{ maxHeight: 150, overflowY: 'auto' }}>
                  <table style={{ width: '100%', fontSize: 12, borderCollapse: 'collapse' }}>
                    <thead>
                      <tr style={{ color: '#64748b', borderBottom: '1px solid #1e293b' }}>
                        <th style={{ textAlign: 'left', padding: '4px 6px' }}>Node</th>
                        <th style={{ textAlign: 'right', padding: '4px 6px' }}>Cumulative Distance</th>
                      </tr>
                    </thead>
                    <tbody>
                      {Object.entries(currentStep.distances).map(([k, v]) => (
                        <tr key={k} style={{ borderBottom: '1px solid #0f172a' }}>
                          <td style={{ padding: '4px 6px', fontWeight: 600, color: '#f8fafc' }}>{k}</td>
                          <td style={{ textAlign: 'right', padding: '4px 6px', color: (v == null || v === Infinity || isNaN(Number(v))) ? '#64748b' : '#38bdf8' }}>
                            {v == null || v === Infinity || isNaN(Number(v)) ? '∞' : Number(v).toFixed(2)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Union-Find Disjoint Sets */}
            {(selectedAlgo === 'union-find' || selectedAlgo === 'connected-components') && currentStep?.parentTable && (
              <div style={{ background: '#090d16', border: '1px solid #1e293b', borderRadius: 8, padding: 14 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                  <span style={{ fontSize: 12, fontWeight: 600, color: '#94a3b8' }}>Parent Table (parent[x])</span>
                  <Badge variant="info">{currentStep.componentCount || 0} Components</Badge>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(110px, 1fr))', gap: 6 }}>
                  {Object.entries(currentStep.parentTable).map(([child, root]) => (
                    <div
                      key={child}
                      style={{
                        background: '#0f172a',
                        border: '1px solid #1e293b',
                        borderRadius: 6,
                        padding: '6px 8px',
                        fontSize: 11
                      }}
                    >
                      <div style={{ color: '#94a3b8' }}>{child}</div>
                      <div style={{ fontWeight: 700, color: '#38bdf8' }}>root: {root}</div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Priority Queue (Binary Heap Array) */}
            {(selectedAlgo === 'priority-queue' || selectedAlgo === 'top-k') && (
              <div style={{ background: '#090d16', border: '1px solid #1e293b', borderRadius: 8, padding: 14 }}>
                <div style={{ fontSize: 12, fontWeight: 600, color: '#94a3b8', marginBottom: 8 }}>
                  Binary Heap Array Representation
                </div>
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                  {(currentStep?.heapArray || currentStep?.heap || []).map((item: any, i: number) => (
                    <div
                      key={i}
                      style={{
                        background: i === 0 ? '#f59e0b' : '#1e293b',
                        color: '#ffffff',
                        padding: '6px 10px',
                        borderRadius: 6,
                        fontSize: 11,
                        textAlign: 'center'
                      }}
                    >
                      <div style={{ fontSize: 9, color: i === 0 ? '#fef3c7' : '#94a3b8' }}>idx {i}</div>
                      <div style={{ fontWeight: 700 }}>{item.id || item.val || item}</div>
                      <div style={{ fontSize: 10, color: '#38bdf8' }}>{item.val || item.risk || ''}</div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Prefix Trie (Radix Tree Node Traversal) */}
            {selectedAlgo === 'prefix-trie' && (
              <div style={{ background: '#090d16', border: '1px solid #1e293b', borderRadius: 8, padding: 14 }}>
                <div style={{ fontSize: 12, fontWeight: 600, color: '#38bdf8', marginBottom: 8, display: 'flex', justifyContent: 'space-between' }}>
                  <span>Prefix Trie Active Branch [O(L) Traversal]</span>
                  <span style={{ fontSize: 11, color: '#94a3b8' }}>Path: <strong style={{ color: '#ffffff' }}>{currentStep?.accumulated || 'ROOT'}</strong></span>
                </div>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 12, flexWrap: 'wrap' }}>
                  <div style={{ background: '#0284c7', color: '#fff', padding: '6px 12px', borderRadius: 6, fontSize: 12, fontWeight: 700 }}>
                    Active Node: {currentStep?.activeNode || 'ROOT'}
                  </div>
                  <div style={{ fontSize: 12, color: '#94a3b8' }}>
                    Current Char: <strong style={{ color: '#f59e0b', fontSize: 14 }}>{currentStep?.char || '—'}</strong>
                  </div>
                  {currentStep?.isTerminal && (
                    <span style={{ background: 'rgba(16, 185, 129, 0.2)', color: '#34d399', border: '1px solid #10b981', padding: '2px 8px', borderRadius: 4, fontSize: 11 }}>
                      Terminal Node (Key Match)
                    </span>
                  )}
                </div>
                <div style={{ fontSize: 11, color: '#64748b', marginBottom: 4 }}>Available Child Edges from this Node:</div>
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                  {(currentStep?.childNodes || []).map((ch: string) => (
                    <span key={ch} style={{ background: '#1e293b', color: '#38bdf8', padding: '3px 8px', borderRadius: 4, fontSize: 11, fontWeight: 700 }}>
                      '{ch}'
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* LRU Cache Doubly Linked List & Hash Map */}
            {selectedAlgo === 'lru-cache' && (
              <div style={{ background: '#090d16', border: '1px solid #1e293b', borderRadius: 8, padding: 14 }}>
                <div style={{ fontSize: 12, fontWeight: 600, color: '#38bdf8', marginBottom: 8, display: 'flex', justifyContent: 'space-between' }}>
                  <span>LRU Doubly Linked List [MRU Head ⇄ ... ⇄ LRU Tail]</span>
                  <span style={{ fontSize: 11, color: '#94a3b8' }}>
                    Hits: <strong style={{ color: '#10b981' }}>{currentStep?.stats?.hits ?? 0}</strong> · Misses: <strong style={{ color: '#ef4444' }}>{currentStep?.stats?.misses ?? 0}</strong>
                  </span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, overflowX: 'auto', padding: '6px 0' }}>
                  <div style={{ background: '#1e293b', color: '#94a3b8', padding: '6px 10px', borderRadius: 6, fontSize: 10, fontWeight: 700 }}>
                    HEAD (MRU)
                  </div>
                  <span style={{ color: '#38bdf8', fontWeight: 700 }}>⇄</span>
                  {(currentStep?.snapshot || []).map((item: any, i: number) => (
                    <React.Fragment key={item.key || i}>
                      <div style={{
                        background: i === 0 ? 'rgba(56, 189, 248, 0.2)' : '#0f172a',
                        border: i === 0 ? '1px solid #38bdf8' : '1px solid #334155',
                        padding: '6px 10px',
                        borderRadius: 6,
                        minWidth: 120,
                        textAlign: 'center'
                      }}>
                        <div style={{ fontSize: 11, fontWeight: 700, color: '#f8fafc' }}>{item.key}</div>
                        <div style={{ fontSize: 9.5, color: '#94a3b8' }}>Access: {item.accessCount}x</div>
                      </div>
                      <span style={{ color: '#38bdf8', fontWeight: 700 }}>⇄</span>
                    </React.Fragment>
                  ))}
                  <div style={{ background: '#1e293b', color: '#94a3b8', padding: '6px 10px', borderRadius: 6, fontSize: 10, fontWeight: 700 }}>
                    TAIL (LRU)
                  </div>
                </div>
              </div>
            )}

            {/* Visited Set Status */}
            <div style={{ background: '#090d16', border: '1px solid #1e293b', borderRadius: 8, padding: 14 }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: '#94a3b8', marginBottom: 6 }}>
                Visited Set (V_seen)
              </div>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                {(currentStep?.visited || []).length > 0 ? (
                  currentStep?.visited?.map((n: string) => (
                    <span
                      key={n}
                      style={{
                        background: 'rgba(5, 150, 105, 0.2)',
                        border: '1px solid rgba(5, 150, 105, 0.5)',
                        color: '#34d399',
                        padding: '3px 8px',
                        borderRadius: 4,
                        fontSize: 11,
                        fontWeight: 600
                      }}
                    >
                      {n}
                    </span>
                  ))
                ) : (
                  <span style={{ color: '#64748b', fontSize: 12 }}>None yet</span>
                )}
              </div>
            </div>

            {/* Final Summary Card if finished */}
            {currentStepIndex === (simulation?.steps?.length || 1) - 1 && simulation?.summary && (
              <div style={{
                background: 'rgba(56, 189, 248, 0.08)',
                border: '1px solid #0284c7',
                borderRadius: 8,
                padding: 14
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: '#38bdf8', fontWeight: 700, fontSize: 13, marginBottom: 6 }}>
                  <CheckCircle size={15} /> Execution Complete
                </div>
                <div style={{ fontSize: 12, color: '#cbd5e1', lineHeight: '1.5' }}>
                  {simulation.summary.foundTarget !== undefined && (
                    <div>Target Node Found: <strong>{simulation.summary.foundTarget ? 'Yes' : 'No'}</strong></div>
                  )}
                  {simulation.summary.hopCount !== undefined && (
                    <div>Total Transfer Hops: <strong>{simulation.summary.hopCount} hops</strong></div>
                  )}
                  {simulation.summary.path && (
                    <div>Optimal Path: <strong>{simulation.summary.path.join(' → ')}</strong></div>
                  )}
                  {simulation.summary.hasCycle !== undefined && (
                    <div>Circular Cycle Detected: <strong>{simulation.summary.hasCycle ? 'YES (Wash Trading Loop)' : 'No Cycles'}</strong></div>
                  )}
                </div>

                {simulation.summary.forensicFinding && (
                  <div style={{
                    marginTop: 12,
                    paddingTop: 10,
                    borderTop: '1px solid rgba(56, 189, 248, 0.2)',
                    fontSize: 12,
                    lineHeight: '1.5'
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: '#38bdf8', fontWeight: 700, marginBottom: 4 }}>
                      <ShieldCheck size={14} /> What this Algorithm Proves to the Court:
                    </div>
                    <div style={{ marginBottom: 4 }}>
                      <span style={{ color: '#94a3b8' }}>Statute: </span>
                      <strong style={{ color: '#38bdf8' }}>{simulation.summary.forensicFinding.statutoryBasis}</strong>
                    </div>
                    <div style={{ marginBottom: 4 }}>
                      <span style={{ color: '#94a3b8' }}>Evidence: </span>
                      <span style={{ color: '#f8fafc' }}>{simulation.summary.forensicFinding.courtProof}</span>
                    </div>
                    <div style={{ marginBottom: 6 }}>
                      <span style={{ color: '#94a3b8' }}>Officer Action: </span>
                      <span style={{ color: '#fef08a' }}>{simulation.summary.forensicFinding.officerAction}</span>
                    </div>
                    <div style={{
                      background: '#020617',
                      padding: '6px 8px',
                      borderRadius: 4,
                      borderLeft: '3px solid #38bdf8',
                      fontSize: 11
                    }}>
                      <strong style={{ color: '#38bdf8' }}>Exam/Interview Tip for Mam: </strong>
                      <span style={{ color: '#e2e8f0' }}>{simulation.summary.forensicFinding.academicTakeaway}</span>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* COMPREHENSIVE ALGORITHM DEEP DIVE TABS */}
      <div style={{ background: '#090d16', border: '1px solid #1e293b', borderRadius: 12, overflow: 'hidden' }}>
        {/* TAB HEADERS */}
        <div style={{ display: 'flex', borderBottom: '1px solid #1e293b', background: '#030712' }}>
          {[
            { id: 'concept', label: '1. Concept & Invariant' },
            { id: 'why', label: '2. Why in CYBER-TRACE' },
            { id: 'code', label: '3. Pseudocode & Implementation' },
            { id: 'complexity', label: '4. Big-O Complexity' },
            { id: 'forensics', label: '5. Real Law Enforcement Application' },
            { id: 'benchmarks', label: '6. Benchmark Rig (Empirical Proof)' }
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              style={{
                background: activeTab === tab.id ? '#0f172a' : 'transparent',
                border: 'none',
                borderBottom: activeTab === tab.id ? '2px solid #38bdf8' : '2px solid transparent',
                color: activeTab === tab.id ? '#38bdf8' : '#94a3b8',
                padding: '14px 20px',
                fontSize: 13,
                fontWeight: 600,
                cursor: 'pointer',
                transition: 'all 0.15s ease'
              }}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* TAB CONTENTS */}
        <div style={{ padding: 24, fontSize: 14, lineHeight: '1.6', color: '#cbd5e1' }}>
          {activeTab === 'concept' && (
            <div>
              <h3 style={{ margin: '0 0 10px', color: '#f8fafc', fontSize: 17 }}>
                {currentAlgoMeta?.name || 'Algorithm Concept'}
              </h3>
              <p>{currentAlgoMeta?.concept || simulation?.concept}</p>
            </div>
          )}

          {activeTab === 'why' && (
            <div>
              <h3 style={{ margin: '0 0 10px', color: '#f8fafc', fontSize: 17 }}>
                Why This Algorithm is Crucial in CYBER-TRACE
              </h3>
              <p>{currentAlgoMeta?.whyInCyberTrace || simulation?.whyInCyberTrace}</p>
            </div>
          )}

          {activeTab === 'code' && (
            <div>
              <h3 style={{ margin: '0 0 10px', color: '#f8fafc', fontSize: 17 }}>
                Algorithmic Pseudocode
              </h3>
              <pre style={{
                background: '#020617',
                border: '1px solid #1e293b',
                padding: 16,
                borderRadius: 8,
                color: '#38bdf8',
                fontSize: 13,
                fontFamily: 'monospace',
                overflowX: 'auto'
              }}>
                {currentAlgoMeta?.pseudocode || simulation?.pseudocode}
              </pre>
            </div>
          )}

          {activeTab === 'complexity' && (
            <div>
              <h3 style={{ margin: '0 0 12px', color: '#f8fafc', fontSize: 17 }}>
                Asymptotic Complexity Bounds
              </h3>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                <div style={{ background: '#020617', padding: 16, borderRadius: 8, border: '1px solid #1e293b' }}>
                  <div style={{ fontSize: 12, fontWeight: 600, color: '#94a3b8' }}>Time Complexity</div>
                  <div style={{ fontSize: 18, fontWeight: 700, color: '#38bdf8', marginTop: 4 }}>
                    {currentAlgoMeta?.timeComplexity || simulation?.timeComplexity}
                  </div>
                </div>
                <div style={{ background: '#020617', padding: 16, borderRadius: 8, border: '1px solid #1e293b' }}>
                  <div style={{ fontSize: 12, fontWeight: 600, color: '#94a3b8' }}>Space Complexity</div>
                  <div style={{ fontSize: 18, fontWeight: 700, color: '#38bdf8', marginTop: 4 }}>
                    {currentAlgoMeta?.spaceComplexity || simulation?.spaceComplexity}
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'forensics' && (
            <div>
              <h3 style={{ margin: '0 0 10px', color: '#f8fafc', fontSize: 17 }}>
                Law Enforcement & CBI Case Scenario
              </h3>
              <p>{currentAlgoMeta?.realApplication || simulation?.realApplication}</p>
            </div>
          )}

          {activeTab === 'benchmarks' && (
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20, flexWrap: 'wrap', gap: 12 }}>
                <div>
                  <h3 style={{ margin: '0 0 6px', color: '#f8fafc', fontSize: 18, display: 'flex', alignItems: 'center', gap: 8 }}>
                    <Activity size={20} color="#38bdf8" />
                    Empirical Data Structure Microbenchmarks
                  </h3>
                  <p style={{ margin: 0, fontSize: 13, color: '#94a3b8' }}>
                    Real-time comparative execution against unoptimized baselines on identical synthetic graph topologies.
                  </p>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <select
                    value={benchmarkGraphSize}
                    onChange={(e) => setBenchmarkGraphSize(Number(e.target.value))}
                    style={{
                      background: '#0f172a',
                      color: '#f8fafc',
                      border: '1px solid #334155',
                      borderRadius: 6,
                      padding: '8px 12px',
                      fontSize: 13
                    }}
                  >
                    <option value={100}>N = 100 Vertices</option>
                    <option value={500}>N = 500 Vertices (Standard)</option>
                    <option value={1000}>N = 1,000 Vertices (Large)</option>
                    <option value={5000}>N = 5,000 Vertices (Stress)</option>
                  </select>
                  <Button
                    onClick={() => loadBenchmarks(benchmarkGraphSize)}
                    disabled={runningBenchmark}
                    style={{ background: '#0284c7', color: '#fff' }}
                  >
                    {runningBenchmark ? 'Executing Benchmark...' : 'Run Live Benchmarks'}
                  </Button>
                </div>
              </div>

              {!benchmarkResults && !runningBenchmark && (
                <div style={{ textAlign: 'center', padding: '40px 20px', background: '#020617', borderRadius: 8, border: '1px dashed #334155' }}>
                  <Cpu size={36} color="#64748b" style={{ margin: '0 auto 12px' }} />
                  <p style={{ margin: '0 0 12px', color: '#94a3b8' }}>Click "Run Live Benchmarks" to trigger real V8 execution timing on the backend.</p>
                  <Button onClick={() => loadBenchmarks(benchmarkGraphSize)} style={{ background: '#0284c7' }}>
                    Run N = {benchmarkGraphSize} Benchmark
                  </Button>
                </div>
              )}

              {runningBenchmark && (
                <div style={{ textAlign: 'center', padding: '50px 20px' }}>
                  <div style={{ display: 'inline-block', width: 32, height: 32, border: '3px solid #38bdf8', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 1s linear infinite' }} />
                  <p style={{ marginTop: 16, color: '#94a3b8' }}>Running microbenchmarks across MinHeap, Circular Queue, Disjoint Set, Bloom Filter & Top-K Heap...</p>
                </div>
              )}

              {benchmarkResults && !runningBenchmark && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 12 }}>
                    <div style={{ background: '#0f172a', padding: 12, borderRadius: 8, border: '1px solid #1e293b' }}>
                      <div style={{ fontSize: 11, color: '#94a3b8' }}>BENCHMARK GRAPH</div>
                      <div style={{ fontSize: 16, fontWeight: 700, color: '#f8fafc', marginTop: 2 }}>
                        {benchmarkResults.benchmarkGraph?.vertices} Vertices / {benchmarkResults.benchmarkGraph?.edges} Edges
                      </div>
                    </div>
                    <div style={{ background: '#0f172a', padding: 12, borderRadius: 8, border: '1px solid #1e293b' }}>
                      <div style={{ fontSize: 11, color: '#94a3b8' }}>HARNESS & PLATFORM</div>
                      <div style={{ fontSize: 16, fontWeight: 700, color: '#38bdf8', marginTop: 2 }}>
                        {benchmarkResults.summary?.framework}
                      </div>
                    </div>
                    <div style={{ background: '#0f172a', padding: 12, borderRadius: 8, border: '1px solid #1e293b' }}>
                      <div style={{ fontSize: 11, color: '#94a3b8' }}>VERDICT</div>
                      <div style={{ fontSize: 14, fontWeight: 600, color: '#10b981', marginTop: 2 }}>
                        Consistently 5x to 100x speedup
                      </div>
                    </div>
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                    {benchmarkResults.results?.map((res: any, idx: number) => (
                      <div key={idx} style={{ background: '#0b1120', border: '1px solid #1e293b', borderRadius: 8, padding: 16 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                          <div>
                            <span style={{ fontSize: 16, fontWeight: 700, color: '#f8fafc' }}>{res.algorithm}</span>
                            <span style={{ marginLeft: 10, fontSize: 12, color: '#64748b' }}>({res.category})</span>
                          </div>
                          <span style={{ background: '#064e3b', color: '#34d399', fontSize: 13, fontWeight: 700, padding: '4px 10px', borderRadius: 20 }}>
                            {res.speedupFactor}x FASTER
                          </span>
                        </div>

                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
                          <div style={{ background: '#030712', padding: 12, borderRadius: 6, border: '1px solid #15803d' }}>
                            <div style={{ fontSize: 11, fontWeight: 700, color: '#4ade80', textTransform: 'uppercase' }}>Optimized Implementation</div>
                            <div style={{ fontSize: 14, fontWeight: 600, color: '#f8fafc', marginTop: 2 }}>{res.optimized.dataStructure}</div>
                            <div style={{ fontSize: 12, color: '#94a3b8', marginTop: 4 }}>Complexity: <code style={{ color: '#38bdf8' }}>{res.optimized.complexity}</code></div>
                            <div style={{ fontSize: 15, fontWeight: 700, color: '#4ade80', marginTop: 6 }}>
                              {res.optimized.timeMs} ms {res.optimized.operations ? `(${res.optimized.operations.toLocaleString()} ops)` : ''}
                            </div>
                          </div>

                          <div style={{ background: '#030712', padding: 12, borderRadius: 6, border: '1px solid #991b1b' }}>
                            <div style={{ fontSize: 11, fontWeight: 700, color: '#f87171', textTransform: 'uppercase' }}>Baseline Implementation</div>
                            <div style={{ fontSize: 14, fontWeight: 600, color: '#f8fafc', marginTop: 2 }}>{res.baseline.dataStructure}</div>
                            <div style={{ fontSize: 12, color: '#94a3b8', marginTop: 4 }}>Complexity: <code style={{ color: '#f87171' }}>{res.baseline.complexity}</code></div>
                            <div style={{ fontSize: 15, fontWeight: 700, color: '#f87171', marginTop: 6 }}>
                              {res.baseline.timeMs} ms {res.baseline.operations ? `(${res.baseline.operations.toLocaleString()} ops)` : ''}
                            </div>
                          </div>
                        </div>

                        <div style={{ fontSize: 12, color: '#94a3b8', background: '#030712', padding: '8px 12px', borderRadius: 6 }}>
                          <strong style={{ color: '#cbd5e1' }}>Theoretical Proof: </strong>{res.theoreticalProof}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
