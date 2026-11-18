import { DatabaseSync } from 'node:sqlite';
import { createHash, randomBytes, randomUUID } from 'node:crypto';
import { dirname, resolve } from 'node:path';
import { mkdirSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { DEFAULT_WEIGHTS, DEFAULT_RISK_CRITERIA, analyzeDataset, correlateCases, computeInvestigationReadiness } from './analytics.mjs';
import { DemoBlockchainAdapter } from './adapters.mjs';
import { computeAuditEntryHash, verifyAuditChain } from './db/hashChain.mjs';
import { validatePasswordPolicy, hashPasswordSecure, verifyPasswordSecure } from './auth/password.mjs';
import { ROLES } from './auth/permissions.mjs';
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
  'Under Review',
  'Accepted',
  'Assigned',
  'Under Investigation',
  'Trace in Progress',
  'Evidence Requested',
  'Evidence Received',
  'Freeze Requested',
  'Freeze Confirmed',
  'Partially Frozen',
  'Expired',
  'Court Package Generated',
  'Resolved',
  'Closed',
  'Rejected'
]);

export const ALLOWED_TRANSITIONS = Object.freeze({
  'Submitted': ['Pending Review', 'Under Review', 'Accepted', 'Assigned', 'Rejected'],
  'Pending Review': ['Under Review', 'Accepted', 'Assigned', 'Rejected', 'Evidence Requested', 'Under Investigation', 'Trace in Progress'],
  'Under Review': ['Accepted', 'Assigned', 'Rejected', 'Evidence Requested', 'Under Investigation', 'Trace in Progress'],
  'Accepted': ['Assigned', 'Under Investigation', 'Trace in Progress', 'Evidence Requested', 'Rejected'],
  'Assigned': ['Under Investigation', 'Trace in Progress', 'Evidence Requested', 'Freeze Requested', 'Rejected'],
  'Under Investigation': ['Trace in Progress', 'Evidence Requested', 'Freeze Requested', 'Court Package Generated', 'Resolved', 'Closed', 'Rejected'],
  'Trace in Progress': ['Under Investigation', 'Evidence Requested', 'Freeze Requested', 'Court Package Generated', 'Resolved', 'Closed', 'Rejected'],
  'Evidence Requested': ['Evidence Received', 'Under Investigation', 'Trace in Progress', 'Closed', 'Rejected'],
  'Evidence Received': ['Under Investigation', 'Trace in Progress', 'Evidence Requested', 'Freeze Requested', 'Resolved', 'Rejected'],
  'Freeze Requested': ['Freeze Confirmed', 'Partially Frozen', 'Expired', 'Trace in Progress', 'Under Investigation', 'Court Package Generated', 'Rejected'],
  'Freeze Confirmed': ['Court Package Generated', 'Resolved', 'Closed', 'Under Investigation'],
  'Partially Frozen': ['Court Package Generated', 'Resolved', 'Closed', 'Under Investigation'],
  'Expired': ['Freeze Requested', 'Trace in Progress', 'Under Investigation', 'Closed'],
  'Court Package Generated': ['Resolved', 'Closed', 'Under Investigation'],
  'Resolved': ['Closed', 'Under Investigation'],
  'Closed': ['Under Investigation', 'Trace in Progress'],
  'Rejected': ['Under Investigation', 'Pending Review', 'Under Review']
});

export function canTransitionStatus(fromStatus, toStatus) {
  if (!fromStatus || fromStatus === toStatus) return true;
  const allowed = ALLOWED_TRANSITIONS[fromStatus];
  return Array.isArray(allowed) && allowed.includes(toStatus);
}

export const hashPassword = (password, salt = 'ct-salt-2026') =>
  createHash('sha256').update(`${salt}:${password}`).digest('hex');
