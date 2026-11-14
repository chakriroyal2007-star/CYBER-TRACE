import React, { useState } from 'react';
import {
  ArrowRight, ArrowUpRight, ShieldCheck, Network, GitBranch, Landmark, Fingerprint,
  FileCheck2, Search, Waypoints, ChevronRight, Scale, Layers3, LockKeyhole, Eye,
  EyeOff, KeyRound, Mail, User, Phone, CheckCircle2, AlertCircle, FileText, UserCheck, Play
} from 'lucide-react';
import { api, navigate } from '../api';
import { Button, Badge } from '../components/ui';

export default function Landing({ login = false }: { login?: boolean }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  // Primary Role: 'reporter' (Citizen / Reporter) vs 'officer' (CBI / Cyber Crime Officer)
  const [authRole, setAuthRole] = useState<'reporter' | 'officer'>(() => {
    if (typeof window !== 'undefined') {
      const q = new URLSearchParams(window.location.search);
      if (q.get('role') === 'reporter') return 'reporter';
      if (q.get('role') === 'officer') return 'officer';
    }
    return 'officer';
  });

  // Action Mode: 'signin' | 'signup'
  const [authTab, setAuthTab] = useState<'signin' | 'signup'>(() => {
    if (typeof window !== 'undefined') {
      const q = new URLSearchParams(window.location.search);
      if (q.get('mode') === 'signup' || window.location.pathname.includes('/register')) return 'signup';
    }
    return 'signin';
  });

  // Form states
  const [email, setEmail] = useState('officer.sharma@cbi.gov.in');
  const [password, setPassword] = useState('Sharma@2026');
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [officerCode, setOfficerCode] = useState('dsaproject');
  const [badgeNumber, setBadgeNumber] = useState('CBI-CY-8821');
  const [agency, setAgency] = useState('CBI Cyber Crime Division (Project Simulation)');
  const [showPassword, setShowPassword] = useState(false);

  // Switch between roles and adapt default presets
  function switchRole(role: 'reporter' | 'officer') {
    setAuthRole(role);
    setError('');
    if (role === 'reporter') {
      if (authTab === 'signin') {
        setEmail('priya.nair@example.in');
        setPassword('Reporter@2026');
      } else {
        setEmail('');
        setPassword('');
        setName('');
        setPhone('');
      }
    } else {
      if (authTab === 'signin') {
        setEmail('officer.sharma@cbi.gov.in');
        setPassword('Sharma@2026');
      } else {
        setEmail('');
        setPassword('');
        setName('');
        setOfficerCode('dsaproject');
        setBadgeNumber('CBI-CY-8821');
        setAgency('CBI Cyber Crime Division (Project Simulation)');
      }
    }
  }

  // Switch between Sign In and Sign Up tabs
  function switchTab(tab: 'signin' | 'signup') {
    setAuthTab(tab);
    setError('');
    if (tab === 'signin') {
      if (authRole === 'reporter') {
        setEmail('priya.nair@example.in');
        setPassword('Reporter@2026');
      } else {
        setEmail('officer.sharma@cbi.gov.in');
        setPassword('Sharma@2026');
      }
    } else {
      setEmail('');
      setPassword('');
      setName('');
      setPhone('');
      if (authRole === 'officer') {
        setOfficerCode('dsaproject');
        setBadgeNumber('CBI-CY-8821');
        setAgency('CBI Cyber Crime Division (Project Simulation)');
      }
    }
  }

  async function enterDemoInvestigator() {
    setBusy(true);
    setError('');
    try {
      const res = await api('/auth/demo-officer', { method: 'POST', body: '{}' });
      if (res?.token && typeof localStorage !== 'undefined') localStorage.setItem('ct_token', res.token);
      if (res?.user && typeof localStorage !== 'undefined') localStorage.setItem('ct_user', JSON.stringify(res.user));
      navigate('/app/dashboard');
    } catch {
      try {
        const res = await api('/auth/demo', { method: 'POST', body: '{}' });
        if (res?.token && typeof localStorage !== 'undefined') localStorage.setItem('ct_token', res.token);
        if (res?.user && typeof localStorage !== 'undefined') localStorage.setItem('ct_user', JSON.stringify(res.user));
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
      const res = await api('/auth/demo-reporter', { method: 'POST', body: '{}' });
      if (res?.token && typeof localStorage !== 'undefined') localStorage.setItem('ct_token', res.token);
      if (res?.user && typeof localStorage !== 'undefined') localStorage.setItem('ct_user', JSON.stringify(res.user));
      navigate('/reporter/dashboard');
    } catch (e: any) {
      setError(e.message);
      setBusy(false);
    }
  }

  async function enterDemoSupervisor() {
    setBusy(true);
    setError('');
    try {
      const res = await api('/auth/demo-supervisor', { method: 'POST', body: '{}' });
      if (res?.token && typeof localStorage !== 'undefined') localStorage.setItem('ct_token', res.token);
      if (res?.user && typeof localStorage !== 'undefined') localStorage.setItem('ct_user', JSON.stringify(res.user));
      navigate('/app/dashboard');
    } catch (e: any) {
      setError(e.message);
      setBusy(false);
    }
  }

  async function enterDemoAdmin() {
    setBusy(true);
    setError('');
    try {
      const res = await api('/auth/demo-admin', { method: 'POST', body: '{}' });
      if (res?.token && typeof localStorage !== 'undefined') localStorage.setItem('ct_token', res.token);
      if (res?.user && typeof localStorage !== 'undefined') localStorage.setItem('ct_user', JSON.stringify(res.user));
      navigate('/app/dashboard');
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
        body: JSON.stringify({ email, password, role: authRole })
      });
      if (res?.token && typeof localStorage !== 'undefined') {
        localStorage.setItem('ct_token', res.token);
      }
      if (res?.user && typeof localStorage !== 'undefined') {
        localStorage.setItem('ct_user', JSON.stringify(res.user));
      }
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
      const payload: any = {
        name: name.trim(),
        email: email.trim(),
        password,
        phone: phone.trim(),
        role: authRole
      };
      if (authRole === 'officer') {
        payload.officerCode = officerCode.trim() || 'dsaproject';
        payload.badgeNumber = badgeNumber.trim() || 'CBI-CY-8821';
        payload.agency = agency.trim() || 'CBI Cyber Crime Division (Project Simulation)';
      }
      const res = await api('/auth/register', {
        method: 'POST',
        body: JSON.stringify(payload)
      });
      if (res?.token && typeof localStorage !== 'undefined') {
        localStorage.setItem('ct_token', res.token);
      }
      if (res?.user && typeof localStorage !== 'undefined') {
        localStorage.setItem('ct_user', JSON.stringify(res.user));
      }
      if (authRole === 'reporter') {
        navigate('/reporter/dashboard');
      } else {
        navigate('/app/dashboard');
      }
    } catch (e: any) {
      setError(e.message || 'Registration failed');
      setBusy(false);
    }
  }

  return (
    <div className="landing">
      {/* Navigation matching original screenshot */}
      <header className="landing-nav">
        <a href="/" onClick={e => { e.preventDefault(); navigate('/'); }} className="brand">
          <div className="brand-mark"><Waypoints size={24} /></div>
          <div>CRYPTO-TRACE <em>INDIA</em><small>INVESTIGATION INTELLIGENCE</small></div>
        </a>

        <nav>
          <a href="#approach">Our approach</a>
          <a href="#intelligence">Intelligence</a>
          <a href="#architecture">Architecture</a>
          <a href="/scam-analyzer" onClick={e => { e.preventDefault(); navigate('/scam-analyzer'); }} style={{ color: '#38bdf8' }}>
            AI Scam Scanner
          </a>
          <a href="/demo" onClick={e => { e.preventDefault(); navigate('/demo'); }} style={{ color: '#62cbb9' }}>
            Interactive Demo
          </a>
        </nav>

        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          <Button variant="secondary" onClick={() => { switchRole('reporter'); switchTab('signup'); navigate('/login?role=reporter&mode=signup'); }}>
            <FileText size={14} color="#62cbb9" /> Citizen Portal
          </Button>
          <Button variant="secondary" onClick={() => { switchRole('officer'); switchTab('signin'); navigate('/login?role=officer&mode=signin'); }}>
            <LockKeyhole size={14} color="#38bdf8" /> Officer Login
          </Button>
          <Button onClick={enterDemoInvestigator} disabled={busy}>
            Enter demo console <ArrowUpRight size={15} />
          </Button>
        </div>
      </header>

      {/* Login / Registration Panel */}
      {login ? (
        <main className="login-panel" style={{ maxWidth: 520, margin: '36px auto', background: '#07111e', border: '1px solid #1a2f47', borderRadius: 12, padding: '28px 24px', boxShadow: '0 20px 40px rgba(0,0,0,0.45)' }}>
          <div className="brand-mark" style={{ background: 'linear-gradient(135deg, #087f94, #0b182b)', margin: '0 auto 12px' }}>
            {authRole === 'officer' ? <ShieldCheck size={32} color="#62cbb9" /> : <UserCheck size={32} color="#38bdf8" />}
          </div>

          <div style={{ textAlign: 'center', marginBottom: 18 }}>
            <div className="eyebrow" style={{ letterSpacing: '1.5px', color: authRole === 'officer' ? '#62cbb9' : '#38bdf8', fontWeight: 700, justifyContent: 'center' }}>
              {authRole === 'officer' ? 'LAW ENFORCEMENT & INVESTIGATION PORTAL' : 'CITIZEN FRAUD REPORTING & RECOVERY PORTAL'}
            </div>
            <h1 style={{ fontSize: 24, margin: '8px 0 4px', color: '#fff' }}>
              {authRole === 'officer'
                ? (authTab === 'signin' ? 'CBI Officer Sign In' : 'Register CBI Investigator')
                : (authTab === 'signin' ? 'Citizen Complainant Sign In' : 'New Citizen Registration')}
            </h1>
            <p style={{ fontSize: 12, color: '#8ca6b8', margin: 0 }}>
              {authRole === 'officer'
                ? 'Access evidence-grounded multi-hop blockchain tracing, ML risk scoring and FIR dossiers'
                : 'Report UPI & cryptocurrency fraud, track filed complaints and monitor asset recovery'}
            </p>
          </div>

          {/* Primary Role Selector: Citizen vs CBI Officer */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6, background: '#0a1726', borderRadius: 8, padding: 4, marginBottom: 12, border: '1px solid #1a2d42' }}>
            <button
              type="button"
              onClick={() => switchRole('reporter')}
              style={{
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                padding: '9px 12px', borderRadius: 6, fontSize: 12, fontWeight: 700,
                border: 'none', cursor: 'pointer', transition: 'all 0.15s',
                background: authRole === 'reporter' ? '#087f94' : 'transparent',
                color: authRole === 'reporter' ? '#fff' : '#94a3b8'
              }}
            >
              <User size={14} /> Citizen / Complainant
            </button>
            <button
              type="button"
              onClick={() => switchRole('officer')}
              style={{
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                padding: '9px 12px', borderRadius: 6, fontSize: 12, fontWeight: 700,
                border: 'none', cursor: 'pointer', transition: 'all 0.15s',
                background: authRole === 'officer' ? '#087f94' : 'transparent',
                color: authRole === 'officer' ? '#fff' : '#94a3b8'
              }}
            >
              <ShieldCheck size={14} /> CBI Crime Officer
            </button>
          </div>

          {/* Sub-Action Selector: Sign In vs Sign Up */}
          <div style={{ display: 'flex', background: '#050c17', borderRadius: 6, padding: 3, marginBottom: 16, border: '1px solid #142436' }}>
            <button
              type="button"
              onClick={() => switchTab('signin')}
              style={{
                flex: 1, padding: '7px 8px', borderRadius: 5, fontSize: 11.5, fontWeight: 700,
                border: 'none', cursor: 'pointer', transition: 'all 0.15s',
                background: authTab === 'signin' ? '#1a2f47' : 'transparent',
                color: authTab === 'signin' ? '#38bdf8' : '#64748b'
              }}
            >
              Sign In
            </button>
            <button
              type="button"
              onClick={() => switchTab('signup')}
              style={{
                flex: 1, padding: '7px 8px', borderRadius: 5, fontSize: 11.5, fontWeight: 700,
                border: 'none', cursor: 'pointer', transition: 'all 0.15s',
                background: authTab === 'signup' ? '#1a2f47' : 'transparent',
                color: authTab === 'signup' ? '#62cbb9' : '#64748b'
              }}
            >
              Sign Up (New Account)
            </button>
          </div>

          {/* Role label disclosure */}
          {authRole === 'officer' && (
            <div style={{ fontSize: 11, color: '#94a3b8', background: '#08121f', padding: '8px 12px', borderRadius: 6, border: '1px solid #14273b', marginBottom: 14, lineHeight: 1.45 }}>
              <strong style={{ color: '#62cbb9' }}>Official Simulation Notice:</strong> &ldquo;CBI Officer&rdquo; is a simulation role label for cybersecurity and cryptocurrency fraud tracking. For registration, the department code is <code style={{ color: '#38bdf8', background: '#0d1f33', padding: '1px 4px', borderRadius: 3 }}>dsaproject</code>.
            </div>
          )}

          {/* Active Form */}
          {authTab === 'signup' ? (
            <form onSubmit={handleRegister} style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: 12, textAlign: 'left' }}>
              <div>
                <label style={{ display: 'block', fontSize: 11, color: '#94a3b8', marginBottom: 4, fontWeight: 600 }}>
                  <User size={12} style={{ display: 'inline', marginRight: 4, verticalAlign: 'middle' }} />
                  {authRole === 'officer' ? 'Full Official Name & Rank' : 'Full Legal Name'}
                </label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={e => setName(e.target.value)}
                  placeholder={authRole === 'officer' ? 'e.g. Insp. Rajesh Sharma' : 'e.g. Priya Nair'}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: 11, color: '#94a3b8', marginBottom: 4, fontWeight: 600 }}>
                  <Mail size={12} style={{ display: 'inline', marginRight: 4, verticalAlign: 'middle' }} />
                  {authRole === 'officer' ? 'Official Email Address (.gov.in / agency)' : 'Personal Email Address'}
                </label>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  placeholder={authRole === 'officer' ? 'officer.sharma@cbi.gov.in' : 'priya.nair@example.in'}
                />
              </div>

              {authRole === 'reporter' ? (
                <div>
                  <label style={{ display: 'block', fontSize: 11, color: '#94a3b8', marginBottom: 4, fontWeight: 600 }}>
                    <Phone size={12} style={{ display: 'inline', marginRight: 4, verticalAlign: 'middle' }} /> Contact Phone (Optional for SMS alerts)
                  </label>
                  <input
                    type="tel"
                    value={phone}
                    onChange={e => setPhone(e.target.value)}
                    placeholder="+91 98765 43210"
                  />
                </div>
              ) : (
                <>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                    <div>
                      <label style={{ display: 'block', fontSize: 11, color: '#94a3b8', marginBottom: 4, fontWeight: 600 }}>
                        <Landmark size={12} style={{ display: 'inline', marginRight: 4, verticalAlign: 'middle' }} /> Agency / Unit
                      </label>
                      <input
                        type="text"
                        required
                        value={agency}
                        onChange={e => setAgency(e.target.value)}
                        placeholder="CBI Cyber Crime Division"
                      />
                    </div>
                    <div>
                      <label style={{ display: 'block', fontSize: 11, color: '#94a3b8', marginBottom: 4, fontWeight: 600 }}>
                        <Fingerprint size={12} style={{ display: 'inline', marginRight: 4, verticalAlign: 'middle' }} /> Badge / ID Number
                      </label>
                      <input
                        type="text"
                        required
                        value={badgeNumber}
                        onChange={e => setBadgeNumber(e.target.value)}
                        placeholder="CBI-CY-8821"
                      />
                    </div>
                  </div>

                  <div>
                    <label style={{ display: 'block', fontSize: 11, color: '#94a3b8', marginBottom: 4, fontWeight: 600 }}>
                      <LockKeyhole size={12} style={{ display: 'inline', marginRight: 4, verticalAlign: 'middle' }} /> Department Authorization Code
                    </label>
                    <input
                      type="text"
                      required
                      value={officerCode}
                      onChange={e => setOfficerCode(e.target.value)}
                      placeholder="Enter 'dsaproject' for academic simulation"
                    />
                    <small style={{ fontSize: 10, color: '#62cbb9', display: 'block', marginTop: 3 }}>
                      Academic Verification Code: <code>dsaproject</code>
                    </small>
                  </div>
                </>
              )}

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
                    placeholder="Create secure password (min 4 chars)"
                    style={{ paddingRight: 38 }}
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

              {error && <div className="error-text">{error}</div>}

              <Button type="submit" disabled={busy} style={{ width: '100%', padding: '12px', justifyContent: 'center', marginTop: 6 }}>
                {busy ? 'Registering…' : authRole === 'officer' ? 'Register CBI Officer Profile' : 'Register Citizen Complainant'}
                <ArrowRight size={16} />
              </Button>

              <div style={{ textAlign: 'center', marginTop: 6 }}>
                <button
                  type="button"
                  onClick={() => switchTab('signin')}
                  style={{ background: 'none', border: 'none', color: '#38bdf8', fontSize: 11.5, cursor: 'pointer', textDecoration: 'underline' }}
                >
                  Already have an account? Sign In here
                </button>
              </div>
            </form>
          ) : (
            <form onSubmit={handleLogin} style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: 12, textAlign: 'left' }}>
              <div>
                <label style={{ display: 'block', fontSize: 11, color: '#94a3b8', marginBottom: 4, fontWeight: 600 }}>
                  <Mail size={12} style={{ display: 'inline', marginRight: 4, verticalAlign: 'middle' }} />
                  {authRole === 'officer' ? 'CBI Investigator Email Address' : 'Citizen Email Address'}
                </label>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  placeholder={authRole === 'officer' ? 'officer.sharma@cbi.gov.in' : 'priya.nair@example.in'}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: 11, color: '#94a3b8', marginBottom: 4, fontWeight: 600 }}>
                  <KeyRound size={12} style={{ display: 'inline', marginRight: 4, verticalAlign: 'middle' }} /> Password / Access Key
                </label>
                <div style={{ position: 'relative' }}>
                  <input
                    type={showPassword ? 'text' : 'password'}
                    required
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    placeholder="••••••••"
                    style={{ paddingRight: 38 }}
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

              {error && <div className="error-text">{error}</div>}

              <Button type="submit" disabled={busy} style={{ width: '100%', padding: '12px', justifyContent: 'center', marginTop: 6 }}>
                {busy ? 'Authenticating…' : authRole === 'officer' ? 'Sign In as CBI Officer' : 'Sign In as Citizen Reporter'}
                <ArrowRight size={16} />
              </Button>

              <div style={{ textAlign: 'center', marginTop: 6 }}>
                <button
                  type="button"
                  onClick={() => switchTab('signup')}
                  style={{ background: 'none', border: 'none', color: '#62cbb9', fontSize: 11.5, cursor: 'pointer', textDecoration: 'underline' }}
                >
                  {authRole === 'officer' ? "Don't have an officer account? Register here" : "Don't have a citizen account? Register here"}
                </button>
              </div>
            </form>
          )}

          {/* Quick 1-Click Instant Demo Access */}
          <div style={{ marginTop: 20, paddingTop: 16, borderTop: '1px solid #1a2d42' }}>
            <span style={{ fontSize: 10.5, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.8px', display: 'block', marginBottom: 10, textAlign: 'center' }}>
              One-Click Instant Demo Credentials
            </span>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
              <Button type="button" variant="secondary" disabled={busy} onClick={enterDemoInvestigator} style={{ padding: '8px 10px', justifyContent: 'center', fontSize: 11 }}>
                <ShieldCheck size={13} color="#62cbb9" /> Insp. Sharma (Officer)
              </Button>
              <Button type="button" variant="secondary" disabled={busy} onClick={enterDemoReporter} style={{ padding: '8px 10px', justifyContent: 'center', fontSize: 11 }}>
                <UserCheck size={13} color="#70c9b8" /> Priya Nair (Citizen)
              </Button>
              <Button type="button" variant="secondary" disabled={busy} onClick={enterDemoSupervisor} style={{ padding: '8px 10px', justifyContent: 'center', fontSize: 11 }}>
                <ShieldCheck size={13} color="#38bdf8" /> SP Rathore (Supervisor)
              </Button>
              <Button type="button" variant="secondary" disabled={busy} onClick={enterDemoAdmin} style={{ padding: '8px 10px', justifyContent: 'center', fontSize: 11 }}>
                <ShieldCheck size={13} color="#f59e0b" /> Dr. Roy (Director)
              </Button>
            </div>
          </div>
        </main>
      ) : (
        /* The Exact Original Homepage Layout as in Screenshot 1 */
        <>
          <main className="landing-hero">
            <div className="hero-copy">
              <div className="eyebrow">
                <span className="tiny-square" /> COMPLAINT → INTELLIGENCE → ACTION
              </div>
              <h1>
                From reported wallet<br />
                to <span>actionable<br className="hero-break" /> intelligence.</span>
              </h1>
              <p>
                Evidence-backed blockchain intelligence for cybercrime investigations. Trace the flow, connect related complaints, and identify the next actionable lead.
              </p>

              {/* Action buttons including new requested entrypoints */}
              <div className="hero-buttons" style={{ flexWrap: 'wrap', gap: 10 }}>
                <Button disabled={busy} onClick={enterDemoInvestigator} style={{ padding: '12px 18px' }}>
                  Start investigation <ArrowRight size={16} />
                </Button>
                <Button variant="secondary" disabled={busy} onClick={() => navigate('/app/incoming')} style={{ padding: '12px 16px' }}>
                  Explore demo case <ArrowUpRight size={16} />
                </Button>
                <Button variant="secondary" onClick={() => navigate('/reporter/submit')} style={{ padding: '12px 16px' }}>
                  <FileText size={15} color="#70c9b8" /> Citizen Reporter
                </Button>
                <Button variant="secondary" onClick={() => navigate('/demo')} style={{ padding: '12px 16px' }}>
                  <Play size={14} fill="#62cbb9" color="#62cbb9" /> Interactive Demo
                </Button>
              </div>

              {error && <p className="error-text">{error}</p>}

              <div className="hero-meta">
                <span><ShieldCheck size={14} /> Evidence you can inspect</span>
                <span><Layers3 size={14} /> Cross-chain by design</span>
              </div>
            </div>

            {/* Right side: The forensic console visualizer matching Screenshot 1 exactly */}
            <div className="hero-console">
              <div className="console-top">
                <span><i /><i /><i /></span>
                <span>INVESTIGATION WORKSPACE</span>
                <Badge>DEMO DATA</Badge>
              </div>
              <div className="console-case">
                <div>
                  <small>CASE CR-2026-00192</small>
                  <h3>Follow the evidence.</h3>
                </div>
                <Badge variant="danger">HIGH RISK</Badge>
              </div>
              <div className="hero-network">
                <div className="hero-chain eth">ETHEREUM</div>
                <div className="hero-chain polygon">POLYGON</div>
                <svg viewBox="0 0 540 300">
                  <defs>
                    <linearGradient id="flowStroke">
                      <stop stopColor="#74a1d5" />
                      <stop offset="1" stopColor="#55cbb9" />
                    </linearGradient>
                  </defs>
                  <path className="path-major" d="M65 145L190 145L295 78L425 145L490 145" />
                  <path d="M190 145L245 239M190 145L148 44M425 145L398 247M295 78L330 20" />
                  <circle cx="245" cy="239" r="7" />
                  <circle cx="148" cy="44" r="7" />
                  <circle cx="398" cy="247" r="7" />
                  <circle cx="330" cy="20" r="5" />
                </svg>
                <div className="hnode n1">
                  <span><Search size={20} /></span>
                  <strong>Reported wallet</strong>
                  <small>₹8,12,450</small>
                </div>
                <div className="hnode n2">
                  <span><Network size={20} /></span>
                  <strong>Intermediary</strong>
                </div>
                <div className="hnode n3">
                  <span><GitBranch size={20} /></span>
                  <strong>Bridge</strong>
                </div>
                <div className="hnode n4">
                  <span><Landmark size={22} /></span>
                  <strong>VASP-X</strong>
                  <small>Candidate exit</small>
                </div>
                <div className="network-label">CROSS-CHAIN CONVERGENCE</div>
              </div>
              <div className="hero-exit">
                <span className="exit-icon"><Landmark size={22} /></span>
                <div>
                  <div className="eyebrow">ACTIONABLE EXIT IDENTIFIED</div>
                  <strong>VASP-X <small>· Probable association</small></strong>
                </div>
                <div className="exit-confidence">
                  91<small>%</small>
                  <span>confidence</span>
                </div>
              </div>
              <div className="console-stats">
                <span><strong>47</strong> transactions</span>
                <span><strong>18</strong> wallets</span>
                <span><strong>3</strong> related complaints</span>
              </div>
            </div>
          </main>

          {/* Academic & Research Disclaimer */}
          <div style={{ maxWidth: 1190, margin: '0 auto 30px', padding: '0 30px' }}>
            <div style={{ background: '#0a1626', border: '1px solid #1f334a', borderRadius: 8, padding: '14px 18px', display: 'flex', alignItems: 'center', gap: 14 }}>
              <Scale size={20} color="#62cbb9" style={{ flexShrink: 0 }} />
              <p style={{ margin: 0, fontSize: 12, color: '#8ea3b8', lineHeight: 1.5 }}>
                <strong style={{ color: '#fff' }}>Academic &amp; Forensic Research Disclosure:</strong> Cyber Trace is an independent academic and research project. The &ldquo;CBI Officer&rdquo; role is a simulated investigation role label and does not represent an official government service.
              </p>
            </div>
          </div>

          {/* 4 Pillar Strip */}
          <section className="pillar-strip" id="approach">
            {[
              [Search, '01', 'TRACE', 'Follow the fund flow'],
              [Fingerprint, '02', 'ATTRIBUTE', 'Explain every lead'],
              [Network, '03', 'CORRELATE', 'Connect the complaints'],
              [FileCheck2, '04', 'ACT', 'Prepare the evidence']
            ].map(([Icon, n, title, desc]: any) => (
              <div key={title}>
                <span className="pillar-number">{n}</span>
                <Icon size={21} />
                <div><strong>{title}</strong><span>{desc}</span></div>
                <ChevronRight size={16} />
              </div>
            ))}
          </section>

          {/* Intelligence Section with 4 feature cards */}
          <section className="landing-section" id="intelligence">
            <div className="section-intro">
              <div className="eyebrow"><span className="tiny-square" /> ONE WALLET. A CLEARER PICTURE.</div>
              <h2>An investigation starts with an address.<br />It shouldn’t end with a transaction list.</h2>
              <p>Crypto fraud investigations often begin with a single wallet address. CRYPTO-TRACE INDIA turns it into an investigation graph, correlates independent complaints and produces confidence-ranked VASP intelligence.</p>
            </div>
            <div className="feature-grid">
              {[
                [GitBranch, 'Cross-chain investigation', 'Follow linked movements across chains, with bridge evidence and a visible confidence boundary.'],
                [Fingerprint, 'Fraud flow fingerprint', 'Review transaction velocity, consolidation and service exposure as explainable behavioral signals.'],
                [Network, 'Cross-complaint correlation', 'Find shared intermediaries and clusters across independently reported cases.'],
                [Landmark, 'Actionable exit engine', 'Prioritize candidate service endpoints using weighted, inspectable evidence.']
              ].map(([Icon, title, desc]: any) => (
                <article key={title}>
                  <Icon size={23} />
                  <h3>{title}</h3>
                  <p>{desc}</p>
                </article>
              ))}
            </div>
          </section>

          {/* Architecture Section */}
          <section className="architecture-section" id="architecture">
            <div>
              <div className="eyebrow"><span className="tiny-square" /> DESIGNED FOR INVESTIGATOR WORKFLOWS</div>
              <h2>Evidence at every step.<br />Human judgment at the center.</h2>
              <p>A modular case and graph architecture connects reported wallets, behavioral signals and candidate attribution. Integration adapters demonstrate the path to authorized NCRP, SAHYOG and VASP workflows.</p>
              <div className="security-note">
                <Scale size={20} />
                <span>Investigative intelligence supports verification. It does not make legal determinations or send information requests automatically.</span>
              </div>
            </div>
            <div className="architecture-flow">
              <div><span>01 / INTAKE</span><strong>Complaint + reported wallet</strong></div>
              <div><span>02 / INTELLIGENCE</span><strong>Trace → fingerprint → correlate</strong></div>
              <div><span>03 / ATTRIBUTION</span><strong>Candidate VASP + evidence + confidence</strong></div>
              <div><span>04 / ACTION</span><strong>Reviewable investigation package</strong></div>
            </div>
          </section>

          {/* CTA Section */}
          <section className="landing-cta">
            <div>
              <div className="eyebrow"><span className="tiny-square" /> THE 3-MINUTE INVESTIGATION</div>
              <h2>One reported wallet. Your next lead.</h2>
              <p>Open the complete synthetic investigation. Inspect the graph. Download the evidence report.</p>
            </div>
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
              <Button variant="secondary" onClick={() => navigate('/reporter/submit')}>
                <FileText size={15} /> File Complaint
              </Button>
              <Button variant="secondary" onClick={() => navigate('/login')}>
                Officer Login <LockKeyhole size={15} />
              </Button>
              <Button disabled={busy} onClick={enterDemoInvestigator}>
                Try live demo <ArrowUpRight size={16} />
              </Button>
            </div>
          </section>

          {/* Footer */}
          <footer className="landing-footer">
            <span>CRYPTO-TRACE INDIA <small>From Reported Wallet to Actionable Intelligence</small></span>
            <p>Independent SIH-style prototype. Fictional data and entities. Law enforcement intelligence engine.</p>
            <span>TRACE · ATTRIBUTE · CORRELATE · ACT</span>
          </footer>
        </>
      )}
    </div>
  );
}
