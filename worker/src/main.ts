import listingsWorker from "./router";
import { handleSwapRequest } from "./swap";

interface Env {
  DB: D1Database;
  ASSETS: Fetcher;
  ADMIN_PASSWORD: string;
  TURNSTILE_SECRET?: string;
  ALLOWED_ORIGIN: string;
  SOLANA_RPC_URL?: string;
  JUPITER_API_URL?: string;
  X_CLIENT_ID: string;
  X_CLIENT_SECRET: string;
}

function generateRandomString(length = 64): string {
  const array = new Uint8Array(length);
  crypto.getRandomValues(array);
  return Array.from(array, (b) => b.toString(16).padStart(2, "0")).join("");
}

async function sha256Base64Url(input: string): Promise<string> {
  const data = new TextEncoder().encode(input);
  const hash = await crypto.subtle.digest("SHA-256", data);
  return btoa(String.fromCharCode(...new Uint8Array(hash)))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

async function hashToken(token: string): Promise<string> {
  const data = new TextEncoder().encode(token);
  const hash = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(hash))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

type XSession = {
  x_user_id: string;
  x_username: string;
};

type LiveSubmission = {
  name?: string;
  symbol?: string;
  contractAddress?: string;
  projectStatus?: string;
  pitch?: string;
  description?: string;
  website?: string;
  xUrl?: string;
  telegramUrl?: string;
  logoUrl?: string;
};

type ClaimSubmission = {
  nonce?: string;
  walletAddress?: string;
  signature?: string;
  evidenceUrl?: string;
  submitterEmail?: string;
};

const BASE58 = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";
const X_SESSION_COOKIE = "solpitch_x_session";
const X_SESSION_MAX_AGE = 60 * 60 * 24 * 30;

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

function withCors(response: Response, cors: HeadersInit) {
  const headers = new Headers(response.headers);
  Object.entries(cors).forEach(([key, value]) => headers.set(key, String(value)));
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}

function workerError(error: unknown, cors: HeadersInit) {
  const message = error instanceof Error ? error.message : String(error || "Unknown Worker error");
  return new Response(JSON.stringify({ error: `Server error: ${message}` }), {
    status: 500,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store",
      ...cors,
    },
  });
}

function json(data: unknown, status = 200, headers: HeadersInit = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json; charset=utf-8", ...headers },
  });
}

function parseCookies(request: Request) {
  const cookies = request.headers.get("cookie") ?? "";
  return Object.fromEntries(
    cookies
      .split(";")
      .map((part) => part.trim())
      .filter(Boolean)
      .map((part) => {
        const separator = part.indexOf("=");
        return separator < 0 ? [part, ""] : [part.slice(0, separator), part.slice(separator + 1)];
      }),
  );
}

async function getXSession(request: Request, env: Env): Promise<XSession | null> {
  const sessionToken = parseCookies(request)[X_SESSION_COOKIE];
  if (!sessionToken) return null;

  const row = await env.DB.prepare(
    "SELECT x_user_id, x_username FROM x_sessions WHERE token_hash = ?1 AND expires_at > ?2 LIMIT 1",
  ).bind(await hashToken(sessionToken), Date.now()).first<XSession>();

  return row ?? null;
}

function slugify(name: string, symbol: string) {
  const base = `${name}-${symbol}`.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 70);
  return `${base}-${crypto.randomUUID().slice(0, 6)}`;
}

function decodeBase58(value: string) {
  const bytes = [0];
  for (const char of value) {
    const digit = BASE58.indexOf(char);
    if (digit < 0) throw new Error("Invalid base58 value.");
    let carry = digit;
    for (let index = 0; index < bytes.length; index += 1) {
      carry += bytes[index] * 58;
      bytes[index] = carry & 255;
      carry >>= 8;
    }
    while (carry) {
      bytes.push(carry & 255);
      carry >>= 8;
    }
  }
  for (let index = 0; index < value.length - 1 && value[index] === "1"; index += 1) bytes.push(0);
  return new Uint8Array(bytes.reverse());
}

