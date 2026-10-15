import {useState} from 'react';
import {ArrowRight,ArrowUpRight,ShieldCheck,Network,GitBranch,Landmark,Fingerprint,FileCheck2,Search,Waypoints,ChevronRight,Scale,Layers3,LockKeyhole,Eye,EyeOff,KeyRound,Mail} from 'lucide-react';
import {api,navigate} from '../api';
import {Button,Badge} from '../components/ui';

export default function Landing({login=false}:{login?:boolean}){
  const [busy,setBusy]=useState(false);
  const [error,setError]=useState('');
  const [email,setEmail]=useState('investigator@cryptotrace.gov.in');
  const [password,setPassword]=useState('Admin@2026');
  const [showPassword,setShowPassword]=useState(false);

  async function enter(path:string){
    setBusy(true);
    setError('');
    try{
      await api('/auth/demo',{method:'POST',body:'{}'});
      navigate(path);
    }catch(e:any){
      setError(e.message);
      setBusy(false);
    }
  }

  async function handleLogin(e: React.FormEvent){
    e.preventDefault();
    setBusy(true);
    setError('');
    try{
      await api('/auth/login',{
        method:'POST',
        body: JSON.stringify({ email, password })
      });
      navigate('/app/dashboard');
    }catch(e:any){
      setError(e.message || 'Authentication failed');
      setBusy(false);
    }
  }

  return <div className="landing">
    <header className="landing-nav">
      <a href="/" onClick={e=>{e.preventDefault();navigate('/')}} className="brand">
        <div className="brand-mark"><Waypoints size={24}/></div>
        <div>CRYPTO-TRACE <em>INDIA</em><small>INVESTIGATION INTELLIGENCE</small></div>
      </a>
      <nav>
        <a href="#approach">Our approach</a>
        <a href="#intelligence">Intelligence</a>
        <a href="#architecture">Architecture</a>
      </nav>
      <div style={{display:'flex',gap:10}}>
        <Button variant="secondary" onClick={()=>navigate('/login')}>Officer Login<LockKeyhole size={14}/></Button>
        <Button onClick={()=>enter('/app/dashboard')} disabled={busy}>Enter demo console<ArrowUpRight size={15}/></Button>
      </div>
    </header>

    {login ? (
      <main className="login-panel" style={{maxWidth: 460}}>
        <div className="brand-mark" style={{background: 'linear-gradient(135deg, #087f94, #0b182b)'}}><ShieldCheck size={32}/></div>
        <div className="eyebrow" style={{letterSpacing: '1.5px', color: '#087f94', fontWeight: 700}}>INVESTIGATOR PORTAL</div>
        <h1 style={{fontSize: 28, margin: '12px 0 6px'}}>Secure Officer Access</h1>
        <p style={{fontSize: 12, color: '#8ca6b8', marginBottom: 16}}>Sign in with your authorized agency email to access the evidence & intelligence workspace.</p>

        <form onSubmit={handleLogin} style={{width: '100%', display: 'flex', flexDirection: 'column', gap: 12, textAlign: 'left'}}>
          <div>
            <label style={{display: 'block', fontSize: 11, color: '#94a3b8', marginBottom: 4, fontWeight: 600}}>
              <Mail size={12} style={{display:'inline', marginRight: 4, verticalAlign: 'middle'}}/>
              Investigator Email ID
            </label>
            <input 
              type="email" 
              required
              value={email} 
              onChange={e=>setEmail(e.target.value)} 
              placeholder="name@agency.gov.in"
              style={{
                width: '100%', 
                padding: '10px 12px', 
                background: '#0a1421', 
                border: '1px solid #294052', 
                borderRadius: 6, 
                color: '#f8fafc',
                fontSize: 13,
                outline: 'none',
                boxSizing: 'border-box'
              }}
            />
          </div>

          <div>
            <label style={{display: 'block', fontSize: 11, color: '#94a3b8', marginBottom: 4, fontWeight: 600}}>
              <KeyRound size={12} style={{display:'inline', marginRight: 4, verticalAlign: 'middle'}}/>
              Password / Access Key
            </label>
            <div style={{position: 'relative'}}>
              <input 
                type={showPassword ? 'text' : 'password'} 
                required
                value={password} 
                onChange={e=>setPassword(e.target.value)} 
                placeholder="••••••••"
                style={{
                  width: '100%', 
                  padding: '10px 38px 10px 12px', 
                  background: '#0a1421', 
                  border: '1px solid #294052', 
                  borderRadius: 6, 
                  color: '#f8fafc',
                  fontSize: 13,
                  outline: 'none',
                  boxSizing: 'border-box'
                }}
              />
              <button 
                type="button" 
                onClick={()=>setShowPassword(v=>!v)}
                style={{
                  position: 'absolute', 
                  right: 10, 
                  top: '50%', 
                  transform: 'translateY(-50%)', 
                  background: 'none', 
                  border: 'none', 
                  color: '#64748b', 
                  cursor: 'pointer',
                  padding: 4
                }}
              >
                {showPassword ? <EyeOff size={15}/> : <Eye size={15}/>}
              </button>
            </div>
          </div>

          <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 10, color: '#64748b', margin: '2px 0'}}>
            <button 
              type="button" 
              onClick={()=>{ setEmail('investigator@cryptotrace.gov.in'); setPassword('Admin@2026'); }}
              style={{background: 'none', border: 'none', color: '#087f94', cursor: 'pointer', fontSize: 11, textDecoration: 'underline', padding: 0}}
            >
              Auto-fill Officer Credentials
            </button>
            <span>256-bit Evidence Guard</span>
          </div>

          {error && <div style={{padding: '8px 12px', background: '#450a0a', border: '1px solid #991b1b', color: '#fca5a5', borderRadius: 6, fontSize: 11}}>{error}</div>}

          <Button type="submit" disabled={busy} style={{width: '100%', marginTop: 8, padding: '12px', justifyContent: 'center'}}>
            {busy ? 'Authenticating Officer…' : 'Sign In to Intelligence Console'}
            <ArrowRight size={16}/>
          </Button>

          <div style={{display:'flex', alignItems:'center', gap: 10, margin: '8px 0'}}>
            <hr style={{flex: 1, borderColor: '#1e293b', borderStyle: 'solid', borderWidth: '1px 0 0'}}/>
            <span style={{fontSize: 10, color: '#64748b'}}>OR</span>
            <hr style={{flex: 1, borderColor: '#1e293b', borderStyle: 'solid', borderWidth: '1px 0 0'}}/>
          </div>

          <Button type="button" variant="secondary" disabled={busy} onClick={()=>enter('/app/dashboard')} style={{width: '100%', padding: '10px', justifyContent: 'center'}}>
            One-Click Demo Investigator Session
            <ArrowUpRight size={15}/>
          </Button>
        </form>

        <div className="login-info" style={{marginTop: 18, fontSize: 9.5, color: '#64748b', lineHeight: 1.5}}>
          <LockKeyhole size={16} style={{color: '#087f94'}}/>
          <span>Law Enforcement Section 91 & BNSS Forensic Readiness Sandbox. Sessions are strictly scoped with automated evidence audit logging.</span>
        </div>
      </main>
    ) : (
      <>
        <main className="landing-hero">
          <div className="hero-copy">
            <div className="eyebrow"><span className="tiny-square"/> COMPLAINT → INTELLIGENCE → ACTION</div>
            <h1>From reported wallet<br/>to <span>actionable<br className="hero-break"/> intelligence.</span></h1>
            <p>Evidence-backed blockchain intelligence for cybercrime investigations. Trace the flow, connect related complaints, and identify the next actionable lead.</p>
            <div className="hero-buttons">
              <Button disabled={busy} onClick={()=>enter('/app/new')}>Start investigation<ArrowRight size={16}/></Button>
              <Button variant="secondary" disabled={busy} onClick={()=>enter('/app/investigations/CR-2026-00192')}>Explore demo case<ArrowUpRight size={16}/></Button>
            </div>
            {error && <p className="error-text">{error}</p>}
            <div className="hero-meta">
              <span><ShieldCheck size={14}/>Evidence you can inspect</span>
              <span><Layers3 size={14}/>Cross-chain by design</span>
            </div>
          </div>

          <div className="hero-console">
            <div className="console-top">
              <span><i/><i/><i/></span>
              <span>INVESTIGATION WORKSPACE</span>
              <Badge>OFFICIAL INTELLIGENCE</Badge>
            </div>
            <div className="console-case">
              <div><small>CASE CR-2026-00192</small><h3>Follow the evidence.</h3></div>
              <Badge variant="danger">HIGH RISK</Badge>
            </div>
            <div className="hero-network">
              <div className="hero-chain eth">ETHEREUM</div>
              <div className="hero-chain polygon">POLYGON</div>
              <svg viewBox="0 0 540 300">
                <defs><linearGradient id="flowStroke"><stop stopColor="#74a1d5"/><stop offset="1" stopColor="#55cbb9"/></linearGradient></defs>
                <path className="path-major" d="M65 145L190 145L295 78L425 145L490 145"/>
                <path d="M190 145L245 239M190 145L148 44M425 145L398 247M295 78L330 20"/>
                <circle cx="245" cy="239" r="7"/><circle cx="148" cy="44" r="7"/><circle cx="398" cy="247" r="7"/><circle cx="330" cy="20" r="5"/>
              </svg>
              <div className="hnode n1"><span><Search size={20}/></span><strong>Reported wallet</strong><small>₹8,12,450</small></div>
              <div className="hnode n2"><span><Network size={20}/></span><strong>Intermediary</strong></div>
              <div className="hnode n3"><span><GitBranch size={20}/></span><strong>Bridge</strong></div>
              <div className="hnode n4"><span><Landmark size={22}/></span><strong>VASP-X</strong><small>Candidate exit</small></div>
              <div className="network-label">CROSS-CHAIN CONVERGENCE</div>
            </div>
            <div className="hero-exit">
              <span className="exit-icon"><Landmark size={22}/></span>
              <div>
                <div className="eyebrow">ACTIONABLE EXIT IDENTIFIED</div>
                <strong>VASP-X <small>· Probable association</small></strong>
              </div>
              <div className="exit-confidence">91<small>%</small><span>confidence</span></div>
            </div>
            <div className="console-stats">
              <span><strong>47</strong> transactions</span>
              <span><strong>18</strong> wallets</span>
              <span><strong>3</strong> related complaints</span>
            </div>
          </div>
        </main>

        <section className="pillar-strip" id="approach">
          {[[Search,'01','TRACE','Follow the fund flow'],[Fingerprint,'02','ATTRIBUTE','Explain every lead'],[Network,'03','CORRELATE','Connect the complaints'],[FileCheck2,'04','ACT','Prepare the evidence']].map(([Icon,n,title,desc]:any)=>(
            <div key={title}>
              <span className="pillar-number">{n}</span>
              <Icon size={21}/>
              <div><strong>{title}</strong><span>{desc}</span></div>
              <ChevronRight size={16}/>
            </div>
          ))}
        </section>

        <section className="landing-section" id="intelligence">
          <div className="section-intro">
            <div className="eyebrow">ONE WALLET. A CLEARER PICTURE.</div>
            <h2>An investigation starts with an address.<br/>It shouldn’t end with a transaction list.</h2>
            <p>Crypto fraud investigations often begin with a single wallet address. CRYPTO-TRACE INDIA turns it into an investigation graph, correlates independent complaints and produces confidence-ranked VASP intelligence.</p>
          </div>
          <div className="feature-grid">
            {[[GitBranch,'Cross-chain investigation','Follow linked movements across chains, with bridge evidence and a visible confidence boundary.'],
              [Fingerprint,'Fraud flow fingerprint','Review transaction velocity, consolidation and service exposure as explainable behavioral signals.'],
              [Network,'Cross-complaint correlation','Find shared intermediaries and clusters across independently reported cases.'],
              [Landmark,'Actionable exit engine','Prioritize candidate service endpoints using weighted, inspectable evidence.']
            ].map(([Icon,title,desc]:any)=>(
              <article key={title}><Icon size={23}/><h3>{title}</h3><p>{desc}</p></article>
            ))}
          </div>
        </section>

        <section className="architecture-section" id="architecture">
          <div>
            <div className="eyebrow">DESIGNED FOR INVESTIGATOR WORKFLOWS</div>
            <h2>Evidence at every step.<br/>Human judgment at the center.</h2>
            <p>A modular case and graph architecture connects reported wallets, behavioral signals and candidate attribution. Integration adapters demonstrate the path to authorized NCRP, SAHYOG and VASP workflows.</p>
            <div className="security-note">
              <Scale size={20}/>
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

        <section className="landing-cta">
          <div>
            <div className="eyebrow">THE 3-MINUTE INVESTIGATION</div>
            <h2>One reported wallet. Your next lead.</h2>
            <p>Open the complete synthetic investigation. Inspect the graph. Download the evidence report.</p>
          </div>
          <div style={{display:'flex',gap:12}}>
            <Button variant="secondary" onClick={()=>navigate('/login')}>Officer Login<LockKeyhole size={16}/></Button>
            <Button disabled={busy} onClick={()=>enter('/app/dashboard')}>Try live demo<ArrowUpRight size={17}/></Button>
          </div>
        </section>
      </>
    )}

    <footer className="landing-footer">
      <span>CRYPTO-TRACE INDIA <small>From Reported Wallet to Actionable Intelligence</small></span>
      <p>Independent SIH-style prototype. Fictional data and entities. Law enforcement intelligence engine.</p>
      <span>TRACE · ATTRIBUTE · CORRELATE · ACT</span>
    </footer>
  </div>;
}
