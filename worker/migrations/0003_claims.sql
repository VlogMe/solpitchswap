CREATE TABLE IF NOT EXISTS claim_nonces (
  nonce TEXT PRIMARY KEY,
  project_id TEXT NOT NULL,
  wallet_address TEXT NOT NULL,
  message TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  used_at TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_claim_nonces_expires_at ON claim_nonces(expires_at);

CREATE TABLE IF NOT EXISTS claim_requests (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL,
  wallet_address TEXT NOT NULL,
  signature TEXT NOT NULL,
  signed_message TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','rejected')),
  evidence_url TEXT,
  submitter_email TEXT,
  reviewer_notes TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  reviewed_at TEXT,
  UNIQUE(project_id, wallet_address, status)
);

CREATE INDEX IF NOT EXISTS idx_claim_requests_status_created_at ON claim_requests(status, created_at DESC);

CREATE TABLE IF NOT EXISTS project_owners (
  project_id TEXT PRIMARY KEY,
  wallet_address TEXT NOT NULL,
  verified_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  claim_request_id TEXT NOT NULL
);
