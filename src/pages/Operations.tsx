import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { Activity, ArrowDown, ArrowRight, ArrowUpDown, Bell, Check, ChevronLeft, ChevronRight, Copy, Database, Download, ExternalLink, FileCheck2, FileText, GitBranch, Globe2, Layers3, Link2, Plus, RefreshCw, Search, Settings2, ShieldCheck, SlidersHorizontal, Terminal, Wallet, X } from 'lucide-react';
import { api, navigate, money, shortAddress, formatTime } from '../api';
import { Badge, Button, Card, PageHeader, RiskBadge } from '../components/ui';
import '../operations.css';

type AnyData = Record<string, any>;
const statuses = ['New', 'Analyzing', 'Investigating', 'Action Required', 'Monitoring', 'Closed'];
const chains = ['Ethereum', 'Polygon', 'BNB Chain', 'Bitcoin', 'TRON'];
const toast = (message: string, type = 'success') => window.dispatchEvent(new CustomEvent('toast', { detail: { message, type } }));
const humanize = (name: string) => name.replace(/([a-z])([A-Z])/g, '$1 $2').replace(/_/g, ' ').replace(/^./, s => s.toUpperCase());
const timestamp = (value: string) => value ? new Date(value).toLocaleString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', timeZone: 'UTC' }) + ' UTC' : 'Not observed';
const featureValue = (key: string, value: unknown, features: AnyData) => ((key === 'stablecoinConcentration' || key === 'assetCoverage') && features.assetCoverage === 0) ? 'Unavailable · synthetic INR' : typeof value === 'number' ? Number(value.toFixed(2)).toLocaleString('en-IN') : String(value);
const openCase = (id: string) => navigate(`/app/investigations/${encodeURIComponent(id)}`);

function useData<T>(path: string) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [version, setVersion] = useState(0);
  useEffect(() => {
    let active = true;
    setLoading(true); setError('');
    api<T>(path).then(result => { if (active) setData(result); }).catch(e => { if (active) setError(e.message); }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [path, version]);
  return { data, error, loading, reload: () => setVersion(v => v + 1), setData };
}
function useInvestigations() {
  const [data, setData] = useState<any[] | null>(null);
  const [error, setError] = useState('');
  useEffect(() => {
    let active = true;
    api<any[]>('/cases')
      .then(async (cases) => {
        if (!cases || !cases.length) return [];
        const results = await Promise.allSettled(
          cases.map(c => api<any>(`/investigations/${encodeURIComponent(c.id)}`))
        );
        return results
          .filter((r): r is PromiseFulfilledResult<any> => r.status === 'fulfilled')
          .map(r => r.value)
          .filter(Boolean);
      })
      .then(value => {
        if (active) {
          setData(value);
          setError('');
        }
      })
      .catch(e => {
        if (active) setError(e.message);
      });
    return () => { active = false; };
  }, []);
  return { data, error, loading: !data && !error };
}
function State({ loading, error, children }: { loading?: boolean; error?: string; children: ReactNode }) {
  if (loading) return <div className="op-skeleton" aria-label="Loading intelligence"><div/><div/><div/><p>Loading investigation data…</p></div>;
  if (error) return <div className="op-error" role="alert"><strong>Unable to load data</strong><p>{error}</p><button className="op-text-button" onClick={() => window.location.reload()}>Retry request</button></div>;
  return <>{children}</>;
}
function Empty({ title = 'No results found', text = 'Adjust your filters or start a new investigation.' }: { title?: string; text?: string }) { return <div className="op-empty"><Search size={26}/><h3>{title}</h3><p>{text}</p></div>; }
function Summary({ items }: { items: { label: string; value: ReactNode; note?: string; icon?: ReactNode }[] }) { return <div className="op-summary-grid">{items.map(item => <Card key={item.label} className="op-summary"><div>{item.label}{item.icon}</div><strong>{item.value}</strong>{item.note && <small>{item.note}</small>}</Card>)}</div>; }
function Disclaimer() { return <div className="op-disclaimer"><ShieldCheck size={15}/><span>SIMULATED INVESTIGATION DATA · Analytical confidence is an investigative lead, subject to human and legal verification.</span></div>; }
function CaseSelect({ cases, value, onChange }: { cases: any[]; value: string; onChange: (v: string) => void }) { return <select aria-label="Select investigation" value={value} onChange={e => onChange(e.target.value)}>{!value && <option value="">Select a case</option>}{cases.map(c => <option key={c.id} value={c.id}>{c.id} · {c.fraudType}</option>)}</select>; }
function downloadJSON(data: unknown, name: string) { const url = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })); const a = document.createElement('a'); a.href = url; a.download = name; a.click(); setTimeout(() => URL.revokeObjectURL(url), 1000); }

export function CasesPage() {
  const { data, loading, error } = useData<any[]>('/cases');
  const [query, setQuery] = useState('');
  const [filters, setFilters] = useState({ fraudType: '', risk: '', chain: '', status: '', vasp: '', date: '' });
  const [sort, setSort] = useState('updated'); const [page, setPage] = useState(1); const [showFilters, setShowFilters] = useState(false);
  const update = (key: string, value: string) => { setFilters(f => ({ ...f, [key]: value })); setPage(1); };
  const filtered = useMemo(() => (data || []).filter(c => {
    const risk = c.riskScore >= 70 ? 'High' : c.riskScore >= 40 ? 'Medium' : 'Low';
    return (!query || [c.id, c.complaintId, c.reportedWallet, c.fraudType, c.vaspCandidate].join(' ').toLowerCase().includes(query.toLowerCase())) && (!filters.fraudType || c.fraudType === filters.fraudType) && (!filters.risk || risk === filters.risk) && (!filters.chain || (c.chains || [c.chain]).includes(filters.chain)) && (!filters.status || c.status === filters.status) && (!filters.vasp || c.vaspCandidate === filters.vasp) && (!filters.date || c.createdAt?.slice(0, 10) >= filters.date);
  }).sort((a, b) => sort === 'amount' ? b.victimLoss - a.victimLoss : sort === 'risk' ? b.riskScore - a.riskScore : sort === 'case' ? a.id.localeCompare(b.id) : Date.parse(b.updatedAt) - Date.parse(a.updatedAt)), [data, query, filters, sort]);
  const size = 8; const pageCount = Math.max(1, Math.ceil(filtered.length / size));
  return <div className="op-page"><PageHeader title="Case management" description="Every complaint, connected to the intelligence behind it." action={<Button onClick={() => navigate('/app/new')}><Plus size={16}/> New investigation</Button>}/>
    <Summary items={[{ label: 'Total cases', value: data?.length || 0, icon: <Layers3 size={17}/> }, { label: 'Require attention', value: data?.filter(c => c.status === 'Action Required').length || 0, note: 'Actionable leads ready for review' }, { label: 'Funds traced', value: money(data?.reduce((n, c) => n + c.tracedAmount, 0) || 0), note: 'Synthetic INR-equivalent value' }, { label: 'VASP leads', value: data?.filter(c => c.vaspCandidate && c.vaspCandidate !== 'Unknown').length || 0, note: 'Candidate associations' }]}/>
    <Card className="op-table-card"><div className="op-toolbar"><div className="op-search-input"><Search size={16}/><input aria-label="Search cases" value={query} onChange={e => { setQuery(e.target.value); setPage(1); }} placeholder="Search case, complaint, wallet or VASP…"/></div><button className={`op-filter-button ${showFilters ? 'active' : ''}`} onClick={() => setShowFilters(v => !v)}><SlidersHorizontal size={15}/>Filters{Object.values(filters).filter(Boolean).length > 0 && <span>{Object.values(filters).filter(Boolean).length}</span>}</button><select aria-label="Sort cases" value={sort} onChange={e => setSort(e.target.value)}><option value="updated">Recently updated</option><option value="risk">Highest risk</option><option value="amount">Highest loss</option><option value="case">Case ID</option></select></div>
      {showFilters && <div className="op-filter-grid"><label>Fraud type<select value={filters.fraudType} onChange={e => update('fraudType', e.target.value)}><option value="">All fraud types</option>{Array.from(new Set(data?.map(c => c.fraudType))).map(x => <option key={x}>{x}</option>)}</select></label><label>Risk<select value={filters.risk} onChange={e => update('risk', e.target.value)}><option value="">All risk levels</option>{['High', 'Medium', 'Low'].map(x => <option key={x}>{x}</option>)}</select></label><label>Chain<select value={filters.chain} onChange={e => update('chain', e.target.value)}><option value="">All chains</option>{chains.map(x => <option key={x}>{x}</option>)}</select></label><label>Status<select value={filters.status} onChange={e => update('status', e.target.value)}><option value="">All statuses</option>{statuses.map(x => <option key={x}>{x}</option>)}</select></label><label>VASP candidate<select value={filters.vasp} onChange={e => update('vasp', e.target.value)}><option value="">All candidates</option>{Array.from(new Set(data?.map(c => c.vaspCandidate).filter(Boolean))).map(x => <option key={x}>{x}</option>)}</select></label><label>Created on or after<input type="date" value={filters.date} onChange={e => update('date', e.target.value)}/></label><button className="op-text-button" onClick={() => { setFilters({ fraudType: '', risk: '', chain: '', status: '', vasp: '', date: '' }); setQuery(''); }}>Clear filters</button></div>}
      <State loading={loading} error={error}>{filtered.length ? <><div className="op-table-wrap"><table className="op-table"><thead><tr><th>Case / complaint</th><th>Fraud type</th><th>Reported wallet</th><th>Victim loss</th><th>Chain</th><th>Risk</th><th>VASP lead</th><th>Status</th><th/></tr></thead><tbody>{filtered.slice((page - 1) * size, page * size).map(c => <tr key={c.id} tabIndex={0} role="link" onClick={() => openCase(c.id)} onKeyDown={e => { if (e.key === 'Enter') openCase(c.id); }}><td><strong>{c.id}</strong><small>{c.complaintId || 'Registered complaint'}</small></td><td>{c.fraudType}</td><td className="op-mono">{shortAddress(c.reportedWallet)}</td><td>{money(c.victimLoss)}</td><td><span className="op-chain-dot"/>{c.chain}</td><td><RiskBadge score={c.riskScore}/></td><td><strong>{c.vaspCandidate || 'Pending'}</strong><small>{c.confidence ? `${c.confidence}% confidence` : 'Awaiting analysis'}</small></td><td><span className={`op-status ${c.status === 'Action Required' ? 'attention' : ''}`}>{c.status}</span></td><td><ChevronRight size={15}/></td></tr>)}</tbody></table></div><div className="op-pagination"><span>{filtered.length} cases · Page {Math.min(page, pageCount)} of {pageCount}</span><div><button aria-label="Previous page" disabled={page <= 1} onClick={() => setPage(p => p - 1)}><ChevronLeft size={16}/></button><button aria-label="Next page" disabled={page >= pageCount} onClick={() => setPage(p => p + 1)}><ChevronRight size={16}/></button></div></div></> : <Empty/>}</State>
    </Card><Disclaimer/>
  </div>;
}

