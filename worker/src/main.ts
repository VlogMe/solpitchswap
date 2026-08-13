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
}

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

function slugify(name: string, symbol: string) {
  const base = `${name}-${symbol}`.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 70);
  return `${base}-${crypto.randomUUID().slice(0, 6)}`;
}

async function publishAcceptedSubmission(request: Request, env: Env) {
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
    env.DB.prepare(`INSERT INTO projects (id,slug,name,symbol,contract_address,project_status,claim_status,pitch,description,website,x_url,telegram_url,logo_url,added_to_swap,promoted,votes) VALUES (?1,?2,?3,?4,?5,?6,'unclaimed',?7,?8,?9,?10,?11,?12,0,0,0)`)
      .bind(
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
      ),
    env.DB.prepare("UPDATE submissions SET status='approved', reviewed_at=CURRENT_TIMESTAMP WHERE id=?1").bind(result.id),
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

      if (url.pathname === "/api/submissions" && request.method === "POST") {
        return withCors(await publishAcceptedSubmission(request, env), cors);
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
