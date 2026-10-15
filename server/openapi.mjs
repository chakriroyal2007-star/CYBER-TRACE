const jsonSchema=(schema)=>({'application/json':{schema}});
const obj=(properties,required=[])=>({type:'object',properties,required});
const str={type:'string'},num={type:'number'};
const endpoint=(summary,response='object',body)=>({summary,security:[{demoSession:[]}],...(body?{requestBody:{required:true,content:jsonSchema(body)}}:{}),responses:{200:{description:'Success',content:jsonSchema(typeof response==='string'?{type:response}:response)},400:{description:'Validation failed'},401:{description:'Start a demo session first'},404:{description:'Object not present in this session'},429:{description:'Rate limit exceeded'}}});
const caseBody=obj({id:str,complaintId:str,fraudType:{type:'string',enum:['Investment Scam','Task Scam','Phishing','Sextortion','Ransomware','Darknet','Financial Fraud','Other']},victimLoss:{type:'number',minimum:.01},currency:{type:'string',enum:['INR']},reportedWallet:str,chain:{type:'string',enum:['Ethereum','Polygon','BNB Chain','Bitcoin','TRON']},transactionHash:str,priority:{type:'string',enum:['Low','Medium','High','Critical']},description:str,attachments:{type:'array',items:obj({name:str,type:str,size:num,description:str},['name'])}},['fraudType','victimLoss','reportedWallet','chain']);
const paths={
 '/api/health':{get:{...endpoint('Service, database and mode health'),security:[]}},
 '/api/auth/demo':{post:{...endpoint('Enter or resume a private synthetic demo workspace'),security:[]}},
 '/api/auth/me':{get:endpoint('Current session and expiry')},
 '/api/auth/logout':{post:endpoint('Clear the current browser session cookie')},
 '/api/dashboard':{get:endpoint('Aggregate metrics and chart data from persisted case evidence')},
 '/api/cases':{get:endpoint('List cases; supports q, fraudType, risk, chain, status, vasp, date, sort, limit, offset','array'),post:endpoint('Create a validated complaint and canonical reported wallet','object',caseBody)},
 '/api/cases/{id}':{get:endpoint('Fetch one case'),patch:endpoint('Update workflow status','object',obj({status:{type:'string',enum:['New','Analyzing','Investigating','Action Required','Monitoring','Closed']}},['status']))},
 '/api/cases/{id}/related':{get:endpoint('Evidence-based wallet and cluster correlation','array')},
 '/api/investigations':{get:endpoint('List investigated cases','array'),post:endpoint('Run deterministic synthetic analysis and persist evidence','object',obj({caseId:str},['caseId']))},
 '/api/investigations/{id}':{get:endpoint('Full persisted investigation workspace')},
 '/api/wallets/{address}':{get:endpoint('Wallet intelligence across cases in the current session')},
 '/api/wallets/{address}/transactions':{get:endpoint('Transactions involving the wallet','array')},
 '/api/wallets':{post:endpoint('Add a validated wallet to an existing synthetic investigation','object',obj({caseId:str,address:str,chain:str,label:str,type:str},['caseId','address','chain']))},
 '/api/transactions/ingest':{post:endpoint('Validate and ingest synthetic transaction records for existing case wallets','object',obj({caseId:str,transactions:{type:'array',items:obj({id:str,source:str,target:str,hash:str,chain:str,asset:str,amount:num,timestamp:{type:'string',format:'date-time'},highlighted:{type:'boolean'}},['id','source','target','hash','chain','amount','timestamp'])}},['caseId','transactions']))},
 '/api/graph/{id}':{get:endpoint('Directed transaction graph with INR-equivalent edge values')},
 '/api/knowledge-graph/{id}':{get:endpoint('Evidence, entity, cluster, chain and pattern graph abstraction')},
 '/api/attribution/{id}':{get:endpoint('Candidates with weighted evidence and explanatory contributions','array')},
 '/api/evidence/{caseId}/{id}/view':{post:endpoint('Fetch evidence and append a view audit event')},
 '/api/alerts':{get:endpoint('Case alerts in current demo workspace','array')},
 '/api/alerts/{id}':{patch:endpoint('Mark reviewed or dismiss an alert','object',obj({status:{type:'string',enum:['Reviewed','Dismissed']}},['status']))},
 '/api/search':{get:endpoint('Global search; query q is required, maximum 50 results','array')},
 '/api/assistant/{caseId}':{post:endpoint('Case-grounded deterministic assistant; no external LLM or fabricated citations','object',obj({question:str},['question']))},
 '/api/reports':{get:endpoint('List generated reports with versions and SHA-256 hashes','array')},
 '/api/reports/{caseId}/generate':{post:endpoint('Generate and persist a full PDF evidence report')},
 '/api/reports/{id}':{get:{...endpoint('Download a session-scoped PDF report'),responses:{200:{description:'PDF report',content:{'application/pdf':{schema:{type:'string',format:'binary'}}}},404:{description:'Report not present in this session'}}}},
 '/api/requests/{caseId}/generate':{post:endpoint('Prepare a structured VASP information request; does not send externally')},
 '/api/settings':{get:endpoint('Current demo mode and attribution weights'),put:endpoint('Change weights; applies on next trace, sum must equal 100','object',obj({weights:obj(Object.fromEntries(['cluster','pattern','deposit','temporal','crossChain','historical','external'].map(k=>[k,{type:'number',minimum:0,maximum:100}])))}))},
 '/api/sources':{get:endpoint('Data adapters and explicit disconnected official integrations','array')},
 '/api/audit':{get:endpoint('Append-only application audit records within the active workspace','array')},
 '/api/events':{get:{...endpoint('SSE replay of stored case events; labeled DEMO STREAM'),responses:{200:{description:'Stored evidence replay, not a blockchain subscription',content:{'text/event-stream':{schema:{type:'string'}}}}}}},
 '/api/vasps':{get:endpoint('Candidate VASP directory with case references','array')},
 '/api/cross-chain':{get:endpoint('Observed synthetic bridge pairings','array')},
 '/api/patterns':{get:endpoint('Rule-based case fingerprint profiles','array')},
};
for(const path of ['/api/cases','/api/wallets','/api/transactions/ingest','/api/reports/{caseId}/generate','/api/requests/{caseId}/generate']) { paths[path].post.responses[201]=paths[path].post.responses[200]; delete paths[path].post.responses[200]; }
for(const [path,methods] of Object.entries(paths)) {
 const params=[...path.matchAll(/\{([^}]+)\}/g)].map(m=>({name:m[1],in:'path',required:true,schema:str}));
 if(params.length) for(const operation of Object.values(methods)) operation.parameters=params;
}
paths['/api/search'].get.parameters=[{name:'q',in:'query',required:true,schema:str}];
paths['/api/cases'].get.parameters=['q','fraudType','risk','chain','status','vasp','date','sort','limit','offset'].map(name=>({name,in:'query',schema:str}));
export const openapi={openapi:'3.0.3',info:{title:'CRYPTO-TRACE INDIA API',version:'1.0.0',description:'Synthetic cybercrime investigation prototype. Enter POST /api/auth/demo first to receive an HttpOnly ct_session cookie. All data and reports are scoped to that anonymous workspace. No live blockchain feed, government integration, production investigator identity or automated external action.'},servers:[{url:'/'}],components:{securitySchemes:{demoSession:{type:'apiKey',in:'cookie',name:'ct_session'}},schemas:{CreateCase:caseBody,Error:obj({error:str},['error'])}},paths};
const escape=value=>String(value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export function docsHtml() {
 return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>CRYPTO-TRACE INDIA | API Reference</title><style>body{background:#08111e;color:#d8e4f0;font:15px/1.6 system-ui,sans-serif;margin:0;padding:40px;max-width:1000px;margin:auto}a{color:#68d8e3}h1{letter-spacing:-1px}header{border-bottom:1px solid #2b3c51;padding-bottom:24px}small{color:#94a9bf}code,pre{font:13px/1.6 ui-monospace,monospace;background:#142235;border-radius:4px}pre{padding:16px;overflow:auto}article{border:1px solid #2b3c51;padding:18px;margin:12px 0;border-radius:7px}summary{cursor:pointer}b{color:#58d0dc}section{margin:32px 0}p{max-width:85ch}footer{color:#91a5bc;margin-top:40px}</style></head><body><header><small>CRYPTO-TRACE INDIA / DEVELOPER REFERENCE</small><h1>Investigation API</h1><p>Evidence-backed, session-scoped intelligence. All responses use <b>SIMULATED INVESTIGATION DATA</b>.</p><a href="/api/openapi.json">Download OpenAPI 3.0 specification</a> · <a href="/">Open application</a></header><section><h2>Authentication and local use</h2><p>Start a demo session with POST /api/auth/demo. Your client must retain the HttpOnly ct_session cookie. Sessions contain isolated seeded cases and expire after the configured TTL. The public demo does not implement government SSO.</p><pre>curl -c cookies.txt -X POST -H 'Content-Type: application/json' -d '{}' &lt;origin&gt;/api/auth/demo\ncurl -b cookies.txt &lt;origin&gt;/api/investigations/CR-2026-00192</pre><p>Money fields are synthetic INR equivalents. Timestamps are ISO 8601 UTC. Errors have the shape <code>{"error":"safe message"}</code>. Input bodies are limited to 1 MiB. API requests are rate limited.</p></section>${Object.entries(paths).flatMap(([path,methods])=>Object.entries(methods).map(([method,o])=>`<article><details><summary><b>${method.toUpperCase()}</b> <code>${escape(path)}</code> — ${escape(o.summary)}</summary>${o.requestBody?`<h4>JSON request schema</h4><pre>${escape(JSON.stringify(o.requestBody.content['application/json'].schema,null,2))}</pre>`:''}<p>Responses: ${Object.entries(o.responses).map(([code,r])=>`${code} ${escape(r.description)}`).join(' · ')}</p>${o.parameters?`<p>Parameters: ${o.parameters.map(p=>escape(p.name)+' ('+p.in+')').join(', ')}</p>`:''}</details></article>`)).join('')}<footer>Integration adapters are architecture interfaces only. No NCRP, SAHYOG, VASP private records or live blockchain connectivity is enabled.</footer></body></html>`;
}
