import React, { useState } from 'react';
import {
  Waypoints, ArrowRight, ShieldCheck, UserCheck, FileText, LockKeyhole,
  Network, Search, Play, Scale, Eye, EyeOff, Mail, KeyRound, User, Phone,
  CheckCircle2, AlertCircle, ArrowUpRight, GitBranch, Fingerprint, Database,
  Layers3, Compass, Sparkles
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
    <div style={{ minHeight: '100vh', background: '#070d17', color: '#e2e8f0', fontFamily: 'system-ui, -apple-system, sans-serif' }}>
      
      {/* Navigation Header */}
      <header style={{
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        padding: '18px 36px', maxWidth: 1280, margin: '0 auto',
        borderBottom: '1px solid #142336'
      }}>
        <a href="/" onClick={e => { e.preventDefault(); navigate('/'); }} style={{ display: 'flex', alignItems: 'center', gap: 12, textDecoration: 'none', color: '#fff' }}>
          <div style={{ width: 34, height: 34, borderRadius: 8, background: '#087f94', display: 'grid', placeItems: 'center', color: '#fff' }}>
            <Waypoints size={20} />
          </div>
          <div>
            <div style={{ fontSize: 16, fontWeight: 700, letterSpacing: '0.4px', lineHeight: 1.2 }}>
              CYBER TRACE <span style={{ color: '#38bdf8' }}>INDIA</span>
            </div>
            <div style={{ fontSize: 9.5, color: '#64748b', letterSpacing: '0.8px', textTransform: 'uppercase' }}>
              Forensic Investigation Intelligence
            </div>
          </div>
        </a>

        <nav style={{ display: 'flex', alignItems: 'center', gap: 24 }}>
          <a href="/demo" onClick={e => { e.preventDefault(); navigate('/demo'); }} style={{ color: '#94a3b8', fontSize: 13, textDecoration: 'none', fontWeight: 500 }}>
            Interactive Demo
          </a>
          <a href="/app/dashboard" onClick={e => { e.preventDefault(); enterDemoInvestigator(); }} style={{ color: '#94a3b8', fontSize: 13, textDecoration: 'none', fontWeight: 500 }}>
            Console
          </a>
          <a href="#architecture" style={{ color: '#64748b', fontSize: 13, textDecoration: 'none' }}>
            Architecture
          </a>
        </nav>

        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <button
            onClick={() => navigate('/reporter/submit')}
            style={{
              background: 'transparent', border: '1px solid #1e3852', color: '#e2e8f0',
              padding: '8px 14px', borderRadius: 6, fontSize: 12.5, fontWeight: 600,
              cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6, transition: 'all 0.15s'
            }}
          >
            <FileText size={14} color="#4fd7c1" /> File Complaint
          </button>
          <button
            onClick={() => navigate('/login')}
            style={{
              background: '#087f94', border: 'none', color: '#fff',
              padding: '8px 16px', borderRadius: 6, fontSize: 12.5, fontWeight: 600,
              cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6
            }}
          >
            <LockKeyhole size={14} /> Portal Sign In
          </button>
        </div>
      </header>

      {/* Main Content: Either Login Panel or Hero Experience */}
      {login ? (
        <main style={{ maxWidth: 460, margin: '48px auto', padding: '0 20px' }}>
          <div style={{ background: '#0b1626', border: '1px solid #1a2b40', borderRadius: 12, padding: 32, boxShadow: '0 20px 40px rgba(0,0,0,0.4)' }}>
            
            <div style={{ textAlign: 'center', marginBottom: 24 }}>
              <div style={{ width: 44, height: 44, borderRadius: 10, background: 'linear-gradient(135deg, #087f94, #0b182b)', display: 'grid', placeItems: 'center', margin: '0 auto 12px', color: '#38bdf8' }}>
                <ShieldCheck size={26} />
              </div>
              <h1 style={{ fontSize: 20, fontWeight: 700, margin: '0 0 6px', color: '#fff' }}>
                {authMode === 'officer-login' ? 'CBI Officer Sign In' : authMode === 'reporter-login' ? 'Citizen Reporter Sign In' : 'Citizen Registration'}
              </h1>
              <p style={{ fontSize: 12, color: '#64748b', margin: 0 }}>
                Access the cryptocurrency crime reporting &amp; analytics network
              </p>
            </div>

            {/* Mode Switcher Tabs */}
            <div style={{ display: 'flex', background: '#070f1a', borderRadius: 8, padding: 3, marginBottom: 20, border: '1px solid #152438' }}>
              <button
                type="button"
                onClick={() => {
                  setAuthMode('officer-login');
                  setEmail('officer.sharma@cbi.gov.in');
                  setPassword('Sharma@2026');
                  setError('');
                }}
                style={{
                  flex: 1, padding: '7px 8px', borderRadius: 6, fontSize: 11.5, fontWeight: 600,
                  border: 'none', cursor: 'pointer', transition: 'all 0.15s',
                  background: authMode === 'officer-login' ? '#087f94' : 'transparent',
                  color: authMode === 'officer-login' ? '#fff' : '#64748b'
                }}
              >
                CBI Officer
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
                  flex: 1, padding: '7px 8px', borderRadius: 6, fontSize: 11.5, fontWeight: 600,
                  border: 'none', cursor: 'pointer', transition: 'all 0.15s',
                  background: authMode === 'reporter-login' ? '#087f94' : 'transparent',
                  color: authMode === 'reporter-login' ? '#fff' : '#64748b'
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
                  flex: 1, padding: '7px 8px', borderRadius: 6, fontSize: 11.5, fontWeight: 600,
                  border: 'none', cursor: 'pointer', transition: 'all 0.15s',
                  background: authMode === 'reporter-register' ? '#087f94' : 'transparent',
                  color: authMode === 'reporter-register' ? '#fff' : '#64748b'
                }}
              >
                New Citizen
              </button>
            </div>

            {/* Form */}
            {authMode === 'reporter-register' ? (
              <form onSubmit={handleRegister} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
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
                    style={{ width: '100%', boxSizing: 'border-box', padding: '9px 12px', background: '#070f1a', border: '1px solid #1e334a', borderRadius: 6, color: '#fff', fontSize: 13 }}
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
                    placeholder="name@example.in"
                    style={{ width: '100%', boxSizing: 'border-box', padding: '9px 12px', background: '#070f1a', border: '1px solid #1e334a', borderRadius: 6, color: '#fff', fontSize: 13 }}
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
                    style={{ width: '100%', boxSizing: 'border-box', padding: '9px 12px', background: '#070f1a', border: '1px solid #1e334a', borderRadius: 6, color: '#fff', fontSize: 13 }}
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
                    style={{ width: '100%', boxSizing: 'border-box', padding: '9px 12px', background: '#070f1a', border: '1px solid #1e334a', borderRadius: 6, color: '#fff', fontSize: 13 }}
                  />
                </div>

                {error && <div style={{ padding: '8px 12px', background: '#450a0a', border: '1px solid #991b1b', color: '#fca5a5', borderRadius: 6, fontSize: 11.5 }}>{error}</div>}

                <Button type="submit" disabled={busy} style={{ width: '100%', padding: '11px', justifyContent: 'center', marginTop: 6, background: '#087f94' }}>
                  {busy ? 'Registering…' : 'Register Citizen Account'} <ArrowRight size={15} />
                </Button>
              </form>
            ) : (
              <form onSubmit={handleLogin} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
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
                    style={{ width: '100%', boxSizing: 'border-box', padding: '9px 12px', background: '#070f1a', border: '1px solid #1e334a', borderRadius: 6, color: '#fff', fontSize: 13 }}
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
                      style={{ width: '100%', boxSizing: 'border-box', padding: '9px 38px 9px 12px', background: '#070f1a', border: '1px solid #1e334a', borderRadius: 6, color: '#fff', fontSize: 13 }}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(v => !v)}
                      style={{ position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: '#64748b', cursor: 'pointer', padding: 4 }}
                    >
                      {showPassword ? <EyeOff size={15} /> : <Eye size={15} />}
                    </button>
                  </div>
                </div>

                {error && <div style={{ padding: '8px 12px', background: '#450a0a', border: '1px solid #991b1b', color: '#fca5a5', borderRadius: 6, fontSize: 11.5 }}>{error}</div>}

                <Button type="submit" disabled={busy} style={{ width: '100%', padding: '11px', justifyContent: 'center', marginTop: 4, background: '#087f94' }}>
                  {busy ? 'Authenticating…' : authMode === 'officer-login' ? 'Sign In as CBI Officer' : 'Sign In as Reporter'}
                  <ArrowRight size={15} />
                </Button>
              </form>
            )}

            {/* Quick 1-Click Demo Access */}
            <div style={{ marginTop: 24, paddingTop: 18, borderTop: '1px solid #16263a' }}>
              <span style={{ fontSize: 10.5, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.8px', display: 'block', marginBottom: 10, textAlign: 'center' }}>
                Instant Evaluation Demo Sign In
              </span>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                <button
                  type="button"
                  disabled={busy}
                  onClick={enterDemoInvestigator}
                  style={{
                    background: '#0a1a2e', border: '1px solid #1d3957', color: '#38bdf8',
                    padding: '8px 12px', borderRadius: 6, fontSize: 12, fontWeight: 600,
                    cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8
                  }}
                >
                  <ShieldCheck size={14} /> Insp. Rajesh Sharma (CBI Officer)
                </button>
                <button
                  type="button"
                  disabled={busy}
                  onClick={enterDemoReporter}
                  style={{
                    background: '#091c1d', border: '1px solid #16403f', color: '#4fd7c1',
                    padding: '8px 12px', borderRadius: 6, fontSize: 12, fontWeight: 600,
                    cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8
                  }}
                >
                  <UserCheck size={14} /> Priya Nair (Citizen Reporter)
                </button>
              </div>
            </div>

            {/* Back link */}
            <div style={{ marginTop: 18, textAlign: 'center' }}>
              <a href="/" onClick={e => { e.preventDefault(); navigate('/'); }} style={{ fontSize: 12, color: '#64748b', textDecoration: 'none' }}>
                ← Return to Homepage
              </a>
            </div>
          </div>
        </main>
      ) : (
        /* Clean, Premium Hero & Content */
        <main style={{ maxWidth: 1180, margin: '0 auto', padding: '60px 24px 80px' }}>
          
          {/* Hero Section */}
          <section style={{ textAlign: 'center', maxWidth: 840, margin: '0 auto 60px' }}>
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '5px 12px', borderRadius: 999, background: 'rgba(56, 189, 248, 0.08)', border: '1px solid rgba(56, 189, 248, 0.25)', marginBottom: 24 }}>
              <Sparkles size={13} color="#38bdf8" />
              <span style={{ fontSize: 11.5, fontWeight: 600, color: '#38bdf8', letterSpacing: '0.6px' }}>
                FORENSIC CRYPTOCURRENCY INVESTIGATION PLATFORM
              </span>
            </div>

            <h1 style={{ fontSize: 48, fontWeight: 800, letterSpacing: '-1.5px', lineHeight: 1.15, margin: '0 0 16px', color: '#ffffff' }}>
              Cyber Trace India
            </h1>

            <div style={{ fontSize: 20, fontWeight: 500, color: '#38bdf8', letterSpacing: '-0.3px', margin: '0 0 18px' }}>
              Cryptocurrency Fraud Detection &amp; Investigation Intelligence
            </div>

            <p style={{ fontSize: 15, color: '#94a3b8', lineHeight: 1.65, margin: '0 auto 36px', maxWidth: 680 }}>
              Trace suspicious cryptocurrency transactions, analyze connected transaction activity, and manage cybercrime complaints through an evidence-driven investigation workflow.
            </p>

            {/* Exactly 4 Primary Actions as requested in Section 3 */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 14, maxWidth: 840, margin: '0 auto' }}>
              
              {/* Button 1: Explore the platform */}
              <button
                onClick={() => {
                  enterDemoInvestigator();
                }}
                style={{
                  background: '#087f94', color: '#fff', border: 'none',
                  padding: '14px 18px', borderRadius: 8, fontSize: 13.5, fontWeight: 700,
                  cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                  boxShadow: '0 4px 14px rgba(8, 127, 148, 0.3)', transition: 'all 0.15s'
                }}
              >
                <Compass size={16} /> Explore the platform
              </button>

              {/* Button 2: Citizen Reporter */}
              <button
                onClick={() => navigate('/reporter/submit')}
                style={{
                  background: '#0d2238', color: '#e2e8f0', border: '1px solid #1e3d5f',
                  padding: '14px 18px', borderRadius: 8, fontSize: 13.5, fontWeight: 600,
                  cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                  transition: 'all 0.15s'
                }}
              >
                <FileText size={16} color="#4fd7c1" /> Citizen Reporter
              </button>

              {/* Button 3: Officer Login */}
              <button
                onClick={() => navigate('/login')}
                style={{
                  background: '#0d2238', color: '#e2e8f0', border: '1px solid #1e3d5f',
                  padding: '14px 18px', borderRadius: 8, fontSize: 13.5, fontWeight: 600,
                  cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                  transition: 'all 0.15s'
                }}
              >
                <LockKeyhole size={16} color="#38bdf8" /> Officer Login
              </button>

              {/* Button 4: Try Interactive Demo */}
              <button
                onClick={() => navigate('/demo')}
                style={{
                  background: 'linear-gradient(135deg, #102a45, #0d1e33)', color: '#38bdf8',
                  border: '1px solid #254b73', padding: '14px 18px', borderRadius: 8,
                  fontSize: 13.5, fontWeight: 700, cursor: 'pointer', display: 'flex',
                  alignItems: 'center', justifyContent: 'center', gap: 8, transition: 'all 0.15s'
                }}
              >
                <Play size={15} fill="#38bdf8" /> Try Interactive Demo
              </button>
            </div>
          </section>

          {/* Academic / Research Disclaimer Banner (Mandatory) */}
          <div style={{
            background: '#0a1626', border: '1px solid #1b2d42', borderRadius: 8,
            padding: '16px 20px', margin: '0 auto 56px', maxWidth: 840,
            display: 'flex', gap: 14, alignItems: 'center'
          }}>
            <Scale size={22} color="#38bdf8" style={{ flexShrink: 0 }} />
            <p style={{ margin: 0, fontSize: 12.5, color: '#94a3b8', lineHeight: 1.5 }}>
              <strong style={{ color: '#fff' }}>Academic &amp; Research Disclaimer:</strong> Cyber Trace is an independent academic and research project. The CBI Officer role is a simulated investigation role and does not represent an official government service.
            </p>
          </div>

          {/* Core Feature Cards (Linear / Vercel style) */}
          <section id="architecture" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 20 }}>
            
            <div style={{ background: '#0b1626', border: '1px solid #1a2b40', borderRadius: 10, padding: 24 }}>
              <div style={{ width: 36, height: 36, borderRadius: 8, background: 'rgba(56, 189, 248, 0.12)', display: 'grid', placeItems: 'center', color: '#38bdf8', marginBottom: 16 }}>
                <Network size={20} />
              </div>
              <h3 style={{ fontSize: 16, fontWeight: 700, margin: '0 0 8px', color: '#fff' }}>Forensic Graph Traversal</h3>
              <p style={{ fontSize: 12.5, color: '#94a3b8', lineHeight: 1.6, margin: 0 }}>
                BFS and DFS multi-hop traversal with cycle detection and Dijkstra shortest path over 203,769 transactions from the Elliptic Bitcoin research dataset.
              </p>
            </div>

            <div style={{ background: '#0b1626', border: '1px solid #1a2b40', borderRadius: 10, padding: 24 }}>
              <div style={{ width: 36, height: 36, borderRadius: 8, background: 'rgba(79, 215, 193, 0.12)', display: 'grid', placeItems: 'center', color: '#4fd7c1', marginBottom: 16 }}>
                <UserCheck size={20} />
              </div>
              <h3 style={{ fontSize: 16, fontWeight: 700, margin: '0 0 8px', color: '#fff' }}>Citizen Complaint Intake</h3>
              <p style={{ fontSize: 12.5, color: '#94a3b8', lineHeight: 1.6, margin: 0 }}>
                Public incident submission with cryptocurrency details, automated collision-safe Case ID generation (<code>CR-2026-XXXXX</code>), and evidence upload.
              </p>
            </div>

            <div style={{ background: '#0b1626', border: '1px solid #1a2b40', borderRadius: 10, padding: 24 }}>
              <div style={{ width: 36, height: 36, borderRadius: 8, background: 'rgba(234, 179, 8, 0.12)', display: 'grid', placeItems: 'center', color: '#eab308', marginBottom: 16 }}>
                <ShieldCheck size={20} />
              </div>
              <h3 style={{ fontSize: 16, fontWeight: 700, margin: '0 0 8px', color: '#fff' }}>CBI Officer Triage Queue</h3>
              <p style={{ fontSize: 12.5, color: '#94a3b8', lineHeight: 1.6, margin: 0 }}>
                Role-based case management, assignment to investigators, confidential internal notes, additional evidence requests, and Section 91 notices.
              </p>
            </div>

            <div style={{ background: '#0b1626', border: '1px solid #1a2b40', borderRadius: 10, padding: 24 }}>
              <div style={{ width: 36, height: 36, borderRadius: 8, background: 'rgba(168, 85, 247, 0.12)', display: 'grid', placeItems: 'center', color: '#a855f7', marginBottom: 16 }}>
                <Fingerprint size={20} />
              </div>
              <h3 style={{ fontSize: 16, fontWeight: 700, margin: '0 0 8px', color: '#fff' }}>Evidence-Driven Risk Engine</h3>
              <p style={{ fontSize: 12.5, color: '#94a3b8', lineHeight: 1.6, margin: 0 }}>
                6-parameter Investigation Readiness Scoring, SHA-256 evidence integrity hashing, and automated forensic PDF report compilation.
              </p>
            </div>

          </section>

          {/* Quick Footer */}
          <footer style={{ marginTop: 70, paddingTop: 24, borderTop: '1px solid #142336', display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 11.5, color: '#64748b' }}>
            <div>&copy; 2026 Cyber Trace India Forensic Intelligence. Built for academic &amp; evaluation research.</div>
            <div style={{ display: 'flex', gap: 16 }}>
              <a href="/demo" onClick={e => { e.preventDefault(); navigate('/demo'); }} style={{ color: '#38bdf8', textDecoration: 'none' }}>Guided Demo</a>
              <a href="/app/dashboard" onClick={e => { e.preventDefault(); enterDemoInvestigator(); }} style={{ color: '#94a3b8', textDecoration: 'none' }}>Console</a>
              <a href="/login" onClick={e => { e.preventDefault(); navigate('/login'); }} style={{ color: '#94a3b8', textDecoration: 'none' }}>Sign In</a>
            </div>
          </footer>

        </main>
      )}

    </div>
  );
}
