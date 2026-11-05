import { Component, Suspense, lazy, useEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import {
  LayoutDashboard, BriefcaseBusiness, ScanSearch, Wallet, Network, Landmark,
  GitBranch, Fingerprint, Bell, FileText, Code2, Settings, Database, Waypoints,
  Search, Command, Plus, Menu, X, ChevronRight, ArrowUpRight, LogOut, ShieldCheck,
  Radio, CheckCircle2, AlertCircle, FileOutput, Inbox, UserCheck, ShieldAlert
} from 'lucide-react';
import { api, navigate, toast } from './api';
import { Badge, LoadingState, Button, ErrorState } from './components/ui';
import Landing from './pages/Landing';

// Lazy loaded views
const Dashboard = lazy(() => import('./pages/Dashboard'));
const Investigation = lazy(() => import('./pages/Investigation'));
const CreateCase = lazy(() => import('./pages/CreateCase'));
const GraphExplorer = lazy(() => import('./pages/GraphExplorer'));
const operations = () => import('./pages/Operations');
const Cases = lazy(() => operations().then(m => ({ default: m.CasesPage })));
const Wallets = lazy(() => operations().then(m => ({ default: m.WalletPage })));
const Vasps = lazy(() => operations().then(m => ({ default: m.VaspPage })));
const CrossChain = lazy(() => operations().then(m => ({ default: m.CrossChainPage })));
const Patterns = lazy(() => operations().then(m => ({ default: m.PatternsPage })));
const Alerts = lazy(() => operations().then(m => ({ default: m.AlertsPage })));
const Reports = lazy(() => operations().then(m => ({ default: m.ReportsPage })));
const Api = lazy(() => operations().then(m => ({ default: m.ApiPage })));
const SettingsPage = lazy(() => operations().then(m => ({ default: m.SettingsPage })));
const Sources = lazy(() => operations().then(m => ({ default: m.SourcesPage })));
const Requests = lazy(() => operations().then(m => ({ default: m.RequestsPage })));

// Reporter and Officer portals
const reporter = () => import('./pages/ReporterPortal');
const ReporterDashboard = lazy(() => reporter().then(m => ({ default: m.ReporterDashboard })));
const SubmitComplaintPage = lazy(() => reporter().then(m => ({ default: m.SubmitComplaintPage })));
const MyCasesPage = lazy(() => reporter().then(m => ({ default: m.MyCasesPage })));
const CaseTrackingPage = lazy(() => reporter().then(m => ({ default: m.CaseTrackingPage })));

const officer = () => import('./pages/OfficerPortal');
const IncomingReportsPage = lazy(() => officer().then(m => ({ default: m.IncomingReportsPage })));
const CaseReviewPage = lazy(() => officer().then(m => ({ default: m.CaseReviewPage })));

const navItems = [
  ['dashboard', 'Dashboard', LayoutDashboard],
  ['incoming', 'Incoming reports', Inbox],
  ['cases', 'Cases', BriefcaseBusiness],
  ['investigations', 'Investigations', ScanSearch],
  ['wallets', 'Wallet intelligence', Wallet],
  ['graph', 'Transaction graph', Network],
  ['vasps', 'VASP intelligence', Landmark],
  ['cross-chain', 'Cross-chain', GitBranch],
  ['patterns', 'Fraud patterns', Fingerprint],
  ['alerts', 'Alerts', Bell],
  ['reports', 'Reports', FileText],
  ['requests', 'Information requests', FileOutput]
] as const;

class Boundary extends Component<{ children: ReactNode }, { error: string }> {
  state = { error: '' };
  static getDerivedStateFromError(e: Error) { return { error: e.message }; }
  render() {
    return this.state.error ? <ErrorState message={this.state.error} retry={() => window.location.reload()} /> : this.props.children;
  }
}

function Palette({ close }: { close: () => void }) {
  const [q, setQ] = useState('');
  const [results, setResults] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const input = useRef<HTMLInputElement>(null);

  useEffect(() => {
    input.current?.focus();
    const h = (e: KeyboardEvent) => { if (e.key === 'Escape') close(); };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, []);

  useEffect(() => {
    if (q.length < 2) { setResults([]); setLoading(false); return; }
    let active = true;
    setLoading(true);
    const timer = setTimeout(() => {
      api(`/search?q=${encodeURIComponent(q)}`).then(r => {
        if (active) { setResults(r); setError(''); setLoading(false); }
      }).catch(e => {
        if (active) { setError(e.message); setLoading(false); }
      });
    }, 220);
    return () => { active = false; clearTimeout(timer); };
  }, [q]);

  const commands = [
    ['Start investigation', '/app/new', Plus],
    ['Incoming citizen reports', '/app/incoming', Inbox],
    ['Search wallet', '/app/wallets', Wallet],
    ['Open demo case', '/app/investigations/CR-2026-00192', ScanSearch],
    ['View alerts', '/app/alerts', Bell],
    ['Generate report', '/app/reports', FileText],
    ['Open VASP intelligence', '/app/vasps', Landmark],
    ['Open transaction graph', '/app/graph', Network],
    ['Ask TRACE AI', '/app/investigations/CR-2026-00192?assistant=1', Command]
  ];

  const select = (path: string) => { navigate(path); close(); };

  return (
    <div className="modal-backdrop" onClick={close}>
      <div className="command-modal" role="dialog" aria-modal="true" aria-label="Search and commands" onClick={e => e.stopPropagation()}>
        <div className="command-input">
          <Search size={20} />
          <input ref={input} placeholder="Search cases, wallets, transactions, evidence…" value={q} onChange={e => setQ(e.target.value)} />
          <button aria-label="Close search" onClick={close}><kbd>ESC</kbd></button>
        </div>
        <div className="command-results">
          {q.length >= 2 ? (
            <>
              <div className="command-section-label">{loading ? 'Searching case evidence…' : `${results.length} results`}</div>
              {error && <p>{error}</p>}
              {results.map((r: any, i: number) => (
                <button key={i} onClick={() => select(r.path || `/app/investigations/${r.caseId || r.id}`)}>
                  <Search size={17} />
                  <span><strong>{r.title}</strong><small>{r.type} · {r.subtitle}</small></span>
                  <ArrowUpRight size={15} />
                </button>
              ))}
              {!loading && !results.length && <p className="command-empty">No matches. Try “VASP-X” or “CR-2026”.</p>}
            </>
          ) : (
            <>
              <div className="command-section-label">WORKSPACE COMMANDS</div>
              {commands.map(([label, path, Icon]: any) => (
                <button key={label} onClick={() => select(path)}>
                  <Icon size={17} /><span>{label}</span><ChevronRight size={15} />
                </button>
              ))}
            </>
          )}
        </div>
        <div className="command-footer">
          <ShieldCheck size={12} /> Searches only your demo case dataset
        </div>
      </div>
    </div>
  );
}

export default function App() {
  const [location, setLocation] = useState(window.location.pathname + window.location.search);
  const [palette, setPalette] = useState(false);
  const [mobile, setMobile] = useState(false);
  const [notice, setNotice] = useState<any>();
  const [ready, setReady] = useState(false);
  const [sessionError, setSessionError] = useState('');
  const [stream, setStream] = useState<any>();
  const [user, setUser] = useState<any>({ name: 'Demo Investigator', role: 'demo-investigator' });

  const isReporter = location.startsWith('/reporter');
  const isOfficerApp = location.startsWith('/app');

  useEffect(() => {
    const h = () => {
      setLocation(window.location.pathname + window.location.search);
      setMobile(false);
    };
    window.addEventListener('popstate', h);
    return () => window.removeEventListener('popstate', h);
  }, []);

  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setPalette(v => !v);
      }
    };
    const t = (e: any) => { setNotice(e.detail); };
    window.addEventListener('keydown', h);
    window.addEventListener('toast', t);
    return () => {
      window.removeEventListener('keydown', h);
      window.removeEventListener('toast', t);
    };
  }, []);

  useEffect(() => {
    if (notice) {
      const t = setTimeout(() => setNotice(undefined), 4500);
      return () => clearTimeout(t);
    }
  }, [notice]);

  useEffect(() => {
    if ((isOfficerApp || isReporter) && !ready) {
      api('/auth/me').then(r => {
        if (r?.user) setUser(r.user);
        setReady(true);
      }).catch(() => {
        const demoEndpoint = isReporter ? '/auth/demo-reporter' : '/auth/demo';
        api(demoEndpoint, { method: 'POST', body: '{}' }).then(r => {
          if (r?.user) setUser(r.user);
          setReady(true);
        }).catch(e => setSessionError(e.message));
      });
    }
  }, [isOfficerApp, isReporter, ready]);

  useEffect(() => {
    if (!ready || !isOfficerApp) return;
    const source = new EventSource('/api/events');
    source.onmessage = e => {
      try { setStream(JSON.parse(e.data)); } catch { }
    };
    return () => source.close();
  }, [ready, isOfficerApp]);

  const handleLogout = async () => {
    try { await api('/auth/logout', { method: 'POST', body: '{}' }); } catch { }
    navigate('/login');
  };

  const initials = (user?.name || 'DA').split(' ').map((s: string) => s[0]).filter(Boolean).slice(0, 2).join('').toUpperCase() || 'DA';

  // 1. Citizen Reporter View
  if (isReporter) {
    const reporterPart = location.split('?')[0].split('/')[2] || 'dashboard';
    const caseId = location.split('?')[0].split('/')[3];

    let reporterContent: any;
    if (reporterPart === 'submit') {
      reporterContent = <SubmitComplaintPage />;
    } else if (reporterPart === 'cases' && caseId) {
      reporterContent = <CaseTrackingPage id={caseId} />;
    } else if (reporterPart === 'cases') {
      reporterContent = <MyCasesPage />;
    } else {
      reporterContent = <ReporterDashboard />;
    }

    return (
      <Boundary>
        <div className="reporter-shell" style={{ minHeight: '100vh', background: '#060c14', color: '#e2e8f0' }}>
          {/* Reporter Topbar */}
          <header style={{
            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
            padding: '12px 32px', background: '#0a1421', borderBottom: '1px solid #1a2d42'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 24 }}>
              <a href="/reporter/dashboard" onClick={e => { e.preventDefault(); navigate('/reporter/dashboard'); }} className="brand">
                <div className="brand-mark"><Waypoints size={20} /></div>
                <div>CRYPTO-TRACE <em>INDIA</em><small>CITIZEN COMPLAINT PORTAL</small></div>
              </a>

              <nav style={{ display: 'flex', gap: 8 }}>
                <a
                  href="/reporter/dashboard"
                  onClick={e => { e.preventDefault(); navigate('/reporter/dashboard'); }}
                  style={{
                    padding: '6px 12px', borderRadius: 6, fontSize: 12.5, fontWeight: 600,
                    color: reporterPart === 'dashboard' ? '#38bdf8' : '#94a3b8',
                    background: reporterPart === 'dashboard' ? '#0f2742' : 'transparent',
                    textDecoration: 'none'
                  }}
                >
                  Dashboard
                </a>
                <a
                  href="/reporter/submit"
                  onClick={e => { e.preventDefault(); navigate('/reporter/submit'); }}
                  style={{
                    padding: '6px 12px', borderRadius: 6, fontSize: 12.5, fontWeight: 600,
                    color: reporterPart === 'submit' ? '#38bdf8' : '#94a3b8',
                    background: reporterPart === 'submit' ? '#0f2742' : 'transparent',
                    textDecoration: 'none'
                  }}
                >
                  + File Complaint
                </a>
                <a
                  href="/reporter/cases"
                  onClick={e => { e.preventDefault(); navigate('/reporter/cases'); }}
                  style={{
                    padding: '6px 12px', borderRadius: 6, fontSize: 12.5, fontWeight: 600,
                    color: reporterPart === 'cases' ? '#38bdf8' : '#94a3b8',
                    background: reporterPart === 'cases' ? '#0f2742' : 'transparent',
                    textDecoration: 'none'
                  }}
                >
                  My Complaints
                </a>
              </nav>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
              <Badge variant="info">CITIZEN COMPLAINANT</Badge>
              <div style={{ fontSize: 12, color: '#cbd5e1' }}>
                <strong>{user?.name || 'Citizen'}</strong>
              </div>
              <button
                onClick={handleLogout}
                style={{
                  background: 'none', border: '1px solid #1a2d42', color: '#94a3b8',
                  padding: '5px 10px', borderRadius: 6, fontSize: 11, cursor: 'pointer',
                  display: 'flex', alignItems: 'center', gap: 6
                }}
              >
                <LogOut size={12} /> Sign Out
              </button>
            </div>
          </header>

          <main style={{ maxWidth: 1200, margin: '0 auto', paddingBottom: 40 }}>
            <Suspense fallback={<LoadingState />}>
              {sessionError ? <ErrorState message={sessionError} retry={() => window.location.reload()} /> : ready ? reporterContent : <LoadingState />}
            </Suspense>
          </main>
        </div>
      </Boundary>
    );
  }

  // 2. Landing / Login View
  if (!isOfficerApp) {
    return <Boundary><Landing login={location.startsWith('/login')} /></Boundary>;
  }

  // 3. Officer Intelligence Console App Shell
  const part = location.split('?')[0].split('/')[2] || 'dashboard';
  const id = location.split('?')[0].split('/')[3] || 'CR-2026-00192';
  let content: any;

  switch (part) {
    case 'dashboard': content = <Dashboard />; break;
    case 'incoming': content = <IncomingReportsPage />; break;
    case 'case-review': content = <CaseReviewPage id={id} />; break;
    case 'cases': content = <Cases />; break;
    case 'new': content = <CreateCase />; break;
    case 'investigations':
      content = location.split('?')[0].split('/')[3]
        ? ((/^\d+$/.test(id)) ? <GraphExplorer initialTxId={id} /> : <Investigation key={id} id={id} />)
        : <Cases />;
      break;
    case 'graph': content = <GraphExplorer initialTxId={location.split('?')[0].split('/')[3] || '232629023'} />; break;
    case 'wallets': content = <Wallets />; break;
    case 'vasps': content = <Vasps />; break;
    case 'cross-chain': content = <CrossChain />; break;
    case 'patterns': content = <Patterns />; break;
    case 'alerts': content = <Alerts />; break;
    case 'reports': content = <Reports />; break;
    case 'api': content = <Api />; break;
    case 'settings': content = <SettingsPage />; break;
    case 'sources': content = <Sources />; break;
    case 'requests': content = <Requests />; break;
    default: content = <ErrorState message="This page does not exist." />;
  }

  return (
    <>
      <Boundary>
        <div className="app-shell">
          <aside className={`sidebar ${mobile ? 'is-open' : ''}`}>
            <a href="/app/dashboard" onClick={e => { e.preventDefault(); navigate('/app/dashboard'); }} className="brand">
              <div className="brand-mark"><Waypoints size={22} /></div>
              <div>CRYPTO-TRACE<em>INDIA</em><small>INTELLIGENCE CONSOLE</small></div>
            </a>

            <div className="workspace-select">
              <span className="workspace-avatar">{initials}</span>
              <span>
                {user?.name || 'Investigator Workspace'}
                <small>{user?.role === 'officer' || user?.role === 'official-investigator' ? 'CBI Officer' : 'Demo Analyst'} · isolated session</small>
              </span>
              <ShieldCheck size={14} />
            </div>

            <div className="nav-label">WORKSPACE</div>
            <nav>
              {navItems.map(([navPath, label, Icon]) => (
                <a
                  key={navPath}
                  href={`/app/${navPath}`}
                  onClick={e => { e.preventDefault(); navigate(`/app/${navPath}`); }}
                  className={part === navPath ? 'active' : ''}
                >
                  <Icon size={17} />
                  <span>{label}</span>
                  {navPath === 'incoming' && <span className="nav-dot" style={{ background: '#38bdf8' }} />}
                  {navPath === 'alerts' && <span className="nav-dot" />}
                  {navPath === 'investigations' && <small>TRACE</small>}
                </a>
              ))}
            </nav>

            <div className="nav-label system-label">SYSTEM</div>
            <nav>
              {([['sources', 'Data sources', Database], ['api', 'API documentation', Code2], ['settings', 'Settings & audit', Settings]] as any).map(([navPath, label, Icon]: any) => (
                <a
                  key={navPath}
                  href={`/app/${navPath}`}
                  onClick={e => { e.preventDefault(); navigate(`/app/${navPath}`); }}
                  className={part === navPath ? 'active' : ''}
                >
                  <Icon size={17} />
                  <span>{label}</span>
                </a>
              ))}
            </nav>

            <div className="sidebar-bottom">
              <div className="sidebar-demo">
                <span className="pulse-dot" />
                <div>
                  {user?.role === 'officer' || user?.role === 'official-investigator' ? 'SECURE OFFICER SESSION' : 'DEMO ENVIRONMENT'}
                  <small>{user?.role === 'officer' || user?.role === 'official-investigator' ? 'CBI Officer Audit Logged' : 'Synthetic Evidence'}</small>
                </div>
              </div>
              <button className="analyst-profile" onClick={handleLogout} title="Sign out of current workspace">
                <span className="profile-avatar">{initials}</span>
                <span>
                  {user?.name || 'Investigator'}
                  <small>Sign Out</small>
                </span>
                <LogOut size={15} />
              </button>
            </div>
          </aside>

          {mobile && <div className="sidebar-scrim" onClick={() => setMobile(false)} />}

          <div className="main-shell">
            <header className="app-header">
              <button className="mobile-menu icon-button" aria-label="Open menu" onClick={() => setMobile(v => !v)}>
                <Menu size={20} />
              </button>
              <div className="breadcrumb">
                <span>Workspace</span>
                <ChevronRight size={13} />
                <strong>
                  {part === 'new'
                    ? 'New investigation'
                    : part === 'case-review'
                    ? `Case Review (${id})`
                    : navItems.find(n => n[0] === part)?.[1] || part.replace('-', ' ')}
                </strong>
              </div>
              <button className="global-search" onClick={() => setPalette(true)}>
                <Search size={15} />
                <span>Search intelligence…</span>
                <kbd>⌘ K</kbd>
              </button>
              <Badge variant={user?.role === 'officer' || user?.role === 'official-investigator' ? 'success' : 'info'}>
                {user?.role === 'officer' || user?.role === 'official-investigator' ? 'CBI OFFICER ACCESS' : 'DEMO DATA'}
              </Badge>
              <button className="notification-button icon-button" aria-label="Open alerts" onClick={() => navigate('/app/alerts')}>
                <Bell size={18} />
                <i />
              </button>
              <div className="header-avatar">{initials}</div>
            </header>

            <main className="app-main">
              <Suspense fallback={<LoadingState />}>
                {sessionError ? <ErrorState message={sessionError} retry={() => window.location.reload()} /> : ready ? content : <LoadingState />}
              </Suspense>
            </main>

            <footer className="app-footer">
              <span><ShieldCheck size={13} /> Investigative intelligence · Human verification required</span>
              <button onClick={() => navigate('/app/sources')}>
                <Radio size={12} />DEMO STREAM<span>{stream?.message || 'Replaying synthetic investigation events'}</span>
              </button>
            </footer>
          </div>
        </div>
      </Boundary>

      {palette && <Palette close={() => setPalette(false)} />}
      {notice && (
        <div className={`toast ${notice.type || ''}`} role="status">
          {notice.type === 'error' ? <AlertCircle size={18} /> : <CheckCircle2 size={18} />}
          <span>{notice.message}</span>
          <button aria-label="Dismiss notification" onClick={() => setNotice(undefined)}><X size={15} /></button>
        </div>
      )}
    </>
  );
}
