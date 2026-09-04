"use client";

/* Centralized fetch wrapper (Phase 2 P0) : standardise 401/429/500 backend
 * {error, code} + Retry-After, sans changer les succès.
 * Extraction telle quelle depuis admin-dashboard.tsx 52-85 (Phase 3 split). */
export async function fetchJson(
  url: string,
  init?: RequestInit,
): Promise<{
  res: Response;
  data: any;
  error: string | null;
  code: string | undefined;
  retryAfterSec: number | null;
}> {
  const res = await fetch(url, init);
  let data: any = null;
  try {
    data = await res.json();
  } catch {
    data = null;
  }
  const code = (data as { code?: string } | null)?.code;
  const error = (data as { error?: string } | null)?.error ?? null;
  const rawRetry = res.headers.get("Retry-After");
  const parsed = rawRetry !== null ? Number(rawRetry) : NaN;
  const retryAfterSec =
    rawRetry !== null && Number.isFinite(parsed) ? parsed : null;
  return { res, data, error, code, retryAfterSec };
}

export function isAbortError(e: unknown): boolean {
  return e instanceof DOMException && e.name === "AbortError";
}

export function withRetryAfter(
  base: string,
  retryAfterSec: number | null,
): string {
  if (retryAfterSec !== null)
    return `${base} Réessaie dans ${retryAfterSec}s.`;
  return base;
}
