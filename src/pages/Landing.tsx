import React, { useState } from 'react';
import {
  ArrowRight, ArrowUpRight, ShieldCheck, Network, GitBranch, Landmark, Fingerprint,
  FileCheck2, Search, Waypoints, ChevronRight, Scale, Layers3, LockKeyhole, Eye,
  EyeOff, KeyRound, Mail, User, Phone, CheckCircle2, AlertCircle, FileText, UserCheck, Inbox
} from 'lucide-react';
import { api, navigate } from '../api';
import { Button, Badge } from '../components/ui';

export default function Landing({ login = false }: { login?: boolean }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  // Mode: 'officer-login' | 'reporter-login' | 'reporter-register'
  const [authMode, setAuthMode] = useState<'officer-login' | 'reporter-login' | 'reporter-register'>('officer-login');

  // Form states
  const [email, setEmail] = useState('officer.sharma@cbi.gov.in');
  const [password, setPassword] = useState('Sharma@2026');
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  async function enterDemoInvestigator() {
    setBusy(true);
    setError('');
    try {
      await api('/auth/demo-officer', { method: 'POST', body: '{}' });
      navigate('/app/dashboard');
    } catch {
      try {
        await api('/auth/demo', { method: 'POST', body: '{}' });
        navigate('/app/dashboard');
      } catch (e: any) {
        setError(e.message);
        setBusy(false);
      }
    }
  }

  async function enterDemoReporter() {
    setBusy(true);
    setError('');
    try {
      await api('/auth/demo-reporter', { method: 'POST', body: '{}' });
      navigate('/reporter/dashboard');
    } catch (e: any) {
      setError(e.message);
      setBusy(false);
    }
  }

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      const res = await api('/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email, password })
      });
      if (res?.user?.role === 'reporter') {
        navigate('/reporter/dashboard');
      } else {
        navigate('/app/dashboard');
      }
    } catch (e: any) {
      setError(e.message || 'Authentication failed');
      setBusy(false);
    }
  }

  async function handleRegister(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      await api('/auth/register', {
        method: 'POST',
        body: JSON.stringify({ name, email, password, phone, role: 'reporter' })
      });
      navigate('/reporter/dashboard');
    } catch (e: any) {
      setError(e.message || 'Registration failed');
      setBusy(false);
    }
  }

  return (
    <div className="landing">
      {/* Navigation */}
      <header className="landing-nav">
        <a href="/" onClick={e => { e.preventDefault(); navigate('/'); }} className="brand">
          <div className="brand-mark"><Waypoints size={24} /></div>
          <div>CRYPTO-TRACE <em>INDIA</em><small>INVESTIGATION INTELLIGENCE</small></div>
        </a>
        <nav>
          <a href="#workflow">Investigation Workflow</a>
          <a href="#intelligence">Analytics &amp; DSA</a>
          <a href="#disclaimer">Project Disclosure</a>
        </nav>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          <Button variant="secondary" onClick={() => navigate('/reporter/submit')}>
            <FileText size={14} /> File Complaint
          </Button>
          <Button onClick={() => navigate('/login')}>
            <LockKeyhole size={14} /> Portal Sign In
          </Button>
        </div>
      </header>

      {/* Login / Registration Panel */}
      {login ? (
        <main className="login-panel" style={{ maxWidth: 480, margin: '40px auto' }}>
          <div className="brand-mark" style={{ background: 'linear-gradient(135deg, #087f94, #0b182b)', margin: '0 auto 12px' }}>
            <ShieldCheck size={32} />
          </div>

          {/* Mode Switcher Tabs */}
          <div style={{ display: 'flex', background: '#0a1726', borderRadius: 8, padding: 4, marginBottom: 20, border: '1px solid #1a2d42' }}>
            <button
              type="button"
              onClick={() => {
                setAuthMode('officer-login');
                setEmail('officer.sharma@cbi.gov.in');
                setPassword('Sharma@2026');
                setError('');
              }}
              style={{
                flex: 1, padding: '8px 10px', borderRadius: 6, fontSize: 12, fontWeight: 700,
                border: 'none', cursor: 'pointer', transition: 'all 0.15s',
                background: authMode === 'officer-login' ? '#087f94' : 'transparent',
                color: authMode === 'officer-login' ? '#fff' : '#94a3b8'
              }}
            >
              CBI Officer Sign In
            </button>
            <button
              type="button"
              onClick={() => {
                setAuthMode('reporter-login');
                setEmail('priya.nair@example.in');
                setPassword('Reporter@2026');
                setError('');
              }}
              style={{
                flex: 1, padding: '8px 10px', borderRadius: 6, fontSize: 12, fontWeight: 700,
                border: 'none', cursor: 'pointer', transition: 'all 0.15s',
                background: authMode === 'reporter-login' ? '#087f94' : 'transparent',
                color: authMode === 'reporter-login' ? '#fff' : '#94a3b8'
              }}
            >
              Citizen Sign In
            </button>
            <button
              type="button"
              onClick={() => {
                setAuthMode('reporter-register');
                setEmail('');
                setPassword('');
                setError('');
              }}
              style={{
                flex: 1, padding: '8px 10px', borderRadius: 6, fontSize: 12, fontWeight: 700,
                border: 'none', cursor: 'pointer', transition: 'all 0.15s',
                background: authMode === 'reporter-register' ? '#087f94' : 'transparent',
                color: authMode === 'reporter-register' ? '#fff' : '#94a3b8'
              }}
            >
              New Citizen
            </button>
          </div>

          {/* Disclaimer for CBI Officer */}
          <div style={{ fontSize: 11, color: '#94a3b8', background: '#08121f', padding: '8px 12px', borderRadius: 6, border: '1px solid #14273b', marginBottom: 16, lineHeight: 1.45 }}>
            <strong style={{ color: '#38bdf8' }}>Role Label Disclosure:</strong> &ldquo;CBI Officer&rdquo; is a simulation role label for cryptocurrency fraud investigation workflows. Not officially connected to CBI or government authorities.
          </div>

          {/* Forms */}
          {authMode === 'reporter-register' ? (
            <form onSubmit={handleRegister} style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: 12, textAlign: 'left' }}>
              <div>
                <label style={{ display: 'block', fontSize: 11, color: '#94a3b8', marginBottom: 4, fontWeight: 600 }}>
                  <User size={12} style={{ display: 'inline', marginRight: 4, verticalAlign: 'middle' }} /> Full Legal Name
                </label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={e => setName(e.target.value)}
                  placeholder="e.g. Priya Nair"
                  style={{ width: '100%', padding: '10px 12px', background: '#0a1421', border: '1px solid #294052', borderRadius: 6, color: '#fff', fontSize: 13 }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: 11, color: '#94a3b8', marginBottom: 4, fontWeight: 600 }}>
                  <Mail size={12} style={{ display: 'inline', marginRight: 4, verticalAlign: 'middle' }} /> Email Address
                </label>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  placeholder="name@example.com"
                  style={{ width: '100%', padding: '10px 12px', background: '#0a1421', border: '1px solid #294052', borderRadius: 6, color: '#fff', fontSize: 13 }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: 11, color: '#94a3b8', marginBottom: 4, fontWeight: 600 }}>
                  <Phone size={12} style={{ display: 'inline', marginRight: 4, verticalAlign: 'middle' }} /> Contact Phone (Optional)
                </label>
                <input
                  type="tel"
                  value={phone}
                  onChange={e => setPhone(e.target.value)}
                  placeholder="+91 98765 43210"
                  style={{ width: '100%', padding: '10px 12px', background: '#0a1421', border: '1px solid #294052', borderRadius: 6, color: '#fff', fontSize: 13 }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: 11, color: '#94a3b8', marginBottom: 4, fontWeight: 600 }}>
                  <KeyRound size={12} style={{ display: 'inline', marginRight: 4, verticalAlign: 'middle' }} /> Password
                </label>
                <input
                  type="password"
                  required
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder="Create secure password"
                  style={{ width: '100%', padding: '10px 12px', background: '#0a1421', border: '1px solid #294052', borderRadius: 6, color: '#fff', fontSize: 13 }}
                />
              </div>

              {error && <div style={{ padding: '8px 12px', background: '#450a0a', border: '1px solid #991b1b', color: '#fca5a5', borderRadius: 6, fontSize: 11 }}>{error}</div>}

              <Button type="submit" disabled={busy} style={{ width: '100%', padding: '12px', justifyContent: 'center', marginTop: 8 }}>
                {busy ? 'Registering…' : 'Register as Citizen Reporter'} <ArrowRight size={16} />
              </Button>
            </form>
          ) : (
            <form onSubmit={handleLogin} style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: 12, textAlign: 'left' }}>
              <div>
                <label style={{ display: 'block', fontSize: 11, color: '#94a3b8', marginBottom: 4, fontWeight: 600 }}>
                  <Mail size={12} style={{ display: 'inline', marginRight: 4, verticalAlign: 'middle' }} />
                  {authMode === 'officer-login' ? 'CBI Investigator Email' : 'Citizen Email Address'}
                </label>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  placeholder={authMode === 'officer-login' ? 'officer.sharma@cbi.gov.in' : 'priya.nair@example.in'}
                  style={{ width: '100%', padding: '10px 12px', background: '#0a1421', border: '1px solid #294052', borderRadius: 6, color: '#fff', fontSize: 13 }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: 11, color: '#94a3b8', marginBottom: 4, fontWeight: 600 }}>
                  <KeyRound size={12} style={{ display: 'inline', marginRight: 4, verticalAlign: 'middle' }} /> Password
                </label>
                <div style={{ position: 'relative' }}>
                  <input
                    type={showPassword ? 'text' : 'password'}
                    required
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    placeholder="••••••••"
                    style={{ width: '100%', padding: '10px 38px 10px 12px', background: '#0a1421', border: '1px solid #294052', borderRadius: 6, color: '#fff', fontSize: 13 }}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(v => !v)}
                    style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: '#64748b', cursor: 'pointer', padding: 4 }}
                  >
                    {showPassword ? <EyeOff size={15} /> : <Eye size={15} />}
                  </button>
                </div>
              </div>

              {error && <div style={{ padding: '8px 12px', background: '#450a0a', border: '1px solid #991b1b', color: '#fca5a5', borderRadius: 6, fontSize: 11 }}>{error}</div>}

              <Button type="submit" disabled={busy} style={{ width: '100%', padding: '12px', justifyContent: 'center', marginTop: 8 }}>
                {busy ? 'Authenticating…' : authMode === 'officer-login' ? 'Sign In as CBI Officer' : 'Sign In as Reporter'}
                <ArrowRight size={16} />
              </Button>
            </form>
          )}

          {/* Quick 1-Click Demo Buttons */}
          <div style={{ marginTop: 20, paddingTop: 16, borderTop: '1px solid #1a2d42' }}>
            <span style={{ fontSize: 11, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.8px', display: 'block', marginBottom: 10, textAlign: 'center' }}>
              Instant One-Click Demo Access
            </span>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <Button type="button" variant="secondary" disabled={busy} onClick={enterDemoInvestigator} style={{ width: '100%', padding: '10px', justifyContent: 'center', fontSize: 12 }}>
                <ShieldCheck size={14} color="#38bdf8" /> Demo CBI Officer (Insp. Rajesh Sharma)
              </Button>
              <Button type="button" variant="secondary" disabled={busy} onClick={enterDemoReporter} style={{ width: '100%', padding: '10px', justifyContent: 'center', fontSize: 12 }}>
                <UserCheck size={14} color="#4fd7c1" /> Demo Citizen Reporter (Priya Nair)
              </Button>
            </div>
          </div>
        </main>
      ) : (
        /* Standard Landing Page Hero & Content */
        <main>
          <section className="hero">
            <div className="hero-content">
              <Badge variant="primary">END-TO-END CRIME REPORTING &amp; FORENSIC GRAPH ANALYTICS</Badge>
              <h1>Cryptocurrency Fraud Detection &amp; Case Management</h1>
              <p>
                From citizen complaint filing to forensic transaction graph tracing. Connect on-chain evidence with legal Section 91 information requests and explainable risk scores powered by DSA graph algorithms and the Elliptic Bitcoin dataset.
              </p>

              <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap', marginTop: 24 }}>
                <Button onClick={() => navigate('/reporter/submit')} style={{ padding: '14px 22px', fontSize: 14 }}>
                  <FileText size={16} /> File Cybercrime Complaint
                </Button>
                <Button variant="secondary" onClick={enterDemoInvestigator} style={{ padding: '14px 22px', fontSize: 14 }}>
                  <ShieldCheck size={16} color="#38bdf8" /> Enter CBI Officer Console <ArrowRight size={16} />
                </Button>
                <Button variant="secondary" onClick={enterDemoReporter} style={{ padding: '14px 20px', fontSize: 14 }}>
                  <UserCheck size={16} color="#4fd7c1" /> Reporter Tracking Portal
                </Button>
              </div>
            </div>
          </section>

          {/* Workflow Section */}
          <section id="workflow" style={{ padding: '48px 32px', maxWidth: 1100, margin: '0 auto' }}>
            <div style={{ textAlign: 'center', marginBottom: 36 }}>
              <span style={{ fontSize: 12, color: '#38bdf8', fontWeight: 700, letterSpacing: '1.5px' }}>END-TO-END LIFECYCLE</span>
              <h2 style={{ fontSize: 28, color: '#fff', margin: '8px 0' }}>Role-Based Investigation Workflow</h2>
              <p style={{ color: '#94a3b8', fontSize: 14, maxWidth: 600, margin: '0 auto' }}>
                Strict role-based access control protecting complainant privacy while giving law enforcement powerful forensic graph tracing tools.
              </p>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 20 }}>
              <div style={{ background: '#0a1624', padding: 22, borderRadius: 8, border: '1px solid #1a2d42' }}>
                <div style={{ width: 36, height: 36, borderRadius: '50%', background: 'rgba(56, 189, 248, 0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#38bdf8', fontWeight: 800, marginBottom: 14 }}>1</div>
                <h3 style={{ fontSize: 16, color: '#fff', margin: '0 0 8px' }}>Citizen Complaint Filing</h3>
                <p style={{ fontSize: 12.5, color: '#94a3b8', lineHeight: 1.5, margin: 0 }}>
                  Victims submit incident details, fraudulent wallet addresses, transaction hashes, and upload bank statements/evidence. A unique Case ID (<code>CR-2026-XXXXX</code>) is generated immediately.
                </p>
              </div>

              <div style={{ background: '#0a1624', padding: 22, borderRadius: 8, border: '1px solid #1a2d42' }}>
                <div style={{ width: 36, height: 36, borderRadius: '50%', background: 'rgba(234, 179, 8, 0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#eab308', fontWeight: 800, marginBottom: 14 }}>2</div>
                <h3 style={{ fontSize: 16, color: '#fff', margin: '0 0 8px' }}>CBI Officer Queue &amp; Triage</h3>
                <p style={{ fontSize: 12.5, color: '#94a3b8', lineHeight: 1.5, margin: 0 }}>
                  Officers review incoming reports, verify preliminary facts, accept or formally reject with reason, assign cases to specialized investigators, or request additional documentation from the citizen.
                </p>
              </div>

              <div style={{ background: '#0a1624', padding: 22, borderRadius: 8, border: '1px solid #1a2d42' }}>
                <div style={{ width: 36, height: 36, borderRadius: '50%', background: 'rgba(79, 215, 193, 0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#4fd7c1', fontWeight: 800, marginBottom: 14 }}>3</div>
                <h3 style={{ fontSize: 16, color: '#fff', margin: '0 0 8px' }}>DSA Graph Forensics</h3>
                <p style={{ fontSize: 12.5, color: '#94a3b8', lineHeight: 1.5, margin: 0 }}>
                  Run BFS/DFS multi-hop traversal, Dijkstra shortest path, and 6-parameter Investigation Readiness Scoring on the 203,769-node Elliptic Bitcoin transaction graph, preserving confidential internal notes.
                </p>
              </div>
            </div>
          </section>

          {/* Legal / Project Disclosure */}
          <section id="disclaimer" style={{ padding: '32px', maxWidth: 1100, margin: '0 auto 40px', background: '#08121f', borderRadius: 8, border: '1px solid #15273b' }}>
            <div style={{ display: 'flex', gap: 14, alignItems: 'flex-start' }}>
              <Scale size={24} color="#38bdf8" style={{ flexShrink: 0, marginTop: 2 }} />
              <div>
                <h4 style={{ margin: '0 0 6px', fontSize: 14, color: '#fff' }}>Academic &amp; Forensic Research Disclosure</h4>
                <p style={{ margin: 0, fontSize: 12, color: '#8ca6b8', lineHeight: 1.5 }}>
                  <strong>CBI Officer</strong> is used strictly as a project role label within this cryptocurrency fraud detection and analysis demonstrator. This software is not connected to, endorsed by, or operated on behalf of the Central Bureau of Investigation or any government agency. The research utilizes the Elliptic Bitcoin dataset and deterministic forensic simulation fixtures.
                </p>
              </div>
            </div>
          </section>
        </main>
      )}
    </div>
  );
}
