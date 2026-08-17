const API_BASE = (import.meta.env.VITE_API_BASE_URL as string | undefined)?.replace(/\/$/, "") ?? "https://api.solpitch.com";

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

export type AdminProject = {
  id: string;
  slug: string;
  name: string;
  symbol: string;
  contractAddress: string;
  pitch: string;
  description: string;
  website: string;
  xUrl: string;
  telegramUrl: string;
  logoUrl: string;
  claimStatus: "unclaimed" | "pending" | "verified" | "disputed";
  addedToSwap: boolean;
  promoted: boolean;
  votes: number;
};

function mapProject(row: Record<string, unknown>): AdminProject {
  return {
    id: String(row.id),
    slug: String(row.slug),
    name: String(row.name),
    symbol: String(row.symbol),
    contractAddress: String(row.contract_address),
    pitch: String(row.pitch ?? ""),
    description: String(row.description ?? ""),
    website: String(row.website ?? ""),
    xUrl: String(row.x_url ?? ""),
    telegramUrl: String(row.telegram_url ?? ""),
    logoUrl: String(row.logo_url ?? ""),
    claimStatus: String(row.claim_status ?? "unclaimed") as AdminProject["claimStatus"],
    addedToSwap: Number(row.added_to_swap ?? 0) === 1,
    promoted: Number(row.promoted ?? 0) === 1,
    votes: Number(row.votes ?? 0),
  };
}

export async function getAdminProjects(query = "") {
  const result = await request<{ projects: Record<string, unknown>[] }>(`/api/admin/projects${query ? `?q=${encodeURIComponent(query)}` : ""}`);
  return result.projects.map(mapProject);
}

export async function updateAdminProject(id: string, values: Partial<{
  name: string;
  symbol: string;
  pitch: string;
  description: string;
  website: string;
  xUrl: string;
  telegramUrl: string;
  logoUrl: string;
  claimStatus: AdminProject["claimStatus"];
  addedToSwap: boolean;
  promoted: boolean;
}>) {
  return request<{ ok: true }>(`/api/admin/projects/${encodeURIComponent(id)}`, {
    method: "PATCH",
    body: JSON.stringify(values),
  });
}

export async function deleteAdminProject(id: string) {
  return request<{ ok: true }>(`/api/admin/projects/${encodeURIComponent(id)}`, { method: "DELETE" });
}

export async function resetProjectVotes(id: string) {
  return request<{ ok: true }>(`/api/admin/projects/${encodeURIComponent(id)}/reset-votes`, {
    method: "POST",
    body: "{}",
  });
}
