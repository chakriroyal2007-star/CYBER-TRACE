-- PostgreSQL 16 Schema for CYBER-TRACE Production Platform

CREATE TABLE IF NOT EXISTS schema_migrations (
  version INTEGER PRIMARY KEY,
  applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  display_name TEXT NOT NULL,
  role TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS sessions (
  id TEXT PRIMARY KEY,
  token_hash TEXT NOT NULL UNIQUE,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL,
  weights JSONB
);
CREATE INDEX IF NOT EXISTS idx_sessions_token_hash ON sessions(token_hash);
CREATE INDEX IF NOT EXISTS idx_sessions_expires ON sessions(expires_at);

CREATE TABLE IF NOT EXISTS system_users (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  display_name TEXT NOT NULL,
  role TEXT NOT NULL,
  phone TEXT,
  agency TEXT,
  badge_number TEXT,
  unit TEXT,
  totp_secret TEXT,
  status TEXT NOT NULL DEFAULT 'ACTIVE',
  failed_attempts INTEGER NOT NULL DEFAULT 0,
  locked_until TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_sys_users_email ON system_users(email);

CREATE TABLE IF NOT EXISTS officer_invitations (
  token TEXT PRIMARY KEY,
  email TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'investigating_officer',
  designation TEXT,
  unit TEXT,
  status TEXT NOT NULL DEFAULT 'PENDING',
  invited_by TEXT NOT NULL DEFAULT 'Admin',
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  accepted_at TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS idx_invitations_email ON officer_invitations(email);

CREATE TABLE IF NOT EXISTS complaints (
  id TEXT PRIMARY KEY,
  case_id TEXT NOT NULL UNIQUE,
  reporter_id TEXT NOT NULL,
  reporter_name TEXT NOT NULL,
  reporter_email TEXT NOT NULL,
  incident_type TEXT NOT NULL,
  incident_date TIMESTAMPTZ NOT NULL,
  description TEXT NOT NULL,
  reported_loss NUMERIC NOT NULL DEFAULT 0,
  currency TEXT NOT NULL DEFAULT 'INR',
  chain TEXT NOT NULL DEFAULT 'Ethereum',
  reported_wallet TEXT NOT NULL,
  transaction_hash TEXT,
  status TEXT NOT NULL DEFAULT 'Submitted',
  assigned_officer_id TEXT,
  assigned_officer_name TEXT,
  unit TEXT,
  rejection_reason TEXT,
  priority TEXT NOT NULL DEFAULT 'Medium',
  tracking_code TEXT UNIQUE,
  suspect_upi TEXT,
  suspect_phone TEXT,
  extracted_fields JSONB,
  provenance_tags JSONB,
  duplicate_alert INTEGER DEFAULT 0,
  linked_case_ids JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  payload JSONB NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_complaints_reporter ON complaints(reporter_id);
CREATE INDEX IF NOT EXISTS idx_complaints_case_id ON complaints(case_id);
CREATE INDEX IF NOT EXISTS idx_complaints_status ON complaints(status);
CREATE INDEX IF NOT EXISTS idx_complaints_officer ON complaints(assigned_officer_id);
CREATE INDEX IF NOT EXISTS idx_complaints_tracking ON complaints(tracking_code);

CREATE TABLE IF NOT EXISTS case_evidence (
  id TEXT PRIMARY KEY,
  case_id TEXT NOT NULL,
  uploaded_by_id TEXT NOT NULL,
  uploaded_by_name TEXT NOT NULL,
  uploader_role TEXT NOT NULL,
  filename TEXT NOT NULL,
  file_type TEXT NOT NULL,
  file_size BIGINT NOT NULL,
  description TEXT,
  sha256 TEXT NOT NULL,
  chain_of_custody JSONB,
  av_scan_status TEXT DEFAULT 'CLEAN_SHA256_SEALED',
  storage_path TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_case_evidence_case ON case_evidence(case_id);

CREATE TABLE IF NOT EXISTS case_freeze_requests (
  id TEXT PRIMARY KEY,
  case_id TEXT NOT NULL,
  institution_id TEXT NOT NULL,
  account_identifier TEXT NOT NULL,
  requested_amount NUMERIC NOT NULL,
  legal_basis TEXT NOT NULL,
  prepared_by_id TEXT NOT NULL,
  approved_by_id TEXT,
  status TEXT NOT NULL DEFAULT 'DRAFT',
  amount_frozen NUMERIC DEFAULT 0,
  response_reference TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_freeze_case ON case_freeze_requests(case_id);
CREATE INDEX IF NOT EXISTS idx_freeze_status ON case_freeze_requests(status);

CREATE TABLE IF NOT EXISTS audit_logs (
  id TEXT PRIMARY KEY,
  session_id TEXT,
  timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  user_id TEXT,
  action TEXT NOT NULL,
  object TEXT NOT NULL,
  metadata JSONB NOT NULL,
  prev_hash TEXT NOT NULL,
  entry_hash TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_audit_time ON audit_logs(timestamp);
CREATE INDEX IF NOT EXISTS idx_audit_prev_hash ON audit_logs(prev_hash);
CREATE INDEX IF NOT EXISTS idx_audit_entry_hash ON audit_logs(entry_hash);

CREATE TABLE IF NOT EXISTS cases (
  key TEXT PRIMARY KEY,
  session_id TEXT,
  id TEXT NOT NULL,
  complaint_id TEXT NOT NULL,
  fraud_type TEXT NOT NULL,
  chain TEXT NOT NULL,
  status TEXT NOT NULL,
  risk_score INT NOT NULL,
  victim_loss NUMERIC NOT NULL,
  reported_wallet TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL,
  record JSONB NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_cases_id ON cases(id);
CREATE INDEX IF NOT EXISTS idx_cases_session ON cases(session_id);

CREATE TABLE IF NOT EXISTS reports (
  id TEXT PRIMARY KEY,
  session_id TEXT,
  case_id TEXT NOT NULL,
  version INTEGER NOT NULL,
  created_at TIMESTAMPTZ NOT NULL,
  sha256 TEXT NOT NULL,
  filename TEXT NOT NULL,
  pdf_bytes BYTEA NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_reports_case ON reports(case_id);

