import app from "./main";

interface Env {
  DB: D1Database;
  ALLOWED_ORIGIN?: string;
  [key: string]: unknown;
}

type SpotlightProjectRow = {
  id: string;
  slug: string;
  name: string;
  symbol: string;
  contract_address: string;
  project_status: string;
  claim_status: string;
  pitch: string;
  description: string;
  website: string | null;
  x_url: string | null;
  telegram_url: string | null;
  logo_url: string | null;
  added_to_swap: number;
  promoted: number;
  votes: number;
  x_user_id: string | null;
  x_username: string | null;
  published_at: string | null;
};

function weekKey(date = new Date()) {
  const target = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  const day = target.getUTCDay() || 7;
  target.setUTCDate(target.getUTCDate() + 4 - day);
  const yearStart = new Date(Date.UTC(target.getUTCFullYear(), 0, 1));
  const week = Math.ceil((((target.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
  return `${target.getUTCFullYear()}-W${String(week).padStart(2, "0")}`;
}

async function restoreLegacyTotals(env: Env) {
  const restored = await env.DB.prepare(
    "SELECT value FROM x_voting_state WHERE key='legacy_vote_restore_v2' LIMIT 1",
  ).first<{ value: string }>();
  if (restored) return;

  const currentWeek = weekKey();
  await env.DB.prepare(
    `UPDATE projects
     SET votes =
       (SELECT COUNT(*) FROM wallet_votes w WHERE w.project_id=projects.id) +
       (SELECT COUNT(*) FROM x_votes x WHERE x.project_id=projects.id AND x.week_key=?1),
       updated_at=CURRENT_TIMESTAMP`,
  ).bind(currentWeek).run();

  await env.DB.prepare(
    "INSERT OR REPLACE INTO x_voting_state (key,value) VALUES ('legacy_vote_restore_v2',CURRENT_TIMESTAMP)",
  ).run();
}

async function recountCombinedProject(env: Env, projectSlug: string) {
  const currentWeek = weekKey();
  const project = await env.DB.prepare(
    "SELECT id FROM projects WHERE slug=?1 LIMIT 1",
  ).bind(projectSlug).first<{ id: string }>();
  if (!project) return null;

  await env.DB.prepare(
    `UPDATE projects
     SET votes =
       (SELECT COUNT(*) FROM wallet_votes w WHERE w.project_id=?1) +
       (SELECT COUNT(*) FROM x_votes x WHERE x.project_id=?1 AND x.week_key=?2),
       updated_at=CURRENT_TIMESTAMP
     WHERE id=?1`,
  ).bind(project.id, currentWeek).run();

  return env.DB.prepare("SELECT votes FROM projects WHERE id=?1")
    .bind(project.id)
    .first<{ votes: number }>();
}

async function ensureSpotlightSchema(env: Env) {
  await env.DB.prepare(
    `CREATE TABLE IF NOT EXISTS spotlight_snapshots (
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
    )`,
  ).run();
}

async function getSpotlightRows(env: Env, currentWeek: string) {
  await ensureSpotlightSchema(env);

  const existing = await env.DB.prepare(
    `SELECT
      rank,
      period_votes,
      project_id AS id,
      slug,
      name,
      symbol,
      contract_address,
      project_status,
      claim_status,
      pitch,
      description,
      website,
      x_url,
      telegram_url,
      logo_url,
      added_to_swap,
      promoted,
      x_user_id,
      x_username,
      published_at,
      created_at
     FROM spotlight_snapshots
     WHERE week_key=?1
     ORDER BY rank ASC`,
  ).bind(currentWeek).all<Record<string, unknown>>();

  if (existing.results.length > 0) return existing.results;

  const leaders = await env.DB.prepare(
    `SELECT
      id,
      slug,
      name,
      symbol,
      contract_address,
      project_status,
      claim_status,
      pitch,
      description,
      website,
      x_url,
      telegram_url,
      logo_url,
      added_to_swap,
      promoted,
      votes,
      x_user_id,
      x_username,
      published_at
     FROM projects
     WHERE votes > 0
     ORDER BY votes DESC, published_at ASC, id ASC
     LIMIT 3`,
  ).all<SpotlightProjectRow>();

  if (leaders.results.length > 0) {
    await env.DB.batch(
      leaders.results.map((project, index) =>
        env.DB.prepare(
          `INSERT OR IGNORE INTO spotlight_snapshots (
            week_key, rank, project_id, period_votes, slug, name, symbol,
            contract_address, project_status, claim_status, pitch, description,
            website, x_url, telegram_url, logo_url, added_to_swap, promoted,
            x_user_id, x_username, published_at
          ) VALUES (
            ?1, ?2, ?3, ?4, ?5, ?6, ?7,
            ?8, ?9, ?10, ?11, ?12,
            ?13, ?14, ?15, ?16, ?17, ?18,
            ?19, ?20, ?21
          )`,
        ).bind(
          currentWeek,
          index + 1,
          project.id,
          project.votes,
          project.slug,
          project.name,
          project.symbol,
          project.contract_address,
          project.project_status,
          project.claim_status,
          project.pitch,
          project.description,
          project.website,
          project.x_url,
          project.telegram_url,
          project.logo_url,
          project.added_to_swap,
          project.promoted,
          project.x_user_id,
          project.x_username,
          project.published_at,
        ),
      ),
    );
  }

  const snapshot = await env.DB.prepare(
    `SELECT
      rank,
      period_votes,
      project_id AS id,
      slug,
      name,
      symbol,
      contract_address,
      project_status,
      claim_status,
      pitch,
      description,
      website,
      x_url,
      telegram_url,
      logo_url,
      added_to_swap,
      promoted,
      x_user_id,
      x_username,
      published_at,
      created_at
     FROM spotlight_snapshots
     WHERE week_key=?1
     ORDER BY rank ASC`,
  ).bind(currentWeek).all<Record<string, unknown>>();

  return snapshot.results;
}

function spotlightJson(request: Request, env: Env, data: unknown) {
  const headers = new Headers({
    "content-type": "application/json; charset=utf-8",
    "cache-control": "no-store",
  });
  const origin = request.headers.get("origin");
  if (origin && origin === env.ALLOWED_ORIGIN) {
    headers.set("access-control-allow-origin", origin);
    headers.set("access-control-allow-credentials", "true");
    headers.set("vary", "Origin");
  }
  return new Response(JSON.stringify(data), { status: 200, headers });
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    await restoreLegacyTotals(env);

    const url = new URL(request.url);

    if (url.pathname === "/api/spotlight" && request.method === "GET") {
      const currentWeek = weekKey();
      const projects = await getSpotlightRows(env, currentWeek);
      return spotlightJson(request, env, { weekKey: currentWeek, projects });
    }

    const isXVote = url.pathname === "/api/votes/x" && request.method === "POST";
    const voteBody = isXVote
      ? await request.clone().json<{ projectSlug?: string }>().catch(() => ({}))
      : null;

    const response = await app.fetch(request, env as never);

    if (!isXVote || !response.ok || !voteBody?.projectSlug) return response;

    const count = await recountCombinedProject(env, String(voteBody.projectSlug).trim());
    if (!count) return response;

    const body = await response.clone().json<Record<string, unknown>>().catch(() => null);
    if (!body) return response;

    const headers = new Headers(response.headers);
    return new Response(JSON.stringify({ ...body, votes: count.votes }), {
      status: response.status,
      statusText: response.statusText,
      headers,
    });
  },
};
