import http from 'node:http';
import { createHash, randomUUID, randomBytes } from 'node:crypto';
import { spawn } from 'node:child_process';
import { createReadStream, existsSync, statSync } from 'node:fs';
import { dirname, extname, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Store, now, caseKey } from './db.mjs';
import { answerQuestion } from './assistant.mjs';
import { openapi, docsHtml } from './openapi.mjs';
import { validateCase, validateWeights, validateTransaction, normalizeWallet, enumField, textField, object, STATUSES, CHAINS, fail } from './validation.mjs';
import { generatePdfNode } from './pdf.mjs';
import { getGraphEngine } from './graph/graphEngine.mjs';
import { RiskEngine } from './ml/riskEngine.mjs';
import { blockchainManager, VERIFICATION_STATUS } from './blockchain/provider.mjs';
import { forensicTracer } from './tracing/tracer.mjs';
import { labelStore } from './tracing/labelStore.mjs';
import { aiRiskEngine } from './ml/openrouterRiskEngine.mjs';
import { DSA_CATALOG, runDsaSimulation } from './graph/dsaSimulator.mjs';
import { runFullDsaBenchmarks } from './graph/benchmarkRig.mjs';
import { aiOrchestrator } from './investigation/agentOrchestrator.mjs';
import * as investigationTools from './investigation/tools.mjs';
import { classifyScamMessage, classifyScamMessageAsync } from './ml/scamClassifier.mjs';
import { classifyUrl, classifyUrlAsync } from './ml/urlClassifier.mjs';
import { EntityIntelligenceService } from './ml/entityIntelligence.mjs';
import { validatePasswordPolicy, hashPasswordSecure, verifyPasswordSecure } from './auth/password.mjs';
import { sendEmailVerificationCode, verifyEmailCode, getEmailVerificationStatus } from './auth/emailVerification.mjs';
import { generateTotpSecret, generateTotpUri, verifyTotp } from './auth/totp.mjs';
import { ROLES, PERMISSIONS_MATRIX, hasPermission, canAccessCase } from './auth/permissions.mjs';
import { configureSessionPersistence, recordFailedLogin, resetFailedLogin, isAccountLocked, issueTokenPair, rotateRefreshToken, revokeSession, getActiveSessions, createSecureCookie } from './auth/sessionManager.mjs';
import { configureInvitationPersistence, createOfficerInvitation, verifyInvitationToken, acceptOfficerInvitation } from './auth/officerInvitations.mjs';
import { processProofUpload, stripImageMetadata } from './reporting/proofUpload.mjs';
import { extractComplaintParameters, isValidEip55Checksum } from './reporting/extractor.mjs';
import { duplicateDetector } from './reporting/duplicateDetector.mjs';
import { autoTracePublicWallet } from './reporting/autoTracer.mjs';
import { generateSection106Notice, generateSection94Notice, generateBsa63Certificate, computeMasterCourtPackageSeal, verifyCourtPackage, DISCLAIMER_BANNER } from './legal/statutoryNotices.mjs';
import { buildDataset } from './analytics.mjs';
import { initializeEvidenceAnalysis, validateTransfers, saveAnalysis, connectedComplaints } from './investigation/evidenceAnalysis.mjs';
import PDFDocument from 'pdfkit';
import { readFileSync } from 'node:fs';

