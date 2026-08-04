PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS submissions (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  symbol TEXT NOT NULL,
  contract_address TEXT NOT NULL UNIQUE,
  pitch TEXT NOT NULL,
  description TEXT NOT NULL,
  website TEXT,
  x_url TEXT,
  telegram_url TEXT,
  graduation_proof_url TEXT NOT NULL,
  submitter_email TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','rejected')),
  reviewer_notes TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  reviewed_at TEXT
);

CREATE INDEX IF NOT EXISTS idx_submissions_status_created_at
ON submissions(status, created_at DESC);

CREATE TABLE IF NOT EXISTS admin_sessions (
  token_hash TEXT PRIMARY KEY,
  expires_at TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_admin_sessions_expires_at
ON admin_sessions(expires_at);
