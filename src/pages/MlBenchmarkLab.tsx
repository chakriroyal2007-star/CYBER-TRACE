import { useEffect, useState } from 'react';
import { api } from '../api';
import { Badge, Button } from '../components/ui';
import { ShieldCheck, Cpu, Activity, Layers, BarChart3, ArrowRight, CheckCircle2 } from 'lucide-react';

export default function MlBenchmarkLab() {
  const [activeTab, setActiveTab] = useState<'six-family' | 'elliptic'>('six-family');
  const [evaluation, setEvaluation] = useState<any>(null);
  const [riskEvaluation, setRiskEvaluation] = useState<any>(null);
  const [txId, setTxId] = useState('232629023');
  const [prediction, setPrediction] = useState<any>(null);
  const [caseEvalResult, setCaseEvalResult] = useState<any>(null);
  const [selectedCaseId, setSelectedCaseId] = useState('CR-2026-00192');
  const [casesList, setCasesList] = useState<any[]>([]);
  const [evaluatingCase, setEvaluatingCase] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  function load() {
    setLoading(true);
    Promise.all([
      api('/ml/evaluation').catch(() => null),
      api('/ml/risk-evaluation').catch(() => null),
      api('/complaints').catch(() => [])
    ]).then(([evalData, riskData, complaints]) => {
      setEvaluation(evalData);
      setRiskEvaluation(riskData);
      if (Array.isArray(complaints) && complaints.length > 0) {
        setCasesList(complaints);
        setSelectedCaseId(complaints[0].caseId || complaints[0].id);
      }
    }).catch(e => setError(e.message)).finally(() => setLoading(false));
  }

  useEffect(load, []);

  const handleEvaluateCase = async () => {
    if (!selectedCaseId) return;
    setEvaluatingCase(true);
    try {
      const res = await api(`/cases/${encodeURIComponent(selectedCaseId)}/risk-evaluation`, {
        method: 'POST',
        body: '{}'
      });
      setCaseEvalResult(res);
    } catch (e: any) {
      setError(e.message || 'Case evaluation failed');
    } finally {
      setEvaluatingCase(false);
    }
  };

  const card = { background: '#090d16', border: '1px solid #1e293b', borderRadius: 10, padding: 20 };

  return (
    <div style={{ padding: '24px 32px', maxWidth: 1440, margin: '0 auto', color: '#e2e8f0' }}>
      {/* HEADER WITH TABS */}
      <div style={{ ...card, marginBottom: 20 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
          <div>
            <Badge variant="warning">STATISTICAL FORENSIC INTELLIGENCE</Badge>
            <h1 style={{ margin: '8px 0 4px', fontSize: 24, fontWeight: 700, color: '#f8fafc' }}>
              Machine Learning Benchmark Lab & Risk Engine
            </h1>
            <p style={{ margin: 0, color: '#94a3b8', fontSize: 13 }}>
              Genuine, reproducible scikit-learn models evaluating Transaction, Graph, Temporal, Behavioral, Cross-Chain, and Complaint evidence features.
            </p>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button
              onClick={() => setActiveTab('six-family')}
              style={{
                padding: '8px 16px',
                borderRadius: 6,
                border: '1px solid #38bdf8',
                background: activeTab === 'six-family' ? '#0284c7' : '#0f172a',
                color: '#fff',
                fontSize: 13,
                fontWeight: 600,
                cursor: 'pointer'
              }}
            >
              <Cpu size={14} style={{ display: 'inline', marginRight: 6 }} /> 6-Family Risk Engine
            </button>
            <button
              onClick={() => setActiveTab('elliptic')}
              style={{
                padding: '8px 16px',
                borderRadius: 6,
                border: '1px solid #334155',
                background: activeTab === 'elliptic' ? '#334155' : '#0f172a',
                color: '#fff',
                fontSize: 13,
                fontWeight: 600,
                cursor: 'pointer'
              }}
            >
              <Layers size={14} style={{ display: 'inline', marginRight: 6 }} /> Elliptic Topology Baseline
            </button>
          </div>
        </div>
      </div>

      {loading && <p>Loading model evaluation telemetry…</p>}
      {error && <p role="alert" style={{ color: '#f87171' }}>{error} <Button onClick={load}>Retry</Button></p>}

      {/* TAB 1: 6-FAMILY ENTERPRISE RISK ENGINE */}
      {activeTab === 'six-family' && (
        <div>
          {/* LIVE CASE RISK EVALUATOR */}
          <div style={{ ...card, marginBottom: 20 }}>
            <h2 style={{ fontSize: 17, marginBottom: 6, color: '#fff' }}>Interactive 6-Family Case Risk Evaluator</h2>
            <p style={{ fontSize: 13, color: '#94a3b8', marginBottom: 14 }}>
              Execute real-time inference on any active investigation case. The engine extracts 24 features across all 6 analytical categories, calculates independent sub-scores, runs calibrated Random Forest inference, and provides feature contributions.
            </p>
            <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
              <select
                value={selectedCaseId}
                onChange={e => setSelectedCaseId(e.target.value)}
                style={{
                  background: '#132338',
                  border: '1px solid #29445e',
                  color: '#fff',
                  padding: '7px 12px',
                  borderRadius: 6,
                  fontSize: 13
                }}
              >
                {casesList.map(c => (
                  <option key={c.caseId || c.id} value={c.caseId || c.id}>
                    {c.caseId || c.id} — {c.incidentType || c.fraudType} (₹{Number(c.reportedLoss || c.victimLoss || 0).toLocaleString('en-IN')})
                  </option>
                ))}
              </select>
              <Button onClick={handleEvaluateCase} disabled={evaluatingCase} style={{ background: '#0284c7', color: '#fff' }}>
                <Activity size={14} style={{ marginRight: 6 }} /> {evaluatingCase ? 'Evaluating ML Features…' : 'Calculate 6-Family Risk Score'}
              </Button>
            </div>

            {caseEvalResult && (
              <div style={{ marginTop: 20, padding: 18, background: '#030712', borderRadius: 8, border: '1px solid #1e293b' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                  <div>
                    <h3 style={{ margin: 0, fontSize: 18, color: '#f8fafc' }}>
                      Evaluation for Case {caseEvalResult.caseId}
                    </h3>
                    <span style={{ fontSize: 12, color: '#94a3b8' }}>
                      Model: {caseEvalResult.modelVersion} · Calibrated Probability: {(caseEvalResult.calibratedProbability * 100).toFixed(1)}%
                    </span>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: 24, fontWeight: 700, color: caseEvalResult.compositeScore >= 70 ? '#f87171' : '#38bdf8' }}>
                      {caseEvalResult.compositeScore} / 100
                    </div>
                    <Badge variant={caseEvalResult.compositeScore >= 70 ? 'danger' : 'warning'}>
                      {caseEvalResult.riskLevel}
                    </Badge>
                  </div>
                </div>

                {/* 6 Independent Sub-Scores */}
                <h4 style={{ fontSize: 13, textTransform: 'uppercase', color: '#64748b', letterSpacing: 0.5, marginBottom: 10 }}>
                  6 Independent Analytical Sub-Scores
                </h4>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12, marginBottom: 20 }}>
                  {Object.entries(caseEvalResult.subScores || {}).map(([key, score]: [string, any]) => (
                    <div key={key} style={{ background: '#0f172a', padding: '12px 14px', borderRadius: 6, border: '1px solid #1e293b' }}>
                      <div style={{ fontSize: 11, color: '#94a3b8', textTransform: 'capitalize' }}>
                        {key.replace(/Risk$/, '').replace(/([A-Z])/g, ' $1')}
                      </div>
                      <div style={{ fontSize: 18, fontWeight: 700, color: score >= 70 ? '#f87171' : score >= 40 ? '#fbbf24' : '#34d399' }}>
                        {score}/100
                      </div>
                      <div style={{ width: '100%', height: 4, background: '#1e293b', borderRadius: 2, marginTop: 6, overflow: 'hidden' }}>
                        <div style={{ width: `${score}%`, height: '100%', background: score >= 70 ? '#ef4444' : score >= 40 ? '#f59e0b' : '#10b981' }} />
                      </div>
                    </div>
                  ))}
                </div>

                {/* Feature Contributions / Explainability */}
                <h4 style={{ fontSize: 13, textTransform: 'uppercase', color: '#64748b', letterSpacing: 0.5, marginBottom: 10 }}>
                  Top Predictive Feature Contributions (Explainability)
                </h4>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {(caseEvalResult.featureContributions || []).map((fc: any, i: number) => (
                    <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#090d16', padding: '8px 12px', borderRadius: 6, fontSize: 12 }}>
                      <div>
                        <strong style={{ color: '#fff' }}>[{fc.category}] {fc.feature}:</strong>{' '}
                        <span style={{ color: '#94a3b8' }}>{fc.detail}</span>
                      </div>
                      <Badge variant={fc.impact.includes('HIGH') || fc.impact.includes('CRITICAL') ? 'danger' : 'neutral'}>
                        {fc.impact}
                      </Badge>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* TRAINED MODEL BENCHMARKS (4 MODELS COMPARED) */}
          {riskEvaluation?.model_comparison && (
            <div style={{ marginBottom: 20 }}>
              <h2 style={{ fontSize: 18, marginBottom: 12, color: '#fff' }}>Model Evaluation & Benchmark Comparison (Held-Out Test Set)</h2>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 16 }}>
                {Object.entries(riskEvaluation.model_comparison).map(([name, m]: [string, any]) => (
                  <div key={name} style={card}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                      <h3 style={{ margin: 0, fontSize: 16, color: '#f8fafc' }}>{name.replace('_', ' ')}</h3>
                      {name === riskEvaluation.selected_production_model && (
                        <Badge variant="success">PRODUCTION MODEL</Badge>
                      )}
                    </div>
                    {m.precision !== undefined && (
                      <table style={{ width: '100%', fontSize: 12, marginBottom: 12 }}>
                        <tbody>
                          <tr><th style={{ textAlign: 'left', color: '#94a3b8' }}>Precision</th><td style={{ textAlign: 'right', fontWeight: 700 }}>{m.precision}</td></tr>
                          <tr><th style={{ textAlign: 'left', color: '#94a3b8' }}>Recall</th><td style={{ textAlign: 'right', fontWeight: 700 }}>{m.recall}</td></tr>
                          <tr><th style={{ textAlign: 'left', color: '#94a3b8' }}>F1-Score</th><td style={{ textAlign: 'right', fontWeight: 700 }}>{m.f1_score}</td></tr>
                          {m.roc_auc && <tr><th style={{ textAlign: 'left', color: '#94a3b8' }}>ROC-AUC</th><td style={{ textAlign: 'right', fontWeight: 700 }}>{m.roc_auc}</td></tr>}
                          {m.brier_score !== undefined && <tr><th style={{ textAlign: 'left', color: '#94a3b8' }}>Brier Score</th><td style={{ textAlign: 'right', fontWeight: 700 }}>{m.brier_score}</td></tr>}
                        </tbody>
                      </table>
                    )}
                    {m.role && <p style={{ fontSize: 12, color: '#38bdf8' }}>{m.role}</p>}
                    <p style={{ margin: 0, fontSize: 11, color: '#64748b' }}>Confusion Matrix:</p>
                    <pre style={{ margin: '4px 0 0', padding: 8, background: '#030712', borderRadius: 4, fontSize: 11, color: '#34d399' }}>
                      {JSON.stringify(m.confusion_matrix)}
                    </pre>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* 6 FEATURE FAMILIES ARCHITECTURE */}
          <div style={{ ...card, marginBottom: 20 }}>
            <h2 style={{ fontSize: 17, marginBottom: 12, color: '#fff' }}>6 Feature Families Architecture</h2>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 14 }}>
              {[
                { title: 'A. Transaction Risk', desc: 'Velocity (INR/min), transfer frequency, maximum single-transfer ratio, rapid successive transfers (<5m), and small-value burst counts.' },
                { title: 'B. Graph / Network Risk', desc: 'Multi-hop depth to cashout, intermediary count, in/out degrees, fan-in/fan-out ratios, fund-splitting branches, and cycle loops.' },
                { title: 'C. Temporal Risk', desc: 'Average wallet holding duration, rapid pass-through (<60m forwarding), and time-burstiness score.' },
                { title: 'D. Wallet Behaviour Risk', desc: 'Maturity/new wallet flags, high-volume forwarding behavior, and interaction patterns.' },
                { title: 'E. Cross-Chain Risk', desc: 'Cross-chain bridge hops, protocol identification (Across/Stargate), and unverified bridge transfers.' },
                { title: 'F. Complaint & Evidence Risk', desc: 'Reported financial loss, evidence completeness score, transaction hash verification, and address validation.' }
              ].map(f => (
                <div key={f.title} style={{ padding: 12, background: '#0a1420', borderRadius: 6, border: '1px solid #1a2a3e' }}>
                  <strong style={{ color: '#38bdf8', fontSize: 13, display: 'block', marginBottom: 4 }}>{f.title}</strong>
                  <p style={{ margin: 0, fontSize: 12, color: '#94a3b8' }}>{f.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: ELLIPTIC TOPOLOGY BASELINE */}
      {activeTab === 'elliptic' && evaluation && (
        <div>
          <div style={{ ...card, marginBottom: 20 }}>
            <h2>Run an Elliptic Dataset Prediction Lookup</h2>
            <p>Use an Elliptic transaction ID to inspect the outputs of the saved, trained models. This ID is a research node, not a live wallet or UPI account.</p>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <input
                aria-label="Elliptic transaction ID"
                value={txId}
                onChange={e => setTxId(e.target.value)}
                style={{ background: '#132338', border: '1px solid #29445e', color: '#fff', padding: '6px 12px', borderRadius: 6 }}
              />
              <Button onClick={() => api(`/transactions/${encodeURIComponent(txId)}`).then(setPrediction).catch(e => setError(e.message))}>
                Inspect Model Prediction
              </Button>
            </div>
            {prediction && (
              <div style={{ marginTop: 14, padding: 12, background: '#030712', borderRadius: 6 }}>
                <p>Dataset label: {prediction.knownLabel} · Model score: {prediction.riskScore ?? 'unavailable'}/100</p>
                <p>RF illicit probability: {prediction.modelProvenance?.available ? (prediction.modelProvenance.probability * 100).toFixed(2) + '%' : 'Unavailable'} · LR: {prediction.modelProvenance?.available ? (prediction.modelProvenance.logisticRegressionProbability * 100).toFixed(2) + '%' : 'Unavailable'}</p>
                <p>Inference Mode: {prediction.modelProvenance?.inferenceMode || 'Saved research output'} ({prediction.modelProvenance?.executionMs?.toFixed(3) ?? '—'} ms)</p>
              </div>
            )}
          </div>

          <div style={{ ...card, marginBottom: 20 }}>
            <h2>Elliptic Dataset Topology Baseline Setup</h2>
            <p>{evaluation.dataset} · {evaluation.train_samples?.toLocaleString()} training / {evaluation.test_samples?.toLocaleString()} testing samples</p>
            <p>{evaluation.split}</p>
            <p>Features: {(evaluation.features || []).join(', ')}</p>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(270px, 1fr))', gap: 16 }}>
            {Object.entries(evaluation.models || {}).map(([name, value]: [string, any]) => (
              <div key={name} style={card}>
                <h3 style={{ fontSize: 16, color: '#f8fafc' }}>{name.replaceAll('_', ' ')}</h3>
                <table style={{ width: '100%', fontSize: 12 }}>
                  <tbody>
                    {['precision', 'recall', 'f1', 'roc_auc', 'pr_auc'].map(metric => (
                      <tr key={metric}>
                        <th style={{ textAlign: 'left', color: '#94a3b8' }}>{metric.toUpperCase()}</th>
                        <td style={{ textAlign: 'right', fontWeight: 700 }}>{value[metric]?.toFixed(4)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