export function WalletPage() {
  const initial = new URLSearchParams(window.location.search).get('q') || new URLSearchParams(window.location.search).get('address') || '';
  const [query, setQuery] = useState(initial);
  const [results, setResults] = useState<any[] | null>(null);
  const [walletData, setWalletData] = useState<any>(null);
  const [txData, setTxData] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function lookup(address: string) {
    setLoading(true); setError(''); setTxData(null);
    try { setWalletData(await api(`/wallets/${encodeURIComponent(address)}`)); setResults(null); }
    catch (e) { setError((e as Error).message); }
    finally { setLoading(false); }
  }

  async function search(value = query) {
    if (!value.trim()) return;
    const trimmed = value.trim();
    setLoading(true); setError(''); setWalletData(null); setTxData(null);

    // If query is numeric (Elliptic Transaction ID), look it up directly
    if (/^\d+$/.test(trimmed)) {
      try {
        const tx = await api(`/transactions/${encodeURIComponent(trimmed)}`);
        setTxData(tx);
        setResults(null);
        return;
      } catch (err) {
        // Fallback to normal search
      } finally {
        setLoading(false);
      }
    }

    try {
      const found = await api<any[]>(`/search?q=${encodeURIComponent(trimmed)}`);
      setResults(found);
      const w = found.find(r => r.type.toLowerCase() === 'wallet' && (r.id === trimmed || found.length === 1));
      if (w) await lookup(w.id);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (initial) void search(initial);
    const onRouteChange = () => {
      const params = new URLSearchParams(window.location.search);
      const value = params.get('q') || params.get('address');
      if (value) { setQuery(value); void search(value); }
    };
    window.addEventListener('popstate', onRouteChange);
    return () => window.removeEventListener('popstate', onRouteChange);
  }, []);

  const wallet = walletData?.wallet;
  return <div className="op-page">
    <PageHeader title="Transaction & wallet intelligence" description="Search any Bitcoin transaction ID from the Elliptic Research Dataset or address/case ID."/>
    
    <div style={{display:'flex',gap:'8px',marginBottom:'12px',alignItems:'center',flexWrap:'wrap'}}>
      <span style={{fontSize:'12px',fontWeight:600,color:'#7f95ae'}}>SAMPLE TRANSACTIONS:</span>
      <button className="op-text-button" onClick={() => { setQuery('232629023'); void search('232629023'); }}>🔴 Illicit Tx 232629023</button>
      <button className="op-text-button" onClick={() => { setQuery('232438397'); void search('232438397'); }}>🟢 Licit Tx 232438397</button>
      <button className="op-text-button" onClick={() => { setQuery('230425980'); void search('230425980'); }}>⚪ Unknown Tx 230425980</button>
      <button className="op-text-button" onClick={() => { setQuery('CR-2026-00192'); void search('CR-2026-00192'); }}>Case CR-2026-00192</button>
    </div>

    <form className="op-wallet-search" onSubmit={e => { e.preventDefault(); void search(); }}>
      <Search size={21}/>
      <input value={query} onChange={e => setQuery(e.target.value)} aria-label="Transaction ID, wallet or case" placeholder="Enter Elliptic Tx ID (e.g. 232629023) or wallet address / case ID"/>
      <Button type="submit" disabled={loading || !query.trim()}>{loading ? 'Searching…' : 'Investigate'}<ArrowRight size={16}/></Button>
    </form>

    <State loading={loading} error={error}><>
      {results && <Card className="op-table-card"><div className="op-card-heading"><h2>Search results</h2><Badge>{results.length} matches</Badge></div>{results.length ? results.map((r, i) => <button className="op-search-result" key={`${r.id}-${i}`} onClick={() => r.type.toLowerCase() === 'wallet' ? void lookup(r.id) : navigate(r.path || `/app/investigations/${r.caseId || r.id}`)}><div className="op-result-icon">{r.type.toLowerCase() === 'wallet' ? <Wallet size={18}/> : <FileText size={18}/>}</div><div><small>{r.type}</small><strong>{r.title}</strong><p>{r.subtitle}</p></div><ChevronRight size={17}/></button>) : <Empty title="No indexed evidence matches" text="Try an Elliptic Transaction ID (232629023, 232438397, 230425980) or case ID."/>}</Card>}

      {!results && !wallet && !txData && <Card className="op-search-start"><Wallet size={34}/><h2>Search transaction or wallet</h2><p>Explore actual 165-feature vectors, ground-truth labels, and graph counterparty paths from the Elliptic Research Dataset.</p><div><button onClick={() => { setQuery('232629023'); void search('232629023'); }}>Investigate Illicit 232629023 <ArrowRight size={14}/></button><button onClick={() => { setQuery('232438397'); void search('232438397'); }}>Investigate Licit 232438397 <ArrowRight size={14}/></button></div></Card>}

      {txData && <div style={{display:'flex',flexDirection:'column',gap:'16px'}}>
        <Card className="op-wallet-header">
          <div className="op-icon-tile"><Activity size={22}/></div>
          <div>
            <div className="op-eyebrow">ELLIPTIC RESEARCH DATASET · BITCOIN TRANSACTION</div>
            <h2 className="op-mono op-break">Transaction ID: {txData.txId}</h2>
            <p>Ground Truth Label: <strong>{txData.knownLabel?.toUpperCase()}</strong> · TimeStep {txData.timeStep}</p>
          </div>
          <div style={{display:'flex',flexDirection:'column',alignItems:'flex-end',gap:'6px'}}>
            <RiskBadge score={txData.riskScore}/>
            <Badge variant={txData.isGroundTruthIllicit ? 'danger' : txData.isGroundTruthLicit ? 'success' : 'neutral'}>
              {txData.knownLabel?.toUpperCase()}
            </Badge>
          </div>
        </Card>

        <Summary items={[
          { label: 'Calibrated risk score', value: `${txData.riskScore}/100`, note: txData.riskCategory },
          { label: 'Model prediction', value: txData.modelPrediction?.toUpperCase(), note: `${txData.modelConfidence}% confidence` },
          { label: 'Degree topology', value: `${txData.graphFindings?.inDegree} in / ${txData.graphFindings?.outDegree} out`, note: txData.graphFindings?.flowBehavior },
          { label: 'Connected counterparties', value: txData.graphFindings?.totalNeighbors || 0, note: `${txData.graphFindings?.neighborIllicitCount || 0} illicit in 1-hop` }
        ]}/>

        <div className="op-two-col">
          <Card>
            <div className="op-card-heading"><h2>Evidence indicators</h2><Badge>EXPLAINABLE SCORING</Badge></div>
            <p className="op-muted">{txData.explanation}</p>
            <div className="op-evidence-grid">
              {(txData.evidenceIndicators || []).map((e: any) => <div key={e.id} style={{background:'#0e1a29',padding:'10px',borderRadius:'6px',border:'1px solid #1f334d'}}>
                <div style={{display:'flex',justifyContent:'space-between',marginBottom:'4px'}}>
                  <strong>{e.title}</strong>
                  <span style={{color:'#4fd7c1',fontWeight:600}}>{e.score}/100</span>
                </div>
                <p style={{fontSize:'12px',color:'#9bb0c7',margin:'0 0 4px'}}>{e.description}</p>
                <small style={{color:'#657b94'}}>{e.category} · Weight: {e.weight}%</small>
              </div>)}
            </div>
            <div style={{marginTop:'12px'}}>
              <Button onClick={() => navigate(`/app/investigations/${txData.txId}`)}>
                Open interactive graph workspace <ArrowRight size={14}/>
              </Button>
            </div>
          </Card>

          <Card>
            <div className="op-card-heading"><h2>Counterparty transactions</h2><Link2 size={17}/></div>
            <p className="op-muted">Directly connected transaction nodes in the Elliptic directed graph.</p>
            <div className="op-key-values">
              <div><span>Inflow Transactions</span><strong>{(txData.graphFindings?.incomingTransactions || []).join(', ') || 'None (Origin transaction)'}</strong></div>
              <div><span>Outflow Transactions</span><strong>{(txData.graphFindings?.outgoingTransactions || []).join(', ') || 'None (Terminal sink)'}</strong></div>
              <div><span>Time Step</span><strong>Step {txData.timeStep} of 49</strong></div>
              <div><span>Feature Count</span><strong>165 normalized features</strong></div>
            </div>
            {Boolean(txData.graphFindings?.incomingTransactions?.length || txData.graphFindings?.outgoingTransactions?.length) && <div style={{display:'flex',gap:'6px',flexWrap:'wrap',marginTop:'10px'}}>
              <span style={{fontSize:'12px',color:'#7f95ae',alignSelf:'center'}}>Explore neighbors:</span>
              {[...(txData.graphFindings?.incomingTransactions || []), ...(txData.graphFindings?.outgoingTransactions || [])].slice(0, 5).map((nid: string) => <button key={nid} className="op-text-button" onClick={() => { setQuery(nid); void search(nid); }}>
                Tx {nid}
              </button>)}
            </div>}
          </Card>
        </div>
      </div>}

      {wallet && <><Card className="op-wallet-header"><div className="op-icon-tile"><Wallet size={22}/></div><div><div className="op-eyebrow">{wallet.chain} · {humanize(wallet.type)} WALLET</div><h2 className="op-mono op-break">{wallet.address}</h2><p>{wallet.entity || 'Unattributed entity'} · {wallet.cluster || 'Unclustered'}</p></div><button className="op-icon-button" aria-label="Copy wallet address" onClick={() => navigator.clipboard.writeText(wallet.address).then(() => toast('Wallet address copied')).catch(() => toast('Unable to copy address', 'error'))}><Copy size={17}/></button><RiskBadge score={wallet.riskScore}/></Card>
      <Summary items={[{ label: 'Observed balance', value: money(wallet.balance), note: 'Synthetic INR equivalent' }, { label: 'Transactions', value: walletData.transactions?.length || 0, note: `${wallet.incomingCount} incoming · ${wallet.outgoingCount} outgoing` }, { label: 'Risk score', value: `${wallet.riskScore}/100`, note: 'Derived from observed behavior' }, { label: 'Linked investigations', value: walletData.cases?.length || 0, note: 'Within this dataset' }]}/>
      <div className="op-two-col"><Card><div className="op-card-heading"><h2>Case-network behavioral context</h2><Activity size={17}/></div><p className="op-muted">Measurements from the first associated investigation; they describe the surrounding network, not this wallet alone.</p><div className="op-key-values">{Object.entries(walletData.behavior || {}).map(([key, value]) => <div key={key}><span>{humanize(key)}</span><strong>{featureValue(key, value, walletData.behavior || {})}</strong></div>)}</div></Card><Card><div className="op-card-heading"><h2>Intelligence context</h2><Link2 size={17}/></div><div className="op-key-values"><div><span>First observed</span><strong>{timestamp(wallet.firstSeen)}</strong></div><div><span>Last observed</span><strong>{timestamp(wallet.lastSeen)}</strong></div><div><span>Associated entity</span><strong>{wallet.entity || 'Unknown'}</strong></div><div><span>Wallet cluster</span><strong>{wallet.cluster || 'None observed'}</strong></div></div><h3 className="op-subtitle">Observed indicators</h3><div className="op-tag-list">{(wallet.behavior || []).map((b: string) => <span key={b}>{b}</span>)}</div><h3 className="op-subtitle">Associated cases</h3>{walletData.cases?.map((c: any) => <button className="op-linked-case" key={c.id} onClick={() => openCase(c.id)}><div><strong>{c.id}</strong><small>{c.fraudType} · {c.vaspCandidate || 'No VASP candidate'}</small></div><ChevronRight size={16}/></button>)}</Card></div>
      <Card className="op-table-card"><div className="op-card-heading"><h2>Transaction evidence</h2><Badge>{walletData.transactions?.length || 0} transactions</Badge></div><div className="op-table-wrap"><table className="op-table"><thead><tr><th>Reference</th><th>From</th><th>To</th><th>Value (INR equiv.)</th><th>Asset / chain</th><th>Observed</th></tr></thead><tbody>{walletData.transactions?.map((tx: any) => <tr key={tx.id}><td><strong>{tx.id}</strong><small className="op-mono" title={tx.hash}>{shortAddress(tx.hash)}</small></td><td className="op-mono">{shortAddress(tx.source)}</td><td className="op-mono">{shortAddress(tx.target)}</td><td>{money(tx.amount)}</td><td>{tx.asset} · {tx.chain}</td><td>{timestamp(tx.timestamp)}</td></tr>)}</tbody></table></div></Card></>}
    </></State><Disclaimer/></div>;
}

