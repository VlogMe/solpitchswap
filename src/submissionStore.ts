import type { CoinSubmission, SubmissionStatus } from "./types";

const STORAGE_KEY = "solpitch.coin-submissions.v1";

function canUseStorage(): boolean {
  return typeof window !== "undefined" && Boolean(window.localStorage);
}

export function loadSubmissions(): CoinSubmission[] {
  if (!canUseStorage()) return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as CoinSubmission[]) : [];
  } catch {
    return [];
  }
}

export function saveSubmissions(submissions: CoinSubmission[]): void {
  if (!canUseStorage()) return;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(submissions));
}

export function createSubmission(input: Omit<CoinSubmission, "id" | "submittedAt" | "status">): CoinSubmission {
  return {
    ...input,
    id: crypto.randomUUID?.() ?? `submission-${Date.now()}`,
    submittedAt: new Date().toISOString(),
    status: "pending",
  };
}

export function updateSubmissionStatus(
  submissions: CoinSubmission[],
  id: string,
  status: SubmissionStatus,
  reviewerNote = "",
): CoinSubmission[] {
  return submissions.map((submission) =>
    submission.id === id ? { ...submission, status, reviewerNote } : submission,
  );
}
