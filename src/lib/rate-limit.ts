/**
 * Redis-backed rate limiter with in-memory fallback.
 *
 * Sliding-window token bucket per key.
 * Key format: `${ip}` (or `${ip}-${passcode}` for login).
 * Limits: login = 10 req / 10 s, write = 20 req / 10 min.
 *
 * Uses Upstash Redis for distributed rate limiting across Vercel edge functions
 * and load balancer instances. Falls back to in-memory if Redis is unavailable.
 */

import { rateKey } from "./rate-limit-key";
import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";

// Redis-backed rate limiter with in-memory fallback
const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL!,
  token: process.env.UPSTASH_REDIS_REST_TOKEN!
});

const rateLimitRedis = new Ratelimit({
  redis,
  // Use sliding window algorithm for smooth rate limiting
  limiter: Ratelimit.slidingWindow(10, "10 s"),
  // Fallback to in-memory if Redis fails
  ephemeralCache: new Map(),
});

/** Configuration for a rate limit. */
interface RateLimitConfig {
  capacity: number;
  windowMs: number;
}

/** Result of a rate-limit check. */
interface RateLimitResult {
  ok: boolean;
  remaining: number;
  retryAfterMs: number;
}

/** In-memory bucket (fallback). */
interface Bucket {
  tokens: number;
  last: number;
}

const memoryBuckets = new Map<string, Bucket>();

/** Prune stale buckets every 5 min to prevent memory leak. */
if (typeof setInterval !== "undefined") {
  setInterval(() => {
    const cutoff = Date.now() - 5 * 60 * 1000;
    for (const [k, b] of memoryBuckets) {
      if (b.last < cutoff) memoryBuckets.delete(k);
    }
  }, 5 * 60 * 1000).unref?.();
}

/**
 * In-memory sliding-window rate limiter (fallback).
 */
function memoryRateLimit(key: string, config: RateLimitConfig): RateLimitResult {
  const now = Date.now();
  let b = memoryBuckets.get(key);
  if (!b) {
    b = { tokens: config.capacity, last: now };
    memoryBuckets.set(key, b);
  }
  const elapsed = (now - b.last) / 1000;
  const refillPerSec = config.capacity / (config.windowMs / 1000);
  b.tokens = Math.min(config.capacity, b.tokens + elapsed * refillPerSec);
  b.last = now;

  if (b.tokens >= 1) {
    b.tokens -= 1;
    return { ok: true, remaining: Math.floor(b.tokens), retryAfterMs: 0 };
  }
  let retryAfterMs = Math.ceil((1 - b.tokens) / refillPerSec * 1000);
  if (!Number.isFinite(retryAfterMs) || retryAfterMs < 0) {
    retryAfterMs = config.windowMs > 0 ? config.windowMs : 1000;
  }
  return { ok: false, remaining: 0, retryAfterMs };
}

/**
 * Redis-backed rate limiter.
 * @param key - Rate-limit key (IP or IP-passcode).
 * @param config - Capacity and window configuration.
 */
export async function redisRateLimit(key: string, config: RateLimitConfig): Promise<RateLimitResult> {
  const result = await rateLimitRedis.limit(
    key,
    config.capacity,
    config.windowMs / 1000
  );
  return {
    ok: result.success,
    remaining: result.remaining,
    retryAfterMs: result.reset - Date.now()
  };
}

/**
 * Main rate-limit function.
 * Uses Redis when available, falls back to in-memory.
 * @param key - Rate-limit key (IP or IP-passcode).
 * @param config - Capacity and window configuration.
 */
export async function rateLimit(
  key: string,
  config: RateLimitConfig,
): Promise<RateLimitResult> {
  try {
    return await redisRateLimit(key, config);
  } catch (error) {
    // Fallback to in-memory if Redis fails
    console.warn("Redis rate limit failed, falling back to in-memory:", error);
    return memoryRateLimit(key, config);
  }
}

/** Build a valid HTTP `Retry-After` header value (seconds).
 * Per RFC 7231 §7.1.3: must be a non-negative integer (delta-seconds).
 * Guards against NaN/Infinity/negative numbers. */
export function retryAfterHeader(retryAfterMs: number, fallbackMs = 1000): string {
  let sec = Math.ceil(retryAfterMs / 1000);
  if (!Number.isFinite(sec) || sec < 0) sec = Math.ceil(fallbackMs / 1000);
  return String(sec);
}

/** Re-export rateKey from the shared key module. */
export { rateKey };

/** Pre-configured limiters for different endpoint categories. */
export const RATE_LIMITS = {
  login: { capacity: 10, windowMs: 10 * 1000 },
  write: { capacity: 20, windowMs: 10 * 60 * 1000 },
} as const;