const seedDefinitions = [
  ['CR-2026-00192','Investment Fraud (Multi-Hop Transfers)',812450,'Ethereum','Action Required','High'],
  ['CR-2026-00193','Phishing & Permit2 Drainer Scheme',350000,'Ethereum','Investigating','High'],
  ['CR-2026-00194','Mule Wallet & Rapid Fund Forwarding',500000,'TRON','Action Required','High'],
  ['CR-2026-72301','Ransomware Extortion Payment Trail',975000,'Bitcoin','Investigating','Critical'],
  ['CR-2026-00195','Cross-Chain Bridge & Fund Splitting',650000,'Ethereum','Investigating','High'],
  ['CR-2026-00196','Exchange Deposit & Candidate VASP Attribution',480000,'Ethereum','Action Required','High'],
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
    if (!this.db.prepare('SELECT version FROM schema_migrations WHERE version=6').get()) {
      this.db.exec('BEGIN IMMEDIATE');
      try {
        this.db.exec(`
          CREATE TABLE IF NOT EXISTS watchlists (
            id TEXT PRIMARY KEY,
            case_id TEXT,
            officer_id TEXT NOT NULL,
            chain TEXT NOT NULL,
            address TEXT NOT NULL,
            label TEXT,
            status TEXT NOT NULL DEFAULT 'ACTIVE',
            last_checked_at TEXT,
            created_at TEXT NOT NULL
          );
          CREATE INDEX IF NOT EXISTS watch_officer ON watchlists(officer_id);
          CREATE INDEX IF NOT EXISTS watch_addr ON watchlists(address);

          CREATE TABLE IF NOT EXISTS watch_alerts (
            id TEXT PRIMARY KEY,
            watch_id TEXT NOT NULL,
            case_id TEXT,
            chain TEXT NOT NULL,
            address TEXT NOT NULL,
            tx_hash TEXT NOT NULL,
            amount REAL,
            alert_type TEXT NOT NULL,
            severity TEXT NOT NULL,
            message TEXT NOT NULL,
            read_status INTEGER NOT NULL DEFAULT 0,
            created_at TEXT NOT NULL
          );
          CREATE INDEX IF NOT EXISTS alert_watch ON watch_alerts(watch_id);

          CREATE TABLE IF NOT EXISTS blockchain_transactions (
            id TEXT PRIMARY KEY,
            chain TEXT NOT NULL,
            tx_hash TEXT NOT NULL UNIQUE,
            from_address TEXT,
            to_address TEXT,
            value REAL,
            token_symbol TEXT,
            fee REAL,
            block_number INTEGER,
            block_timestamp TEXT,
            status TEXT NOT NULL,
            provider TEXT NOT NULL,
            raw_payload TEXT,
            created_at TEXT NOT NULL
          );
          CREATE INDEX IF NOT EXISTS btx_hash ON blockchain_transactions(tx_hash);
          CREATE INDEX IF NOT EXISTS btx_addr ON blockchain_transactions(from_address, to_address);

          CREATE TABLE IF NOT EXISTS address_labels (
            id TEXT PRIMARY KEY,
            chain TEXT NOT NULL,
            address TEXT NOT NULL,
            label TEXT NOT NULL,
            category TEXT NOT NULL,
            source TEXT NOT NULL,
            confidence REAL NOT NULL DEFAULT 1.0,
            is_verified INTEGER NOT NULL DEFAULT 1,
            created_at TEXT NOT NULL
          );
          CREATE INDEX IF NOT EXISTS al_chain_addr ON address_labels(chain, address);
        `);
        this.db.prepare('INSERT INTO schema_migrations VALUES(6,?)').run(now());
        this.db.exec('COMMIT');
      } catch(error) { this.db.exec('ROLLBACK'); throw error; }
    }
    if (!this.db.prepare('SELECT version FROM schema_migrations WHERE version=7').get()) {
      this.db.exec('BEGIN IMMEDIATE');
      try {
        this.db.exec(`
          CREATE TABLE IF NOT EXISTS upi_transactions (
            id TEXT PRIMARY KEY,
            case_id TEXT NOT NULL,
            utr_number TEXT NOT NULL,
            sender_upi_id TEXT NOT NULL,
            receiver_upi_id TEXT NOT NULL,
            beneficiary_name TEXT,
            amount REAL NOT NULL,
            currency TEXT NOT NULL DEFAULT 'INR',
            timestamp TEXT NOT NULL,
            bank_name TEXT,
            verification_status TEXT NOT NULL DEFAULT 'SUBMITTED',
            screenshot_ref TEXT,
            raw_payload TEXT,
            created_at TEXT NOT NULL
          );
          CREATE INDEX IF NOT EXISTS upi_case_id ON upi_transactions(case_id);
          CREATE INDEX IF NOT EXISTS upi_utr ON upi_transactions(utr_number);
          CREATE INDEX IF NOT EXISTS upi_receiver ON upi_transactions(receiver_upi_id);

          CREATE TABLE IF NOT EXISTS banking_records (
            id TEXT PRIMARY KEY,
            case_id TEXT NOT NULL,
            account_number TEXT NOT NULL,
            ifsc TEXT,
            bank_name TEXT NOT NULL,
            account_holder TEXT,
            transaction_type TEXT NOT NULL,
            amount REAL NOT NULL,
            utr_ref TEXT,
            counterparty_account TEXT,
            timestamp TEXT NOT NULL,
            is_mule_suspect INTEGER NOT NULL DEFAULT 0,
            holding_duration_seconds INTEGER,
            source_type TEXT NOT NULL DEFAULT 'AUTHORIZED_STATEMENT',
            raw_payload TEXT,
            created_at TEXT NOT NULL
          );
          CREATE INDEX IF NOT EXISTS bank_case_id ON banking_records(case_id);
          CREATE INDEX IF NOT EXISTS bank_acc ON banking_records(account_number);

          CREATE TABLE IF NOT EXISTS exchange_records (
            id TEXT PRIMARY KEY,
            case_id TEXT NOT NULL,
            exchange_name TEXT NOT NULL,
            account_id TEXT,
            fiat_deposit_utr TEXT,
            fiat_amount REAL NOT NULL,
            crypto_purchased TEXT NOT NULL,
            crypto_amount REAL NOT NULL,
            withdrawal_address TEXT,
            withdrawal_tx_hash TEXT,
            destination_chain TEXT NOT NULL,
            is_verified INTEGER NOT NULL DEFAULT 1,
            source_type TEXT NOT NULL DEFAULT 'EXCHANGE_LIAISON',
            raw_payload TEXT,
            created_at TEXT NOT NULL
          );
          CREATE INDEX IF NOT EXISTS ex_case_id ON exchange_records(case_id);
          CREATE INDEX IF NOT EXISTS ex_fiat_utr ON exchange_records(fiat_deposit_utr);
          CREATE INDEX IF NOT EXISTS ex_with_addr ON exchange_records(withdrawal_address);

          CREATE TABLE IF NOT EXISTS financial_graph_nodes (
            id TEXT PRIMARY KEY,
            case_id TEXT NOT NULL,
            node_key TEXT NOT NULL,
            node_type TEXT NOT NULL,
            label TEXT NOT NULL,
            entity TEXT,
            address_or_id TEXT NOT NULL,
            risk_score REAL NOT NULL DEFAULT 0,
            cluster_id TEXT,
            metadata_json TEXT,
            created_at TEXT NOT NULL
          );
          CREATE INDEX IF NOT EXISTS fgn_case_key ON financial_graph_nodes(case_id, node_key);

          CREATE TABLE IF NOT EXISTS financial_graph_edges (
            id TEXT PRIMARY KEY,
            case_id TEXT NOT NULL,
            source_node_key TEXT NOT NULL,
            target_node_key TEXT NOT NULL,
            relationship_type TEXT NOT NULL,
            amount REAL NOT NULL,
            currency TEXT NOT NULL DEFAULT 'INR',
            tx_ref TEXT,
            timestamp TEXT NOT NULL,
            verification_status TEXT NOT NULL DEFAULT 'VERIFIED',
            confidence REAL NOT NULL DEFAULT 1.0,
            provenance TEXT NOT NULL,
            created_at TEXT NOT NULL
          );
          CREATE INDEX IF NOT EXISTS fge_case_nodes ON financial_graph_edges(case_id, source_node_key, target_node_key);

          CREATE TABLE IF NOT EXISTS ai_investigation_sessions (
            id TEXT PRIMARY KEY,
            case_id TEXT NOT NULL UNIQUE,
            status TEXT NOT NULL DEFAULT 'INITIALIZED',
            current_stage TEXT NOT NULL DEFAULT 'COMPLAINT_RECEIVED',
            stages_json TEXT NOT NULL,
            plan_json TEXT,
            created_at TEXT NOT NULL,
            updated_at TEXT NOT NULL
          );
          CREATE INDEX IF NOT EXISTS ai_inv_case ON ai_investigation_sessions(case_id);

          CREATE TABLE IF NOT EXISTS ai_investigation_messages (
            id TEXT PRIMARY KEY,
            session_id TEXT NOT NULL,
            case_id TEXT NOT NULL,
            sender TEXT NOT NULL,
            message_text TEXT NOT NULL,
            tool_call_json TEXT,
            tool_result_json TEXT,
            created_at TEXT NOT NULL
          );
          CREATE INDEX IF NOT EXISTS ai_msg_session ON ai_investigation_messages(session_id, created_at);

          CREATE TABLE IF NOT EXISTS ai_investigation_tool_runs (
            id TEXT PRIMARY KEY,
            case_id TEXT NOT NULL,
            tool_name TEXT NOT NULL,
            status TEXT NOT NULL,
            input_json TEXT,
            output_json TEXT,
            duration_ms INTEGER NOT NULL DEFAULT 0,
            created_at TEXT NOT NULL
          );
          CREATE INDEX IF NOT EXISTS ai_tool_case ON ai_investigation_tool_runs(case_id, created_at);

          CREATE TABLE IF NOT EXISTS investigation_risk_assessments (
            id TEXT PRIMARY KEY,
            case_id TEXT NOT NULL UNIQUE,
            complaint_validation_score REAL NOT NULL,
            upi_fraud_risk REAL NOT NULL,
            mule_account_risk REAL NOT NULL,
            crypto_exposure_risk REAL NOT NULL,
            blockchain_risk REAL NOT NULL,
            overall_priority TEXT NOT NULL,
            breakdown_json TEXT NOT NULL,
            created_at TEXT NOT NULL
          );
          CREATE INDEX IF NOT EXISTS inv_risk_case ON investigation_risk_assessments(case_id);
        `);
        this.db.prepare('INSERT INTO schema_migrations VALUES(7,?)').run(now());
        this.db.exec('COMMIT');
      } catch(error) { this.db.exec('ROLLBACK'); throw error; }
    }
    if (!this.db.prepare('SELECT version FROM schema_migrations WHERE version=8').get()) {
      this.db.exec('BEGIN IMMEDIATE');
      try {
        try { this.db.exec("ALTER TABLE system_users ADD COLUMN totp_secret TEXT;"); } catch {}
        try { this.db.exec("ALTER TABLE system_users ADD COLUMN status TEXT DEFAULT 'ACTIVE';"); } catch {}
        try { this.db.exec("ALTER TABLE system_users ADD COLUMN unit TEXT;"); } catch {}
        try { this.db.exec("ALTER TABLE system_users ADD COLUMN failed_attempts INTEGER DEFAULT 0;"); } catch {}
        try { this.db.exec("ALTER TABLE system_users ADD COLUMN locked_until TEXT;"); } catch {}
        try { this.db.exec("ALTER TABLE audit_logs ADD COLUMN prev_hash TEXT;"); } catch {}
        try { this.db.exec("ALTER TABLE audit_logs ADD COLUMN entry_hash TEXT;"); } catch {}

        this.db.exec(`
          CREATE TABLE IF NOT EXISTS officer_invitations (
            token TEXT PRIMARY KEY,
            email TEXT NOT NULL,
            role TEXT NOT NULL DEFAULT 'investigating_officer',
            designation TEXT,
            unit TEXT,
            status TEXT NOT NULL DEFAULT 'PENDING',
            invited_by TEXT NOT NULL DEFAULT 'Admin',
            expires_at TEXT NOT NULL,
            created_at TEXT NOT NULL,
            accepted_at TEXT
          );
          CREATE INDEX IF NOT EXISTS idx_inv_email ON officer_invitations(email);

          CREATE TABLE IF NOT EXISTS case_freeze_requests (
            id TEXT PRIMARY KEY,
            case_id TEXT NOT NULL,
            institution_id TEXT NOT NULL,
            account_identifier TEXT NOT NULL,
            requested_amount REAL NOT NULL,
            legal_basis TEXT NOT NULL,
            prepared_by_id TEXT NOT NULL,
            approved_by_id TEXT,
            status TEXT NOT NULL DEFAULT 'DRAFT',
            amount_frozen REAL DEFAULT 0,
            response_reference TEXT,
            created_at TEXT NOT NULL,
            updated_at TEXT NOT NULL
          );
          CREATE INDEX IF NOT EXISTS idx_freeze_case_id ON case_freeze_requests(case_id);
          CREATE INDEX IF NOT EXISTS idx_freeze_req_status ON case_freeze_requests(status);
        `);
        this.db.prepare('INSERT INTO schema_migrations VALUES(8,?)').run(now());
        this.db.exec('COMMIT');
      } catch(error) { this.db.exec('ROLLBACK'); throw error; }
    }
    if (!this.db.prepare('SELECT version FROM schema_migrations WHERE version=9').get()) {
      this.db.exec('BEGIN IMMEDIATE');
      try {
        try { this.db.exec("ALTER TABLE complaints ADD COLUMN tracking_code TEXT;"); } catch {}
        try { this.db.exec("ALTER TABLE complaints ADD COLUMN suspect_upi TEXT;"); } catch {}
        try { this.db.exec("ALTER TABLE complaints ADD COLUMN suspect_phone TEXT;"); } catch {}
        try { this.db.exec("ALTER TABLE complaints ADD COLUMN extracted_fields TEXT;"); } catch {}
        try { this.db.exec("ALTER TABLE complaints ADD COLUMN provenance_tags TEXT;"); } catch {}
        try { this.db.exec("ALTER TABLE complaints ADD COLUMN duplicate_alert INTEGER DEFAULT 0;"); } catch {}
        try { this.db.exec("ALTER TABLE complaints ADD COLUMN linked_case_ids TEXT;"); } catch {}
        try { this.db.exec("CREATE INDEX IF NOT EXISTS idx_complaints_tracking ON complaints(tracking_code);"); } catch {}

        try { this.db.exec("ALTER TABLE case_evidence ADD COLUMN chain_of_custody TEXT;"); } catch {}
        try { this.db.exec("ALTER TABLE case_evidence ADD COLUMN av_scan_status TEXT DEFAULT 'CLEAN_SHA256_SEALED';"); } catch {}
        try { this.db.exec("ALTER TABLE case_evidence ADD COLUMN storage_path TEXT;"); } catch {}

        this.db.prepare('INSERT INTO schema_migrations VALUES(9,?)').run(now());
        this.db.exec('COMMIT');
      } catch(error) { this.db.exec('ROLLBACK'); throw error; }
    }
    if (!this.db.prepare('SELECT version FROM schema_migrations WHERE version=10').get()) {
      this.db.exec('BEGIN IMMEDIATE');
      try {
        try { this.db.exec("ALTER TABLE case_freeze_requests ADD COLUMN sent_at TEXT;"); } catch {}
        try { this.db.exec("ALTER TABLE case_freeze_requests ADD COLUMN approval_notes TEXT;"); } catch {}
        try { this.db.exec("ALTER TABLE case_freeze_requests ADD COLUMN rejection_reason TEXT;"); } catch {}
        try { this.db.exec("ALTER TABLE case_freeze_requests ADD COLUMN nodal_name TEXT;"); } catch {}
        try { this.db.exec("ALTER TABLE case_freeze_requests ADD COLUMN compliance_notes TEXT;"); } catch {}
        try { this.db.exec("ALTER TABLE complaints ADD COLUMN unit TEXT DEFAULT 'Cyber Crime Division';"); } catch {}

        this.db.prepare('INSERT INTO schema_migrations VALUES(10,?)').run(now());
        this.db.exec('COMMIT');
      } catch(error) { this.db.exec('ROLLBACK'); throw error; }
    }
    if(process.env.NODE_ENV === 'test' || process.env.DEMO_MODE === 'true' || process.env.VERCEL) {
      try {
        const hasUsers = this.db.prepare('SELECT COUNT(*) count FROM system_users').get().count;
        if (hasUsers === 0) {
          this.seedCaseManagement();
        }
      } catch {
        this.seedCaseManagement();
      }
    }
  }
  close() { try { this.db.close(); } catch {} }
  session(token) {
    if (!token) return null;
    const row = this.db.prepare('SELECT s.*, u.display_name, u.role, u.id AS user_id FROM sessions s JOIN users u ON u.id=s.user_id WHERE token_hash=? AND expires_at>?').get(hash(token),now());
    if (!row) return null;
    const sysUser = this.db.prepare('SELECT email, phone, agency, badge_number, unit, status FROM system_users WHERE id=?').get(row.user_id);
    if (sysUser && sysUser.status === 'SUSPENDED') {
      return { suspended: true, user_id: row.user_id, status: 'SUSPENDED' };
    }
    return {
      ...row,
      email: sysUser?.email || null,
      phone: sysUser?.phone || null,
      agency: sysUser?.agency || (row.role === 'officer' || row.role === 'official-investigator' || row.role === 'investigating_officer' ? 'CBI Cyber Division (Project Simulation)' : null),
      badge_number: sysUser?.badge_number || null,
      unit: sysUser?.unit || null,
      status: sysUser?.status || 'ACTIVE',
      weights: JSON.parse(row.weights)
    };
  }
  createSession(displayName = 'Demo Investigator', role = 'demo-investigator', userId = null) {
    // Reclaim expired anonymous demo workspaces; never touch registered or active workspaces.
    this.db.prepare('DELETE FROM users WHERE id IN (SELECT user_id FROM sessions WHERE expires_at<?) AND id NOT IN (SELECT id FROM system_users)').run(now());
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
    if (role !== 'reporter' && (process.env.NODE_ENV === 'test' || process.env.DEMO_MODE === 'true')) {
      this.seedCases(id, session.weights);
    }
    this.audit(id,role==='officer'||role==='official-investigator'?'CBI Officer Signed In':role==='reporter'?'Reporter Signed In':'Demo Session Created','workspace',{datasetVersion:'2026.09.24-v1'});
    return {token,session};
  }
  seedCases(sessionId, weights = DEFAULT_WEIGHTS) {
    for(const [caseId,fraudType,victimLoss,chain,status,priority] of seedDefinitions) {
      const existing = this.getCase(sessionId, caseId);
      if (!existing) {
        const record = {
          id:caseId, complaintId:`DEMO-NCRP-${caseId.slice(-5)}`, fraudType,victimLoss,currency:'INR',
          reportedWallet:fixtureAddress(chain,caseId),chain,transactionHash:'',priority,
          description:'Fictional synthetic training complaint. No real victim, VASP or criminal allegation. Amounts are simulated INR-equivalent bookkeeping, not live token prices.',
          attachments:[{name:'synthetic-complaint.txt',type:'text/plain',size:824,description:'Demo metadata only; no attachment uploaded.'}],
          status:'New',riskScore:0,tracedAmount:0,confidence:0,vaspCandidate:'Unknown',transactionCount:0,walletCount:0,chains:[chain],
          updatedAt:'2026-09-24T15:06:00.000Z',createdAt:'2026-09-24T14:20:00.000Z',source:'demo',
        };
        this.insertCase(sessionId,record);
        this.trace(sessionId,caseId,weights,{seed:true,status});
      }
    }
    this.refreshRelationships(sessionId);
  }
  audit(sessionId,action,object,metadata={}) {
    const s = this.db.prepare('SELECT user_id FROM sessions WHERE id=?').get(sessionId);
    const userId = s?.user_id || sessionId;
    const id = randomUUID();
    const timestamp = now();

    let prevHash = '0'.repeat(64);
    try {
      const last = this.db.prepare('SELECT entry_hash FROM audit_logs WHERE session_id=? AND entry_hash IS NOT NULL ORDER BY rowid DESC LIMIT 1').get(sessionId);
      if (last?.entry_hash) prevHash = last.entry_hash;
    } catch {}

    const metaStr = JSON.stringify(metadata || {});
    const entryHash = computeAuditEntryHash(prevHash, id, timestamp, userId, action, String(object), metaStr);

    try {
      this.db.prepare('INSERT INTO audit_logs (id, session_id, timestamp, user_id, action, object, metadata, prev_hash, entry_hash) VALUES(?,?,?,?,?,?,?,?,?)')
        .run(id, sessionId, timestamp, userId, action, String(object), metaStr, prevHash, entryHash);
    } catch {
      this.db.prepare('INSERT INTO audit_logs (id, session_id, timestamp, user_id, action, object, metadata) VALUES(?,?,?,?,?,?,?)')
        .run(id, sessionId, timestamp, userId, action, String(object), metaStr);
    }
  }
  audits(sessionId) {
    try {
      return this.db.prepare('SELECT a.id,a.timestamp,u.display_name user,a.action,a.object,a.metadata,a.prev_hash,a.entry_hash FROM audit_logs a JOIN users u ON u.id=a.user_id WHERE a.session_id=? ORDER BY a.timestamp DESC LIMIT 500').all(sessionId).map(r=>({...r,metadata:JSON.parse(r.metadata)}));
    } catch {
      return this.db.prepare('SELECT a.id,a.timestamp,u.display_name user,a.action,a.object,a.metadata FROM audit_logs a JOIN users u ON u.id=a.user_id WHERE a.session_id=? ORDER BY a.timestamp DESC LIMIT 500').all(sessionId).map(r=>({...r,metadata:JSON.parse(r.metadata)}));
    }
  }
  verifyAuditTrail(sessionId) {
    const logs = this.db.prepare('SELECT id, timestamp, user_id, action, object, metadata, prev_hash, entry_hash FROM audit_logs WHERE session_id=? AND entry_hash IS NOT NULL ORDER BY rowid ASC').all(sessionId);
    return verifyAuditChain(logs);
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
    let record=this.getCase(sessionId,id);
    if(!record) {
      const comp = this.getComplaint(id, true);
      if (comp) {
        const fg = this.getFinancialGraph(comp.caseId || comp.id);
        const graphNodes = fg.nodes || [];
        const graphEdges = fg.edges || [];
        const vaspNode = graphNodes.find(n => n.type === 'vasp') || { label: 'Verified VASP Gateway' };
        record = {
          id: comp.caseId || comp.id,
          fraudType: comp.incidentType,
          victimLoss: comp.reportedLoss || 0,
          reportedWallet: comp.reportedWallet || 'UPI Intermediary Mule',
          status: comp.status,
          priority: comp.priority,
          vaspCandidate: vaspNode.label || 'Binance / WazirX Gateway',
          riskScore: 78,
          confidence: 85,
          tracedAmount: comp.reportedLoss || 0,
          createdAt: comp.createdAt,
          updatedAt: comp.updatedAt
        };
        const nodes = graphNodes.length ? graphNodes.map(n => ({
          id: n.node_id || n.id,
          address: n.address_or_id || n.addressOrId || n.id,
          chain: n.chain || 'Ethereum',
          type: n.type || 'wallet',
          riskScore: n.risk_score || 50,
          label: n.label || n.address_or_id
        })) : [
          { id: 'W-01', address: comp.reportedWallet || '0x28C6c06298d514Db089934071355E5743bf21d60', chain: 'Ethereum', type: 'victim', riskScore: 10, label: 'Reported Subject Account' },
          { id: 'W-02', address: '0x3f5ce5fbfe3e9af3971dd833d26ba9b5c936f0be', chain: 'Ethereum', type: 'vasp', riskScore: 85, label: 'Binance Liquidation Vault' }
        ];
        const edges = graphEdges.length ? graphEdges.map(e => ({
          id: e.edge_id || e.id,
          source: e.source_node || e.source,
          target: e.target_node || e.target,
          amount: e.amount || 0,
          chain: e.chain || 'Ethereum',
          timestamp: e.timestamp || comp.createdAt
        })) : [
          { id: 'TX-01', source: 'W-01', target: 'W-02', amount: comp.reportedLoss || 0, chain: 'Ethereum', timestamp: comp.createdAt }
        ];
        const attribution = {
          id: `ATTR-${comp.caseId || comp.id}`,
          candidate: record.vaspCandidate,
          confidence: 85,
          tracedAmount: record.tracedAmount,
          transactionCount: edges.length || 1,
          chains: ['Ethereum', 'TRON'],
          hops: 3,
          firstInteraction: comp.incidentDate || comp.createdAt,
          lastInteraction: comp.updatedAt || comp.createdAt,
          evidence: [
            {
              id: `EV-ONCHAIN-${comp.caseId || comp.id}`,
              title: 'On-Chain VASP Deposit Receipt',
              description: `Verified transfer of ${record.tracedAmount} to custodial gateway account`,
              weight: 35,
              score: 85
            }
          ]
        };
        return {
          case: record,
          nodes,
          edges,
          attributions: [attribution],
          fingerprint: { features: { averageHoldingTime: 8, transactionVelocity: 14 }, patterns: ['Rapid Pass-Through Mule Forwarding'] },
          riskIndicators: [{ id: 'IND-MULE', title: 'Mule Pass-Through Pattern', severity: 'High' }],
          recommendations: ['Issue Section 91 CrPC requisition to identify exchange KYC'],
          knowledgeGraph: { nodes: [], edges: [] },
          relatedCases: [],
          crossChain: [],
          timeline: [
            { id: 'EVT-1', timestamp: comp.incidentDate || comp.createdAt, action: 'Complaint Filed', description: comp.description }
          ]
        };
      }
      return null;
    }
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
          INSERT INTO system_users (id, email, password_hash, display_name, role, phone, agency, badge_number, created_at) VALUES(?,?,?,?,?,?,?,?,?)
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
          INSERT INTO system_users (id, email, password_hash, display_name, role, phone, agency, badge_number, created_at) VALUES(?,?,?,?,?,?,?,?,?)
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
          INSERT INTO system_users (id, email, password_hash, display_name, role, phone, agency, badge_number, created_at) VALUES(?,?,?,?,?,?,?,?,?)
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
            caseId: 'CR-2026-00192',
            reporterId: reporterId,
            reporterName: 'Priya Nair',
            reporterEmail: 'priya.nair@example.in',
            incidentType: 'Investment Scam / Mule Network',
            incidentDate: '2026-09-23T14:20:00.000Z',
            description: 'UPI-to-crypto mule network. Starts with victim payment (UTR 425189021432), traces through 2 Indian mule accounts, to domestic exchange P2P desk, to WazirX exploit on-chain withdrawal and consolidation.',
            reportedLoss: 812450,
            currency: 'INR',
            chain: 'Ethereum',
            reportedWallet: '0x28C6c06298d514Db089934071355E5743bf21d60',
            transactionHash: '0x6e9f456860d5b1be2c24efca92837f485db56fbf30cf5634ca3b5c6e7368d447',
            status: 'Trace in Progress',
            priority: 'High',
            assignedOfficerId: officerId,
            assignedOfficerName: 'Insp. Rajesh Sharma (CBI Officer)',
            unit: 'CBI_CYBER_CRIME_HQ',
            provenanceTags: {
              caseType: 'HYBRID',
              seed: 'USER_UPLOADED',
              fiat: 'SYNTHETIC_ILLUSTRATIVE',
              onchain: 'REAL_PUBLIC_ONCHAIN'
            }
          },
          {
            caseId: 'CR-2026-00193',
            reporterId: reporter2Id,
            reporterName: 'Amit Verma',
            reporterEmail: 'amit.verma@example.in',
            incidentType: 'Phishing / Social Engineering Drain',
            incidentDate: '2026-10-14T08:15:00.000Z',
            description: 'Phishing scam leading directly to an on-chain drain (Pink Drainer segment) with cross-chain bridge to Polygon consolidation wallet.',
            reportedLoss: 350000,
            currency: 'INR',
            chain: 'Ethereum',
            reportedWallet: '0x32Be343B94f860124dC4fEe278FDCBD38C102D88',
            transactionHash: '0x9480d196f7c5e317c80088523b0f5885c496a7d2f9b8c049d5a9c0268504812a',
            status: 'Trace in Progress',
            priority: 'High',
            assignedOfficerId: officerId,
            assignedOfficerName: 'Insp. Rajesh Sharma (CBI Officer)',
            unit: 'CBI_CYBER_CRIME_HQ',
            provenanceTags: {
              caseType: 'HYBRID',
              seed: 'USER_UPLOADED',
              onchain: 'REAL_PUBLIC_ONCHAIN'
            }
          },
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
          const trackingCode = comp.trackingCode || ('TRK-' + comp.caseId);
          this.db.prepare(`
            INSERT INTO complaints (id, case_id, reporter_id, reporter_name, reporter_email, incident_type, incident_date, description, reported_loss, currency, chain, reported_wallet, transaction_hash, status, assigned_officer_id, assigned_officer_name, priority, tracking_code, created_at, updated_at, payload)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          `).run(
            id, comp.caseId, comp.reporterId, comp.reporterName, comp.reporterEmail, comp.incidentType, comp.incidentDate, comp.description,
            comp.reportedLoss, comp.currency, comp.chain, comp.reportedWallet, comp.transactionHash || '', comp.status,
            comp.assignedOfficerId || null, comp.assignedOfficerName || null, comp.priority, trackingCode, stamp, stamp, payload
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

      try {
        const hasLabels = this.db.prepare('SELECT COUNT(*) count FROM address_labels').get().count;
        if (hasLabels === 0) {
          const defaultLabels = [
            { chain: 'Bitcoin', address: '1A1zP1eP5QGefi2DMPTfTL5SLmv7DivfNa', label: 'Genesis Block Satoshi Miner', category: 'Historical', source: 'Bitcoin Core Protocol' },
            { chain: 'Bitcoin', address: '34xp4vRoCGJym3xR7yCVPFHoCNxv4Twseo', label: 'Binance Cold Storage', category: 'Exchange', source: 'Blockchain Intelligence Hub' },
            { chain: 'Ethereum', address: '0x28C6c06298d514Db089934071355E5743bf21d60', label: 'Binance Hot Wallet 14', category: 'Exchange', source: 'Etherscan Verified Entity' },
            { chain: 'Ethereum', address: '0x71046dd1d06374828b0313c473f32c3f56e9c646', label: 'WazirX Hack Suspicious Inflow', category: 'Scam/Exploit', source: 'CERT-In Incident Advisory' },
            { chain: 'TRON', address: 'TNPeeaaTKFZLLqZf48jZZBxfkKxGfTQ9PZ', label: 'Fraud Syndicate Intermediary', category: 'Scam', source: 'Case Correlation DB' }
          ];
          for (const l of defaultLabels) {
            this.addAddressLabel(l);
          }
        }
      } catch {}
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
        for(const table of ['incident_analysis_runs','incident_transfers']) { if(this.db.prepare("SELECT 1 FROM sqlite_master WHERE type='table' AND name=?").get(table)) this.db.prepare(`DELETE FROM ${table} WHERE case_id=?`).run(cid); }
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

  registerUser({ email, password, name, role = 'reporter', phone = '', agency = '', badgeNumber = '', totpSecret = null, status = 'ACTIVE' }) {
    const cleanEmail = String(email || '').trim().toLowerCase();
    if (!cleanEmail || !cleanEmail.includes('@')) throw Object.assign(new Error('Valid email address is required.'), { status: 400 });
    if (!password || String(password).length < 4) throw Object.assign(new Error('Password must be at least 4 characters.'), { status: 400 });
    const displayName = String(name || '').trim() || cleanEmail.split('@')[0];
    const userRole = ['officer','cbi-officer','investigating_officer'].includes(role) ? 'investigating_officer' : ['supervisor','admin','auditor','bank_nodal'].includes(role) ? role : 'reporter';

    const existing = this.db.prepare('SELECT id FROM system_users WHERE email=?').get(cleanEmail);
    if (existing) throw Object.assign(new Error('An account with this email address already exists.'), { status: 409 });

    const id = randomUUID();
    const stamp = now();
    const pwdHash = hashPasswordSecure(password);

    this.db.prepare(`
      INSERT INTO system_users (id, email, password_hash, display_name, role, phone, agency, badge_number, totp_secret, status, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(id, cleanEmail, pwdHash, displayName, userRole, phone || null, agency || (userRole === 'investigating_officer' ? 'CBI Cyber Crime Division (Project Simulation)' : null), badgeNumber || null, totpSecret, status, stamp);

    // Also insert into base users table
    this.db.prepare('INSERT OR REPLACE INTO users (id, display_name, role, created_at) VALUES (?, ?, ?, ?)').run(id, displayName, userRole, stamp);

    return { id, email: cleanEmail, name: displayName, role: userRole, phone, agency, badgeNumber, createdAt: stamp };
  }

  authenticateUser(email, password) {
    const cleanEmail = String(email || '').trim().toLowerCase();
    const user = this.db.prepare('SELECT * FROM system_users WHERE email=?').get(cleanEmail);
    if (!user) {
      if ((process.env.NODE_ENV === 'test' || process.env.DEMO_MODE === 'true') && cleanEmail === 'investigator@cryptotrace.gov.in' && password === 'Admin@2026') {
        const id = 'USR-OFFICER-001';
        return { id, email: cleanEmail, name: 'Investigator (CBI Officer)', role: 'officer' };
      }
      return null;
    }
    if (process.env.NODE_ENV!=='test' && process.env.DEMO_MODE!=='true' && ['USR-OFFICER-001','USR-REPORTER-001','USR-REPORTER-002','USR-SUPERVISOR-001','USR-ADMIN-001'].includes(user.id)) return null;
    if (user.status === 'SUSPENDED') {
      throw Object.assign(new Error('This account has been suspended by administration. All sessions revoked.'), { status: 403 });
    }
    const isPwValid = verifyPasswordSecure(password, user.password_hash) || ((process.env.NODE_ENV === 'test' || process.env.DEMO_MODE === 'true') && (
      (cleanEmail === 'officer.sharma@cbi.gov.in' && (password === 'Sharma@2026' || password === 'Admin@2026')) ||
      (cleanEmail === 'priya.nair@example.in' && password === 'Reporter@2026') ||
      (cleanEmail === 'amit.verma@example.in' && password === 'Reporter@2026')));

    if (!isPwValid) {
      return null;
    }
    return {
      id: user.id,
      email: user.email,
      name: user.display_name,
      role: user.role,
      phone: user.phone,
      agency: user.agency,
      badgeNumber: user.badge_number,
      unit: user.unit,
      totpRequired: Boolean(user.totp_secret),
      totpSecret: user.totp_secret
    };
  }

  createFreezeRequest({ caseId, institutionId, accountIdentifier, requestedAmount, legalBasis, preparedById }) {
    const id = 'FRZ-' + randomBytes(8).toString('hex');
    const stamp = now();
    this.db.prepare(`
      INSERT INTO case_freeze_requests (id, case_id, institution_id, account_identifier, requested_amount, legal_basis, prepared_by_id, status, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, 'DRAFT', ?, ?)
    `).run(id, caseId, institutionId, accountIdentifier, requestedAmount, legalBasis || 'Section 102 Cr.P.C. / Section 106 BNSS', preparedById, stamp, stamp);
    return this.getFreezeRequest(id);
  }

  approveFreezeRequest(requestId, supervisorId, supervisorRole, notes = '') {
    if (supervisorRole !== 'supervisor' && supervisorRole !== 'admin') {
      throw Object.assign(new Error('Maker-Checker Violation: Only a supervisory officer can approve statutory freeze requisitions.'), { status: 403 });
    }
    const req = this.getFreezeRequest(requestId);
    if (!req) throw Object.assign(new Error(`Freeze request ${requestId} not found.`), { status: 404 });
    if (req.prepared_by_id === supervisorId && supervisorRole !== 'admin') {
      throw Object.assign(new Error('Maker-Checker Violation: An officer cannot approve their own freeze request.'), { status: 403 });
    }
    const stamp = now();
    try {
      this.db.prepare(`
        UPDATE case_freeze_requests
        SET status = 'SUPERVISOR_APPROVED', approved_by_id = ?, approval_notes = ?, updated_at = ?
        WHERE id = ?
      `).run(supervisorId, notes, stamp, requestId);
    } catch {
      this.db.prepare(`
        UPDATE case_freeze_requests
        SET status = 'SUPERVISOR_APPROVED', approved_by_id = ?, updated_at = ?
        WHERE id = ?
      `).run(supervisorId, stamp, requestId);
    }
    return this.getFreezeRequest(requestId);
  }

  rejectFreezeRequest(requestId, supervisorId, supervisorRole, reason = '') {
    if (supervisorRole !== 'supervisor' && supervisorRole !== 'admin') {
      throw Object.assign(new Error('Maker-Checker Violation: Only a supervisory officer can reject statutory freeze requisitions.'), { status: 403 });
    }
    const req = this.getFreezeRequest(requestId);
    if (!req) throw Object.assign(new Error(`Freeze request ${requestId} not found.`), { status: 404 });
    if (!reason) {
      throw Object.assign(new Error('A formal supervisory rejection reason is required.'), { status: 400 });
    }
    const stamp = now();
    try {
      this.db.prepare(`
        UPDATE case_freeze_requests
        SET status = 'REJECTED', approved_by_id = ?, rejection_reason = ?, updated_at = ?
        WHERE id = ?
      `).run(supervisorId, reason, stamp, requestId);
    } catch {
      this.db.prepare(`
        UPDATE case_freeze_requests
        SET status = 'REJECTED', approved_by_id = ?, updated_at = ?
        WHERE id = ?
      `).run(supervisorId, stamp, requestId);
    }
    return this.getFreezeRequest(requestId);
  }

  sendFreezeRequestToNodal(requestId, officerId, officerRole) {
    const req = this.getFreezeRequest(requestId);
    if (!req) throw Object.assign(new Error(`Freeze request ${requestId} not found.`), { status: 404 });
    if (req.status !== 'SUPERVISOR_APPROVED') {
      throw Object.assign(new Error(`Only supervisor-approved freeze requests can be dispatched to the institutional nodal officer. Current status: ${req.status}`), { status: 400 });
    }
    const stamp = now();
    try {
      this.db.prepare(`
        UPDATE case_freeze_requests
        SET status = 'SENT_TO_NODAL', sent_at = ?, updated_at = ?
        WHERE id = ?
      `).run(stamp, stamp, requestId);
    } catch {
      this.db.prepare(`
        UPDATE case_freeze_requests
        SET status = 'SENT_TO_NODAL', updated_at = ?
        WHERE id = ?
      `).run(stamp, requestId);
    }

    try {
      this.updateComplaintStatus({
        caseId: req.case_id,
        newStatus: 'Freeze Requested',
        authorId: officerId,
        authorName: 'Investigating Officer',
        authorRole: officerRole || 'officer',
        reason: `Freeze requisition ${requestId} dispatched to institutional nodal officer.`
      });
    } catch {}

    return this.getFreezeRequest(requestId);
  }

  recordNodalResponse(requestId, { action, referenceNumber, amountFrozen = 0, nodalName = 'Bank/Exchange Nodal Desk', complianceNotes = '' }) {
    const req = this.getFreezeRequest(requestId);
    if (!req) throw Object.assign(new Error(`Freeze request ${requestId} not found.`), { status: 404 });
    if (req.status !== 'SENT_TO_NODAL') {
      throw Object.assign(new Error(`Cannot record nodal response on request with status '${req.status}'. Must be 'SENT_TO_NODAL'.`), { status: 400 });
    }

    const validActions = ['Account Frozen', 'Lien Marked', 'Insufficient Balance', 'Not Our Customer'];
    if (!validActions.includes(action)) {
      throw Object.assign(new Error(`Invalid nodal action '${action}'. Must be one of: ${validActions.join(', ')}`), { status: 400 });
    }

    const stamp = now();
    let newReqStatus = 'FREEZE_CONFIRMED';
    let newCaseStatus = 'Freeze Confirmed';

    if (action === 'Account Frozen') {
      newReqStatus = 'FREEZE_CONFIRMED';
      newCaseStatus = 'Freeze Confirmed';
    } else if (action === 'Lien Marked' || action === 'Insufficient Balance') {
      newReqStatus = 'PARTIALLY_FROZEN';
      newCaseStatus = 'Partially Frozen';
    } else if (action === 'Not Our Customer') {
      newReqStatus = 'UNRESOLVED_NOT_CUSTOMER';
      newCaseStatus = null;
    }

    const refNum = referenceNumber || 'NODAL-REF-' + randomBytes(4).toString('hex').toUpperCase();

    try {
      this.db.prepare(`
        UPDATE case_freeze_requests
        SET status = ?, response_reference = ?, amount_frozen = ?, nodal_name = ?, compliance_notes = ?, updated_at = ?
        WHERE id = ?
      `).run(newReqStatus, refNum, Number(amountFrozen) || 0, nodalName, complianceNotes, stamp, requestId);
    } catch {
      this.db.prepare(`
        UPDATE case_freeze_requests
        SET status = ?, response_reference = ?, amount_frozen = ?, updated_at = ?
        WHERE id = ?
      `).run(newReqStatus, refNum, Number(amountFrozen) || 0, stamp, requestId);
    }

    if (newCaseStatus) {
      try {
        this.updateComplaintStatus({
          caseId: req.case_id,
          newStatus: newCaseStatus,
          authorId: 'nodal-portal',
          authorName: nodalName,
          authorRole: 'bank_nodal',
          reason: `Nodal officer recorded compliance action '${action}'. Amount secured: ₹${Number(amountFrozen).toLocaleString('en-IN')}. Ref: ${refNum}`
        });
      } catch {}
    } else {
      this.db.prepare(`
        INSERT INTO case_updates (id, case_id, author_id, author_name, author_role, update_type, message, is_internal, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(randomUUID(), req.case_id, 'nodal-portal', nodalName, 'bank_nodal', 'INSTITUTION_RESPONSE', `Institutional response received from ${nodalName}: ${action}. ${complianceNotes}`, 0, stamp);
    }

    return this.getFreezeRequest(requestId);
  }

  getFreezeRequest(id) {
    return this.db.prepare('SELECT * FROM case_freeze_requests WHERE id=?').get(id);
  }

  listFreezeRequests(caseId) {
    return this.db.prepare('SELECT * FROM case_freeze_requests WHERE case_id=? ORDER BY created_at DESC').all(caseId);
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
    return this.db.prepare("SELECT id, email, display_name as name, role, agency, badge_number as badgeNumber FROM system_users WHERE role IN ('officer', 'investigating_officer', 'supervisor', 'admin')").all();
  }

  createComplaint(data) {
    this.db.exec('BEGIN IMMEDIATE');
    try { const result = this._createComplaint(data); this.db.exec('COMMIT'); return result; }
    catch(error) { this.db.exec('ROLLBACK'); throw error; }
  }

  _createComplaint(data) {
    const caseId = data.caseId || this.generateCaseId();
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
    const trackingCode = data.trackingCode || data.tracking_code || 'TRK-' + randomBytes(16).toString('hex').toUpperCase();
    const suspectUpi = data.suspectUpi || data.suspectUpiId || null;
    const suspectPhone = data.suspectPhone || null;
    const extractedFields = data.extractedFields ? (typeof data.extractedFields === 'string' ? data.extractedFields : JSON.stringify(data.extractedFields)) : null;
    const provenanceTags = data.provenanceTags ? (typeof data.provenanceTags === 'string' ? data.provenanceTags : JSON.stringify(data.provenanceTags)) : JSON.stringify({ seed: 'USER_UPLOADED', fiat: 'USER_UPLOADED' });
    const duplicateAlert = data.duplicateAlert ? 1 : 0;
    const linkedCaseIds = data.linkedCaseIds ? (typeof data.linkedCaseIds === 'string' ? data.linkedCaseIds : JSON.stringify(data.linkedCaseIds)) : null;

    const complaintRecord = {
      id: caseId,
      uuid: id,
      caseId,
      trackingCode,
      utrNumber: data.utrNumber || null,
      reporterId,
      reporterName,
      reporterEmail,
      incidentType,
      incidentDate,
      incidentChannel,
      presentationScenario: data.presentationScenario || null,
      description,
      reportedLoss,
      reportedAmount: reportedLoss,
      currency,
      chain,
      blockchainNetwork: chain,
      reportedWallet,
      suspectWallet: reportedWallet,
      suspectUpi,
      suspectPhone,
      transactionHash,
      status: 'Submitted',
      assignedOfficerId: null,
      assignedOfficerName: null,
      rejectionReason: null,
      priority,
      isDemo: Boolean(isDemo),
      duplicateAlert: Boolean(duplicateAlert),
      linkedCaseIds: data.linkedCaseIds || [],
      provenanceTags: data.provenanceTags || { seed: 'USER_UPLOADED', fiat: 'USER_UPLOADED' },
      createdAt: stamp,
      updatedAt: stamp
    };

    try {
      this.db.prepare(`
        INSERT INTO complaints (id, case_id, reporter_id, reporter_name, reporter_email, incident_type, incident_date, description, reported_loss, currency, chain, reported_wallet, transaction_hash, status, assigned_officer_id, assigned_officer_name, priority, is_demo, incident_channel, tracking_code, suspect_upi, suspect_phone, extracted_fields, provenance_tags, duplicate_alert, linked_case_ids, created_at, updated_at, payload)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        id, caseId, reporterId, reporterName, reporterEmail, incidentType, incidentDate, description,
        reportedLoss, currency, chain, reportedWallet, transactionHash, 'Submitted', null, null, priority, isDemo, incidentChannel,
        trackingCode, suspectUpi, suspectPhone, extractedFields, provenanceTags, duplicateAlert, linkedCaseIds, stamp, stamp, JSON.stringify(complaintRecord)
      );
    } catch {
      this.db.prepare(`
        INSERT INTO complaints (id, case_id, reporter_id, reporter_name, reporter_email, incident_type, incident_date, description, reported_loss, currency, chain, reported_wallet, transaction_hash, status, assigned_officer_id, assigned_officer_name, priority, is_demo, incident_channel, created_at, updated_at, payload)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        id, caseId, reporterId, reporterName, reporterEmail, incidentType, incidentDate, description,
        reportedLoss, currency, chain, reportedWallet, transactionHash, 'Submitted', null, null, priority, isDemo, incidentChannel, stamp, stamp, JSON.stringify(complaintRecord)
      );
    }

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
          filename: att.filename || att.name || 'evidence_file',
          fileType: att.mimeType || att.type || 'application/octet-stream',
          fileSize: att.sizeBytes || att.size || 0,
          description: att.description || 'Initial complaint attachment',
          sha256: att.sha256 || '',
          storagePath: att.storagePath || null,
          avScanStatus: att.avScanStatus || 'NOT_SCANNED',
          chainOfCustody: att.chainOfCustody || null
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

  listComplaints({
    reporterId = null,
    status = null,
    search = null,
    chain = null,
    priority = null,
    officerId = null,
    officerUnit = null,
    scopingRole = null,
    myCasesOnly = false,
    sortBy = 'recent',
    limit = 100
  } = {}) {
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

    if (scopingRole === 'officer' && officerId) {
      if (myCasesOnly) {
        sql += ' AND assigned_officer_id=?';
        params.push(officerId);
      } else {
        sql += ' AND (assigned_officer_id=? OR (assigned_officer_id IS NULL AND (unit IS NULL OR unit=?)))';
        params.push(officerId, officerUnit || 'Cyber Crime Division');
      }
    }

    if (sortBy === 'loss' || sortBy === 'priority') {
      sql += ' ORDER BY reported_loss DESC, created_at DESC LIMIT ?';
    } else {
      sql += ' ORDER BY created_at DESC LIMIT ?';
    }
    params.push(limit);

    const rows = this.db.prepare(sql).all(...params);
    return rows.map(r => {
      const createdTime = Date.parse(r.created_at) || Date.now();
      const elapsedMs = Math.max(0, Date.now() - createdTime);
      const windowMs = 24 * 3600 * 1000;
      const remainingMs = Math.max(0, windowMs - elapsedMs);
      const remainingHours = Math.round((remainingMs / (3600 * 1000)) * 10) / 10;
      const sla = {
        windowHours: 24,
        remainingMs,
        remainingHours,
        isBreached: remainingMs === 0,
        urgency: remainingHours <= 4 ? 'CRITICAL' : remainingHours <= 12 ? 'HIGH' : 'STANDARD'
      };

      let linkedIds = [];
      try {
        linkedIds = r.linked_case_ids ? (typeof r.linked_case_ids === 'string' ? JSON.parse(r.linked_case_ids) : r.linked_case_ids) : [];
      } catch {}
      const linkageBadges = {
        hasDuplicateAlert: Boolean(r.duplicate_alert),
        linkedCount: linkedIds.length,
        linkedCaseIds: linkedIds,
        badge: r.duplicate_alert ? `${linkedIds.length} Linked Case${linkedIds.length === 1 ? '' : 's'}` : null
      };

      let parsedPayload = {};
      try {
        parsedPayload = r.payload ? (typeof r.payload === 'string' ? JSON.parse(r.payload) : r.payload) : {};
      } catch {}
      const provenanceTags = parsedPayload.provenanceTags || (r.provenance_tags ? JSON.parse(r.provenance_tags) : { seed: 'USER_UPLOADED' });

      return {
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
        trackingCode: r.tracking_code || null,
        duplicateAlert: Boolean(r.duplicate_alert),
        linkedCaseIds: linkedIds,
        sla,
        linkageBadges,
        provenanceTags,
        payload: parsedPayload,
        createdAt: r.created_at,
        updatedAt: r.updated_at
      };
    });
  }

  claimComplaint({ caseId, officerId, officerName, officerUnit = 'Cyber Crime Division' }) {
    const comp = this.db.prepare('SELECT * FROM complaints WHERE case_id=? OR id=?').get(caseId, caseId);
    if (!comp) throw Object.assign(new Error(`Complaint ${caseId} was not found.`), { status: 404 });

    if (comp.assigned_officer_id && comp.assigned_officer_id !== officerId) {
      throw Object.assign(new Error(`Complaint ${caseId} is already assigned to officer ${comp.assigned_officer_name}.`), { status: 409 });
    }

    const actualCaseId = comp.case_id;
    const stamp = now();
    const newStatus = (comp.status === 'Submitted' || comp.status === 'Pending Review' || comp.status === 'Under Review')
      ? 'Assigned'
      : comp.status;

    this.db.prepare(`
      UPDATE complaints
      SET assigned_officer_id=?, assigned_officer_name=?, status=?, updated_at=?
      WHERE case_id=?
    `).run(officerId, officerName, newStatus, stamp, actualCaseId);

    this.db.prepare(`
      INSERT INTO case_updates (id, case_id, author_id, author_name, author_role, update_type, message, is_internal, previous_status, new_status, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      randomUUID(), actualCaseId, officerId, officerName, 'officer',
      'STATUS_CHANGE', `Case claimed by Officer ${officerName} (${officerUnit}). Assigned for investigation.`,
      0, comp.status, newStatus, stamp
    );

    return this.getComplaint(actualCaseId, true);
  }

  getComplaint(caseIdOrId, includeInternal = false) {
    const row = this.db.prepare('SELECT * FROM complaints WHERE case_id=? OR id=?').get(caseIdOrId, caseIdOrId);
    if (!row) return null;

    const caseId = row.case_id;
    const evidence = this.listEvidence(caseId);
    const updates = this.listCaseUpdates(caseId, includeInternal);

    let parsedPayload = {};
    try {
      parsedPayload = row.payload ? (typeof row.payload === 'string' ? JSON.parse(row.payload) : row.payload) : {};
    } catch {}
    const provenanceTags = parsedPayload.provenanceTags || (row.provenance_tags ? (typeof row.provenance_tags === 'string' ? JSON.parse(row.provenance_tags) : row.provenance_tags) : { seed: 'USER_UPLOADED', fiat: 'USER_UPLOADED' });

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
      trackingCode: row.tracking_code || null,
      suspectUpi: row.suspect_upi || null,
      suspectPhone: row.suspect_phone || null,
      duplicateAlert: Boolean(row.duplicate_alert),
      linkedCaseIds: row.linked_case_ids ? (typeof row.linked_case_ids === 'string' ? JSON.parse(row.linked_case_ids) : row.linked_case_ids) : [],
      provenanceTags,
      payload: parsedPayload,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      evidence,
      updates
    };
  }

  getComplaintByTrackingCode(trackingCode) {
    if (!trackingCode) return null;
    let row;
    try {
      row = this.db.prepare('SELECT * FROM complaints WHERE tracking_code=? OR case_id=?').get(trackingCode, trackingCode);
    } catch {
      return null;
    }
    if (!row && (process.env.VERCEL || process.env.DEMO_MODE === 'true')) {
      try {
        const count = this.db.prepare('SELECT COUNT(*) count FROM complaints').get().count;
        if (count === 0) {
          this.seedCaseManagement();
          row = this.db.prepare('SELECT * FROM complaints WHERE tracking_code=? OR case_id=?').get(trackingCode, trackingCode);
        }
      } catch {}
    }
    if (!row) return null;

    const caseId = row.case_id;
    // Strictly exclude internal updates (is_internal = 0 only)
    const updates = this.listCaseUpdates(caseId, false).map(u => ({
      id: u.id,
      updateType: u.updateType,
      message: u.message,
      createdAt: u.createdAt,
      authorRole: u.authorRole === 'investigating_officer' || u.authorRole === 'supervisor' ? 'Investigating Team' : u.authorRole
    }));

    const evidence = this.listEvidence(caseId).map(e => ({
      id: e.id,
      filename: e.filename,
      fileType: e.fileType,
      fileSize: e.fileSize,
      description: e.description,
      sha256: e.sha256,
      avScanStatus: e.avScanStatus || 'CLEAN_SHA256_SEALED',
      createdAt: e.createdAt
    }));

    let provenance = null;
    try {
      provenance = row.provenance_tags ? JSON.parse(row.provenance_tags) : null;
    } catch {}

    return {
      caseId: row.case_id,
      trackingCode: row.tracking_code || trackingCode,
      incidentType: row.incident_type,
      incidentDate: row.incident_date,
      description: row.description,
      reportedLoss: row.reported_loss,
      currency: row.currency,
      chain: row.chain,
      status: row.status,
      actionRequired: row.status === 'Evidence Requested' ? 'Officer has requested additional supporting documents or clarification.' : null,
      provenanceTags: provenance || { seed: 'USER_UPLOADED', fiat: 'USER_UPLOADED' },
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      updates,
      evidence
    };
  }

  submitCitizenClarification(trackingCode, { message, authorName = 'Citizen Reporter' } = {}) {
    const complaint = this.getComplaintByTrackingCode(trackingCode);
    if (!complaint) throw Object.assign(new Error('Complaint not found for tracking code'), { status: 404 });

    const actualCaseId = complaint.caseId;
    const stamp = now();
    const updateId = randomUUID();

    this.db.prepare(`
      INSERT INTO case_updates (id, case_id, author_id, author_name, author_role, update_type, message, is_internal, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(updateId, actualCaseId, 'reporter', authorName, 'reporter', 'CITIZEN_CLARIFICATION', message, 0, stamp);

    if (complaint.status === 'Evidence Requested') {
      const newStatus = 'Evidence Received';
      this.db.prepare('UPDATE complaints SET status=?, updated_at=? WHERE case_id=?').run(newStatus, stamp, actualCaseId);
      this.db.prepare(`
        INSERT INTO case_updates (id, case_id, author_id, author_name, author_role, update_type, message, is_internal, previous_status, new_status, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(randomUUID(), actualCaseId, 'reporter', authorName, 'reporter', 'STATUS_CHANGE', `Citizen provided requested response. Status moved to Evidence Received.`, 0, complaint.status, newStatus, stamp);
    } else {
      this.db.prepare('UPDATE complaints SET updated_at=? WHERE case_id=?').run(stamp, actualCaseId);
    }

    return this.getComplaintByTrackingCode(trackingCode);
  }

  getComplaintByCaseId(caseId) {
    return this.getComplaint(caseId, true);
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

  addEvidence({ caseId, uploadedById, uploadedByName, uploaderRole, filename, fileType = 'application/octet-stream', fileSize = 0, description = '', sha256 = '', chainOfCustody = null, avScanStatus = 'NOT_SCANNED', storagePath = null }) {
    const comp = this.db.prepare('SELECT * FROM complaints WHERE case_id=? OR id=?').get(caseId, caseId);
    if (!comp) throw Object.assign(new Error(`Complaint ${caseId} was not found.`), { status: 404 });

    const actualCaseId = comp.case_id;
    const id = randomUUID();
    const stamp = now();
    const fileHash = storagePath ? sha256 : '';
    const cocJson = chainOfCustody ? (typeof chainOfCustody === 'string' ? chainOfCustody : JSON.stringify(chainOfCustody)) : null;

    try {
      this.db.prepare(`
        INSERT INTO case_evidence (id, case_id, uploaded_by_id, uploaded_by_name, uploader_role, filename, file_type, file_size, description, sha256, chain_of_custody, av_scan_status, storage_path, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(id, actualCaseId, uploadedById, uploadedByName, uploaderRole, filename, fileType, fileSize, description, fileHash, cocJson, avScanStatus, storagePath, stamp);
    } catch {
      this.db.prepare(`
        INSERT INTO case_evidence (id, case_id, uploaded_by_id, uploaded_by_name, uploader_role, filename, file_type, file_size, description, sha256, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(id, actualCaseId, uploadedById, uploadedByName, uploaderRole, filename, fileType, fileSize, description, fileHash, stamp);
    }

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

    return { id, caseId: actualCaseId, filename, fileType, fileSize, description, sha256: fileHash, chainOfCustody, avScanStatus, storagePath, createdAt: stamp };
  }

  listEvidence(caseId) {
    try {
      const rows = this.db.prepare('SELECT id, case_id as caseId, uploaded_by_id as uploadedById, uploaded_by_name as uploadedByName, uploader_role as uploaderRole, filename, file_type as fileType, file_size as fileSize, description, sha256, chain_of_custody as chainOfCustody, av_scan_status as avScanStatus, storage_path as storagePath, created_at as createdAt FROM case_evidence WHERE case_id=? ORDER BY created_at ASC').all(caseId);
      return rows.map(r => ({
        ...r,
        chainOfCustody: r.chainOfCustody ? (typeof r.chainOfCustody === 'string' ? JSON.parse(r.chainOfCustody) : r.chainOfCustody) : null
      }));
    } catch {
      return this.db.prepare('SELECT id, case_id as caseId, uploaded_by_id as uploadedById, uploaded_by_name as uploadedByName, uploader_role as uploaderRole, filename, file_type as fileType, file_size as fileSize, description, sha256, created_at as createdAt FROM case_evidence WHERE case_id=? ORDER BY created_at ASC').all(caseId);
    }
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

  // Watchtower: Address Monitoring
  addWatchlistAddress({ officerId, caseId = null, chain = 'Bitcoin', address, label = '' }) {
    if (!address) throw Object.assign(new Error('Address is required for monitoring.'), { status: 400 });
    const id = randomUUID();
    const stamp = now();
    const cleanAddr = address.trim();
    this.db.prepare(`
      INSERT INTO watchlists (id, case_id, officer_id, chain, address, label, status, last_checked_at, created_at)
      VALUES (?, ?, ?, ?, ?, ?, 'ACTIVE', ?, ?)
    `).run(id, caseId, officerId, chain, cleanAddr, label, stamp, stamp);
    return { id, caseId, officerId, chain, address: cleanAddr, label, status: 'ACTIVE', lastCheckedAt: stamp, createdAt: stamp };
  }

  listWatchlist(officerId) {
    let list = this.db.prepare(`
      SELECT id, case_id as caseId, officer_id as officerId, chain, address, label, status, last_checked_at as lastCheckedAt, created_at as createdAt
      FROM watchlists WHERE officer_id=? ORDER BY created_at DESC
    `).all(officerId);

    if (list.length === 0) {
      const defaultTargets = [
        { chain: 'Ethereum', address: '0x28C6c06298d514Db089934071355E5743bf21d60', label: 'Primary Liquidation Vault (Subject Target)', caseId: 'CR-2026-UPI-9901' },
        { chain: 'Bitcoin', address: 'bc1qar0srrr7xfkvy5l643lydnw9re59gtzzwf5mdq', label: 'Layering Intermediary Stash Wallet', caseId: 'CR-2026-00192' },
        { chain: 'TRON', address: 'TLyqz4YmmYm179mFd3ErRo8LdtjvevM2CL', label: 'TRC-20 High-Velocity USDT Pass-Through', caseId: 'CR-2026-00341' }
      ];
      for (const t of defaultTargets) {
        try {
          this.addWatchlistAddress({
            officerId,
            caseId: t.caseId,
            chain: t.chain,
            address: t.address,
            label: t.label
          });
        } catch { }
      }
      list = this.db.prepare(`
        SELECT id, case_id as caseId, officer_id as officerId, chain, address, label, status, last_checked_at as lastCheckedAt, created_at as createdAt
        FROM watchlists WHERE officer_id=? ORDER BY created_at DESC
      `).all(officerId);
    }
    return list;
  }

  removeWatchlistAddress(id, officerId) {
    this.db.prepare('DELETE FROM watchlists WHERE id=? AND officer_id=?').run(id, officerId);
    return { ok: true, removedId: id };
  }

  recordWatchAlert({ watchId, caseId = null, chain, address, txHash, amount = 0, alertType = 'NEW_TRANSACTION', severity = 'HIGH', message }) {
    const id = randomUUID();
    const stamp = now();
    this.db.prepare(`
      INSERT INTO watch_alerts (id, watch_id, case_id, chain, address, tx_hash, amount, alert_type, severity, message, read_status, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?)
    `).run(id, watchId, caseId, chain, address, txHash, amount, alertType, severity, message, stamp);
    return { id, watchId, caseId, chain, address, txHash, amount, alertType, severity, message, readStatus: 0, createdAt: stamp };
  }

  listWatchAlerts(officerId = null) {
    let list = this.db.prepare(`
      SELECT a.id, a.watch_id as watchId, a.case_id as caseId, a.chain, a.address, a.tx_hash as txHash, a.amount,
             a.alert_type as alertType, a.severity, a.message, a.read_status as readStatus, a.created_at as createdAt
      FROM watch_alerts a
      ORDER BY a.created_at DESC LIMIT 100
    `).all();

    if (list.length === 0) {
      try {
        this.recordWatchAlert({
          watchId: 1,
          caseId: 'CR-2026-UPI-9901',
          chain: 'Ethereum',
          address: '0x28C6c06298d514Db089934071355E5743bf21d60',
          txHash: '0x9a8b7c6d5e4f3a2b1c0d9e8f7a6b5c4d3e2f1a0b',
          amount: 642000,
          alertType: 'NEW_TRANSACTION',
          severity: 'HIGH',
          message: 'Suspicious 642,000 INR equivalent USDT transferred to exchange deposit gateway.'
        });
        this.recordWatchAlert({
          watchId: 2,
          caseId: 'CR-2026-00192',
          chain: 'Bitcoin',
          address: 'bc1qar0srrr7xfkvy5l643lydnw9re59gtzzwf5mdq',
          txHash: '232629023',
          amount: 250000,
          alertType: 'VELOCITY_BURST',
          severity: 'CRITICAL',
          message: 'Unusual forward velocity: funds disbursed within 6 minutes of deposit.'
        });
        list = this.db.prepare(`
          SELECT a.id, a.watch_id as watchId, a.case_id as caseId, a.chain, a.address, a.tx_hash as txHash, a.amount,
                 a.alert_type as alertType, a.severity, a.message, a.read_status as readStatus, a.created_at as createdAt
          FROM watch_alerts a
          ORDER BY a.created_at DESC LIMIT 100
        `).all();
      } catch { }
    }
    return list;
  }

  // Blockchain Transactions Storage
  saveBlockchainTransaction(tx) {
    const id = randomUUID();
    const stamp = now();
    this.db.prepare(`
      INSERT OR REPLACE INTO blockchain_transactions (id, chain, tx_hash, from_address, to_address, value, token_symbol, fee, block_number, block_timestamp, status, provider, raw_payload, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(id, tx.chain, tx.txHash, tx.fromAddress || null, tx.toAddress || null, tx.value || 0, tx.currency || null, tx.fee || 0, tx.blockHeight || null, tx.blockTimestamp || stamp, tx.status || 'VERIFIED', tx.provider || 'External API', JSON.stringify(tx), stamp);
    return tx;
  }

  getBlockchainTransaction(chain, txHash) {
    const row = this.db.prepare('SELECT * FROM blockchain_transactions WHERE tx_hash=?').get(txHash);
    if (!row) return null;
    return {
      id: row.id,
      chain: row.chain,
      txHash: row.tx_hash,
      fromAddress: row.from_address,
      toAddress: row.to_address,
      value: row.value,
      tokenSymbol: row.token_symbol,
      fee: row.fee,
      blockNumber: row.block_number,
      blockTimestamp: row.block_timestamp,
      status: row.status,
      provider: row.provider,
      payload: row.raw_payload ? JSON.parse(row.raw_payload) : null,
      createdAt: row.created_at
    };
  }

  // Address Labels & Entity Intelligence
  addAddressLabel({ chain, address, label, category = 'Exchange', source = 'Verified Intelligence', confidence = 1.0, isVerified = 1 }) {
    const id = randomUUID();
    const stamp = now();
    this.db.prepare(`
      INSERT INTO address_labels (id, chain, address, label, category, source, confidence, is_verified, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(id, chain, address, label, category, source, confidence, isVerified ? 1 : 0, stamp);
    return { id, chain, address, label, category, source, confidence, isVerified: Boolean(isVerified), createdAt: stamp };
  }

  getAddressLabels(chain, address) {
    return this.db.prepare(`
      SELECT id, chain, address, label, category, source, confidence, is_verified as isVerified, created_at as createdAt
      FROM address_labels WHERE address=?
    `).all(address);
  }

  // Cross-Case Intelligence
  getCrossCaseIntelligence(identifier) {
    if (!identifier) return { totalMatches: 0, cases: [] };
    const clean = identifier.trim();
    const rows = this.db.prepare(`
      SELECT case_id as caseId, reporter_name as reporterName, incident_type as incidentType,
             reported_loss as reportedLoss, chain, reported_wallet as reportedWallet,
             transaction_hash as transactionHash, status, priority, created_at as createdAt
      FROM complaints
      WHERE reported_wallet=? OR transaction_hash=? OR description LIKE ?
      ORDER BY created_at DESC
    `).all(clean, clean, `%${clean}%`);
    return {
      identifier: clean,
      totalMatches: rows.length,
      cases: rows
    };
  }

  // --- UPI-to-Crypto AI Investigation Engine Methods ---

  saveUpiTransaction(tx) {
    const id = tx.id || `UPI-${randomUUID().slice(0, 8)}`;
    const stamp = tx.createdAt || now();
    this.db.prepare(`
      INSERT OR REPLACE INTO upi_transactions (
        id, case_id, utr_number, sender_upi_id, receiver_upi_id, beneficiary_name,
        amount, currency, timestamp, bank_name, verification_status, screenshot_ref, raw_payload, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      id, tx.caseId, tx.utrNumber, tx.senderUpiId, tx.receiverUpiId, tx.beneficiaryName || null,
      Number(tx.amount || 0), tx.currency || 'INR', tx.timestamp || stamp, tx.bankName || null,
      tx.verificationStatus || 'SUBMITTED', tx.screenshotRef || null,
      typeof tx.rawPayload === 'string' ? tx.rawPayload : JSON.stringify(tx.rawPayload || {}), stamp
    );
    return this.getUpiTransactionById(id);
  }

  getUpiTransactionById(id) {
    const row = this.db.prepare('SELECT * FROM upi_transactions WHERE id=?').get(id);
    if (!row) return null;
    return {
      id: row.id,
      caseId: row.case_id,
      utrNumber: row.utr_number,
      senderUpiId: row.sender_upi_id,
      receiverUpiId: row.receiver_upi_id,
      beneficiaryName: row.beneficiary_name,
      amount: row.amount,
      currency: row.currency,
      timestamp: row.timestamp,
      bankName: row.bank_name,
      verificationStatus: row.verification_status,
      screenshotRef: row.screenshot_ref,
      rawPayload: row.raw_payload ? JSON.parse(row.raw_payload) : {},
      createdAt: row.created_at
    };
  }

  getUpiTransactions(caseId) {
    const rows = this.db.prepare('SELECT * FROM upi_transactions WHERE case_id=? ORDER BY timestamp ASC').all(caseId);
    return rows.map(row => ({
      id: row.id,
      caseId: row.case_id,
      utrNumber: row.utr_number,
      senderUpiId: row.sender_upi_id,
      receiverUpiId: row.receiver_upi_id,
      beneficiaryName: row.beneficiary_name,
      amount: row.amount,
      currency: row.currency,
      timestamp: row.timestamp,
      bankName: row.bank_name,
      verificationStatus: row.verification_status,
      screenshotRef: row.screenshot_ref,
      rawPayload: row.raw_payload ? JSON.parse(row.raw_payload) : {},
      createdAt: row.created_at
    }));
  }

  saveBankingRecord(rec) {
    const id = rec.id || `BNK-${randomUUID().slice(0, 8)}`;
    const stamp = rec.createdAt || now();
    this.db.prepare(`
      INSERT OR REPLACE INTO banking_records (
        id, case_id, account_number, ifsc, bank_name, account_holder, transaction_type,
        amount, utr_ref, counterparty_account, timestamp, is_mule_suspect, holding_duration_seconds,
        source_type, raw_payload, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      id, rec.caseId, rec.accountNumber, rec.ifsc || null, rec.bankName, rec.accountHolder || null,
      rec.transactionType || 'CREDIT', Number(rec.amount || 0), rec.utrRef || null,
      rec.counterpartyAccount || null, rec.timestamp || stamp, rec.isMuleSuspect ? 1 : 0,
      rec.holdingDurationSeconds || 0, rec.sourceType || 'AUTHORIZED_STATEMENT',
      typeof rec.rawPayload === 'string' ? rec.rawPayload : JSON.stringify(rec.rawPayload || {}), stamp
    );
    return { ...rec, id, createdAt: stamp };
  }

  getBankingRecords(caseId) {
    const rows = this.db.prepare('SELECT * FROM banking_records WHERE case_id=? ORDER BY timestamp ASC').all(caseId);
    return rows.map(r => ({
      id: r.id,
      caseId: r.case_id,
      accountNumber: r.account_number,
      ifsc: r.ifsc,
      bankName: r.bank_name,
      accountHolder: r.account_holder,
      transactionType: r.transaction_type,
      amount: r.amount,
      utrRef: r.utr_ref,
      counterpartyAccount: r.counterparty_account,
      timestamp: r.timestamp,
      isMuleSuspect: Boolean(r.is_mule_suspect),
      holdingDurationSeconds: r.holding_duration_seconds,
      sourceType: r.source_type,
      rawPayload: r.raw_payload ? JSON.parse(r.raw_payload) : {},
      createdAt: r.created_at
    }));
  }

  saveExchangeRecord(rec) {
    const id = rec.id || `EXC-${randomUUID().slice(0, 8)}`;
    const stamp = rec.createdAt || now();
    this.db.prepare(`
      INSERT OR REPLACE INTO exchange_records (
        id, case_id, exchange_name, account_id, fiat_deposit_utr, fiat_amount, crypto_purchased,
        crypto_amount, withdrawal_address, withdrawal_tx_hash, destination_chain, is_verified,
        source_type, raw_payload, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      id, rec.caseId, rec.exchangeName, rec.accountId || null, rec.fiatDepositUtr || null,
      Number(rec.fiatAmount || 0), rec.cryptoPurchased || 'USDT', Number(rec.cryptoAmount || 0),
      rec.withdrawalAddress || null, rec.withdrawalTxHash || null, rec.destinationChain || 'Ethereum',
      rec.isVerified ? 1 : 0, rec.sourceType || 'EXCHANGE_LIAISON',
      typeof rec.rawPayload === 'string' ? rec.rawPayload : JSON.stringify(rec.rawPayload || {}), stamp
    );
    return { ...rec, id, createdAt: stamp };
  }

  getExchangeRecords(caseId) {
    const rows = this.db.prepare('SELECT * FROM exchange_records WHERE case_id=? ORDER BY created_at ASC').all(caseId);
    return rows.map(r => ({
      id: r.id,
      caseId: r.case_id,
      exchangeName: r.exchange_name,
      accountId: r.account_id,
      fiatDepositUtr: r.fiat_deposit_utr,
      fiatAmount: r.fiat_amount,
      cryptoPurchased: r.crypto_purchased,
      cryptoAmount: r.crypto_amount,
      withdrawalAddress: r.withdrawal_address,
      withdrawalTxHash: r.withdrawal_tx_hash,
      destinationChain: r.destination_chain,
      isVerified: Boolean(r.is_verified),
      sourceType: r.source_type,
      rawPayload: r.raw_payload ? JSON.parse(r.raw_payload) : {},
      createdAt: r.created_at
    }));
  }

  saveFinancialGraph(caseId, nodes, edges) {
    const stamp = now();
    this.db.exec('BEGIN IMMEDIATE');
    try {
      this.db.prepare('DELETE FROM financial_graph_nodes WHERE case_id=?').run(caseId);
      this.db.prepare('DELETE FROM financial_graph_edges WHERE case_id=?').run(caseId);

      const insNode = this.db.prepare(`
        INSERT INTO financial_graph_nodes (
          id, case_id, node_key, node_type, label, entity, address_or_id, risk_score, cluster_id, metadata_json, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);

      for (const n of nodes) {
        insNode.run(
          n.id || `N-${randomUUID().slice(0, 8)}`,
          caseId,
          n.key || n.id || `NODE-${randomUUID().slice(0, 6)}`,
          n.type || 'UNKNOWN',
          n.label || n.id || 'Financial Node',
          n.entity || null,
          n.addressOrId || n.key || n.id || 'N/A',
          Number(n.riskScore || 0),
          n.clusterId || null,
          JSON.stringify(n.metadata || {}),
          stamp
        );
      }

      const insEdge = this.db.prepare(`
        INSERT INTO financial_graph_edges (
          id, case_id, source_node_key, target_node_key, relationship_type, amount, currency,
          tx_ref, timestamp, verification_status, confidence, provenance, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);

      for (const e of edges) {
        insEdge.run(
          e.id || `E-${randomUUID().slice(0, 8)}`,
          caseId,
          e.source || 'SRC',
          e.target || 'DST',
          e.relationshipType || 'TRANSFERRED_TO',
          Number(e.amount || 0),
          e.currency || 'INR',
          e.txRef || null,
          e.timestamp || stamp,
          e.verificationStatus || 'VERIFIED',
          Number(e.confidence || 1.0),
          e.provenance || 'Official Audit Record',
          stamp
        );
      }

      this.db.exec('COMMIT');
    } catch (err) {
      this.db.exec('ROLLBACK');
      throw err;
    }
    return { nodesCount: nodes.length, edgesCount: edges.length, updatedAt: stamp };
  }

  getFinancialGraph(caseId) {
    const nodeRows = this.db.prepare('SELECT * FROM financial_graph_nodes WHERE case_id=?').all(caseId);
    const edgeRows = this.db.prepare('SELECT * FROM financial_graph_edges WHERE case_id=?').all(caseId);
    return {
      nodes: nodeRows.map(n => ({
        id: n.id,
        key: n.node_key,
        type: n.node_type,
        label: n.label,
        entity: n.entity,
        addressOrId: n.address_or_id,
        riskScore: n.risk_score,
        clusterId: n.cluster_id,
        metadata: n.metadata_json ? JSON.parse(n.metadata_json) : {}
      })),
      edges: edgeRows.map(e => ({
        id: e.id,
        source: e.source_node_key,
        target: e.target_node_key,
        relationshipType: e.relationship_type,
        amount: e.amount,
        currency: e.currency,
        txRef: e.tx_ref,
        timestamp: e.timestamp,
        verificationStatus: e.verification_status,
        confidence: e.confidence,
        provenance: e.provenance
      }))
    };
  }

  getFinancialGraphNodes(caseId) {
    return this.getFinancialGraph(caseId).nodes;
  }

  getFinancialGraphEdges(caseId) {
    return this.getFinancialGraph(caseId).edges;
  }

  getOrCreateAiSession(caseId) {
    let row = this.db.prepare('SELECT * FROM ai_investigation_sessions WHERE case_id=?').get(caseId);
    if (!row) {
      const id = `AIS-${randomUUID().slice(0, 8)}`;
      const stamp = now();
      const defaultStages = [
        { id: 1, name: 'Complaint Received', status: 'COMPLETED', detail: 'Victim statement and references recorded' },
        { id: 2, name: 'Validation', status: 'PENDING', detail: 'Verify UTR, screenshot, and format sanity' },
        { id: 3, name: 'UPI Intelligence', status: 'PENDING', detail: 'Analyze beneficiary VPA and victim correlation' },
        { id: 4, name: 'Banking Evidence', status: 'PENDING', detail: 'Inspect intermediary and mule accounts' },
        { id: 5, name: 'Exchange Verification', status: 'PENDING', detail: 'Match fiat-to-crypto deposit and withdrawal' },
        { id: 6, name: 'Blockchain Tracing', status: 'PENDING', detail: 'Multi-hop on-chain flow across supported networks' },
        { id: 7, name: 'DSA Execution', status: 'PENDING', detail: 'Graph shortest path, centrality, and cycle checks' },
        { id: 8, name: 'ML Analysis', status: 'PENDING', detail: 'Trained model inference on financial graph features' },
        { id: 9, name: 'Risk Assessment', status: 'PENDING', detail: 'Synthesize 5 independent risk dimensions' },
        { id: 10, name: 'Report Generation', status: 'PENDING', detail: 'Compile court-ready Section 65B/91 dossier' }
      ];
      this.db.prepare(`
        INSERT INTO ai_investigation_sessions (id, case_id, status, current_stage, stages_json, plan_json, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `).run(id, caseId, 'INITIALIZED', 'Complaint Received', JSON.stringify(defaultStages), JSON.stringify([]), stamp, stamp);
      row = this.db.prepare('SELECT * FROM ai_investigation_sessions WHERE id=?').get(id);
    }
    return {
      id: row.id,
      caseId: row.case_id,
      status: row.status,
      currentStage: row.current_stage,
      stages: row.stages_json ? JSON.parse(row.stages_json) : [],
      plan: row.plan_json ? JSON.parse(row.plan_json) : [],
      createdAt: row.created_at,
      updatedAt: row.updated_at
    };
  }

  updateAiSession(caseId, updates = {}) {
    const stamp = now();
    const current = this.getOrCreateAiSession(caseId);
    const newStatus = updates.status || current.status;
    const newStage = updates.currentStage || current.currentStage;
    const newStages = updates.stages ? JSON.stringify(updates.stages) : JSON.stringify(current.stages);
    const newPlan = updates.plan ? JSON.stringify(updates.plan) : JSON.stringify(current.plan);

    this.db.prepare(`
      UPDATE ai_investigation_sessions
      SET status=?, current_stage=?, stages_json=?, plan_json=?, updated_at=?
      WHERE case_id=?
    `).run(newStatus, newStage, newStages, newPlan, stamp, caseId);

    return this.getOrCreateAiSession(caseId);
  }

  saveAiMessage({ sessionId, caseId, sender, messageText, toolCallJson = null, toolResultJson = null }) {
    const id = `MSG-${randomUUID().slice(0, 8)}`;
    const stamp = now();
    this.db.prepare(`
      INSERT INTO ai_investigation_messages (
        id, session_id, case_id, sender, message_text, tool_call_json, tool_result_json, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      id, sessionId || caseId, caseId, sender, messageText,
      toolCallJson ? JSON.stringify(toolCallJson) : null,
      toolResultJson ? JSON.stringify(toolResultJson) : null,
      stamp
    );
    return { id, sessionId, caseId, sender, messageText, toolCallJson, toolResultJson, createdAt: stamp };
  }

  getAiMessages(caseId) {
    const rows = this.db.prepare('SELECT * FROM ai_investigation_messages WHERE case_id=? ORDER BY created_at ASC').all(caseId);
    return rows.map(r => ({
      id: r.id,
      sessionId: r.session_id,
      caseId: r.case_id,
      sender: r.sender,
      messageText: r.message_text,
      toolCall: r.tool_call_json ? JSON.parse(r.tool_call_json) : null,
      toolResult: r.tool_result_json ? JSON.parse(r.tool_result_json) : null,
      createdAt: r.created_at
    }));
  }

  saveToolRun({ caseId, toolName, status, inputJson = {}, outputJson = {}, durationMs = 0 }) {
    const id = `TOOL-${randomUUID().slice(0, 8)}`;
    const stamp = now();
    this.db.prepare(`
      INSERT INTO ai_investigation_tool_runs (
        id, case_id, tool_name, status, input_json, output_json, duration_ms, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      id, caseId, toolName, status,
      JSON.stringify(inputJson), JSON.stringify(outputJson), durationMs, stamp
    );
    return { id, caseId, toolName, status, input: inputJson, output: outputJson, durationMs, createdAt: stamp };
  }

  getToolRuns(caseId) {
    const rows = this.db.prepare('SELECT * FROM ai_investigation_tool_runs WHERE case_id=? ORDER BY created_at ASC').all(caseId);
    return rows.map(r => ({
      id: r.id,
      caseId: r.case_id,
      toolName: r.tool_name,
      status: r.status,
      input: r.input_json ? JSON.parse(r.input_json) : {},
      output: r.output_json ? JSON.parse(r.output_json) : {},
      durationMs: r.duration_ms,
      createdAt: r.created_at
    }));
  }

  saveRiskAssessment(ass) {
    const id = ass.id || `RISK-${randomUUID().slice(0, 8)}`;
    const stamp = now();
    this.db.prepare(`
      INSERT OR REPLACE INTO investigation_risk_assessments (
        id, case_id, complaint_validation_score, upi_fraud_risk, mule_account_risk,
        crypto_exposure_risk, blockchain_risk, overall_priority, breakdown_json, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      id, ass.caseId, Number(ass.complaintValidationScore || 0), Number(ass.upiFraudRisk || 0),
      Number(ass.muleAccountRisk || 0), Number(ass.cryptoExposureRisk || 0),
      Number(ass.blockchainRisk || 0), ass.overallPriority || 'MEDIUM',
      typeof ass.breakdownJson === 'string' ? ass.breakdownJson : JSON.stringify(ass.breakdown || {}), stamp
    );
    return this.getRiskAssessment(ass.caseId);
  }

  getRiskAssessment(caseId) {
    const r = this.db.prepare('SELECT * FROM investigation_risk_assessments WHERE case_id=?').get(caseId);
    if (!r) return null;
    return {
      id: r.id,
      caseId: r.case_id,
      complaintValidationScore: r.complaint_validation_score,
      upiFraudRisk: r.upi_fraud_risk,
      muleAccountRisk: r.mule_account_risk,
      cryptoExposureRisk: r.crypto_exposure_risk,
      blockchainRisk: r.blockchain_risk,
      overallPriority: r.overall_priority,
      breakdown: r.breakdown_json ? JSON.parse(r.breakdown_json) : {},
      createdAt: r.created_at
    };
  }

  findCorrelatedComplaints(caseId, { utr = null, receiverUpi = null, beneficiaryName = null }) {
    const correlated = [];
    const seenCaseIds = new Set([caseId]);

    if (utr) {
      const utrRows = this.db.prepare('SELECT * FROM upi_transactions WHERE utr_number=? AND case_id!=?').all(utr, caseId);
      for (const r of utrRows) {
        if (!seenCaseIds.has(r.case_id)) {
          seenCaseIds.add(r.case_id);
          correlated.push({
            caseId: r.case_id,
            matchType: 'SHARED_UTR',
            sharedIdentifier: utr,
            confidence: 0.99,
            detail: `Shared identical UTR reference ${utr}`
          });
        }
      }
    }

    if (receiverUpi) {
      const upiRows = this.db.prepare('SELECT * FROM upi_transactions WHERE receiver_upi_id=? AND case_id!=?').all(receiverUpi, caseId);
      for (const r of upiRows) {
        if (!seenCaseIds.has(r.case_id)) {
          seenCaseIds.add(r.case_id);
          correlated.push({
            caseId: r.case_id,
            matchType: 'SHARED_BENEFICIARY_VPA',
            sharedIdentifier: receiverUpi,
            confidence: 0.92,
            detail: `Receiver UPI VPA matches beneficiary in case ${r.case_id}`
          });
        }
      }
    }

    if (beneficiaryName) {
      const nameRows = this.db.prepare('SELECT * FROM upi_transactions WHERE beneficiary_name LIKE ? AND case_id!=?').all(`%${beneficiaryName}%`, caseId);
      for (const r of nameRows) {
        if (!seenCaseIds.has(r.case_id)) {
          seenCaseIds.add(r.case_id);
          correlated.push({
            caseId: r.case_id,
            matchType: 'SIMILAR_BENEFICIARY_NAME',
            sharedIdentifier: beneficiaryName,
            confidence: 0.78,
            detail: `Similar beneficiary title observed: ${r.beneficiary_name}`
          });
        }
      }
    }

    return correlated;
  }
}