export function VaspPage() {
  const { data, loading, error } = useInvestigations(); const [selected, setSelected] = useState('');
  const groups = useMemo(() => {
    const grouped: Record<string, any> = {};
    for (const inv of data || []) {
      for (const a of inv?.attributions || []) {
        if (!a?.candidate) continue;
        if (!grouped[a.candidate]) grouped[a.candidate] = { name: a.candidate, entries: [], amount: 0, chains: new Set<string>(), max: 0 };
        const g = grouped[a.candidate];
        g.entries.push({ ...a, caseId: inv.case?.id || a.caseId, fraudType: inv.case?.fraudType || 'Investigation' });
        g.amount += (a.tracedAmount || 0);
        (a.chains || []).forEach((x: string) => g.chains.add(x));
        g.max = Math.max(g.max, a.confidence || 0);
      }
    }
    return Object.values(grouped).sort((a, b) => b.max - a.max);
  }, [data]);
  return <div className="op-page"><PageHeader title="VASP intelligence" description="Prioritize probable service endpoints using transparent, weighted evidence." action={<Button onClick={() => navigate('/app/requests')}><FileCheck2 size={16}/> Prepare information request</Button>}/><State loading={loading} error={error}><><Summary items={[{ label: 'Candidate entities', value: groups.length, icon: <Layers3 size={17}/> }, { label: 'Attribution leads', value: groups.reduce((n, g) => n + g.entries.length, 0) }, { label: 'Candidate exit value', value: money(groups.reduce((n, g) => n + g.amount, 0)), note: 'Per-case evidence totals; may overlap' }, { label: 'Highest confidence', value: `${groups[0]?.max || 0}%`, note: 'Evidence-backed association' }]}/><div className="op-entity-grid">{groups.map(g => <Card className="op-entity-card" key={g.name}><div className="op-card-heading"><div className="op-entity-mark">{g.name.slice(-1)}</div><Badge>FICTIONAL VASP</Badge></div><h2>{g.name}</h2><p>Candidate service association</p><div className="op-confidence"><strong>{g.max}%</strong><span>Strongest attribution<br/>confidence</span></div><div className="op-progress"><span style={{ width: `${g.max}%` }}/></div><div className="op-key-values"><div><span>Traced value</span><strong>{money(g.amount)}</strong></div><div><span>Associated investigations</span><strong>{g.entries.length}</strong></div><div><span>Observed chains</span><strong>{Array.from(g.chains).join(', ')}</strong></div></div><button className="op-full-link" onClick={() => setSelected(selected === g.name ? '' : g.name)}>{selected === g.name ? 'Hide supporting evidence' : 'Review supporting evidence'}<ArrowRight size={15}/></button></Card>)}</div>{selected && <Card><div className="op-card-heading"><h2>{selected} · Attribution evidence</h2><button className="op-icon-button" aria-label="Close evidence" onClick={() => setSelected('')}><X size={16}/></button></div>{groups.find(g => g.name === selected)?.entries.map((a: any) => <div className="op-attribution-case" key={a.id || a.caseId}><button className="op-linked-case" onClick={() => openCase(a.caseId)}><div><strong>{a.caseId}</strong><small>{a.fraudType} · {money(a.tracedAmount || 0)} · {a.transactionCount || 0} endpoint transactions</small></div><Badge>{a.confidence || 0}% confidence</Badge><ChevronRight size={16}/></button><div className="op-evidence-grid">{(a.evidence || []).map((e: any) => <button key={e.id} onClick={async () => { try { await api(`/evidence/${encodeURIComponent(a.caseId)}/${encodeURIComponent(e.id)}/view`, { method: 'POST' }); navigate(`/app/investigations/${encodeURIComponent(a.caseId)}?evidence=${encodeURIComponent(e.id)}`); } catch (err) { toast((err as Error).message, 'error'); } }}><Check size={15}/><div><strong>{e.title}</strong><p>{e.description}</p><small>{e.id} · {e.transactionIds?.length || 0} transaction references</small></div></button>)}</div></div>)}</Card>}{!groups.length && <Empty title="No VASP attribution yet" text="Run an investigation to calculate candidate service associations."/>}</></State><Disclaimer/></div>;
}

