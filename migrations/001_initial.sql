PRAGMA foreign_keys = ON;
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
);
