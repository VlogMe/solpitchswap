import type { CoinSubmission } from "./types";

const API_BASE = (import.meta.env.VITE_API_BASE_URL as string | undefined)?.replace(/\/$/, "") ?? "";

type ApiError = { error?: string };

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const response = await fetch(`${API_BASE}${path}`, {
    ...init,
    credentials: "include",
    headers: { "content-type": "application/json", ...(init.headers ?? {}) },
  });
  const body = await response.json().catch(() => ({})) as T & ApiError;
  if (!response.ok) throw new Error(body.error || `Request failed (${response.status})`);
  return body;
}

export type SubmissionPayload = {
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

export async function submitCoin(payload: SubmissionPayload) {
  return request<{ id: string; status: "pending" }>("/api/submissions", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function adminLogin(password: string) {
  return request<{ ok: true }>("/api/admin/login", {
    method: "POST",
    body: JSON.stringify({ password }),
  });
}

export async function adminLogout() {
  return request<{ ok: true }>("/api/admin/logout", { method: "POST", body: "{}" });
}

export async function getAdminSession() {
  return request<{ authenticated: boolean }>("/api/admin/session");
}

export async function getPendingSubmissions() {
  const result = await request<{ submissions: Record<string, unknown>[] }>("/api/admin/submissions?status=pending");
  return result.submissions.map(mapSubmissionRow);
}

export async function reviewSubmission(id: string, status: "approved" | "rejected", reviewerNotes: string) {
  return request<{ ok: true }>(`/api/admin/submissions/${encodeURIComponent(id)}`, {
    method: "PATCH",
    body: JSON.stringify({ status, reviewerNotes }),
  });
}

function mapSubmissionRow(row: Record<string, unknown>): CoinSubmission {
  return {
    id: String(row.id),
    name: String(row.name),
    symbol: String(row.symbol),
    contractAddress: String(row.contract_address),
    pitch: String(row.pitch),
    description: String(row.description),
    website: String(row.website ?? ""),
    x: String(row.x_url ?? ""),
    telegram: String(row.telegram_url ?? ""),
    graduationProof: String(row.graduation_proof_url),
    submitterEmail: String(row.submitter_email ?? ""),
    reviewerNote: String(row.reviewer_notes ?? ""),
    status: String(row.status) as CoinSubmission["status"],
    submittedAt: String(row.created_at),
  };
}