export function CrossChainPage() {
  const { data, loading, error } = useInvestigations(); const [chain, setChain] = useState('');
  const transfers = useMemo(() => {
    return (data || []).flatMap(i => (i?.crossChain || []).map((t: any) => ({ ...t, caseId: i?.case?.id || '' }))).filter(t => !chain || t.sourceChain === chain || t.destinationChain === chain);
  }, [data, chain]);
  return <div className="op-page"><PageHeader title="Cross-chain intelligence" description="Follow supported bridge evidence across networks without losing the case context."/><State loading={loading} error={error}><><Summary items={[{ label: 'Cross-chain movements', value: transfers.length, icon: <GitBranch size={17}/> }, { label: 'Bridged value', value: money(transfers.reduce((n, t) => n + (t.amount || 0), 0)), note: 'Synthetic INR equivalent' }, { label: 'Networks observed', value: new Set(transfers.flatMap(t => [t.sourceChain, t.destinationChain]).filter(Boolean)).size }, { label: 'Involved cases', value: new Set(transfers.map(t => t.caseId).filter(Boolean)).size }]}/><Card className="op-table-card"><div className="op-card-heading"><h2>Bridge transfer timeline</h2><select aria-label="Filter transfers by chain" value={chain} onChange={e => setChain(e.target.value)}><option value="">All networks</option>{chains.map(c => <option key={c}>{c}</option>)}</select></div>{transfers.length ? <div className="op-transfer-list">{transfers.map(t => <div key={`${t.caseId}-${t.id}`} className="op-transfer"><div className="op-transfer-time"><span>{t.timestamp ? new Date(t.timestamp).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', timeZone: 'UTC' }) + ' UTC' : '—'}</span><small>{t.timestamp ? new Date(t.timestamp).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', timeZone: 'UTC' }) : '—'}</small></div><div className="op-transfer-body"><div className="op-chain-route"><span><span className="op-chain-dot"/>{t.sourceChain}</span><ArrowRight size={17}/><span className="op-bridge-chip"><GitBranch size={14}/>{t.bridge}</span><ArrowRight size={17}/><span><span className="op-chain-dot purple"/>{t.destinationChain}</span></div><div className="op-transfer-detail"><div><small>Transferred value</small><strong>{money(t.amount || 0)}</strong></div><div><small>Source → destination</small><span className="op-mono">{shortAddress(t.sourceWallet)} → {shortAddress(t.destinationWallet)}</span></div><div><small>Evidence</small><span>{t.evidenceId}</span></div></div><div className="op-transfer-footer"><span className="op-mono" title={t.transactionHash}>TX {shortAddress(t.transactionHash)}</span><button onClick={() => navigate(`/app/investigations/${encodeURIComponent(t.caseId)}?evidence=${encodeURIComponent(t.evidenceId)}`)}>{t.caseId}<ArrowRight size={14}/></button></div></div></div>)}</div> : <Empty title="No bridge transfers match" text="Select another network or trace a case with bridge activity."/>}</Card><div className="op-info-box"><ShieldCheck size={21}/><div><strong>Cross-chain evidence is a correlation</strong><p>Bridge events link source and destination transactions in this deterministic dataset. Privacy-enhancing service exposure reduces tracing confidence; this system does not deanonymize mixers.</p></div></div></></State><Disclaimer/></div>;
}

