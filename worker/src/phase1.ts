import app from "./main";

interface Env {
  DB: D1Database;
  [key: string]: unknown;
}

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

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    await restoreLegacyTotals(env);

    const url = new URL(request.url);
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
