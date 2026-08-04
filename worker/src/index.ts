export interface Env {
  DB: D1Database;
  ADMIN_PASSWORD: string;
  TURNSTILE_SECRET?: string;
  ALLOWED_ORIGIN: string;
}

type SubmissionInput = {
  name: string;
  symbol: string;
  contractAddress: string;
  pitch: string;
  description: string;
  website?: string;
  xUrl?: string;
  telegramUrl?: string;
  graduationProofUrl: string;
  submitterEmail: string;
  turnstileToken?: string;
};

const SESSION_COOKIE = "solpitch_admin";
const SESSION_TTL_SECONDS = 60 * 60 * 8;

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
    "access-control-allow-methods": "GET,POST,PATCH,OPTIONS",
    vary: "Origin",
  };
}

function parseCookies(request: Request) {
  const cookie = request.headers.get("cookie") ?? "";
  return Object.fromEntries(cookie.split(";").map(part => part.trim().split("=")).filter(pair => pair.length === 2));
}

async function sha256(value: string) {
  const bytes = new TextEncoder().encode(value);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return [...new Uint8Array(digest)].map(byte => byte.toString(16).padStart(2, "0")).join("");
}

function secureCompare(a: string, b: string) {
  const aBytes = new TextEncoder().encode(a);
  const bBytes = new TextEncoder().encode(b);
  const length = Math.max(aBytes.length, bBytes.length);
  let mismatch = aBytes.length ^ bBytes.length;
  for (let i = 0; i < length; i += 1) mismatch |= (aBytes[i] ?? 0) ^ (bBytes[i] ?? 0);
  return mismatch === 0;
}

async function requireAdmin(request: Request, env: Env) {
  const token = parseCookies(request)[SESSION_COOKIE];
  if (!token) return false;
  const tokenHash = await sha256(token);
  const session = await env.DB.prepare(
    "SELECT token_hash FROM admin_sessions WHERE token_hash = ?1 AND expires_at > datetime('now') LIMIT 1",
  ).bind(tokenHash).first<{ token_hash: string }>();
  return Boolean(session);
}

async function verifyTurnstile(token: string | undefined, request: Request, env: Env) {
  if (!env.TURNSTILE_SECRET) return true;
  if (!token) return false;
  const body = new URLSearchParams({ secret: env.TURNSTILE_SECRET, response: token });
  const remoteIp = request.headers.get("CF-Connecting-IP");
  if (remoteIp) body.set("remoteip", remoteIp);
  const response = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
    method: "POST",
    body,
  });
  const result = await response.json<{ success: boolean }>();
  return result.success === true;
}

