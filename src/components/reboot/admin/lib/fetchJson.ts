"use client";

import { appendRetryAfter } from "@/lib/admin-client";

/* Centralized fetch wrapper (Phase 2 P0) : standardise 401/429/500 backend
 * {error, code} + Retry-After, sans changer les succès.
 * Extraction telle quelle depuis admin-dashboard.tsx 52-85 (Phase 3 split).
 *
 * D25 : `fetchJson` reste le TRANSPORT. La décision (401 -> connexion,
 * 403 -> refus affiché, 429 -> Retry-After) est dans `src/lib/admin-client.ts`
 * et passe par `adminRequest` / `useAdminQuery`. Ce fichier n'en sait plus. */
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

/** D25 : délègue à la source unique. Conservé pour ses 9 appelants. */
export function withRetryAfter(
  base: string,
  retryAfterSec: number | null,
): string {
  return appendRetryAfter(base, retryAfterSec);
}
