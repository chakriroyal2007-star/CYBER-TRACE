import React, { useState } from 'react';
import {
  ArrowRight, ShieldCheck, Network, GitBranch, Landmark, Fingerprint,
  FileCheck2, Search, Waypoints, ChevronRight, Scale, Layers3, LockKeyhole, Eye,
  EyeOff, KeyRound, Mail, User, Phone, CheckCircle2, AlertCircle, FileText, UserCheck,
  AlertTriangle, ExternalLink, ShieldAlert, Zap, Globe, Sparkles
} from 'lucide-react';
import { api, navigate } from '../api';
import { Button, Badge } from '../components/ui';

export default function Landing({ login = false }: { login?: boolean }) {
  const [selectedRole, setSelectedRole] = useState<'citizen' | 'officer'>('citizen');
  const [isRegistering, setIsRegistering] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  // Form states
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [officerCode, setOfficerCode] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  async function handleAuth(e: React.FormEvent) {
    e.preventDefault();
    setError('');

    if (isRegistering) {
      if (!name.trim()) {
        setError('Please enter your full name.');
        return;
      }
      if (!email.trim() || !email.includes('@')) {
        setError('Please enter a valid email address.');
        return;
      }
      if (password.length < 6) {
        setError('Password must be at least 6 characters.');
        return;
      }
      if (password !== confirmPassword) {
        setError('Passwords do not match.');
        return;
      }
      if (selectedRole === 'officer' && !officerCode.trim()) {
        setError('Official Officer Registration Secret Code is required.');
        return;
      }

      setBusy(true);
      try {
        const payload: any = {
          name: name.trim(),
          email: email.trim().toLowerCase(),
          password,
          role: selectedRole
        };
        if (selectedRole === 'officer') {
          payload.officerCode = officerCode.trim();
        }

        const res = await api('/auth/register', {
          method: 'POST',
          body: JSON.stringify(payload)
        });

        if (res?.token) {
          localStorage.setItem('ct_token', res.token);
        }

        if (selectedRole === 'citizen') {
          navigate('/reporter/dashboard');
        } else {
          navigate('/app/dashboard');
        }
      } catch (err: any) {
        setError(err.message || 'Registration failed.');
        setBusy(false);
      }
    } else {
      // Login
      if (!email.trim() || !password) {
        setError('Please enter both email and password.');
        return;
      }
      setBusy(true);
      try {
        const res = await api('/auth/login', {
          method: 'POST',
          body: JSON.stringify({ email: email.trim().toLowerCase(), password })
        });

        if (res?.token) {
          localStorage.setItem('ct_token', res.token);
        }

        if (res?.user?.role === 'reporter' || selectedRole === 'citizen') {
          navigate('/reporter/dashboard');
        } else {
          navigate('/app/dashboard');
        }
      } catch (err: any) {
        setError(err.message || 'Authentication failed. Please check your credentials.');
        setBusy(false);
      }
    }
  }

  return (
    <div className="landing" style={{ minHeight: '100vh', background: '#050811', color: '#e2e8f0' }}>
      {/* Statutory 1930 Emergency Helpline Ribbon */}
      <div style={{
        background: '#7f1d1d',
        color: '#fecaca',
        padding: '8px 24px',
        fontSize: 12,
        fontWeight: 600,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: 8,
        borderBottom: '1px solid #991b1b'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <AlertTriangle size={15} color="#fca5a5" />
          <span>INDIAN NATIONAL CYBER CRIME HELPLINE: Dial <strong>1930</strong> immediately for financial fraud reporting.</span>
        </div>
        <div style={{ display: 'flex', gap: 14 }}>
          <a href="tel:1930" style={{ color: '#fff', textDecoration: 'underline' }}>Call 1930</a>
          <a href="https://cybercrime.gov.in" target="_blank" rel="noopener noreferrer" style={{ color: '#fff', textDecoration: 'underline', display: 'flex', alignItems: 'center', gap: 4 }}>
            cybercrime.gov.in <ExternalLink size={11} />
          </a>
        </div>
      </div>

      {/* Header */}
      <header className="landing-nav" style={{ padding: '16px 36px', borderBottom: '1px solid #1e293b', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <a href="/" onClick={e => { e.preventDefault(); navigate('/'); }} className="brand" style={{ display: 'flex', alignItems: 'center', gap: 12, textDecoration: 'none', color: '#fff' }}>
          <div style={{ background: '#0284c7', padding: 8, borderRadius: 8, color: '#fff', display: 'flex' }}>
            <Waypoints size={22} />
          </div>
          <div>
            <div style={{ fontWeight: 800, fontSize: 16, letterSpacing: 0.5 }}>CYBER-TRACE <em>INDIA</em></div>
            <div style={{ fontSize: 10, color: '#94a3b8', letterSpacing: 1 }}>CYBER FRAUD INTELLIGENCE & FORENSICS</div>
          </div>
        </a>

        <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
          <Button variant="secondary" onClick={() => navigate('/scam-analyzer')}>
            <Sparkles size={14} color="#38bdf8" /> Free Scam Scanner
          </Button>
          <Button variant="secondary" onClick={() => navigate('/reporter/submit')}>
            <FileText size={14} /> Report Scam
          </Button>
        </div>
      </header>

      {/* Hero Section with "WHO ARE YOU?" Gateway */}
      <section style={{ maxWidth: 1180, margin: '0 auto', padding: '48px 24px 64px 24px' }}>
        <div style={{ textAlign: 'center', marginBottom: 40 }}>
          <Badge variant="info">CENTRAL CYBER FRAUD DEFENSE PLATFORM</Badge>
          <h1 style={{ fontSize: 'clamp(28px, 4vw, 44px)', fontWeight: 800, color: '#fff', margin: '14px 0 10px 0', letterSpacing: -0.5 }}>
            Combating Digital Financial Scams Across India
          </h1>
          <p style={{ fontSize: 15, color: '#94a3b8', maxWidth: 680, margin: '0 auto', lineHeight: 1.6 }}>
            Unified intelligence platform connecting ordinary citizen fraud reports with advanced machine learning scam classifiers, malicious URL detection, and multi-hop blockchain financial forensics.
          </p>
        </div>

        {/* WHO ARE YOU? Portal Card */}
        <div style={{
          maxWidth: 820,
          margin: '0 auto',
          background: '#0a0f1d',
          border: '1px solid #1e293b',
          borderRadius: 14,
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)',
          overflow: 'hidden'
        }}>
          {/* Header step */}
          <div style={{
            background: '#0f172a',
            padding: '18px 24px',
            borderBottom: '1px solid #1e293b',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <LockKeyhole size={18} color="#38bdf8" />
              <strong style={{ fontSize: 14, color: '#fff', letterSpacing: 0.5 }}>SELECT YOUR ROLE / ACCESS PORTAL</strong>
            </div>
            <span style={{ fontSize: 11, color: '#64748b' }}>Role-Based Access Control (RBAC)</span>
          </div>

          <div style={{ padding: '28px 32px' }}>
            {/* Role Switcher Cards */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 28 }}>
              {/* Option A: Citizen */}
              <div
                onClick={() => { setSelectedRole('citizen'); setError(''); }}
                style={{
                  border: `2px solid ${selectedRole === 'citizen' ? '#0284c7' : '#1e293b'}`,
                  background: selectedRole === 'citizen' ? 'rgba(2, 132, 199, 0.08)' : '#090d16',
                  borderRadius: 10,
                  padding: '20px 18px',
                  cursor: 'pointer',
                  transition: 'all 0.15s ease'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
                  <div style={{ background: selectedRole === 'citizen' ? '#0284c7' : '#1e293b', color: '#fff', borderRadius: 8, padding: 6, display: 'flex' }}>
                    <User size={18} />
                  </div>
                  <div>
                    <strong style={{ fontSize: 14, color: '#fff', display: 'block' }}>A. CITIZEN / REPORTER</strong>
                    <span style={{ fontSize: 11, color: '#94a3b8' }}>General Public & Victims</span>
                  </div>
                </div>
                <p style={{ margin: 0, fontSize: 11.5, color: '#94a3b8', lineHeight: 1.5 }}>
                  Report cybercrime, scan suspicious WhatsApp/SMS messages, inspect phishing URLs, and track case resolution.
                </p>
              </div>

              {/* Option B: Officer */}
              <div
                onClick={() => { setSelectedRole('officer'); setError(''); }}
                style={{
                  border: `2px solid ${selectedRole === 'officer' ? '#0284c7' : '#1e293b'}`,
                  background: selectedRole === 'officer' ? 'rgba(2, 132, 199, 0.08)' : '#090d16',
                  borderRadius: 10,
                  padding: '20px 18px',
                  cursor: 'pointer',
                  transition: 'all 0.15s ease'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
                  <div style={{ background: selectedRole === 'officer' ? '#0284c7' : '#1e293b', color: '#fff', borderRadius: 8, padding: 6, display: 'flex' }}>
                    <ShieldCheck size={18} />
                  </div>
                  <div>
                    <strong style={{ fontSize: 14, color: '#fff', display: 'block' }}>B. INVESTIGATION OFFICER</strong>
                    <span style={{ fontSize: 11, color: '#94a3b8' }}>CBI & Cyber Crime Police</span>
                  </div>
                </div>
                <p style={{ margin: 0, fontSize: 11.5, color: '#94a3b8', lineHeight: 1.5 }}>
                  Investigate cases, run multi-hop blockchain tracing, issue Section 91 CrPC notices, and oversee ML threat models.
                </p>
              </div>
            </div>

            {/* Sub-Tabs: Sign In vs Sign Up */}
            <div style={{ display: 'flex', gap: 20, borderBottom: '1px solid #1e293b', paddingBottom: 10, marginBottom: 20 }}>
              <button
                type="button"
                onClick={() => { setIsRegistering(false); setError(''); }}
                style={{
                  background: 'none',
                  border: 'none',
                  fontSize: 13,
                  fontWeight: !isRegistering ? 700 : 500,
                  color: !isRegistering ? '#38bdf8' : '#64748b',
                  cursor: 'pointer',
                  padding: '4px 8px',
                  borderBottom: !isRegistering ? '2px solid #38bdf8' : 'none'
                }}
              >
                Sign In to {selectedRole === 'citizen' ? 'Citizen Account' : 'Officer Console'}
              </button>
              <button
                type="button"
                onClick={() => { setIsRegistering(true); setError(''); }}
                style={{
                  background: 'none',
                  border: 'none',
                  fontSize: 13,
                  fontWeight: isRegistering ? 700 : 500,
                  color: isRegistering ? '#38bdf8' : '#64748b',
                  cursor: 'pointer',
                  padding: '4px 8px',
                  borderBottom: isRegistering ? '2px solid #38bdf8' : 'none'
                }}
              >
                Register New {selectedRole === 'citizen' ? 'Citizen' : 'Officer'}
              </button>
            </div>

            {error && (
              <div style={{
                background: 'rgba(239, 68, 68, 0.1)',
                border: '1px solid #ef4444',
                color: '#fca5a5',
                borderRadius: 8,
                padding: '10px 14px',
                fontSize: 12,
                marginBottom: 18,
                display: 'flex',
                alignItems: 'center',
                gap: 8
              }}>
                <AlertCircle size={16} color="#ef4444" style={{ flexShrink: 0 }} />
                <span>{error}</span>
              </div>
            )}

            <form onSubmit={handleAuth}>
              {isRegistering && (
                <div style={{ marginBottom: 14 }}>
                  <label style={{ display: 'block', fontSize: 12, color: '#94a3b8', marginBottom: 6 }}>Full Name</label>
                  <input
                    type="text"
                    required
                    value={name}
                    onChange={e => setName(e.target.value)}
                    placeholder={selectedRole === 'officer' ? 'e.g. Insp. Vikram Sharma' : 'e.g. Rahul Verma'}
                    style={{
                      width: '100%',
                      background: '#090d16',
                      border: '1px solid #1e293b',
                      borderRadius: 6,
                      padding: '10px 12px',
                      color: '#fff',
                      fontSize: 13
                    }}
                  />
                </div>
              )}

              <div style={{ marginBottom: 14 }}>
                <label style={{ display: 'block', fontSize: 12, color: '#94a3b8', marginBottom: 6 }}>
                  {selectedRole === 'officer' ? 'Official Agency Email' : 'Email Address'}
                </label>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  placeholder={selectedRole === 'officer' ? 'e.g. officer.sharma@cbi.gov.in' : 'e.g. citizen@example.com'}
                  style={{
                    width: '100%',
                    background: '#090d16',
                    border: '1px solid #1e293b',
                    borderRadius: 6,
                    padding: '10px 12px',
                    color: '#fff',
                    fontSize: 13
                  }}
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: isRegistering ? '1fr 1fr' : '1fr', gap: 12, marginBottom: 14 }}>
                <div>
                  <label style={{ display: 'block', fontSize: 12, color: '#94a3b8', marginBottom: 6 }}>Password</label>
                  <input
                    type={showPassword ? 'text' : 'password'}
                    required
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    placeholder="Enter password"
                    style={{
                      width: '100%',
                      background: '#090d16',
                      border: '1px solid #1e293b',
                      borderRadius: 6,
                      padding: '10px 12px',
                      color: '#fff',
                      fontSize: 13
                    }}
                  />
                </div>

                {isRegistering && (
                  <div>
                    <label style={{ display: 'block', fontSize: 12, color: '#94a3b8', marginBottom: 6 }}>Confirm Password</label>
                    <input
                      type={showPassword ? 'text' : 'password'}
                      required
                      value={confirmPassword}
                      onChange={e => setConfirmPassword(e.target.value)}
                      placeholder="Repeat password"
                      style={{
                        width: '100%',
                        background: '#090d16',
                        border: '1px solid #1e293b',
                        borderRadius: 6,
                        padding: '10px 12px',
                        color: '#fff',
                        fontSize: 13
                      }}
                    />
                  </div>
                )}
              </div>

              {isRegistering && selectedRole === 'officer' && (
                <div style={{ marginBottom: 16, background: '#090d16', border: '1px solid #1e293b', padding: 12, borderRadius: 6 }}>
                  <label style={{ display: 'block', fontSize: 12, color: '#38bdf8', fontWeight: 600, marginBottom: 6 }}>
                    Officer Registration Secret Code
                  </label>
                  <input
                    type="password"
                    required
                    value={officerCode}
                    onChange={e => setOfficerCode(e.target.value)}
                    placeholder="Enter official agency verification code"
                    style={{
                      width: '100%',
                      background: '#050811',
                      border: '1px solid #0369a1',
                      borderRadius: 6,
                      padding: '9px 12px',
                      color: '#fff',
                      fontSize: 13
                    }}
                  />
                  <small style={{ color: '#64748b', fontSize: 10.5, marginTop: 4, display: 'block' }}>
                    Restricted to authorized law enforcement personnel. Verified exclusively on backend.
                  </small>
                </div>
              )}

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 18 }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11.5, color: '#94a3b8', cursor: 'pointer' }}>
                  <input type="checkbox" checked={showPassword} onChange={e => setShowPassword(e.target.checked)} />
                  Show password
                </label>

                <Button disabled={busy} style={{ minWidth: 160 }}>
                  {busy ? 'Authenticating…' : isRegistering ? 'Create Account' : `Enter ${selectedRole === 'citizen' ? 'Citizen' : 'Officer'} Portal`}
                  <ArrowRight size={14} />
                </Button>
              </div>
            </form>
          </div>
        </div>
      </section>

      {/* Feature Capabilities Grid */}
      <section style={{ maxWidth: 1100, margin: '0 auto', padding: '0 24px 60px 24px' }}>
        <h2 style={{ fontSize: 20, color: '#fff', textAlign: 'center', marginBottom: 28 }}>
          Standardized End-to-End Cybercrime Architecture
        </h2>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 20 }}>
          <div style={{ background: '#0a0f1d', border: '1px solid #1e293b', borderRadius: 8, padding: 20 }}>
            <div style={{ background: '#0284c7', width: 36, height: 36, borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', marginBottom: 14 }}>
              <Sparkles size={20} />
            </div>
            <strong style={{ color: '#fff', fontSize: 14, display: 'block', marginBottom: 6 }}>Multilingual Scam Detection</strong>
            <p style={{ margin: 0, fontSize: 12, color: '#94a3b8', lineHeight: 1.6 }}>
              Extracts urgency markers, impersonation triggers, and fraudulent promises across English, Hindi, Telugu, Tamil, Kannada, Malayalam, and Hinglish.
            </p>
          </div>

          <div style={{ background: '#0a0f1d', border: '1px solid #1e293b', borderRadius: 8, padding: 20 }}>
            <div style={{ background: '#0284c7', width: 36, height: 36, borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', marginBottom: 14 }}>
              <Globe size={20} />
            </div>
            <strong style={{ color: '#fff', fontSize: 14, display: 'block', marginBottom: 6 }}>URL Phishing Scanner</strong>
            <p style={{ margin: 0, fontSize: 12, color: '#94a3b8', lineHeight: 1.6 }}>
              Analyzes 12 structural URL features (ISCX benchmark) and cross-checks active verified PhishTank threat feeds with strict SSRF protection.
            </p>
          </div>

          <div style={{ background: '#0a0f1d', border: '1px solid #1e293b', borderRadius: 8, padding: 20 }}>
            <div style={{ background: '#0284c7', width: 36, height: 36, borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', marginBottom: 14 }}>
              <Network size={20} />
            </div>
            <strong style={{ color: '#fff', fontSize: 14, display: 'block', marginBottom: 6 }}>Multi-Hop Financial Forensics</strong>
            <p style={{ margin: 0, fontSize: 12, color: '#94a3b8', lineHeight: 1.6 }}>
              Traces UPI victim losses through intermediary mule bank accounts, P2P exchange liquidation vaults, and Ethereum / TRON blockchain hops.
            </p>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer style={{ borderTop: '1px solid #1e293b', padding: '24px 36px', textAlign: 'center', fontSize: 11.5, color: '#64748b' }}>
        <div>CYBER TRACE INDIA · ACADEMIC FORENSIC PLATFORM & CYBER FRAUD DEFENSE SUITE</div>
        <div style={{ marginTop: 6 }}>
          Compliant with Indian cybersecurity directives. Emergency support: Dial 1930 or visit cybercrime.gov.in.
        </div>
      </footer>
    </div>
  );
}
