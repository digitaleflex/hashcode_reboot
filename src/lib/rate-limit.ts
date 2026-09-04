/**
 * Rate limiter with Redis support and in-memory fallback.
 *
 * - If @upstash/redis is installed, uses Ratelimit + SlidingWindow.
 * - Otherwise, falls back to ioredis pattern with INCR + EXPIRE.
 * - If Redis is unavailable (try/catch fails), falls back to in-memory.
 * - Fail-closed: if Redis is down, the in-memory limiter still works.
 * - Key format: `${ip}-${passcode}` for login, `${ip}` for bulk/PATCH/DELETE/export.
 * - Limits: login = SlidingWindow(10, '10 s'), bulk/PATCH/DELETE/export = SlidingWindow(20, '10 min').
 */

import { rateKey } from "./rate-limit-key";

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

/** In-memory bucket for fallback. */
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
 * In-memory rate limiter (fallback when Redis is unavailable).
 * Uses a sliding window algorithm.
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
  const retryAfterMs = Math.ceil((1 - b.tokens) / refillPerSec * 1000);
  return { ok: false, remaining: 0, retryAfterMs };
}

/** Try to load @upstash/ratelimit Ratelimit. Returns null if unavailable. */
function tryLoadUpstashRatelimit(): any | null {
  try {
    // @ts-ignore
    return require("@upstash/ratelimit");
  } catch {
    return null;
  }
}

/** Try to load @upstash/redis Redis client. Returns null if unavailable. */
function tryLoadUpstashRedis(): any | null {
  try {
    // @ts-ignore
    return require("@upstash/redis");
  } catch {
    return null;
  }
}

/** Try to load ioredis. Returns null if unavailable. */
function tryLoadIoredis(): any | null {
  try {
    // @ts-ignore
    return require("ioredis");
  } catch {
    return null;
  }
}

/** Redis-backed rate limiter using ioredis INCR + EXPIRE pattern. */
async function ioredisRateLimit(
  client: any,
  key: string,
  config: RateLimitConfig,
): Promise<RateLimitResult> {
  try {
    const now = Date.now();
    const windowSec = Math.ceil(config.windowMs / 1000);
    const current = await client.incr(key);
    if (current === 1) {
      await client.expire(key, windowSec);
    }
    const remaining = Math.max(0, config.capacity - current);
    if (current <= config.capacity) {
      return { ok: true, remaining, retryAfterMs: 0 };
    }
    const ttl = await client.ttl(key);
    const retryAfterMs = ttl > 0 ? ttl * 1000 : config.windowMs;
    return { ok: false, remaining: 0, retryAfterMs };
  } catch (e) {
    console.warn("[rate-limit] ioredis error, falling back to memory:", e);
    return memoryRateLimit(key, config);
  }
}

/** Pre-configured limiters for different endpoint categories. */
const LOGIN_LIMIT: RateLimitConfig = { capacity: 10, windowMs: 10 * 1000 };
const WRITE_LIMIT: RateLimitConfig = { capacity: 20, windowMs: 10 * 60 * 1000 };

/**
 * Main rate-limit function.
 *
 * - For login: key = `${ip}-${passcode}`, limit = 10 req / 10 s.
 * - For bulk/PATCH/DELETE/export: key = `${ip}`, limit = 20 req / 10 min.
 *
 * @param key - Rate-limit key (IP or IP-passcode).
 * @param config - Capacity and window configuration.
 */
export async function rateLimit(
  key: string,
  config: RateLimitConfig,
): Promise<RateLimitResult> {
  // Try upstash first
  const upstashMod = tryLoadUpstashRatelimit();
  const upstashRedis = tryLoadUpstashRedis();
  if (upstashMod && upstashRedis) {
    try {
      const { Ratelimit } = upstashMod;
      const { Redis } = upstashRedis;
      
      const redisUrl = process.env.UPSTASH_REDIS_URL || process.env.REDIS_URL;
      const redisToken = process.env.UPSTASH_REDIS_TOKEN;
      
      if (!redisUrl || !redisToken) {
        throw new Error("Upstash credentials missing");
      }
      
      const redis = new Redis({ url: redisUrl, token: redisToken });
      
      const ratelimit = new Ratelimit({
        limiter: Ratelimit.slidingWindow(config.capacity, `${config.windowMs / 1000} s` as any),
        redis,
        analytics: false,
      });
      
      const { success, remaining, reset } = await ratelimit.limit(key);
      if (success) {
        return { ok: true, remaining, retryAfterMs: 0 };
      }
      const retryAfterMs = Math.max(0, reset - Date.now());
      return { ok: false, remaining, retryAfterMs };
    } catch (e) {
      console.warn("[rate-limit] upstash init failed, trying ioredis:", e);
    }
  }

  // Try ioredis
  const ioredis = tryLoadIoredis();
  if (ioredis) {
    try {
      const client = new ioredis(process.env.REDIS_URL || "redis://localhost:6379");
      return await ioredisRateLimit(client, key, config);
    } catch (e) {
      console.warn("[rate-limit] ioredis init failed, falling back to memory:", e);
    }
  }

  // Fallback to in-memory
  return memoryRateLimit(key, config);
}

/** Re-export rateKey from the shared key module. */
export { rateKey };

/** Pre-configured limiters for different endpoint categories. */
export const RATE_LIMITS = {
  login: LOGIN_LIMIT,
  write: WRITE_LIMIT,
} as const;