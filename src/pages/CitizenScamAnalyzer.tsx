import React, { useState } from 'react';
import {
  ShieldAlert, CheckCircle2, AlertTriangle, ArrowRight, Search, FileText,
  ExternalLink, Globe, Phone, Send, RefreshCw, AlertCircle, Sparkles, HelpCircle,
  Lock, MessageSquare, Copy, Check, Radio, Zap
} from 'lucide-react';
import { api, navigate, toast } from '../api';
import { Button, Card, Badge, PageHeader, LoadingState } from '../components/ui';

export default function CitizenScamAnalyzer() {
  const [activeTab, setActiveTab] = useState<'message' | 'url' | 'entity'>('message');

  // Message analysis state
  const [messageText, setMessageText] = useState('');
  const [analyzingMessage, setAnalyzingMessage] = useState(false);
  const [messageResult, setMessageResult] = useState<any>(null);

  // URL analysis state
  const [urlInput, setUrlInput] = useState('');
  const [analyzingUrl, setAnalyzingUrl] = useState(false);
  const [urlResult, setUrlResult] = useState<any>(null);

  // Entity lookup state
  const [entityType, setEntityType] = useState<'phone' | 'upi'>('phone');
  const [entityInput, setEntityInput] = useState('');
  const [analyzingEntity, setAnalyzingEntity] = useState(false);
  const [entityResult, setEntityResult] = useState<any>(null);

  // Analyze Scam Message
  const handleAnalyzeMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!messageText.trim()) {
      toast('Please enter or paste a suspicious message', 'error');
      return;
    }
    setAnalyzingMessage(true);
    try {
      const res = await api('/scam-analyzer/message', {
        method: 'POST',
        body: JSON.stringify({ text: messageText })
      });
      setMessageResult(res);
      toast('Scam message evaluation completed', 'success');
    } catch (err: any) {
      toast(err.message || 'Analysis failed', 'error');
    } finally {
      setAnalyzingMessage(false);
    }
  };

  // Analyze URL
  const handleAnalyzeUrl = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!urlInput.trim()) {
      toast('Please enter a website link or URL', 'error');
      return;
    }
    setAnalyzingUrl(true);
    try {
      const res = await api('/scam-analyzer/url', {
        method: 'POST',
        body: JSON.stringify({ url: urlInput })
      });
      setUrlResult(res);
      toast('URL phishing verification completed', 'success');
    } catch (err: any) {
      toast(err.message || 'URL inspection failed', 'error');
    } finally {
      setAnalyzingUrl(false);
    }
  };

  // Lookup Entity
  const handleLookupEntity = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!entityInput.trim()) {
      toast('Please enter an identifier to inspect', 'error');
      return;
    }
    setAnalyzingEntity(true);
    try {
      const res = await api(`/scam-analyzer/entity?type=${encodeURIComponent(entityType)}&identifier=${encodeURIComponent(entityInput.trim())}`);
      setEntityResult(res);
    } catch (err: any) {
      toast(err.message || 'Lookup failed', 'error');
    } finally {
      setAnalyzingEntity(false);
    }
  };

  return (
    <div style={{ maxWidth: 1100, margin: '0 auto', padding: '24px 20px' }}>
      {/* Statutory Emergency Helpline Banner */}
      <div style={{
        background: 'linear-gradient(90deg, rgba(239, 68, 68, 0.12) 0%, rgba(15, 23, 42, 0.8) 100%)',
        border: '1px solid rgba(239, 68, 68, 0.3)',
        borderRadius: 10,
        padding: '16px 20px',
        marginBottom: 24,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: 16
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <div style={{ background: '#ef4444', color: '#fff', borderRadius: '50%', width: 40, height: 40, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: 18 }}>
            !
          </div>
          <div>
            <div style={{ fontSize: 13, fontWeight: 700, color: '#fca5a5' }}>
              VICTIM OF FINANCIAL FRAUD? ACT WITHIN THE GOLDEN HOUR
            </div>
            <div style={{ fontSize: 12, color: '#94a3b8', marginTop: 2 }}>
              Immediately dial national cyber helpline <strong>1930</strong> or register an official complaint at <strong>cybercrime.gov.in</strong>.
            </div>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <a
            href="tel:1930"
            style={{
              background: '#ef4444',
              color: '#fff',
              padding: '8px 16px',
              borderRadius: 6,
              fontWeight: 700,
              fontSize: 12,
              textDecoration: 'none',
              display: 'flex',
              alignItems: 'center',
              gap: 6
            }}
          >
            <Phone size={14} /> Call 1930 Now
          </a>
          <a
            href="https://cybercrime.gov.in"
            target="_blank"
            rel="noopener noreferrer"
            style={{
              background: '#1e293b',
              border: '1px solid #334155',
              color: '#e2e8f0',
              padding: '8px 14px',
              borderRadius: 6,
              fontWeight: 600,
              fontSize: 12,
              textDecoration: 'none',
              display: 'flex',
              alignItems: 'center',
              gap: 6
            }}
          >
            cybercrime.gov.in <ExternalLink size={12} />
          </a>
        </div>
      </div>

      <PageHeader
        eyebrow="CITIZEN THREAT ANALYZER"
        title="Multilingual Scam & Phishing Scanner"
        description="Verify suspicious SMS, WhatsApp messages, investment links, and payment handles using real-time machine learning & verified Indian cyber threat intelligence."
        action={
          <Button onClick={() => navigate('/reporter/submit')}>
            <FileText size={15} /> File Full Fraud Complaint
          </Button>
        }
      />

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 8, borderBottom: '1px solid #1e293b', paddingBottom: 12, marginBottom: 24 }}>
        <button
          onClick={() => setActiveTab('message')}
          style={{
            background: activeTab === 'message' ? '#0284c7' : 'transparent',
            color: activeTab === 'message' ? '#fff' : '#94a3b8',
            border: 'none',
            padding: '8px 18px',
            borderRadius: 6,
            fontWeight: 600,
            fontSize: 13,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: 8
          }}
        >
          <MessageSquare size={15} /> Analyze Suspicious Message (SMS/WhatsApp)
        </button>
        <button
          onClick={() => setActiveTab('url')}
          style={{
            background: activeTab === 'url' ? '#0284c7' : 'transparent',
            color: activeTab === 'url' ? '#fff' : '#94a3b8',
            border: 'none',
            padding: '8px 18px',
            borderRadius: 6,
            fontWeight: 600,
            fontSize: 13,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: 8
          }}
        >
          <Globe size={15} /> Inspect Link / Phishing URL
        </button>
        <button
          onClick={() => setActiveTab('entity')}
          style={{
            background: activeTab === 'entity' ? '#0284c7' : 'transparent',
            color: activeTab === 'entity' ? '#fff' : '#94a3b8',
            border: 'none',
            padding: '8px 18px',
            borderRadius: 6,
            fontWeight: 600,
            fontSize: 13,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: 8
          }}
        >
          <ShieldAlert size={15} /> Check Phone Number or UPI ID
        </button>
      </div>

      {/* Tab 1: Message Analyzer */}
      {activeTab === 'message' && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24 }}>
          <Card style={{ padding: 22 }}>
            <h3 style={{ margin: '0 0 10px 0', fontSize: 15, color: '#fff' }}>Paste Suspicious Message</h3>
            <p style={{ fontSize: 12, color: '#94a3b8', margin: '0 0 16px 0' }}>
              Supports English, Hindi, Telugu, Tamil, Kannada, Malayalam, and Hinglish SMS/WhatsApp scam messages.
            </p>
            <form onSubmit={handleAnalyzeMessage}>
              <textarea
                value={messageText}
                onChange={e => setMessageText(e.target.value)}
                placeholder="e.g. Dear SBI user, your YONO account will be blocked today. Please update PAN immediately: http://sbi-kyc-update.xyz"
                rows={6}
                style={{
                  width: '100%',
                  background: '#090d16',
                  border: '1px solid #1e293b',
                  borderRadius: 8,
                  padding: 12,
                  color: '#fff',
                  fontSize: 13,
                  resize: 'vertical',
                  marginBottom: 16
                }}
              />
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: 11, color: '#64748b' }}>
                  Never enter your banking password, OTP, or UPI PIN.
                </span>
                <Button disabled={analyzingMessage}>
                  {analyzingMessage ? <RefreshCw size={14} className="spin" /> : <Zap size={14} />}
                  {analyzingMessage ? 'Analyzing Text…' : 'Run ML Scam Analysis'}
                </Button>
              </div>
            </form>
          </Card>

          <Card style={{ padding: 22 }}>
            <h3 style={{ margin: '0 0 12px 0', fontSize: 15, color: '#fff' }}>ML Scam Evaluation Results</h3>
            {messageResult ? (
              <div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16, padding: '12px 16px', background: messageResult.isScam ? 'rgba(239, 68, 68, 0.1)' : 'rgba(34, 197, 94, 0.1)', border: `1px solid ${messageResult.isScam ? '#ef4444' : '#22c55e'}`, borderRadius: 8 }}>
                  <div>
                    <div style={{ fontSize: 11, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: 0.5 }}>Model Verdict</div>
                    <strong style={{ fontSize: 16, color: messageResult.isScam ? '#ef4444' : '#22c55e' }}>
                      {messageResult.isScam ? 'POTENTIAL FRAUD DETECTED' : 'LIKELY BENIGN MESSAGE'}
                    </strong>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: 11, color: '#94a3b8' }}>Scam Probability</div>
                    <strong style={{ fontSize: 18, color: '#fff' }}>
                      {(messageResult.scamProbability * 100).toFixed(1)}%
                    </strong>
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 16 }}>
                  <div style={{ background: '#090d16', padding: 10, borderRadius: 6, border: '1px solid #1e293b' }}>
                    <span style={{ fontSize: 11, color: '#94a3b8' }}>Detected Language</span>
                    <div style={{ fontSize: 13, fontWeight: 600, color: '#38bdf8', marginTop: 2 }}>
                      {messageResult.language?.name || 'English'}
                    </div>
                  </div>
                  <div style={{ background: '#090d16', padding: 10, borderRadius: 6, border: '1px solid #1e293b' }}>
                    <span style={{ fontSize: 11, color: '#94a3b8' }}>Fraud Category</span>
                    <div style={{ fontSize: 13, fontWeight: 600, color: '#f59e0b', marginTop: 2 }}>
                      {messageResult.predictedCategory}
                    </div>
                  </div>
                </div>

                <div style={{ marginBottom: 14 }}>
                  <span style={{ fontSize: 11.5, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase' }}>Extracted Indicators:</span>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 6 }}>
                    {(messageResult.extractedIndicators || []).map((ind: string, idx: number) => (
                      <Badge key={idx} variant="warning">{ind}</Badge>
                    ))}
                  </div>
                </div>

                <div style={{ marginBottom: 14 }}>
                  <span style={{ fontSize: 11.5, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase' }}>Forensic Rationale:</span>
                  <ul style={{ margin: '6px 0 0 18px', padding: 0, fontSize: 12, color: '#cbd5e1', lineHeight: 1.6 }}>
                    {(messageResult.explainableFeatures || []).map((feat: string, idx: number) => (
                      <li key={idx}>{feat}</li>
                    ))}
                  </ul>
                </div>

                {messageResult.investigatorActions && messageResult.investigatorActions.length > 0 && (
                  <div style={{ marginBottom: 14, background: '#091522', padding: 10, borderRadius: 6, border: '1px solid #1e3a5f' }}>
                    <span style={{ fontSize: 11.5, fontWeight: 700, color: '#38bdf8', textTransform: 'uppercase' }}>Recommended Actions:</span>
                    <ul style={{ margin: '6px 0 0 18px', padding: 0, fontSize: 12, color: '#93c5fd', lineHeight: 1.5 }}>
                      {messageResult.investigatorActions.map((act: string, idx: number) => (
                        <li key={idx}>{act}</li>
                      ))}
                    </ul>
                  </div>
                )}

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 12, paddingTop: 10, borderTop: '1px solid #1e293b', fontSize: 11, color: '#64748b' }}>
                  <span>Engine: <strong style={{ color: '#38bdf8' }}>{messageResult.modelVersion || 'OpenRouter LLaMA-3.3-70B'}</strong></span>
                  <Badge variant="success">LIVE ML INFERENCE</Badge>
                </div>
              </div>
            ) : (
              <div style={{ textAlign: 'center', padding: '40px 20px', color: '#64748b' }}>
                <MessageSquare size={36} style={{ margin: '0 auto 12px auto', opacity: 0.4 }} />
                <p style={{ margin: 0, fontSize: 13 }}>Paste a message on the left and run analysis to inspect linguistic patterns and scam risk.</p>
              </div>
            )}
          </Card>
        </div>
      )}

      {/* Tab 2: URL Inspector */}
      {activeTab === 'url' && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24 }}>
          <Card style={{ padding: 22 }}>
            <h3 style={{ margin: '0 0 10px 0', fontSize: 15, color: '#fff' }}>Verify Suspicious Link / URL</h3>
            <p style={{ fontSize: 12, color: '#94a3b8', margin: '0 0 16px 0' }}>
              Inspects structural domain heuristics (ISCX benchmark) and cross-checks verified PhishTank threat feeds.
            </p>
            <form onSubmit={handleAnalyzeUrl}>
              <input
                type="text"
                value={urlInput}
                onChange={e => setUrlInput(e.target.value)}
                placeholder="e.g. http://sbi-kyc-verify-online.com or bit.ly/claim-bonus"
                style={{
                  width: '100%',
                  background: '#090d16',
                  border: '1px solid #1e293b',
                  borderRadius: 8,
                  padding: 12,
                  color: '#fff',
                  fontSize: 13,
                  marginBottom: 16
                }}
              />
              <Button disabled={analyzingUrl}>
                {analyzingUrl ? <RefreshCw size={14} className="spin" /> : <Globe size={14} />}
                {analyzingUrl ? 'Inspecting Link…' : 'Inspect URL Security'}
              </Button>
            </form>
          </Card>

          <Card style={{ padding: 22 }}>
            <h3 style={{ margin: '0 0 12px 0', fontSize: 15, color: '#fff' }}>URL Threat Intelligence Report</h3>
            {urlResult ? (
              <div>
                <div style={{
                  padding: '12px 16px',
                  background: urlResult.classification === 'MALICIOUS_PHISHING' ? 'rgba(239, 68, 68, 0.1)' : urlResult.classification === 'SUSPICIOUS' ? 'rgba(245, 158, 11, 0.1)' : 'rgba(34, 197, 94, 0.1)',
                  border: `1px solid ${urlResult.classification === 'MALICIOUS_PHISHING' ? '#ef4444' : urlResult.classification === 'SUSPICIOUS' ? '#f59e0b' : '#22c55e'}`,
                  borderRadius: 8,
                  marginBottom: 16
                }}>
                  <div style={{ fontSize: 11, color: '#94a3b8', textTransform: 'uppercase' }}>Classification</div>
                  <strong style={{ fontSize: 16, color: urlResult.classification === 'MALICIOUS_PHISHING' ? '#ef4444' : urlResult.classification === 'SUSPICIOUS' ? '#f59e0b' : '#22c55e' }}>
                    {urlResult.classification.replace('_', ' ')}
                  </strong>
                  <div style={{ fontSize: 12, color: '#cbd5e1', marginTop: 4 }}>
                    {urlResult.safetyRecommendation}
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 16, fontSize: 12 }}>
                  <div style={{ background: '#090d16', padding: 8, borderRadius: 6, border: '1px solid #1e293b' }}>
                    <span style={{ color: '#64748b' }}>Domain:</span> <strong>{urlResult.domain}</strong>
                  </div>
                  <div style={{ background: '#090d16', padding: 8, borderRadius: 6, border: '1px solid #1e293b' }}>
                    <span style={{ color: '#64748b' }}>Risk Score:</span> <strong style={{ color: '#ef4444' }}>{urlResult.riskScore} / 100</strong>
                  </div>
                  <div style={{ background: '#090d16', padding: 8, borderRadius: 6, border: '1px solid #1e293b' }}>
                    <span style={{ color: '#64748b' }}>HTTPS Encryption:</span> <strong>{urlResult.features?.isHttps ? 'Yes' : 'No (Insecure)'}</strong>
                  </div>
                  <div style={{ background: '#090d16', padding: 8, borderRadius: 6, border: '1px solid #1e293b' }}>
                    <span style={{ color: '#64748b' }}>Verified Phishing Match:</span> <strong>{urlResult.isVerifiedPhishingMatch ? 'YES (Confirmed)' : 'No match'}</strong>
                  </div>
                </div>

                <div style={{ marginBottom: 14 }}>
                  <span style={{ fontSize: 11.5, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase' }}>Detected Indicators:</span>
                  <ul style={{ margin: '6px 0 0 18px', padding: 0, fontSize: 12, color: '#cbd5e1', lineHeight: 1.6 }}>
                    {(urlResult.indicators || []).map((ind: string, idx: number) => (
                      <li key={idx}>{ind}</li>
                    ))}
                  </ul>
                </div>

                {urlResult.explainableRationale && urlResult.explainableRationale.length > 0 && (
                  <div style={{ marginBottom: 14 }}>
                    <span style={{ fontSize: 11.5, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase' }}>Forensic Evaluation:</span>
                    <ul style={{ margin: '6px 0 0 18px', padding: 0, fontSize: 12, color: '#cbd5e1', lineHeight: 1.5 }}>
                      {urlResult.explainableRationale.map((rat: string, idx: number) => (
                        <li key={idx}>{rat}</li>
                      ))}
                    </ul>
                  </div>
                )}

                {urlResult.investigatorActions && urlResult.investigatorActions.length > 0 && (
                  <div style={{ marginBottom: 14, background: '#091522', padding: 10, borderRadius: 6, border: '1px solid #1e3a5f' }}>
                    <span style={{ fontSize: 11.5, fontWeight: 700, color: '#38bdf8', textTransform: 'uppercase' }}>Safety Actions:</span>
                    <ul style={{ margin: '6px 0 0 18px', padding: 0, fontSize: 12, color: '#93c5fd', lineHeight: 1.5 }}>
                      {urlResult.investigatorActions.map((act: string, idx: number) => (
                        <li key={idx}>{act}</li>
                      ))}
                    </ul>
                  </div>
                )}

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 12, paddingTop: 10, borderTop: '1px solid #1e293b', fontSize: 11, color: '#64748b' }}>
                  <span>Engine: <strong style={{ color: '#38bdf8' }}>{urlResult.modelVersion || 'OpenRouter LLaMA-3.3-70B'}</strong></span>
                  <Badge variant="success">LIVE ML INFERENCE</Badge>
                </div>
              </div>
            ) : (
              <div style={{ textAlign: 'center', padding: '40px 20px', color: '#64748b' }}>
                <Globe size={36} style={{ margin: '0 auto 12px auto', opacity: 0.4 }} />
                <p style={{ margin: 0, fontSize: 13 }}>Enter a URL on the left to inspect domain structural features and verified threat records.</p>
              </div>
            )}
          </Card>
        </div>
      )}

      {/* Tab 3: Entity Lookup */}
      {activeTab === 'entity' && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24 }}>
          <Card style={{ padding: 22 }}>
            <h3 style={{ margin: '0 0 10px 0', fontSize: 15, color: '#fff' }}>Check Phone Number or UPI Identifier</h3>
            <p style={{ fontSize: 12, color: '#94a3b8', margin: '0 0 16px 0' }}>
              Queries reported cybercrime complaints and evidence connections. Does not make unverified accusations.
            </p>
            <form onSubmit={handleLookupEntity}>
              <div style={{ display: 'flex', gap: 10, marginBottom: 14 }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: '#fff', cursor: 'pointer' }}>
                  <input type="radio" checked={entityType === 'phone'} onChange={() => setEntityType('phone')} />
                  Mobile Phone Number
                </label>
                <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: '#fff', cursor: 'pointer' }}>
                  <input type="radio" checked={entityType === 'upi'} onChange={() => setEntityType('upi')} />
                  UPI VPA Handle
                </label>
              </div>
              <input
                type="text"
                value={entityInput}
                onChange={e => setEntityInput(e.target.value)}
                placeholder={entityType === 'phone' ? 'e.g. 9810123456 or +91 98101 23456' : 'e.g. suspect.fastyield@paytm'}
                style={{
                  width: '100%',
                  background: '#090d16',
                  border: '1px solid #1e293b',
                  borderRadius: 8,
                  padding: 12,
                  color: '#fff',
                  fontSize: 13,
                  marginBottom: 16
                }}
              />
              <Button disabled={analyzingEntity}>
                {analyzingEntity ? <RefreshCw size={14} className="spin" /> : <Search size={14} />}
                {analyzingEntity ? 'Searching Records…' : 'Check Intelligence Records'}
              </Button>
            </form>
          </Card>

          <Card style={{ padding: 22 }}>
            <h3 style={{ margin: '0 0 12px 0', fontSize: 15, color: '#fff' }}>Entity Evidence Status</h3>
            {entityResult ? (
              entityResult.found ? (
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 16px', background: '#090d16', border: '1px solid #1e293b', borderRadius: 8, marginBottom: 14 }}>
                    <div>
                      <div style={{ fontSize: 11, color: '#64748b' }}>Target Identifier</div>
                      <strong style={{ fontSize: 15, color: '#38bdf8' }}>{entityResult.entity.identifier}</strong>
                    </div>
                    <Badge variant={entityResult.entity.verificationStatus === 'CORROBORATED_EVIDENCE' || (entityResult.entity.riskScore >= 70) ? 'danger' : 'warning'}>
                      {entityResult.entity.verificationStatus.replace(/_/g, ' ')}
                    </Badge>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, fontSize: 12, marginBottom: 14 }}>
                    <div style={{ background: '#090d16', padding: 8, borderRadius: 6, border: '1px solid #1e293b' }}>
                      <span style={{ color: '#64748b' }}>Provider / Circle:</span> <strong>{entityResult.entity.providerOrBank || 'Unknown'}</strong>
                    </div>
                    <div style={{ background: '#090d16', padding: 8, borderRadius: 6, border: '1px solid #1e293b' }}>
                      <span style={{ color: '#64748b' }}>Calculated Risk:</span> <strong style={{ color: '#ef4444' }}>{entityResult.entity.riskScore} / 100</strong>
                    </div>
                    <div style={{ background: '#090d16', padding: 8, borderRadius: 6, border: '1px solid #1e293b' }}>
                      <span style={{ color: '#64748b' }}>Independent Reports:</span> <strong>{entityResult.entity.reportCount || 1}</strong>
                    </div>
                    <div style={{ background: '#090d16', padding: 8, borderRadius: 6, border: '1px solid #1e293b' }}>
                      <span style={{ color: '#64748b' }}>Threat Level:</span> <strong style={{ color: entityResult.entity.riskScore >= 70 ? '#ef4444' : '#f59e0b' }}>{entityResult.entity.threatLevel || (entityResult.entity.riskScore >= 70 ? 'CRITICAL' : 'SUSPICIOUS')}</strong>
                    </div>
                  </div>

                  {entityResult.entity.riskFactors && entityResult.entity.riskFactors.length > 0 && (
                    <div style={{ marginBottom: 14 }}>
                      <span style={{ fontSize: 11.5, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase' }}>Risk Factors:</span>
                      <ul style={{ margin: '6px 0 0 18px', padding: 0, fontSize: 12, color: '#cbd5e1', lineHeight: 1.5 }}>
                        {entityResult.entity.riskFactors.map((rf: string, idx: number) => (
                          <li key={idx}>{rf}</li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {entityResult.entity.investigatorActions && entityResult.entity.investigatorActions.length > 0 && (
                    <div style={{ marginBottom: 14, background: '#091522', padding: 10, borderRadius: 6, border: '1px solid #1e3a5f' }}>
                      <span style={{ fontSize: 11.5, fontWeight: 700, color: '#38bdf8', textTransform: 'uppercase' }}>Recommended Actions:</span>
                      <ul style={{ margin: '6px 0 0 18px', padding: 0, fontSize: 12, color: '#93c5fd', lineHeight: 1.5 }}>
                        {entityResult.entity.investigatorActions.map((act: string, idx: number) => (
                          <li key={idx}>{act}</li>
                        ))}
                      </ul>
                    </div>
                  )}

                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 12, paddingTop: 10, borderTop: '1px solid #1e293b', fontSize: 11, color: '#64748b' }}>
                    <span>Engine: <strong style={{ color: '#38bdf8' }}>{entityResult.entity.aiModelVersion || 'OpenRouter LLaMA-3.3-70B'}</strong></span>
                    <Badge variant="success">LIVE ML INFERENCE</Badge>
                  </div>
                </div>
              ) : (
                <div>
                  <div style={{ textAlign: 'center', padding: '16px 20px', color: '#10b981', borderBottom: '1px solid #1e293b', marginBottom: 16 }}>
                    <CheckCircle2 size={32} style={{ margin: '0 auto 8px auto' }} />
                    <h4 style={{ margin: '0 0 4px 0', color: '#fff' }}>No Active Incident Complaints Recorded</h4>
                    <p style={{ margin: 0, fontSize: 12, color: '#94a3b8' }}>
                      This identifier has zero filed victim complaints in the Cyber Trace registry.
                    </p>
                  </div>

                  {entityResult.aiEvaluation && (
                    <div style={{ fontSize: 12 }}>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 12 }}>
                        <div style={{ background: '#090d16', padding: 8, borderRadius: 6, border: '1px solid #1e293b' }}>
                          <span style={{ color: '#64748b' }}>Carrier/Platform:</span> <strong>{entityResult.aiEvaluation.providerOrBank}</strong>
                        </div>
                        <div style={{ background: '#090d16', padding: 8, borderRadius: 6, border: '1px solid #1e293b' }}>
                          <span style={{ color: '#64748b' }}>Baseline Risk:</span> <strong style={{ color: '#10b981' }}>{entityResult.aiEvaluation.riskScore} / 100</strong>
                        </div>
                      </div>
                      <div style={{ color: '#cbd5e1', lineHeight: 1.5, background: '#090d16', padding: 10, borderRadius: 6, border: '1px solid #1e293b', marginBottom: 12 }}>
                        <strong>Behavioral Analysis:</strong> {entityResult.aiEvaluation.namingPatternAnalysis}
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 11, color: '#64748b' }}>
                        <span>Engine: <strong style={{ color: '#38bdf8' }}>{entityResult.aiEvaluation.modelVersion}</strong></span>
                        <Badge variant="info">AI VERIFIED</Badge>
                      </div>
                    </div>
                  )}
                </div>
              )
            ) : (
              <div style={{ textAlign: 'center', padding: '40px 20px', color: '#64748b' }}>
                <Search size={36} style={{ margin: '0 auto 12px auto', opacity: 0.4 }} />
                <p style={{ margin: 0, fontSize: 13 }}>Enter a phone number or UPI handle to check previous cybercrime case references.</p>
              </div>
            )}
          </Card>
        </div>
      )}
    </div>
  );
}

