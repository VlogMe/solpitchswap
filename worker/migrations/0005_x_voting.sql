CREATE TABLE IF NOT EXISTS x_voter_profiles (
  x_user_id TEXT PRIMARY KEY,
  x_username TEXT,
  x_account_created_at TEXT NOT NULL,
  checked_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS x_votes (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL,
  x_user_id TEXT NOT NULL,
  week_key TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(project_id, x_user_id, week_key)
);

CREATE INDEX IF NOT EXISTS idx_x_votes_week_project
ON x_votes(week_key, project_id);

CREATE TABLE IF NOT EXISTS x_voting_state (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);

INSERT OR IGNORE INTO x_voting_state (key, value)
VALUES ('phase1_cutover', 'pending');

UPDATE projects
SET votes = 0, updated_at = CURRENT_TIMESTAMP
WHERE EXISTS (
  SELECT 1 FROM x_voting_state
  WHERE key = 'phase1_cutover' AND value = 'pending'
);

UPDATE x_voting_state
SET value = CURRENT_TIMESTAMP
WHERE key = 'phase1_cutover' AND value = 'pending';
