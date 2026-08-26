CREATE TABLE IF NOT EXISTS spotlight_snapshots (
  week_key TEXT NOT NULL,
  rank INTEGER NOT NULL CHECK (rank BETWEEN 1 AND 3),
  project_id TEXT NOT NULL,
  period_votes INTEGER NOT NULL,
  slug TEXT NOT NULL,
  name TEXT NOT NULL,
  symbol TEXT NOT NULL,
  contract_address TEXT NOT NULL,
  project_status TEXT NOT NULL,
  claim_status TEXT NOT NULL,
  pitch TEXT NOT NULL,
  description TEXT NOT NULL,
  website TEXT,
  x_url TEXT,
  telegram_url TEXT,
  logo_url TEXT,
  added_to_swap INTEGER NOT NULL DEFAULT 0,
  promoted INTEGER NOT NULL DEFAULT 0,
  x_user_id TEXT,
  x_username TEXT,
  published_at TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(week_key, rank)
);

CREATE INDEX IF NOT EXISTS idx_spotlight_snapshots_week
ON spotlight_snapshots(week_key, rank);
