CREATE TABLE IF NOT EXISTS projects (
  id TEXT PRIMARY KEY,
  slug TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  symbol TEXT NOT NULL,
  contract_address TEXT NOT NULL UNIQUE,
  project_status TEXT NOT NULL CHECK (project_status IN ('graduated','bonding','launched','presale','upcoming')),
  claim_status TEXT NOT NULL DEFAULT 'unclaimed' CHECK (claim_status IN ('unclaimed','pending','verified','disputed')),
  pitch TEXT NOT NULL,
  description TEXT NOT NULL,
  website TEXT,
  x_url TEXT,
  telegram_url TEXT,
  logo_url TEXT,
  added_to_swap INTEGER NOT NULL DEFAULT 0,
  promoted INTEGER NOT NULL DEFAULT 0,
  votes INTEGER NOT NULL DEFAULT 0,
  published_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_projects_published_at ON projects(published_at DESC);
CREATE INDEX IF NOT EXISTS idx_projects_votes ON projects(votes DESC);
