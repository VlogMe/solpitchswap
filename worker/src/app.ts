import baseWorker from "./index";

interface Env {
  DB: D1Database;
  ADMIN_PASSWORD: string;
  TURNSTILE_SECRET?: string;
  ALLOWED_ORIGIN: string;
  SOLANA_RPC_URL?: string;
}

type MetadataProfile = {
  chainId?: string;
  tokenAddress?: string;
  icon?: string;
  description?: string;
  links?: Array<{ type?: string; label?: string; url?: string }>;
};

type PumpMetadata = {
  name?: string;
  symbol?: string;
  description?: string;
  image_uri?: string;
  metadata_uri?: string;
  website?: string;
  twitter?: string;
  telegram?: string;
};

type OffchainMetadata = {
  name?: string;
  symbol?: string;
  description?: string;
  image?: string;
  external_url?: string;
  properties?: { files?: Array<{ uri?: string }> };
};

const BASE58 = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";
const SOLANA_ADDRESS = /^[1-9A-HJ-NP-Za-km-z]{32,64}$/;

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
      bytes.push(carry & 255;
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

function weekKey(date = new Date()) {
  const target = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  const day = target.getUTCDay() || 7;
  target.setUTCDate(target.getUTCDate() + 4 - day);
  const yearStart = new Date(Date.UTC(target.getUTCFullYear(), 0, 1));
  const week = Math.ceil((((target.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
  return `${target.getUTCFullYear()}-W${String(week).padStart(2, "0")}`;
}

function firstLink(profile: MetadataProfile | undefined, matcher: RegExp) {
  return profile?.links?.find(link => matcher.test(`${link.type ?? ""} ${link.label ?? ""} ${link.url ?? ""}`))?.url ?? "";
}

async function safeJson<T>(url: string): Promise<T | null> {
  try {
    const response = await fetch(url, {
      headers: { accept: "application/json", "user-agent": "SolPitch/1.0" },
      signal: AbortSignal.timeout(4500),
    });
    if (!response.ok) return null;
    return await response.json<T>();
  } catch {
    return null;
  }
}

async function verifyMintWithRpc(address: string, rpc: string) {
  try {
    const response = await fetch(rpc, {
      method: "POST",
      headers: { "content-type": "application/json", accept: "application/json" },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: 1,
        method: "getTokenSupply",
        params: [address, { commitment: "confirmed" }],
      }),
      signal: AbortSignal.timeout(8000),
    });
    if (!response.ok) return false;
    const body = await response.json<{ result?: { value?: { decimals?: number; amount?: string } }; error?: unknown }>().catch(() => ({}));
    return !body.error && typeof body.result?.value?.decimals === "number" && typeof body.result?.value?.amount === "string";
  } catch {
    return false;
  }
}

async function isSolanaTokenMint(address: string, env: Env) {
  const rpcCandidates = [
    env.SOLANA_RPC_URL?.trim(),
    "https://api.mainnet-beta.solana.com",
  ].filter((value, index, values): value is string => Boolean(value) && values.indexOf(value) === index);

  for (const rpc of rpcCandidates) {
    if (await verifyMintWithRpc(address, rpc)) return true;
  }

  return false;
}

async function enrichToken(address: string, base: Record<string, unknown>) {
  const [profiles, pump] = await Promise.all([
    safeJson<MetadataProfile[]>("https://api.dexscreener.com/token-profiles/latest/v1"),
    safeJson<PumpMetadata>(`https://frontend-api.pump.fun/coins/${encodeURIComponent(address)}`),
  ]);

  const profile = Array.isArray(profiles)
    ? profiles.find(item => item.chainId === "solana" && item.tokenAddress === address)
    : undefined;

  let offchain: OffchainMetadata | null = null;
  if (pump?.metadata_uri && /^https?:\/\//.test(pump.metadata_uri)) {
    offchain = await safeJson<OffchainMetadata>(pump.metadata_uri);
  }

  const description = String(
    offchain?.description || pump?.description || profile?.description || "",
  ).trim();
  const name = String(offchain?.name || pump?.name || base.name || "").trim();
  const symbol = String(offchain?.symbol || pump?.symbol || base.symbol || "").trim();
  const logoUrl = String(
    offchain?.image || offchain?.properties?.files?.[0]?.uri || pump?.image_uri || profile?.icon || base.logoUrl || "",
  ).trim();
  const website = String(
    offchain?.external_url || pump?.website || firstLink(profile, /website|site/i) || base.website || "",
  ).trim();
  const xUrl = String(pump?.twitter || firstLink(profile, /twitter|\bx\b/i) || base.xUrl || "").trim();
  const telegramUrl = String(pump?.telegram || firstLink(profile, /telegram/i) || base.telegramUrl || "").trim();
  const metadataSource = offchain?.description
    ? "On-chain metadata URI"
    : pump?.description
      ? "Pump.fun metadata"
      : profile?.description
        ? "DexScreener profile"
        : "Trading metadata only";

  return {
    ...base,
    name,
    symbol,
    logoUrl,
    website,
    xUrl,
    telegramUrl,
    description,
    pitch: description ? description.replace(/\s+/g, " ").slice(0, 300) : "",
    metadataSource,
    descriptionFound: Boolean(description),
  };
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    const cors = corsHeaders(request, env);

    if (url.pathname === "/api/analyze-token" && request.method === "GET") {
      const address = (url.searchParams.get("address") ?? "").trim();
      if (!SOLANA_ADDRESS.test(address)) return json({ error: "Enter a valid Solana contract address." }, 400, cors);
      if (!(await isSolanaTokenMint(address, env))) {
        return json({ error: "This address could not be confirmed as a valid Solana token mint." }, 400, cors);
      }
      const baseResponse = await baseWorker.fetch(request, env);
      const base = await baseResponse.json<Record<string, unknown>>().catch(() => ({}));
      if (!baseResponse.ok) return json(base, baseResponse.status, cors);
      base.found = true;
      base.address = address;
      base.validSolanaMint = true;
      return json(await enrichToken(address, base), 200, { ...cors, "cache-control": "public, max-age=60" });
    }

    if (url.pathname === "/api/activity" && request.method === "GET") {
      const events = await env.DB.prepare(
        "SELECT a.*, p.slug, p.name, p.symbol, p.logo_url FROM activity_events a LEFT JOIN projects p ON p.id=a.project_id ORDER BY a.created_at DESC LIMIT 25",
      ).all();
      return json({ events: events.results }, 200, { ...cors, "cache-control": "public, max-age=15" });
    }

    if (url.pathname === "/api/votes/nonce" && request.method === "POST") {
      const body = await request.json<{ projectSlug?: string; walletAddress?: string }>().catch(() => ({}));
      if (!body.projectSlug || !body.walletAddress || !SOLANA_ADDRESS.test(body.walletAddress)) {
        return json({ error: "A live project and valid Phantom wallet are required." }, 400, cors);
      }
      const project = await env.DB.prepare("SELECT id,name,symbol FROM projects WHERE slug=?1 LIMIT 1")
        .bind(body.projectSlug)
        .first<Record<string, unknown>>();
      if (!project) return json({ error: "This project is not published in the live database yet." }, 404, cors);

      const currentWeek = weekKey();
      const existing = await env.DB.prepare(
        "SELECT id FROM wallet_votes WHERE project_id=?1 AND wallet_address=?2 AND week_key=?3 LIMIT 1",
      ).bind(project.id, body.walletAddress, currentWeek).first();
      if (existing) return json({ error: "This wallet already voted for this project this week." }, 409, cors);

      const nonce = crypto.randomUUID();
      const message = `SolPitch weekly vote\nProject: ${project.name} ($${project.symbol})\nWallet: ${body.walletAddress}\nWeek: ${currentWeek}\nNonce: ${nonce}\nThis signature is free and cannot move funds.`;
      await env.DB.prepare(
        "INSERT INTO vote_nonces (nonce,project_id,wallet_address,message,week_key,expires_at) VALUES (?1,?2,?3,?4,?5,datetime('now','+10 minutes'))",
      ).bind(nonce, project.id, body.walletAddress, message, currentWeek).run();
      return json({ nonce, message, weekKey: currentWeek }, 201, cors);
    }

    if (url.pathname === "/api/votes" && request.method === "POST") {
      const body = await request.json<{ nonce?: string; walletAddress?: string; signature?: string }>().catch(() => ({}));
      if (!body.nonce || !body.walletAddress || !body.signature) {
        return json({ error: "Signed vote details are incomplete." }, 400, cors);
      }
      const nonce = await env.DB.prepare(
        "SELECT * FROM vote_nonces WHERE nonce=?1 AND wallet_address=?2 AND used_at IS NULL AND expires_at>datetime('now') LIMIT 1",
      ).bind(body.nonce, body.walletAddress).first<Record<string, unknown>>();
      if (!nonce) return json({ error: "Vote request expired. Please vote again." }, 400, cors);
      if (!(await verifyWalletSignature(body.walletAddress, String(nonce.message), body.signature))) {
        return json({ error: "Phantom signature could not be verified." }, 400, cors);
      }

      const project = await env.DB.prepare("SELECT name,symbol FROM projects WHERE id=?1 LIMIT 1")
        .bind(nonce.project_id)
        .first<Record<string, unknown>>();
      const voteId = crypto.randomUUID();
      const activityId = crypto.randomUUID();
      try {
        await env.DB.batch([
          env.DB.prepare(
            "INSERT INTO wallet_votes (id,project_id,wallet_address,week_key,signature) VALUES (?1,?2,?3,?4,?5)",
          ).bind(voteId, nonce.project_id, body.walletAddress, nonce.week_key, body.signature),
          env.DB.prepare("UPDATE vote_nonces SET used_at=CURRENT_TIMESTAMP WHERE nonce=?1").bind(body.nonce),
          env.DB.prepare(
            "UPDATE projects SET votes=(SELECT COUNT(*) FROM wallet_votes WHERE project_id=?1 AND week_key=?2),updated_at=CURRENT_TIMESTAMP WHERE id=?1",
          ).bind(nonce.project_id, nonce.week_key),
          env.DB.prepare(
            "INSERT INTO activity_events (id,project_id,event_type,event_text) VALUES (?1,?2,'vote',?3)",
          ).bind(activityId, nonce.project_id, `${project?.name ?? "A project"} received a weekly vote.`),
        ]);
      } catch (error) {
        if (String(error).includes("UNIQUE")) return json({ error: "This wallet already voted for this project this week." }, 409, cors);
        throw error;
      }
      const count = await env.DB.prepare("SELECT votes FROM projects WHERE id=?1").bind(nonce.project_id).first<{ votes: number }>();
      return json({ ok: true, votes: count?.votes ?? 0, weekKey: nonce.week_key }, 201, cors);
    }

    return baseWorker.fetch(request, env);
  },
};
