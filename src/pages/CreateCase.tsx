import { useState, type FormEvent } from 'react';
import { ArrowRight, Check, FileText, Fingerprint, ShieldCheck, Upload, X } from 'lucide-react';
import { api, navigate } from '../api';
import { Button, Card, PageHeader } from '../components/ui';
import '../operations.css';

const fraudTypes = ['Investment Scam', 'Task Scam', 'Phishing', 'Sextortion', 'Ransomware', 'Darknet', 'Financial Fraud', 'Other'];
const chains = ['Ethereum', 'Polygon', 'BNB Chain', 'Bitcoin', 'TRON'];
const stages = ['Normalize reported wallet', 'Trace deterministic transaction dataset', 'Compute behavioral fingerprint', 'Rank evidence-backed attribution', 'Correlate complaints and prepare workspace'];
const addressValid = (address: string, chain: string) => chain === 'Bitcoin'
  ? /^(bc1[a-z0-9]{25,62}|BC1[A-Z0-9]{25,62}|[13][a-km-zA-HJ-NP-Z1-9]{25,34})$/.test(address)
  : chain === 'TRON' ? /^T[1-9A-HJ-NP-Za-km-z]{33}$/.test(address) : /^0x[a-fA-F0-9]{40}$/.test(address);

export default function CreateCase() {
  const [form, setForm] = useState({ id: '', complaintId: '', fraudType: 'Investment Scam', victimLoss: '', currency: 'INR', reportedWallet: '', chain: 'Ethereum', transactionHash: '', priority: 'High', description: '' });
  const [attachments, setAttachments] = useState<{ name: string; size: number; type: string }[]>([]);
  const [busy, setBusy] = useState(false);
  const [stage, setStage] = useState(0);
  const [error, setError] = useState('');
  const change = (name: string, value: string) => setForm(f => ({ ...f, [name]: value }));
  async function submit(event: FormEvent) {
    event.preventDefault();
    setError('');
    if (!addressValid(form.reportedWallet.trim(), form.chain)) return setError(`Enter a valid ${form.chain} wallet address.`);
    if (!Number.isFinite(Number(form.victimLoss)) || Number(form.victimLoss) <= 0) return setError('Victim loss must be a positive amount in INR.');
    if (form.transactionHash && !/^(0x)?[a-fA-F0-9]{64}$/.test(form.transactionHash.trim())) return setError('Enter a 64-character transaction hash, optionally prefixed with 0x.');
    setBusy(true); setStage(0);
    let timer: ReturnType<typeof setInterval> | undefined;
    try {
      const created = await api<any>('/cases', { method: 'POST', body: JSON.stringify({ ...form, id: form.id.trim() || undefined, reportedWallet: form.reportedWallet.trim(), victimLoss: Number(form.victimLoss), transactionHash: form.transactionHash.trim(), attachments }) });
      timer = setInterval(() => setStage(s => Math.min(s + 1, 3)), 280);
      await api('/investigations', { method: 'POST', body: JSON.stringify({ caseId: created.id }) });
      clearInterval(timer); setStage(4);
      window.dispatchEvent(new CustomEvent('toast', { detail: { message: 'Investigation created. Simulated analysis is ready.', type: 'success' } }));
      navigate(`/app/investigations/${encodeURIComponent(created.id)}`);
    } catch (e) { setError(e instanceof Error ? e.message : 'Unable to start investigation. Please try again.'); }
    finally { if (timer) clearInterval(timer); setBusy(false); }
  }
  return <div className="op-page">
    <PageHeader title="Start an investigation" description="Turn a reported wallet into an evidence-backed investigative lead." />
    <div className="op-create-grid">
      <form onSubmit={submit} className="op-case-form">
        <Card className="op-form-card">
          <div className="op-section-title"><span className="op-number">01</span><div><h2>Complaint details</h2><p>Register the starting point of your investigation.</p></div></div>
          <div className="op-form-grid">
            <label>Case ID <span className="op-optional">Optional</span><input value={form.id} onChange={e => change('id', e.target.value)} placeholder="Generated automatically" maxLength={50}/></label>
            <label>Complaint ID <span className="op-optional">Optional</span><input value={form.complaintId} onChange={e => change('complaintId', e.target.value)} placeholder="e.g. CMP-2026-00418" maxLength={80}/></label>
            <label>Fraud type<select value={form.fraudType} onChange={e => change('fraudType', e.target.value)}>{fraudTypes.map(x => <option key={x}>{x}</option>)}</select></label>
            <label>Investigation priority<select value={form.priority} onChange={e => change('priority', e.target.value)}>{['Low', 'Medium', 'High', 'Critical'].map(x => <option key={x}>{x}</option>)}</select></label>
            <label>Reported victim loss<input required type="number" min="0.01" step="0.01" max="1000000000000" value={form.victimLoss} onChange={e => change('victimLoss', e.target.value)} placeholder="812450"/></label>
            <label>Currency<select value={form.currency} onChange={e => change('currency', e.target.value)}><option value="INR">INR — Indian Rupee</option></select></label>
          </div>
        </Card>
        <Card className="op-form-card">
          <div className="op-section-title"><span className="op-number">02</span><div><h2>Blockchain evidence</h2><p>Public wallet and transaction references only.</p></div></div>
          <div className="op-form-grid">
            <label>Blockchain<select value={form.chain} onChange={e => change('chain', e.target.value)}>{chains.map(x => <option key={x}>{x}</option>)}</select></label>
            <label>Reported wallet<input required className="op-mono" value={form.reportedWallet} onChange={e => change('reportedWallet', e.target.value)} placeholder={form.chain === 'TRON' ? 'T…' : form.chain === 'Bitcoin' ? 'bc1…' : '0x…'} maxLength={100} spellCheck={false}/></label>
            <label className="op-span-2">Transaction hash <span className="op-optional">Optional</span><input className="op-mono" value={form.transactionHash} onChange={e => change('transactionHash', e.target.value)} placeholder="Starting transaction reference" maxLength={66} spellCheck={false}/></label>
            <label className="op-span-2">Investigation description<textarea aria-label="Investigation description" value={form.description} onChange={e => change('description', e.target.value)} placeholder="Describe the reported incident and what you need to trace. Use fictional details in this public demo." rows={4} maxLength={5000}/></label>
          </div>
          <label className="op-file-label"><Upload size={18}/><span>Add attachment metadata<small>Names, sizes and file types only. File contents are not uploaded.</small></span><input type="file" multiple onChange={e => { setAttachments(a => [...a, ...Array.from(e.target.files || []).map(f => ({ name: f.name, size: f.size, type: f.type || 'application/octet-stream' }))].slice(0, 10)); e.target.value = ''; }}/></label>
          {attachments.length > 0 && <div className="op-attachments">{attachments.map((file, i) => <div key={`${file.name}-${i}`}><FileText size={15}/><span>{file.name}<small>{(file.size / 1024).toFixed(1)} KB · metadata only</small></span><button type="button" aria-label={`Remove ${file.name}`} onClick={() => setAttachments(a => a.filter((_, index) => index !== i))}><X size={15}/></button></div>)}</div>}
        </Card>
        {error && <div className="op-error" role="alert">{error}</div>}
        {busy && <Card className="op-analysis-progress"><div className="op-eyebrow">DEMO ANALYSIS · DETERMINISTIC DATASET</div>{stages.map((text, index) => <div key={text} className={index <= stage ? 'is-complete' : ''}><span>{index < stage ? <Check size={13}/> : index + 1}</span>{text}</div>)}</Card>}
        <div className="op-form-actions"><p>Results are investigative leads and require human verification.</p><Button type="submit" disabled={busy}>{busy ? 'Analyzing evidence…' : 'Start trace'}<ArrowRight size={16}/></Button></div>
      </form>
      <aside className="op-create-aside">
        <Card><div className="op-icon-tile"><Fingerprint size={25}/></div><h2>One wallet. A clearer picture.</h2><p>Your investigation brings together fund tracing, behavioral analysis, VASP attribution and related complaints.</p><ol className="op-vertical-steps">{['Normalize wallet', 'Trace transaction network', 'Identify cross-chain movement', 'Correlate related cases', 'Rank actionable exits'].map((x, i) => <li key={x}><span>{i + 1}</span>{x}</li>)}</ol></Card>
        <div className="op-info-box"><ShieldCheck size={21}/><div><strong>Simulated investigation data</strong><p>This environment uses deterministic fictional transactions and VASP names. Entering an address does not query a live blockchain or imply criminal activity.</p></div></div>
        <button type="button" className="op-demo-fill" onClick={() => setForm(f => ({ ...f, fraudType: 'Investment Scam', victimLoss: '812450', reportedWallet: '0x' + 'a1'.repeat(20), chain: 'Ethereum', description: 'Synthetic investment scam complaint for an end-to-end demonstration.' }))}>Fill a fictional example<ArrowRight size={16}/></button>
      </aside>
    </div>
  </div>;
}
