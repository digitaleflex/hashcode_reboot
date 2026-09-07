/**
 * Vérification email par code OTP (6 chiffres).
 *
 * Stockage Redis (Upstash) avec fallback mémoire.
 * - Code : TTL 10 min, 5 tentatives max, renvoi min 60 s.
 * - Flag vérifié : TTL 2 h (couvre la fin du flow).
 */

import { Redis } from "@upstash/redis";

const CODE_TTL_SEC = 10 * 60;
const VERIFIED_TTL_SEC = 2 * 60 * 60;
const RESEND_COOLDOWN_SEC = 60;
const MAX_ATTEMPTS = 5;

function getRedis(): Redis | null {
  try {
    const url = process.env.KV_REST_API_URL;
    const token = process.env.KV_REST_API_TOKEN;
    if (!url || !token) return null;
    return new Redis({ url, token });
  } catch {
    return null;
  }
}

/* --- Fallback mémoire (dev / Redis indisponible) --- */
interface CodeEntry {
  code: string;
  attempts: number;
  sentAt: number;
}
const memCodes = new Map<string, { entry: CodeEntry; expiresAt: number }>();
const memVerified = new Map<string, number>();

const codeKey = (email: string) => `verify-email:code:${email.trim().toLowerCase()}`;
const verifiedKey = (email: string) => `verify-email:verified:${email.trim().toLowerCase()}`;

function makeCode(): string {
  return String(Math.floor(100000 + Math.random() * 900000));
}

export async function requestEmailCode(
  email: string,
): Promise<{ ok: boolean; code: string; cooldownSec?: number }> {
  const norm = email.trim().toLowerCase();
  const redis = getRedis();
  const now = Date.now();

  if (redis) {
    try {
      const raw = await redis.get<string>(codeKey(norm));
      if (raw) {
        try {
          const entry = JSON.parse(raw) as CodeEntry;
          const ageSec = Math.floor((now - entry.sentAt) / 1000);
          if (ageSec < RESEND_COOLDOWN_SEC) {
            return { ok: false, code: "", cooldownSec: RESEND_COOLDOWN_SEC - ageSec };
          }
        } catch {
          /* entrée corrompue → on régénère */
        }
      }
      const code = makeCode();
      const entry: CodeEntry = { code, attempts: 0, sentAt: now };
      await redis.set(codeKey(norm), JSON.stringify(entry), { ex: CODE_TTL_SEC });
      return { ok: true, code };
    } catch {
      /* tombe sur le fallback mémoire */
    }
  }

  const mem = memCodes.get(norm);
  if (mem && mem.expiresAt > now) {
    const ageSec = Math.floor((now - mem.entry.sentAt) / 1000);
    if (ageSec < RESEND_COOLDOWN_SEC) {
      return { ok: false, code: "", cooldownSec: RESEND_COOLDOWN_SEC - ageSec };
    }
  }
  const code = makeCode();
  memCodes.set(norm, {
    entry: { code, attempts: 0, sentAt: now },
    expiresAt: now + CODE_TTL_SEC * 1000,
  });
  return { ok: true, code };
}

export type ConfirmResult =
  | { ok: true }
  | { ok: false; reason: "expired" | "invalid" | "locked" };

export async function confirmEmailCode(email: string, code: string): Promise<ConfirmResult> {
  const norm = email.trim().toLowerCase();
  const clean = code.trim();
  const redis = getRedis();
  const now = Date.now();

  if (redis) {
    try {
      const raw = await redis.get<string>(codeKey(norm));
      if (!raw) return { ok: false, reason: "expired" };
      let entry: CodeEntry;
      try {
        entry = JSON.parse(raw) as CodeEntry;
      } catch {
        await redis.del(codeKey(norm));
        return { ok: false, reason: "expired" };
      }
      if (entry.attempts >= MAX_ATTEMPTS) {
        await redis.del(codeKey(norm));
        return { ok: false, reason: "locked" };
      }
      if (entry.code !== clean) {
        entry.attempts += 1;
        await redis.set(codeKey(norm), JSON.stringify(entry), { ex: CODE_TTL_SEC });
        return { ok: false, reason: "invalid" };
      }
      await redis.del(codeKey(norm));
      await redis.set(verifiedKey(norm), "1", { ex: VERIFIED_TTL_SEC });
      return { ok: true };
    } catch {
      /* fallback mémoire */
    }
  }

  const mem = memCodes.get(norm);
  if (!mem || mem.expiresAt <= now) {
    memCodes.delete(norm);
    return { ok: false, reason: "expired" };
  }
  if (mem.entry.attempts >= MAX_ATTEMPTS) {
    memCodes.delete(norm);
    return { ok: false, reason: "locked" };
  }
  if (mem.entry.code !== clean) {
    mem.entry.attempts += 1;
    return { ok: false, reason: "invalid" };
  }
  memCodes.delete(norm);
  memVerified.set(norm, now + VERIFIED_TTL_SEC * 1000);
  return { ok: true };
}

export async function isEmailVerified(email: string): Promise<boolean> {
  const norm = email.trim().toLowerCase();
  const redis = getRedis();
  if (redis) {
    try {
      const v = await redis.get<string>(verifiedKey(norm));
      if (v) return true;
    } catch {
      /* fallback mémoire */
    }
  }
  const exp = memVerified.get(norm);
  if (exp && exp > Date.now()) return true;
  if (exp) memVerified.delete(norm);
  return false;
}