function decodeBase64(value: string) {
  const binary = atob(value);
  return Uint8Array.from(binary, character => character.charCodeAt(0));
}

async function verifyWalletSignature(walletAddress: string, message: string, signatureBase64: string) {
  try {
    const publicKey = decodeBase58(walletAddress);
    const signature = decodeBase64(signatureBase64);
    if (publicKey.length !== 32 || signature.length !== 64) return false;
    const key = await crypto.subtle.importKey("raw", publicKey, { name: "Ed25519" }, false, ["verify"]);
    return await crypto.subtle.verify("Ed25519", key, signature, new TextEncoder().encode(message));
  } catch {
    return false;
  }
}

function validUrl(value?: string) {
  if (!value) return true;
  try {
    new URL(value);
    return true;
  } catch {
    return false;
  }
}

async function submitPendingClaim(request: Request, env: Env) {
  const body = await request.json<ClaimSubmission>().catch(() => ({}));
  if (!body.nonce || !body.walletAddress || !body.signature) {
    return json({ error: "Signed claim details are incomplete." }, 400);
  }
  if (body.evidenceUrl && !validUrl(body.evidenceUrl)) {
    return json({ error: "Evidence URL is invalid." }, 400);
  }

  const nonce = await env.DB.prepare(
    "SELECT * FROM claim_nonces WHERE nonce=?1 AND wallet_address=?2 AND used_at IS NULL AND expires_at>datetime('now') LIMIT 1",
  ).bind(body.nonce, body.walletAddress).first<Record<string, unknown>>();
  if (!nonce) return json({ error: "Claim request expired. Start again." }, 400);

  if (!(await verifyWalletSignature(body.walletAddress, String(nonce.message), body.signature))) {
    return json({ error: "Phantom signature could not be verified." }, 400);
  }

  const id = crypto.randomUUID();
  await env.DB.batch([
    env.DB.prepare(
      "INSERT INTO claim_requests (id,project_id,wallet_address,signature,signed_message,evidence_url,submitter_email,status) VALUES (?1,?2,?3,?4,?5,?6,?7,'pending')",
    ).bind(
      id,
      nonce.project_id,
      body.walletAddress,
      body.signature,
      nonce.message,
      body.evidenceUrl?.trim() || null,
      body.submitterEmail?.trim().toLowerCase() || null,
    ),
    env.DB.prepare("UPDATE claim_nonces SET used_at=CURRENT_TIMESTAMP WHERE nonce=?1").bind(body.nonce),
    env.DB.prepare("UPDATE projects SET claim_status='pending',updated_at=CURRENT_TIMESTAMP WHERE id=?1").bind(nonce.project_id),
  ]);

  return json({ id, status: "pending" }, 201);
}

async function publishAcceptedSubmission(request: Request, env: Env, xSession: XSession) {
  const input = await request.clone().json<LiveSubmission>().catch(() => null);
  const response = await listingsWorker.fetch(request, env);
  if (!response.ok || !input) return response;

  const result = await response.clone().json<{ id?: string }>().catch(() => ({}));
  if (!result.id) return response;

  const name = String(input.name || "").trim();
  const symbol = String(input.symbol || "").replace(/^\$/, "").trim().toUpperCase();
  const contractAddress = String(input.contractAddress || "").trim();
  const projectStatus = String(input.projectStatus || "launched").trim();
  const projectId = crypto.randomUUID();
  const slug = slugify(name, symbol);

  await env.DB.batch([
    env.DB.prepare(
      `INSERT INTO projects (id,slug,name,symbol,contract_address,project_status,claim_status,pitch,description,website,x_url,telegram_url,logo_url,added_to_swap,promoted,votes,x_user_id,x_username) VALUES (?1,?2,?3,?4,?5,?6,'unclaimed',?7,?8,?9,?10,?11,?12,0,0,0,?13,?14)`,
    ).bind(
      projectId,
      slug,
      name,
      symbol,
      contractAddress,
      projectStatus,
      String(input.pitch || "").trim(),
      String(input.description || "").trim(),
      String(input.website || "").trim() || null,
      String(input.xUrl || "").trim() || null,
      String(input.telegramUrl || "").trim() || null,
      String(input.logoUrl || "").trim() || null,
      xSession.x_user_id,
      xSession.x_username,
    ),
    env.DB.prepare(
      "UPDATE submissions SET status='approved', reviewed_at=CURRENT_TIMESTAMP, x_user_id=?2, x_username=?3 WHERE id=?1",
    ).bind(result.id, xSession.x_user_id, xSession.x_username),
  ]);

  return new Response(JSON.stringify({ ...result, projectId, slug, status: "live" }), {
    status: response.status,
    headers: response.headers,
  });
}

