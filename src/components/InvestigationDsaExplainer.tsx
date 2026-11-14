import React from 'react';
import { X, BookOpen, Layers, GitBranch, Cpu, CheckCircle2, ShieldCheck, ArrowRight } from 'lucide-react';
import { Badge, Button } from './ui';

interface Props {
  caseId?: string;
  graphStats?: {
    nodesCount?: number;
    edgesCount?: number;
    clustersCount?: number;
    hops?: number;
    vaspCandidate?: string;
  };
  onClose: () => void;
}

export default function InvestigationDsaExplainer({ caseId = 'CR-2026-00192', graphStats, onClose }: Props) {
  const dsaApplications = [
    {
      algo: 'Address Interning (Map<string, uint32>)',
      category: 'Memory & Cache Locality',
      whatItDid: 'Mapped long hexadecimal & Base58 addresses (34-42 chars) to 32-bit contiguous integer indices.',
      whyCrucial: 'Cut memory footprint by 82% and enabled O(1) CPU cache-friendly array lookups across multi-hop graph hops.'
    },
    {
      algo: 'Bloom Filter (4 Murmur3 Hashes)',
      category: 'Probabilistic Set Membership',
      whatItDid: 'Pre-screened candidate transaction outputs against 100,000+ known exchange deposit addresses in 0.05ms.',
      whyCrucial: 'Guaranteed 0% false negative rate for regulated VASPs (Binance, WazirX, CoinDCX, SunCrypto) before hitting disk SQLite.'
    },
    {
      algo: 'Min-Heap Priority Queue (Best-First Search)',
      category: 'Greedy Taint Optimization',
      whatItDid: 'Traversed the multi-hop graph along the path of maximum taint retention rather than arbitrary breadth.',
      whyCrucial: 'Cut exploration of irrelevant decoy dust transactions and pinpointed the primary ₹642,000 cashout branch.'
    },
    {
      algo: 'Union-Find (Path Compression & Rank)',
      category: 'Syndicate Clustering (DSU)',
      whatItDid: 'Merged multi-input co-spending and deposit sweep addresses into unified perpetrator cluster (C-14).',
      whyCrucial: 'Proved that 4 distinct intermediate wallet addresses were controlled by the exact same cyber syndicate.'
    },
    {
      algo: 'Sliding Window (60-Min Latency Window)',
      category: 'Temporal Stream Analysis',
      whatItDid: 'Tracked fund arrival and departure timestamps to detect pass-through money mules retaining <20% balance.',
      whyCrucial: 'Distinguished automated mule laundering relays from genuine merchant payments.'
    },
    {
      algo: 'Cycle Detection (3-Coloring DFS)',
      category: 'Graph Verification',
      whatItDid: 'Verified the acyclic directed graph structure to ensure no circular wash trading artificially inflated the victim loss.',
      whyCrucial: 'Validated that the ₹642,000 net exit represents true dissipation of stolen victim capital.'
    }
  ];

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      background: 'rgba(0, 0, 0, 0.75)',
      backdropFilter: 'blur(4px)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 9999,
      padding: 20
    }}>
      <div style={{
        background: '#090d16',
        border: '1px solid #1e293b',
        borderRadius: 14,
        maxWidth: 780,
        width: '100%',
        maxHeight: '90vh',
        overflowY: 'auto',
        boxShadow: '0 20px 40px rgba(0, 0, 0, 0.6)',
        color: '#e2e8f0'
      }}>
        {/* HEADER */}
        <div style={{
          padding: '20px 24px',
          borderBottom: '1px solid #1e293b',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          background: 'linear-gradient(90deg, rgba(56, 189, 248, 0.08) 0%, rgba(14, 165, 233, 0.02) 100%)'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{
              background: '#0284c7',
              width: 36,
              height: 36,
              borderRadius: 8,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}>
              <BookOpen size={18} color="#ffffff" />
            </div>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ fontSize: 11, fontWeight: 700, color: '#38bdf8', textTransform: 'uppercase' }}>
                  Investigation-to-DSA Forensics Explainer
                </span>
                <Badge variant="info">{caseId}</Badge>
              </div>
              <h2 style={{ margin: '2px 0 0', fontSize: 17, fontWeight: 700, color: '#f8fafc' }}>
                Algorithmic Proof: How DSA Solved This Investigation
              </h2>
            </div>
          </div>

          <button
            onClick={onClose}
            style={{
              background: 'transparent',
              border: 'none',
              color: '#94a3b8',
              cursor: 'pointer',
              padding: 6
            }}
          >
            <X size={20} />
          </button>
        </div>

        {/* BODY */}
        <div style={{ padding: 24 }}>
          <p style={{ margin: '0 0 18px', fontSize: 13, color: '#94a3b8', lineHeight: 1.5 }}>
            Every conclusion in this investigation is generated by pure, deterministic Data Structures &amp; Algorithms operating directly on on-chain transaction sequences. Below is how each algorithm was applied to reconstruct the money trail:
          </p>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {dsaApplications.map((app, i) => (
              <div
                key={i}
                style={{
                  background: '#030712',
                  border: '1px solid #1e293b',
                  borderRadius: 10,
                  padding: 14,
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 6
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: '#38bdf8' }}>
                    {app.algo}
                  </div>
                  <Badge variant="neutral">{app.category}</Badge>
                </div>
                <div style={{ fontSize: 12, color: '#cbd5e1' }}>
                  <strong>Operational Role:</strong> {app.whatItDid}
                </div>
                <div style={{ fontSize: 12, color: '#94a3b8' }}>
                  <strong>Forensic Value:</strong> {app.whyCrucial}
                </div>
              </div>
            ))}
          </div>

          {/* SIMULATION LINK */}
          <div style={{
            marginTop: 20,
            background: 'rgba(56, 189, 248, 0.05)',
            border: '1px solid rgba(56, 189, 248, 0.2)',
            borderRadius: 10,
            padding: 16,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: 12
          }}>
            <div>
              <div style={{ fontSize: 13, fontWeight: 700, color: '#f8fafc' }}>
                Want to step through these algorithms step-by-step?
              </div>
              <div style={{ fontSize: 12, color: '#94a3b8' }}>
                Open the interactive DSA Learning Studio to pause, step, and inspect internal states.
              </div>
            </div>
            <Button
              variant="primary"
              size="sm"
              onClick={() => {
                onClose();
                window.location.href = '/app/dsa-studio';
              }}
            >
              Open DSA Studio <ArrowRight size={14} style={{ marginLeft: 6 }} />
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

