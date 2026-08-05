CREATE TABLE IF NOT EXISTS vote_nonces (
  nonce TEXT PRIMARY KEY,
  project_id TEXT NOT NULL,
  wallet_address TEXT NOT NULL,
  message TEXT NOT NULL,
  week_key TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  used_at TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_vote_nonces_expires_at
ON vote_nonces(expires_at);

CREATE TABLE IF NOT EXISTS wallet_votes (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL,
  wallet_address TEXT NOT NULL,
  week_key TEXT NOT NULL,
  signature TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(project_id, wallet_address, week_key)
);

CREATE INDEX IF NOT EXISTS idx_wallet_votes_week_project
ON wallet_votes(week_key, project_id);

CREATE TABLE IF NOT EXISTS activity_events (
  id TEXT PRIMARY KEY,
  project_id TEXT,
  event_type TEXT NOT NULL,
  event_text TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_activity_events_created_at
ON activity_events(created_at DESC);
