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

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    const cors = corsHeaders(request, env);

    try {
      if (url.pathname === "/logo.png" && request.method === "GET") return serveLogo();
      if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: cors });

      const swapResponse = await handleSwapRequest(request, env, cors);
      if (swapResponse) return withCors(swapResponse, cors);

      return withCors(await listingsWorker.fetch(request, env), cors);
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
