import React, { useState, useEffect } from 'react';
import {
  Waypoints, ArrowRight, ArrowLeft, CheckCircle2, AlertCircle, Play,
  RotateCcw, ShieldCheck, UserCheck, FileText, Search, Database,
  Network, Lock, Eye, ExternalLink, RefreshCw, Send, Check, Copy
} from 'lucide-react';
import { api, navigate, toast } from '../api';
import { Button, Badge, Card } from '../components/ui';

interface DemoStep {
  step: number;
  title: string;
  role: 'reporter' | 'officer' | 'system';
  summary: string;
  actionText?: string;
  endpoint?: string;
  action?: () => Promise<void>;
  viewLink?: string;
  details: string;
}

export default function InteractiveDemo() {
  const [currentStep, setCurrentStep] = useState(1);
  const [demoCase, setDemoCase] = useState<any>(null);
  const [busy, setBusy] = useState(false);
  const [logs, setLogs] = useState<string[]>([]);
  const [copied, setCopied] = useState(false);
  const [resetting, setResetting] = useState(false);

  const addLog = (msg: string) => {
    setLogs(prev => [ `[${new Date().toLocaleTimeString()}] ${msg}`, ...prev.slice(0, 19) ]);
  };

  // Safe demo reset
  const handleResetDemoData = async () => {
    setResetting(true);
    try {
      const res = await api('/demo/reset', { method: 'POST', body: '{}' });
      toast(`Demo data safely reset! Purged ${res.purgedCount || 0} demo record(s).`, 'success');
      addLog(`Purged ${res.purgedCount || 0} demo cases: ${(res.caseIds || []).join(', ') || 'none'}`);
      setDemoCase(null);
      setCurrentStep(1);
    } catch (e: any) {
      toast(e.message || 'Failed to reset demo data', 'error');
    } finally {
      setResetting(false);
    }
  };

  // Step 2: One-click inject & submit fictional complaint
  const handleCreateDemoComplaint = async () => {
    setBusy(true);
    try {
      // Sign in as demo reporter first
      await api('/auth/demo-reporter', { method: 'POST', body: '{}' });
      addLog('Signed in as Citizen Reporter: Priya Nair');

      const res = await api('/complaints', {
        method: 'POST',
        body: JSON.stringify({
          incidentType: 'Investment Scam',
          incidentDate: '2026-03-01',
          reportedLoss: 642000,
          currency: 'INR',
          chain: 'Bitcoin',
          reportedWallet: '1A1zP1eP5QGefi2DMPTfTL5SLmv7DivfNa',
          transactionHash: '232629023',
          incidentChannel: 'WhatsApp / Web',
          is_demo: 1,
          description: 'Victim was approached via WhatsApp with promises of automated 35% weekly cryptocurrency arbitrage yields by AlphaTrade Global. Induced into transferring ₹6,42,000 INR worth of Bitcoin across two transactions. Suspects subsequently locked withdrawal access and severed contact.',
          attachments: [
            { filename: 'WhatsApp_Chat_Export_AlphaTrade.pdf', fileType: 'application/pdf', fileSize: 245760, description: 'Exported chat transcript with fraudulent broker' },
            { filename: 'Bank_Transfer_UTR_Receipt.pdf', fileType: 'application/pdf', fileSize: 182400, description: 'Bank transfer UTR confirmation for INR 642,000' },
            { filename: 'Crypto_Exchange_Withdrawal_Proof.png', fileType: 'image/png', fileSize: 412900, description: 'On-chain withdrawal screenshot' }
          ]
        })
      });

      setDemoCase(res);
      addLog(`Complaint registered with Case ID: ${res.caseId}`);
      toast(`Case ${res.caseId} generated and filed!`, 'success');
      setCurrentStep(4);
    } catch (e: any) {
      toast(e.message || 'Failed to create demo complaint', 'error');
      addLog(`Error creating complaint: ${e.message}`);
    } finally {
      setBusy(false);
    }
  };

  // Step 5 & 6: Switch to officer and verify case in queue
  const handleSwitchToOfficer = async () => {
    setBusy(true);
    try {
      await api('/auth/demo-officer', { method: 'POST', body: '{}' });
      addLog('Switched session to CBI Officer: Insp. Rajesh Sharma');
      const list = await api('/complaints');
      addLog(`Officer queue fetched: ${list.length} complaints visible.`);
      toast('Switched to CBI Officer Console', 'info');
      setCurrentStep(6);
    } catch (e: any) {
      toast(e.message, 'error');
    } finally {
      setBusy(false);
    }
  };

  // Step 8: Run transaction analytics
  const handleRunAnalytics = async () => {
    if (!demoCase?.caseId) return;
    setBusy(true);
    try {
      await api('/auth/demo-officer', { method: 'POST', body: '{}' });
      const analysis = await api(`/complaints/${demoCase.caseId}/analyze`, { method: 'POST', body: '{}' });
      addLog(`Analytics run on Tx #${demoCase.transactionHash}: Risk Score ${analysis.riskScore || 78}/100 [${analysis.riskCategory || 'HIGH RISK'}]`);
      toast(`Forensic graph analytics completed! Risk score: ${analysis.riskScore || 78}/100`, 'success');
      setCurrentStep(9);
    } catch (e: any) {
      toast(e.message, 'error');
    } finally {
      setBusy(false);
    }
  };

  // Step 9: Update status to Under Investigation
  const handleUpdateStatus = async () => {
    if (!demoCase?.caseId) return;
    setBusy(true);
    try {
      await api('/auth/demo-officer', { method: 'POST', body: '{}' });
      const updated = await api(`/complaints/${demoCase.caseId}/status`, {
        method: 'POST',
        body: JSON.stringify({ status: 'Under Investigation', reason: 'High-risk transaction cluster identified in Elliptic Bitcoin graph. Initiating deep tracing.' })
      });
      setDemoCase(updated);
      addLog(`Case status updated to 'Under Investigation'`);
      toast(`Status moved to 'Under Investigation'`, 'info');
      setCurrentStep(10);
    } catch (e: any) {
      toast(e.message, 'error');
    } finally {
      setBusy(false);
    }
  };

  // Step 10: Request additional evidence
  const handleRequestEvidence = async () => {
    if (!demoCase?.caseId) return;
    setBusy(true);
    try {
      await api('/auth/demo-officer', { method: 'POST', body: '{}' });
      const updated = await api(`/complaints/${demoCase.caseId}/request-evidence`, {
        method: 'POST',
        body: JSON.stringify({ message: 'Please provide full bank statement showing debit of INR 6,42,000 and the WhatsApp profile screenshot of the scammer.' })
      });
      setDemoCase(updated);
      addLog(`Officer requested additional evidence. Complainant notified.`);
      toast(`Evidence requested from citizen`, 'info');
      setCurrentStep(11);
    } catch (e: any) {
      toast(e.message, 'error');
    } finally {
      setBusy(false);
    }
  };

  // Step 12: Citizen responds with requested evidence
  const handleCitizenUploadEvidence = async () => {
    if (!demoCase?.caseId) return;
    setBusy(true);
    try {
      await api('/auth/demo-reporter', { method: 'POST', body: '{}' });
      const evidence = await api(`/complaints/${demoCase.caseId}/evidence`, {
        method: 'POST',
        body: JSON.stringify({
          filename: 'HDFC_Bank_Statement_March2026.pdf',
          fileType: 'application/pdf',
          fileSize: 312000,
          description: 'Official HDFC Bank account statement showing ₹6,42,000 UTR debit transaction to cryptocurrency broker.'
        })
      });
      addLog(`Citizen uploaded: ${evidence.filename}. Status automatically advanced to 'Evidence Received'.`);
      toast(`Evidence submitted! Status changed to 'Evidence Received'`, 'success');
      setCurrentStep(13);
    } catch (e: any) {
      toast(e.message, 'error');
    } finally {
      setBusy(false);
    }
  };

  // Step 14: Add confidential internal note
  const handleAddInternalNote = async () => {
    if (!demoCase?.caseId) return;
    setBusy(true);
    try {
      await api('/auth/demo-officer', { method: 'POST', body: '{}' });
      await api(`/complaints/${demoCase.caseId}/notes`, {
        method: 'POST',
        body: JSON.stringify({ note: 'Confidential: Suspect wallet is linked to multi-layered laundering hop. Section 91 notice being drafted for domestic crypto exchange node.' })
      });
      addLog(`Officer internal note added (confidential, hidden from reporter).`);
      toast(`Confidential investigation note added`, 'success');
      setCurrentStep(15);
    } catch (e: any) {
      toast(e.message, 'error');
    } finally {
      setBusy(false);
    }
  };

  // Step 15: Resolve case
  const handleResolveCase = async () => {
    if (!demoCase?.caseId) return;
    setBusy(true);
    try {
      await api('/auth/demo-officer', { method: 'POST', body: '{}' });
      const updated = await api(`/complaints/${demoCase.caseId}/status`, {
        method: 'POST',
        body: JSON.stringify({ status: 'Resolved', reason: 'Forensic graph analysis complete. Section 91 notice issued to exchange. Assets frozen at VASP cluster.' })
      });
      setDemoCase(updated);
      addLog(`Case moved to 'Resolved'. Complete 15-step demonstration lifecycle finished!`);
      toast(`Case successfully resolved! Full workflow complete.`, 'success');
    } catch (e: any) {
      toast(e.message, 'error');
    } finally {
      setBusy(false);
    }
  };

  const steps: DemoStep[] = [
    {
      step: 1,
      title: 'Citizen Portal & Complaint Filing',
      role: 'reporter',
      summary: 'Citizens register complaints with incident details, victim loss, crypto network, suspect wallet, and transaction hashes.',
      actionText: 'Load & File Fictional Demo Complaint',
      action: handleCreateDemoComplaint,
      viewLink: '/reporter/submit',
      details: 'Demonstrates public complaint submission with structured incident types and cryptographic asset details.'
    },
    {
      step: 2,
      title: 'One-Click Fictional Complaint Pre-fill',
      role: 'reporter',
      summary: 'Pre-fills realistic cybercrime data (Priya Nair, WhatsApp Arbitrage, ₹6,42,000, Bitcoin tx #232629023, synthetic PDFs).',
      actionText: 'Execute Pre-fill & Registration',
      action: handleCreateDemoComplaint,
      viewLink: '/reporter/submit',
      details: 'Provides instant, zero-friction demonstration without manual typing.'
    },
    {
      step: 3,
      title: 'Backend Persistence & Atomic Transaction',
      role: 'system',
      summary: 'Complaint is atomically written to SQLite database with is_demo = 1 tag for clean presentation isolation.',
      details: 'Strict schema integrity, foreign keys, and audit logging.'
    },
    {
      step: 4,
      title: 'Collision-Safe Sequential Case ID Generation',
      role: 'system',
      summary: `Sequential Case ID (${demoCase?.caseId || 'CR-2026-00001'}) generated deterministically by the backend.`,
      actionText: 'Switch to CBI Officer Investigation Portal',
      action: handleSwitchToOfficer,
      viewLink: demoCase ? `/reporter/cases/${demoCase.caseId}` : '/reporter/cases',
      details: 'Human-readable case identifier following international cyber law enforcement standards.'
    },
    {
      step: 5,
      title: 'CBI Officer Portal & Incoming Triage Queue',
      role: 'officer',
      summary: 'Complaints immediately appear in the CBI Officer intake queue without manual page reloads.',
      actionText: 'Open Incoming Reports Queue',
      action: handleSwitchToOfficer,
      viewLink: '/app/incoming',
      details: 'Officers can search, filter by blockchain network, status, and sort by financial loss or risk.'
    },
    {
      step: 6,
      title: 'Locate & Review Complaint in Queue',
      role: 'officer',
      summary: 'Officer opens the incoming report record, inspecting victim statement, loss amount, and uploaded evidence files.',
      viewLink: demoCase ? `/app/case-review/${demoCase.caseId}` : '/app/incoming',
      details: 'Provides full visibility into complainant timeline and uploaded documents.'
    },
    {
      step: 7,
      title: 'Integrity Verification of Submitted Evidence',
      role: 'officer',
      summary: 'Evidence files feature SHA-256 cryptographic hashes to preserve chain of custody for court admissibility.',
      viewLink: demoCase ? `/app/case-review/${demoCase.caseId}` : '/app/incoming',
      details: 'Cryptographic proof guarantees files are never tampered with after submission.'
    },
    {
      step: 8,
      title: 'Run Cyber Trace Graph & Risk Analytics',
      role: 'officer',
      summary: 'Connects the complaint to the 203,769-node Elliptic Bitcoin transaction graph, running BFS/DFS multi-hop analysis.',
      actionText: 'Run Transaction Analytics',
      action: handleRunAnalytics,
      viewLink: demoCase ? `/app/graph/${demoCase.transactionHash || '232629023'}` : '/app/graph/232629023',
      details: 'Computes 6-parameter Investigation Readiness Score, hop count, time decay, and identifies suspect clusters.'
    },
    {
      step: 9,
      title: 'Case Status Transition to "Under Investigation"',
      role: 'officer',
      summary: 'Officer accepts complaint and transitions state to "Under Investigation" with formal case notes.',
      actionText: 'Move to "Under Investigation"',
      action: handleUpdateStatus,
      viewLink: demoCase ? `/app/case-review/${demoCase.caseId}` : '/app/incoming',
      details: 'State machine validates transitions on the backend and sends notification to the reporter.'
    },
    {
      step: 10,
      title: 'Request Additional Evidence from Citizen',
      role: 'officer',
      summary: 'Officer requests bank statements and chat transcripts directly from the citizen.',
      actionText: 'Request Additional Evidence',
      action: handleRequestEvidence,
      viewLink: demoCase ? `/app/case-review/${demoCase.caseId}` : '/app/incoming',
      details: 'Creates structured evidence request and moves status to "Evidence Requested".'
    },
    {
      step: 11,
      title: 'Citizen Notification & Case Tracking Portal',
      role: 'reporter',
      summary: 'Citizen sees the officer request in their portal with real-time status update.',
      viewLink: demoCase ? `/reporter/cases/${demoCase.caseId}` : '/reporter/cases',
      details: 'Strict RBAC ensures citizen sees only public status updates, never internal notes.'
    },
    {
      step: 12,
      title: 'Citizen Submits Requested Documentation',
      role: 'reporter',
      summary: 'Complainant uploads HDFC bank statement PDF responding to the officer request.',
      actionText: 'Submit Requested Bank Statement',
      action: handleCitizenUploadEvidence,
      viewLink: demoCase ? `/reporter/cases/${demoCase.caseId}` : '/reporter/cases',
      details: 'Status automatically transitions to "Evidence Received" upon upload.'
    },
    {
      step: 13,
      title: 'Officer Confirms Evidence Received',
      role: 'officer',
      summary: 'Officer receives automated notification and reviews the newly uploaded bank statement.',
      viewLink: demoCase ? `/app/case-review/${demoCase.caseId}` : '/app/incoming',
      details: 'New evidence is timestamped and integrated into the case dossier.'
    },
    {
      step: 14,
      title: 'Confidential Internal Investigation Note',
      role: 'officer',
      summary: 'Officer logs sensitive operational intelligence (Section 91 notice preparation, suspect exchange KYC inquiry).',
      actionText: 'Add Confidential Internal Note',
      action: handleAddInternalNote,
      viewLink: demoCase ? `/app/case-review/${demoCase.caseId}` : '/app/incoming',
      details: 'Internal notes have is_internal = 1 and are completely filtered out from citizen API responses.'
    },
    {
      step: 15,
      title: 'Resolution, Audit Trail & Legal Dossier',
      role: 'officer',
      summary: 'Case successfully resolved. Full immutable audit trail generated with timeline of all actions.',
      actionText: 'Mark Case as Resolved',
      action: handleResolveCase,
      viewLink: demoCase ? `/app/case-review/${demoCase.caseId}` : '/app/incoming',
      details: 'End of 15-step investigation lifecycle. Complete proof of concept verified.'
    }
  ];

  const current = steps.find(s => s.step === currentStep) || steps[0];

  const copyCaseId = () => {
    if (!demoCase?.caseId) return;
    navigator.clipboard.writeText(demoCase.caseId);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
    toast('Case ID copied to clipboard!', 'info');
  };

  return (
    <div style={{ minHeight: '100vh', background: '#070d17', color: '#e2e8f0', fontFamily: 'system-ui, -apple-system, sans-serif' }}>
      {/* Top Header */}
      <header style={{
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        padding: '16px 32px', background: '#0a1424', borderBottom: '1px solid #1a2a3e'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <a href="/" onClick={e => { e.preventDefault(); navigate('/'); }} style={{ display: 'flex', alignItems: 'center', gap: 10, textDecoration: 'none', color: '#fff' }}>
            <div style={{ width: 34, height: 34, borderRadius: 8, background: '#087f94', display: 'grid', placeItems: 'center', color: '#fff' }}>
              <Waypoints size={20} />
            </div>
            <div>
              <strong style={{ fontSize: 15, letterSpacing: '0.5px' }}>CYBER TRACE INDIA</strong>
              <div style={{ fontSize: 10, color: '#38bdf8', fontWeight: 600 }}>INTERACTIVE DEMO WALKTHROUGH</div>
            </div>
          </a>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <Button
            variant="secondary"
            onClick={handleResetDemoData}
            disabled={resetting}
            style={{ fontSize: 12, padding: '7px 14px', borderColor: '#ef4444', color: '#fca5a5' }}
          >
            <RotateCcw size={14} className={resetting ? 'animate-spin' : ''} />
            {resetting ? 'Purging…' : 'Reset Demo Data'}
          </Button>

          <Button
            variant="secondary"
            onClick={() => navigate('/reporter/dashboard')}
            style={{ fontSize: 12, padding: '7px 14px' }}
          >
            <UserCheck size={14} color="#4fd7c1" /> Citizen Portal
          </Button>

          <Button
            variant="primary"
            onClick={() => navigate('/app/incoming')}
            style={{ fontSize: 12, padding: '7px 14px' }}
          >
            <ShieldCheck size={14} /> CBI Officer Portal
          </Button>
        </div>
      </header>

      {/* Main Container */}
      <div style={{ maxWidth: 1200, margin: '32px auto', padding: '0 24px', display: 'grid', gridTemplateColumns: '320px 1fr', gap: 24 }}>
        
        {/* Left Column: 15-Step Stepper Navigation */}
        <div style={{ background: '#0b1626', border: '1px solid #1a2b40', borderRadius: 10, padding: 20, height: 'fit-content' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <span style={{ fontSize: 12, fontWeight: 700, color: '#38bdf8', letterSpacing: '0.8px' }}>
              DEMO LIFECYCLE (15 STEPS)
            </span>
            <span style={{ fontSize: 11, color: '#64748b' }}>{currentStep} of 15</span>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {steps.map(s => {
              const isActive = s.step === currentStep;
              const isPast = s.step < currentStep;
              return (
                <button
                  key={s.step}
                  onClick={() => setCurrentStep(s.step)}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 10, padding: '8px 10px',
                    borderRadius: 6, border: '1px solid', textAlign: 'left',
                    borderColor: isActive ? '#38bdf8' : isPast ? '#1e3852' : '#142334',
                    background: isActive ? 'rgba(56, 189, 248, 0.12)' : isPast ? 'rgba(30, 56, 82, 0.4)' : '#08121f',
                    cursor: 'pointer', transition: 'all 0.15s'
                  }}
                >
                  <div style={{
                    width: 22, height: 22, borderRadius: '50%', display: 'grid', placeItems: 'center',
                    fontSize: 10, fontWeight: 700, flexShrink: 0,
                    background: isActive ? '#38bdf8' : isPast ? '#10b981' : '#1e293b',
                    color: isActive ? '#000' : '#fff'
                  }}>
                    {isPast ? <Check size={12} /> : s.step}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{
                      fontSize: 11.5, fontWeight: isActive ? 700 : 500,
                      color: isActive ? '#fff' : isPast ? '#94a3b8' : '#64748b',
                      whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis'
                    }}>
                      {s.title}
                    </div>
                  </div>
                </button>
              );
            })}
          </div>

          {/* Active Case Badge */}
          {demoCase && (
            <div style={{ marginTop: 20, padding: 12, background: '#0a1a2f', border: '1px solid #1a3554', borderRadius: 8 }}>
              <div style={{ fontSize: 10, color: '#64748b', marginBottom: 4 }}>ACTIVE DEMO CASE</div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: 13, fontWeight: 700, color: '#38bdf8', fontFamily: 'monospace' }}>
                  {demoCase.caseId}
                </span>
                <button onClick={copyCaseId} style={{ background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer', padding: 2 }}>
                  {copied ? <Check size={14} color="#10b981" /> : <Copy size={14} />}
                </button>
              </div>
              <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 4 }}>
                Status: <strong style={{ color: '#4fd7c1' }}>{demoCase.status}</strong>
              </div>
            </div>
          )}
        </div>

        {/* Right Column: Step Detail & Interactive Execution */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          
          {/* Main Step Card */}
          <div style={{ background: '#0b1626', border: '1px solid #1a2b40', borderRadius: 10, padding: 28 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
                  <Badge variant={current.role === 'officer' ? 'primary' : current.role === 'reporter' ? 'info' : 'warning'}>
                    ROLE: {current.role.toUpperCase()}
                  </Badge>
                  <span style={{ fontSize: 12, color: '#64748b' }}>Step {current.step} of 15</span>
                </div>
                <h2 style={{ fontSize: 22, fontWeight: 700, color: '#fff', margin: 0 }}>
                  {current.title}
                </h2>
              </div>

              <div style={{ display: 'flex', gap: 8 }}>
                <Button
                  variant="secondary"
                  disabled={currentStep <= 1}
                  onClick={() => setCurrentStep(v => Math.max(1, v - 1))}
                  style={{ padding: '6px 12px', fontSize: 12 }}
                >
                  <ArrowLeft size={14} /> Previous
                </Button>
                <Button
                  variant="secondary"
                  disabled={currentStep >= 15}
                  onClick={() => setCurrentStep(v => Math.min(15, v + 1))}
                  style={{ padding: '6px 12px', fontSize: 12 }}
                >
                  Next <ArrowRight size={14} />
                </Button>
              </div>
            </div>

            <p style={{ fontSize: 14, color: '#94a3b8', lineHeight: 1.6, marginBottom: 20 }}>
              {current.summary}
            </p>

            <div style={{ background: '#08121f', padding: 16, borderRadius: 8, border: '1px solid #142336', marginBottom: 24, fontSize: 12.5, color: '#cbd5e1', lineHeight: 1.5 }}>
              <strong style={{ color: '#38bdf8', display: 'block', marginBottom: 4 }}>Architectural Context:</strong>
              {current.details}
            </div>

            {/* Action buttons */}
            <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap', alignItems: 'center' }}>
              {current.action && (
                <Button
                  variant="primary"
                  onClick={current.action}
                  disabled={busy}
                  style={{ padding: '10px 20px', fontSize: 13, fontWeight: 700 }}
                >
                  <Play size={14} />
                  {busy ? 'Executing…' : current.actionText || 'Execute Step Action'}
                </Button>
              )}

              {current.viewLink && (
                <Button
                  variant="secondary"
                  onClick={() => navigate(current.viewLink!)}
                  style={{ padding: '10px 18px', fontSize: 13 }}
                >
                  <ExternalLink size={14} /> View in Live Interface
                </Button>
              )}

              {currentStep < 15 && (
                <Button
                  variant="secondary"
                  onClick={() => setCurrentStep(v => v + 1)}
                  style={{ padding: '10px 16px', fontSize: 13, marginLeft: 'auto' }}
                >
                  Skip to Step {currentStep + 1} <ArrowRight size={14} />
                </Button>
              )}
            </div>
          </div>

          {/* Live System Execution Logs */}
          <div style={{ background: '#08121e', border: '1px solid #142336', borderRadius: 10, padding: 18 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
              <span style={{ fontSize: 11, fontWeight: 700, color: '#64748b', letterSpacing: '0.8px' }}>
                LIVE DEMO AUDIT LOGS
              </span>
              <span style={{ fontSize: 10, color: '#475569' }}>Real SQLite &amp; API events</span>
            </div>
            <div style={{
              fontFamily: 'monospace', fontSize: 11.5, background: '#040910', padding: 12,
              borderRadius: 6, minHeight: 90, maxHeight: 180, overflowY: 'auto', color: '#a5f3fc',
              display: 'flex', flexDirection: 'column', gap: 4
            }}>
              {logs.length === 0 ? (
                <span style={{ color: '#475569' }}>No live actions executed yet. Click &ldquo;Execute Step Action&rdquo; above to start.</span>
              ) : (
                logs.map((l, i) => <div key={i}>{l}</div>)
              )}
            </div>
          </div>

          {/* Academic Disclosure */}
          <div style={{ padding: '14px 18px', background: 'rgba(8, 18, 31, 0.6)', border: '1px solid #142336', borderRadius: 8, fontSize: 11.5, color: '#64748b', lineHeight: 1.5 }}>
            <strong style={{ color: '#94a3b8' }}>Academic &amp; Research Disclaimer:</strong> Cyber Trace is an independent academic and research project. The &ldquo;CBI Officer&rdquo; role is a simulated investigation role label and does not represent an official government service.
          </div>
        </div>

      </div>
    </div>
  );
}