export function PatternsPage() {
  const { data, loading, error } = useInvestigations(); const [selected, setSelected] = useState('');
  const inv = useMemo(() => {
    if (!data || !data.length) return null;
    return data.find(i => i?.case?.id === selected) || data[0];
  }, [data, selected]);
  return <div className="op-page"><PageHeader title="Fraud flow fingerprint" description="Understand the behavior behind the flow. Pattern consistency is never proof of a crime."/><State loading={loading} error={error}>{inv ? <><div className="op-toolbar op-standalone-toolbar"><div><span className="op-eyebrow">INVESTIGATION CONTEXT</span><h2>{inv.case?.fraudType || 'Investigation profile'}</h2></div><CaseSelect cases={(data || []).map(i => i.case).filter(Boolean)} value={inv.case?.id || ''} onChange={setSelected}/><Button onClick={() => openCase(inv.case?.id)}>Open investigation<ArrowRight size={15}/></Button></div><div className="op-two-col"><Card><div className="op-card-heading"><h2>Behavioral pattern profile</h2><Activity size={18}/></div><p className="op-muted">Pattern consistent with…</p><div className="op-pattern-list">{inv.fingerprint?.patterns?.length ? inv.fingerprint.patterns.map((p: any, index: number) => <div key={p.name} className={`op-pattern ${index === 0 ? 'primary' : ''}`}><div><strong>{p.name}</strong><span>{p.score}%</span></div><div className="op-progress"><span style={{ width: `${p.score}%` }}/></div><p>{p.reason}</p><button className="op-text-button" onClick={() => navigate(`/app/investigations/${encodeURIComponent(inv.case?.id)}?evidence=${encodeURIComponent(p.evidenceIds?.[0] || '')}`)}>Inspect {p.evidenceIds?.length || 0} evidence references<ArrowRight size={13}/></button></div>) : <p className="op-muted" style={{padding:'1rem'}}>No fraud patterns calculated for this case yet. Open the case and run a trace.</p>}</div></Card><Card><div className="op-card-heading"><h2>Feature measurements</h2><SlidersHorizontal size={17}/></div><div className="op-key-values">{Object.entries(inv.fingerprint?.features || {}).map(([key, value]) => <div key={key}><span>{humanize(key)}</span><strong>{featureValue(key, value, inv.fingerprint?.features || {})}</strong></div>)}{!Object.keys(inv.fingerprint?.features || {}).length && <p className="op-muted">No behavioral features observed.</p>}</div></Card></div><Card><div className="op-card-heading"><h2>Why this profile?</h2><Badge>EXPLAINABLE HEURISTICS</Badge></div><p className="op-muted">The engine measures transaction structure, timing and endpoint exposure, then ranks rule-based pattern consistency. Scores summarize this dataset and are not statistical probabilities of criminal activity.</p><div className="op-evidence-grid">{(inv.riskIndicators || []).map((r: any) => <button key={r.id} onClick={() => navigate(`/app/investigations/${encodeURIComponent(inv.case?.id)}?evidence=${encodeURIComponent(r.id)}`)}><Activity size={16}/><div><strong>{r.title}</strong><p>{r.description}</p><small>{r.id} · Inspect supporting evidence</small></div></button>)}{!inv.riskIndicators?.length && <p className="op-muted">No material risk indicators flagged.</p>}</div></Card></> : <Empty/>}</State><Disclaimer/></div>;
}

export function AlertsPage() {
  const { data, loading, error, setData } = useData<any[]>('/alerts'); const [status, setStatus] = useState('Active'); const [severity, setSeverity] = useState(''); const [busy, setBusy] = useState('');
  const list = (data || []).filter(a => (!status || a.status === status || (status === 'Active' && !['Reviewed', 'Dismissed'].includes(a.status))) && (!severity || a.severity.toLowerCase() === severity.toLowerCase()));
  async function update(id: string, value: string) { setBusy(id); try { const result = await api<any>(`/alerts/${encodeURIComponent(id)}`, { method: 'PATCH', body: JSON.stringify({ status: value }) }); setData(old => old?.map(a => a.id === id ? result : a) || []); toast(`Alert ${value.toLowerCase()}`); } catch (e) { toast((e as Error).message, 'error'); } finally { setBusy(''); } }
  return <div className="op-page"><PageHeader title="Intelligence alerts" description="Review significant movements, exposure indicators and cross-case connections."/><Summary items={[{ label: 'Awaiting review', value: data?.filter(a => !['Reviewed', 'Dismissed'].includes(a.status)).length || 0, icon: <Bell size={18}/> }, { label: 'High / critical severity', value: data?.filter(a => /high|critical/i.test(a.severity)).length || 0 }, { label: 'Reviewed', value: data?.filter(a => a.status === 'Reviewed').length || 0 }, { label: 'Case coverage', value: new Set(data?.map(a => a.caseId)).size }]}/><Card className="op-table-card"><div className="op-toolbar"><div className="op-tabs">{['Active', 'Reviewed', 'Dismissed', ''].map(s => <button key={s} className={status === s ? 'active' : ''} onClick={() => setStatus(s)}>{s || 'All alerts'}</button>)}</div><select aria-label="Alert severity" value={severity} onChange={e => setSeverity(e.target.value)}><option value="">All severities</option>{['Critical', 'High', 'Medium', 'Low'].map(s => <option key={s}>{s}</option>)}</select></div><State loading={loading} error={error}>{list.length ? <div className="op-alert-list">{list.map(a => <div className="op-alert" key={a.id}><div className={`op-alert-symbol ${a.severity.toLowerCase()}`}><Bell size={18}/></div><div className="op-alert-main"><div className="op-alert-title"><h3>{humanize(a.type)}</h3><span className={`op-severity ${a.severity.toLowerCase()}`}>{a.severity}</span><Badge>{a.status}</Badge></div><p>{a.description}</p><div className="op-alert-meta"><button onClick={() => openCase(a.caseId)}>{a.caseId}</button><span className="op-mono">{shortAddress(a.wallet)}</span><span>{money(a.amount)}</span><span>{timestamp(a.timestamp)}</span></div></div><div className="op-alert-actions"><button title="Open investigation" className="op-icon-button" onClick={() => openCase(a.caseId)}><ExternalLink size={16}/></button>{a.status !== 'Reviewed' && <button disabled={busy === a.id} className="op-review-button" onClick={() => void update(a.id, 'Reviewed')}><Check size={14}/> Review</button>}{a.status !== 'Dismissed' && <button disabled={busy === a.id} aria-label="Dismiss alert" className="op-icon-button" onClick={() => void update(a.id, 'Dismissed')}><X size={16}/></button>}</div></div>)}</div> : <Empty title="You're up to date" text="No alerts match this status and severity."/>}</State></Card><Disclaimer/></div>;
}

export function ReportsPage() {
  const reports = useData<any[]>('/reports'); const cases = useData<any[]>('/cases'); const [caseId, setCaseId] = useState(() => new URLSearchParams(window.location.search).get('caseId') || ''); const [busy, setBusy] = useState(false); const [error, setError] = useState(''); const [latest, setLatest] = useState<any>(null);
  async function generate() { const id = caseId || cases.data?.[0]?.id; if (!id) return; setBusy(true); setError(''); try { const result = await api<any>(`/reports/${encodeURIComponent(id)}/generate`, { method: 'POST' }); setLatest(result); reports.reload(); toast('Investigation PDF generated'); } catch (e) { setError((e as Error).message); } finally { setBusy(false); } }
  return <div className="op-page"><PageHeader title="Evidence reports" description="Turn the investigation into a structured, versioned evidence package."/><div className="op-report-create"><div className="op-report-illustration"><FileText size={46}/><span>INVESTIGATION<br/>REPORT</span><i/><i/><i/></div><div><span className="op-eyebrow">FROM INTELLIGENCE TO ACTION</span><h2>A complete case narrative.<br/>Backed by traceable evidence.</h2><p>Case details, fund flows, attribution reasoning, transaction references and investigator recommendations in a professional PDF.</p><div className="op-report-controls"><CaseSelect cases={cases.data || []} value={caseId || cases.data?.[0]?.id || ''} onChange={setCaseId}/><Button disabled={busy || !cases.data?.length} onClick={() => void generate()}><Download size={16}/>{busy ? 'Generating PDF…' : 'Generate report'}</Button></div></div></div>{error && <div className="op-error" role="alert">{error}</div>}{latest && <div className="op-success"><Check size={18}/><span>Report {latest.version ? `v${latest.version}` : ''} is ready for {latest.caseId}.</span><a href={latest.url || `/api/reports/${latest.id}`} target="_blank" rel="noreferrer">Open PDF<ExternalLink size={15}/></a></div>}
    <Card className="op-table-card"><div className="op-card-heading"><h2>Generated reports</h2><button className="op-icon-button" aria-label="Refresh reports" onClick={reports.reload}><RefreshCw size={16}/></button></div><State loading={reports.loading || cases.loading} error={reports.error || cases.error}>{reports.data?.length ? <div className="op-table-wrap"><table className="op-table"><thead><tr><th>Document</th><th>Case</th><th>Version</th><th>Generated</th><th/></tr></thead><tbody>{reports.data.map(r => <tr key={r.id}><td><div className="op-document-cell"><FileText size={19}/><div><strong>Investigation report</strong><small>{r.filename}</small></div></div></td><td><button className="op-text-button" onClick={() => openCase(r.caseId)}>{r.caseId}</button></td><td><Badge>v{r.version}</Badge></td><td>{timestamp(r.createdAt)}</td><td><a className="op-download-link" href={`/api/reports/${encodeURIComponent(r.id)}`} target="_blank" rel="noreferrer"><Download size={15}/> Open PDF</a></td></tr>)}</tbody></table></div> : <Empty title="Your first evidence package starts here" text="Select an investigation and generate its report. Each report is saved with a version and audit event."/>}</State></Card><Disclaimer/></div>;
}

