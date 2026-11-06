import React, { useState, useEffect } from 'react';
import {
  BriefcaseBusiness, ShieldAlert, CheckCircle2, AlertTriangle, ArrowRight,
  Upload, Search, File, ChevronRight, Lock, Bell, Check, AlertCircle, RefreshCw,
  ExternalLink, UserCheck, Eye, Hash, Wallet, DollarSign, Calendar, MessageSquare,
  FileText, Network, ShieldCheck, ArrowUpRight, Scale, XCircle, UserPlus, Zap,
  FileOutput, Info
} from 'lucide-react';
import { api, navigate, money, shortAddress, formatTime, toast } from '../api';
import { Button, Card, Badge, PageHeader, LoadingState, ErrorState, Field, MetricCard, RiskBadge } from '../components/ui';
import { StatusBadge, ProgressStepper } from './ReporterPortal';

// CBI Officer Project Role Disclaimer Banner
export function OfficerDisclaimerBanner() {
  return (
    <div style={{
      background: 'rgba(8, 127, 148, 0.08)',
      border: '1px solid #1a3c54',
      borderRadius: 8,
      padding: '12px 18px',
      marginBottom: 20,
      display: 'flex',
      alignItems: 'center',
      gap: 12
    }}>
      <ShieldCheck size={20} color="#38bdf8" style={{ flexShrink: 0 }} />
      <div style={{ fontSize: 11.5, color: '#94a3b8', lineHeight: 1.5 }}>
        <strong style={{ color: '#38bdf8' }}>CBI Officer Project Workspace:</strong> This role label represents an authorized cryptocurrency fraud investigator workspace within Cyber Trace. It is an educational and forensic research simulation and does not imply an official affiliation with the Central Bureau of Investigation or any government agency.
      </div>
    </div>
  );
}

