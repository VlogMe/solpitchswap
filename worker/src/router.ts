import baseWorker from "./app";

interface Env {
  DB: D1Database;
  ADMIN_PASSWORD: string;
  TURNSTILE_SECRET?: string;
  ALLOWED_ORIGIN: string;
}

function json(data: unknown, status = 200, headers: HeadersInit = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json; charset=utf-8", ...headers },
  });
}

function corsHeaders(request: Request, env: Env): HeadersInit {
  const origin = request.headers.get("origin");
  if (!origin || origin !== env.ALLOWED_ORIGIN) return {};
  return {
    "access-control-allow-origin": origin,
    "access-control-allow-credentials": "true",
    "access-control-allow-headers": "content-type",
    "access-control-allow-methods": "GET,POST,PATCH,DELETE,OPTIONS",
    vary: "Origin",
  };
}

async function isAdmin(request: Request, env: Env) {
  const url = new URL(request.url);
  url.pathname = "/api/admin/session";
  url.search = "";
  const sessionResponse = await baseWorker.fetch(new Request(url.toString(), { headers: request.headers, method: "GET" }), env);
  if (!sessionResponse.ok) return false;
  const body = await sessionResponse.json<{ authenticated?: boolean }>().catch(() => ({}));
  return body.authenticated === true;
}

async function analyzeAddress(request: Request, env: Env, address: string) {
  const url = new URL(request.url);
  url.pathname = "/api/analyze-token";
  url.search = `?address=${encodeURIComponent(address)}`;
  return baseWorker.fetch(new Request(url.toString(), request), env);
}

const IPFS_CID = /^(?:Qm[1-9A-HJ-NP-Za-km-z]{44}|bafy[a-z2-7]{20,}|bafkre[a-z2-7]{20,})$/i;