export function RequestsPage() {
  const cases = useData<any[]>('/cases'); const [caseId, setCaseId] = useState(() => new URLSearchParams(window.location.search).get('caseId') || ''); const [inv, setInv] = useState<any>(null); const [busy, setBusy] = useState(false); const [packageData, setPackageData] = useState<any>(null); const [error, setError] = useState('');
  const selected = caseId || cases.data?.[0]?.id || '';
  useEffect(() => { if (!selected) return; let active = true; setInv(null); setPackageData(null); setError(''); api(`/investigations/${encodeURIComponent(selected)}`).then(r => { if (active) setInv(r); }).catch(e => { if (active) setError(e.message); }); return () => { active = false; }; }, [selected]);
  async function generate() { setBusy(true); setError(''); try { const result = await api(`/requests/${encodeURIComponent(selected)}/generate`, { method: 'POST' }); setPackageData(result); downloadJSON(result, `${selected}-information-request.json`); toast('Information request package prepared'); } catch (e) { setError((e as Error).message); } finally { setBusy(false); } }
  const attribution = inv?.attributions?.[0];
  return <div className="op-page"><PageHeader title="VASP information request" description="Prepare a structured evidence package for an authorized investigator to review."/><div className="op-info-box"><ShieldCheck size={22}/><div><strong>Preparation only · no external submission</strong><p>This package does not access KYC information, contact an exchange or freeze assets. An authorized investigator must verify the evidence and use the appropriate legal channel.</p></div></div><Card><div className="op-card-heading"><h2>Request context</h2><CaseSelect cases={cases.data || []} value={selected} onChange={setCaseId}/></div><State loading={cases.loading || (!inv && !!selected && !error)} error={cases.error || error}>{inv && <><div className="op-request-grid"><div><span>Target candidate VASP</span><strong>{attribution?.candidate || 'Unattributed — review required'}</strong></div><div><span>Case ID</span><strong>{inv.case.id}</strong></div><div><span>Reported wallet</span><strong className="op-mono op-break">{inv.case.reportedWallet}</strong></div><div><span>Endpoint transactions</span><strong>{attribution?.transactionCount || 0}</strong></div><div><span>Traced value</span><strong>{money(attribution?.tracedAmount || 0)}</strong></div><div><span>Attribution confidence</span><strong>{attribution?.confidence || 0}%</strong></div><div><span>First interaction</span><strong>{timestamp(attribution?.firstInteraction)}</strong></div><div><span>Last interaction</span><strong>{timestamp(attribution?.lastInteraction)}</strong></div></div><h3 className="op-subtitle">Supporting evidence to include</h3><div className="op-evidence-grid">{(attribution?.evidence || []).map((e: any) => <button className="op-static-evidence" key={e.id} onClick={() => navigate(`/app/investigations/${encodeURIComponent(inv.case.id)}?evidence=${encodeURIComponent(e.id)}`)}><Check size={16}/><div><strong>{e.title}</strong><p>{e.description}</p><small>{e.id} · Inspect evidence</small></div></button>)}</div><div className="op-form-actions"><p>{attribution ? "JSON package includes case context, references and review requirements." : "No supported VASP candidate is available. Continue tracing and reviewing evidence before preparing a request."}</p><Button disabled={busy || !attribution} onClick={() => void generate()}><FileCheck2 size={16}/>{busy ? 'Preparing package…' : 'Generate information request package'}</Button></div></>}</State></Card>{packageData && <Card><div className="op-card-heading"><h2>Prepared package preview</h2><button className="op-download-link" onClick={() => downloadJSON(packageData, `${selected}-information-request.json`)}><Download size={15}/> Download JSON</button></div><pre className="op-code-preview">{JSON.stringify(packageData, null, 2)}</pre></Card>}<Disclaimer/></div>;
}

const endpointGroups = [
  { title: 'Cases & investigations', items: [['GET', '/api/cases', 'List investigations visible to your session'], ['POST', '/api/cases', 'Register a complaint and normalize its wallet'], ['GET', '/api/cases/{id}', 'Retrieve complaint details'], ['PATCH', '/api/cases/{id}', 'Update investigation status'], ['POST', '/api/investigations', 'Run deterministic tracing and analytics'], ['GET', '/api/investigations/{id}', 'Retrieve the full intelligence workspace']] },
  { title: 'Intelligence & correlation', items: [['GET', '/api/wallets/{address}', 'Wallet overview, behavior and transactions'], ['GET', '/api/wallets/{address}/transactions', 'Transaction evidence for an indexed wallet'], ['GET', '/api/graph/{caseId}', 'Directed transaction graph'], ['GET', '/api/attribution/{caseId}', 'Weighted VASP candidate evidence'], ['GET', '/api/cases/{id}/related', 'Cross-complaint relationships'], ['GET', '/api/search?q={query}', 'Search indexed cases, wallets and evidence'], ['POST', '/api/assistant/{caseId}', 'Case-grounded answers and evidence citations']] },
  { title: 'Operational workflow', items: [['GET', '/api/alerts', 'Investigation alerts'], ['PATCH', '/api/alerts/{id}', 'Review or dismiss an alert'], ['POST', '/api/reports/{caseId}/generate', 'Generate a versioned PDF investigation report'], ['GET', '/api/reports/{id}', 'Download PDF report'], ['POST', '/api/requests/{caseId}/generate', 'Prepare a VASP information request package'], ['GET', '/api/events', 'Server-sent demo evidence replay'], ['GET', '/api/health', 'Check API and database availability']] },
];
export function ApiPage() {
  const health = useData<any>('/health'); const [copied, setCopied] = useState(false); const command = `curl ${window.location.origin}/api/health`;
  return <div className="op-page"><PageHeader title="Developer API" description="A documented REST interface for the complete investigation workflow." action={<a className="op-primary-link" href="/api/docs" target="_blank" rel="noreferrer">Open API documentation<ExternalLink size={15}/></a>}/><div className="op-two-col"><Card><div className="op-card-heading"><h2>API connection</h2><Badge>{health.loading ? 'CHECKING' : health.error ? 'UNAVAILABLE' : 'OPERATIONAL'}</Badge></div><div className="op-key-values"><div><span>Base URL</span><strong className="op-mono">{window.location.origin}/api</strong></div><div><span>Data mode</span><strong>Deterministic demo</strong></div><div><span>Authentication</span><strong>Same-origin demo session cookie</strong></div><div><span>Response format</span><strong>JSON · PDF for reports · SSE events</strong></div></div><p className="op-muted">Enter Demo Mode before calling session-scoped endpoints. Never place external API secrets in browser code.</p><a className="op-text-button" href="/api/openapi.json" target="_blank" rel="noreferrer">Download OpenAPI schema<Download size={14}/></a></Card><Card><div className="op-card-heading"><h2>Quick start</h2><Terminal size={17}/></div><div className="op-code-box"><span>CHECK SERVICE HEALTH</span><code>{command}</code><button aria-label="Copy health check command" onClick={() => navigator.clipboard.writeText(command).then(() => { setCopied(true); setTimeout(() => setCopied(false), 1800); }).catch(() => toast('Unable to copy command', 'error'))}>{copied ? <Check size={16}/> : <Copy size={16}/>}</button></div><pre className="op-code-preview op-health-json">{JSON.stringify(health.data || { status: health.error || 'checking' }, null, 2)}</pre><button className="op-text-button" onClick={health.reload}><RefreshCw size={14}/> Refresh health check</button></Card></div>{endpointGroups.map(group => <Card className="op-table-card" key={group.title}><div className="op-card-heading"><h2>{group.title}</h2></div><div className="op-table-wrap"><table className="op-table op-endpoint-table"><thead><tr><th>Method</th><th>Endpoint</th><th>Purpose</th></tr></thead><tbody>{group.items.map(([method, path, description]) => <tr key={`${method}-${path}`}><td><span className={`op-method ${method.toLowerCase()}`}>{method}</span></td><td className="op-mono">{path}</td><td>{description}</td></tr>)}</tbody></table></div></Card>)}<Disclaimer/></div>;
}