// 1. Incoming Reports Queue Page
export function IncomingReportsPage() {
  const [complaints, setComplaints] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('all');
  const [search, setSearch] = useState('');

  const loadData = () => {
    setLoading(true);
    const query = statusFilter !== 'all' ? `?status=${encodeURIComponent(statusFilter)}` : '';
    api(`/complaints${query}`).then(res => {
      setComplaints(res);
      setLoading(false);
    }).catch(err => {
      toast(err.message, 'error');
      setLoading(false);
    });
  };

  useEffect(() => {
    loadData();
  }, [statusFilter]);

  const filtered = complaints.filter(c => {
    if (!search) return true;
    const term = search.toLowerCase();
    const caseId = (c.caseId || c.id || '').toLowerCase();
    const reporterName = (c.reporterName || '').toLowerCase();
    const incidentType = (c.incidentType || '').toLowerCase();
    const wallet = (c.reportedWallet || c.suspectWallet || '').toLowerCase();
    const tx = (c.transactionHash || '').toLowerCase();
    return (
      caseId.includes(term) ||
      reporterName.includes(term) ||
      incidentType.includes(term) ||
      wallet.includes(term) ||
      tx.includes(term)
    );
  });

  const submittedCount = complaints.filter(c => c.status === 'Submitted').length;
  const pendingCount = complaints.filter(c => c.status === 'Pending Review').length;
  const underInvCount = complaints.filter(c => c.status === 'Under Investigation').length;
  const evidenceReceivedCount = complaints.filter(c => c.status === 'Evidence Received').length;

  return (
    <div style={{ padding: '24px 32px' }}>
      <PageHeader
        eyebrow="CBI INVESTIGATOR INTAKE"
        title="Incoming Citizen Reports"
        description="Review, triage, accept, and investigate cybercrime complaints filed by citizen reporters."
        action={
          <div style={{ display: 'flex', gap: 10 }}>
            <Button variant="secondary" onClick={loadData}>
              <RefreshCw size={14} /> Refresh Queue
            </Button>
            <Button onClick={() => navigate('/app/graph')}>
              <Network size={14} /> Graph Explorer
            </Button>
          </div>
        }
      />

      <OfficerDisclaimerBanner />

      {/* Metrics overview */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))', gap: 14, marginBottom: 24 }}>
        <MetricCard label="New Submissions" value={submittedCount} detail="Awaiting initial triage" icon={Bell} />
        <MetricCard label="Pending Review" value={pendingCount} detail="Preliminary inspection" icon={BriefcaseBusiness} />
        <MetricCard label="Evidence Received" value={evidenceReceivedCount} detail="Citizen responded with docs" icon={FileText} />
        <MetricCard label="Under Investigation" value={underInvCount} detail="Active forensics" icon={ShieldAlert} />
      </div>

      {/* Filter and Search Bar */}
      <Card style={{ padding: 16, marginBottom: 20 }}>
        <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', gap: 10, alignItems: 'center', flex: 1, minWidth: 260 }}>
            <Search size={16} color="#64748b" />
            <input
              type="text"
              placeholder="Search by Case ID, victim name, wallet address, or tx hash…"
              value={search}
              onChange={e => setSearch(e.target.value)}
              style={{
                width: '100%',
                padding: '8px 12px',
                background: '#091523',
                border: '1px solid #1a2d42',
                borderRadius: 6,
                color: '#fff',
                fontSize: 13
              }}
            />
          </div>

          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <span style={{ fontSize: 12, color: '#94a3b8' }}>Status Filter:</span>
            {['all', 'Submitted', 'Pending Review', 'Accepted', 'Under Investigation', 'Evidence Received'].map(st => (
              <button
                key={st}
                onClick={() => setStatusFilter(st)}
                style={{
                  padding: '5px 10px',
                  borderRadius: 5,
                  fontSize: 11.5,
                  fontWeight: 600,
                  cursor: 'pointer',
                  border: statusFilter === st ? '1px solid #38bdf8' : '1px solid #1b2f44',
                  background: statusFilter === st ? '#087f94' : '#0a1624',
                  color: statusFilter === st ? '#fff' : '#94a3b8'
                }}
              >
                {st === 'all' ? 'All Reports' : st}
              </button>
            ))}
          </div>
        </div>
      </Card>

      {/* Reports Table */}
      {loading ? (
        <LoadingState />
      ) : filtered.length === 0 ? (
        <Card style={{ padding: 48, textAlign: 'center' }}>
          <BriefcaseBusiness size={42} color="#64748b" style={{ margin: '0 auto 12px' }} />
          <h3 style={{ fontSize: 16, color: '#fff', margin: '0 0 6px' }}>No reports matching filter</h3>
          <p style={{ color: '#64748b', fontSize: 13, margin: 0 }}>All citizen cybercrime complaints have been processed or none match your search criteria.</p>
        </Card>
      ) : (
        <Card style={{ overflow: 'hidden' }}>
          <div className="table-scroll">
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: 12 }}>
              <thead>
                <tr style={{ background: '#0a1726', borderBottom: '1px solid #1a2d42', color: '#8ca6b8' }}>
                  <th style={{ padding: '12px 16px' }}>Case ID</th>
                  <th style={{ padding: '12px 16px' }}>Incident Type</th>
                  <th style={{ padding: '12px 16px' }}>Complainant</th>
                  <th style={{ padding: '12px 16px' }}>Reported Loss</th>
                  <th style={{ padding: '12px 16px' }}>Chain / Wallet</th>
                  <th style={{ padding: '12px 16px' }}>Status</th>
                  <th style={{ padding: '12px 16px' }}>Assigned To</th>
                  <th style={{ padding: '12px 16px' }}>Reported At</th>
                  <th style={{ padding: '12px 16px', textAlign: 'right' }}>Action</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(c => {
                  const targetCaseId = c.caseId || c.id;
                  return (
                    <tr
                      key={targetCaseId}
                      style={{ borderBottom: '1px solid #122133', cursor: 'pointer', transition: 'background 0.15s' }}
                      onClick={() => navigate(`/app/case-review/${targetCaseId}`)}
                    >
                      <td style={{ padding: '12px 16px' }}>
                        <strong style={{ color: '#38bdf8' }}>{targetCaseId}</strong>
                        {c.priority && (
                          <span style={{ marginLeft: 6, fontSize: 9.5, padding: '2px 5px', borderRadius: 3, background: '#1e293b', color: '#94a3b8' }}>
                            {c.priority.toUpperCase()}
                          </span>
                        )}
                      </td>
                      <td style={{ padding: '12px 16px', color: '#cbd5e1' }}>{c.incidentType}</td>
                      <td style={{ padding: '12px 16px' }}>
                        <div style={{ fontWeight: 600, color: '#fff' }}>{c.reporterName}</div>
                        <div style={{ fontSize: 10.5, color: '#64748b' }}>{c.reporterEmail}</div>
                      </td>
                      <td style={{ padding: '12px 16px', fontWeight: 600, color: '#f87171' }}>
                        {money(c.reportedLoss || c.reportedAmount || 0)}
                      </td>
                      <td style={{ padding: '12px 16px' }}>
                        <Badge variant="secondary">{c.chain || c.blockchainNetwork || 'Bitcoin'}</Badge>
                        {(c.reportedWallet || c.suspectWallet) && (
                          <div style={{ fontFamily: 'monospace', fontSize: 10.5, color: '#94a3b8', marginTop: 4 }}>
                            {shortAddress(c.reportedWallet || c.suspectWallet)}
                          </div>
                        )}
                      </td>
                      <td style={{ padding: '12px 16px' }}>
                        <StatusBadge status={c.status} />
                      </td>
                      <td style={{ padding: '12px 16px', color: '#cbd5e1' }}>
                        {c.assignedOfficerName ? (
                          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                            <UserCheck size={13} color="#38bdf8" /> {c.assignedOfficerName}
                          </span>
                        ) : (
                          <span style={{ color: '#64748b', fontStyle: 'italic' }}>Unassigned</span>
                        )}
                      </td>
                      <td style={{ padding: '12px 16px', color: '#64748b' }}>{formatTime(c.createdAt)}</td>
                      <td style={{ padding: '12px 16px', textAlign: 'right' }}>
                        <Button
                          variant="secondary"
                          style={{ padding: '4px 10px', fontSize: 11.5 }}
                          onClick={(e: React.MouseEvent) => {
                            e.stopPropagation();
                            navigate(`/app/case-review/${targetCaseId}`);
                          }}
                        >
                          Review Dossier <ArrowRight size={12} />
                        </Button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </div>
  );
}

// 2. Case Dossier Review & Forensic Investigation Page
export function CaseReviewPage({ id }: { id: string }) {
  const [complaint, setComplaint] = useState<any>(null);
  const [officers, setOfficers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Modals / forms
  const [rejectModal, setRejectModal] = useState(false);
  const [rejectionReason, setRejectionReason] = useState('');
  const [evidenceModal, setEvidenceModal] = useState(false);
  const [evidenceInstructions, setEvidenceInstructions] = useState('');
  const [internalNoteText, setInternalNoteText] = useState('');
  const [selectedOfficerId, setSelectedOfficerId] = useState('');

  // Analytics execution state
  const [analyzing, setAnalyzing] = useState(false);
  const [analyticsResult, setAnalyticsResult] = useState<any>(null);

  // On-chain address & verification state
  const [onChainData, setOnChainData] = useState<any>(null);
  const [verifyingTx, setVerifyingTx] = useState(false);
  const [txVerification, setTxVerification] = useState<any>(null);
  const [addingWatch, setAddingWatch] = useState(false);

  const loadCase = () => {
    setLoading(true);
    Promise.all([
      api(`/complaints/${id}`),
      api('/officers').catch(() => [])
    ]).then(async ([comp, offList]) => {
      setComplaint(comp);
      setOfficers(offList);
      if (comp.assignedOfficerId) {
        setSelectedOfficerId(comp.assignedOfficerId);
      }
      setLoading(false);

      // Load on-chain intelligence if wallet address is present
      const wallet = comp.reportedWallet || comp.suspectWallet;
      if (wallet) {
        try {
          const chain = comp.chain || comp.blockchainNetwork || 'Bitcoin';
          const addrData = await api(`/blockchain/address?chain=${encodeURIComponent(chain)}&address=${encodeURIComponent(wallet)}`);
          setOnChainData(addrData);
        } catch { }
      }
    }).catch(err => {
      setError(err.message);
      setLoading(false);
    });
  };

  const handleVerifyTxOnChain = async () => {
    const txHash = complaint?.transactionHash;
    if (!txHash) return;
    setVerifyingTx(true);
    try {
      const chain = complaint.chain || complaint.blockchainNetwork || 'Bitcoin';
      const res = await api('/blockchain/verify', {
        method: 'POST',
        body: JSON.stringify({ chain, txHash })
      });
      setTxVerification(res);
      toast(`On-chain verification: ${res.status}`, res.verified ? 'success' : 'info');
    } catch (e: any) {
      toast(e.message || 'On-chain verification check failed', 'error');
    } finally {
      setVerifyingTx(false);
    }
  };

  const handleAddToWatchtower = async () => {
    const wallet = complaint?.reportedWallet || complaint?.suspectWallet;
    if (!wallet) return;
    setAddingWatch(true);
    try {
      await api('/watchtower', {
        method: 'POST',
        body: JSON.stringify({
          chain: complaint.chain || complaint.blockchainNetwork || 'Bitcoin',
          address: wallet,
          caseId: complaint.caseId || complaint.id,
          label: `Suspect Wallet (${complaint.caseId || complaint.id})`
        })
      });
      toast('Address added to 24/7 Watchtower monitoring', 'success');
    } catch (e: any) {
      toast(e.message || 'Failed to add to Watchtower', 'error');
    } finally {
      setAddingWatch(false);
    }
  };

  useEffect(() => {
    loadCase();
  }, [id]);

  if (loading) return <LoadingState />;
  if (error || !complaint) return <ErrorState message={error || 'Case not found'} retry={loadCase} />;

  // Status transitions
  const handleStatusChange = async (newStatus: string, reason?: string) => {
    try {
      await api(`/complaints/${id}/status`, {
        method: 'POST',
        body: JSON.stringify({ status: newStatus, reason })
      });
      toast(`Status updated to ${newStatus}`, 'success');
      setRejectModal(false);
      loadCase();
    } catch (e: any) {
      toast(e.message, 'error');
    }
  };

  // Assign Officer
  const handleAssignOfficer = async (officerId: string) => {
    if (!officerId) return;
    try {
      await api(`/complaints/${id}/assign`, {
        method: 'POST',
        body: JSON.stringify({ officerId })
      });
      toast('Investigator assigned successfully', 'success');
      loadCase();
    } catch (e: any) {
      toast(e.message, 'error');
    }
  };

  // Request Evidence
  const handleRequestEvidence = async () => {
    if (!evidenceInstructions.trim()) {
      toast('Please enter specific evidence instructions', 'error');
      return;
    }
    try {
      await api(`/complaints/${id}/request-evidence`, {
        method: 'POST',
        body: JSON.stringify({ instructions: evidenceInstructions })
      });
      toast('Evidence requested from citizen reporter', 'success');
      setEvidenceModal(false);
      setEvidenceInstructions('');
      loadCase();
    } catch (e: any) {
      toast(e.message, 'error');
    }
  };

  // Add Internal Note
  const handleAddInternalNote = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!internalNoteText.trim()) return;
    try {
      await api(`/complaints/${id}/notes`, {
        method: 'POST',
        body: JSON.stringify({ note: internalNoteText })
      });
      toast('Internal confidential note recorded', 'success');
      setInternalNoteText('');
      loadCase();
    } catch (e: any) {
      toast(e.message, 'error');
    }
  };

  // Run Cyber Trace Analytics
  const handleRunAnalytics = async () => {
    setAnalyzing(true);
    try {
      const res = await api(`/complaints/${id}/analyze`, { method: 'POST', body: '{}' });
      setAnalyticsResult(res);
      toast('Forensic transaction analysis complete', 'success');
      setAnalyzing(false);
    } catch (e: any) {
      toast(e.message, 'error');
      setAnalyzing(false);
    }
  };

  const isTerminal = ['Resolved', 'Closed', 'Rejected'].includes(complaint.status);
  const displayCaseId = complaint.caseId || complaint.id;

  return (
    <div style={{ padding: '24px 32px' }}>
      {/* Breadcrumb & Navigation */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
        <button
          onClick={() => navigate('/app/incoming')}
          style={{ background: 'none', border: 'none', color: '#94a3b8', fontSize: 12, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6 }}
        >
          ← Back to Incoming Reports
        </button>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ fontSize: 11, color: '#64748b' }}>Case Dossier: {displayCaseId}</span>
          <button
            onClick={async () => {
              try { await api('/auth/demo-reporter', { method: 'POST', body: '{}' }); } catch {}
              navigate(`/reporter/cases/${displayCaseId}`);
            }}
            style={{
              background: '#0a1726', border: '1px solid #1a2d42', color: '#38bdf8',
              padding: '4px 8px', borderRadius: 4, fontSize: 11, cursor: 'pointer'
            }}
          >
            View as Citizen Reporter
          </button>
        </div>
      </div>

      <PageHeader
        eyebrow="CBI OFFICER CASE INVESTIGATION"
        title={`Case Record: ${displayCaseId}`}
        description={`${complaint.incidentType} reported by ${complaint.reporterName} on ${formatTime(complaint.createdAt)}`}
        action={
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <Button variant="secondary" onClick={loadCase}>
              <RefreshCw size={14} /> Refresh
            </Button>
            <Button onClick={handleRunAnalytics} disabled={analyzing}>
              <Zap size={15} color="#eab308" /> {analyzing ? 'Analyzing Graph…' : 'Run Cyber Trace Analytics'}
            </Button>
          </div>
        }
      />

      <OfficerDisclaimerBanner />

      <ProgressStepper status={complaint.status} />

      {/* State Machine Transition Actions Bar */}
      {!isTerminal && (
        <Card style={{ padding: '16px 20px', marginBottom: 22, background: '#0a1624', border: '1px solid #1a324a' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <span style={{ fontSize: 12, fontWeight: 700, color: '#94a3b8' }}>WORKFLOW ACTIONS:</span>
              <StatusBadge status={complaint.status} />
            </div>

            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {/* Accept Flow */}
              {['Submitted', 'Pending Review'].includes(complaint.status) && (
                <Button variant="secondary" onClick={() => handleStatusChange('Accepted')}>
                  <Check size={14} /> Accept Complaint
                </Button>
              )}

              {/* Start Investigation */}
              {['Accepted', 'Evidence Received'].includes(complaint.status) && (
                <Button onClick={() => handleStatusChange('Under Investigation')}>
                  <ShieldAlert size={14} /> Move to Under Investigation
                </Button>
              )}

              {/* Evidence Request */}
              {['Pending Review', 'Accepted', 'Under Investigation'].includes(complaint.status) && (
                <Button variant="secondary" onClick={() => setEvidenceModal(true)}>
                  <FileText size={14} /> Request Evidence from Complainant
                </Button>
              )}

              {/* Resolve */}
              {['Under Investigation', 'Evidence Received'].includes(complaint.status) && (
                <Button variant="secondary" onClick={() => handleStatusChange('Resolved')}>
                  <CheckCircle2 size={14} color="#4fd7c1" /> Resolve Case
                </Button>
              )}

              {/* Reject Modal Trigger */}
              {['Submitted', 'Pending Review'].includes(complaint.status) && (
                <Button
                  style={{ background: '#7f1d1d', color: '#fca5a5', borderColor: '#991b1b' }}
                  onClick={() => setRejectModal(true)}
                >
                  <XCircle size={14} /> Reject Complaint
                </Button>
              )}

              {/* Close */}
              {complaint.status === 'Resolved' && (
                <Button variant="secondary" onClick={() => handleStatusChange('Closed')}>
                  <Lock size={14} /> Close Case File
                </Button>
              )}
            </div>
          </div>
        </Card>
      )}

      {/* Main Grid: Left Column Dossier, Right Column Analytics & Notes */}
      <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 0.8fr', gap: 24 }}>
        {/* Left Column: Dossier Details & Evidence */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          {/* Incident Dossier Card */}
          <Card style={{ padding: 22 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
              <div>
                <span style={{ fontSize: 11, color: '#38bdf8', fontWeight: 700, letterSpacing: '1px' }}>PRIMARY INCIDENT DOSSIER</span>
                <h2 style={{ fontSize: 18, color: '#fff', margin: '4px 0 0' }}>{complaint.incidentType}</h2>
              </div>
              <div style={{ textAlign: 'right' }}>
                <span style={{ fontSize: 11, color: '#94a3b8' }}>Reported Loss</span>
                <div style={{ fontSize: 18, fontWeight: 700, color: '#f87171' }}>{money(complaint.reportedLoss || complaint.reportedAmount || 0)}</div>
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 14, background: '#091523', padding: 14, borderRadius: 6, border: '1px solid #14273b', marginBottom: 16 }}>
              <div>
                <span style={{ fontSize: 11, color: '#64748b' }}>Complainant</span>
                <div style={{ fontSize: 12.5, fontWeight: 600, color: '#fff' }}>{complaint.reporterName}</div>
                <div style={{ fontSize: 11, color: '#94a3b8' }}>{complaint.reporterEmail}</div>
              </div>
              <div>
                <span style={{ fontSize: 11, color: '#64748b' }}>Date of Incident</span>
                <div style={{ fontSize: 12.5, fontWeight: 600, color: '#cbd5e1' }}>{complaint.incidentDate || 'Unspecified'}</div>
              </div>
              <div>
                <span style={{ fontSize: 11, color: '#64748b' }}>Assigned Investigator</span>
                <div style={{ fontSize: 12.5, fontWeight: 600, color: '#38bdf8' }}>
                  {complaint.assignedOfficerName || 'Unassigned'}
                </div>
              </div>
            </div>

            <div style={{ marginBottom: 16 }}>
              <span style={{ fontSize: 11, color: '#94a3b8', fontWeight: 600, textTransform: 'uppercase' }}>Incident Narrative</span>
              <p style={{ fontSize: 13, color: '#e2e8f0', background: '#08121f', padding: '12px 14px', borderRadius: 6, border: '1px solid #122133', lineHeight: 1.5, margin: '6px 0 0' }}>
                {complaint.description}
              </p>
            </div>

            {/* Blockchain & Suspect Technical Indicators */}
            <div style={{ background: '#08121f', padding: 16, borderRadius: 6, border: '1px solid #14273b' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                <span style={{ fontSize: 11, color: '#38bdf8', fontWeight: 700, letterSpacing: '0.8px' }}>FORENSIC ON-CHAIN IDENTIFIERS</span>
                <Badge variant="secondary">{complaint.chain || complaint.blockchainNetwork || 'Bitcoin'}</Badge>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {/* Suspect Wallet & Balance */}
                <div style={{ padding: '10px 12px', background: '#0a1624', borderRadius: 6, border: '1px solid #172a3d' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                    <span style={{ color: '#94a3b8', fontSize: 11 }}>SUSPECT WALLET ADDRESS</span>
                    {complaint.reportedWallet && (
                      <Button
                        variant="secondary"
                        onClick={handleAddToWatchtower}
                        disabled={addingWatch}
                        style={{ padding: '2px 8px', fontSize: 10 }}
                      >
                        <Eye size={11} /> {addingWatch ? 'Adding…' : 'Add to Watchtower'}
                      </Button>
                    )}
                  </div>
                  <div style={{ fontFamily: 'monospace', color: '#cbd5e1', fontSize: 12, wordBreak: 'break-all' }}>
                    {complaint.reportedWallet || complaint.suspectWallet || 'None reported'}
                  </div>

                  {/* On-chain balance & labels if available */}
                  {onChainData && (
                    <div style={{ marginTop: 8, paddingTop: 8, borderTop: '1px solid #14273b', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 6 }}>
                      <div style={{ fontSize: 11, color: '#94a3b8' }}>
                        Live Balance: <strong style={{ color: '#4fd7c1', fontFamily: 'monospace' }}>{onChainData.balance?.formatted || '0'}</strong>
                        <small style={{ color: '#64748b', marginLeft: 4 }}>({onChainData.provider || 'RPC'})</small>
                      </div>
                      {onChainData.labels && onChainData.labels.length > 0 && (
                        <div style={{ display: 'flex', gap: 4 }}>
                          {onChainData.labels.map((lbl: any, idx: number) => (
                            <span key={idx} style={{ background: 'rgba(234, 179, 8, 0.15)', color: '#facc15', border: '1px solid #ca8a04', padding: '1px 6px', borderRadius: 4, fontSize: 10, fontWeight: 600 }}>
                              {lbl.label} ({lbl.entity})
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* Cross-Case Intelligence Syndicate Alert */}
                {onChainData && onChainData.crossCaseCount > 1 && (
                  <div style={{ padding: '10px 12px', background: 'rgba(239, 68, 68, 0.1)', border: '1px solid #ef4444', borderRadius: 6 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: '#fca5a5', fontSize: 11.5, fontWeight: 700 }}>
                      <AlertCircle size={14} color="#ef4444" />
                      CROSS-CASE INTELLIGENCE MATCH
                    </div>
                    <div style={{ fontSize: 11, color: '#cbd5e1', marginTop: 4 }}>
                      This suspect wallet appears in <strong>{onChainData.crossCaseCount}</strong> complaints in the registry:
                    </div>
                    <div style={{ display: 'flex', gap: 6, marginTop: 6, flexWrap: 'wrap' }}>
                      {(onChainData.relatedCases || []).map((rc: any) => (
                        <button
                          key={rc.id}
                          onClick={() => navigate(`/app/case-review/${rc.caseId || rc.id}`)}
                          style={{
                            background: '#1e293b', border: '1px solid #334155', color: '#38bdf8',
                            padding: '2px 8px', borderRadius: 4, fontSize: 10.5, cursor: 'pointer', fontFamily: 'monospace'
                          }}
                        >
                          {rc.caseId || rc.id} ({rc.status}) →
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* Transaction Hash & Live Blockchain RPC Verification */}
                <div style={{ padding: '10px 12px', background: '#0a1624', borderRadius: 6, border: '1px solid #172a3d' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                    <span style={{ color: '#94a3b8', fontSize: 11 }}>TRANSACTION HASH / REFERENCE</span>
                    {complaint.transactionHash && (
                      <Button
                        variant="secondary"
                        onClick={handleVerifyTxOnChain}
                        disabled={verifyingTx}
                        style={{ padding: '2px 8px', fontSize: 10 }}
                      >
                        <ShieldCheck size={11} color="#38bdf8" /> {verifyingTx ? 'Querying RPC…' : 'Verify On-Chain (RPC)'}
                      </Button>
                    )}
                  </div>
                  <div style={{ fontFamily: 'monospace', color: '#38bdf8', fontSize: 12, wordBreak: 'break-all' }}>
                    {complaint.transactionHash ? (
                      <span
                        onClick={() => navigate(`/app/graph/${complaint.transactionHash}`)}
                        style={{ cursor: 'pointer', textDecoration: 'underline' }}
                        title="Open in Graph Explorer"
                      >
                        {complaint.transactionHash} <ExternalLink size={11} style={{ display: 'inline' }} />
                      </span>
                    ) : 'None provided'}
                  </div>

                  {/* Verification result */}
                  {txVerification && (
                    <div style={{
                      marginTop: 8,
                      padding: '8px 10px',
                      borderRadius: 4,
                      fontSize: 11,
                      background: txVerification.verified ? 'rgba(16, 185, 129, 0.12)' : 'rgba(56, 189, 248, 0.1)',
                      border: `1px solid ${txVerification.verified ? '#10b981' : '#1e3a5f'}`,
                      color: txVerification.verified ? '#6ee7b7' : '#93c5fd'
                    }}>
                      <div style={{ fontWeight: 700, display: 'flex', alignItems: 'center', gap: 6 }}>
                        {txVerification.verified ? <CheckCircle2 size={13} color="#10b981" /> : <ShieldCheck size={13} color="#38bdf8" />}
                        On-Chain Status: {txVerification.status}
                      </div>
                      <div style={{ marginTop: 4, color: '#cbd5e1', fontSize: 10.5, lineHeight: 1.4 }}>
                        Provider: <strong>{txVerification.provider || 'RPC'}</strong>
                        {txVerification.blockHeight ? ` · Block #${txVerification.blockHeight}` : ''}
                        {txVerification.confirmations ? ` · ${txVerification.confirmations} Confirmations` : ''}
                        {txVerification.valueFormatted ? ` · Amount: ${txVerification.valueFormatted}` : ''}
                      </div>
                      {txVerification.from && (
                        <div style={{ fontSize: 10, color: '#94a3b8', marginTop: 2, fontFamily: 'monospace' }}>
                          From: {shortAddress(txVerification.from)} → To: {shortAddress(txVerification.to)}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Investigator Assignment Control */}
            <div style={{ marginTop: 18, borderTop: '1px solid #1a2d42', paddingTop: 14 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10 }}>
                <div style={{ fontSize: 12, color: '#94a3b8' }}>
                  <UserPlus size={14} style={{ display: 'inline', marginRight: 6, verticalAlign: 'middle' }} />
                  Reassign Investigator:
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                  <select
                    value={selectedOfficerId}
                    onChange={e => setSelectedOfficerId(e.target.value)}
                    style={{ background: '#0a1624', border: '1px solid #1a2d42', color: '#fff', padding: '6px 10px', borderRadius: 5, fontSize: 12 }}
                  >
                    <option value="">Select Investigator…</option>
                    {officers.map(o => (
                      <option key={o.id} value={o.id}>
                        {o.name} ({o.agency || 'CBI Cyber Cell'})
                      </option>
                    ))}
                  </select>
                  <Button variant="secondary" onClick={() => handleAssignOfficer(selectedOfficerId)} disabled={!selectedOfficerId}>
                    Assign
                  </Button>
                </div>
              </div>
            </div>
          </Card>

          {/* Submitted Evidence Review Card */}
          <Card style={{ padding: 22 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
              <div>
                <span style={{ fontSize: 11, color: '#38bdf8', fontWeight: 700, letterSpacing: '1px' }}>EVIDENCE CHAIN OF CUSTODY</span>
                <h3 style={{ fontSize: 15, color: '#fff', margin: '2px 0 0' }}>Submitted Evidence &amp; Artifacts</h3>
              </div>
              <Badge variant="info">{(complaint.evidence || []).length} items sealed</Badge>
            </div>

            {(!complaint.evidence || complaint.evidence.length === 0) ? (
              <p style={{ color: '#64748b', fontSize: 12, fontStyle: 'italic', margin: 0 }}>
                No physical or digital evidence attached to this case record yet.
              </p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {complaint.evidence.map((item: any) => (
                  <div key={item.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 14px', background: '#08121f', borderRadius: 6, border: '1px solid #14273b' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <File size={20} color="#38bdf8" />
                      <div>
                        <div style={{ fontSize: 12.5, fontWeight: 600, color: '#fff' }}>{item.fileName}</div>
                        <div style={{ fontSize: 11, color: '#64748b' }}>
                          {item.evidenceType} · {item.fileSize ? `${Math.round(item.fileSize / 1024)} KB` : 'Attached'} · Uploaded by {item.uploadedByName}
                        </div>
                        {item.description && <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 2 }}>{item.description}</div>}
                      </div>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <span style={{ fontSize: 10, fontFamily: 'monospace', color: '#4fd7c1', background: 'rgba(79, 215, 193, 0.1)', padding: '2px 6px', borderRadius: 4 }}>
                        SHA-256 SEALED
                      </span>
                      <div style={{ fontSize: 10.5, color: '#64748b', marginTop: 4 }}>{formatTime(item.createdAt)}</div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Card>
        </div>

        {/* Right Column: Analytics, Readiness Score & Internal Notes */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          {/* Cyber Trace Analytics Engine Card */}
          <Card style={{ padding: 22, border: analyticsResult ? '1px solid #087f94' : '1px solid #1a2d42' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
              <div>
                <span style={{ fontSize: 11, color: '#eab308', fontWeight: 700, letterSpacing: '1px' }}>DSA FORENSICS</span>
                <h3 style={{ fontSize: 15, color: '#fff', margin: '2px 0 0' }}>Cyber Trace Analytics</h3>
              </div>
              <Button variant="secondary" onClick={handleRunAnalytics} disabled={analyzing} style={{ padding: '4px 10px', fontSize: 11 }}>
                <Zap size={13} color="#eab308" /> {analyzing ? 'Computing…' : 'Run Analytics'}
              </Button>
            </div>

            {analyticsResult ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                {/* Risk Score Banner */}
                <div style={{ padding: '12px 14px', background: '#091523', borderRadius: 6, border: '1px solid #1a324a', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <span style={{ fontSize: 11, color: '#94a3b8' }}>Dynamic Event Risk Score</span>
                    <div style={{ fontSize: 22, fontWeight: 800, color: analyticsResult.riskScore >= 70 ? '#f87171' : analyticsResult.riskScore >= 40 ? '#fbbf24' : '#4fd7c1' }}>
                      {analyticsResult.riskScore} <small style={{ fontSize: 12, fontWeight: 500, color: '#94a3b8' }}>/ 100</small>
                    </div>
                  </div>
                  <div>
                    <RiskBadge score={analyticsResult.riskScore} />
                  </div>
                </div>

                {/* 6-Parameter Investigation Readiness Score */}
                {analyticsResult.readinessScore && (
                  <div style={{ background: '#08121f', padding: 12, borderRadius: 6, border: '1px solid #14273b' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                      <span style={{ fontSize: 11, fontWeight: 700, color: '#38bdf8' }}>INVESTIGATION READINESS CRITERIA</span>
                      <strong style={{ fontSize: 13, color: '#fff' }}>{analyticsResult.readinessScore.overall}%</strong>
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                      {Object.entries(analyticsResult.readinessScore.breakdown || {}).map(([param, val]: [string, any]) => (
                        <div key={param}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10.5, marginBottom: 2 }}>
                            <span style={{ color: '#94a3b8', textTransform: 'capitalize' }}>{param.replace(/([A-Z])/g, ' $1')}</span>
                            <span style={{ color: val >= 70 ? '#4fd7c1' : val >= 40 ? '#fbbf24' : '#f87171' }}>{val}%</span>
                          </div>
                          <div style={{ height: 4, background: '#122336', borderRadius: 2, overflow: 'hidden' }}>
                            <div style={{ width: `${val}%`, height: '100%', background: val >= 70 ? '#4fd7c1' : val >= 40 ? '#fbbf24' : '#f87171' }} />
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Risk Indicators */}
                {analyticsResult.indicators && analyticsResult.indicators.length > 0 && (
                  <div>
                    <span style={{ fontSize: 11, color: '#94a3b8', fontWeight: 600 }}>Detected Risk Indicators:</span>
                    <ul style={{ margin: '6px 0 0', paddingLeft: 18, fontSize: 11.5, color: '#cbd5e1', lineHeight: 1.5 }}>
                      {analyticsResult.indicators.map((ind: any, i: number) => (
                        <li key={i}>{ind.description || ind.name || ind}</li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* Quick Actions */}
                <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
                  <Button
                    variant="secondary"
                    style={{ flex: 1, fontSize: 11 }}
                    onClick={() => navigate(`/app/graph/${complaint.transactionHash || '232629023'}`)}
                  >
                    <Network size={12} /> Graph Explorer
                  </Button>
                  <Button
                    variant="secondary"
                    style={{ flex: 1, fontSize: 11 }}
                    onClick={() => navigate('/app/requests')}
                  >
                    <FileOutput size={12} /> Section 91 Package
                  </Button>
                </div>
              </div>
            ) : (
              <div style={{ textAlign: 'center', padding: '24px 12px', color: '#64748b' }}>
                <Zap size={28} color="#64748b" style={{ margin: '0 auto 8px' }} />
                <p style={{ fontSize: 12, margin: '0 0 10px' }}>
                  Click &ldquo;Run Cyber Trace Analytics&rdquo; to execute BFS graph traversal, risk scoring, and verify the 6 investigation readiness parameters for this complaint.
                </p>
                <Button onClick={handleRunAnalytics} disabled={analyzing} style={{ fontSize: 12 }}>
                  <Zap size={14} color="#eab308" /> Run Analytics Now
                </Button>
              </div>
            )}
          </Card>

          {/* Internal Investigation Notes (Confidential) */}
          <Card style={{ padding: 22, border: '1px solid #b45309', background: '#09111c' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <Lock size={16} color="#f59e0b" />
                <span style={{ fontSize: 12, fontWeight: 700, color: '#f59e0b', letterSpacing: '0.8px' }}>
                  CONFIDENTIAL OFFICER NOTES
                </span>
              </div>
              <Badge variant="warning">INTERNAL ONLY</Badge>
            </div>
            <p style={{ fontSize: 11, color: '#fcd34d', margin: '0 0 14px', background: 'rgba(245, 158, 11, 0.1)', padding: '6px 10px', borderRadius: 4 }}>
              Strictly restricted to CBI investigators. Internal notes and law enforcement queries are never exposed to complainants.
            </p>

            {/* Note submission */}
            <form onSubmit={handleAddInternalNote} style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 16 }}>
              <textarea
                rows={3}
                value={internalNoteText}
                onChange={e => setInternalNoteText(e.target.value)}
                placeholder="Record internal lead, sub-inspector note, subpoena status, or exchange query…"
                style={{ width: '100%', padding: '8px 12px', background: '#060c14', border: '1px solid #1a2d42', color: '#fff', borderRadius: 6, fontSize: 12 }}
              />
              <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                <Button type="submit" variant="secondary" disabled={!internalNoteText.trim()} style={{ fontSize: 11.5 }}>
                  <Lock size={12} /> Add Private Note
                </Button>
              </div>
            </form>

            {/* Existing notes list */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10, maxHeight: 260, overflowY: 'auto' }}>
              {(!complaint.updates || complaint.updates.length === 0) ? (
                <span style={{ fontSize: 11, color: '#64748b', fontStyle: 'italic' }}>No notes or timeline entries yet.</span>
              ) : (
                complaint.updates.map((u: any) => (
                  <div
                    key={u.id}
                    style={{
                      padding: '10px 12px',
                      background: u.isInternal ? '#111c2a' : '#0a1523',
                      borderLeft: u.isInternal ? '3px solid #f59e0b' : '3px solid #087f94',
                      borderRadius: 4,
                      fontSize: 11.5
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                      <strong style={{ color: u.isInternal ? '#f59e0b' : '#38bdf8' }}>
                        {u.authorName} {u.isInternal && '(Internal)'}
                      </strong>
                      <span style={{ color: '#64748b', fontSize: 10.5 }}>{formatTime(u.createdAt)}</span>
                    </div>
                    <p style={{ margin: 0, color: '#e2e8f0', lineHeight: 1.4 }}>{u.message}</p>
                    {u.newStatus && (
                      <div style={{ marginTop: 4, fontSize: 10, color: '#94a3b8' }}>
                        Status transition: <strong>{u.newStatus}</strong>
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>
          </Card>
        </div>
      </div>

      {/* Rejection Modal */}
      {rejectModal && (
        <div className="modal-backdrop" onClick={() => setRejectModal(false)}>
          <div className="command-modal" style={{ maxWidth: 480 }} onClick={e => e.stopPropagation()}>
            <div style={{ padding: 20 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
                <XCircle size={22} color="#ef4444" />
                <h3 style={{ margin: 0, fontSize: 16, color: '#fff' }}>Reject Cybercrime Complaint</h3>
              </div>
              <p style={{ fontSize: 12, color: '#94a3b8', marginBottom: 14 }}>
                A formal rejection reason is mandatory and will be recorded in the case ledger and notified to the complainant.
              </p>
              <textarea
                rows={4}
                required
                value={rejectionReason}
                onChange={e => setRejectionReason(e.target.value)}
                placeholder="State specific jurisdictional, evidentiary, or non-cognizable reasons for rejection..."
                style={{ width: '100%', padding: '10px 12px', background: '#0a1624', border: '1px solid #1a2d42', color: '#fff', borderRadius: 6, fontSize: 12, marginBottom: 14 }}
              />
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
                <Button variant="secondary" onClick={() => setRejectModal(false)}>Cancel</Button>
                <Button
                  style={{ background: '#dc2626', color: '#fff' }}
                  disabled={!rejectionReason.trim()}
                  onClick={() => handleStatusChange('Rejected', rejectionReason)}
                >
                  Confirm Rejection
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Request Evidence Modal */}
      {evidenceModal && (
        <div className="modal-backdrop" onClick={() => setEvidenceModal(false)}>
          <div className="command-modal" style={{ maxWidth: 500 }} onClick={e => e.stopPropagation()}>
            <div style={{ padding: 20 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
                <FileText size={22} color="#38bdf8" />
                <h3 style={{ margin: 0, fontSize: 16, color: '#fff' }}>Request Additional Evidence</h3>
              </div>
              <p style={{ fontSize: 12, color: '#94a3b8', marginBottom: 14 }}>
                Specify documents or proofs required from the complainant (e.g., bank statement, transaction receipt, Telegram chat logs). The case will transition to <strong>Evidence Requested</strong>.
              </p>
              <textarea
                rows={4}
                required
                value={evidenceInstructions}
                onChange={e => setEvidenceInstructions(e.target.value)}
                placeholder="E.g. Please upload bank transaction UTR confirmation and exported chat logs with the suspect broker..."
                style={{ width: '100%', padding: '10px 12px', background: '#0a1624', border: '1px solid #1a2d42', color: '#fff', borderRadius: 6, fontSize: 12, marginBottom: 14 }}
              />
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
                <Button variant="secondary" onClick={() => setEvidenceModal(false)}>Cancel</Button>
                <Button onClick={handleRequestEvidence} disabled={!evidenceInstructions.trim()}>
                  Send Request to Complainant
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// 4. Watchtower Address Monitoring & Live Alerts Page
export function WatchtowerPage() {
  const [watchlist, setWatchlist] = useState<any[]>([]);
  const [alerts, setAlerts] = useState<any[]>([]);
  const [health, setHealth] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [checking, setChecking] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);

  // Form state
  const [newChain, setNewChain] = useState('Bitcoin');
  const [newAddress, setNewAddress] = useState('');
  const [newCaseId, setNewCaseId] = useState('');
  const [newLabel, setNewLabel] = useState('');
  const [saving, setSaving] = useState(false);

  const loadData = () => {
    setLoading(true);
    Promise.all([
      api('/watchtower'),
      api('/watchtower/alerts'),
      api('/blockchain/health').catch(() => null)
    ]).then(([wl, al, h]) => {
      setWatchlist(wl || []);
      setAlerts(al || []);
      setHealth(h);
      setLoading(false);
    }).catch(e => {
      toast(e.message, 'error');
      setLoading(false);
    });
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleRunCheck = async () => {
    setChecking(true);
    try {
      const res = await api('/watchtower/check', { method: 'POST', body: '{}' });
      toast(`On-chain balance check complete. Scanned ${res.checked} addresses.`, 'success');
      loadData();
    } catch (e: any) {
      toast(e.message || 'Balance check failed', 'error');
    } finally {
      setChecking(false);
    }
  };

  const handleAddAddress = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newAddress.trim()) {
      toast('Please enter a wallet address', 'error');
      return;
    }
    setSaving(true);
    try {
      await api('/watchtower', {
        method: 'POST',
        body: JSON.stringify({
          chain: newChain,
          address: newAddress.trim(),
          caseId: newCaseId.trim() || undefined,
          label: newLabel.trim() || undefined
        })
      });
      toast('Address registered in Watchtower surveillance', 'success');
      setShowAddModal(false);
      setNewAddress('');
      setNewCaseId('');
      setNewLabel('');
      loadData();
    } catch (e: any) {
      toast(e.message || 'Failed to add address', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm('Remove this address from active Watchtower monitoring?')) return;
    try {
      await api(`/watchtower/${id}`, { method: 'DELETE' });
      toast('Address removed from Watchtower', 'info');
      loadData();
    } catch (e: any) {
      toast(e.message, 'error');
    }
  };

  if (loading) return <LoadingState />;

  return (
    <div style={{ padding: '24px 32px' }}>
      <PageHeader
        eyebrow="BLOCKCHAIN SURVEILLANCE & ALERTS"
        title="Watchtower Monitor"
        description="Continuous 24/7 surveillance of suspect cryptocurrency wallets across Bitcoin, Ethereum, and TRON networks."
        action={
          <div style={{ display: 'flex', gap: 10 }}>
            <Button variant="secondary" onClick={handleRunCheck} disabled={checking}>
              <RefreshCw size={14} className={checking ? 'spin' : ''} /> {checking ? 'Polling On-Chain Nodes…' : 'Check Live Balances (RPC)'}
            </Button>
            <Button onClick={() => setShowAddModal(true)}>
              <Eye size={15} /> Add Monitored Address
            </Button>
          </div>
        }
      />

      <OfficerDisclaimerBanner />

      {/* Provider Connectivity Health Strip */}
      {health && (
        <div style={{ display: 'flex', gap: 12, marginBottom: 20, flexWrap: 'wrap' }}>
          {Object.entries(health).map(([net, info]: [string, any]) => (
            <div key={net} style={{ background: '#0a1624', padding: '8px 14px', borderRadius: 6, border: '1px solid #1a2d42', display: 'flex', alignItems: 'center', gap: 8, fontSize: 11 }}>
              <span style={{ width: 8, height: 8, borderRadius: '50%', background: info.healthy ? '#10b981' : '#f59e0b' }} />
              <strong style={{ color: '#fff', textTransform: 'capitalize' }}>{net}:</strong>
              <span style={{ color: '#94a3b8' }}>{info.provider}</span>
            </div>
          ))}
        </div>
      )}

      {/* Metric Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 16, marginBottom: 24 }}>
        <MetricCard
          label="MONITORED TARGETS"
          value={watchlist.length}
          helper="Active suspect wallets in watch pool"
          icon={<Eye size={18} color="#38bdf8" />}
        />
        <MetricCard
          label="ALERTS TRIGGERED"
          value={alerts.length}
          helper="Balance shifts or movements recorded"
          icon={<Bell size={18} color="#f59e0b" />}
        />
        <MetricCard
          label="NETWORKS MONITORED"
          value="3"
          helper="Bitcoin, Ethereum, TRON Mainnets"
          icon={<Network size={18} color="#4fd7c1" />}
        />
      </div>

      {/* Main Grid: Watchlist on Left, Alerts on Right */}
      <div style={{ display: 'grid', gridTemplateColumns: '1.4fr 0.6fr', gap: 24 }}>
        {/* Watchlist Table */}
        <Card style={{ padding: 22 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <h3 style={{ margin: 0, fontSize: 16, color: '#fff' }}>Monitored Suspect Wallets</h3>
            <span style={{ fontSize: 12, color: '#94a3b8' }}>{watchlist.length} addresses</span>
          </div>

          {watchlist.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '36px 0', color: '#64748b' }}>
              <Eye size={36} color="#64748b" style={{ margin: '0 auto 12px' }} />
              <p style={{ margin: 0 }}>No addresses are currently under active Watchtower surveillance.</p>
              <Button variant="secondary" onClick={() => setShowAddModal(true)} style={{ marginTop: 12 }}>
                Add Target Address
              </Button>
            </div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid #1a2d42', color: '#64748b', textAlign: 'left' }}>
                    <th style={{ padding: '8px 10px' }}>TARGET ADDRESS</th>
                    <th style={{ padding: '8px 10px' }}>CHAIN</th>
                    <th style={{ padding: '8px 10px' }}>LABEL / CASE</th>
                    <th style={{ padding: '8px 10px' }}>LAST BALANCE</th>
                    <th style={{ padding: '8px 10px', textAlign: 'right' }}>ACTIONS</th>
                  </tr>
                </thead>
                <tbody>
                  {watchlist.map((w: any) => (
                    <tr key={w.id} style={{ borderBottom: '1px solid #0f1c2c' }}>
                      <td style={{ padding: '12px 10px', fontFamily: 'monospace', color: '#cbd5e1' }}>
                        <div>{shortAddress(w.address, 10)}</div>
                        <small style={{ color: '#64748b', fontSize: 10 }}>Added {formatTime(w.created_at)}</small>
                      </td>
                      <td style={{ padding: '12px 10px' }}>
                        <Badge variant="secondary">{w.chain}</Badge>
                      </td>
                      <td style={{ padding: '12px 10px' }}>
                        <div style={{ fontWeight: 600, color: '#fff' }}>{w.label || 'Unlabeled Suspect'}</div>
                        {w.case_id && (
                          <a
                            href={`/app/case-review/${w.case_id}`}
                            onClick={e => { e.preventDefault(); navigate(`/app/case-review/${w.case_id}`); }}
                            style={{ color: '#38bdf8', fontSize: 11, textDecoration: 'none' }}
                          >
                            Case {w.case_id} →
                          </a>
                        )}
                      </td>
                      <td style={{ padding: '12px 10px', fontFamily: 'monospace', color: '#4fd7c1', fontWeight: 600 }}>
                        {w.last_balance || '0.00'}
                      </td>
                      <td style={{ padding: '12px 10px', textAlign: 'right' }}>
                        <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
                          <Button
                            variant="secondary"
                            onClick={() => navigate(`/app/graph/${w.address}`)}
                            style={{ padding: '4px 8px', fontSize: 11 }}
                            title="Investigate in Graph"
                          >
                            <Network size={12} />
                          </Button>
                          <Button
                            variant="secondary"
                            onClick={() => handleDelete(w.id)}
                            style={{ padding: '4px 8px', fontSize: 11, color: '#f87171' }}
                            title="Remove from Watchlist"
                          >
                            <XCircle size={12} />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>

        {/* Watch Alerts Feed */}
        <Card style={{ padding: 22 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <h3 style={{ margin: 0, fontSize: 16, color: '#fff' }}>Surveillance Alerts</h3>
            <Badge variant="warning">{alerts.length} events</Badge>
          </div>

          {alerts.length === 0 ? (
            <p style={{ color: '#64748b', fontSize: 12, fontStyle: 'italic', margin: 0 }}>
              No on-chain movements or balance fluctuations detected on monitored targets yet.
            </p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10, maxHeight: 480, overflowY: 'auto' }}>
              {alerts.map((al: any) => (
                <div key={al.id} style={{ padding: '10px 12px', background: '#0a1624', borderRadius: 6, border: '1px solid #1a2d42', fontSize: 11.5 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                    <span style={{ color: '#f59e0b', fontWeight: 700 }}>{al.alert_type}</span>
                    <span style={{ color: '#64748b', fontSize: 10 }}>{formatTime(al.created_at)}</span>
                  </div>
                  <div style={{ color: '#e2e8f0', lineHeight: 1.4 }}>{al.message}</div>
                  <div style={{ marginTop: 4, fontFamily: 'monospace', color: '#94a3b8', fontSize: 10.5 }}>
                    Target: {shortAddress(al.address, 8)}
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>

      {/* Add Address Modal */}
      {showAddModal && (
        <div className="modal-backdrop" onClick={() => setShowAddModal(false)}>
          <div className="command-modal" style={{ maxWidth: 480 }} onClick={e => e.stopPropagation()}>
            <form onSubmit={handleAddAddress} style={{ padding: 22, display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                <Eye size={20} color="#38bdf8" />
                <h3 style={{ margin: 0, fontSize: 16, color: '#fff' }}>Add Wallet to Watchtower Surveillance</h3>
              </div>

              <Field label="Blockchain Network">
                <select
                  value={newChain}
                  onChange={e => setNewChain(e.target.value)}
                  style={{ width: '100%', padding: '8px 12px', background: '#0a1624', border: '1px solid #1a2d42', color: '#fff', borderRadius: 6 }}
                >
                  <option value="Bitcoin">Bitcoin (BTC)</option>
                  <option value="Ethereum">Ethereum (ETH)</option>
                  <option value="TRON">TRON (TRX/USDT)</option>
                  <option value="Polygon">Polygon (MATIC)</option>
                  <option value="BNB Chain">BNB Chain (BSC)</option>
                </select>
              </Field>

              <Field label="Wallet Address">
                <input
                  required
                  placeholder="0x... or 1... or T..."
                  value={newAddress}
                  onChange={e => setNewAddress(e.target.value)}
                  style={{ width: '100%', padding: '8px 12px', background: '#0a1624', border: '1px solid #1a2d42', color: '#fff', borderRadius: 6, fontFamily: 'monospace' }}
                />
              </Field>

              <Field label="Investigative Label / Description">
                <input
                  placeholder="e.g. Primary Syndicate Exit Wallet"
                  value={newLabel}
                  onChange={e => setNewLabel(e.target.value)}
                  style={{ width: '100%', padding: '8px 12px', background: '#0a1624', border: '1px solid #1a2d42', color: '#fff', borderRadius: 6 }}
                />
              </Field>

              <Field label="Associated Case ID (Optional)">
                <input
                  placeholder="e.g. CR-2026-00192"
                  value={newCaseId}
                  onChange={e => setNewCaseId(e.target.value)}
                  style={{ width: '100%', padding: '8px 12px', background: '#0a1624', border: '1px solid #1a2d42', color: '#fff', borderRadius: 6 }}
                />
              </Field>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 10 }}>
                <Button variant="secondary" type="button" onClick={() => setShowAddModal(false)}>Cancel</Button>
                <Button type="submit" disabled={saving}>
                  {saving ? 'Registering…' : 'Start Surveillance'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

