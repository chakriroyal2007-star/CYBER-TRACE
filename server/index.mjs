import http from 'node:http';
import { randomUUID } from 'node:crypto';
import { spawn } from 'node:child_process';
import { createReadStream, existsSync, statSync } from 'node:fs';
import { dirname, extname, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Store, now, caseKey } from './db.mjs';
import { answerQuestion } from './assistant.mjs';
import { openapi, docsHtml } from './openapi.mjs';
import { validateCase, validateWeights, validateTransaction, normalizeWallet, enumField, textField, object, STATUSES, CHAINS, fail } from './validation.mjs';
import { generatePdfNode } from './pdf.mjs';

const root=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const store=new Store();
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
  res.setHeader('Access-Control-Allow-Headers','Content-Type');
}
function limited(req,path) {
  const ip=req.headers['x-forwarded-for']?.split(',')[0]?.trim() || req.socket?.remoteAddress || 'unknown';
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
  for await(const chunk of req) { bytes+=chunk.length; if(bytes>1048576) fail('Request body exceeds 1 MiB.',413); raw+=chunk.toString('utf8'); }
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
    const matches=inv.nodes.filter(n=>n.address===address || (n.address.startsWith('0x') && n.address.toLowerCase()===address.toLowerCase()));
    for(const node of matches) results.push({inv,node});
  }
  if(!results.length) fail('Wallet was not found in the current dataset. Create an investigation to analyze a new reported wallet in demo mode.',404);
  const first=results[0],transactions=results.flatMap(({inv,node})=>inv.edges.filter(e=>e.source===node.id||e.target===node.id).map(e=>({...e,caseId:inv.case.id})));
  return {wallet:first.node,cases:[...new Map(results.map(r=>[r.inv.case.id,r.inv.case])).values()],transactions,behavior:first.inv.fingerprint?.features || {},fingerprint:first.inv.fingerprint || {features:{},patterns:[]},source:'SIMULATED INVESTIGATION DATA'};
}
function dashboard(sessionId) {
  const cases=store.listCases(sessionId),investigations=cases.map(c=>store.getInvestigation(sessionId,c.id)).filter(Boolean),alerts=store.alerts(sessionId);
  const group=(values)=>Object.entries(values.reduce((a,v)=>(a[v]=(a[v] || 0)+1,a),{})).map(([name,value])=>({name,value}));
  const terminalByChain={};
  for(const inv of investigations) for(const edge of (inv.edges || [])) {
    const targetNode = (inv.nodes || []).find(n=>n.id===edge.target);
    if(targetNode && targetNode.type==='vasp') terminalByChain[targetNode.chain]=(terminalByChain[targetNode.chain]||0)+edge.amount;
  }
  const activity=investigations.flatMap(inv=>(inv.timeline || []).map(e=>({...e,caseId:inv.case?.id}))).sort((a,b)=>b.timestamp.localeCompare(a.timestamp)).slice(0,12);
  const days={};
  for(const inv of investigations) {
    if (!inv.timeline) continue;
    for(const day of new Set(inv.timeline.map(e=>e.timestamp.slice(0,10)))) { days[day] ||= [];days[day].push(inv.case.riskScore); }
  }
  return {cases,metrics:{activeCases:cases.filter(c=>c.status!=='Closed').length,highRiskWallets:new Set(investigations.flatMap(i=>(i.nodes || []).filter(n=>n.riskScore>=70).map(n=>`${n.chain}/${n.address}`))).size,vaspLeads:investigations.reduce((a,i)=>a+(i.attributions?.length || 0),0),fundsTraced:cases.reduce((a,c)=>a+(c.tracedAmount || 0),0),crossChainMovements:investigations.reduce((a,i)=>a+(i.crossChain?.length || 0),0),relatedCases:new Set(investigations.flatMap(i=>(i.relatedCases || []).map(r=>[i.case?.id,r.caseId].sort().join('/')))).size,activeAlerts:alerts.filter(a=>a.status==='Open').length},fraudTypes:group(cases.map(c=>c.fraudType)),chainFlows:Object.entries(terminalByChain).map(([name,value])=>({name,value})),attributionDistribution:group(cases.map(c=>c.vaspCandidate)),riskTrend:Object.entries(days).sort().map(([date,scores])=>({date,value:Math.round(scores.reduce((a,v)=>a+v,0)/scores.length)})),activity,source:'SIMULATED INVESTIGATION DATA',riskTrendMethod:'Average current case risk scores by observed event date; not historical re-scoring.'};
}
function search(sessionId,q) {
  if(!q || q.length<2) return [];
  q=q.toLowerCase();
  const hits=[],match=(...values)=>values.some(v=>String(v??'').toLowerCase().includes(q));
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
function requestPackage(inv,session) {
 const candidate=inv.attributions[0];if(!candidate) fail('No supported VASP candidate exists for this case. An information request cannot be prepared.',422);
 return {packageVersion:'1.0',preparedAt:now(),preparedBy:session.display_name,status:'DRAFT FOR AUTHORIZED HUMAN REVIEW',sent:false,targetVasp:candidate.candidate,caseId:inv.case.id,complaintId:inv.case.complaintId,reportedWallet:inv.case.reportedWallet,wallets:inv.nodes.filter(n=>n.type==='vasp').map(n=>({address:n.address,chain:n.chain})),amountINR:candidate.tracedAmount,confidence:candidate.confidence,dateRange:{from:candidate.firstInteraction,to:candidate.lastInteraction},transactions:inv.edges.filter(e=>inv.nodes.some(n=>n.id===e.target&&n.type==='vasp')),evidence:candidate.evidence,requestedInformation:['Preservation of records associated with listed transactions, subject to applicable legal authority.','Confirmation of whether listed addresses are controlled by the recipient VASP.','Information disclosure through the appropriate authorized legal process.'],reviewChecklist:['Verify independent blockchain evidence and entity identity.','Establish jurisdiction, legal basis and signatory authority.','Review scope and proportionality before submitting through approved channels.'],source:'SIMULATED INVESTIGATION DATA',disclaimer:'Synthetic demonstration package only. Not a legal notice, government document or finding of guilt. No request has been sent externally.'};
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
   store.db.prepare('SELECT 1').get();return json(res,200,{status:'ok',service:'CRYPTO-TRACE INDIA',version:'1.0.0',database:'sqlite',persistent:process.env.DB_PATH!==':memory:',mode:'SIMULATED INVESTIGATION DATA',liveBlockchain:false,timestamp:now()});
 }
 if(path==='/api/openapi.json' && method==='GET') return json(res,200,openapi);
 if(path==='/api/docs' && method==='GET') {res.writeHead(200,{'Content-Type':'text/html; charset=utf-8'});return res.end(docsHtml());}
 if(path==='/api/auth/demo' && method==='POST') {
   await body(req);
   const existing=store.session(cookies(req).ct_session);
   if(existing) return json(res,200,{user:{name:existing.display_name,role:'demo-investigator'},mode:'DEMO ENVIRONMENT',expiresAt:existing.expires_at});
   const {token,session}=store.createSession();res.setHeader('Set-Cookie',sessionCookie(req,token,Math.floor((Date.parse(session.expires_at)-Date.now())/1000)));
   return json(res,200,{user:{name:session.display_name,role:'demo-investigator'},mode:'DEMO ENVIRONMENT',expiresAt:session.expires_at});
 }
 if(path==='/api/auth/login' && method==='POST') {
   const data = await body(req);
   const email = String(data.email || '').trim().toLowerCase();
   const password = String(data.password || '').trim();
   if(!email || !email.includes('@')) fail('Please enter a valid investigator email address.', 400);
   if(!password || password.length < 4) fail('Password must be at least 4 characters.', 400);
   const rawName = email.split('@')[0].replace(/[\._\-]/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
   const displayName = `${rawName} (Officer)`;
   const { token, session } = store.createSession(displayName, 'official-investigator');
   res.setHeader('Set-Cookie', sessionCookie(req, token, Math.floor((Date.parse(session.expires_at) - Date.now()) / 1000)));
   return json(res, 200, { user: { name: session.display_name, email, role: 'official-investigator' }, mode: 'OFFICIAL INVESTIGATOR', expiresAt: session.expires_at });
 }
 const session=store.session(cookies(req).ct_session);if(!session) fail('Start a demo session to access this workspace.',401);
 const sid=session.id;
 if(path==='/api/auth/me' && method==='GET') return json(res,200,{user:{name:session.display_name,role:session.role || 'investigator'},mode:session.role==='official-investigator'?'OFFICIAL INVESTIGATOR':'DEMO ENVIRONMENT',expiresAt:session.expires_at});
 if(path==='/api/auth/logout' && method==='POST') {store.audit(sid,'Session Signed Out','workspace');store.db.prepare('UPDATE sessions SET expires_at=? WHERE id=?').run(now(),sid);res.setHeader('Set-Cookie',sessionCookie(req,'',0));return json(res,200,{ok:true});}
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
   if(id && !sub && method==='GET') return json(res,200,requireValue(store.getCase(sid,id),'Case'));
   if(id && !sub && method==='PATCH') {const data=await body(req);const status=enumField(data.status,STATUSES,'Status');return json(res,200,requireValue(store.setStatus(sid,id,status),'Case'));}
 }
 if(group==='investigations') {
   if(!id && method==='GET') return json(res,200,store.listCases(sid));
   if(!id && method==='POST') {const data=await body(req);const caseId=textField(data.caseId,'Case ID',50,{required:true});return json(res,200,requireValue(store.trace(sid,caseId,session.weights),'Case'));}
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
 if(group==='assistant' && id && method==='POST') {const data=await body(req),question=textField(data.question,'Question',1200,{required:true}),inv=requireValue(store.getInvestigation(sid,id),'Case');store.audit(sid,'TRACE AI Consulted',id,{mode:'case-grounded deterministic assistant'});return json(res,200,answerQuestion(inv,question));}
 if(group==='search' && method==='GET') return json(res,200,search(sid,textField(url.searchParams.get('q')||'','Search query',200)));
 if(group==='settings') {
   if(method==='GET') return json(res,200,store.settings(session));
   if(method==='PUT') return json(res,200,store.updateSettings(session,validateWeights(await body(req))));
 }
 if(group==='audit' && method==='GET') return json(res,200,store.audits(sid));
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
 if(group==='requests' && id && sub==='generate' && method==='POST') {const pkg=requestPackage(requireValue(store.getInvestigation(sid,id),'Case'),session);store.audit(sid,'VASP Request Package Prepared',id,{candidate:pkg.targetVasp,sent:false});return json(res,201,pkg);}
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
if (!process.env.VERCEL) {
  server.listen(PORT,HOST,()=>console.log(JSON.stringify({service:'CRYPTO-TRACE INDIA',port:PORT,host:HOST,mode:'SIMULATED INVESTIGATION DATA',database:'sqlite'})));
  function shutdown(){for(const res of sseClients)res.end();server.close(()=>{store.close();process.exit(0);});setTimeout(()=>process.exit(0),2000).unref();}
  process.on('SIGTERM',shutdown);process.on('SIGINT',shutdown);
}
export { server, store, handle };