function validateSubmission(input: SubmissionInput) {
  const required = [input.name, input.symbol, input.contractAddress, input.pitch, input.description, input.graduationProofUrl, input.submitterEmail];
  if (required.some(value => !value?.trim())) return "All required fields must be completed.";
  if (input.name.length > 80 || input.symbol.length > 16) return "Name or ticker is too long.";
  if (input.pitch.length > 300 || input.description.length > 5000) return "Project text exceeds the allowed length.";
  if (!/^[1-9A-HJ-NP-Za-km-z]{32,64}$/.test(input.contractAddress)) return "Contract address format is invalid.";
  if (!/^\S+@\S+\.\S+$/.test(input.submitterEmail)) return "Email address is invalid.";
  for (const value of [input.website, input.xUrl, input.telegramUrl, input.graduationProofUrl]) {
    if (!value) continue;
    try { new URL(value); } catch { return "One or more URLs are invalid."; }
  }
  return null;
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    const cors = corsHeaders(request, env);

    if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: cors });
    if (url.pathname === "/api/health") return json({ ok: true }, 200, cors);

    if (url.pathname === "/api/submissions" && request.method === "POST") {
      const input = await request.json<SubmissionInput>().catch(() => null);
      if (!input) return json({ error: "Invalid JSON body." }, 400, cors);
      const validationError = validateSubmission(input);
      if (validationError) return json({ error: validationError }, 400, cors);
      if (!(await verifyTurnstile(input.turnstileToken, request, env))) return json({ error: "Bot verification failed." }, 400, cors);

      const id = crypto.randomUUID();
      try {
        await env.DB.prepare(`
          INSERT INTO submissions (
            id,name,symbol,contract_address,pitch,description,website,x_url,telegram_url,
            graduation_proof_url,submitter_email,status
          ) VALUES (?1,?2,?3,?4,?5,?6,?7,?8,?9,?10,?11,'pending')
        `).bind(
          id, input.name.trim(), input.symbol.trim().toUpperCase(), input.contractAddress.trim(),
          input.pitch.trim(), input.description.trim(), input.website?.trim() || null,
          input.xUrl?.trim() || null, input.telegramUrl?.trim() || null,
          input.graduationProofUrl.trim(), input.submitterEmail.trim().toLowerCase(),
        ).run();
      } catch (error) {
        if (String(error).includes("UNIQUE")) return json({ error: "That contract address has already been submitted." }, 409, cors);
        throw error;
      }
      return json({ id, status: "pending" }, 201, cors);
    }

    if (url.pathname === "/api/admin/login" && request.method === "POST") {
      const body = await request.json<{ password?: string }>().catch(() => ({}));
      if (!body.password || !secureCompare(body.password, env.ADMIN_PASSWORD)) return json({ error: "Invalid credentials." }, 401, cors);
      const token = crypto.randomUUID() + crypto.randomUUID();
      const tokenHash = await sha256(token);
      await env.DB.prepare(
        "INSERT INTO admin_sessions (token_hash, expires_at) VALUES (?1, datetime('now', '+8 hours'))",
      ).bind(tokenHash).run();
      const cookie = `${SESSION_COOKIE}=${token}; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=${SESSION_TTL_SECONDS}`;
      return json({ ok: true }, 200, { ...cors, "set-cookie": cookie });
    }

    if (url.pathname === "/api/admin/logout" && request.method === "POST") {
      const token = parseCookies(request)[SESSION_COOKIE];
      if (token) await env.DB.prepare("DELETE FROM admin_sessions WHERE token_hash = ?1").bind(await sha256(token)).run();
      return json({ ok: true }, 200, { ...cors, "set-cookie": `${SESSION_COOKIE}=; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=0` });
    }

    if (url.pathname === "/api/admin/session" && request.method === "GET") {
      return json({ authenticated: await requireAdmin(request, env) }, 200, cors);
    }

    if (url.pathname === "/api/admin/submissions" && request.method === "GET") {
      if (!(await requireAdmin(request, env))) return json({ error: "Unauthorized." }, 401, cors);
      const status = url.searchParams.get("status") ?? "pending";
      const results = await env.DB.prepare(
        "SELECT * FROM submissions WHERE status = ?1 ORDER BY created_at DESC LIMIT 200",
      ).bind(status).all();
      return json({ submissions: results.results }, 200, cors);
    }

    const reviewMatch = url.pathname.match(/^\/api\/admin\/submissions\/([^/]+)$/);
    if (reviewMatch && request.method === "PATCH") {
      if (!(await requireAdmin(request, env))) return json({ error: "Unauthorized." }, 401, cors);
      const body = await request.json<{ status?: "approved" | "rejected"; reviewerNotes?: string }>().catch(() => ({}));
      if (!body.status || !["approved", "rejected"].includes(body.status)) return json({ error: "Invalid review status." }, 400, cors);
      await env.DB.prepare(
        "UPDATE submissions SET status = ?1, reviewer_notes = ?2, reviewed_at = CURRENT_TIMESTAMP WHERE id = ?3",
      ).bind(body.status, body.reviewerNotes?.trim() || null, reviewMatch[1]).run();
      return json({ ok: true }, 200, cors);
    }

    return json({ error: "Not found." }, 404, cors);
  },
};
