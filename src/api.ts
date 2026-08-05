import type { CoinSubmission, Project, ProjectStatus } from "./types";

const API_BASE = (import.meta.env.VITE_API_BASE_URL as string | undefined)?.replace(/\/$/, "") ?? "https://solpitchswap.kevingpersson.workers.dev";
type ApiError = { error?: string };

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const response = await fetch(`${API_BASE}${path}`, { ...init, credentials: "include", headers: { "content-type": "application/json", ...(init.headers ?? {}) } });
  const body = await response.json().catch(() => ({})) as T & ApiError;
  if (!response.ok) throw new Error(body.error || `Request failed (${response.status})`);
  return body;
}

export type TokenAnalysis = {
  found: boolean;
  address: string;
  name?: string;
  symbol?: string;
  logoUrl?: string;
  website?: string;
  xUrl?: string;
  telegramUrl?: string;
  dexScreenerUrl?: string;
  dexId?: string;
  pairAddress?: string;
  priceUsd?: string;
  liquidityUsd?: number;
  marketCap?: number;
  volume24h?: number;
  pairCreatedAt?: number | null;
  tradable: boolean;
  pairCount?: number;
};

export type SubmissionPayload = {
  name: string; symbol: string; contractAddress: string; projectStatus: ProjectStatus;
  pitch: string; description: string; website?: string; xUrl?: string; telegramUrl?: string;
  logoUrl?: string; statusProofUrl: string; submitterEmail: string; turnstileToken?: string;
};

export async function analyzeToken(contractAddress: string) {
  return request<TokenAnalysis>(`/api/analyze-token?address=${encodeURIComponent(contractAddress.trim())}`);
}
export async function getPublishedProjects() {
  const result = await request<{ projects: Record<string, unknown>[] }>("/api/projects");
  return result.projects.map(mapProjectRow);
}
export async function submitCoin(payload: SubmissionPayload) {
  return request<{ id: string; status: "pending"; projectStatus: ProjectStatus }>("/api/submissions", { method: "POST", body: JSON.stringify(payload) });
}
export async function adminLogin(password: string) { return request<{ ok: true }>("/api/admin/login", { method: "POST", body: JSON.stringify({ password }) }); }
export async function adminLogout() { return request<{ ok: true }>("/api/admin/logout", { method: "POST", body: "{}" }); }
export async function getAdminSession() { return request<{ authenticated: boolean }>("/api/admin/session"); }
export async function getPendingSubmissions() {
  const result = await request<{ submissions: Record<string, unknown>[] }>("/api/admin/submissions?status=pending");
  return result.submissions.map(mapSubmissionRow);
}
export async function reviewSubmission(id: string, status: "approved" | "rejected", reviewerNotes: string, options: { addedToSwap?: boolean; promoted?: boolean; logoUrl?: string } = {}) {
  return request<{ ok: true }>(`/api/admin/submissions/${encodeURIComponent(id)}`, { method: "PATCH", body: JSON.stringify({ status, reviewerNotes, ...options }) });
}

function mapProjectRow(row: Record<string, unknown>): Project {
  const promoted = Number(row.promoted ?? 0) === 1;
  return {
    slug: String(row.slug), name: String(row.name), symbol: String(row.symbol), contractAddress: String(row.contract_address),
    projectStatus: String(row.project_status) as ProjectStatus, claimStatus: String(row.claim_status ?? "unclaimed") as Project["claimStatus"],
    pitch: String(row.pitch), description: String(row.description), badges: promoted ? ["Community Listed", "Featured"] : ["Community Listed"],
    logoURI: String(row.logo_url ?? "") || undefined, marketCap: "Live data soon", liquidity: "Live data soon", volume24h: "Live data soon", holders: "Live data soon",
    votes: Number(row.votes ?? 0), listedLabel: new Date(String(row.published_at)).toLocaleDateString(),
    links: { website: String(row.website ?? "") || undefined, x: String(row.x_url ?? "") || undefined, telegram: String(row.telegram_url ?? "") || undefined },
  };
}
function mapSubmissionRow(row: Record<string, unknown>): CoinSubmission {
  return {
    id: String(row.id), name: String(row.name), symbol: String(row.symbol), contractAddress: String(row.contract_address),
    projectStatus: String(row.project_status) as ProjectStatus, pitch: String(row.pitch), description: String(row.description),
    website: String(row.website ?? ""), x: String(row.x_url ?? ""), telegram: String(row.telegram_url ?? ""),
    statusProof: String(row.status_proof_url), submitterEmail: String(row.submitter_email ?? ""), reviewerNote: String(row.reviewer_notes ?? ""),
    status: String(row.status) as CoinSubmission["status"], submittedAt: String(row.created_at),
  };
}