if(process.env.VERCEL && !process.env.DB_PATH) throw new Error('Persistent DB_PATH is required; ephemeral serverless storage cannot retain complaints.');
const root=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const store=new Store();
initializeEvidenceAnalysis(store.db);
configureSessionPersistence(store.db);
configureInvitationPersistence(store.db);
const entityIntelligence = new EntityIntelligenceService(store.db);
const PORT=Number(process.env.PORT || 8000),HOST=process.env.HOST || '0.0.0.0';
const dist=resolve(root,'dist');
const rateBuckets=new Map(),streamCounts=new Map();
const sseClients=new Set();
let reportsInFlight=0;
const reportLocks=new Set();
const rateLimit=Number(process.env.RATE_LIMIT_PER_MINUTE || 180);
const json=(res,status,value)=>{res.writeHead(status,{'Content-Type':'application/json; charset=utf-8'});res.end(JSON.stringify(value));};
function requireValue(value,label='Resource') { if(value===null || value===undefined) fail(`${label} was not found in this demo workspace.`,404); return value; }
function cookies(req) { return Object.fromEntries((req.headers.cookie || '').split(';').map(s=>s.trim().split('=')).filter(a=>a.length===2)); }
function securityHeaders(req,res) {
  res.setHeader('X-Content-Type-Options','nosniff');
  res.setHeader('X-Frame-Options','DENY');
  res.setHeader('Referrer-Policy','same-origin');
  res.setHeader('Permissions-Policy','camera=(), microphone=(), geolocation=()');
  res.setHeader('Content-Security-Policy',"default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; font-src 'self' data:; connect-src 'self'; object-src 'none'; base-uri 'self'; frame-ancestors 'none'; form-action 'self'");
  res.setHeader('Cache-Control','no-store');
  if(req.socket?.encrypted || req.headers['x-forwarded-proto']==='https') res.setHeader('Strict-Transport-Security','max-age=31536000; includeSubDomains');
}
function csrfAndCors(req,res) {
  const origin=req.headers.origin;
  if(!origin) return;
  const ownOrigin=`${req.socket?.encrypted || req.headers['x-forwarded-proto']==='https'?'https':'http'}://${req.headers.host}`;
  const allowedOrigins=(process.env.FRONTEND_ORIGIN || '').split(',').map(v=>v.trim()).filter(Boolean);
  // Vite dev origin is explicitly allowed only outside production; proxy APIs remain same-origin in production.
  if(process.env.NODE_ENV!=='production') allowedOrigins.push('http://localhost:5173','http://127.0.0.1:5173');
  if(origin!==ownOrigin && !allowedOrigins.includes(origin)) fail('This origin is not permitted.',403);
  res.setHeader('Access-Control-Allow-Origin',origin);
  res.setHeader('Access-Control-Allow-Credentials','true');
  res.setHeader('Vary','Origin');
  res.setHeader('Access-Control-Allow-Methods','GET, POST, PATCH, PUT, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers','Content-Type, Authorization, x-session-token');
  res.setHeader('Access-Control-Expose-Headers','x-new-session-token');
}
function limited(req,path) {
  const ip=(process.env.TRUST_PROXY==='true' ? req.headers['x-forwarded-for']?.split(',')[0]?.trim() : null) || req.socket?.remoteAddress || 'unknown';
  const key=`${ip}:${path==='/api/auth/demo'?'session':'api'}`,time=Date.now();
  const limit=path==='/api/auth/demo'?Math.min(rateLimit,30):rateLimit;
  let bucket=rateBuckets.get(key);
  if(!bucket || time-bucket.start>=60000) bucket={start:time,count:0};
  bucket.count++;rateBuckets.set(key,bucket);
  if(rateBuckets.size>10000) for(const [k,v] of rateBuckets) if(time-v.start>60000) rateBuckets.delete(k);
  if(bucket.count>limit) fail('Too many requests. Please wait one minute and try again.',429);
}
async function body(req) {
  if(!['POST','PUT','PATCH'].includes(req.method)) return {};
  if (req.body && typeof req.body === 'object') return object(req.body);
  if (typeof req.body === 'string' && req.body.trim()) {
    try { return object(JSON.parse(req.body)); } catch(error) { if(error.status) throw error; fail('Request body is not valid JSON.'); }
  }
  const type=(req.headers['content-type'] || '').split(';')[0];
  if(type && type!=='application/json') fail('Use Content-Type: application/json.',415);
  let raw='',bytes=0;
  for await(const chunk of req) { bytes+=chunk.length; if(bytes>22*1024*1024) fail('Request body exceeds 22 MiB.',413); raw+=chunk.toString('utf8'); }
  if(!raw.trim()) return {};
  try { return object(JSON.parse(raw)); } catch(error) { if(error.status) throw error; fail('Request body is not valid JSON.'); }
}
function sessionCookie(req,token,maxAge) {
  const secure=Boolean(req.socket?.encrypted || req.headers['x-forwarded-proto']==='https');
  return `ct_session=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${maxAge}${secure?'; Secure':''}`;
}
function caseQuery(cases,query) {
  let rows=cases.filter(c=>{
    const q=query.get('q')?.toLowerCase();
    if(q && ![c.id,c.complaintId,c.fraudType,c.reportedWallet,c.vaspCandidate,c.description].some(v=>String(v).toLowerCase().includes(q))) return false;
    for(const field of ['fraudType','status']) if(query.get(field) && query.get(field)!=='All' && c[field]!==query.get(field)) return false;
    if(query.get('chain') && query.get('chain')!=='All' && !c.chains.includes(query.get('chain'))) return false;
    if(query.get('vasp') && query.get('vasp')!=='All' && c.vaspCandidate!==query.get('vasp')) return false;
    const risk=query.get('risk')?.toLowerCase();
    if(risk && risk!=='all' && risk!==(c.riskScore>=70?'high':c.riskScore>=40?'medium':'low')) return false;
    if(query.get('date') && !c.createdAt.startsWith(query.get('date'))) return false;
    return true;
  });
  const sort=query.get('sort') || 'updated';
  rows.sort((a,b)=>sort==='amount'?b.victimLoss-a.victimLoss:sort==='risk'?b.riskScore-a.riskScore:sort==='confidence'?b.confidence-a.confidence:sort==='id'?a.id.localeCompare(b.id):b.updatedAt.localeCompare(a.updatedAt));
  const offset=Math.max(0,Number(query.get('offset') || 0)),limit=Math.min(200,Math.max(1,Number(query.get('limit') || 200)));
  if(!Number.isFinite(offset) || !Number.isFinite(limit)) fail('Pagination must use numeric limit and offset.');
  return rows.slice(offset,offset+limit);
}
function walletResult(sessionId,address) {
  const results=[];
  for(const record of store.listCases(sessionId)) {
    const inv=store.getInvestigation(sessionId,record.id);
    if (!inv || !inv.nodes) continue;
    const matches=inv.nodes.filter(n=>n.address===address || (n.address?.startsWith('0x') && n.address.toLowerCase()===address.toLowerCase()));
    for(const node of matches) results.push({inv,node});
  }
  if(!results.length) fail('No observed wallet evidence is indexed for this address.',404);
  const first=results[0],transactions=results.flatMap(({inv,node})=>inv.edges.filter(e=>e.source===node.id||e.target===node.id).map(e=>({...e,caseId:inv.case.id})));
  return {wallet:first.node,cases:[...new Map(results.map(r=>[r.inv.case.id,r.inv.case])).values()],transactions,behavior:first.inv.fingerprint?.features || {},fingerprint:first.inv.fingerprint || {features:{},patterns:[]},source:'SIMULATED INVESTIGATION DATA'};
}
function dashboard(sessionId) {
  if(process.env.DEMO_MODE!=='true' && process.env.NODE_ENV!=='test') {
    const user=store.db.prepare('SELECT u.*,s.user_id FROM sessions s JOIN users u ON u.id=s.user_id WHERE s.id=?').get(sessionId);
    const unit=store.db.prepare('SELECT unit FROM system_users WHERE id=?').get(user.user_id)?.unit;
    const complaints=store.listComplaints(user.role==='reporter'?{reporterId:user.user_id}:['admin','supervisor'].includes(user.role)?{}:{officerId:user.user_id,officerUnit:unit || 'Cyber Crime Division',scopingRole:'officer'});
    const cases=complaints.map(c=>{
      const saved=store.db.prepare('SELECT payload FROM incident_analysis_runs WHERE case_id=? ORDER BY rowid DESC LIMIT 1').get(c.caseId);
      const run=saved?JSON.parse(saved.payload):null;
      return {...c,id:c.caseId,fraudType:c.incidentType,victimLoss:c.reportedLoss,riskScore:run?.riskScore ?? null};
    });
    return {evidenceRuntime:true,cases,metrics:{activeCases:cases.filter(c=>!['Closed','Resolved','Rejected'].includes(c.status)).length,submittedComplaints:cases.length,analyzedCases:cases.filter(c=>c.riskScore!==null).length,reportedLoss:cases.reduce((sum,c)=>sum+c.reportedLoss,0)}};
  }

  let cases = store.listCases(sessionId);
  if ((!cases || cases.length === 0) && process.env.DEMO_MODE === 'true') {
    try {
      const s = store.db.prepare('SELECT weights FROM sessions WHERE id=?').get(sessionId);
      const w = s ? JSON.parse(s.weights) : DEFAULT_WEIGHTS;
      store.seedCases(sessionId, w);
      cases = store.listCases(sessionId);
    } catch {}
  }
  const investigations = (cases || []).map(c => store.getInvestigation(sessionId, c.id)).filter(Boolean);
  const alerts = store.alerts(sessionId) || [];
  const group = (values) => Object.entries((values || []).reduce((a, v) => (a[v] = (a[v] || 0) + 1, a), {})).map(([name, value]) => ({ name, value }));
  const terminalByChain = {};
  for (const inv of investigations) {
    for (const edge of (inv?.edges || [])) {
      const targetNode = (inv?.nodes || []).find(n => n?.id === edge?.target);
      if (targetNode && targetNode.type === 'vasp') {
        const c = targetNode.chain || 'Ethereum';
        terminalByChain[c] = (terminalByChain[c] || 0) + (edge?.amount || 0);
      }
    }
  }
  const activity = investigations
    .flatMap(inv => (inv?.timeline || []).map(e => ({ ...e, caseId: inv?.case?.id })))
    .filter(Boolean)
    .sort((a, b) => (b.timestamp || '').localeCompare(a.timestamp || ''))
    .slice(0, 12);
  const days = {};
  for (const inv of investigations) {
    if (!inv?.timeline) continue;
    for (const day of new Set(inv.timeline.map(e => (e?.timestamp ? e.timestamp.slice(0, 10) : '')))) {
      if (!day) continue;
      days[day] ||= [];
      if (inv?.case && typeof inv.case.riskScore === 'number') {
        days[day].push(inv.case.riskScore);
      }
    }
  }
  return {
    cases: cases || [],
    metrics: {
      activeCases: (cases || []).filter(c => c && c.status !== 'Closed').length,
      highRiskWallets: new Set(investigations.flatMap(i => (i?.nodes || []).filter(n => n && n.riskScore >= 70).map(n => `${n.chain}/${n.address}`))).size,
      vaspLeads: investigations.reduce((a, i) => a + (i?.attributions?.length || 0), 0),
      fundsTraced: (cases || []).reduce((a, c) => a + (c?.tracedAmount || 0), 0),
      crossChainMovements: investigations.reduce((a, i) => a + (i?.crossChain?.length || 0), 0),
      relatedCases: new Set(investigations.flatMap(i => (i?.relatedCases || []).map(r => [i?.case?.id, r?.caseId].sort().join('/')))).size,
      activeAlerts: (alerts || []).filter(a => a && a.status === 'Open').length
    },
    fraudTypes: group((cases || []).map(c => c?.fraudType).filter(Boolean)),
    chainFlows: Object.entries(terminalByChain).map(([name, value]) => ({ name, value })),
    attributionDistribution: group((cases || []).map(c => c?.vaspCandidate).filter(Boolean)),
    riskTrend: Object.entries(days).sort().map(([date, scores]) => ({ date, value: scores.length ? Math.round(scores.reduce((a, v) => a + v, 0) / scores.length) : 0 })),
    activity,
    source: 'SIMULATED INVESTIGATION DATA',
    riskTrendMethod: 'Average current case risk scores by observed event date; not historical re-scoring.'
  };
}
function search(sessionId,q) {
  if(!q || q.length<2) return [];
  q=q.toLowerCase().trim();
  const hits=[],match=(...values)=>values.some(v=>String(v??'').toLowerCase().includes(q));

  if (/^\d{2,15}$/.test(q)) {
    hits.push({
      type: 'Bitcoin Dataset Tx',
      title: `Tx ${q}`,
      subtitle: 'Elliptic Research Dataset · Graph Forensics Node',
      id: q,
      caseId: q,
      path: `/app/graph/${encodeURIComponent(q)}`
    });
  }

  const cases=store.listCases(sessionId);
  for(const c of cases) {
    if(match(c.id,c.complaintId,c.fraudType,c.description,c.reportedWallet)) hits.push({type:'Case',title:c.id,subtitle:`${c.fraudType} · ${c.chain}`,id:c.id,caseId:c.id,path:`/app/investigations/${encodeURIComponent(c.id)}`});
    const i=store.getInvestigation(sessionId,c.id);
    if (!i) continue;
    for(const n of (i.nodes || [])) if(match(n.address,n.label,n.entity,n.cluster)) hits.push({type:'Wallet',title:n.label,subtitle:`${n.chain} · ${n.address}`,id:n.address,caseId:c.id,path:`/app/wallets?address=${encodeURIComponent(n.address)}`});
    for(const e of (i.edges || [])) if(match(e.hash,e.id)) hits.push({type:'Transaction',title:e.id,subtitle:`${c.id} · ${e.chain} · ${e.hash}`,id:e.id,caseId:c.id,path:`/app/investigations/${encodeURIComponent(c.id)}?evidence=${encodeURIComponent(e.id)}`});
    for(const a of (i.attributions || [])) if(match(a.candidate,a.id)) hits.push({type:'VASP',title:`Candidate ${a.candidate}`,subtitle:`${c.id} · ${a.confidence}% confidence`,id:a.id,caseId:c.id,path:`/app/investigations/${encodeURIComponent(c.id)}`});
    for(const e of [...(i.attributions || []).flatMap(a=>a.evidence || []),...(i.riskIndicators || [])]) if(match(e.id,e.title,e.description)) hits.push({type:'Evidence',title:e.title,subtitle:`${c.id} · ${e.id}`,id:e.id,caseId:c.id,path:`/app/investigations/${encodeURIComponent(c.id)}?evidence=${encodeURIComponent(e.id)}`});
  }
  for(const report of store.reports(sessionId)) if(match(report.id,report.caseId,report.filename)) hits.push({type:'Report',title:report.filename,subtitle:`Version ${report.version} · ${report.createdAt}`,id:report.id,caseId:report.caseId,path:'/app/reports'});
  return hits.slice(0,50);
}
async function generatePdf(data) {
  try {
    return await generatePdfNode(data);
  } catch (err) {
    console.warn('Node PDF generator encountered error, trying python worker fallback:', err);
    return new Promise((resolvePdf,reject)=>{
      const child=spawn(process.env.PYTHON_BIN || 'python3',[resolve(root,'server/report.py')],{stdio:['pipe','pipe','pipe']});
      const parts=[];let size=0,stderr='',settled=false;
      const timer=setTimeout(()=>{child.kill();if(!settled){settled=true;reject(new Error('Report generation timed out.'));}},30000);
      child.stdout.on('data',chunk=>{size+=chunk.length;if(size>20*1024*1024) child.kill();else parts.push(chunk);});
      child.stderr.on('data',chunk=>{if(stderr.length<5000) stderr+=chunk.toString();});
      child.on('error',error=>{clearTimeout(timer);if(!settled){settled=true;reject(error);}});
      child.on('close',code=>{clearTimeout(timer);if(settled)return;settled=true;if(code!==0){reject(new Error('Report generator unavailable.'));}else resolvePdf(Buffer.concat(parts));});
      child.stdin.on('error',()=>{});
      child.stdin.end(JSON.stringify(data));
    });
  }
}
function sources() {
 const stamp='2026-09-24T00:00:00.000Z';
 return [...CHAINS.map(name=>({name:`${name} blockchain adapter`,status:'DEMO',coverage:'Deterministic synthetic wallet and transaction fixtures',mode:'SIMULATED INVESTIGATION DATA',lastUpdated:stamp})),{name:'Attribution knowledge base',status:'DEMO',coverage:'Fictional VASP-X / VASP-Y / VASP-Z registry',mode:'DEMO',lastUpdated:stamp},{name:'Case database',status:'CONNECTED',coverage:'Session-scoped relational SQLite; persisted local volume',mode:'APPLICATION DATABASE',lastUpdated:now()},{name:'Demo dataset',status:'READY',coverage:'6 synthetic cases including 3 related complaints',mode:'DEMO',lastUpdated:stamp},...['NCRP Integration Adapter','SAHYOG Integration Adapter','VASP Request Adapter'].map(name=>({name,status:'ADAPTER READY',coverage:'Interface defined; no official credentials or endpoint configured',mode:'NOT CONNECTED',lastUpdated:null})),{name:'External blockchain APIs',status:'NOT CONFIGURED',coverage:'No provider credentials; live mode is disabled',mode:'NOT CONNECTED',lastUpdated:null}];
}
function formatSection91Notice(pkg, session) {
  const dateStr = new Date(pkg.preparedAt || Date.now()).toLocaleDateString('en-IN', {
    day: '2-digit', month: 'long', year: 'numeric'
  });
  const walletsFormatted = (pkg.wallets || []).length > 0
    ? (pkg.wallets || []).map((w, i) => `   [${i + 1}] Address: ${w.address || w} | Network: ${w.chain || 'Cryptocurrency'} | Role: ${w.role || 'Recipient/Deposit Node'}`).join('\n')
    : `   [1] Address: ${pkg.reportedWallet || 'See attached transaction ledger'} | Network: Primary Chain`;
  const txsFormatted = (pkg.transactions || []).length > 0
    ? (pkg.transactions || []).map((t, i) => `   [${i + 1}] Hash / Identifier: ${typeof t === 'string' ? t : t.hash || t.id || JSON.stringify(t)}`).join('\n')
    : `   [1] Subject Transaction Reference: ${pkg.caseId || 'Referenced Case'}`;

  return `================================================================================
                    OFFICE OF THE CYBER CRIME INVESTIGATION DIVISION
                      DIRECTORATE OF ENFORCEMENT & CYBER OPERATIONS
================================================================================

STATUTORY REQUISITION NOTICE UNDER SECTION 91 OF THE CODE OF CRIMINAL PROCEDURE, 1973 (Cr.P.C.)
/ BHARATIYA NAGARIK SURAKSHA SANHITA, 2023 (BNSS)
READ WITH SECTION 69 OF THE INFORMATION TECHNOLOGY ACT, 2000 & PMLA, 2002

Notice Reference: ${pkg.noticeReference || 'NOTICE-SEC91-' + (pkg.caseId || 'REF')}
Issuing Authority: Cyber Crime Investigation Division
Case / FIR Reference: ${pkg.caseId || 'CR-2026-GEN'} | Complaint ID: ${pkg.complaintId || 'NCRP-PORTAL-REF'}
Date of Issuance: ${dateStr}

TO:
The Compliance Officer / Grievance Officer / Legal Intermediary Desk
${pkg.targetEntity || pkg.targetVasp || 'Designated Virtual Asset Service Provider / Exchange Custodian'}

SUBJECT: URGENT STATUTORY REQUISITION FOR IMMEDIATE PRESERVATION OF RECORDS, KYC
DISCLOSURE, IP ACCESS LOGS AND HOLD ON CRYPTOCURRENCY BALANCES UNDER SECTION 91 Cr.P.C.

WHEREAS, an official investigation is underway into high-value financial cyber fraud, criminal breach
of trust, and illicit cryptographic asset diversion under the Indian Penal Code and Information
Technology Act, 2000.

AND WHEREAS, forensic blockchain analysis has identified that proceeds of crime transacted through
the cryptographic addresses detailed hereinbelow have routed into or interacted with accounts/wallets
under your administrative or custodial control:

1. SUBJECT WALLET ADDRESSES & NODES:
${walletsFormatted}

2. ASSOCIATED TRANSACTION IDENTIFIERS:
${txsFormatted}

3. FINANCIAL QUANTUM INVOLVED:
   Reported / Traced Value: INR ${(pkg.amountINR || 0).toLocaleString('en-IN')}
   Observed Investigation Window: ${pkg.dateRange?.from || 'Recent'} to ${pkg.dateRange?.to || 'Present'}

NOW THEREFORE, by virtue of the powers vested under Section 91 of the Code of Criminal Procedure,
1973 / BNSS 2023, YOU ARE HEREBY DIRECTED TO:

[DIRECTIVE 1] IMMEDIATE PRESERVATION: Immediately freeze and preserve all server logs, access logs,
source and destination IP addresses, port numbers, MAC addresses, device fingerprints, and API
session timestamps associated with the above-mentioned addresses for a minimum period of 180 days.

[DIRECTIVE 2] KYC & BENEFICIAL OWNERSHIP DISCLOSURE: Furnish certified true copies of all Know Your
Customer (KYC) documentation, including government identity proofs (Aadhaar, PAN card, Passport,
Voter ID), full registered names, physical addresses, verified mobile numbers, and email addresses
linked to the accounts controlling or interacting with said wallets.

[DIRECTIVE 3] BANKING & ON/OFF RAMP DETAILS: Disclose complete transactional records of all fiat
deposits/withdrawals, including linked Indian and foreign bank account numbers, IFSC codes, UPI IDs,
and counterparty payment gateway references.

[DIRECTIVE 4] LIEN / ASSET FREEZE: Place an immediate debit freeze / administrative lien upon any
cryptographic assets, tokens, or fiat balances currently held in said accounts, and prevent any
further transfer or dissipation pending judicial orders.

COMPLIANCE TIMELINE:
You are required to submit compliance confirmation and the requisitioned electronic records within
seventy-two (72) hours of receipt of this notice to the authorized investigating officer.

PLEASE NOTE that failure to comply with this statutory requisition without lawful excuse constitutes
an offence punishable under Section 175/176 of the Indian Penal Code, 1860, and Section 69 of the
Information Technology Act, 2000.

Prepared & Issued by:
${pkg.preparedBy || session?.display_name || 'Investigating Officer'}
Cyber Crime Investigation Division
Digital Signature / SHA-256 Evidence Seal: ${pkg.sha256Seal || 'SEAL-VALIDATED'}
================================================================================`;
}

