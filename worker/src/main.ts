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

const WIF_PROJECT = {
  id: "solpitch-wif-dogwifhat",
  slug: "dogwifhat-wif",
  name: "dogwifhat",
  symbol: "WIF",
  contractAddress: "EKpQGSJtjMFqKZ9KQanSqYXRcF8fBopzLHYxdM65zcjm",
  pitch: "Literally a dog wif a hat. One of Solana's best-known community memecoins.",
  description: "[Category: Memecoin] dogwifhat (WIF) is a Solana memecoin built around the viral image of a dog wearing a knitted hat. The project is community-driven and has become one of the most widely recognized memecoins in the Solana ecosystem.",
  website: "https://dogwifcoin.org/",
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

async function ensureWifProject(env: Env) {
  await env.DB.prepare(`
    INSERT INTO projects (
      id, slug, name, symbol, contract_address, project_status, claim_status,
      pitch, description, website, added_to_swap, promoted, votes
    ) VALUES (?1, ?2, ?3, ?4, ?5, 'graduated', 'unclaimed', ?6, ?7, ?8, 1, 0, 0)
    ON CONFLICT(contract_address) DO NOTHING
  `).bind(
    WIF_PROJECT.id,
    WIF_PROJECT.slug,
    WIF_PROJECT.name,
    WIF_PROJECT.symbol,
    WIF_PROJECT.contractAddress,
    WIF_PROJECT.pitch,
    WIF_PROJECT.description,
    WIF_PROJECT.website,
  ).run();
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

      if (url.pathname === "/api/projects" && request.method === "GET") {
        await ensureWifProject(env);
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
