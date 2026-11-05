import { DatabaseSync } from 'node:sqlite';
import { createHash, randomBytes, randomUUID } from 'node:crypto';
import { dirname, resolve } from 'node:path';
import { mkdirSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { DEFAULT_WEIGHTS, DEFAULT_RISK_CRITERIA, analyzeDataset, correlateCases, computeInvestigationReadiness } from './analytics.mjs';
import { DemoBlockchainAdapter } from './adapters.mjs';
const blockchain = new DemoBlockchainAdapter();

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const parse = (row) => row ? JSON.parse(row.payload) : null;
export const now = () => new Date().toISOString();
export const caseKey = (sessionId, id) => `${sessionId}/${id}`;
const hash = value => createHash('sha256').update(value).digest('hex');
const evm = label => `0x${hash(label).slice(0,40)}`;

export const VALID_STATUSES = Object.freeze([
  'Submitted',
  'Pending Review',
  'Accepted',
  'Under Investigation',
  'Evidence Requested',
  'Evidence Received',
  'Resolved',
  'Closed',
  'Rejected'
]);

export const ALLOWED_TRANSITIONS = Object.freeze({
  'Submitted': ['Pending Review', 'Accepted', 'Rejected'],
  'Pending Review': ['Accepted', 'Rejected', 'Evidence Requested', 'Under Investigation'],
  'Accepted': ['Under Investigation', 'Evidence Requested', 'Rejected'],
  'Under Investigation': ['Evidence Requested', 'Resolved', 'Closed', 'Rejected'],
  'Evidence Requested': ['Evidence Received', 'Under Investigation', 'Closed', 'Rejected'],
  'Evidence Received': ['Under Investigation', 'Evidence Requested', 'Resolved', 'Rejected'],
  'Resolved': ['Closed', 'Under Investigation'],
  'Closed': ['Under Investigation'],
  'Rejected': ['Under Investigation', 'Pending Review']
});

export function canTransitionStatus(fromStatus, toStatus) {
  if (!fromStatus || fromStatus === toStatus) return true;
  const allowed = ALLOWED_TRANSITIONS[fromStatus];
  return Array.isArray(allowed) && allowed.includes(toStatus);
}

export const hashPassword = (password, salt = 'ct-salt-2026') =>
  createHash('sha256').update(`${salt}:${password}`).digest('hex');
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
    if (!this.db.prepare('SELECT version FROM schema_migrations WHERE version=2').get()) {
      this.db.exec('BEGIN IMMEDIATE');
      try {
        this.db.exec(`
          CREATE TABLE IF NOT EXISTS dataset_metadata (
            id TEXT PRIMARY KEY, name TEXT NOT NULL, version TEXT NOT NULL,
            total_nodes INTEGER NOT NULL, total_edges INTEGER NOT NULL,
            illicit_count INTEGER NOT NULL, licit_count INTEGER NOT NULL, unknown_count INTEGER NOT NULL,
            payload TEXT NOT NULL, ingested_at TEXT NOT NULL
          );
          CREATE TABLE IF NOT EXISTS model_evaluations (
            id TEXT PRIMARY KEY, model_name TEXT NOT NULL,
            precision REAL NOT NULL, recall REAL NOT NULL, f1 REAL NOT NULL,
            roc_auc REAL NOT NULL, pr_auc REAL NOT NULL, payload TEXT NOT NULL, evaluated_at TEXT NOT NULL
          );
          CREATE TABLE IF NOT EXISTS transaction_investigations (
            id TEXT PRIMARY KEY, session_id TEXT REFERENCES sessions(id) ON DELETE CASCADE,
            tx_id TEXT NOT NULL, risk_score REAL NOT NULL, risk_category TEXT NOT NULL,
            known_label TEXT, model_prediction TEXT, payload TEXT NOT NULL, created_at TEXT NOT NULL
          );
          CREATE INDEX IF NOT EXISTS tx_inv_txid ON transaction_investigations(tx_id);
          CREATE INDEX IF NOT EXISTS tx_inv_session ON transaction_investigations(session_id, created_at);
        `);
        this.db.prepare('INSERT INTO schema_migrations VALUES(2,?)').run(now());
        this.db.exec('COMMIT');
      } catch(error) { this.db.exec('ROLLBACK'); throw error; }
    }
    if (!this.db.prepare('SELECT version FROM schema_migrations WHERE version=3').get()) {
      this.db.exec('BEGIN IMMEDIATE');
      try {
        this.db.exec(`
          CREATE TABLE IF NOT EXISTS legal_requests (
            id TEXT PRIMARY KEY, session_id TEXT REFERENCES sessions(id) ON DELETE CASCADE,
            case_id TEXT NOT NULL, target_entity TEXT NOT NULL, legal_basis TEXT NOT NULL,
            amount REAL NOT NULL, payload TEXT NOT NULL, created_at TEXT NOT NULL
          );
          CREATE INDEX IF NOT EXISTS legal_req_session ON legal_requests(session_id, created_at);
        `);
        this.db.prepare('INSERT INTO schema_migrations VALUES(3,?)').run(now());
        this.db.exec('COMMIT');
      } catch(error) { this.db.exec('ROLLBACK'); throw error; }
    }
    if (!this.db.prepare('SELECT version FROM schema_migrations WHERE version=4').get()) {
      this.db.exec('BEGIN IMMEDIATE');
      try {
        this.db.exec(`
          CREATE TABLE IF NOT EXISTS system_users (
            id TEXT PRIMARY KEY,
            email TEXT NOT NULL UNIQUE,
            password_hash TEXT NOT NULL,
            display_name TEXT NOT NULL,
            role TEXT NOT NULL,
            phone TEXT,
            agency TEXT,
            badge_number TEXT,
            created_at TEXT NOT NULL
          );
          CREATE INDEX IF NOT EXISTS sys_users_email ON system_users(email);

          CREATE TABLE IF NOT EXISTS complaints (
            id TEXT PRIMARY KEY,
            case_id TEXT NOT NULL UNIQUE,
            reporter_id TEXT NOT NULL,
            reporter_name TEXT NOT NULL,
            reporter_email TEXT NOT NULL,
            incident_type TEXT NOT NULL,
            incident_date TEXT NOT NULL,
            description TEXT NOT NULL,
            reported_loss REAL NOT NULL DEFAULT 0,
            currency TEXT NOT NULL DEFAULT 'INR',
            chain TEXT NOT NULL DEFAULT 'Ethereum',
            reported_wallet TEXT NOT NULL,
            transaction_hash TEXT,
            status TEXT NOT NULL DEFAULT 'Submitted',
            assigned_officer_id TEXT,
            assigned_officer_name TEXT,
            rejection_reason TEXT,
            priority TEXT NOT NULL DEFAULT 'Medium',
            created_at TEXT NOT NULL,
            updated_at TEXT NOT NULL,
            payload TEXT NOT NULL
          );
          CREATE INDEX IF NOT EXISTS complaints_reporter ON complaints(reporter_id);
          CREATE INDEX IF NOT EXISTS complaints_status ON complaints(status);
          CREATE INDEX IF NOT EXISTS complaints_case_id ON complaints(case_id);

          CREATE TABLE IF NOT EXISTS case_evidence (
            id TEXT PRIMARY KEY,
            case_id TEXT NOT NULL,
            uploaded_by_id TEXT NOT NULL,
            uploaded_by_name TEXT NOT NULL,
            uploader_role TEXT NOT NULL,
            filename TEXT NOT NULL,
            file_type TEXT NOT NULL,
            file_size INTEGER NOT NULL,
            description TEXT,
            sha256 TEXT NOT NULL,
            created_at TEXT NOT NULL
          );
          CREATE INDEX IF NOT EXISTS case_evidence_case ON case_evidence(case_id);

          CREATE TABLE IF NOT EXISTS case_updates (
            id TEXT PRIMARY KEY,
            case_id TEXT NOT NULL,
            author_id TEXT NOT NULL,
            author_name TEXT NOT NULL,
            author_role TEXT NOT NULL,
            update_type TEXT NOT NULL,
            message TEXT NOT NULL,
            is_internal INTEGER NOT NULL DEFAULT 0,
            previous_status TEXT,
            new_status TEXT,
            created_at TEXT NOT NULL
          );
          CREATE INDEX IF NOT EXISTS case_updates_case ON case_updates(case_id, is_internal);

          CREATE TABLE IF NOT EXISTS officer_assignments (
            id TEXT PRIMARY KEY,
            case_id TEXT NOT NULL,
            officer_id TEXT NOT NULL,
            officer_name TEXT NOT NULL,
            assigned_by_id TEXT NOT NULL,
            assigned_by_name TEXT NOT NULL,
            notes TEXT,
            assigned_at TEXT NOT NULL
          );
          CREATE INDEX IF NOT EXISTS officer_assign_case ON officer_assignments(case_id);

          CREATE TABLE IF NOT EXISTS notifications (
            id TEXT PRIMARY KEY,
            user_id TEXT NOT NULL,
            case_id TEXT,
            type TEXT NOT NULL,
            title TEXT NOT NULL,
            message TEXT NOT NULL,
            is_read INTEGER NOT NULL DEFAULT 0,
            created_at TEXT NOT NULL
          );
          CREATE INDEX IF NOT EXISTS notifications_user ON notifications(user_id, is_read);
        `);
        this.db.prepare('INSERT INTO schema_migrations VALUES(4,?)').run(now());
        this.db.exec('COMMIT');
      } catch(error) { this.db.exec('ROLLBACK'); throw error; }
    }
    if (!this.db.prepare('SELECT version FROM schema_migrations WHERE version=5').get()) {
      this.db.exec('BEGIN IMMEDIATE');
      try {
        try { this.db.exec('ALTER TABLE complaints ADD COLUMN is_demo INTEGER NOT NULL DEFAULT 0;'); } catch {}
        try { this.db.exec('ALTER TABLE complaints ADD COLUMN incident_channel TEXT DEFAULT "Web";'); } catch {}
        this.db.exec(`
          CREATE TABLE IF NOT EXISTS evidence_requests (
            id TEXT PRIMARY KEY,
            case_id TEXT NOT NULL,
            officer_id TEXT NOT NULL,
            officer_name TEXT NOT NULL,
            request_description TEXT NOT NULL,
            status TEXT NOT NULL DEFAULT 'PENDING',
            created_at TEXT NOT NULL,
            responded_at TEXT
          );
          CREATE INDEX IF NOT EXISTS ev_req_case ON evidence_requests(case_id);

          CREATE TABLE IF NOT EXISTS case_sequences (
            year INTEGER PRIMARY KEY,
            last_seq INTEGER NOT NULL DEFAULT 0
          );
        `);
        this.db.prepare('INSERT INTO schema_migrations VALUES(5,?)').run(now());
        this.db.exec('COMMIT');
      } catch(error) { this.db.exec('ROLLBACK'); throw error; }
    }
    this.seedCaseManagement();
  }
  close() { try { this.db.close(); } catch {} }
  session(token) {
    if (!token) return null;
    const row = this.db.prepare('SELECT s.*, u.display_name, u.role, u.id AS user_id FROM sessions s JOIN users u ON u.id=s.user_id WHERE token_hash=? AND expires_at>?').get(hash(token),now());
    if (!row) return null;
    const sysUser = this.db.prepare('SELECT email, phone, agency, badge_number FROM system_users WHERE id=?').get(row.user_id);
    return {
      ...row,
      email: sysUser?.email || null,
      phone: sysUser?.phone || null,
      agency: sysUser?.agency || (row.role === 'officer' || row.role === 'official-investigator' ? 'CBI Cyber Division (Project Simulation)' : null),
      badge_number: sysUser?.badge_number || null,
      weights: JSON.parse(row.weights)
    };
  }
  createSession(displayName = 'Demo Investigator', role = 'demo-investigator', userId = null) {
    // Reclaim expired anonymous demo workspaces; never touch an active workspace.
    this.db.prepare('DELETE FROM users WHERE id IN (SELECT user_id FROM sessions WHERE expires_at<?)').run(now());
    const count = this.db.prepare('SELECT COUNT(*) count FROM sessions').get().count;
    if(count >= Number(process.env.MAX_DEMO_SESSIONS || 1000)) throw Object.assign(new Error('Demo capacity reached. Please try again later.'),{status:503});
    const id = randomUUID(), token = randomBytes(32).toString('hex'), createdAt=now();
    const expiresAt = new Date(Date.now()+Number(process.env.SESSION_TTL_HOURS || 168)*3600000).toISOString();
    const uid = userId || id;
    const existing = this.db.prepare('SELECT id FROM users WHERE id=?').get(uid);
    if (!existing) {
      this.db.prepare('INSERT INTO users VALUES(?,?,?,?)').run(uid, displayName, role, createdAt);
    }
    this.db.prepare('INSERT INTO sessions VALUES(?,?,?,?,?,?)').run(id, hash(token), uid, createdAt, expiresAt, JSON.stringify(DEFAULT_WEIGHTS));
    const session = this.session(token);
    if (role !== 'reporter') {
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
    }
    this.audit(id,role==='officer'||role==='official-investigator'?'CBI Officer Signed In':role==='reporter'?'Reporter Signed In':'Demo Session Created','workspace',{datasetVersion:'2026.09.24-v1'});
    return {token,session};
  }
  audit(sessionId,action,object,metadata={}) {
    const s = this.db.prepare('SELECT user_id FROM sessions WHERE id=?').get(sessionId);
    const userId = s?.user_id || sessionId;
    this.db.prepare('INSERT INTO audit_logs VALUES(?,?,?,?,?,?,?)').run(randomUUID(),sessionId,now(),userId,action,String(object),JSON.stringify(metadata));
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
    const result = analyzeDataset(record,dataset,weights,options.criteria);
    const updated={...record,status:options.status || (result.attributions.length ? 'Action Required' : 'Investigating'),riskScore:result.riskScore,tracedAmount:result.tracedAmount,confidence:result.confidence,vaspCandidate:result.vaspCandidate || 'Unknown',transactionCount:dataset.edges.length,walletCount:dataset.nodes.length,chains:[...new Set(dataset.nodes.map(n=>n.chain))],updatedAt:options.seed ? record.updatedAt : now(),readinessScore:result.readiness?.readinessScore || 0,readinessStatus:result.readiness?.readinessStatus || 'EVALUATION_PENDING'};
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
      this.db.prepare('INSERT INTO analyses VALUES(?,?,?)').run(key,JSON.stringify({fingerprint:result.fingerprint,recommendations:result.recommendations,riskIndicators:result.riskIndicators,knowledgeGraph:result.knowledgeGraph,readiness:result.readiness}),now());
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

  saveDatasetMetadata(meta) {
    const id = meta.id || 'elliptic-dataset-v1';
    const stamp = meta.ingestedAt || now();
    this.db.prepare(`
      INSERT OR REPLACE INTO dataset_metadata (id, name, version, total_nodes, total_edges, illicit_count, licit_count, unknown_count, payload, ingested_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      id,
      meta.name || 'Elliptic Bitcoin Transaction Dataset',
      meta.version || '1.0',
      meta.totalNodes || 0,
      meta.totalEdges || 0,
      meta.classes?.illicit || 0,
      meta.classes?.licit || 0,
      meta.classes?.unknown || 0,
      JSON.stringify(meta),
      stamp
    );
    return meta;
  }

  getDatasetMetadata(id = 'elliptic-dataset-v1') {
    const row = this.db.prepare('SELECT payload FROM dataset_metadata WHERE id=?').get(id);
    return row ? JSON.parse(row.payload) : null;
  }

  saveModelEvaluation(evalData) {
    const id = evalData.id || 'rf-time-aware-v1';
    const stamp = evalData.generated_at || now();
    const rf = evalData.models?.random_forest || {};
    this.db.prepare(`
      INSERT OR REPLACE INTO model_evaluations (id, model_name, precision, recall, f1, roc_auc, pr_auc, payload, evaluated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      id,
      rf.model || 'Random Forest',
      rf.precision || 0,
      rf.recall || 0,
      rf.f1 || 0,
      rf.roc_auc || 0,
      rf.pr_auc || 0,
      JSON.stringify(evalData),
      stamp
    );
    return evalData;
  }

  getModelEvaluation(id = 'rf-time-aware-v1') {
    const row = this.db.prepare('SELECT payload FROM model_evaluations WHERE id=?').get(id);
    return row ? JSON.parse(row.payload) : null;
  }

  saveTxInvestigation(sessionId, txId, report) {
    const id = randomUUID();
    const stamp = now();
    this.db.prepare(`
      INSERT INTO transaction_investigations (id, session_id, tx_id, risk_score, risk_category, known_label, model_prediction, payload, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      id,
      sessionId,
      String(txId),
      report.riskScore || 0,
      report.riskCategory || 'LOW RISK',
      report.knownLabel || 'unknown',
      report.modelPrediction || 'licit',
      JSON.stringify(report),
      stamp
    );
    return { id, txId, createdAt: stamp, ...report };
  }

  listTxInvestigations(sessionId, limit = 50) {
    return this.db.prepare('SELECT id, tx_id, risk_score, risk_category, known_label, model_prediction, payload, created_at FROM transaction_investigations WHERE session_id=? ORDER BY created_at DESC LIMIT ?')
      .all(sessionId, limit)
      .map(row => ({
        id: row.id,
        txId: row.tx_id,
        riskScore: row.risk_score,
        riskCategory: row.risk_category,
        knownLabel: row.known_label,
        modelPrediction: row.model_prediction,
        createdAt: row.created_at,
        report: JSON.parse(row.payload)
      }));
  }

  saveRequest(sessionId, caseId, pkg) {
    const id = pkg.noticeReference || randomUUID();
    const stamp = pkg.preparedAt || now();
    this.db.prepare(`
      INSERT OR REPLACE INTO legal_requests (id, session_id, case_id, target_entity, legal_basis, amount, payload, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(id, sessionId, caseId, pkg.targetEntity || pkg.targetVasp || '', pkg.legalBasis || '', pkg.amountINR || 0, JSON.stringify(pkg), stamp);
    return pkg;
  }

  listRequests(sessionId) {
    return this.db.prepare('SELECT payload FROM legal_requests WHERE session_id=? ORDER BY created_at DESC').all(sessionId).map(parse);
  }

  getRequest(sessionId, id) {
    const row = this.db.prepare('SELECT payload FROM legal_requests WHERE session_id=? AND (id=? OR case_id=?)').get(sessionId, id, id);
    return row ? JSON.parse(row.payload) : null;
  }

  calculateRiskAndReadiness(sessionId, caseId, customCriteria = {}) {
    const record = this.getCase(sessionId, caseId);
    if (!record) return null;
    const inv = this.getInvestigation(sessionId, caseId);
    if (!inv) return null;
    const dataset = { nodes: inv.nodes, edges: inv.edges, crossChain: inv.crossChain, timeline: inv.timeline };
    const sessionWeights = this.session(sessionId)?.weights || DEFAULT_WEIGHTS;
    const result = analyzeDataset(record, dataset, sessionWeights, customCriteria);
    const audits = this.audits(sessionId).filter(a => a.object === caseId || a.object.startsWith(caseId + '/'));
    const readiness = computeInvestigationReadiness(record, dataset, audits, customCriteria);

    const updated = {
      ...record,
      riskScore: result.riskScore,
      confidence: result.confidence,
      tracedAmount: result.tracedAmount,
      vaspCandidate: result.vaspCandidate || record.vaspCandidate,
      readinessScore: readiness.readinessScore,
      readinessStatus: readiness.readinessStatus,
      updatedAt: now()
    };
    this.updateCase(sessionId, updated);
    const key = caseKey(sessionId, caseId);
    this.db.prepare('UPDATE analyses SET payload=?, analyzed_at=? WHERE case_key=?').run(
      JSON.stringify({
        fingerprint: result.fingerprint,
        recommendations: result.recommendations,
        riskIndicators: result.riskIndicators,
        knowledgeGraph: result.knowledgeGraph,
        readiness
      }),
      now(),
      key
    );
    this.audit(sessionId, 'Officer Risk & Readiness Calculated', caseId, {
      riskScore: result.riskScore,
      readinessScore: readiness.readinessScore,
      status: readiness.readinessStatus
    });
    this.addEvent(sessionId, caseId, 'Risk & Readiness Evaluated', `Officer calculated risk score: ${result.riskScore}/100, readiness: ${readiness.readinessScore}/100 (${readiness.readinessStatus}).`);

    return {
      caseId,
      riskScore: result.riskScore,
      riskLevel: result.riskScore >= 70 ? 'HIGH' : result.riskScore >= 40 ? 'MEDIUM' : 'LOW',
      confidence: result.confidence,
      readinessScore: readiness.readinessScore,
      readinessStatus: readiness.readinessStatus,
      statutorySummary: readiness.statutorySummary,
      parameters: readiness.parameters,
      criteriaApplied: { ...DEFAULT_RISK_CRITERIA, ...customCriteria },
      riskIndicators: result.riskIndicators,
      recommendations: result.recommendations,
      evaluatedAt: readiness.evaluatedAt
    };
  }

  seedCaseManagement() {
    try {
      const hasUsers = this.db.prepare('SELECT COUNT(*) count FROM system_users').get().count;
      if (hasUsers === 0) {
        const officerId = 'USR-OFFICER-001';
        const reporterId = 'USR-REPORTER-001';
        const reporter2Id = 'USR-REPORTER-002';
        const stamp = now();

        this.db.prepare(`
          INSERT INTO system_users VALUES(?,?,?,?,?,?,?,?,?)
        `).run(
          officerId,
          'officer.sharma@cbi.gov.in',
          hashPassword('Admin@2026'),
          'Insp. Rajesh Sharma (CBI Officer)',
          'officer',
          '+91 98101 23456',
          'CBI Cyber Crime Division (Project Simulation)',
          'CBI-CYBER-8842',
          stamp
        );

        this.db.prepare(`
          INSERT INTO system_users VALUES(?,?,?,?,?,?,?,?,?)
        `).run(
          reporterId,
          'priya.nair@example.in',
          hashPassword('Reporter@2026'),
          'Priya Nair',
          'reporter',
          '+91 98200 11223',
          null,
          null,
          stamp
        );

        this.db.prepare(`
          INSERT INTO system_users VALUES(?,?,?,?,?,?,?,?,?)
        `).run(
          reporter2Id,
          'amit.verma@example.in',
          hashPassword('Reporter@2026'),
          'Amit Verma',
          'reporter',
          '+91 98300 44556',
          null,
          null,
          stamp
        );

        const seedComplaints = [
          {
            caseId: 'CR-2026-90412',
            reporterId: reporterId,
            reporterName: 'Priya Nair',
            reporterEmail: 'priya.nair@example.in',
            incidentType: 'Investment Scam',
            incidentDate: '2026-10-18T11:30:00.000Z',
            description: 'Victim was approached on Telegram offering 200% returns on crypto arbitrage staking. Sent 4.5 lakh INR in Ethereum to suspect wallet.',
            reportedLoss: 450000,
            currency: 'INR',
            chain: 'Ethereum',
            reportedWallet: '0x71C67Ed30791Fc5E04505299F39B755b4237E935',
            transactionHash: '0x8f4d2e1b3a5c7908f1e2d3c4b5a6978102938475610293847561029384756102',
            status: 'Submitted',
            priority: 'High'
          },
          {
            caseId: 'CR-2026-88124',
            reporterId: reporter2Id,
            reporterName: 'Amit Verma',
            reporterEmail: 'amit.verma@example.in',
            incidentType: 'Job & Task Scam',
            incidentDate: '2026-10-20T14:15:00.000Z',
            description: 'Victim offered YouTube video rating job. Required to deposit USDT (TRC-20) onto fraudulent platform to unlock earned commission payouts.',
            reportedLoss: 180000,
            currency: 'INR',
            chain: 'TRON',
            reportedWallet: 'TNPeeaaTKFZLLqZf48jZZBxfkKxGfTQ9PZ',
            transactionHash: '4a5b6c7d8e9f0123456789abcdef0123456789abcdef0123456789abcdef0123',
            status: 'Pending Review',
            priority: 'Medium'
          },
          {
            caseId: 'CR-2026-72301',
            reporterId: reporterId,
            reporterName: 'Priya Nair',
            reporterEmail: 'priya.nair@example.in',
            incidentType: 'Ransomware Extortion',
            incidentDate: '2026-10-12T09:00:00.000Z',
            description: 'Corporate server encrypted with LockBit variant. Demand note demanded 0.35 BTC payment to specified Bitcoin address.',
            reportedLoss: 975000,
            currency: 'INR',
            chain: 'Bitcoin',
            reportedWallet: '1A1zP1eP5QGefi2DMPTfTL5SLmv7DivfNa',
            transactionHash: '232629023',
            status: 'Under Investigation',
            priority: 'High',
            assignedOfficerId: officerId,
            assignedOfficerName: 'Insp. Rajesh Sharma (CBI Officer)'
          }
        ];

        for (const comp of seedComplaints) {
          const id = randomUUID();
          const payload = JSON.stringify(comp);
          this.db.prepare(`
            INSERT INTO complaints (id, case_id, reporter_id, reporter_name, reporter_email, incident_type, incident_date, description, reported_loss, currency, chain, reported_wallet, transaction_hash, status, assigned_officer_id, assigned_officer_name, priority, created_at, updated_at, payload)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          `).run(
            id, comp.caseId, comp.reporterId, comp.reporterName, comp.reporterEmail, comp.incidentType, comp.incidentDate, comp.description,
            comp.reportedLoss, comp.currency, comp.chain, comp.reportedWallet, comp.transactionHash || '', comp.status,
            comp.assignedOfficerId || null, comp.assignedOfficerName || null, comp.priority, stamp, stamp, payload
          );

          this.db.prepare(`
            INSERT INTO case_updates (id, case_id, author_id, author_name, author_role, update_type, message, is_internal, new_status, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          `).run(
            randomUUID(), comp.caseId, comp.reporterId, comp.reporterName, 'reporter', 'STATUS_CHANGE',
            `Complaint formally submitted by ${comp.reporterName}. Initial filing registered.`, 0, comp.status, stamp
          );

          this.db.prepare(`
            INSERT INTO case_evidence (id, case_id, uploaded_by_id, uploaded_by_name, uploader_role, filename, file_type, file_size, description, sha256, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          `).run(
            randomUUID(), comp.caseId, comp.reporterId, comp.reporterName, 'reporter',
            'chat_screenshot_telegram.png', 'image/png', 245120, 'Screenshots of scammer Telegram communication',
            hash(comp.caseId + 'evidence-1'), stamp
          );

          this.db.prepare(`
            INSERT INTO notifications (id, user_id, case_id, type, title, message, is_read, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
          `).run(
            randomUUID(), comp.reporterId, comp.caseId, 'CASE_FILED', 'Complaint Filed',
            `Your cybercrime complaint for ${comp.incidentType} has been assigned Case ID ${comp.caseId}.`, 0, stamp
          );

          this.db.prepare(`
            INSERT INTO notifications (id, user_id, case_id, type, title, message, is_read, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
          `).run(
            randomUUID(), officerId, comp.caseId, 'NEW_COMPLAINT', 'New Incoming Complaint',
            `New complaint ${comp.caseId} (${comp.incidentType}) filed by ${comp.reporterName} awaiting review.`, 0, stamp
          );
        }
      }
    } catch (e) {
      console.error('seedCaseManagement failed:', e.message);
    }
  }

  generateCaseId() {
    const year = new Date().getFullYear();
    const prefix = `CR-${year}-`;
    try {
      this.db.prepare('INSERT OR IGNORE INTO case_sequences (year, last_seq) VALUES (?, 0)').run(year);
      const row = this.db.prepare(`
        SELECT MAX(CAST(SUBSTR(case_id, 9) AS INTEGER)) as max_seq 
        FROM complaints 
        WHERE case_id LIKE ?
      `).get(`${prefix}%`);
      const seqRow = this.db.prepare('SELECT last_seq FROM case_sequences WHERE year=?').get(year);
      const currentMax = Math.max(row?.max_seq || 0, seqRow?.last_seq || 0);
      const nextSeq = currentMax + 1;
      this.db.prepare('UPDATE case_sequences SET last_seq=? WHERE year=?').run(nextSeq, year);
      return `${prefix}${String(nextSeq).padStart(5, '0')}`;
    } catch {
      return `${prefix}${String(Math.floor(10000 + Math.random() * 90000))}`;
    }
  }

  resetDemoData() {
    const demoComplaints = this.db.prepare('SELECT case_id FROM complaints WHERE is_demo=1').all();
    const caseIds = demoComplaints.map(c => c.case_id);
    if (caseIds.length === 0) return { purgedCount: 0, caseIds: [] };

    this.db.exec('BEGIN IMMEDIATE');
    try {
      for (const cid of caseIds) {
        this.db.prepare('DELETE FROM case_evidence WHERE case_id=?').run(cid);
        this.db.prepare('DELETE FROM case_updates WHERE case_id=?').run(cid);
        this.db.prepare('DELETE FROM notifications WHERE case_id=?').run(cid);
        this.db.prepare('DELETE FROM officer_assignments WHERE case_id=?').run(cid);
        try { this.db.prepare('DELETE FROM evidence_requests WHERE case_id=?').run(cid); } catch {}
        this.db.prepare('DELETE FROM complaints WHERE case_id=?').run(cid);
      }
      this.db.exec('COMMIT');
      return { purgedCount: caseIds.length, caseIds };
    } catch (e) {
      this.db.exec('ROLLBACK');
      throw e;
    }
  }

  registerUser({ email, password, name, role = 'reporter', phone = '', agency = '', badgeNumber = '' }) {
    const cleanEmail = String(email || '').trim().toLowerCase();
    if (!cleanEmail || !cleanEmail.includes('@')) throw Object.assign(new Error('Valid email address is required.'), { status: 400 });
    if (!password || String(password).length < 4) throw Object.assign(new Error('Password must be at least 4 characters.'), { status: 400 });
    const displayName = String(name || '').trim() || cleanEmail.split('@')[0];
    const userRole = role === 'officer' || role === 'cbi-officer' ? 'officer' : 'reporter';

    const existing = this.db.prepare('SELECT id FROM system_users WHERE email=?').get(cleanEmail);
    if (existing) throw Object.assign(new Error('An account with this email address already exists.'), { status: 409 });

    const id = randomUUID();
    const stamp = now();
    const pwdHash = hashPassword(password);

    this.db.prepare(`
      INSERT INTO system_users (id, email, password_hash, display_name, role, phone, agency, badge_number, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(id, cleanEmail, pwdHash, displayName, userRole, phone || null, agency || (userRole === 'officer' ? 'CBI Cyber Crime Division (Project Simulation)' : null), badgeNumber || null, stamp);

    // Also insert into base users table
    this.db.prepare('INSERT OR REPLACE INTO users (id, display_name, role, created_at) VALUES (?, ?, ?, ?)').run(id, displayName, userRole, stamp);

    return { id, email: cleanEmail, name: displayName, role: userRole, phone, agency, badgeNumber, createdAt: stamp };
  }

  authenticateUser(email, password) {
    const cleanEmail = String(email || '').trim().toLowerCase();
    const user = this.db.prepare('SELECT * FROM system_users WHERE email=?').get(cleanEmail);
    if (!user) {
      // Automatic fallback for default officer login
      if (cleanEmail === 'investigator@cryptotrace.gov.in' && password === 'Admin@2026') {
        const id = 'USR-OFFICER-001';
        return { id, email: cleanEmail, name: 'Investigator (CBI Officer)', role: 'officer' };
      }
      return null;
    }
    const pwdHash = hashPassword(password);
    if (user.password_hash !== pwdHash) return null;
    return {
      id: user.id,
      email: user.email,
      name: user.display_name,
      role: user.role,
      phone: user.phone,
      agency: user.agency,
      badgeNumber: user.badge_number
    };
  }

  getUser(id) {
    const row = this.db.prepare('SELECT id, email, display_name as name, role, phone, agency, badge_number as badgeNumber, created_at as createdAt FROM system_users WHERE id=?').get(id);
    return row || null;
  }

  getUserByEmail(email) {
    const cleanEmail = String(email || '').trim().toLowerCase();
    const row = this.db.prepare('SELECT id, email, display_name as name, role, phone, agency, badge_number as badgeNumber, created_at as createdAt FROM system_users WHERE email=?').get(cleanEmail);
    return row || null;
  }

  listOfficers() {
    return this.db.prepare("SELECT id, email, display_name as name, role, agency, badge_number as badgeNumber FROM system_users WHERE role='officer'").all();
  }

  createComplaint(data) {
    const caseId = this.generateCaseId();
    const id = randomUUID();
    const stamp = now();
    const reporterId = data.reporterId || 'ANONYMOUS';
    const reporterName = data.reporterName || 'Reporter';
    const reporterEmail = data.reporterEmail || '';
    const incidentType = data.incidentType || 'Cryptocurrency Fraud';
    const incidentDate = data.incidentDate || stamp;
    const description = data.description || '';
    const reportedLoss = Number(data.reportedLoss || data.reportedAmount || data.victimLoss || 0);
    const currency = data.currency || 'INR';
    const chain = data.chain || data.blockchainNetwork || 'Ethereum';
    const reportedWallet = data.reportedWallet || data.suspectWallet || '';
    const transactionHash = data.transactionHash || '';
    const priority = data.priority || (reportedLoss >= 500000 ? 'High' : 'Medium');
    const isDemo = data.isDemo || data.is_demo ? 1 : 0;
    const incidentChannel = data.incidentChannel || data.incident_channel || 'Web';

    const complaintRecord = {
      id: caseId,
      uuid: id,
      caseId,
      reporterId,
      reporterName,
      reporterEmail,
      incidentType,
      incidentDate,
      incidentChannel,
      description,
      reportedLoss,
      reportedAmount: reportedLoss,
      currency,
      chain,
      blockchainNetwork: chain,
      reportedWallet,
      suspectWallet: reportedWallet,
      transactionHash,
      status: 'Submitted',
      assignedOfficerId: null,
      assignedOfficerName: null,
      rejectionReason: null,
      priority,
      isDemo: Boolean(isDemo),
      createdAt: stamp,
      updatedAt: stamp
    };

    this.db.prepare(`
      INSERT INTO complaints (id, case_id, reporter_id, reporter_name, reporter_email, incident_type, incident_date, description, reported_loss, currency, chain, reported_wallet, transaction_hash, status, assigned_officer_id, assigned_officer_name, priority, is_demo, incident_channel, created_at, updated_at, payload)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      id, caseId, reporterId, reporterName, reporterEmail, incidentType, incidentDate, description,
      reportedLoss, currency, chain, reportedWallet, transactionHash, 'Submitted', null, null, priority, isDemo, incidentChannel, stamp, stamp, JSON.stringify(complaintRecord)
    );

    // Initial timeline update
    this.db.prepare(`
      INSERT INTO case_updates (id, case_id, author_id, author_name, author_role, update_type, message, is_internal, new_status, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      randomUUID(), caseId, reporterId, reporterName, 'reporter', 'STATUS_CHANGE',
      `Complaint successfully submitted by ${reporterName}. Case ID ${caseId} assigned.`, 0, 'Submitted', stamp
    );

    // Save attachments as initial evidence if any
    if (Array.isArray(data.attachments) && data.attachments.length > 0) {
      for (const att of data.attachments) {
        this.addEvidence({
          caseId,
          uploadedById: reporterId,
          uploadedByName: reporterName,
          uploaderRole: 'reporter',
          filename: att.name || 'evidence_file',
          fileType: att.type || 'application/octet-stream',
          fileSize: att.size || 1024,
          description: att.description || 'Initial complaint attachment',
          sha256: att.sha256 || hash(caseId + att.name + stamp)
        });
      }
    }

    // Notify reporter
    this.createNotification({
      userId: reporterId,
      caseId,
      type: 'CASE_FILED',
      title: 'Complaint Registered',
      message: `Your complaint for ${incidentType} has been assigned Case ID ${caseId}. Status: Submitted.`
    });

    // Notify all CBI officers
    const officers = this.listOfficers();
    for (const off of officers) {
      this.createNotification({
        userId: off.id,
        caseId,
        type: 'NEW_COMPLAINT',
        title: 'New Incoming Complaint',
        message: `Case ${caseId} (${incidentType}, ₹${reportedLoss.toLocaleString('en-IN')}) filed by ${reporterName}.`
      });
    }

    return complaintRecord;
  }

  listComplaints({ reporterId = null, status = null, search = null, chain = null, priority = null, limit = 100 } = {}) {
    let sql = 'SELECT * FROM complaints WHERE 1=1';
    const params = [];

    if (reporterId) {
      sql += ' AND reporter_id=?';
      params.push(reporterId);
    }
    if (status) {
      sql += ' AND status=?';
      params.push(status);
    }
    if (chain) {
      sql += ' AND chain=?';
      params.push(chain);
    }
    if (priority) {
      sql += ' AND priority=?';
      params.push(priority);
    }
    if (search) {
      sql += ' AND (case_id LIKE ? OR reporter_name LIKE ? OR incident_type LIKE ? OR reported_wallet LIKE ? OR description LIKE ?)';
      const s = `%${search}%`;
      params.push(s, s, s, s, s);
    }

    sql += ' ORDER BY created_at DESC LIMIT ?';
    params.push(limit);

    const rows = this.db.prepare(sql).all(...params);
    return rows.map(r => ({
      id: r.case_id,
      uuid: r.id,
      caseId: r.case_id,
      reporterId: r.reporter_id,
      reporterName: r.reporter_name,
      reporterEmail: r.reporter_email,
      incidentType: r.incident_type,
      incidentDate: r.incident_date,
      description: r.description,
      reportedLoss: r.reported_loss,
      reportedAmount: r.reported_loss,
      currency: r.currency,
      chain: r.chain,
      blockchainNetwork: r.chain,
      reportedWallet: r.reported_wallet,
      suspectWallet: r.reported_wallet,
      transactionHash: r.transaction_hash,
      status: r.status,
      assignedOfficerId: r.assigned_officer_id,
      assignedOfficerName: r.assigned_officer_name,
      rejectionReason: r.rejection_reason,
      priority: r.priority,
      createdAt: r.created_at,
      updatedAt: r.updated_at
    }));
  }

  getComplaint(caseIdOrId, includeInternal = false) {
    const row = this.db.prepare('SELECT * FROM complaints WHERE case_id=? OR id=?').get(caseIdOrId, caseIdOrId);
    if (!row) return null;

    const caseId = row.case_id;
    const evidence = this.listEvidence(caseId);
    const updates = this.listCaseUpdates(caseId, includeInternal);

    return {
      id: row.case_id,
      uuid: row.id,
      caseId: row.case_id,
      reporterId: row.reporter_id,
      reporterName: row.reporter_name,
      reporterEmail: row.reporter_email,
      incidentType: row.incident_type,
      incidentDate: row.incident_date,
      description: row.description,
      reportedLoss: row.reported_loss,
      reportedAmount: row.reported_loss,
      currency: row.currency,
      chain: row.chain,
      blockchainNetwork: row.chain,
      reportedWallet: row.reported_wallet,
      suspectWallet: row.reported_wallet,
      transactionHash: row.transaction_hash,
      status: row.status,
      assignedOfficerId: row.assigned_officer_id,
      assignedOfficerName: row.assigned_officer_name,
      rejectionReason: row.rejection_reason,
      priority: row.priority,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      evidence,
      updates
    };
  }

  updateComplaintStatus({ caseId, newStatus, authorId, authorName, authorRole, reason = '' }) {
    const comp = this.db.prepare('SELECT * FROM complaints WHERE case_id=? OR id=?').get(caseId, caseId);
    if (!comp) throw Object.assign(new Error(`Complaint ${caseId} was not found.`), { status: 404 });

    const currentStatus = comp.status;
    if (!canTransitionStatus(currentStatus, newStatus)) {
      throw Object.assign(new Error(`Invalid status transition from '${currentStatus}' to '${newStatus}'.`), { status: 400 });
    }

    if (newStatus === 'Rejected' && !reason) {
      throw Object.assign(new Error('A formal rejection reason must be specified when rejecting a complaint.'), { status: 400 });
    }

    const stamp = now();
    const actualCaseId = comp.case_id;
    const rejectionReason = newStatus === 'Rejected' ? reason : comp.rejection_reason;

    this.db.prepare(`
      UPDATE complaints SET status=?, rejection_reason=?, updated_at=? WHERE case_id=?
    `).run(newStatus, rejectionReason, stamp, actualCaseId);

    // Record in case updates (publicly visible)
    const updateMsg = newStatus === 'Rejected'
      ? `Complaint rejected. Reason: ${reason}`
      : reason ? `Status updated to ${newStatus}. Note: ${reason}` : `Status transitioned from ${currentStatus} to ${newStatus}.`;

    this.db.prepare(`
      INSERT INTO case_updates (id, case_id, author_id, author_name, author_role, update_type, message, is_internal, previous_status, new_status, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(randomUUID(), actualCaseId, authorId, authorName, authorRole, 'STATUS_CHANGE', updateMsg, 0, currentStatus, newStatus, stamp);

    // Notify reporter of status update
    this.createNotification({
      userId: comp.reporter_id,
      caseId: actualCaseId,
      type: 'STATUS_UPDATED',
      title: `Case Status: ${newStatus}`,
      message: `Your case ${actualCaseId} has been updated to '${newStatus}'. ${reason ? 'Note: ' + reason : ''}`
    });

    return this.getComplaint(actualCaseId, true);
  }

  requestEvidence({ caseId, authorId, authorName, requestedItems }) {
    const comp = this.db.prepare('SELECT * FROM complaints WHERE case_id=? OR id=?').get(caseId, caseId);
    if (!comp) throw Object.assign(new Error(`Complaint ${caseId} was not found.`), { status: 404 });

    const actualCaseId = comp.case_id;
    const stamp = now();

    this.db.prepare(`
      UPDATE complaints SET status='Evidence Requested', updated_at=? WHERE case_id=?
    `).run(stamp, actualCaseId);

    const msg = `Investigating Officer ${authorName} requested additional evidence: ${requestedItems}`;
    this.db.prepare(`
      INSERT INTO case_updates (id, case_id, author_id, author_name, author_role, update_type, message, is_internal, previous_status, new_status, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(randomUUID(), actualCaseId, authorId, authorName, 'officer', 'EVIDENCE_REQUESTED', msg, 0, comp.status, 'Evidence Requested', stamp);

    this.createNotification({
      userId: comp.reporter_id,
      caseId: actualCaseId,
      type: 'EVIDENCE_REQUESTED',
      title: 'Action Required: Evidence Requested',
      message: `CBI Officer ${authorName} has requested additional evidence for case ${actualCaseId}: "${requestedItems}".`
    });

    return this.getComplaint(actualCaseId, true);
  }

  addEvidence({ caseId, uploadedById, uploadedByName, uploaderRole, filename, fileType = 'application/octet-stream', fileSize = 0, description = '', sha256 = '' }) {
    const comp = this.db.prepare('SELECT * FROM complaints WHERE case_id=? OR id=?').get(caseId, caseId);
    if (!comp) throw Object.assign(new Error(`Complaint ${caseId} was not found.`), { status: 404 });

    const actualCaseId = comp.case_id;
    const id = randomUUID();
    const stamp = now();
    const fileHash = sha256 || hash(`${actualCaseId}:${filename}:${stamp}`);

    this.db.prepare(`
      INSERT INTO case_evidence (id, case_id, uploaded_by_id, uploaded_by_name, uploader_role, filename, file_type, file_size, description, sha256, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(id, actualCaseId, uploadedById, uploadedByName, uploaderRole, filename, fileType, fileSize, description, fileHash, stamp);

    // If reporter uploaded evidence in response to 'Evidence Requested', advance to 'Evidence Received'
    if (uploaderRole === 'reporter' && comp.status === 'Evidence Requested') {
      const newStatus = 'Evidence Received';
      this.db.prepare('UPDATE complaints SET status=?, updated_at=? WHERE case_id=?').run(newStatus, stamp, actualCaseId);
      this.db.prepare(`
        INSERT INTO case_updates (id, case_id, author_id, author_name, author_role, update_type, message, is_internal, previous_status, new_status, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(randomUUID(), actualCaseId, uploadedById, uploadedByName, uploaderRole, 'STATUS_CHANGE', `Supporting evidence '${filename}' submitted by reporter. Status moved to Evidence Received.`, 0, comp.status, newStatus, stamp);
    } else {
      this.db.prepare(`
        INSERT INTO case_updates (id, case_id, author_id, author_name, author_role, update_type, message, is_internal, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(randomUUID(), actualCaseId, uploadedById, uploadedByName, uploaderRole, 'EVIDENCE_UPLOADED', `Evidence attached: ${filename} (${description || 'Supporting documentation'})`, 0, stamp);
    }

    // Notify assigned officer or all officers
    const notifyTarget = comp.assigned_officer_id || null;
    if (notifyTarget) {
      this.createNotification({
        userId: notifyTarget,
        caseId: actualCaseId,
        type: 'EVIDENCE_RECEIVED',
        title: 'New Evidence Submitted',
        message: `Reporter ${uploadedByName} uploaded new evidence '${filename}' for case ${actualCaseId}.`
      });
    }

    return { id, caseId: actualCaseId, filename, fileType, fileSize, description, sha256: fileHash, createdAt: stamp };
  }

  listEvidence(caseId) {
    return this.db.prepare('SELECT id, case_id as caseId, uploaded_by_id as uploadedById, uploaded_by_name as uploadedByName, uploader_role as uploaderRole, filename, file_type as fileType, file_size as fileSize, description, sha256, created_at as createdAt FROM case_evidence WHERE case_id=? ORDER BY created_at ASC').all(caseId);
  }

  addInternalNote({ caseId, authorId, authorName, authorRole, note }) {
    const comp = this.db.prepare('SELECT * FROM complaints WHERE case_id=? OR id=?').get(caseId, caseId);
    if (!comp) throw Object.assign(new Error(`Complaint ${caseId} was not found.`), { status: 404 });

    const actualCaseId = comp.case_id;
    const id = randomUUID();
    const stamp = now();

    this.db.prepare(`
      INSERT INTO case_updates (id, case_id, author_id, author_name, author_role, update_type, message, is_internal, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(id, actualCaseId, authorId, authorName, authorRole, 'INTERNAL_NOTE', note, 1, stamp);

    return { id, caseId: actualCaseId, authorName, message: note, isInternal: 1, createdAt: stamp };
  }

  assignOfficer({ caseId, officerId, officerName, assignedById, assignedByName, notes = '' }) {
    const comp = this.db.prepare('SELECT * FROM complaints WHERE case_id=? OR id=?').get(caseId, caseId);
    if (!comp) throw Object.assign(new Error(`Complaint ${caseId} was not found.`), { status: 404 });

    const actualCaseId = comp.case_id;
    const stamp = now();

    this.db.prepare(`
      UPDATE complaints SET assigned_officer_id=?, assigned_officer_name=?, updated_at=? WHERE case_id=?
    `).run(officerId, officerName, stamp, actualCaseId);

    this.db.prepare(`
      INSERT INTO officer_assignments (id, case_id, officer_id, officer_name, assigned_by_id, assigned_by_name, notes, assigned_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(randomUUID(), actualCaseId, officerId, officerName, assignedById, assignedByName, notes || null, stamp);

    this.db.prepare(`
      INSERT INTO case_updates (id, case_id, author_id, author_name, author_role, update_type, message, is_internal, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(randomUUID(), actualCaseId, assignedById, assignedByName, 'officer', 'OFFICER_ASSIGNED', `Case assigned to Investigating Officer ${officerName}.`, 0, stamp);

    // Notify assigned officer
    this.createNotification({
      userId: officerId,
      caseId: actualCaseId,
      type: 'CASE_ASSIGNED',
      title: 'Case Assigned to You',
      message: `You have been assigned to investigate case ${actualCaseId} (${comp.incident_type}) by ${assignedByName}.`
    });

    return this.getComplaint(actualCaseId, true);
  }

  listCaseUpdates(caseId, includeInternal = false) {
    const sql = includeInternal
      ? 'SELECT id, case_id as caseId, author_id as authorId, author_name as authorName, author_role as authorRole, update_type as updateType, message, is_internal as isInternal, previous_status as previousStatus, new_status as newStatus, created_at as createdAt FROM case_updates WHERE case_id=? ORDER BY created_at ASC'
      : 'SELECT id, case_id as caseId, author_id as authorId, author_name as authorName, author_role as authorRole, update_type as updateType, message, is_internal as isInternal, previous_status as previousStatus, new_status as newStatus, created_at as createdAt FROM case_updates WHERE case_id=? AND is_internal=0 ORDER BY created_at ASC';
    return this.db.prepare(sql).all(caseId);
  }

  createNotification({ userId, caseId = null, type, title, message }) {
    const id = randomUUID();
    const stamp = now();
    this.db.prepare(`
      INSERT INTO notifications (id, user_id, case_id, type, title, message, is_read, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(id, userId, caseId, type, title, message, 0, stamp);
    return { id, userId, caseId, type, title, message, isRead: 0, createdAt: stamp };
  }

  listNotifications(userId, unreadOnly = false) {
    const sql = unreadOnly
      ? 'SELECT id, user_id as userId, case_id as caseId, type, title, message, is_read as isRead, created_at as createdAt FROM notifications WHERE user_id=? AND is_read=0 ORDER BY created_at DESC LIMIT 50'
      : 'SELECT id, user_id as userId, case_id as caseId, type, title, message, is_read as isRead, created_at as createdAt FROM notifications WHERE user_id=? ORDER BY created_at DESC LIMIT 50';
    return this.db.prepare(sql).all(userId);
  }

  markNotificationRead(id, userId) {
    this.db.prepare('UPDATE notifications SET is_read=1 WHERE id=? AND user_id=?').run(id, userId);
    return { id, isRead: 1 };
  }

  markAllNotificationsRead(userId) {
    this.db.prepare('UPDATE notifications SET is_read=1 WHERE user_id=?').run(userId);
    return { success: true };
  }
}
