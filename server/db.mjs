import { DatabaseSync } from 'node:sqlite';
import { createHash, randomBytes, randomUUID } from 'node:crypto';
import { dirname, resolve } from 'node:path';
import { mkdirSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { DEFAULT_WEIGHTS, analyzeDataset, correlateCases } from './analytics.mjs';
import { DemoBlockchainAdapter } from './adapters.mjs';
const blockchain = new DemoBlockchainAdapter();

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const parse = (row) => row ? JSON.parse(row.payload) : null;
export const now = () => new Date().toISOString();
export const caseKey = (sessionId, id) => `${sessionId}/${id}`;
const hash = value => createHash('sha256').update(value).digest('hex');
const evm = label => `0x${hash(label).slice(0,40)}`;
const seedDefinitions = [
  ['CR-2026-00192','Investment Scam',812450,'Ethereum','Action Required','High'],
  ['CR-2026-00193','Phishing',350000,'Ethereum','Investigating','High'],
  ['CR-2026-00194','Financial Fraud',200000,'BNB Chain','Monitoring','Medium'],
  ['CR-2026-00195','Ransomware',975000,'Bitcoin','Investigating','Critical'],
  ['CR-2026-00196','Task Scam',150000,'TRON','Action Required','High'],
  ['CR-2026-00197','Task Scam',500000,'TRON','Monitoring','Medium'],
];
function base58(buffer) {
  const alphabet = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';
  let value = BigInt(`0x${buffer.toString('hex')}`), encoded = '';
  while (value) { encoded = alphabet[Number(value % 58n)] + encoded; value /= 58n; }
  for (const byte of buffer) { if(byte !== 0) break; encoded = '1' + encoded; }
  return encoded;
}
export function fixtureAddress(chain, label) {
  if (['Ethereum','Polygon','BNB Chain'].includes(chain)) return evm(label);
  const payload = Buffer.concat([Buffer.from([chain === 'TRON' ? 0x41 : 0x00]), createHash('sha256').update(label).digest().subarray(0,20)]);
  const checksum = createHash('sha256').update(createHash('sha256').update(payload).digest()).digest().subarray(0,4);
  return base58(Buffer.concat([payload, checksum]));
}
const initialSql = `PRAGMA foreign_keys = ON;
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY, display_name TEXT NOT NULL, role TEXT NOT NULL DEFAULT 'demo-investigator', created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS sessions (
  id TEXT PRIMARY KEY, token_hash TEXT NOT NULL UNIQUE, user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at TEXT NOT NULL, expires_at TEXT NOT NULL, weights TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS cases (
  key TEXT PRIMARY KEY, session_id TEXT NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  id TEXT NOT NULL, complaint_id TEXT NOT NULL, fraud_type TEXT NOT NULL, chain TEXT NOT NULL, status TEXT NOT NULL,
  risk_score REAL NOT NULL DEFAULT 0, victim_loss REAL NOT NULL CHECK(victim_loss >= 0), reported_wallet TEXT NOT NULL,
  created_at TEXT NOT NULL, updated_at TEXT NOT NULL, payload TEXT NOT NULL, UNIQUE(session_id,id)
);
CREATE INDEX IF NOT EXISTS cases_session_status ON cases(session_id,status,updated_at);
CREATE INDEX IF NOT EXISTS cases_wallet ON cases(session_id,reported_wallet);
CREATE INDEX IF NOT EXISTS cases_fraud_chain ON cases(session_id,fraud_type,chain);
CREATE TABLE IF NOT EXISTS wallet_clusters (
  key TEXT PRIMARY KEY, case_key TEXT NOT NULL REFERENCES cases(key) ON DELETE CASCADE, id TEXT NOT NULL, entity TEXT, payload TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS wallets (
  key TEXT PRIMARY KEY, case_key TEXT NOT NULL REFERENCES cases(key) ON DELETE CASCADE, id TEXT NOT NULL,
  address TEXT NOT NULL, chain TEXT NOT NULL, type TEXT NOT NULL, risk_score REAL NOT NULL, cluster_id TEXT, payload TEXT NOT NULL,
  UNIQUE(case_key,id)
);
CREATE INDEX IF NOT EXISTS wallets_address_chain ON wallets(address,chain);
CREATE INDEX IF NOT EXISTS wallets_case_cluster ON wallets(case_key,cluster_id);
CREATE TABLE IF NOT EXISTS transactions (
  key TEXT PRIMARY KEY, case_key TEXT NOT NULL REFERENCES cases(key) ON DELETE CASCADE, id TEXT NOT NULL,
  source_wallet_key TEXT NOT NULL REFERENCES wallets(key) ON DELETE CASCADE, target_wallet_key TEXT NOT NULL REFERENCES wallets(key) ON DELETE CASCADE,
  hash TEXT NOT NULL, chain TEXT NOT NULL, amount REAL NOT NULL CHECK(amount >= 0), timestamp TEXT NOT NULL, payload TEXT NOT NULL,
  UNIQUE(case_key,id)
);
CREATE INDEX IF NOT EXISTS transactions_hash ON transactions(hash);
CREATE INDEX IF NOT EXISTS transactions_case_time ON transactions(case_key,timestamp);
CREATE INDEX IF NOT EXISTS transactions_source ON transactions(source_wallet_key);
CREATE INDEX IF NOT EXISTS transactions_target ON transactions(target_wallet_key);
CREATE TABLE IF NOT EXISTS vasps (
  id TEXT PRIMARY KEY, name TEXT NOT NULL, fictional INTEGER NOT NULL DEFAULT 1, metadata TEXT NOT NULL
);
INSERT OR IGNORE INTO vasps VALUES ('vasp-x','VASP-X',1,'{"type":"fictional demo entity","jurisdiction":"unspecified"}');
INSERT OR IGNORE INTO vasps VALUES ('vasp-y','VASP-Y',1,'{"type":"fictional demo entity","jurisdiction":"unspecified"}');
INSERT OR IGNORE INTO vasps VALUES ('vasp-z','VASP-Z',1,'{"type":"fictional demo entity","jurisdiction":"unspecified"}');
CREATE TABLE IF NOT EXISTS attributions (
  key TEXT PRIMARY KEY, case_key TEXT NOT NULL REFERENCES cases(key) ON DELETE CASCADE, id TEXT NOT NULL,
  candidate TEXT NOT NULL, confidence REAL NOT NULL, traced_amount REAL NOT NULL, payload TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS attribution_case_confidence ON attributions(case_key,confidence);
CREATE TABLE IF NOT EXISTS evidence (
  key TEXT PRIMARY KEY, case_key TEXT NOT NULL REFERENCES cases(key) ON DELETE CASCADE, id TEXT NOT NULL,
  title TEXT NOT NULL, kind TEXT NOT NULL, payload TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS evidence_case_id ON evidence(case_key,id);
CREATE TABLE IF NOT EXISTS fraud_patterns (
  key TEXT PRIMARY KEY, case_key TEXT NOT NULL REFERENCES cases(key) ON DELETE CASCADE, name TEXT NOT NULL, score REAL NOT NULL, payload TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS cross_chain_transfers (
  key TEXT PRIMARY KEY, case_key TEXT NOT NULL REFERENCES cases(key) ON DELETE CASCADE, id TEXT NOT NULL,
  source_chain TEXT NOT NULL, destination_chain TEXT NOT NULL, amount REAL NOT NULL, timestamp TEXT NOT NULL, payload TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS alerts (
  key TEXT PRIMARY KEY, session_id TEXT NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  case_key TEXT NOT NULL REFERENCES cases(key) ON DELETE CASCADE, id TEXT NOT NULL, severity TEXT NOT NULL,
  type TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'Open', timestamp TEXT NOT NULL, payload TEXT NOT NULL, UNIQUE(session_id,id)
);
CREATE INDEX IF NOT EXISTS alerts_session_status ON alerts(session_id,status,timestamp);
CREATE TABLE IF NOT EXISTS reports (
  id TEXT PRIMARY KEY, session_id TEXT NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  case_key TEXT NOT NULL REFERENCES cases(key) ON DELETE CASCADE, case_id TEXT NOT NULL, created_at TEXT NOT NULL,
  version INTEGER NOT NULL, filename TEXT NOT NULL, sha256 TEXT NOT NULL, content BLOB NOT NULL
);
CREATE INDEX IF NOT EXISTS reports_session_case ON reports(session_id,case_id,created_at);
CREATE TABLE IF NOT EXISTS case_relationships (
  key TEXT PRIMARY KEY, case_key TEXT NOT NULL REFERENCES cases(key) ON DELETE CASCADE,
  related_case_key TEXT NOT NULL REFERENCES cases(key) ON DELETE CASCADE, confidence REAL NOT NULL, payload TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS investigation_events (
  key TEXT PRIMARY KEY, case_key TEXT NOT NULL REFERENCES cases(key) ON DELETE CASCADE,
  id TEXT NOT NULL, timestamp TEXT NOT NULL, action TEXT NOT NULL, payload TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS investigation_events_case_time ON investigation_events(case_key,timestamp);
CREATE TABLE IF NOT EXISTS audit_logs (
  id TEXT PRIMARY KEY, session_id TEXT NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  timestamp TEXT NOT NULL, user_id TEXT NOT NULL REFERENCES users(id), action TEXT NOT NULL, object TEXT NOT NULL, metadata TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS audit_session_time ON audit_logs(session_id,timestamp);
CREATE TABLE IF NOT EXISTS analyses (
  case_key TEXT PRIMARY KEY REFERENCES cases(key) ON DELETE CASCADE, payload TEXT NOT NULL, analyzed_at TEXT NOT NULL
);`;

export class Store {
  constructor(path = process.env.DB_PATH || (process.env.VERCEL ? '/tmp/cryptotrace.sqlite' : resolve(root,'data/cryptotrace.sqlite'))) {
    if (path !== ':memory:') {
      try { mkdirSync(dirname(resolve(path)),{recursive:true}); } catch {}
    }
    this.db = new DatabaseSync(path);
    this.db.exec('PRAGMA foreign_keys = ON; PRAGMA journal_mode = WAL; PRAGMA busy_timeout = 5000;');
    this.db.exec('CREATE TABLE IF NOT EXISTS schema_migrations (version INTEGER PRIMARY KEY, applied_at TEXT NOT NULL);');
    if (!this.db.prepare('SELECT version FROM schema_migrations WHERE version=1').get()) {
      this.db.exec('BEGIN IMMEDIATE');
      try {
        let migrationSql = initialSql;
        try {
          const fileSql = readFileSync(resolve(root,'migrations/001_initial.sql'),'utf8');
          if (fileSql) migrationSql = fileSql;
        } catch {}
        this.db.exec(migrationSql);
        this.db.prepare('INSERT INTO schema_migrations VALUES(1,?)').run(now());
        this.db.exec('COMMIT');
      } catch(error) { this.db.exec('ROLLBACK'); throw error; }
    }
  }
  close() { try { this.db.close(); } catch {} }
  session(token) {
    if (!token) return null;
    const row = this.db.prepare('SELECT s.*, u.display_name FROM sessions s JOIN users u ON u.id=s.user_id WHERE token_hash=? AND expires_at>?').get(hash(token),now());
    return row ? {...row,weights:JSON.parse(row.weights)} : null;
  }
  createSession(displayName = 'Demo Investigator', role = 'demo-investigator') {
    // Reclaim expired anonymous demo workspaces; never touch an active workspace.
    this.db.prepare('DELETE FROM users WHERE id IN (SELECT user_id FROM sessions WHERE expires_at<?)').run(now());
    const count = this.db.prepare('SELECT COUNT(*) count FROM sessions').get().count;
    if(count >= Number(process.env.MAX_DEMO_SESSIONS || 1000)) throw Object.assign(new Error('Demo capacity reached. Please try again later.'),{status:503});
    const id = randomUUID(), token = randomBytes(32).toString('hex'), createdAt=now();
    const expiresAt = new Date(Date.now()+Number(process.env.SESSION_TTL_HOURS || 168)*3600000).toISOString();
    this.db.prepare('INSERT INTO users VALUES(?,?,?,?)').run(id,displayName,role,createdAt);
    this.db.prepare('INSERT INTO sessions VALUES(?,?,?,?,?,?)').run(id,hash(token),id,createdAt,expiresAt,JSON.stringify(DEFAULT_WEIGHTS));
    const session = this.session(token);
    for(const [caseId,fraudType,victimLoss,chain,status,priority] of seedDefinitions) {
      const record = {
        id:caseId, complaintId:`DEMO-NCRP-${caseId.slice(-5)}`, fraudType,victimLoss,currency:'INR',
        reportedWallet:fixtureAddress(chain,caseId),chain,transactionHash:'',priority,
        description:'Fictional synthetic training complaint. No real victim, VASP or criminal allegation. Amounts are simulated INR-equivalent bookkeeping, not live token prices.',
        attachments:[{name:'synthetic-complaint.txt',type:'text/plain',size:824,description:'Demo metadata only; no attachment uploaded.'}],
        status:'New',riskScore:0,tracedAmount:0,confidence:0,vaspCandidate:'Unknown',transactionCount:0,walletCount:0,chains:[chain],
        updatedAt:'2026-09-24T15:06:00.000Z',createdAt:'2026-09-24T14:20:00.000Z',source:'demo',
      };
      this.insertCase(id,record);
      this.trace(id,caseId,session.weights,{seed:true,status});
    }
    this.refreshRelationships(id);
    this.audit(id,role==='official-investigator'?'Official Investigator Signed In':'Demo Session Created','workspace',{datasetVersion:'2026.09.24-v1'});
    return {token,session};
  }
  audit(sessionId,action,object,metadata={}) {
    this.db.prepare('INSERT INTO audit_logs VALUES(?,?,?,?,?,?,?)').run(randomUUID(),sessionId,now(),sessionId,action,String(object),JSON.stringify(metadata));
  }
  audits(sessionId) {
    return this.db.prepare('SELECT a.id,a.timestamp,u.display_name user,a.action,a.object,a.metadata FROM audit_logs a JOIN users u ON u.id=a.user_id WHERE a.session_id=? ORDER BY a.timestamp DESC LIMIT 500').all(sessionId).map(r=>({...r,metadata:JSON.parse(r.metadata)}));
  }
  settings(session) { return {weights:session.weights,mode:'SIMULATED INVESTIGATION DATA',session:{id:session.id,user:session.display_name,expiresAt:session.expires_at}}; }
  updateSettings(session,weights) {
    this.db.prepare('UPDATE sessions SET weights=? WHERE id=?').run(JSON.stringify(weights),session.id);
    this.audit(session.id,'Attribution Weights Updated','settings',{weights});
    return this.settings({...session,weights});
  }
  insertCase(sessionId,record) {
    this.db.prepare('INSERT INTO cases VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?)').run(caseKey(sessionId,record.id),sessionId,record.id,record.complaintId,record.fraudType,record.chain,record.status,record.riskScore,record.victimLoss,record.reportedWallet,record.createdAt,record.updatedAt,JSON.stringify(record));
    return record;
  }
  // A fixed prepared statement keeps case IDs, wallet addresses and search strings out of SQL syntax.
  getCase(sessionId,id) { return parse(this.db.prepare('SELECT payload FROM cases WHERE session_id=? AND id=?').get(sessionId,id)); }
  listCases(sessionId) { return this.db.prepare('SELECT payload FROM cases WHERE session_id=? ORDER BY updated_at DESC,id').all(sessionId).map(parse); }
  updateCase(sessionId,record) {
    this.db.prepare('UPDATE cases SET status=?,risk_score=?,updated_at=?,payload=? WHERE session_id=? AND id=?').run(record.status,record.riskScore,record.updatedAt,JSON.stringify(record),sessionId,record.id);
    return record;
  }
  setStatus(sessionId,id,status) {
    const record = this.getCase(sessionId,id);
    if (!record) return null;
    this.updateCase(sessionId,{...record,status,updatedAt:now()});
    this.addEvent(sessionId,id,'Case Status Changed',`Case marked ${status}.`);
    this.audit(sessionId,'Case Status Updated',id,{status});
    return this.getCase(sessionId,id);
  }
  addEvent(sessionId,id,action,description,evidenceIds=[]) {
    const event={id:randomUUID(),timestamp:now(),action,description,evidenceIds};
    this.db.prepare('INSERT INTO investigation_events VALUES(?,?,?,?,?,?)').run(`${caseKey(sessionId,id)}/${event.id}`,caseKey(sessionId,id),event.id,event.timestamp,event.action,JSON.stringify(event));
    return event;
  }
  trace(sessionId,id,weights=DEFAULT_WEIGHTS,options={}) {
    const record=this.getCase(sessionId,id);
    if(!record) return null;
    const prior = options.seed ? null : this.getInvestigation(sessionId,id);
    const dataset = options.dataset || (prior?.edges.length ? {nodes:prior.nodes,edges:prior.edges,crossChain:prior.crossChain,timeline:prior.timeline} : blockchain.trace(record));
    const result = analyzeDataset(record,dataset,weights);
    const updated={...record,status:options.status || (result.attributions.length ? 'Action Required' : 'Investigating'),riskScore:result.riskScore,tracedAmount:result.tracedAmount,confidence:result.confidence,vaspCandidate:result.vaspCandidate || 'Unknown',transactionCount:dataset.edges.length,walletCount:dataset.nodes.length,chains:[...new Set(dataset.nodes.map(n=>n.chain))],updatedAt:options.seed ? record.updatedAt : now()};
    const key=caseKey(sessionId,id);
    this.db.exec('BEGIN IMMEDIATE');
    try {
      // Preserve the history while rebuilding graph-derived evidence.
      for(const table of ['transactions','wallets','wallet_clusters','attributions','evidence','fraud_patterns','cross_chain_transfers','analyses']) this.db.prepare(`DELETE FROM ${table} WHERE case_key=?`).run(key);
      this.updateCase(sessionId,updated);
      const clusterIds=[...new Set(dataset.nodes.map(n=>n.cluster).filter(Boolean))];
      for(const cluster of clusterIds) this.db.prepare('INSERT INTO wallet_clusters VALUES(?,?,?,?,?)').run(`${key}/${cluster}`,key,cluster,dataset.nodes.find(n=>n.cluster===cluster)?.entity || '',JSON.stringify({id:cluster,walletIds:dataset.nodes.filter(n=>n.cluster===cluster).map(n=>n.id)}));
      for(const node of dataset.nodes) this.db.prepare('INSERT INTO wallets VALUES(?,?,?,?,?,?,?,?,?)').run(`${key}/${node.id}`,key,node.id,node.address,node.chain,node.type,node.riskScore,node.cluster || null,JSON.stringify(node));
      for(const edge of dataset.edges) this.db.prepare('INSERT INTO transactions VALUES(?,?,?,?,?,?,?,?,?,?)').run(`${key}/${edge.id}`,key,edge.id,`${key}/${edge.source}`,`${key}/${edge.target}`,edge.hash,edge.chain,edge.amount,edge.timestamp,JSON.stringify(edge));
      const evidenceMap=new Map();
      for(const attribution of result.attributions) {
        this.db.prepare('INSERT INTO attributions VALUES(?,?,?,?,?,?,?)').run(`${key}/${attribution.id}`,key,attribution.id,attribution.candidate,attribution.confidence,attribution.tracedAmount,JSON.stringify(attribution));
        for(const evidence of attribution.evidence) evidenceMap.set(evidence.id,{...evidence,kind:'attribution'});
      }
      for(const evidence of result.riskIndicators) evidenceMap.set(evidence.id,{...evidence,kind:'risk'});
      for(const evidence of evidenceMap.values()) this.db.prepare('INSERT INTO evidence VALUES(?,?,?,?,?,?)').run(`${key}/${evidence.id}`,key,evidence.id,evidence.title,evidence.kind,JSON.stringify(evidence));
      for(const pattern of result.fingerprint.patterns) this.db.prepare('INSERT INTO fraud_patterns VALUES(?,?,?,?,?)').run(`${key}/${pattern.name}`,key,pattern.name,pattern.score,JSON.stringify(pattern));
      for(const transfer of dataset.crossChain) this.db.prepare('INSERT INTO cross_chain_transfers VALUES(?,?,?,?,?,?,?,?)').run(`${key}/${transfer.id}`,key,transfer.id,transfer.sourceChain,transfer.destinationChain,transfer.amount,transfer.timestamp,JSON.stringify(transfer));
      this.db.prepare('INSERT INTO analyses VALUES(?,?,?)').run(key,JSON.stringify({fingerprint:result.fingerprint,recommendations:result.recommendations,riskIndicators:result.riskIndicators,knowledgeGraph:result.knowledgeGraph}),now());
      for(const event of dataset.timeline.filter(e=>!e.action.toLowerCase().includes('report generated'))) this.db.prepare('INSERT OR IGNORE INTO investigation_events VALUES(?,?,?,?,?,?)').run(`${key}/${event.id}`,key,event.id,event.timestamp,event.action,JSON.stringify(event));
      if(!options.seed) this.addEvent(sessionId,id,'Wallet Traced',`${dataset.edges.length} synthetic transactions analyzed across ${updated.chains.length} chains.`,dataset.edges.slice(0,3).map(e=>e.id));
      this.generateAlerts(sessionId,updated,dataset,result);
      this.db.exec('COMMIT');
    } catch(error) { this.db.exec('ROLLBACK'); throw error; }
    if(!options.seed) {
      this.refreshRelationships(sessionId);
      this.audit(sessionId,'Wallet Traced',id,{transactions:dataset.edges.length,mode:'demo'});
      this.audit(sessionId,'Attribution Generated',id,{candidate:result.vaspCandidate,confidence:result.confidence,weights});
    }
    return this.getInvestigation(sessionId,id);
  }
  getInvestigation(sessionId,id) {
    const record=this.getCase(sessionId,id);
    if(!record) return null;
    const key=caseKey(sessionId,id);
    const analysis=parse(this.db.prepare('SELECT payload FROM analyses WHERE case_key=?').get(key)) || {fingerprint:{features:{},patterns:[]},riskIndicators:[],recommendations:['Start a trace to generate a synthetic investigation.'],knowledgeGraph:{nodes:[],edges:[]}};
    const byCase=table=>this.db.prepare(`SELECT payload FROM ${table} WHERE case_key=?`).all(key).map(parse);
    return {case:record,nodes:byCase('wallets'),edges:byCase('transactions'),attributions:byCase('attributions').sort((a,b)=>b.confidence-a.confidence),...analysis,relatedCases:byCase('case_relationships'),crossChain:byCase('cross_chain_transfers'),timeline:byCase('investigation_events').sort((a,b)=>a.timestamp.localeCompare(b.timestamp))};
  }
  refreshRelationships(sessionId) {
    const all=this.listCases(sessionId).map(c=>this.getInvestigation(sessionId,c.id));
    for(const item of all) {
      const key=caseKey(sessionId,item.case.id);
      this.db.prepare('DELETE FROM case_relationships WHERE case_key=?').run(key);
      const relations=correlateCases(item.case,all);
      for(const relation of relations) {
        this.db.prepare('INSERT INTO case_relationships VALUES(?,?,?,?,?)').run(`${key}/${relation.caseId}`,key,caseKey(sessionId,relation.caseId),relation.confidence,JSON.stringify(relation));
      }
      if(relations.length) {
        const id=`AL-${item.case.id}-complaint-correlation`;
        const alert={id,severity:'High',type:'Multiple complaint correlation',caseId:item.case.id,wallet:item.case.reportedWallet,amount:item.case.victimLoss,timestamp:item.case.updatedAt,status:'Open',description:`${relations.length} related complaints share synthetic wallet or cluster evidence. Independent corroboration required.`,source:'demo'};
        this.db.prepare('INSERT OR IGNORE INTO alerts VALUES(?,?,?,?,?,?,?,?,?)').run(`${sessionId}/${id}`,sessionId,key,id,alert.severity,alert.type,alert.status,alert.timestamp,JSON.stringify(alert));
        const event={id:'EVENT-RELATED',timestamp:item.case.updatedAt,action:'Related cases discovered',description:`${relations.length} complaints linked through a shared wallet or synthetic cluster.`,evidenceIds:relations.map(r=>r.caseId)};
        this.db.prepare('INSERT OR IGNORE INTO investigation_events VALUES(?,?,?,?,?,?)').run(`${key}/${event.id}`,key,event.id,event.timestamp,event.action,JSON.stringify(event));
      }
    }
  }
  generateAlerts(sessionId,record,dataset,result) {
    const definitions=[];
    if(result.riskScore>=70) definitions.push(['High-risk wallet','High',`Risk score ${result.riskScore}; review the linked behavioral indicators.`]);
    if(record.victimLoss>=500000) definitions.push(['Large movement','Medium','Synthetic case contains a reported loss of INR 500,000 or more.']);
    if(dataset.crossChain.length) definitions.push(['Cross-chain transfer','High',`${dataset.crossChain.length} synthetic bridge movements require downstream review.`]);
    if(result.attributions.length) definitions.push(['New VASP interaction','Medium',`Evidence supports a candidate association with ${result.vaspCandidate}; not a verified identity.`]);
    if(dataset.nodes.some(n=>n.type==='mixer')) definitions.push(['Mixer exposure','High','Privacy-enhancing service exposure detected. Tracing confidence is reduced; no deanonymization is claimed.']);
    if((result.fingerprint.features.averageHoldingTime ?? Infinity)<10) definitions.push(['Rapid fund movement','High','Mean intermediary holding time is below ten minutes in the bounded synthetic observation.']);
    if((result.fingerprint.features.transactionVelocity || 0)>10) definitions.push(['High-velocity forwarding','Medium','Rapid synthetic transfers detected; inspect timestamps before drawing a conclusion.']);
    if(dataset.nodes.some(n=>n.behavior?.some(b=>/consolidat/i.test(b)))) definitions.push(['Sudden consolidation','Medium','Multiple inputs converge in a consolidation node.']);
    for(const [type,severity,description] of definitions) {
      const id=`AL-${record.id}-${type.toLowerCase().replace(/[^a-z]+/g,'-')}`;
      const old=this.db.prepare('SELECT payload FROM alerts WHERE session_id=? AND id=?').get(sessionId,id);
      if(old) continue;
      const alert={id,severity,type,caseId:record.id,wallet:record.reportedWallet,amount:record.tracedAmount || record.victimLoss,timestamp:record.updatedAt,status:'Open',description,source:'demo'};
      this.db.prepare('INSERT INTO alerts VALUES(?,?,?,?,?,?,?,?,?)').run(`${sessionId}/${id}`,sessionId,caseKey(sessionId,record.id),id,severity,type,'Open',alert.timestamp,JSON.stringify(alert));
    }
  }
  alerts(sessionId) { return this.db.prepare('SELECT payload FROM alerts WHERE session_id=? ORDER BY timestamp DESC').all(sessionId).map(parse); }
  updateAlert(sessionId,id,status) {
    const alert=parse(this.db.prepare('SELECT payload FROM alerts WHERE session_id=? AND id=?').get(sessionId,id));
    if(!alert) return null;
    const updated={...alert,status};
    this.db.prepare('UPDATE alerts SET status=?,payload=? WHERE session_id=? AND id=?').run(status,JSON.stringify(updated),sessionId,id);
    this.audit(sessionId,`Alert ${status}`,id,{caseId:alert.caseId});
    this.addEvent(sessionId,alert.caseId,`Alert ${status}`,`${alert.type} alert marked ${status.toLowerCase()}.`);
    return updated;
  }
  evidence(sessionId,caseId,id) { return parse(this.db.prepare('SELECT payload FROM evidence WHERE case_key=? AND id=?').get(caseKey(sessionId,caseId),id)); }
  reports(sessionId) { return this.db.prepare('SELECT id,case_id caseId,created_at createdAt,version,filename,sha256 FROM reports WHERE session_id=? ORDER BY created_at DESC').all(sessionId); }
  saveReport(sessionId,caseId,buffer) {
    const id=randomUUID(), createdAt=now();
    const version=this.db.prepare('SELECT COUNT(*) count FROM reports WHERE session_id=? AND case_id=?').get(sessionId,caseId).count+1;
    const filename=`${caseId}-investigation-v${version}.pdf`, sha256=hash(buffer);
    this.db.prepare('INSERT INTO reports VALUES(?,?,?,?,?,?,?,?,?)').run(id,sessionId,caseKey(sessionId,caseId),caseId,createdAt,version,filename,sha256,buffer);
    this.audit(sessionId,'Report Generated',id,{caseId,sha256,version});
    this.addEvent(sessionId,caseId,'Investigation Report Generated',`Report version ${version} generated. SHA-256: ${sha256.slice(0,16)}...`);
    return {id,caseId,createdAt,version,filename,sha256,url:`/api/reports/${id}`};
  }
  report(sessionId,id) { return this.db.prepare('SELECT * FROM reports WHERE session_id=? AND id=?').get(sessionId,id); }
}
