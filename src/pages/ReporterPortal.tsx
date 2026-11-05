import React, { useState, useEffect } from 'react';
import {
  FileText, Plus, ShieldCheck, Clock, CheckCircle2, AlertTriangle, ArrowRight,
  Upload, Search, File, ChevronRight, Lock, Bell, Check, AlertCircle, RefreshCw,
  ExternalLink, UserCheck, Eye, Hash, Wallet, DollarSign, Calendar, MessageSquare
} from 'lucide-react';
import { api, navigate, money, shortAddress, formatTime, toast } from '../api';
import { Button, Card, Badge, PageHeader, LoadingState, ErrorState, Field } from '../components/ui';

export function StatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    'Submitted': 'info',
    'Pending Review': 'warning',
    'Accepted': 'success',
    'Under Investigation': 'primary',
    'Evidence Requested': 'danger',
    'Evidence Received': 'warning',
    'Resolved': 'success',
    'Closed': 'secondary',
    'Rejected': 'danger'
  };
  return <Badge variant={map[status] || 'secondary'}>{status}</Badge>;
}

export function ProgressStepper({ status }: { status: string }) {
  const steps = ['Submitted', 'Pending Review', 'Accepted', 'Under Investigation', 'Resolved'];
  const isRejected = status === 'Rejected';
  const isEvidenceReq = status === 'Evidence Requested' || status === 'Evidence Received';

  let currentIdx = steps.indexOf(status);
  if (status === 'Evidence Requested' || status === 'Evidence Received') currentIdx = 3;
  if (status === 'Closed') currentIdx = 4;
  if (currentIdx === -1 && !isRejected) currentIdx = 0;

  return (
    <div style={{ margin: '20px 0 28px', background: '#08121f', padding: '20px 24px', borderRadius: 8, border: '1px solid #1a2d42' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', position: 'relative', marginBottom: 12 }}>
        <div style={{ position: 'absolute', top: 14, left: '5%', right: '5%', height: 2, background: '#1c344d', zIndex: 1 }} />
        {steps.map((step, idx) => {
          const completed = !isRejected && idx <= currentIdx;
          const active = !isRejected && idx === currentIdx;
          return (
            <div key={step} style={{ zIndex: 2, display: 'flex', flexDirection: 'column', alignItems: 'center', width: '18%' }}>
              <div style={{
                width: 30, height: 30, borderRadius: '50%',
                background: isRejected && idx === 0 ? '#ef4444' : completed ? '#087f94' : '#0e1e30',
                border: active ? '2px solid #38bdf8' : '2px solid #1c344d',
                display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: 12, fontWeight: 700
              }}>
                {completed ? '✓' : idx + 1}
              </div>
              <span style={{ fontSize: 11, marginTop: 8, fontWeight: active ? 700 : 500, color: active ? '#38bdf8' : completed ? '#cbd5e1' : '#64748b', textAlign: 'center' }}>
                {step}
              </span>
            </div>
          );
        })}
      </div>

      {isEvidenceReq && (
        <div style={{ marginTop: 14, padding: '10px 14px', background: 'rgba(239, 68, 68, 0.1)', border: '1px solid #ef4444', borderRadius: 6, display: 'flex', alignItems: 'center', gap: 10 }}>
          <AlertTriangle size={18} color="#ef4444" />
          <span style={{ fontSize: 12, color: '#fca5a5' }}>
            <strong>Action Required:</strong> The investigating officer has requested additional evidence. Please scroll down to respond.
          </span>
        </div>
      )}

      {isRejected && (
        <div style={{ marginTop: 14, padding: '10px 14px', background: 'rgba(239, 68, 68, 0.1)', border: '1px solid #ef4444', borderRadius: 6, display: 'flex', alignItems: 'center', gap: 10 }}>
          <AlertCircle size={18} color="#ef4444" />
          <span style={{ fontSize: 12, color: '#fca5a5' }}>
            <strong>Complaint Rejected:</strong> This complaint could not be accepted for criminal inquiry. See officer note below for details.
          </span>
        </div>
      )}
    </div>
  );
}

// 1. Reporter Dashboard
export function ReporterDashboard() {
  const [complaints, setComplaints] = useState<any[]>([]);
  const [notifications, setNotifications] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      api('/complaints'),
      api('/notifications')
    ]).then(([comps, notes]) => {
      setComplaints(comps);
      setNotifications(notes);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, []);

  if (loading) return <LoadingState />;

  const total = complaints.length;
  const inReview = complaints.filter(c => ['Submitted', 'Pending Review'].includes(c.status)).length;
  const evidenceReq = complaints.filter(c => c.status === 'Evidence Requested').length;
  const resolved = complaints.filter(c => ['Resolved', 'Closed'].includes(c.status)).length;

  return (
    <div style={{ padding: '24px 32px' }}>
      <PageHeader
        eyebrow="CITIZEN COMPLAINT PORTAL"
        title="Reporter Dashboard"
        description="Report cryptocurrency fraud, track officer actions, and provide supporting forensic evidence."
        action={
          <Button onClick={() => navigate('/reporter/submit')}>
            <Plus size={16} /> File New Complaint
          </Button>
        }
      />

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))', gap: 16, marginBottom: 24 }}>
        <Card style={{ padding: '18px 20px' }}>
          <div style={{ fontSize: 11, color: '#94a3b8', fontWeight: 600, display: 'flex', justifyContent: 'space-between' }}>
            TOTAL COMPLAINTS <FileText size={16} />
          </div>
          <div style={{ fontSize: 32, fontWeight: 800, margin: '8px 0', color: '#f8fafc' }}>{total}</div>
          <div style={{ fontSize: 11, color: '#64748b' }}>Submitted across all categories</div>
        </Card>

        <Card style={{ padding: '18px 20px' }}>
          <div style={{ fontSize: 11, color: '#94a3b8', fontWeight: 600, display: 'flex', justifyContent: 'space-between' }}>
            IN REVIEW / VERIFICATION <Clock size={16} color="#38bdf8" />
          </div>
          <div style={{ fontSize: 32, fontWeight: 800, margin: '8px 0', color: '#38bdf8' }}>{inReview}</div>
          <div style={{ fontSize: 11, color: '#64748b' }}>Awaiting initial officer evaluation</div>
        </Card>

        <Card style={{ padding: '18px 20px', borderColor: evidenceReq > 0 ? '#ef4444' : '#1a2d42' }}>
          <div style={{ fontSize: 11, color: evidenceReq > 0 ? '#f87171' : '#94a3b8', fontWeight: 600, display: 'flex', justifyContent: 'space-between' }}>
            ACTION REQUIRED <AlertTriangle size={16} color={evidenceReq > 0 ? '#ef4444' : '#94a3b8'} />
          </div>
          <div style={{ fontSize: 32, fontWeight: 800, margin: '8px 0', color: evidenceReq > 0 ? '#ef4444' : '#f8fafc' }}>{evidenceReq}</div>
          <div style={{ fontSize: 11, color: '#64748b' }}>Officer requested additional proof</div>
        </Card>

        <Card style={{ padding: '18px 20px' }}>
          <div style={{ fontSize: 11, color: '#94a3b8', fontWeight: 600, display: 'flex', justifyContent: 'space-between' }}>
            RESOLVED / CLOSED <CheckCircle2 size={16} color="#10b981" />
          </div>
          <div style={{ fontSize: 32, fontWeight: 800, margin: '8px 0', color: '#10b981' }}>{resolved}</div>
          <div style={{ fontSize: 11, color: '#64748b' }}>Inquiry concluded</div>
        </Card>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 20 }}>
        <Card style={{ padding: 20 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <h2 style={{ fontSize: 16, margin: 0, color: '#f8fafc' }}>My Submitted Complaints</h2>
            <Button variant="secondary" onClick={() => navigate('/reporter/cases')}>View All</Button>
          </div>

          {complaints.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '36px 0', color: '#64748b' }}>
              <FileText size={36} style={{ margin: '0 auto 12px', opacity: 0.5 }} />
              <p>You have not submitted any complaints yet.</p>
              <Button onClick={() => navigate('/reporter/submit')} style={{ marginTop: 8 }}>
                File Your First Complaint
              </Button>
            </div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid #1a2d42', color: '#64748b', textAlign: 'left' }}>
                    <th style={{ padding: '8px 12px' }}>CASE ID</th>
                    <th style={{ padding: '8px 12px' }}>INCIDENT TYPE</th>
                    <th style={{ padding: '8px 12px' }}>REPORTED LOSS</th>
                    <th style={{ padding: '8px 12px' }}>STATUS</th>
                    <th style={{ padding: '8px 12px' }}>FILED DATE</th>
                    <th style={{ padding: '8px 12px' }}>ACTION</th>
                  </tr>
                </thead>
                <tbody>
                  {complaints.slice(0, 5).map(c => (
                    <tr key={c.caseId} style={{ borderBottom: '1px solid #111e2e' }}>
                      <td style={{ padding: '10px 12px', fontWeight: 700, color: '#38bdf8' }}>{c.caseId}</td>
                      <td style={{ padding: '10px 12px' }}>{c.incidentType}</td>
                      <td style={{ padding: '10px 12px', fontWeight: 600 }}>{money(c.reportedLoss)}</td>
                      <td style={{ padding: '10px 12px' }}><StatusBadge status={c.status} /></td>
                      <td style={{ padding: '10px 12px', color: '#64748b' }}>{formatTime(c.createdAt)}</td>
                      <td style={{ padding: '10px 12px' }}>
                        <Button variant="secondary" onClick={() => navigate(`/reporter/cases/${c.caseId}`)} style={{ padding: '4px 10px', fontSize: 11 }}>
                          Track <ArrowRight size={12} />
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>

        <Card style={{ padding: 20 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <h2 style={{ fontSize: 16, margin: 0, color: '#f8fafc' }}>Officer Updates</h2>
            <Bell size={16} color="#94a3b8" />
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {notifications.length === 0 ? (
              <p style={{ color: '#64748b', fontSize: 12 }}>No new notifications.</p>
            ) : (
              notifications.slice(0, 6).map(n => (
                <div key={n.id} style={{ padding: 12, background: '#0a1726', borderRadius: 6, border: '1px solid #1a2d42' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, marginBottom: 4 }}>
                    <strong style={{ color: '#38bdf8' }}>{n.title}</strong>
                    <span style={{ color: '#64748b' }}>{formatTime(n.createdAt)}</span>
                  </div>
                  <p style={{ fontSize: 11.5, color: '#cbd5e1', margin: 0 }}>{n.message}</p>
                  {n.caseId && (
                    <button onClick={() => navigate(`/reporter/cases/${n.caseId}`)} style={{ background: 'none', border: 'none', color: '#38bdf8', fontSize: 10.5, padding: 0, marginTop: 6, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4 }}>
                      Open Case {n.caseId} <ChevronRight size={10} />
                    </button>
                  )}
                </div>
              ))
            )}
          </div>
        </Card>
      </div>
    </div>
  );
}

// 2. Submit Complaint Page
export function SubmitComplaintPage() {
  const [busy, setBusy] = useState(false);
  const [incidentType, setIncidentType] = useState('Investment Scam');
  const [incidentDate, setIncidentDate] = useState(new Date().toISOString().slice(0, 10));
  const [reportedLoss, setReportedLoss] = useState('250000');
  const [currency, setCurrency] = useState('INR');
  const [chain, setChain] = useState('Ethereum');
  const [reportedWallet, setReportedWallet] = useState('');
  const [transactionHash, setTransactionHash] = useState('');
  const [description, setDescription] = useState('');
  const [attachments, setAttachments] = useState<any[]>([]);
  const [createdCase, setCreatedCase] = useState<any>(null);
  const [isDemo, setIsDemo] = useState(false);

  const fillFictionalExample = () => {
    setIsDemo(true);
    setIncidentType('Investment Scam');
    setIncidentDate('2026-10-24');
    setReportedLoss('642000');
    setCurrency('INR');
    setChain('Bitcoin');
    setReportedWallet('1A1zP1eP5QGefi2DMPTfTL5SLmv7DivfNa');
    setTransactionHash('232629023');
    setDescription('Victim was approached on WhatsApp with offers of automated cryptocurrency arbitrage yields. Instructed to transfer INR 6,42,000 worth of Bitcoin to the suspect wallet for pool staking. Victim was subsequently locked out and all withdrawals were blocked.');
    setAttachments([
      { name: 'whatsapp_chat_evidence.pdf', type: 'application/pdf', size: 142050, description: 'Exported chat transcript with fraudulent broker' },
      { name: 'bank_transfer_receipt_utr.png', type: 'image/png', size: 284100, description: 'Bank transfer UTR confirmation for INR 642,000' }
    ]);
    toast('Fictional scam case pre-filled! Review and click Submit.', 'info');
  };

  const handleInstantSubmitFictional = async () => {
    setBusy(true);
    try {
      const res = await api('/complaints', {
        method: 'POST',
        body: JSON.stringify({
          incidentType: 'Investment Scam',
          incidentDate: '2026-10-24',
          reportedLoss: 642000,
          currency: 'INR',
          chain: 'Bitcoin',
          reportedWallet: '1A1zP1eP5QGefi2DMPTfTL5SLmv7DivfNa',
          transactionHash: '232629023',
          is_demo: 1,
          incidentChannel: 'WhatsApp / Web',
          description: 'Victim was approached on WhatsApp with offers of automated cryptocurrency arbitrage yields. Instructed to transfer INR 6,42,000 worth of Bitcoin to the suspect wallet for pool staking. Victim was subsequently locked out and all withdrawals were blocked.',
          attachments: [
            { name: 'whatsapp_chat_evidence.pdf', type: 'application/pdf', size: 142050, description: 'Exported chat transcript with fraudulent broker' },
            { name: 'bank_transfer_receipt_utr.png', type: 'image/png', size: 284100, description: 'Bank transfer UTR confirmation for INR 642,000' }
          ]
        })
      });
      setCreatedCase(res);
      toast('Fictional complaint registered immediately! Now accessible in CBI Officer queue.', 'success');
    } catch (err: any) {
      toast(err.message || 'Submission failed', 'error');
    } finally {
      setBusy(false);
    }
  };

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || !files.length) return;
    const file = files[0];
    const item = {
      name: file.name,
      type: file.type || 'application/octet-stream',
      size: file.size,
      description: 'Uploaded by citizen reporter'
    };
    setAttachments(prev => [...prev, item]);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!description || description.length < 10) {
      toast('Please provide a detailed incident narrative (minimum 10 characters).', 'error');
      return;
    }
    setBusy(true);
    try {
      const res = await api('/complaints', {
        method: 'POST',
        body: JSON.stringify({
          incidentType,
          incidentDate,
          reportedLoss: Number(reportedLoss) || 0,
          currency,
          chain,
          reportedWallet: reportedWallet.trim(),
          transactionHash: transactionHash.trim(),
          description,
          is_demo: isDemo ? 1 : 0,
          attachments
        })
      });
      setCreatedCase(res);
      toast('Complaint submitted successfully. Case ID generated.');
    } catch (err: any) {
      toast(err.message || 'Submission failed', 'error');
    } finally {
      setBusy(false);
    }
  };

  if (createdCase) {
    const targetCaseId = createdCase.caseId || createdCase.id;
    const handleSwitchToOfficer = async () => {
      try {
        await api('/auth/demo-officer', { method: 'POST', body: '{}' });
        navigate(`/app/case-review/${targetCaseId}`);
      } catch {
        navigate('/app/incoming');
      }
    };

    return (
      <div style={{ maxWidth: 640, margin: '40px auto', padding: 24 }}>
        <Card style={{ padding: 32, textAlign: 'center', border: '1px solid #10b981' }}>
          <div style={{ width: 64, height: 64, borderRadius: '50%', background: 'rgba(16, 185, 129, 0.1)', color: '#10b981', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
            <Check size={36} />
          </div>
          <h1 style={{ fontSize: 24, margin: '0 0 8px' }}>Complaint Successfully Filed</h1>
          <p style={{ color: '#94a3b8', fontSize: 13, marginBottom: 20 }}>
            Your cybercrime report has been formally registered and dispatched to the CBI Cyber Crime Investigation Division incoming queue.
          </p>

          <div style={{ background: '#0a1829', padding: 18, borderRadius: 8, border: '1px solid #1a2d42', margin: '0 0 24px', textAlign: 'left' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
              <span style={{ fontSize: 11, color: '#64748b' }}>OFFICIAL CASE ID</span>
              <strong style={{ fontSize: 16, color: '#38bdf8', fontFamily: 'monospace' }}>{targetCaseId}</strong>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
              <span style={{ fontSize: 11, color: '#64748b' }}>INCIDENT CATEGORY</span>
              <strong style={{ fontSize: 12 }}>{createdCase.incidentType}</strong>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
              <span style={{ fontSize: 11, color: '#64748b' }}>REPORTED AMOUNT</span>
              <strong style={{ fontSize: 12 }}>{money(createdCase.reportedLoss || createdCase.reportedAmount)}</strong>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ fontSize: 11, color: '#64748b' }}>INITIAL STATUS</span>
              <StatusBadge status={createdCase.status} />
            </div>
          </div>

          <div style={{ display: 'flex', gap: 10, justifyContent: 'center', flexWrap: 'wrap' }}>
            <Button variant="secondary" onClick={() => navigate('/reporter/cases')}>View My Cases</Button>
            <Button variant="secondary" onClick={() => navigate(`/reporter/cases/${targetCaseId}`)}>
              Track as Citizen <ArrowRight size={14} />
            </Button>
            <Button onClick={handleSwitchToOfficer} style={{ background: '#087f94', color: '#fff', border: 'none' }}>
              <ShieldCheck size={15} /> Switch to CBI Officer &amp; Review Case
            </Button>
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: 840, margin: '24px auto', padding: '0 20px' }}>
      <PageHeader
        eyebrow="CYBERCRIME REPORTING WING"
        title="File a Cybercrime Complaint"
        description="Submit full details regarding cryptocurrency theft, investment fraud, ransomware, or phishing incidents."
      />

      {/* Auto-Fill Banner for Quick Testing */}
      <div style={{
        background: 'linear-gradient(90deg, #091c2e 0%, #0c273e 100%)',
        border: '1px solid #1a3c54',
        borderRadius: 8,
        padding: '14px 18px',
        marginBottom: 20,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: 12
      }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <strong style={{ color: '#fff', fontSize: 13 }}>Quick Testing &amp; Verification</strong>
            <span style={{ background: '#087f94', color: '#fff', fontSize: 10, fontWeight: 700, padding: '2px 6px', borderRadius: 4 }}>1-CLICK DEMO</span>
          </div>
          <p style={{ margin: '3px 0 0', color: '#94a3b8', fontSize: 12 }}>
            Fill a realistic cybercrime complaint (WhatsApp arbitrage scam, ₹6,42,000, Bitcoin tx #232629023) to test instant reflection in the CBI Officer queue.
          </p>
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <Button type="button" variant="secondary" onClick={fillFictionalExample} style={{ fontSize: 12, padding: '6px 12px' }}>
            ⚡ Fill Fictional Scam Example
          </Button>
          <Button type="button" onClick={handleInstantSubmitFictional} disabled={busy} style={{ fontSize: 12, padding: '6px 14px', background: '#087f94' }}>
            🚀 1-Click Submit &amp; Send to Officer
          </Button>
        </div>
      </div>

      <Card style={{ padding: 28 }}>
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
            <Field label="Incident Category">
              <select value={incidentType} onChange={e => setIncidentType(e.target.value)} style={{ width: '100%', padding: '9px 12px', background: '#0a1726', border: '1px solid #1a2d42', color: '#fff', borderRadius: 6 }}>
                <option value="Investment Scam">Investment Scam / Arbitrage Scheme</option>
                <option value="Job & Task Scam">Job & Task Scam (Telegram / WhatsApp)</option>
                <option value="Phishing">Phishing / Malicious DApp Signature</option>
                <option value="Ransomware Extortion">Ransomware Extortion Demand</option>
                <option value="Impersonation Fraud">Official Impersonation Fraud</option>
                <option value="Unauthorized Transfer">Unauthorized Wallet Drain</option>
                <option value="Other Cybercrime">Other Digital Asset Cybercrime</option>
              </select>
            </Field>

            <Field label="Incident Date">
              <input type="date" value={incidentDate} onChange={e => setIncidentDate(e.target.value)} style={{ width: '100%', padding: '9px 12px', background: '#0a1726', border: '1px solid #1a2d42', color: '#fff', borderRadius: 6 }} />
            </Field>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr', gap: 16 }}>
            <Field label="Reported Loss Amount">
              <input type="number" value={reportedLoss} onChange={e => setReportedLoss(e.target.value)} placeholder="e.g. 250000" style={{ width: '100%', padding: '9px 12px', background: '#0a1726', border: '1px solid #1a2d42', color: '#fff', borderRadius: 6 }} />
            </Field>

            <Field label="Currency">
              <select value={currency} onChange={e => setCurrency(e.target.value)} style={{ width: '100%', padding: '9px 12px', background: '#0a1726', border: '1px solid #1a2d42', color: '#fff', borderRadius: 6 }}>
                <option value="INR">INR (₹)</option>
                <option value="USD">USD ($)</option>
                <option value="USDT">USDT</option>
              </select>
            </Field>

            <Field label="Blockchain Network">
              <select value={chain} onChange={e => setChain(e.target.value)} style={{ width: '100%', padding: '9px 12px', background: '#0a1726', border: '1px solid #1a2d42', color: '#fff', borderRadius: 6 }}>
                <option value="Ethereum">Ethereum (ETH)</option>
                <option value="TRON">TRON (TRX/USDT)</option>
                <option value="Bitcoin">Bitcoin (BTC)</option>
                <option value="BNB Chain">BNB Chain (BSC)</option>
                <option value="Polygon">Polygon (MATIC)</option>
              </select>
            </Field>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
            <Field label="Suspect Wallet Address (Beneficiary)">
              <input value={reportedWallet} onChange={e => setReportedWallet(e.target.value)} placeholder="0x... or T... or 1..." style={{ width: '100%', padding: '9px 12px', background: '#0a1726', border: '1px solid #1a2d42', color: '#fff', borderRadius: 6, fontFamily: 'monospace' }} />
            </Field>

            <Field label="Transaction Hash / ID (if available)">
              <input value={transactionHash} onChange={e => setTransactionHash(e.target.value)} placeholder="0x... or 64-char transaction hash" style={{ width: '100%', padding: '9px 12px', background: '#0a1726', border: '1px solid #1a2d42', color: '#fff', borderRadius: 6, fontFamily: 'monospace' }} />
            </Field>
          </div>

          <Field label="Comprehensive Incident Narrative & Sequence of Events">
            <textarea
              rows={4}
              value={description}
              onChange={e => setDescription(e.target.value)}
              placeholder="Describe how the contact was initiated, communications exchanged, instructions given by fraudster, exchange accounts utilized, and timestamps..."
              style={{ width: '100%', padding: '10px 12px', background: '#0a1726', border: '1px solid #1a2d42', color: '#fff', borderRadius: 6, resize: 'vertical' }}
            />
          </Field>

          <div>
            <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#94a3b8', marginBottom: 6 }}>
              Attach Supporting Evidence (Bank Statements, Chat Exports, Screenshots)
            </label>
            <div style={{ padding: 20, border: '2px dashed #1a2d42', borderRadius: 8, textAlign: 'center', background: '#08121f' }}>
              <Upload size={28} color="#64748b" style={{ margin: '0 auto 8px' }} />
              <p style={{ fontSize: 12, color: '#94a3b8', margin: '0 0 10px' }}>Upload transaction receipts or communication records</p>
              <input type="file" onChange={handleFile} style={{ display: 'inline-block', fontSize: 12 }} />
            </div>

            {attachments.length > 0 && (
              <div style={{ marginTop: 12, display: 'flex', flexDirection: 'column', gap: 6 }}>
                {attachments.map((att, i) => (
                  <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 12px', background: '#0d1b2a', borderRadius: 6, fontSize: 12 }}>
                    <File size={16} color="#38bdf8" />
                    <span style={{ fontWeight: 600 }}>{att.name}</span>
                    <span style={{ color: '#64748b', fontSize: 11 }}>({Math.round(att.size / 1024)} KB)</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div style={{ padding: 12, background: 'rgba(8, 127, 148, 0.08)', borderRadius: 6, border: '1px solid #087f94', fontSize: 11.5, color: '#94a3b8', lineHeight: 1.5 }}>
            <ShieldCheck size={16} color="#087f94" style={{ display: 'inline', marginRight: 6, verticalAlign: 'middle' }} />
            All submissions generate an immutable SHA-256 evidence chain of custody. Knowingly filing false police or agency complaints is punishable under Indian Penal Code Section 182.
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 12 }}>
            <Button variant="secondary" type="button" onClick={() => navigate('/reporter/dashboard')}>Cancel</Button>
            <Button type="submit" disabled={busy}>
              {busy ? 'Registering Complaint…' : 'Submit Formal Complaint'}
            </Button>
          </div>
        </form>
      </Card>
    </div>
  );
}

// 3. My Cases Page
export function MyCasesPage() {
  const [cases, setCases] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');

  const load = () => {
    let url = '/complaints?';
    if (statusFilter) url += `status=${encodeURIComponent(statusFilter)}&`;
    if (search) url += `q=${encodeURIComponent(search)}&`;
    api(url).then(res => {
      setCases(res);
      setLoading(false);
    }).catch(() => setLoading(false));
  };

  useEffect(() => { load(); }, [statusFilter]);

  return (
    <div style={{ padding: '24px 32px' }}>
      <PageHeader
        eyebrow="CASE TRACKING"
        title="My Filed Complaints"
        description="Comprehensive list of all complaints filed under your verified citizen reporter profile."
        action={
          <Button onClick={() => navigate('/reporter/submit')}>
            <Plus size={16} /> File New Complaint
          </Button>
        }
      />

      <Card style={{ padding: 20, marginBottom: 20 }}>
        <div style={{ display: 'flex', gap: 14, alignItems: 'center' }}>
          <div style={{ flex: 1, position: 'relative' }}>
            <Search size={16} color="#64748b" style={{ position: 'absolute', left: 12, top: 11 }} />
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && load()}
              placeholder="Search by Case ID, incident type, wallet address..."
              style={{ width: '100%', padding: '9px 12px 9px 36px', background: '#0a1726', border: '1px solid #1a2d42', color: '#fff', borderRadius: 6, fontSize: 13 }}
            />
          </div>
          <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} style={{ padding: '9px 12px', background: '#0a1726', border: '1px solid #1a2d42', color: '#fff', borderRadius: 6, fontSize: 13 }}>
            <option value="">All Statuses</option>
            <option value="Submitted">Submitted</option>
            <option value="Pending Review">Pending Review</option>
            <option value="Accepted">Accepted</option>
            <option value="Under Investigation">Under Investigation</option>
            <option value="Evidence Requested">Evidence Requested</option>
            <option value="Evidence Received">Evidence Received</option>
            <option value="Resolved">Resolved</option>
            <option value="Rejected">Rejected</option>
          </select>
          <Button variant="secondary" onClick={load}><RefreshCw size={14} /></Button>
        </div>
      </Card>

      {loading ? <LoadingState /> : cases.length === 0 ? (
        <Card style={{ padding: 40, textAlign: 'center', color: '#64748b' }}>
          <p>No complaints match your search filter.</p>
        </Card>
      ) : (
        <Card style={{ padding: 0, overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12.5 }}>
            <thead>
              <tr style={{ background: '#08121f', borderBottom: '1px solid #1a2d42', color: '#94a3b8', textAlign: 'left' }}>
                <th style={{ padding: '12px 16px' }}>CASE ID</th>
                <th style={{ padding: '12px 16px' }}>INCIDENT CATEGORY</th>
                <th style={{ padding: '12px 16px' }}>REPORTED LOSS</th>
                <th style={{ padding: '12px 16px' }}>CHAIN / WALLET</th>
                <th style={{ padding: '12px 16px' }}>STATUS</th>
                <th style={{ padding: '12px 16px' }}>ASSIGNED OFFICER</th>
                <th style={{ padding: '12px 16px' }}>FILED AT</th>
                <th style={{ padding: '12px 16px' }}>ACTION</th>
              </tr>
            </thead>
            <tbody>
              {cases.map(c => (
                <tr key={c.caseId} style={{ borderBottom: '1px solid #111e2e' }}>
                  <td style={{ padding: '14px 16px', fontWeight: 700, color: '#38bdf8' }}>{c.caseId}</td>
                  <td style={{ padding: '14px 16px', fontWeight: 600 }}>{c.incidentType}</td>
                  <td style={{ padding: '14px 16px', fontWeight: 700 }}>{money(c.reportedLoss)}</td>
                  <td style={{ padding: '14px 16px', fontFamily: 'monospace' }}>
                    {c.chain} · {shortAddress(c.reportedWallet || '—', 5)}
                  </td>
                  <td style={{ padding: '14px 16px' }}><StatusBadge status={c.status} /></td>
                  <td style={{ padding: '14px 16px', color: '#94a3b8' }}>{c.assignedOfficerName || 'Pending Assignment'}</td>
                  <td style={{ padding: '14px 16px', color: '#64748b' }}>{formatTime(c.createdAt)}</td>
                  <td style={{ padding: '14px 16px' }}>
                    <Button onClick={() => navigate(`/reporter/cases/${c.caseId}`)} style={{ padding: '6px 12px', fontSize: 11 }}>
                      Track Case <ArrowRight size={12} />
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}
    </div>
  );
}

// 4. Case Tracking Page
export function CaseTrackingPage({ id }: { id: string }) {
  const [complaint, setComplaint] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [evidenceName, setEvidenceName] = useState('');
  const [evidenceDesc, setEvidenceDesc] = useState('');
  const [additionalNote, setAdditionalNote] = useState('');

  const loadCase = () => {
    api(`/complaints/${encodeURIComponent(id)}`).then(res => {
      setComplaint(res);
      setLoading(false);
    }).catch(() => setLoading(false));
  };

  useEffect(() => { loadCase(); }, [id]);

  const handleUploadEvidence = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!evidenceName) return;
    setUploading(true);
    try {
      await api(`/complaints/${encodeURIComponent(id)}/evidence`, {
        method: 'POST',
        body: JSON.stringify({
          filename: evidenceName,
          description: evidenceDesc || 'Additional proof submitted by citizen reporter',
          fileSize: 1048576,
          fileType: 'application/pdf'
        })
      });
      toast('Supporting evidence uploaded and forwarded to investigating officer.');
      setEvidenceName('');
      setEvidenceDesc('');
      loadCase();
    } catch (err: any) {
      toast(err.message || 'Upload failed', 'error');
    } finally {
      setUploading(false);
    }
  };

  if (loading) return <LoadingState />;
  if (!complaint) return <ErrorState message={`Case ${id} not found or you are not authorized to view it.`} />;

  return (
    <div style={{ maxWidth: 1000, margin: '20px auto', padding: '0 20px 40px' }}>
      <div style={{ marginBottom: 12 }}>
        <button onClick={() => navigate('/reporter/cases')} style={{ background: 'none', border: 'none', color: '#94a3b8', fontSize: 12, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6 }}>
          ← Back to My Complaints
        </button>
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
        <div>
          <div style={{ fontSize: 11, color: '#38bdf8', fontWeight: 700, letterSpacing: 1 }}>CASE DOSSIER</div>
          <h1 style={{ fontSize: 26, margin: '4px 0 6px', display: 'flex', alignItems: 'center', gap: 12 }}>
            {complaint.caseId}
            <StatusBadge status={complaint.status} />
          </h1>
          <p style={{ color: '#8ca6b8', fontSize: 12.5, margin: 0 }}>
            {complaint.incidentType} · Reported Loss: <strong>{money(complaint.reportedLoss)}</strong> · Filed on {formatTime(complaint.createdAt)}
          </p>
        </div>

        <Button variant="secondary" onClick={loadCase}><RefreshCw size={14} /> Refresh Status</Button>
      </div>

      <ProgressStepper status={complaint.status} />

      <div style={{ display: 'grid', gridTemplateColumns: '1.6fr 1.2fr', gap: 20 }}>
        <div>
          <Card style={{ padding: 22, marginBottom: 20 }}>
            <h2 style={{ fontSize: 15, margin: '0 0 14px', borderBottom: '1px solid #1a2d42', paddingBottom: 8 }}>Incident Information</h2>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, fontSize: 12, marginBottom: 16 }}>
              <div>
                <span style={{ color: '#64748b', display: 'block' }}>INVESTIGATING OFFICER</span>
                <strong>{complaint.assignedOfficerName || 'Awaiting Formal Assignment'}</strong>
              </div>
              <div>
                <span style={{ color: '#64748b', display: 'block' }}>INCIDENT DATE</span>
                <strong>{formatTime(complaint.incidentDate)}</strong>
              </div>
              <div>
                <span style={{ color: '#64748b', display: 'block' }}>BLOCKCHAIN NETWORK</span>
                <strong>{complaint.chain}</strong>
              </div>
              <div>
                <span style={{ color: '#64748b', display: 'block' }}>SUSPECT WALLET</span>
                <strong style={{ fontFamily: 'monospace', wordBreak: 'break-all' }}>{complaint.reportedWallet || 'None reported'}</strong>
              </div>
            </div>

            {complaint.transactionHash && (
              <div style={{ marginBottom: 14, fontSize: 12 }}>
                <span style={{ color: '#64748b', display: 'block' }}>TRANSACTION HASH</span>
                <code style={{ background: '#0a1726', padding: '4px 8px', borderRadius: 4, color: '#38bdf8', wordBreak: 'break-all', display: 'block', marginTop: 4 }}>
                  {complaint.transactionHash}
                </code>
              </div>
            )}

            <div style={{ fontSize: 12 }}>
              <span style={{ color: '#64748b', display: 'block', marginBottom: 4 }}>COMPLAINANT STATEMENT</span>
              <p style={{ background: '#08121f', padding: 12, borderRadius: 6, margin: 0, color: '#cbd5e1', lineHeight: 1.5, border: '1px solid #132337' }}>
                {complaint.description}
              </p>
            </div>

            {complaint.rejectionReason && (
              <div style={{ marginTop: 14, padding: 12, background: 'rgba(239, 68, 68, 0.1)', border: '1px solid #ef4444', borderRadius: 6, fontSize: 12 }}>
                <strong style={{ color: '#ef4444', display: 'block', marginBottom: 4 }}>Official Rejection Reason:</strong>
                <p style={{ margin: 0, color: '#fca5a5' }}>{complaint.rejectionReason}</p>
              </div>
            )}
          </Card>

          <Card style={{ padding: 22 }}>
            <h2 style={{ fontSize: 15, margin: '0 0 14px', borderBottom: '1px solid #1a2d42', paddingBottom: 8 }}>
              Submitted Evidence Files ({complaint.evidence?.length || 0})
            </h2>

            {(!complaint.evidence || complaint.evidence.length === 0) ? (
              <p style={{ color: '#64748b', fontSize: 12 }}>No evidence documents attached to this case yet.</p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {complaint.evidence.map((ev: any) => (
                  <div key={ev.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 14px', background: '#08121f', borderRadius: 6, border: '1px solid #1a2d42', fontSize: 12 }}>
                    <div>
                      <div style={{ fontWeight: 600, color: '#f8fafc', display: 'flex', alignItems: 'center', gap: 6 }}>
                        <FileText size={14} color="#38bdf8" /> {ev.filename}
                      </div>
                      <div style={{ color: '#64748b', fontSize: 11, marginTop: 2 }}>
                        {ev.description || 'Supporting documentation'} · SHA-256: <code style={{ fontSize: 10 }}>{ev.sha256?.slice(0, 16)}…</code>
                      </div>
                    </div>
                    <span style={{ fontSize: 11, color: '#64748b' }}>{formatTime(ev.createdAt)}</span>
                  </div>
                ))}
              </div>
            )}

            <div style={{ marginTop: 20, paddingTop: 16, borderTop: '1px solid #1a2d42' }}>
              <h3 style={{ fontSize: 13, margin: '0 0 10px', color: '#38bdf8' }}>Upload Additional Supporting Evidence</h3>
              <form onSubmit={handleUploadEvidence} style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                <input
                  value={evidenceName}
                  onChange={e => setEvidenceName(e.target.value)}
                  placeholder="Document Name (e.g. Bank_UTR_Receipt.pdf, Chat_Export.zip)"
                  style={{ width: '100%', padding: '8px 12px', background: '#0a1726', border: '1px solid #1a2d42', color: '#fff', borderRadius: 6, fontSize: 12 }}
                />
                <input
                  value={evidenceDesc}
                  onChange={e => setEvidenceDesc(e.target.value)}
                  placeholder="Description of what this evidence proves..."
                  style={{ width: '100%', padding: '8px 12px', background: '#0a1726', border: '1px solid #1a2d42', color: '#fff', borderRadius: 6, fontSize: 12 }}
                />
                <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                  <Button type="submit" disabled={uploading || !evidenceName}>
                    <Upload size={14} /> {uploading ? 'Forwarding…' : 'Attach & Submit to Officer'}
                  </Button>
                </div>
              </form>
            </div>
          </Card>
        </div>

        <div>
          <Card style={{ padding: 22 }}>
            <h2 style={{ fontSize: 15, margin: '0 0 14px', borderBottom: '1px solid #1a2d42', paddingBottom: 8, display: 'flex', alignItems: 'center', gap: 8 }}>
              <MessageSquare size={16} color="#38bdf8" /> Official Officer Updates
            </h2>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              {(!complaint.updates || complaint.updates.length === 0) ? (
                <p style={{ color: '#64748b', fontSize: 12 }}>No officer updates recorded yet.</p>
              ) : (
                complaint.updates.map((u: any) => (
                  <div key={u.id} style={{ padding: '12px 14px', background: '#08121f', borderRadius: 6, borderLeft: '3px solid #087f94', border: '1px solid #15273b' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, marginBottom: 4 }}>
                      <strong style={{ color: '#38bdf8' }}>{u.authorName}</strong>
                      <span style={{ color: '#64748b' }}>{formatTime(u.createdAt)}</span>
                    </div>
                    <p style={{ fontSize: 12, color: '#e2e8f0', margin: 0, lineHeight: 1.45 }}>{u.message}</p>
                    {u.newStatus && (
                      <div style={{ marginTop: 6, fontSize: 10.5, color: '#94a3b8' }}>
                        Workflow state: <strong>{u.newStatus}</strong>
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>

            <div style={{ marginTop: 24, padding: 12, background: '#0a1726', borderRadius: 6, border: '1px solid #1a2d42', fontSize: 11, color: '#64748b' }}>
              <Lock size={13} style={{ display: 'inline', marginRight: 4, verticalAlign: 'middle' }} />
              CBI Officer internal investigative notes and cross-agency intelligence queries are confidential and omitted from citizen tracking views.
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}

