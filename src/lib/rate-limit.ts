/**
 * Lightweight in-memory rate-limiter (per-environment; survives requests but
 * not process restarts — sufficient for anti-spam on a single-server V1).
 *
 * For production multi-instance deployment, swap with Redis-backed limiter.
 */

interface Bucket {
  tokens: number;
  last: number;
}

const buckets = new Map<string, Bucket>();

interface RateLimitOptions {
  /** Max tokens in bucket. */
  capacity: number;
  /** Tokens added per second. */
  refillPerSec: number;
}

/** Returns true if allowed, false if rate-limited. */
export function rateLimit(
  key: string,
  opts: RateLimitOptions,
): { ok: boolean; remaining: number; retryAfterMs: number } {
  const now = Date.now();
  let b = buckets.get(key);
  if (!b) {
    b = { tokens: opts.capacity, last: now };
    buckets.set(key, b);
  }
  // Refill.
  const elapsed = (now - b.last) / 1000;
  b.tokens = Math.min(opts.capacity, b.tokens + elapsed * opts.refillPerSec);
  b.last = now;

  if (b.tokens >= 1) {
    b.tokens -= 1;
    return { ok: true, remaining: Math.floor(b.tokens), retryAfterMs: 0 };
  }
  // Time until 1 token available.
  const retryAfterMs = Math.ceil((1 - b.tokens) / opts.refillPerSec * 1000);
  return { ok: false, remaining: 0, retryAfterMs };
}

/** Extract a stable client key from the request (IP + UA hash). */
export function rateKey(req: Request): string {
  const xff = req.headers.get("x-forwarded-for") ?? "";
  const ip = xff.split(",")[0]?.trim() || req.headers.get("x-real-ip") || "anon";
  const ua = req.headers.get("user-agent") ?? "";
  return `${ip}:${ua.slice(0, 40)}`;
}

/** Prune stale buckets every 5 min to prevent memory leak. */
if (typeof setInterval !== "undefined") {
  setInterval(() => {
    const cutoff = Date.now() - 5 * 60 * 1000;
    for (const [k, b] of buckets) {
      if (b.last < cutoff) buckets.delete(k);
    }
  }, 5 * 60 * 1000).unref?.();
}
