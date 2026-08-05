import listingsWorker from "./router";
import { handleSwapRequest } from "./swap";

interface Env {
  DB: D1Database;
  ADMIN_PASSWORD: string;
  TURNSTILE_SECRET?: string;
  ALLOWED_ORIGIN: string;
  SOLANA_RPC_URL?: string;
  JUPITER_API_URL?: string;
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

function withCors(response: Response, cors: HeadersInit) {
  const headers = new Headers(response.headers);
  Object.entries(cors).forEach(([key, value]) => headers.set(key, String(value)));
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
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
    if (url.pathname === "/logo.png" && request.method === "GET") return serveLogo();

    const cors = corsHeaders(request, env);
    if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: cors });
    const swapResponse = await handleSwapRequest(request, env, cors);
    if (swapResponse) return swapResponse;
    return withCors(await listingsWorker.fetch(request, env), cors);
  },
};