async function proxyIpfsImage(cid: string) {
  if (!IPFS_CID.test(cid)) {
    return json({ error: "Invalid IPFS CID." }, 400);
  }

  let upstream: Response;
  try {
    upstream = await fetch(`https://ipfs.io/ipfs/${encodeURIComponent(cid)}`, {
      signal: AbortSignal.timeout(10000),
      headers: { accept: "image/*,*/*;q=0.8" },
    });
  } catch {
    return json({ error: "IPFS gateway timeout or network error." }, 502);
  }

  if (!upstream.ok) {
    return json({ error: "IPFS content unavailable." }, upstream.status === 404 ? 404 : 502);
  }

  const contentType = (upstream.headers.get("content-type") || "").split(";")[0].trim().toLowerCase();
  if (!contentType.startsWith("image/")) {
    return json({ error: "Upstream response is not an image." }, 415);
  }

  return new Response(upstream.body, {
    status: 200,
    headers: {
      "content-type": contentType,
      "cross-origin-resource-policy": "cross-origin",
      "cache-control": "public, max-age=86400",
    },
  });
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    const cors = corsHeaders(request, env);

    if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: cors });

    const ipfsMatch = url.pathname.match(/^\/api\/ipfs\/([^/]+)\/?$/);
    if (ipfsMatch) {
      if (request.method !== "GET") return json({ error: "Method not allowed." }, 405, cors);
      return proxyIpfsImage(ipfsMatch[1]);
    }

    const marketMatch = url.pathname.match(/^\/api\/projects\/([^/]+)\/market$/);
    if (marketMatch && request.method === "GET") {
      const project = await env.DB.prepare("SELECT contract_address FROM projects WHERE slug = ?1 LIMIT 1")
        .bind(decodeURIComponent(marketMatch[1]))
        .first<{ contract_address: string }>();
      if (!project) return json({ error: "Project not found." }, 404, cors);
      return analyzeAddress(request, env, project.contract_address);
    }

    const publicProjectMatch = url.pathname.match(/^\/api\/projects\/([^/]+)$/);
    if (publicProjectMatch && request.method === "GET") {
      const project = await env.DB.prepare("SELECT * FROM projects WHERE slug = ?1 LIMIT 1")
        .bind(decodeURIComponent(publicProjectMatch[1]))
        .first();
      if (!project) return json({ error: "Project not found." }, 404, cors);
      return json({ project }, 200, { ...cors, "cache-control": "public, max-age=30" });
    }

    if (url.pathname === "/api/admin/projects" && request.method === "GET") {
      if (!(await isAdmin(request, env))) return json({ error: "Unauthorized." }, 401, cors);
      const query = (url.searchParams.get("q") ?? "").trim();
      const results = query
        ? await env.DB.prepare("SELECT * FROM projects WHERE name LIKE ?1 OR symbol LIKE ?1 OR contract_address LIKE ?1 ORDER BY published_at DESC LIMIT 300").bind(`%${query}%`).all()
        : await env.DB.prepare("SELECT * FROM projects ORDER BY published_at DESC LIMIT 300").all();
      return json({ projects: results.results }, 200, cors);
    }

    const resetVotesMatch = url.pathname.match(/^\/api\/admin\/projects\/([^/]+)\/reset-votes$/);
    if (resetVotesMatch && request.method === "POST") {
      if (!(await isAdmin(request, env))) return json({ error: "Unauthorized." }, 401, cors);
      const id = decodeURIComponent(resetVotesMatch[1]);
      await env.DB.batch([
        env.DB.prepare("DELETE FROM wallet_votes WHERE project_id = ?1").bind(id),
        env.DB.prepare("UPDATE projects SET votes = 0, updated_at=CURRENT_TIMESTAMP WHERE id = ?1").bind(id),
      ]);
      return json({ ok: true }, 200, cors);
    }

    const adminProjectMatch = url.pathname.match(/^\/api\/admin\/projects\/([^/]+)$/);
    if (adminProjectMatch && request.method === "PATCH") {
      if (!(await isAdmin(request, env))) return json({ error: "Unauthorized." }, 401, cors);
      const body = await request.json<{
        name?: string; symbol?: string; pitch?: string; description?: string;
        website?: string; xUrl?: string; telegramUrl?: string; logoUrl?: string;
        addedToSwap?: boolean; promoted?: boolean;
        claimStatus?: "unclaimed" | "pending" | "verified" | "disputed";
      }>().catch(() => ({}));
      const id = decodeURIComponent(adminProjectMatch[1]);
      const existing = await env.DB.prepare("SELECT * FROM projects WHERE id = ?1 LIMIT 1").bind(id).first<Record<string, unknown>>();
      if (!existing) return json({ error: "Project not found." }, 404, cors);
      await env.DB.prepare(`UPDATE projects SET
        name=?1,symbol=?2,pitch=?3,description=?4,website=?5,x_url=?6,telegram_url=?7,logo_url=?8,
        added_to_swap=?9,promoted=?10,claim_status=?11,updated_at=CURRENT_TIMESTAMP WHERE id=?12`)
        .bind(
          body.name?.trim() || existing.name,
          body.symbol?.trim().toUpperCase() || existing.symbol,
          body.pitch?.trim() || existing.pitch,
          body.description?.trim() || existing.description,
          body.website?.trim() || null,
          body.xUrl?.trim() || null,
          body.telegramUrl?.trim() || null,
          body.logoUrl?.trim() || null,
          body.addedToSwap === undefined ? existing.added_to_swap : body.addedToSwap ? 1 : 0,
          body.promoted === undefined ? existing.promoted : body.promoted ? 1 : 0,
          body.claimStatus || existing.claim_status,
          id,
        ).run();
      return json({ ok: true }, 200, cors);
    }

    if (adminProjectMatch && request.method === "DELETE") {
      if (!(await isAdmin(request, env))) return json({ error: "Unauthorized." }, 401, cors);
      const id = decodeURIComponent(adminProjectMatch[1]);
      const existing = await env.DB.prepare("SELECT id, contract_address FROM projects WHERE id = ?1 LIMIT 1").bind(id).first<{ id: string; contract_address: string }>();
      if (!existing) return json({ error: "Project not found." }, 404, cors);

      const tableRows = await env.DB.prepare("SELECT name FROM sqlite_master WHERE type = 'table'").all<{ name: string }>();
      const tables = new Set((tableRows.results ?? []).map(row => row.name));
      const statements: D1PreparedStatement[] = [];
      const relatedTables = ["project_owners", "claim_requests", "claim_nonces", "wallet_votes", "vote_nonces", "activity_events"];
      for (const table of relatedTables) {
        if (tables.has(table)) statements.push(env.DB.prepare(`DELETE FROM ${table} WHERE project_id = ?1`).bind(id));
      }
      if (tables.has("submissions")) {
        statements.push(env.DB.prepare("DELETE FROM submissions WHERE TRIM(contract_address) = TRIM(?1)").bind(existing.contract_address));
      }
      statements.push(env.DB.prepare("DELETE FROM projects WHERE id = ?1").bind(id));
      await env.DB.batch(statements);

      const remaining = await env.DB.prepare("SELECT id FROM projects WHERE id = ?1 LIMIT 1").bind(id).first();
      const remainingSubmission = tables.has("submissions")
        ? await env.DB.prepare("SELECT id FROM submissions WHERE TRIM(contract_address) = TRIM(?1) LIMIT 1").bind(existing.contract_address).first()
        : null;
      if (remaining || remainingSubmission) return json({ error: "Project could not be deleted completely." }, 500, cors);
      return json({ ok: true }, 200, cors);
    }

    return baseWorker.fetch(request, env);
  },
};
