/**
 * Unified KV access (Upstash Redis) with in-memory fallback dispatch.
 *
 * Deduplicates the KV fallback logic previously replicated in
 * `rate-limit.ts` and `verify-email.ts` (each had its own `getRedis()`
 * reading `KV_REST_API_URL` / `KV_REST_API_TOKEN` plus its own
 * try-primary / catch-fallback dispatch).
 *
 * - `getKv()` — shared lazily-created Redis client, or `null` when KV
 *   is not configured (or the client cannot be constructed).
 * - `withMemoryFallback()` — run `primary` against Redis when available;
 *   run `fallback` (in-memory path) when KV is missing or the primary
 *   throws. Optional `onFallback` hook preserves per-caller logging
 *   policy (e.g. warn in rate-limit, silent in verify-email).
 *
 * NOTE: `logging.ts` / `logging-client.ts` contain no KV logic, so there
 * was nothing to dedupe there. `rate-limit-key.ts` is IP extraction only
 * (no KV) and is intentionally left untouched.
 */

import { Redis } from "@upstash/redis";

/** Cached client: `undefined` = not resolved yet, `null` = unavailable. */
let cachedKv: Redis | null | undefined;

/** True when KV credentials are present in the environment. */
export function isKvConfigured(): boolean {
  return Boolean(process.env.KV_REST_API_URL && process.env.KV_REST_API_TOKEN);
}

/**
 * Shared Redis client, or `null` when KV is not configured.
 * The client is created once and reused (avoids one `new Redis` per call).
 */
export function getKv(): Redis | null {
  if (cachedKv !== undefined) return cachedKv;
  if (!isKvConfigured()) {
    cachedKv = null;
    return cachedKv;
  }
  try {
    cachedKv = new Redis({
      url: process.env.KV_REST_API_URL as string,
      token: process.env.KV_REST_API_TOKEN as string,
    });
  } catch {
    cachedKv = null;
  }
  return cachedKv;
}

/** Clear the cached client (tests only). */
export function resetKvForTests(): void {
  cachedKv = undefined;
}

/**
 * Run `primary` against Redis when KV is available; otherwise (or when
 * `primary` throws) run the in-memory `fallback`.
 *
 * @param primary - Redis-backed operation.
 * @param fallback - In-memory operation used when KV is missing/failing.
 * @param onFallback - Optional hook invoked with the cause whenever the
 *   fallback path is taken (missing KV or primary error).
 */
export async function withMemoryFallback<T>(
  primary: (kv: Redis) => Promise<T>,
  fallback: () => Promise<T> | T,
  onFallback?: (cause: unknown) => void,
): Promise<T> {
  const kv = getKv();
  if (kv) {
    try {
      return await primary(kv);
    } catch (error) {
      onFallback?.(error);
    }
  } else {
    onFallback?.(new Error("KV not configured"));
  }
  return await fallback();
}