async function serveLogo() {
  const upstream = await fetch("https://solpitch.net/favicon.png", {
    cf: { cacheEverything: true, cacheTtl: 86400 },
  });
  if (!upstream.ok) return new Response("Logo unavailable", { status: 502 });
  const headers = new Headers(upstream.headers);
  headers.set("content-type", "image/png");
  headers.set("cache-control", "public, max-age=86400");
  headers.set("content-disposition", "inline; filename=logo.png");
  return new Response(upstream.body, { status: 200, headers });
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    const cors = corsHeaders(request, env);

    try {
      if (url.pathname === "/logo.png" && request.method === "GET") return serveLogo();
      if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: cors });

      const swapResponse = await handleSwapRequest(request, env, cors);
      if (swapResponse) return withCors(swapResponse, cors);

      if (url.pathname === "/api/auth/x/callback" && request.method === "GET") {
        const code = url.searchParams.get("code");
        const state = url.searchParams.get("state");

        if (!code || !state) {
          console.error("X OAuth callback missing code or state", {
            hasCode: Boolean(code),
            hasState: Boolean(state),
          });
          return Response.redirect("https://solpitch.com/?auth=error&stage=missing_params", 302);
        }

        const row = await env.DB.prepare(
          "SELECT code_verifier FROM x_oauth_states WHERE state = ?1 LIMIT 1",
        ).bind(state).first<{ code_verifier: string }>();

        if (!row) {
          console.error("X OAuth callback state not found in x_oauth_states", { state });
          return Response.redirect("https://solpitch.com/?auth=error&stage=state", 302);
        }

        await env.DB.prepare("DELETE FROM x_oauth_states WHERE state = ?1").bind(state).run();

        const tokenRes = await fetch("https://api.x.com/2/oauth2/token", {
          method: "POST",
          headers: {
            "Content-Type": "application/x-www-form-urlencoded",
            Authorization: "Basic " + btoa(`${env.X_CLIENT_ID}:${env.X_CLIENT_SECRET}`),
          },
          body: new URLSearchParams({
            code,
            grant_type: "authorization_code",
            redirect_uri: "https://solpitchswap.kevingpersson.workers.dev/api/auth/x/callback",
            code_verifier: row.code_verifier,
          }),
        });

        if (!tokenRes.ok) {
          const tokenErrorBody = await tokenRes.text();
          console.error("X OAuth token exchange failed", {
            status: tokenRes.status,
            body: tokenErrorBody,
          });
          return Response.redirect(`https://solpitch.com/?auth=error&stage=token&status=${tokenRes.status}`, 302);
        }

        const tokenData = await tokenRes.json() as { access_token?: string };
        if (!tokenData.access_token) {
          return Response.redirect("https://solpitch.com/?auth=error&stage=token_response", 302);
        }

        const userRes = await fetch("https://api.x.com/2/users/me", {
          headers: { Authorization: `Bearer ${tokenData.access_token}` },
        });

        if (!userRes.ok) {
          const userErrorBody = await userRes.text();
          console.error("X OAuth /2/users/me failed", {
            status: userRes.status,
            body: userErrorBody,
          });
          return Response.redirect(`https://solpitch.com/?auth=error&stage=user&status=${userRes.status}`, 302);
        }

        const userData = await userRes.json() as { data?: { id: string; username: string } };
        if (!userData.data?.id || !userData.data?.username) {
          return Response.redirect("https://solpitch.com/?auth=error&stage=user_data", 302);
        }

        const sessionToken = generateRandomString(48);
        const tokenHash = await hashToken(sessionToken);
        const expiresAt = Date.now() + X_SESSION_MAX_AGE * 1000;

        await env.DB.prepare(
          "INSERT INTO x_sessions (token_hash, x_user_id, x_username, expires_at, created_at) VALUES (?1, ?2, ?3, ?4, ?5)",
        ).bind(tokenHash, userData.data.id, userData.data.username, expiresAt, Date.now()).run();

        const headers = new Headers();
        headers.set("Location", "https://solpitch.com/?auth=success");
        headers.set("Set-Cookie", `${X_SESSION_COOKIE}=${sessionToken}; Path=/; HttpOnly; Secure; SameSite=None; Max-Age=${X_SESSION_MAX_AGE}`);

        return new Response(null, { status: 302, headers });
      }

      if (url.pathname === "/api/auth/x/login" && request.method === "GET") {
        const state = generateRandomString(32);
        const codeVerifier = generateRandomString(64);
        const codeChallenge = await sha256Base64Url(codeVerifier);

        await env.DB.prepare(
          "INSERT INTO x_oauth_states (state, code_verifier, created_at) VALUES (?1, ?2, ?3)",
        ).bind(state, codeVerifier, Date.now()).run();

        const params = new URLSearchParams({
          response_type: "code",
          client_id: env.X_CLIENT_ID,
          redirect_uri: "https://solpitchswap.kevingpersson.workers.dev/api/auth/x/callback",
          scope: "users.read",
          state,
          code_challenge: codeChallenge,
          code_challenge_method: "S256",
        });

        return Response.redirect(`https://x.com/i/oauth2/authorize?${params.toString()}`, 302);
      }

      if (url.pathname === "/api/auth/x/session" && request.method === "GET") {
        const xSession = await getXSession(request, env);
        return withCors(json(xSession ? {
          authenticated: true,
          userId: xSession.x_user_id,
          username: xSession.x_username,
        } : { authenticated: false }), cors);
      }

      if (url.pathname === "/api/auth/x/logout" && request.method === "POST") {
        const sessionToken = parseCookies(request)[X_SESSION_COOKIE];
        if (sessionToken) {
          await env.DB.prepare("DELETE FROM x_sessions WHERE token_hash = ?1")
            .bind(await hashToken(sessionToken))
            .run();
        }
        return withCors(json({ ok: true }, 200, {
          "set-cookie": `${X_SESSION_COOKIE}=; Path=/; HttpOnly; Secure; SameSite=None; Max-Age=0`,
        }), cors);
      }

      if (url.pathname === "/api/submissions" && request.method === "POST") {
        const xSession = await getXSession(request, env);
        if (!xSession) {
          return withCors(json({ error: "Sign in with X before submitting a project." }, 401), cors);
        }
        return withCors(await publishAcceptedSubmission(request, env, xSession), cors);
      }

      if (url.pathname === "/api/claims" && request.method === "POST") {
        return withCors(json({ error: "Claim Project has been removed." }, 410), cors);
      }

      if (url.pathname.startsWith("/api/")) {
        return withCors(await listingsWorker.fetch(request, env), cors);
      }

      return env.ASSETS.fetch(request);
    } catch (error) {
      console.error("Unhandled SolPitch Worker error", {
        method: request.method,
        pathname: url.pathname,
        error,
      });
      return workerError(error, cors);
    }
  },
};