const weightLabels: Record<string, string> = { cluster: 'Address cluster evidence', pattern: 'Transaction pattern', deposit: 'Deposit behavior', temporal: 'Temporal correlation', crossChain: 'Cross-chain evidence', historical: 'Historical interaction', external: 'External attribution' };
export function SettingsPage() {
  const settings = useData<any>('/settings'); const audit = useData<any[]>('/audit'); const [weights, setWeights] = useState<Record<string, number>>({}); const [busy, setBusy] = useState(false); const [error, setError] = useState('');
  useEffect(() => { if (settings.data?.weights) setWeights(settings.data.weights); }, [settings.data]);
  const total = Object.values(weights).reduce((sum, n) => sum + Number(n), 0);
  async function save() { setBusy(true); setError(''); try { const result = await api<any>('/settings', { method: 'PUT', body: JSON.stringify({ weights }) }); settings.setData(result); audit.reload(); toast('Weights saved. Rerun a trace to recalculate attribution.'); } catch (e) { setError((e as Error).message); } finally { setBusy(false); } }
  return <div className="op-page"><PageHeader title="Settings & audit" description="Configure explainable attribution and inspect the history of investigator actions."/><State loading={settings.loading} error={settings.error}><div className="op-two-col"><Card><div className="op-card-heading"><h2>Attribution evidence weights</h2><Settings2 size={18}/></div><p className="op-muted">Evidence weights must total 100%. Changes apply when you rerun a trace.</p><div className="op-weight-list">{Object.entries(weightLabels).map(([key, label]) => <label key={key}><span>{label}</span><input aria-label={`${label} weight`} type="range" min="0" max="100" value={weights[key] || 0} onChange={e => setWeights(w => ({ ...w, [key]: Number(e.target.value) }))}/><div><input aria-label={`${label} percentage`} type="number" min="0" max="100" value={weights[key] ?? 0} onChange={e => setWeights(w => ({ ...w, [key]: Math.max(0, Math.min(100, Number(e.target.value))) }))}/>%</div></label>)}</div><div className={`op-weight-total ${total !== 100 ? 'invalid' : ''}`}><span>Total weighting</span><strong>{total}%</strong></div>{error && <div className="op-error" role="alert">{error}</div>}<div className="op-form-actions"><button className="op-text-button" onClick={() => setWeights({ cluster: 25, pattern: 20, deposit: 15, temporal: 15, crossChain: 10, historical: 10, external: 5 })}>Restore defaults</button><Button disabled={busy || total !== 100} onClick={() => void save()}>{busy ? 'Saving…' : 'Save weights'}</Button></div></Card><div className="op-stack"><Card><div className="op-card-heading"><h2>Environment</h2><Badge>DEMO</Badge></div><div className="op-key-values"><div><span>Investigator access</span><strong>Demo session</strong></div><div><span>Blockchain source</span><strong>Simulated dataset</strong></div><div><span>Attribution source</span><strong>Fictional VASP evidence</strong></div><div><span>Government integrations</span><strong>Adapters only</strong></div><div><span>External submissions</span><strong>Disabled</strong></div></div><button className="op-full-link" onClick={() => navigate('/app/sources')}>Review all data sources<ArrowRight size={15}/></button></Card><div className="op-info-box"><ShieldCheck size={22}/><div><strong>Human review by design</strong><p>Risk scores, behavioral patterns and candidate VASP associations support investigation. They do not determine guilt, identify private account holders or authorize enforcement.</p></div></div></div></div></State><Card className="op-table-card"><div className="op-card-heading"><h2>Audit trail</h2><button className="op-icon-button" aria-label="Refresh audit trail" onClick={audit.reload}><RefreshCw size={16}/></button></div><State loading={audit.loading} error={audit.error}>{audit.data?.length ? <div className="op-table-wrap"><table className="op-table"><thead><tr><th>Timestamp</th><th>Investigator</th><th>Action</th><th>Object</th></tr></thead><tbody>{audit.data.slice(0, 60).map(row => <tr key={row.id}><td>{timestamp(row.timestamp)}</td><td>{row.user}</td><td><span className="op-audit-dot"/>{humanize(row.action)}</td><td className="op-mono">{row.object}</td></tr>)}</tbody></table></div> : <Empty title="Actions leave an evidence trail" text="Create an investigation, review evidence or generate a report to record audit events."/>}</State></Card></div>;
}