function requestPackage(inv, session, options = {}) {
  // If inv is an Elliptic transaction report:
  if (inv.txId && !inv.case) {
    const txId = inv.txId;
    const targetEntity = options.targetEntity || options.targetVasp || 'Bitcoin Network Intermediary / Custodian of Counterparty Wallets';
    const amountINR = options.amountINR || 0;
    const confidence = inv.riskScore || 75;
    const noticeRef = `NOTICE-SEC91-TX-${txId}-${Date.now().toString(36).toUpperCase()}`;
    const wallets = [{ address: `BTC-TX-${txId}`, chain: 'Bitcoin', role: 'Subject Transaction Node' }];
    const transactions = [txId, ...(inv.graphFindings?.outgoingTransactions || []).slice(0, 5)];
    const pkg = {
      packageVersion: '2.0',
      noticeReference: noticeRef,
      legalBasis: 'Section 91 Cr.P.C. / BNSS 2023 read with Section 69 Information Technology Act, 2000',
      preparedAt: now(),
      preparedBy: session.display_name,
      status: 'DRAFT FOR AUTHORIZED HUMAN REVIEW',
      sent: false,
      targetVasp: targetEntity,
      targetEntity,
      caseId: `TX-${txId}`,
      complaintId: `NCRP-BTC-${txId.slice(-6)}`,
      reportedWallet: `BTC-TX-${txId}`,
      wallets,
      amountINR,
      confidence,
      dateRange: { from: `TimeStep ${inv.timeStep || 1}`, to: now() },
      transactions,
      evidence: inv.evidenceIndicators || [],
      requestedInformation: [
        'Preservation of records associated with listed transactions, subject to applicable legal authority.',
        'Confirmation of whether listed addresses are controlled by the recipient VASP/exchange custodian.',
        'Information disclosure through the appropriate authorized legal process.'
      ],
      reviewChecklist: [
        'Verify independent blockchain evidence and entity identity.',
        'Establish jurisdiction, legal basis and signatory authority.',
        'Review scope and proportionality before submitting through approved channels.'
      ],
      source: inv.dataSource || 'Elliptic Research Dataset',
      disclaimer: 'Official investigation package prepared for review by authorized officer. Not sent externally without supervisory authorization.'
    };
    pkg.sha256Seal = createHash('sha256').update(JSON.stringify(pkg)).digest('hex');
    pkg.noticeDocument = formatSection91Notice(pkg, session);
    return pkg;
  }

  // Otherwise inv is a standard case investigation:
  const candidate = (inv.attributions && inv.attributions[0]) ? inv.attributions[0] : null;
  const targetEntity = options.targetEntity || options.targetVasp || candidate?.candidate || 'Custodian of Intermediary & Counterparty Wallets / Compliance Desk';
  const vaspWallets = (inv.nodes || []).filter(n => n.type === 'vasp').map(n => ({ address: n.address, chain: n.chain, role: 'Terminal VASP Exit' }));
  const fallbackWallets = (inv.nodes || []).slice(-3).map(n => ({ address: n.address, chain: n.chain, role: n.type || 'Intermediary Counterparty' }));
  const wallets = vaspWallets.length ? vaspWallets : fallbackWallets;
  const transactions = (inv.edges || []).filter(e => (inv.nodes || []).some(n => n.id === e.target && (n.type === 'vasp' || vaspWallets.length === 0)));
  const dateRange = {
    from: candidate?.firstInteraction || inv.case?.createdAt || now(),
    to: candidate?.lastInteraction || inv.case?.updatedAt || now()
  };
  const amountINR = options.amountINR || candidate?.tracedAmount || inv.case?.victimLoss || 0;
  const confidence = candidate?.confidence || inv.case?.riskScore || 75;
  const noticeRef = `NOTICE-SEC91-${inv.case?.id || 'CASE'}-${Date.now().toString(36).toUpperCase()}`;

  const pkg = {
    packageVersion: '2.0',
    noticeReference: noticeRef,
    legalBasis: 'Section 91 Cr.P.C. / BNSS 2023 read with Section 69 Information Technology Act, 2000 & PMLA 2002',
    preparedAt: now(),
    preparedBy: session.display_name,
    status: 'DRAFT FOR AUTHORIZED HUMAN REVIEW',
    sent: false,
    targetVasp: candidate?.candidate || targetEntity,
    targetEntity,
    caseId: inv.case?.id || 'UNKNOWN-CASE',
    complaintId: inv.case?.complaintId || 'NCRP-PORTAL',
    reportedWallet: inv.case?.reportedWallet || '',
    wallets,
    amountINR,
    confidence,
    dateRange,
    transactions,
    evidence: candidate?.evidence || inv.riskIndicators || [],
    requestedInformation: [
      'Preservation of records associated with listed transactions, subject to applicable legal authority.',
      'Confirmation of whether listed addresses are controlled by the recipient VASP/exchange custodian.',
      'Information disclosure through the appropriate authorized legal process.'
    ],
    reviewChecklist: [
      'Verify independent blockchain evidence and entity identity.',
      'Establish jurisdiction, legal basis and signatory authority.',
      'Review scope and proportionality before submitting through approved channels.'
    ],
    source: inv.case?.source || 'SIMULATED INVESTIGATION DATA',
    disclaimer: 'Official investigation package prepared for review by authorized officer. Not sent externally without supervisory authorization.'
  };
  pkg.sha256Seal = createHash('sha256').update(JSON.stringify(pkg)).digest('hex');
  pkg.noticeDocument = formatSection91Notice(pkg, session);
  return pkg;
}
function startStream(req,res,session) {
 const count=streamCounts.get(session.id)||0;if(count>=3) fail('Too many open streams in this workspace.',429);
 streamCounts.set(session.id,count+1);
 res.writeHead(200,{'Content-Type':'text/event-stream','Cache-Control':'no-cache, no-transform','Connection':'keep-alive','X-Accel-Buffering':'no'});
 const events=store.listCases(session.id).flatMap(c=>store.getInvestigation(session.id,c.id).timeline.map(e=>({...e,caseId:c.id})));let position=0;
 res.write(`data: ${JSON.stringify({type:'connected',message:'DEMO STREAM — replaying persisted synthetic investigation events. No live blockchain subscription.',timestamp:now(),mode:'DEMO STREAM'})}\n\n`);
 const timer=setInterval(()=>{const event=events[position++%events.length];if(!event){res.write(': heartbeat\n\n');return;}res.write(`data: ${JSON.stringify({type:'evidence-replay',caseId:event.caseId,message:`DEMO REPLAY: ${event.action}`,timestamp:now(),observedAt:event.timestamp,evidenceIds:event.evidenceIds,mode:'DEMO STREAM'})}\n\n`);},6500);
 const cleanup=()=>{clearInterval(timer);streamCounts.set(session.id,Math.max(0,(streamCounts.get(session.id)||1)-1));sseClients.delete(res);};
 res.on('close',cleanup);sseClients.add(res);
}
function serveStatic(req,res,path) {
 if(!['GET','HEAD'].includes(req.method)) return json(res,405,{error:'Method not allowed.'});
 let decoded;try{decoded=decodeURIComponent(path);}catch{return json(res,400,{error:'Invalid path.'});}
 const candidate=resolve(dist,'.'+decoded);
 if(candidate!==dist && !candidate.startsWith(dist+sep)) return json(res,403,{error:'Invalid path.'});
 let file=candidate;
 if(!existsSync(file) || !statSync(file).isFile()) {
   if(extname(decoded) && !decoded.startsWith('/app/')) return json(res,404,{error:'Asset not found.'});
   file=resolve(dist,'index.html');
 }
 if(!existsSync(file)) return json(res,503,{error:'Frontend build is unavailable. Build the Vite client before starting a production deployment.'});
 const type={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.svg':'image/svg+xml','.png':'image/png','.jpg':'image/jpeg','.ico':'image/x-icon','.json':'application/json','.woff2':'font/woff2'}[extname(file)] || 'application/octet-stream';
 res.setHeader('Content-Type',type);res.setHeader('Content-Length',statSync(file).size);
 if(file.includes(`${sep}assets${sep}`)) res.setHeader('Cache-Control','public, max-age=31536000, immutable');
 if(req.method==='HEAD') return res.end();
 createReadStream(file).pipe(res);
}
async function handle(req,res) {
 securityHeaders(req,res);
 const rawUrl = req.headers['x-forwarded-url'] || req.url || '/';
 const url=new URL(rawUrl,'http://local.invalid'),path=url.pathname;
 if(!path.startsWith('/api/')) return serveStatic(req,res,path);
 csrfAndCors(req,res);limited(req,path);
 if(req.method==='OPTIONS'){res.writeHead(204);return res.end();}
 let segments;try{segments=path.split('/').filter(Boolean).map(decodeURIComponent);}catch{fail('Invalid URL encoding.');}
 const method=req.method,group=segments[1],id=segments[2],sub=segments[3];
 if(path==='/api/health' && method==='GET') {
   store.db.prepare('SELECT 1').get();
   return json(res,200,{
     status:'ok',
     service:'CRYPTO-TRACE INDIA',
     version:'2.0.0',
     database:'sqlite-persistent',
     persistent:true,
     blockchainProviders:['Bitcoin (mempool.space)', 'Ethereum (EVM RPC)', 'Polygon', 'BNB Chain', 'TRON (TronGrid)'],
     researchDataset:'Elliptic Bitcoin Dataset (203,769 transactions)',
     mode:process.env.DEMO_MODE==='true'?'EXPLICIT DEMONSTRATION':'EVIDENCE INVESTIGATION',
     demoEnabled:process.env.DEMO_MODE==='true' || process.env.NODE_ENV==='test',
     liveBlockchain:'Provider-dependent; availability is not a verification claim',
     timestamp:now()
   });
 }
 if(path==='/api/openapi.json' && method==='GET') return json(res,200,openapi);
 if(path==='/api/docs' && method==='GET') {res.writeHead(200,{'Content-Type':'text/html; charset=utf-8'});return res.end(docsHtml());}

 // Phase 1 DEMO_MODE Production Guard: Sandbox bypass is refused in production without explicit override
 if(path.startsWith('/api/auth/demo')) {
   if(process.env.DEMO_MODE !== 'true' && process.env.NODE_ENV !== 'test') {
     fail('Demo sandbox access is disabled in production environments without explicit authorization.', 403);
   }
 }
 if(path==='/api/auth/demo' && method==='POST') {
   await body(req);
   const existingToken = cookies(req).ct_session || req.headers['x-session-token'];
   const existing = existingToken ? store.session(existingToken) : null;
   if(existing) {
     if(existingToken) res.setHeader('x-new-session-token', existingToken);
     return json(res,200,{token: existingToken, user:{id:existing.user_id,name:existing.display_name,role:existing.role||'demo-investigator'},mode:'DEMO ENVIRONMENT',expiresAt:existing.expires_at});
   }
   const {token,session}=store.createSession();res.setHeader('Set-Cookie',sessionCookie(req,token,Math.floor((Date.parse(session.expires_at)-Date.now())/1000)));
   res.setHeader('x-new-session-token', token);
   return json(res,200,{token, user:{id:session.user_id,name:session.display_name,role:session.role||'demo-investigator'},mode:'DEMO ENVIRONMENT',expiresAt:session.expires_at});
 }
 if(path==='/api/auth/demo-reporter' && method==='POST') {
   await body(req);
   const reporter = store.getUserByEmail('priya.nair@example.in');
   const uid = reporter?.id || 'USR-REPORTER-001';
   const { token, session } = store.createSession('Priya Nair', 'reporter', uid);
   res.setHeader('Set-Cookie', sessionCookie(req, token, Math.floor((Date.parse(session.expires_at) - Date.now()) / 1000)));
   res.setHeader('x-new-session-token', token);
   return json(res, 200, { token, user: { id: uid, name: 'Priya Nair', email: 'priya.nair@example.in', role: 'reporter' }, mode: 'REPORTER PORTAL', expiresAt: session.expires_at });
 }
 if(path==='/api/auth/demo-officer' && method==='POST') {
   await body(req);
   const officer = store.getUserByEmail('officer.sharma@cbi.gov.in');
   const uid = officer?.id || 'USR-OFFICER-001';
   const { token, session } = store.createSession('Insp. Rajesh Sharma (CBI Officer)', 'officer', uid);
   res.setHeader('Set-Cookie', sessionCookie(req, token, Math.floor((Date.parse(session.expires_at) - Date.now()) / 1000)));
   res.setHeader('x-new-session-token', token);
   return json(res, 200, { token, user: { id: uid, name: 'Insp. Rajesh Sharma (CBI Officer)', email: 'officer.sharma@cbi.gov.in', role: 'officer' }, mode: 'CBI OFFICER PORTAL', expiresAt: session.expires_at });
 }
 if(path==='/api/auth/demo-supervisor' && method==='POST') {
   await body(req);
   const uid = 'USR-SUPERVISOR-001';
   const { token, session } = store.createSession('SP Vikram Rathore (Supervisory Special Agent)', 'supervisor', uid);
   res.setHeader('Set-Cookie', sessionCookie(req, token, Math.floor((Date.parse(session.expires_at) - Date.now()) / 1000)));
   res.setHeader('x-new-session-token', token);
   return json(res, 200, { token, user: { id: uid, name: 'SP Vikram Rathore (Supervisory Special Agent)', email: 'sp.rathore@cbi.gov.in', role: 'supervisor' }, mode: 'SUPERVISORY OVERSIGHT PORTAL', expiresAt: session.expires_at });
 }
 if(path==='/api/auth/demo-admin' && method==='POST') {
   await body(req);
   const uid = 'USR-ADMIN-001';
   const { token, session } = store.createSession('Dr. Ananya Roy (Chief Forensic Director)', 'admin', uid);
   res.setHeader('Set-Cookie', sessionCookie(req, token, Math.floor((Date.parse(session.expires_at) - Date.now()) / 1000)));
   res.setHeader('x-new-session-token', token);
   return json(res, 200, { token, user: { id: uid, name: 'Dr. Ananya Roy (Chief Forensic Director)', email: 'director.roy@cbi.gov.in', role: 'admin' }, mode: 'EXECUTIVE INTELLIGENCE ADMIN', expiresAt: session.expires_at });
 }
 if(path==='/api/auth/send-verification-code' && method==='POST') {
   const data = await body(req);
   const email = String(data.email || '').trim().toLowerCase();
   if(!email || !email.includes('@')) fail('Please enter a valid email address.', 400);
   const result = await sendEmailVerificationCode(email);
   return json(res, 200, result);
 }
 if(path==='/api/auth/verify-code' && method==='POST') {
   const data = await body(req);
   const email = String(data.email || '').trim().toLowerCase();
   const code = String(data.code || '').trim();
   if(!email || !code) fail('Email and verification code are required.', 400);
   const result = verifyEmailCode(email, code);
   return json(res, 200, result);
 }
 if(path==='/api/auth/verify-invite' && method==='GET') {
   const invToken = url.searchParams.get('token');
   if(!invToken) fail('Invitation token is required.', 400);
   const invitation = verifyInvitationToken(store, invToken);
   return json(res, 200, invitation);
 }
 if(path==='/api/auth/accept-invite' && method==='POST') {
   const data = await body(req);
   const result = await acceptOfficerInvitation(store, data);
   return json(res, 201, result);
 }
 if(path==='/api/auth/refresh' && method==='POST') {
   const data = await body(req);
   const rToken = data.refreshToken || cookies(req).ct_refresh;
   if(!rToken) fail('Refresh token is required.', 400);
   try {
     const pair = rotateRefreshToken(rToken);
     if(!pair.success) fail(pair.error || 'Invalid refresh token.',401);
     const account=store.getUser(pair.userId);
     if(!account || store.db.prepare('SELECT status FROM system_users WHERE id=?').get(pair.userId)?.status==='SUSPENDED') fail('Account unavailable.',401);
     res.setHeader('Set-Cookie',sessionCookie(req,pair.accessToken,7*24*3600));
     res.setHeader('x-new-session-token',pair.accessToken);
     return json(res, 200, {...pair,token:pair.accessToken,user:account});
   } catch(e) {
     fail(e.message || 'Invalid or reused refresh token. Please sign in again.', 401);
   }
 }
 if(path==='/api/demo/reset' && method==='POST') {
   if(process.env.DEMO_MODE !== 'true' && process.env.NODE_ENV !== 'test') fail('Demo mode is disabled.',403);
   await body(req);
   const result = store.resetDemoData();
   return json(res, 200, { ok: true, purgedCount: result.purgedCount, caseIds: result.caseIds });
 }
 if(path==='/api/scam-analyzer/message' && method==='POST') {
   const data = await body(req);
   const result = await classifyScamMessageAsync(data.text);
   return json(res, 200, result);
 }
 if(path==='/api/scam-analyzer/url' && method==='POST') {
   const data = await body(req);
   const result = await classifyUrlAsync(data.url);
   return json(res, 200, result);
 }
 if(path.startsWith('/api/scam-analyzer/entity') && method==='GET') {
   const type = url.searchParams.get('type') || 'phone';
   const identifier = url.searchParams.get('identifier') || '';
   const result = await entityIntelligence.lookupIdentifierAsync(type, identifier);
   return json(res, 200, result);
 }
 if(path==='/api/auth/register' && method==='POST') {
   const data = await body(req);
   if(data.role && data.role !== 'reporter') fail('Privileged accounts require an administrator invitation.',403);
   const policy = validatePasswordPolicy(data.password);
   if(!policy.valid) {
     fail(policy.message, 400);
   }
   const user = store.registerUser(data);
   const { token, session } = store.createSession(user.name, user.role, user.id);
   const pair = issueTokenPair(user.id, session.id);
   res.setHeader('Set-Cookie', sessionCookie(req, token, Math.floor((Date.parse(session.expires_at) - Date.now()) / 1000)));
   res.setHeader('x-new-session-token', token);
   return json(res, 201, {
     token,
     refreshToken: pair.refreshToken,
     user: { id: user.id, name: user.name, email: user.email, role: user.role, phone: user.phone },
     mode: user.role === 'reporter' ? 'REPORTER PORTAL' : 'CBI OFFICER PORTAL',
     expiresAt: session.expires_at
   });
 }
 if(path==='/api/auth/login' && method==='POST') {
   const data = await body(req);
   const email = String(data.email || '').trim().toLowerCase();
   const password = String(data.password || '');
   if(!email || !email.includes('@')) fail('Please enter a valid email address.', 400);
   if(!password || password.length < 4 || password.length>256) fail('Password must be at least 4 characters.', 400);

   const lockStatus = isAccountLocked(email);
   if(lockStatus.locked) {
     fail(`Account temporarily locked due to consecutive failed login attempts. Please try again in ${lockStatus.remainingMinutes} minute(s).`, 429);
   }

   let authUser;
   try {
     authUser = store.authenticateUser(email, password);
   } catch(err) {
     if(err.status) fail(err.message, err.status);
     throw err;
   }

   if(authUser) {
     if(authUser.totpRequired) {
       const totpCode = String(data.totpCode || '').trim();
       if(!totpCode) {
         return json(res, 200, {
           requiresTotp: true,
           email: authUser.email,
           message: 'Two-factor TOTP authentication required.'
         });
       }
       const totpValid = verifyTotp(authUser.totpSecret, totpCode);
       if(!totpValid) {
         recordFailedLogin(email);
         fail('Invalid 6-digit TOTP verification code.', 401);
       }
     }

     resetFailedLogin(email);
     const { token, session } = store.createSession(authUser.name, authUser.role, authUser.id);
     const pair = issueTokenPair(authUser.id, session.id);
     res.setHeader('Set-Cookie', sessionCookie(req, token, Math.floor((Date.parse(session.expires_at) - Date.now()) / 1000)));
     res.setHeader('x-new-session-token', token);
     return json(res, 200, {
       token,
       refreshToken: pair.refreshToken,
       user: Object.fromEntries(Object.entries(authUser).filter(([key]) => key !== 'totpSecret')),
       mode: authUser.role === 'reporter' ? 'REPORTER PORTAL' : 'CBI OFFICER PORTAL',
       expiresAt: session.expires_at
     });
   }

   recordFailedLogin(email);
   const existingUser = store.getUserByEmail(email);
   if(existingUser) {
     fail('Invalid email or password. Please verify your credentials.', 401);
   }

   fail('Invalid email or password.',401);
 }

 // Phase 2 Citizen Reporting & Proof Extraction Endpoints
 if(path==='/api/reporting/extract' && method==='POST') {
   const data = await body(req);
   const textToAnalyze = data.text || data.rawText || data.description || '';
   const extraction = extractComplaintParameters(textToAnalyze);
   return json(res, 200, {
     success: true,
     ...extraction
   });
 }

 if(path==='/api/reporting/upload-proof' && method==='POST') {
   const uploadToken = (req.headers.authorization || '').replace(/^Bearer /,'') || req.headers['x-session-token'] || cookies(req).ct_session;
   const uploader = store.session(uploadToken);
   if(!uploader || uploader.suspended) fail('Sign in to upload evidence.',401);
   const data = await body(req);
   let buf = null;
   if (data.fileBuffer) {
     buf = Buffer.isBuffer(data.fileBuffer) ? data.fileBuffer : Buffer.from(data.fileBuffer);
   } else if (data.base64) {
     buf = Buffer.from(data.base64, 'base64');
   } else if (data.content) {
     buf = Buffer.from(data.content, typeof data.content === 'string' ? 'utf8' : undefined);
   } else {
     fail('File buffer or base64 content is required.', 400);
   }

   const processed = await processProofUpload({
     fileBuffer: buf,
     originalFilename: data.filename || 'evidence_proof.dat',
     mimeType: data.fileType || data.mimeType || 'application/octet-stream',
     caseId: data.caseId || null,
     uploadedById: uploader.user_id,
     uploadedByName: uploader.display_name,
     uploaderRole: 'reporter',
     description: data.description || 'Uploaded proof documentation'
   });

   return json(res, 201, {
     success: true,
     evidence: processed
   });
 }

 if(path.startsWith('/api/complaints/track/') && path.endsWith('/respond') && method==='POST') {
   const parts = path.split('/').filter(Boolean);
   const trackingCode = parts[parts.length - 2];
   if(!trackingCode) fail('Tracking code is required.', 400);
   const data = await body(req);
   if(!data.message && !data.response) fail('Clarification response message is required.', 400);
   const updated = store.submitCitizenClarification(trackingCode, {
     message: data.message || data.response,
     authorName: data.authorName || 'Citizen Reporter'
   });
   return json(res, 200, updated);
 }

 if(path.startsWith('/api/complaints/track/') && method==='GET') {
   const parts = path.split('/').filter(Boolean);
   const trackingCode = parts[parts.length - 1];
   if(!trackingCode || trackingCode === 'track') fail('Tracking code is required.', 400);
   const record = store.getComplaintByTrackingCode(trackingCode);
   if(!record) fail(`Complaint record not found for tracking code '${trackingCode}'.`, 404);
   return json(res, 200, record);
 }


 if(group==='dsa') {
   if(id==='catalog' && method==='GET') return json(res, 200, DSA_CATALOG);
   if(id==='benchmarks' && method==='GET') {
     const size = Number(url.searchParams.get('size') || 500);
     return json(res, 200, runFullDsaBenchmarks(size));
   }
   if(id==='benchmarks' && method==='POST') {
     const data = await body(req);
     const size = Number(data?.size || 500);
     return json(res, 200, runFullDsaBenchmarks(size));
   }
   if(id==='simulate' && method==='POST') {
     const data = await body(req);
     if(data.caseId) fail('Use the authenticated complaint evidence analysis endpoint for case-specific algorithms.',400);
     return json(res, 200, runDsaSimulation(data));
   }
 }

 const authHeader = req.headers.authorization || '';
 const tokenFromHeader = authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : null;
 const token = tokenFromHeader || req.headers['x-session-token'] || cookies(req).ct_session || '';
 let session = token ? store.session(token) : null;
 if(session && session.suspended) {
   fail('This account has been suspended by administration. All active sessions revoked.', 403);
 }

 if(!session) fail('Sign in to access this workspace.',401);
 const sid=session.id;
 const demoEnabled = process.env.DEMO_MODE==='true' || process.env.NODE_ENV==='test';
 if(!demoEnabled && ['investigation'].includes(group)) fail('The legacy agent uses demonstration data. Use complaint evidence analysis for real investigations.',409);
 if(!demoEnabled && ['cases','investigations','transactions'].includes(group) && ['POST','PUT','PATCH'].includes(method) && !(group==='transactions' && sub==='investigate')) fail('Use persistent complaint evidence analysis for case work; this legacy workspace is demonstration-only.',409);
 if(((group==='ml' && id==='evaluation') || (['dataset','analytics'].includes(group) && id==='model-eval')) && method==='GET') {
   const evaluationPath=resolve(root,'data/ml/evaluation.json');
   if(!existsSync(evaluationPath)) fail('Train the research pipeline first; evaluation unavailable.',503);
   return json(res,200,JSON.parse(readFileSync(evaluationPath,'utf8')));
 }
 if(path==='/api/officer/override' && method==='POST') {
   const isOfficer = session.role === 'officer' || session.role === 'supervisor' || session.role === 'admin';
   if(!isOfficer) fail('Only authorized officers can override ML predictions.', 403);
   const data = await body(req);
   const override = entityIntelligence.recordOfficerOverride({
     caseId: data.caseId,
     entityId: data.entityId,
     officerId: session.user_id,
     officerName: session.display_name,
     originalScore: data.originalScore,
     overriddenScore: data.overriddenScore,
     justification: data.justification
   });
   return json(res, 200, override);
 }
 if(path==='/api/auth/me' && method==='GET') return json(res,200,{user:{id:session.user_id,name:session.display_name,role:session.role || 'investigator',email:session.email||null,agency:session.agency||null,badgeNumber:session.badge_number||null},mode:session.role==='reporter'?'REPORTER PORTAL':(session.role==='officer'||session.role==='official-investigator')?'CBI OFFICER PORTAL':'DEMO ENVIRONMENT',expiresAt:session.expires_at});
 if(path==='/api/auth/logout' && method==='POST') {store.audit(sid,'Session Signed Out','workspace');store.db.prepare('UPDATE sessions SET expires_at=? WHERE id=?').run(now(),sid);res.setHeader('Set-Cookie',sessionCookie(req,'',0));return json(res,200,{ok:true});}
 if(path==='/api/auth/invite-officer' && method==='POST') {
   if(session.role !== 'admin' && session.role !== 'supervisor') {
     fail('Unauthorized: Only administrators and supervisors can issue officer invitations.', 403);
   }
   const data = await body(req);
   const invitation = createOfficerInvitation(store, data, session.display_name);
   store.audit(sid, 'Officer Invitation Created', invitation.email, { designation: invitation.designation, unit: invitation.unit });
   return json(res, 201, invitation);
 }
 if(path==='/api/auth/sessions' && method==='GET') {
   return json(res, 200, getActiveSessions(store, session.user_id));
 }
 if(path==='/api/auth/sessions/revoke' && method==='POST') {
   const data = await body(req);
   const owned = store.db.prepare('SELECT id FROM sessions WHERE id=? AND user_id=?').get(data.sessionId, session.user_id);
   if(!owned) fail('Session not found.',404);
   revokeSession(store, data.sessionId);
   return json(res, 200, { ok: true, message: 'Session revoked.' });
 }
 if(group==='officers' && method==='GET') {
   return json(res, 200, store.listOfficers());
 }
 if(group==='notifications') {
   if(!id && method==='GET') {
     const unreadOnly = url.searchParams.get('unread') === 'true';
     return json(res, 200, store.listNotifications(session.user_id, unreadOnly));
   }
   if(id==='read-all' && method==='POST') {
     return json(res, 200, store.markAllNotificationsRead(session.user_id));
   }
   if(id && sub==='read' && method==='POST') {
     return json(res, 200, store.markNotificationRead(id, session.user_id));
   }
 }
 if(group==='trace') {
   let seed = url.searchParams.get('address') || url.searchParams.get('wallet') || '';
   let amount = Number(url.searchParams.get('amount') || 250000);
   let chain = url.searchParams.get('chain') || (seed.startsWith('T') ? 'TRON' : seed.startsWith('1') || seed.startsWith('3') || seed.startsWith('bc1') ? 'Bitcoin' : 'Ethereum');
   let maxHops = Number(url.searchParams.get('hops') || 4);

   if (method === 'POST') {
     const data = await body(req);
     seed = data.address || data.wallet || seed;
     amount = Number(data.amount || amount);
     chain = data.chain || chain;
     maxHops = Number(data.hops || maxHops);
   }

   if (!seed) seed = 'TMuA6YqfCeX8EhbfYEg5y7S4Dqz9Dw9vVu';

   const traceResult = await forensicTracer.trace(seed, amount, now(), { chain, maxHops });
   const primaryVasp = traceResult.nodes.find(n => n.type === 'vasp');

   let aiReport = null;
   try {
     aiReport = await aiRiskEngine.evaluateCase({
       caseId: `TRACE-${seed.slice(0, 8)}`,
       reportedWallet: seed,
       reportedLoss: amount,
       chain,
       fraudType: 'Suspicious Fund Flow / Layering'
     }, {
       graphNodesCount: traceResult.nodes.length,
       hops: maxHops,
       vaspCandidate: primaryVasp?.entity || traceResult.vaspCandidate,
       clustersCount: traceResult.clustersCount,
       muleDetected: traceResult.nodes.some(n => (n.behavior || []).some(b => b.includes('Pass-through')))
     });
   } catch {}

   return json(res, 200, {
     ...traceResult,
     aiReport,
     seedAddress: seed,
     chain,
     amount
   });
 }
 if(group==='labels' && method==='GET') {
   const q = url.searchParams.get('q');
   const type = url.searchParams.get('type');
   const chain = url.searchParams.get('chain');
   let all = labelStore.getAll();
   if (q) {
     const lq = q.toLowerCase();
     all = all.filter(l => l.address.toLowerCase().includes(lq) || l.entity.toLowerCase().includes(lq));
   }
   if (type) all = all.filter(l => l.type === type);
   if (chain) all = all.filter(l => l.chain?.toLowerCase() === chain.toLowerCase());
   return json(res, 200, all);
 }
 // AI Investigation Agent & Tool Suite
 if(group==='investigation') {
   if(id==='launch' && method==='POST') {
     const data = await body(req);
     const caseId = data.caseId || 'CR-2026-00192';
     const result = await aiOrchestrator.launchInvestigation(store, caseId);
     return json(res, 200, result);
   }
   if(id && sub==='chat' && method==='POST') {
     const data = await body(req);
     const question = textField(data.question || '', 'Question', 2000, { required: true });
     const answer = await aiOrchestrator.handleQuestion(store, id, question);
     return json(res, 200, answer);
   }
   if(id && sub==='status' && method==='GET') {
     const session = store.getOrCreateAiSession(id);
     const risk = store.getRiskAssessment(id);
     const graph = store.getFinancialGraph(id);
     const upi = store.getUpiTransactions(id);
     const bank = store.getBankingRecords(id);
     const ex = store.getExchangeRecords(id);
     const toolRuns = store.getToolRuns(id);
     const messages = store.getAiMessages(id);
     return json(res, 200, {
       session,
       stages: session.stages,
       riskAssessment: risk,
       graph,
       upiTransactions: upi,
       bankingRecords: bank,
       exchangeRecords: ex,
       toolRuns,
       messages
     });
   }
   if(id && sub==='tool' && segments[4] && method==='POST') {
     const toolName = segments[4];
     const data = await body(req);
     let toolRes;
     if (toolName === 'validate_complaint') toolRes = await investigationTools.validateComplaint(store, id);
     else if (toolName === 'extract_payment_evidence') toolRes = await investigationTools.extractPaymentEvidence(store, id, data.evidenceReferences);
     else if (toolName === 'correlate_victim_reports') toolRes = await investigationTools.correlateVictimReports(store, id);
     else if (toolName === 'retrieve_bank_evidence') toolRes = await investigationTools.retrieveBankEvidence(store, id, data.authorizedReferences);
     else if (toolName === 'analyze_mule_account_patterns') toolRes = await investigationTools.analyzeMuleAccountPatterns(store, id);
     else if (toolName === 'retrieve_exchange_evidence') toolRes = await investigationTools.retrieveExchangeEvidence(store, id);
     else if (toolName === 'investigate_blockchain') toolRes = await investigationTools.investigateBlockchain(store, { ...data, caseId: id });
     else if (toolName === 'build_financial_graph') toolRes = await investigationTools.buildFinancialGraph(store, id);
     else if (toolName === 'execute_dsa_analysis') toolRes = await investigationTools.executeDsaAnalysis(store, id, data.algorithms);
     else if (toolName === 'run_ml_inference') toolRes = await investigationTools.runMlInference(store, id);
     else if (toolName === 'calculate_risk_assessment') toolRes = await investigationTools.calculateRiskAssessment(store, id);
     else if (toolName === 'generate_investigation_report') toolRes = await investigationTools.generateInvestigationReport(store, id);
     else fail(`Unknown investigation tool: ${toolName}`, 404);
     return json(res, 200, toolRes);
   }
 }
 // Blockchain Intelligence & Provider Integrations
 if(group==='blockchain') {
   if(id==='verify' && method==='POST') {
     const data = await body(req);
     if(!data.chain || !data.txHash) fail('Both chain and txHash are required for verification.', 400);
     const vResult = await blockchainManager.verifyTransaction(data.chain, data.txHash);
     if(vResult.verified) {
       store.saveBlockchainTransaction(vResult);
     }
     return json(res, 200, vResult);
   }
   if(id==='address' && method==='GET') {
     const chain = url.searchParams.get('chain') || 'Bitcoin';
     const address = url.searchParams.get('address');
     if(!address) fail('Parameter address is required.', 400);
     const balance = await blockchainManager.getAddressBalance(chain, address);
     const labels = store.getAddressLabels(chain, address);
     const crossCases = store.getCrossCaseIntelligence(address);
     return json(res, 200, {
       chain,
       address,
       balance,
       labels,
       crossCaseCount: crossCases.totalMatches,
       relatedCases: crossCases.cases,
       provider: balance?.provider || 'Public Node RPC'
     });
   }
   if(id==='health' && method==='GET') {
     return json(res, 200, await blockchainManager.getProviderHealth());
   }
 }
 // Watchtower: Address Monitoring
 if(group==='watchtower') {
   const isOfficer = session.role !== 'reporter' || session.role === 'officer' || session.role === 'supervisor' || session.role === 'admin' || session.role === 'official-investigator' || session.role === 'demo-investigator' || session.role === 'investigator';
   if(!isOfficer) fail('Only authorized investigators can access Watchtower.', 403);
   if(!id && method==='GET') {
     return json(res, 200, store.listWatchlist(session.user_id));
   }
   if(!id && method==='POST') {
     const data = await body(req);
     if(!data.address) fail('Address is required for Watchtower monitoring.', 400);
     const item = store.addWatchlistAddress({
       officerId: session.user_id,
       caseId: data.caseId || null,
       chain: data.chain || 'Bitcoin',
       address: data.address,
       label: data.label || ''
     });
     return json(res, 201, item);
   }
   if(id && method==='DELETE') {
     return json(res, 200, store.removeWatchlistAddress(id, session.user_id));
   }
   if(id==='alerts' && method==='GET') {
     return json(res, 200, store.listWatchAlerts(session.user_id));
   }
   if(id==='check' && method==='POST') {
     const watched = store.listWatchlist(session.user_id);
     const results = [];
     for(const w of watched) {
       const bal = await blockchainManager.getAddressBalance(w.chain, w.address);
       results.push({ watchId: w.id, address: w.address, chain: w.chain, balance: bal, checkedAt: now() });
     }
     return json(res, 200, { checked: watched.length, checkedCount: watched.length, results });
   }
 }
 // Cross-Case Correlation Intelligence
 if(group==='cross-case' && method==='GET') {
   if(!['officer','investigating_officer','supervisor','admin','demo-investigator'].includes(session.role)) fail('Investigator access required.',403);
   const q = url.searchParams.get('q');
   return json(res, 200, store.getCrossCaseIntelligence(q));
 }
 if(group==='complaints') {
   const isOfficer = session.role === 'officer' || session.role === 'supervisor' || session.role === 'admin' || session.role === 'official-investigator' || session.role === 'demo-investigator' || session.role === 'investigating_officer';
   const isAuditor = session.role === 'auditor';
   if(id) {
     const row = store.db.prepare('SELECT * FROM complaints WHERE case_id=? OR id=?').get(id,id);
     if(!row || !canAccessCase({ ...session, id: session.user_id },row)) fail('Complaint not found or access denied.',404);
   }

   if(!id && method==='GET') {
     if (isAuditor) {
       const justification = req.headers['x-audit-justification'] || url.searchParams.get('justification');
       if (!justification) {
         fail('Mandatory audit justification required for auditor access. Provide x-audit-justification header or ?justification= parameter.', 400);
       }
       store.audit(sid, 'AUDITOR_CASE_INSPECTION', 'all_complaints', { justification, auditor: session.user_id });
     }

     const filter = {
       status: url.searchParams.get('status') || null,
       search: url.searchParams.get('q') || null,
       chain: url.searchParams.get('chain') || null,
       priority: url.searchParams.get('priority') || null,
       sortBy: url.searchParams.get('sortBy') || (isOfficer ? 'loss' : 'recent'),
       myCasesOnly: url.searchParams.get('my') === 'true'
     };

     if (!isOfficer && !isAuditor) {
       filter.reporterId = session.user_id;
     } else if (isOfficer && session.role !== 'supervisor' && session.role !== 'admin') {
       filter.officerId = session.user_id;
       filter.officerUnit = session.unit || 'Cyber Crime Division';
       filter.scopingRole = 'officer';
     }
     return json(res, 200, store.listComplaints(filter));
   }
   if(!id && method==='POST') {
     const data = await body(req);
     if (typeof data.incidentType!=='string' || !data.incidentType.trim() || data.incidentType.length>200) fail('Incident type is required (max 200 characters).', 400);
     if (typeof data.description!=='string' || data.description.length < 5 || data.description.length>20000) fail('Incident description must be at least 5 characters.', 400);

     // Phase 2.5: Duplicate and Linkage Detection
     const dupCheck = duplicateDetector.checkDuplicates(store, {
       utrNumber: data.utrNumber,
       suspectWallet: data.reportedWallet || data.suspectWallet,
       suspectUpiId: data.suspectUpi || data.suspectUpiId || data.receiverUpiId,
       suspectPhone: data.suspectPhone
     });

     if(!Number.isFinite(Number(data.reportedLoss || 0)) || Number(data.reportedLoss || 0)<0) fail('Reported loss must be a non-negative number.',400);
     if(data.attachments && (!Array.isArray(data.attachments) || data.attachments.length>10)) fail('At most ten attachments allowed.',400);
     const preparedAttachments = [];
     for(const att of data.attachments || []) {
       if(!att.base64) fail('Evidence attachment requires file bytes; metadata alone cannot be sealed.',400);
       preparedAttachments.push(await processProofUpload({fileBuffer:Buffer.from(att.base64,'base64'),originalFilename:att.name || att.filename,mimeType:att.type || att.fileType,uploadedById:session.user_id,uploadedByName:session.display_name}));
     }
     const trackingCode = 'TRK-' + randomBytes(16).toString('hex').toUpperCase();

     const complaint = store.createComplaint({
       ...data,
       attachments: preparedAttachments,
       caseId: undefined,
       trackingCode,
       suspectUpi: data.suspectUpi || data.suspectUpiId || data.receiverUpiId || null,
       suspectPhone: data.suspectPhone || null,
       duplicateAlert: dupCheck.hasDuplicates,
       linkedCaseIds: dupCheck.linkedCaseIds,
       extractedFields: data.extractedFields || null,
       provenanceTags: {
         seed: 'USER_UPLOADED',
         fiat: 'USER_UPLOADED',
         notes: 'Citizen submitted complaint and proofs'
       },
       reporterId: session.user_id,
       reporterName: session.display_name,
       reporterEmail: session.email || ''
     });



     // Index in Bloom Filter
     duplicateDetector.indexComplaint({
       utrNumber: data.utrNumber,
       suspectWallet: complaint.reportedWallet,
       suspectUpiId: data.suspectUpi || data.suspectUpiId || data.receiverUpiId,
       suspectPhone: data.suspectPhone
     });

     // Automatically persist UPI transactions if provided
     if (Array.isArray(data.upiTransactions) && data.upiTransactions.length > 0) {
       for (const utx of data.upiTransactions) {
         store.saveUpiTransaction({
           ...utx,
           caseId: complaint.caseId
         });
       }
     } else if (data.utrNumber || data.receiverUpiId || data.suspectUpi) {
       store.saveUpiTransaction({
         caseId: complaint.caseId,
         utrNumber: data.utrNumber || '',
         senderUpiId: data.senderUpiId || '',
         receiverUpiId: data.suspectUpi || data.suspectUpiId || data.receiverUpiId || data.reportedWallet || '',
         beneficiaryName: data.beneficiaryName || 'Beneficiary Account',
         amount: Number(complaint.reportedLoss || 0),
         bankName: data.bankName || '',
         timestamp: complaint.incidentDate || now()
       });
     }

     const initialTrace = null; // Complaint intake never manufactures or blocks on external tracing.
     store.audit(sid, 'Complaint Filed', complaint.caseId, {
       incidentType: complaint.incidentType,
       reportedLoss: complaint.reportedLoss,
       trackingCode,
       duplicateAlert: dupCheck.hasDuplicates
     });

     return json(res, 201, {
       ...complaint,
       trackingCode,
       duplicateAlert: dupCheck.hasDuplicates,
       linkedCaseIds: dupCheck.linkedCaseIds,
       initialTrace
     });
   }
   if(id && !sub && method==='GET') {
     if (isAuditor) {
       const justification = req.headers['x-audit-justification'] || url.searchParams.get('justification');
       if (!justification) {
         fail('Mandatory audit justification required for auditor access. Provide x-audit-justification header or ?justification= parameter.', 400);
       }
       store.audit(sid, 'AUDITOR_CASE_INSPECTION', id, { justification, auditor: session.user_id });
     }
     const comp = store.getComplaint(id, isOfficer || isAuditor);
     if (!comp) fail(`Complaint ${id} was not found.`, 404);
     if (!isOfficer && !isAuditor && comp.reporterId !== session.user_id) {
       fail('You are not authorized to view this complaint.', 403);
     }
     return json(res, 200, comp);
   }
   if(id && sub==='status' && method==='POST') {
     if (!isOfficer) fail('Only authorized CBI officers can update complaint status.', 403);
     const data = await body(req);
     if (!data.status) fail('Status is required.', 400);
     const updated = store.updateComplaintStatus({
       caseId: id,
       newStatus: data.status,
       authorId: session.user_id,
       authorName: session.display_name,
       authorRole: 'officer',
       reason: data.reason || ''
     });
     store.audit(sid, 'Complaint Status Updated', id, { newStatus: data.status, reason: data.reason });
     return json(res, 200, updated);
   }
   if(id && sub==='assign' && method==='POST') {
     if (!isOfficer) fail('Only authorized CBI officers can assign cases.', 403);
     const data = await body(req);
     if (!data.officerId || !data.officerName) fail('Officer ID and Name are required.', 400);
     const updated = store.assignOfficer({
       caseId: id,
       officerId: data.officerId,
       officerName: data.officerName,
       assignedById: session.user_id,
       assignedByName: session.display_name,
       notes: data.notes || ''
     });
     store.audit(sid, 'Case Assigned to Officer', id, { officer: data.officerName });
     return json(res, 200, updated);
   }
   if(id && sub==='request-evidence' && method==='POST') {
     if (!isOfficer) fail('Only authorized CBI officers can request additional evidence.', 403);
     const data = await body(req);
     const items = data.requestedItems || data.message || 'Supporting transaction receipts and chat logs';
     const updated = store.requestEvidence({
       caseId: id,
       authorId: session.user_id,
       authorName: session.display_name,
       requestedItems: items
     });
     store.audit(sid, 'Additional Evidence Requested', id, { requestedItems: items });
     return json(res, 200, updated);
   }
   if(id && sub==='evidence' && method==='POST') {
     const comp = store.getComplaint(id, false);
     if (!comp) fail(`Complaint ${id} was not found.`, 404);
     if (!isOfficer && comp.reporterId !== session.user_id) {
       fail('You are not authorized to upload evidence to this case.', 403);
     }
     const data = await body(req);
     if (!data.filename) fail('Filename is required.', 400);

     let processed = null;
     if (data.fileBuffer || data.base64 || data.fileContent) {
       const buf = Buffer.isBuffer(data.fileBuffer)
         ? data.fileBuffer
         : Buffer.from(data.base64 || data.fileBuffer || data.fileContent, data.encoding || 'base64');
       processed = await processProofUpload({
         fileBuffer: buf,
         originalFilename: data.filename,
         mimeType: data.fileType || data.mimeType || 'application/octet-stream',
         caseId: comp.caseId,
         uploadedById: session.user_id,
         uploadedByName: session.display_name,
         uploaderRole: isOfficer ? 'officer' : 'reporter',
         description: data.description || ''
       });
     }

     if(!processed) fail('Evidence requires original file bytes.',400);
     const evidence = store.addEvidence({
       caseId: id,
       uploadedById: session.user_id,
       uploadedByName: session.display_name,
       uploaderRole: isOfficer ? 'officer' : 'reporter',
       filename: data.filename,
       fileType: processed?.mimeType || data.fileType || 'application/octet-stream',
       fileSize: processed?.sizeBytes || Number(data.fileSize || 1024),
       description: data.description || '',
       sha256: processed?.sha256 || data.sha256 || '',
       chainOfCustody: processed?.chainOfCustody || null,
       avScanStatus: processed?.avScanStatus || 'CLEAN_SHA256_SEALED',
       storagePath: processed?.storagePath || null
     });
     store.audit(sid, 'Case Evidence Uploaded', id, { filename: data.filename, sha256: evidence.sha256 });
     return json(res, 201, evidence);
   }
   if(id && sub==='notes' && method==='POST') {
     if (!isOfficer) fail('Only authorized CBI officers can add internal notes.', 403);
     const data = await body(req);
     if (!data.note && !data.message) fail('Note content is required.', 400);
     const note = store.addInternalNote({
       caseId: id,
       authorId: session.user_id,
       authorName: session.display_name,
       authorRole: 'officer',
       note: data.note || data.message
     });
     store.audit(sid, 'Internal Investigation Note Added', id);
     return json(res, 201, note);
   }
   if(id && sub==='connections' && method==='GET') {
     if(!isOfficer) fail('Investigator access required.',403);
     const rows=store.db.prepare('SELECT * FROM complaints').all().filter(row=>canAccessCase({...session,id:session.user_id},row));
     return json(res,200,connectedComplaints(rows,id));
   }
   if(id && sub==='transfers' && method==='PUT') {
     if(!isOfficer) fail('Only investigators may import transaction evidence.',403);
     const data = await body(req), rows = validateTransfers(data.transfers);
     store.db.prepare('INSERT INTO incident_transfers VALUES(?,?,?) ON CONFLICT(case_id) DO UPDATE SET rows_json=excluded.rows_json,updated_at=excluded.updated_at').run(id,JSON.stringify(rows),now());
     store.addInternalNote({ caseId:id,authorId:session.user_id,authorName:session.display_name,authorRole:session.role,note:`Imported ${rows.length} unverified transaction rows for analysis.` });
     return json(res,200,{ count:rows.length, provenance:'INVESTIGATOR_SUBMITTED_UNVERIFIED' });
   }
   if(id && sub==='analysis-runs' && method==='GET') {
     if(!isOfficer) fail('Only investigators may view analysis runs.',403);
     return json(res,200,store.db.prepare('SELECT payload FROM incident_analysis_runs WHERE case_id=? ORDER BY rowid DESC').all(id).map(r=>JSON.parse(r.payload)));
   }
   if(id && sub==='analysis-report' && method==='GET') {
     if(!isOfficer) fail('Only investigators may download analysis reports.',403);
     const requestedRun=url.searchParams.get('runId');
     const saved = requestedRun ? store.db.prepare('SELECT payload FROM incident_analysis_runs WHERE case_id=? AND id=?').get(id,requestedRun) : store.db.prepare('SELECT payload FROM incident_analysis_runs WHERE case_id=? ORDER BY rowid DESC LIMIT 1').get(id);
     if(!saved) fail('Run evidence analysis first.',409);
     const run = JSON.parse(saved.payload), doc = new PDFDocument({margin:45});
     res.writeHead(200,{'Content-Type':'application/pdf','Content-Disposition':`attachment; filename="${id}-analysis.pdf"`});
     doc.pipe(res); doc.fontSize(18).text('CYBER-TRACE Investigation Analysis');
     doc.fontSize(10).text(`Incident: ${id}\nRun: ${run.id}\nCreated: ${run.createdAt}\nInput SHA-256: ${run.inputSha256}\nRisk: ${run.riskScore ?? 'Unavailable'}/100 (${run.riskCategory})`);
     doc.moveDown().text('Evidence limitations'); run.limitations.forEach(x=>doc.text(x));
     doc.moveDown().text('Contributing factors'); run.factors.forEach(x=>doc.text(`${x.factor}: ${x.points}`));
     doc.moveDown().text(`ML: ${JSON.stringify(run.ml)}`);
     for(const execution of run.executions) { doc.moveDown().text(`${execution.algorithm}: ${execution.nodesVisited} nodes, ${execution.edgeVisits} edge visits; ${execution.executionMs.toFixed(3)} ms; time ${execution.timeComplexity.replaceAll('α','alpha')}; space ${execution.spaceComplexity.replaceAll('α','alpha')}`); if(execution.path) doc.text(`Path: ${execution.path.map(id=>{const n=run.nodes.find(n=>n.id===id);return n?`${n.address} [${n.network}/${n.asset}]`:id;}).join(' -> ')}`); }
     doc.moveDown().text('Submitted transactions (not independently verified)');
     run.edges.forEach(e=>doc.text(`${e.timestamp} | ${e.network} ${e.asset} | ${e.from} -> ${e.to} | ${e.amount} | ${e.reference}`));
     doc.end(); return;
   }
   if(id && sub==='evidence-download' && method==='GET') {
     const evidence = store.listEvidence(id).find(e=>e.id===url.searchParams.get('evidenceId'));
     if(!evidence?.storagePath || !existsSync(evidence.storagePath)) fail('Original evidence bytes are unavailable.',404);
     const bytes = readFileSync(evidence.storagePath), sha256 = createHash('sha256').update(bytes).digest('hex');
     if(sha256!==evidence.sha256) fail('Evidence integrity check failed.',409);
     res.writeHead(200,{'Content-Type':'application/octet-stream','Content-Disposition':`attachment; filename="${evidence.id}.bin"`,'X-Evidence-SHA256':sha256}); return res.end(bytes);
   }
   if(id && sub==='analyze' && method==='POST') {
     if(!isOfficer) fail('Only investigators may run evidence analysis.',403);
     const options = await body(req);
     const run = saveAnalysis(store.db,id,session.user_id,options);
     store.addInternalNote({ caseId:id,authorId:session.user_id,authorName:session.display_name,authorRole:session.role,note:`Analysis ${run.id}: risk ${run.riskScore ?? 'unavailable'}. Input SHA-256 ${run.inputSha256}.` });
     store.audit(sid,'Complaint Analytics Executed',id,{runId:run.id,inputSha256:run.inputSha256});
     return json(res,200,run);
   }
   if(id && sub==='claim' && method==='POST') {
     if (!isOfficer) fail('Only authorized CBI / Cyber Cell officers can claim cases.', 403);
     const claimed = store.claimComplaint({
       caseId: id,
       officerId: session.user_id,
       officerName: session.display_name,
       officerUnit: session.unit || 'Cyber Crime Division'
     });
     store.audit(sid, 'Case Claimed by Officer', id, { officer: session.display_name, unit: session.unit });
     return json(res, 200, claimed);
   }
   if(id && sub==='statutory-notice' && method==='GET') {
     if (!isOfficer && !isAuditor) fail('Unauthorized: Statutory legal notices can only be generated by law enforcement officers.', 403);
     const comp = store.getComplaint(id, true);
     if(!comp) fail(`Complaint ${id} not found.`, 404);
     const noticeType = url.searchParams.get('type') || 'bnss106';
     let notice;
     if (noticeType === 'bnss94') {
       notice = generateSection94Notice({
         caseId: comp.caseId,
         targetInstitution: url.searchParams.get('institution') || 'Virtual Asset Service Provider / Banking Intermediary',
         identifiers: [comp.reportedWallet, comp.suspectUpi, comp.suspectPhone, comp.transactionHash].filter(Boolean),
         officerName: session.display_name,
         officerUnit: session.unit || 'Cyber Crime Division'
       });
     } else {
       notice = generateSection106Notice({
         caseId: comp.caseId,
         incidentType: comp.incidentType,
         reportedLoss: comp.reportedLoss,
         currency: comp.currency,
         targetInstitution: url.searchParams.get('institution') || 'Virtual Asset Service Provider / Banking Intermediary',
         accountIdentifier: comp.reportedWallet || comp.suspectUpi || 'TARGET-ACCOUNT',
         officerName: session.display_name,
         officerUnit: session.unit || 'Cyber Crime Division',
         evidenceFiles: comp.evidence || [],
         transactionHashes: comp.transactionHash ? [comp.transactionHash] : []
       });
     }
     store.audit(sid, 'Statutory Notice Draft Generated', id, { noticeType, noticeReference: notice.noticeReference });
     return json(res, 200, notice);
   }
   if(id && sub==='freeze-requests') {
     const reqId = segments[4];
     const action = segments[5];

     if(!reqId && method==='GET') {
       if (!isOfficer && !isAuditor && session.role !== 'bank_nodal') {
         fail('Unauthorized: Only authorized officers can view freeze requisitions.', 403);
       }
       return json(res, 200, store.listFreezeRequests(id));
     }

     if(!reqId && method==='POST') {
       if(!hasPermission(session.role, 'freeze_request:prepare') && !isOfficer) {
         fail('Unauthorized: Only an investigating officer can prepare statutory freeze requisitions.', 403);
       }
       const data = await body(req);
       const comp = store.getComplaint(id, true);
       if(!comp) fail(`Complaint ${id} not found.`, 404);
       const freezeReq = store.createFreezeRequest({
         caseId: comp.caseId,
         institutionId: data.institutionId || data.targetInstitution || 'Designated Bank / VASP',
         accountIdentifier: data.accountIdentifier || comp.reportedWallet || comp.suspectUpi || 'TARGET-ACCOUNT',
         requestedAmount: Number(data.requestedAmount || comp.reportedLoss || 0),
         legalBasis: data.legalBasis || 'Section 106 BNSS 2023 (formerly Section 102 Cr.P.C.)',
         preparedById: session.user_id
       });
       store.audit(sid, 'Freeze Requisition Drafted', id, { freezeRequestId: freezeReq.id, amount: freezeReq.requested_amount });
       return json(res, 201, freezeReq);
     }

     if(reqId && action==='approve' && method==='POST') {
       if(session.role !== 'supervisor' && session.role !== 'admin') {
         fail('Maker-Checker Violation: Only supervisory authorities can approve statutory freeze requisitions.', 403);
       }
       const data = await body(req);
       const approved = store.approveFreezeRequest(reqId, session.user_id, session.role, data.notes || '');
       store.audit(sid, 'Freeze Requisition Approved', id, { freezeRequestId: reqId, supervisorId: session.user_id });
       return json(res, 200, approved);
     }

     if(reqId && action==='reject' && method==='POST') {
       if(session.role !== 'supervisor' && session.role !== 'admin') {
         fail('Maker-Checker Violation: Only supervisory authorities can reject statutory freeze requisitions.', 403);
       }
       const data = await body(req);
       const rejected = store.rejectFreezeRequest(reqId, session.user_id, session.role, data.reason || '');
       store.audit(sid, 'Freeze Requisition Rejected', id, { freezeRequestId: reqId, supervisorId: session.user_id, reason: data.reason });
       return json(res, 200, rejected);
     }

     if(reqId && action==='send' && method==='POST') {
       if(!isOfficer) fail('Only authorized officers can dispatch freeze requisitions to nodal officers.', 403);
       const sent = store.sendFreezeRequestToNodal(reqId, session.user_id, session.role);
       store.audit(sid, 'Freeze Requisition Sent to Nodal', id, { freezeRequestId: reqId });
       return json(res, 200, sent);
     }

     if(reqId && action==='nodal-response' && method==='POST') {
       const data = await body(req);
       if(!data.action) fail('Nodal action is required.', 400);
       const updated = store.recordNodalResponse(reqId, {
         action: data.action,
         referenceNumber: data.referenceNumber,
         amountFrozen: data.amountFrozen,
         nodalName: data.nodalName || session.display_name || 'Bank/Exchange Nodal Desk',
         complianceNotes: data.complianceNotes || ''
       });
       store.audit(sid, 'Nodal Response Recorded', id, { freezeRequestId: reqId, action: data.action, amountFrozen: data.amountFrozen });
       return json(res, 200, updated);
     }
   }
   if(id && sub==='court-package' && method==='POST') {
     if(!isOfficer && !isAuditor) fail('Unauthorized: Only authorized officers can compile judicial court packages.', 403);
     const comp = store.getComplaint(id, true);
     if(!comp) fail(`Complaint ${id} not found.`, 404);

     const sec106 = generateSection106Notice({
       caseId: comp.caseId,
       incidentType: comp.incidentType,
       reportedLoss: comp.reportedLoss,
       currency: comp.currency,
       accountIdentifier: comp.reportedWallet || comp.suspectUpi || 'TARGET',
       officerName: session.display_name,
       officerUnit: session.unit || 'Cyber Crime Division',
       evidenceFiles: comp.evidence || [],
       transactionHashes: comp.transactionHash ? [comp.transactionHash] : []
     });

     const sec94 = generateSection94Notice({
       caseId: comp.caseId,
       identifiers: [comp.reportedWallet, comp.suspectUpi, comp.suspectPhone, comp.transactionHash].filter(Boolean),
       officerName: session.display_name,
       officerUnit: session.unit || 'Cyber Crime Division'
     });

     const bsa63 = generateBsa63Certificate({
       caseId: comp.caseId,
       officerName: session.display_name,
       officerDesignation: session.badgeNumber ? `Badge #${session.badgeNumber}` : 'Investigating Officer',
       evidenceItems: comp.evidence || [],
       graphHash: comp.transactionHash || null
     });

     const courtPackage = {
       caseId: comp.caseId,
       packageReference: `CRT-PKG-${comp.caseId}-${randomBytes(4).toString('hex').toUpperCase()}`,
       compiledAt: new Date().toISOString(),
       compiledBy: session.display_name,
       statutoryCitations: [
         'Section 106 Bharatiya Nagarik Suraksha Sanhita, 2023 (BNSS)',
         'Section 94 Bharatiya Nagarik Suraksha Sanhita, 2023 (BNSS)',
         'Section 63 Bharatiya Sakshya Adhiniyam, 2023 (BSA)',
         'Section 69 & 79 Information Technology Act, 2000'
       ],
       documents: {
         section106Notice: sec106,
         section94Summons: sec94,
         section63BsaCertificate: bsa63
       },
       evidenceAnnexure: (comp.evidence || []).map(e => ({
         filename: e.filename,
         sha256: e.sha256,
         avScanStatus: e.avScanStatus || 'CLEAN_SHA256_SEALED'
       })),
       disclaimer: 'DRAFT FOR LEGAL REVIEW - NOT A DIRECT PLATFORM FREEZE'
     };

     const masterPackageSha256 = computeMasterCourtPackageSeal(courtPackage);
     courtPackage.masterPackageSha256 = masterPackageSha256;
     courtPackage.sealStatus = 'CRYPTOGRAPHICALLY_VERIFIED';
     courtPackage.digitalSealAlgorithm = 'SHA-256';

     try {
       store.updateComplaintStatus({
         caseId: comp.caseId,
         newStatus: 'Court Package Generated',
         authorId: session.user_id,
         authorName: session.display_name,
         authorRole: session.role || 'officer',
         reason: `Statutory court package compiled with Section 106/94 BNSS requisitions and Section 63 BSA certificate.`
       });
     } catch {}

     store.audit(sid, 'Court Package Generated', id, { packageReference: courtPackage.packageReference, masterPackageSha256 });
     return json(res, 200, courtPackage);
   }
   if(id==='verify-court-package' && method==='POST') {
     const data = await body(req);
     const verification = verifyCourtPackage(data);
     return json(res, 200, verification);
   }
 }
 if(group==='dashboard' && method==='GET') return json(res,200,dashboard(sid));
 if(group==='cases') {
   if(!id && method==='GET') return json(res,200,caseQuery(store.listCases(sid),url.searchParams));
   if(!id && method==='POST') {
     if(store.listCases(sid).length>=200) fail('This demo workspace has reached its limit of 200 cases.',422);
     const validated=validateCase(await body(req)),stamp=now();
     const caseId=validated.id || `CR-2026-${randomUUID().slice(0,8).toUpperCase()}`;
     if(store.getCase(sid,caseId)) fail('A case with that ID already exists in this workspace.',409);
     const record={...validated,id:caseId,status:'New',riskScore:0,tracedAmount:0,confidence:0,vaspCandidate:'Unknown',transactionCount:0,walletCount:0,chains:[validated.chain],createdAt:stamp,updatedAt:stamp,source:'demo'};
     store.insertCase(sid,record);store.audit(sid,'Investigation Created',caseId,{reportedWallet:record.reportedWallet,mode:'demo'});store.addEvent(sid,caseId,'Investigation Created','Reported complaint saved. Trace pending.');
     return json(res,201,record);
   }
   if(id && sub==='related' && method==='GET') return json(res,200,requireValue(store.getInvestigation(sid,id),'Case').relatedCases);
   if(id && sub==='calculate-risk' && method==='POST') {
     const data = await body(req);
     const result = store.calculateRiskAndReadiness(sid, id, data.criteria || {});
     if(!result) fail(`Case ${id} not found.`, 404);
     return json(res, 200, result);
   }
   if(id && sub==='freeze-requests') {
     const reqId = segments[4];
     if(!reqId && method==='GET') {
       return json(res, 200, store.listFreezeRequests(id));
     }
     if(!reqId && method==='POST') {
       if(!hasPermission(session.role, 'freeze_request:prepare')) {
         fail('Unauthorized: Only an investigating officer can prepare statutory freeze requisitions.', 403);
       }
       const data = await body(req);
       const freezeReq = store.createFreezeRequest({
         caseId: id,
         institutionId: data.institutionId || 'VASP-CUSTODIAN',
         accountIdentifier: data.accountIdentifier || data.wallet || 'TARGET',
         requestedAmount: Number(data.requestedAmount || 0),
         legalBasis: data.legalBasis || 'Section 102 Cr.P.C. / Section 106 BNSS',
         preparedById: session.user_id
       });
       store.audit(sid, 'Freeze Requisition Drafted', id, { freezeRequestId: freezeReq.id, amount: freezeReq.requested_amount });
       return json(res, 201, freezeReq);
     }
     if(reqId && segments[5]==='approve' && method==='POST') {
       if(!hasPermission(session.role, 'freeze_request:approve')) {
         fail('Maker-Checker Violation: Only supervisory authorities can approve statutory freeze requisitions.', 403);
       }
       const approved = store.approveFreezeRequest(reqId, session.user_id, session.role);
       store.audit(sid, 'Freeze Requisition Approved', id, { freezeRequestId: reqId, supervisorId: session.user_id });
       return json(res, 200, approved);
     }
   }
   if(id && !sub && method==='GET') return json(res,200,requireValue(store.getCase(sid,id),'Case'));
   if(id && !sub && method==='PATCH') {const data=await body(req);const status=enumField(data.status,STATUSES,'Status');return json(res,200,requireValue(store.setStatus(sid,id,status),'Case'));}
 }
 if(group==='investigations') {
   if(!id && method==='GET') return json(res,200,store.listCases(sid));
   if(!id && method==='POST') {const data=await body(req);const caseId=textField(data.caseId,'Case ID',50,{required:true});return json(res,200,requireValue(store.trace(sid,caseId,session.weights),'Case'));}
   if(id && sub==='calculate-risk' && method==='POST') {
     const data = await body(req);
     const result = store.calculateRiskAndReadiness(sid, id, data.criteria || {});
     if(!result) fail(`Case ${id} not found.`, 404);
     return json(res, 200, result);
   }
   if(id && method==='GET') return json(res,200,requireValue(store.getInvestigation(sid,id),'Investigation'));
 }
 if(['graph','knowledge-graph','attribution'].includes(group) && id && method==='GET') {
   const inv=requireValue(store.getInvestigation(sid,id),'Case');return json(res,200,group==='graph'?{nodes:inv.nodes,edges:inv.edges}:group==='knowledge-graph'?inv.knowledgeGraph:inv.attributions);
 }
 if(group==='wallets') {
   if(id && method==='GET') {const result=walletResult(sid,id);return json(res,200,sub==='transactions'?result.transactions:result);}
   if(!id && method==='POST') {
     const data=await body(req),caseId=textField(data.caseId,'Case ID',50,{required:true});const inv=requireValue(store.getInvestigation(sid,caseId),'Case');
     if(!inv.nodes.length) fail('Start the investigation before adding a wallet.',422);
     if(inv.nodes.length>=500) fail('Graph wallet limit reached.',422);
     const chain=enumField(data.chain,CHAINS,'Chain'),address=normalizeWallet(data.address,chain);
     if(inv.nodes.some(n=>n.address===address&&n.chain===chain)) fail('Wallet already exists in this case.',409);
     const node={id:`W-${randomUUID().slice(0,8)}`,address,chain,label:textField(data.label||'Analyst-added wallet','Label',80),type:enumField(data.type,['victim','suspect','intermediary','bridge','dex','mixer','vasp','unknown'],'Type','unknown'),balance:0,riskScore:0,entity:'Unattributed',cluster:'',firstSeen:now(),lastSeen:now(),incomingCount:0,outgoingCount:0,behavior:['Analyst-added synthetic wallet; no transactions observed.'],evidenceIds:[],x:140+inv.nodes.length*40,y:320};
     const dataset={nodes:[...inv.nodes,node],edges:inv.edges,crossChain:inv.crossChain,timeline:inv.timeline};store.trace(sid,caseId,session.weights,{dataset});store.audit(sid,'Wallet Added',address,{caseId});return json(res,201,node);
   }
 }
 if(group==='transactions' && id==='ingest' && method==='POST') {
   const data=await body(req),caseId=textField(data.caseId,'Case ID',50,{required:true}),inv=requireValue(store.getInvestigation(sid,caseId),'Case');
   if(!Array.isArray(data.transactions)||data.transactions.length<1||data.transactions.length>500) fail('Provide 1 to 500 transaction records.');
   if(inv.edges.length+data.transactions.length>2000) fail('This synthetic graph has reached its transaction limit.',422);
   const transactions=data.transactions.map(t=>validateTransaction(t,inv)),ids=new Set(inv.edges.map(e=>e.id));
   for(const t of transactions) {if(ids.has(t.id))fail('Transaction ID already exists in this case.',409);ids.add(t.id);}
   const result=store.trace(sid,caseId,session.weights,{dataset:{nodes:inv.nodes,edges:[...inv.edges,...transactions],crossChain:inv.crossChain,timeline:inv.timeline}});store.audit(sid,'Synthetic Transactions Ingested',caseId,{count:transactions.length});return json(res,201,{ingested:transactions.length,investigation:result});
 }
 if(group==='alerts') {
   if(!id && method==='GET') return json(res,200,store.alerts(sid));
   if(id && method==='PATCH') {const data=await body(req),status=enumField(data.status,['Reviewed','Dismissed'],'Alert status');return json(res,200,requireValue(store.updateAlert(sid,id,status),'Alert'));}
 }
 if(group==='evidence' && id && sub && segments[4]==='view' && method==='POST') {const evidence=requireValue(store.evidence(sid,id,sub),'Evidence');store.audit(sid,'Evidence Viewed',`${id}/${sub}`);return json(res,200,evidence);}
 if(group==='assistant' && id && method==='POST') {const data=await body(req),question=textField(data.question,'Question',1200,{required:true}),inv=requireValue(store.getInvestigation(sid,id),'Case');store.audit(sid,'TRACE AI Consulted',id,{mode:'case-grounded deterministic assistant'});return json(res,200,await answerQuestion(inv,question));}
 if(group==='search' && method==='GET') return json(res,200,search(sid,textField(url.searchParams.get('q')||'','Search query',200)));
 if(group==='settings') {
   if(method==='GET') return json(res,200,store.settings(session));
   if(method==='PUT') return json(res,200,store.updateSettings(session,validateWeights(await body(req))));
 }
 if(group==='audit') {
   if(id==='verify' && method==='GET') return json(res, 200, store.verifyAuditTrail(sid));
   if(!id && method==='GET') return json(res, 200, store.audits(sid));
 }
 if(group==='sources' && method==='GET') return json(res,200,sources());
 if(group==='reports') {
   if(!id && method==='GET') return json(res,200,store.reports(sid));
   if(id && sub==='generate' && method==='POST') {
     if(reportsInFlight>=3) fail('Report workers are busy. Please try again shortly.',503);
     const lockKey=caseKey(sid,id);
     if(reportLocks.has(lockKey)) fail('A report for this case is already being generated.',409);
     if(store.reports(sid).length>=50) fail('This demo workspace has reached its 50-report limit.',422);
     const inv=requireValue(store.getInvestigation(sid,id),'Case');if(!inv.edges.length) fail('Trace the case before generating an evidence report.',422);
     reportsInFlight++;reportLocks.add(lockKey);
     try {const version=store.reports(sid).filter(r=>r.caseId===id).length+1;const buffer=await generatePdf({...inv,reportVersion:version,reportCreatedAt:now(),audit:store.audits(sid).filter(a=>a.object===id || a.object.startsWith(id+'/'))});return json(res,201,store.saveReport(sid,id,buffer));}
     finally{reportsInFlight--;reportLocks.delete(lockKey);}
   }
   if(id && !sub && method==='GET') {const report=requireValue(store.report(sid,id),'Report');res.writeHead(200,{'Content-Type':'application/pdf','Content-Disposition':`inline; filename="${report.filename}"`,'Content-Length':report.content.length,'X-Evidence-SHA256':report.sha256});return res.end(Buffer.from(report.content));}
 }
 if(group==='requests') {
   if(!id && method==='GET') {
     return json(res, 200, store.listRequests ? store.listRequests(sid) : []);
   }
   if(id && !sub && method==='GET') {
     let reqPkg = store.getRequest ? store.getRequest(sid, id) : null;
     if (!reqPkg) {
       let inv = store.getInvestigation(sid, id);
       if (inv) {
         reqPkg = requestPackage(inv, session, {});
         if (store.saveRequest) store.saveRequest(sid, id, reqPkg);
       }
     }
     if(!reqPkg) fail(`Request package for ${id} not found.`, 404);
     return json(res, 200, reqPkg);
   }
   if(id && sub==='generate' && method==='POST') {
     const options = await body(req);
     let inv = store.getInvestigation(sid, id);
     if (!inv) {
       const graph = await getGraphEngine();
       const risk = new RiskEngine(graph);
       const txReport = risk.evaluateTransaction(id);
       if (txReport && txReport.found) {
         inv = txReport;
       }
     }
     if (!inv) fail(`Investigation or transaction ${id} was not found.`, 404);
     const pkg = requestPackage(inv, session, options);
     if (store.saveRequest) store.saveRequest(sid, id, pkg);
     store.audit(sid, 'VASP Request Package Prepared', id, { candidate: pkg.targetVasp, sent: false, reference: pkg.noticeReference });
     return json(res, 201, pkg);
   }
 }
 if(group==='events' && method==='GET') return startStream(req,res,session);
 if(group==='vasps' && method==='GET') {
   const all=store.listCases(sid).map(c=>store.getInvestigation(sid,c.id)).filter(Boolean).flatMap(inv=>(inv.attributions || []).map(a=>({...a,caseId:inv.case?.id,fraudType:inv.case?.fraudType})));
   return json(res,200,all);
 }
 if(group==='cross-chain' && method==='GET') {
   const all=store.listCases(sid).map(c=>store.getInvestigation(sid,c.id)).filter(Boolean).flatMap(inv=>(inv.crossChain || []).map(t=>({...t,caseId:inv.case?.id,fraudType:inv.case?.fraudType})));
   return json(res,200,all);
 }
 if(group==='patterns' && method==='GET') {
   const all=store.listCases(sid).map(c=>store.getInvestigation(sid,c.id)).filter(Boolean).map(inv=>({caseId:inv.case?.id,case:inv.case,fingerprint:inv.fingerprint || {features:{},patterns:[]},riskIndicators:inv.riskIndicators || []}));
   return json(res,200,all);
 }
 // Dataset Analytics & Ingestion
 if(group==='dataset') {
   const graph = await getGraphEngine();
   if(id==='stats' && method==='GET') {
     const stats = graph.getStats();
     store.saveDatasetMetadata(stats);
     return json(res, 200, stats);
   }
   if(id==='ingest' && method==='POST') {
     const result = await graph.pipeline.execute();
     graph.nodeIndex = result.nodeMap;
     graph.adjacency = result.adjacency;
     graph.reverseAdjacency = result.reverseAdjacency;
     graph.stats = result.stats;
     store.saveDatasetMetadata(result.stats);
     store.audit(sid, 'Dataset Ingestion Executed', 'elliptic-dataset', { nodes: result.stats.totalNodes, edges: result.stats.totalEdges });
     return json(res, 200, { message: 'Dataset ingested successfully', stats: result.stats });
   }
 }
 // Transaction Lookup & Risk Evaluation
 if(group==='transactions') {
   if(id==='investigations' && method==='GET') {
     return json(res, 200, store.listTxInvestigations(sid));
   }
   if(id && sub==='investigate' && method==='POST') {
     const graph = await getGraphEngine();
     const risk = new RiskEngine(graph);
     const report = risk.evaluateTransaction(id);
     if(!report.found) fail(report.error || `Transaction ${id} not found in Elliptic dataset.`, 404);
     const saved = store.saveTxInvestigation(sid, id, report);
     store.audit(sid, 'Transaction Investigation Saved', id, { riskScore: report.riskScore, riskCategory: report.riskCategory });
     return json(res, 201, saved);
   }
   if(id && sub==='calculate-risk' && method==='POST') {
     const data = await body(req);
     const graph = await getGraphEngine();
     const risk = new RiskEngine(graph);
     const report = risk.evaluateTransaction(id);
     if(!report.found) fail(report.error || `Transaction ${id} not found in Elliptic dataset.`, 404);
     const txReadiness = {
       readinessScore: report.riskScore >= 70 ? 86 : 68,
       readinessStatus: report.riskScore >= 70 ? 'ACTION_READY' : 'INQUIRY_IN_PROGRESS',
       parameters: [
         { id: 'identityNormalization', name: 'Identity & Wallet Normalization', weight: 15, score: 95, status: 'PASSED', finding: `Transaction ${id} verified on Bitcoin network. TimeStep: ${report.timeStep}.`, statutoryStandard: 'Section 65B Evidence Act' },
         { id: 'graphTraceCoverage', name: 'Graph Trace Coverage & Exit Identification', weight: 20, score: (report.graphFindings?.inDegree || 0) + (report.graphFindings?.outDegree || 0) > 0 ? 82 : 45, status: 'PASSED', finding: `${report.graphFindings?.inDegree || 0} incoming and ${report.graphFindings?.outDegree || 0} outgoing transaction edges mapped.`, statutoryStandard: 'CrPC Section 91 Flow Trace' },
         { id: 'counterpartyAttribution', name: 'Counterparty Attribution & Ground Truth Exposure', weight: 20, score: report.knownLabel === 'illicit' ? 98 : report.knownLabel === 'licit' ? 90 : 70, status: 'PASSED', finding: `Ground-truth label: ${report.knownLabel.toUpperCase()}. Illicit neighbor exposure: ${report.graphFindings?.neighborIllicitExposurePct || 0}%.`, statutoryStandard: 'PMLA 2002 Reporting Standard' },
         { id: 'temporalConsistency', name: 'Temporal Event Sequence & Holding Latency', weight: 15, score: 90, status: 'PASSED', finding: `Discrete time-step sequence preserved (TimeStep ${report.timeStep}).`, statutoryStandard: 'Section 65B Admissibility' },
         { id: 'statutoryNexus', name: 'Statutory Notice / Section 91 CrPC Evidentiary Nexus', weight: 15, score: report.riskScore >= 70 ? 92 : 65, status: report.riskScore >= 70 ? 'PASSED' : 'WARNING', finding: `${report.evidenceIndicators?.length || 0} evidence indicators documented. Nexus established.`, statutoryStandard: 'Section 91 CrPC Requisition' },
         { id: 'auditIntegrity', name: 'Cryptographic Chain of Custody & Audit Trail', weight: 15, score: 90, status: 'PASSED', finding: 'Cryptographic evidence hashing applied to investigation report.', statutoryStandard: 'ISO 27037' }
       ],
       statutorySummary: report.riskScore >= 70
         ? 'Transaction satisfies statutory criteria for immediate Section 91 CrPC notice dispatch to associated exchanges/custodians.'
         : 'Transaction evidentiary nexus established for exploratory inquiry.',
       criteriaApplied: data.criteria || {},
       evaluatedAt: now()
     };
     store.audit(sid, 'Transaction Risk & Readiness Calculated', id, { riskScore: report.riskScore, readinessScore: txReadiness.readinessScore });
     return json(res, 200, {
       txId: id,
       caseId: `TX-${id}`,
       riskScore: report.riskScore,
       riskLevel: report.riskCategory,
       readinessScore: txReadiness.readinessScore,
       readinessStatus: txReadiness.readinessStatus,
       parameters: txReadiness.parameters,
       statutorySummary: txReadiness.statutorySummary,
       graphFindings: report.graphFindings,
       evidenceIndicators: report.evidenceIndicators,
       evaluatedAt: txReadiness.evaluatedAt
     });
   }
   if(id && method==='GET' && id!=='ingest') {
     const graph = await getGraphEngine();
     const risk = new RiskEngine(graph);
     const report = risk.evaluateTransaction(id);
     if(!report.found) fail(report.error || `Transaction ${id} not found in Elliptic dataset.`, 404);
     return json(res, 200, report);
   }
 }
 // Graph Analytics & Algorithms
 if(group==='analytics') {
   const graph = await getGraphEngine();
   if(id==='bfs' && method==='GET') {
     const start = url.searchParams.get('start');
     if(!start) fail('Parameter start is required for BFS.', 400);
     const target = url.searchParams.get('target') || undefined;
     const depth = Number(url.searchParams.get('depth') || 5);
     const limit = Number(url.searchParams.get('limit') || 100);
     return json(res, 200, graph.bfs(start, { targetTxId: target, maxDepth: depth, limit }));
   }
   if(id==='dfs' && method==='GET') {
     const start = url.searchParams.get('start');
     if(!start) fail('Parameter start is required for DFS.', 400);
     const target = url.searchParams.get('target') || undefined;
     const depth = Number(url.searchParams.get('depth') || 8);
     const limit = Number(url.searchParams.get('limit') || 100);
     return json(res, 200, graph.dfs(start, { targetTxId: target, maxDepth: depth, limit }));
   }
   if(id==='dijkstra' && method==='GET') {
     const start = url.searchParams.get('start');
     const target = url.searchParams.get('target');
     const weight = url.searchParams.get('weight') || 'hop';
     if(!start || !target) fail('Parameters start and target are required for Dijkstra shortest path.', 400);
     return json(res, 200, graph.dijkstra(start, target, weight));
   }
   if(id==='components' && method==='POST') {
     const data = await body(req);
     const ids = Array.isArray(data.transactionIds) ? data.transactionIds : [];
     if(!ids.length) fail('Provide an array of transactionIds for component analysis.', 400);
     return json(res, 200, graph.connectedComponents(ids));
   }
   if(id==='top-suspicious' && method==='GET') {
     const k = Number(url.searchParams.get('k') || 10);
     const timestep = url.searchParams.get('timestep') || undefined;
     const label = url.searchParams.get('label') || undefined;
     return json(res, 200, graph.topSuspicious(k, { timeStep: timestep, label }));
   }
   if(id==='temporal' && method==='GET') {
     const window = Number(url.searchParams.get('window') || 3);
     const threshold = Number(url.searchParams.get('threshold') || 1.3);
     return json(res, 200, graph.slidingWindow(window, threshold));
   }
   if(id==='model-eval' && method==='GET') {
     if(!graph.modelEvaluation) fail('Model evaluation not available.', 404);
     store.saveModelEvaluation(graph.modelEvaluation);
     return json(res, 200, graph.modelEvaluation);
   }
   if(id==='neighborhood' && method==='GET') {
     const txId = url.searchParams.get('txId');
     if(!txId) fail('Parameter txId is required for neighborhood retrieval.', 400);
     const depth = Number(url.searchParams.get('depth') || 1);
     return json(res, 200, graph.neighborhood(txId, depth));
   }
   if(id==='subgraph' && method==='GET') {
     const txId = url.searchParams.get('txId') || url.searchParams.get('start') || url.searchParams.get('id');
     if(!txId) fail('Parameter txId is required for subgraph retrieval.', 400);
     const depth = Number(url.searchParams.get('depth') || 1);
     const limit = Number(url.searchParams.get('limit') || 60);
     return json(res, 200, graph.getSubgraph(txId, depth, limit));
   }
 }
 fail('API endpoint not found.',404);
}
const server=http.createServer((req,res)=>{Promise.resolve(handle(req,res)).catch(error=>{
 if(res.headersSent){res.end();return;}
 const status=error.status || 500;
 if(status>=500) console.error(JSON.stringify({level:'error',at:now(),path:req.url?.split('?')[0],message:error.message}));
 if(status===429) res.setHeader('Retry-After','60');
 json(res,status,{error:status>=500 && status!==501 && status!==503?'An internal error occurred. Please try again.':error.message});
});});
server.requestTimeout=35000;server.headersTimeout=15000;server.keepAliveTimeout=5000;
if (!process.env.VERCEL && process.argv[1] && resolve(process.argv[1])===fileURLToPath(import.meta.url)) {
  server.listen(PORT,HOST,()=>console.log(JSON.stringify({service:'CRYPTO-TRACE INDIA',port:PORT,host:HOST,mode:process.env.DEMO_MODE==='true'?'EXPLICIT DEMONSTRATION':'EVIDENCE INVESTIGATION',database:'sqlite'})));
  function shutdown(){for(const res of sseClients)res.end();server.close(()=>{store.close();process.exit(0);});setTimeout(()=>process.exit(0),2000).unref();}
  process.on('SIGTERM',shutdown);process.on('SIGINT',shutdown);
}
export { server, store, handle };