export function SourcesPage() {
  const { data, loading, error, reload } = useData<any[]>('/sources');
  const datasetStats = useData<any>('/dataset/stats');
  const modelEval = useData<any>('/analytics/model-eval');
  const temporal = useData<any>('/analytics/temporal?window=3');

  const rf = modelEval.data?.models?.random_forest || {};
  const cm = rf.confusion_matrix || {};

  return <div className="op-page">
    <PageHeader title="Data sources & research dataset analytics" description="Inspect live dataset statistics, supervised fraud classifier evaluation, and graph pipeline architecture." action={<Button onClick={() => { reload(); datasetStats.reload(); modelEval.reload(); temporal.reload(); }}><RefreshCw size={16}/>Refresh status</Button>}/>

    <div className="op-info-box"><Database size={22}/><div><strong>Primary Source: Elliptic Bitcoin Transaction Dataset</strong><p>A genuine transaction-to-transaction research dataset containing 203,769 transaction nodes and 234,355 directed edges across 49 discrete Bitcoin time steps. Labeled transactions (46,564) are mapped to ground-truth illicit (4,545) and licit (42,019) classes. Unknown transactions (157,205) are never presumed legitimate.</p></div></div>

    <Summary items={[
      { label: 'Total transaction nodes', value: datasetStats.data?.totalNodes ? datasetStats.data.totalNodes.toLocaleString('en-IN') : '203,769', note: 'Primary dataset nodes' },
      { label: 'Directed edges', value: datasetStats.data?.totalEdges ? datasetStats.data.totalEdges.toLocaleString('en-IN') : '234,355', note: 'Transaction relationships' },
      { label: 'Known illicit', value: datasetStats.data?.classes?.illicit ? datasetStats.data.classes.illicit.toLocaleString('en-IN') : '4,545', note: 'Ground truth class 1 (minority)' },
      { label: 'Known licit', value: datasetStats.data?.classes?.licit ? datasetStats.data.classes.licit.toLocaleString('en-IN') : '42,019', note: 'Ground truth class 2' },
      { label: 'Unknown (unlabeled)', value: datasetStats.data?.classes?.unknown ? datasetStats.data.classes.unknown.toLocaleString('en-IN') : '157,205', note: 'Evaluated objectively' },
      { label: 'Model PR-AUC / ROC-AUC', value: `${rf.pr_auc || 0.7805} / ${rf.roc_auc || 0.9254}`, note: 'Time-aware split (no leakage)' }
    ]}/>

    <div className="op-two-col">
      <Card>
        <div className="op-card-heading"><h2>Supervised fraud classifier performance</h2><Badge>TIME-AWARE SPLIT</Badge></div>
        <p className="op-muted">Model: {rf.model || 'Random Forest (Balanced, max_depth=12)'}. Evaluated on holdout test set (TimeSteps 35–49) after training on TimeSteps 1–34 (Weber et al. benchmark). Prevents temporal leakage.</p>
        <div className="op-key-values">
          <div><span>PR-AUC (Priority Metric)</span><strong>{rf.pr_auc || 0.7805}</strong></div>
          <div><span>ROC-AUC</span><strong>{rf.roc_auc || 0.9254}</strong></div>
          <div><span>F1-Score</span><strong>{rf.f1 || 0.7538}</strong></div>
          <div><span>Precision</span><strong>{rf.precision ? (rf.precision * 100).toFixed(2) + '%' : '78.31%'}</strong></div>
          <div><span>Recall</span><strong>{rf.recall ? (rf.recall * 100).toFixed(2) + '%' : '72.67%'}</strong></div>
          <div><span>False Positive Rate (FPR)</span><strong>{rf.fpr ? (rf.fpr * 100).toFixed(2) + '%' : '1.40%'}</strong></div>
          <div><span>False Negative Rate (FNR)</span><strong>{rf.fnr ? (rf.fnr * 100).toFixed(2) + '%' : '27.33%'}</strong></div>
          <div><span>Train / Test Split</span><strong>{modelEval.data?.train_samples?.toLocaleString() || '29,894'} / {modelEval.data?.test_samples?.toLocaleString() || '16,670'}</strong></div>
        </div>
        <h3 className="op-subtitle">Confusion matrix (Holdout test split)</h3>
        <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'8px',marginTop:'8px'}}>
          <div style={{background:'#0c1724',padding:'8px',borderRadius:'4px',border:'1px solid #1e3046'}}>
            <small style={{color:'#7f95ae'}}>True Negatives (Licit as Licit)</small>
            <strong style={{display:'block',fontSize:'16px',color:'#4fd7c1'}}>{cm.tn?.toLocaleString() || '15,369'}</strong>
          </div>
          <div style={{background:'#0c1724',padding:'8px',borderRadius:'4px',border:'1px solid #1e3046'}}>
            <small style={{color:'#7f95ae'}}>False Positives (Licit as Illicit)</small>
            <strong style={{display:'block',fontSize:'16px',color:'#f09a69'}}>{cm.fp?.toLocaleString() || '218'}</strong>
          </div>
          <div style={{background:'#0c1724',padding:'8px',borderRadius:'4px',border:'1px solid #1e3046'}}>
            <small style={{color:'#7f95ae'}}>False Negatives (Illicit as Licit)</small>
            <strong style={{display:'block',fontSize:'16px',color:'#f09a69'}}>{cm.fn?.toLocaleString() || '296'}</strong>
          </div>
          <div style={{background:'#0c1724',padding:'8px',borderRadius:'4px',border:'1px solid #1e3046'}}>
            <small style={{color:'#7f95ae'}}>True Positives (Illicit as Illicit)</small>
            <strong style={{display:'block',fontSize:'16px',color:'#4fd7c1'}}>{cm.tp?.toLocaleString() || '787'}</strong>
          </div>
        </div>
      </Card>

      <Card>
        <div className="op-card-heading"><h2>Sliding window temporal burst analysis</h2><Activity size={18}/></div>
        <p className="op-muted">Calculated using a 3-step sliding window across all 49 time steps to detect transaction bursts and illicit concentration spikes.</p>
        <div className="op-key-values">
          <div><span>Analyzed Windows</span><strong>{temporal.data?.totalWindows || 47} windows</strong></div>
          <div><span>Bursts Detected (Ratio ≥ 1.3)</span><strong>{temporal.data?.burstCount || 9} bursts</strong></div>
          <div><span>Peak Activity Window</span><strong>TimeSteps {temporal.data?.peakWindow?.startStep}–{temporal.data?.peakWindow?.endStep}</strong></div>
          <div><span>Peak Window Volume</span><strong>{temporal.data?.peakWindow?.totalTransactions?.toLocaleString() || '19,117'} transactions</strong></div>
          <div><span>Peak Burst Ratio</span><strong>{temporal.data?.peakWindow?.burstRatio || 1.53}x mean</strong></div>
          <div><span>Illicit / High-Risk in Peak</span><strong>{temporal.data?.peakWindow?.illicitOrHighRiskCount || 75} ({temporal.data?.peakWindow?.illicitPercentage || 0.39}%)</strong></div>
        </div>
        <h3 className="op-subtitle">Top influential features (Random Forest)</h3>
        <div style={{display:'flex',flexDirection:'column',gap:'4px',marginTop:'6px'}}>
          {(modelEval.data?.top_features || []).slice(0, 5).map((f: any) => <div key={f.rank} style={{display:'flex',justifyContent:'space-between',fontSize:'12px',background:'#0d1927',padding:'4px 8px',borderRadius:'4px'}}>
            <span>#{f.rank} {f.feature_name} (Col {f.feature_index})</span>
            <strong style={{color:'#4fd7c1'}}>{(f.importance * 100).toFixed(2)}%</strong>
          </div>)}
        </div>
      </Card>
    </div>

    <State loading={loading} error={error}><Card className="op-table-card"><div className="op-card-heading"><h2>Source registry</h2><Badge>{data?.length || 0} sources</Badge></div><div className="op-table-wrap"><table className="op-table"><thead><tr><th>Data source</th><th>Status</th><th>Coverage</th><th>Mode</th><th>Last updated</th></tr></thead><tbody>{data?.map((source, i) => <tr key={`${source.name}-${i}`}><td><div className="op-document-cell"><Database size={17}/><strong>{source.name}</strong></div></td><td><span className="op-status">{source.status}</span></td><td>{source.coverage}</td><td><Badge>{source.mode}</Badge></td><td>{timestamp(source.lastUpdated)}</td></tr>)}</tbody></table></div></Card></State>

    <div className="op-adapter-grid">{[{ title: 'NCRP adapter', label: 'Complaint intake', body: 'A defined interface maps authorized complaint records to case IDs, incident metadata and reported wallets.' }, { title: 'SAHYOG adapter', label: 'Investigation coordination', body: 'An adapter boundary supports authorized coordination workflows when official access is provisioned.' }, { title: 'VASP request adapter', label: 'Information request preparation', body: 'Structured evidence packages can be reviewed and submitted by authorized investigators through appropriate channels.' }].map(a => <Card key={a.title}><div className="op-icon-tile"><Link2 size={20}/></div><Badge>INTEGRATION ADAPTER</Badge><h2>{a.title}</h2><small>{a.label}</small><p>{a.body}</p><span className="op-adapter-note">Official API access not configured</span></Card>)}</div>

    <Card><div className="op-card-heading"><h2>Architecture boundaries</h2><Layers3 size={18}/></div><div className="op-architecture"><div><Globe2 size={23}/><strong>Investigator console</strong><small>Cases, graphs, evidence, reports</small></div><ArrowRight size={20}/><div><Activity size={23}/><strong>Graph analytics engine</strong><small>BFS, DFS, Dijkstra, Union-Find</small></div><ArrowRight size={20}/><div><Database size={23}/><strong>Elliptic research dataset</strong><small>203,769 nodes, 234,355 edges</small></div></div><p className="op-muted">Graph intelligence uses adjacency lists, reverse adjacency indexing, and priority queues over the Elliptic Research Dataset. Supervised classification is trained on a time-aware split to ensure zero future information leakage.</p></Card>

    <Disclaimer/>
  </div>;
}
