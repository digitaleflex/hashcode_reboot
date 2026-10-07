/**
 * Vérification email par lien magique (1 clic, pas de OTP).
 *
 * Flow onboarding : on collecte l'email au début sans bloquer,
 * on envoie le lien à la fin (2e email avec l'invitation).
 *
 * Stockage Redis (Upstash) avec fallback mémoire.
 * - Lien : TTL 24 h, usage unique, 1 lien actif par email, renvoi min 60 s.
 * - Flag vérifié : TTL 30 jours (couvre la fin du flow + login ultérieur).
 */

import { getKv, withMemoryFallback } from "./kv";
import { randomBytes } from "node:crypto";
import { sendVerificationLinkEmail } from "./email/builders";

const LINK_TTL_SEC = 24 * 60 * 60;
const VERIFIED_TTL_SEC = 30 * 24 * 60 * 60;
const RESEND_COOLDOWN_SEC = 60;

/* --- Fallback mémoire (dev / Redis indisponible) --- */
interface LinkEntry {
  email: string;
  createdAt: number;
}
const memLinks = new Map<string, { entry: LinkEntry; expiresAt: number }>();
const memEmailToToken = new Map<string, string>();
const memLastSent = new Map<string, number>();
const memVerified = new Map<string, number>();

const linkKey = (token: string) => `verify-email:link:${token}`;
const emailLinkKey = (email: string) =>
  `verify-email:email-link:${email.trim().toLowerCase()}`;
const cooldownKey = (email: string) =>
  `verify-email:cooldown:${email.trim().toLowerCase()}`;
const verifiedKey = (email: string) =>
  `verify-email:verified:${email.trim().toLowerCase()}`;

function makeToken(): string {
  return randomBytes(32).toString("base64url");
}

/** URL absolue de vérification (toujours absolue, jamais localhost en prod). */
export function buildVerifyUrl(token: string): string {
  const base =
    process.env.NEXT_PUBLIC_SITE_URL ||
    process.env.NEXT_PUBLIC_URL ||
    "https://reboot.joinhashcode.com";
  return `${base.replace(/\/$/, "")}/verify-email?token=${encodeURIComponent(token)}`;
}

export async function requestEmailLink(
  email: string,
): Promise<{ ok: boolean; token: string; cooldownSec?: number }> {
  const norm = email.trim().toLowerCase();
  const now = Date.now();

  return withMemoryFallback(
    async (redis) => {
      // Cooldown 60 s par email (clé dédiée, pas écrasée par les tentatives).
      const cd = await redis.get<unknown>(cooldownKey(norm));
      if (cd != null) {
        const ttl = await redis.ttl(cooldownKey(norm)).catch(() => RESEND_COOLDOWN_SEC);
        const wait = typeof ttl === "number" && ttl > 0 ? ttl : RESEND_COOLDOWN_SEC;
        return { ok: false, token: "", cooldownSec: wait };
      }
      // Invalider l'ancien lien actif pour cet email (anti double-lien).
      try {
        const oldTokenRaw = await redis.get<unknown>(emailLinkKey(norm));
        const oldToken =
          typeof oldTokenRaw === "string"
            ? oldTokenRaw
            : typeof oldTokenRaw === "object" && oldTokenRaw !== null
              ? String((oldTokenRaw as { token?: unknown }).token ?? "")
              : "";
        if (oldToken) await redis.del(linkKey(oldToken)).catch(() => {});
      } catch {
        /* best-effort */
      }
      const token = makeToken();
      const entry: LinkEntry = { email: norm, createdAt: now };
      await redis.set(linkKey(token), JSON.stringify(entry), { ex: LINK_TTL_SEC });
      await redis.set(emailLinkKey(norm), token, { ex: LINK_TTL_SEC });
      await redis.set(cooldownKey(norm), "1", { ex: RESEND_COOLDOWN_SEC });
      return { ok: true, token };
    },
    async () => {
      const last = memLastSent.get(norm) ?? 0;
      const ageSec = Math.floor((now - last) / 1000);
      if (last && ageSec < RESEND_COOLDOWN_SEC) {
        return { ok: false, token: "", cooldownSec: RESEND_COOLDOWN_SEC - ageSec };
      }
      // Invalider l'ancien lien mémoire.
      const old = memEmailToToken.get(norm);
      if (old) memLinks.delete(old);
      const token = makeToken();
      memLinks.set(token, {
        entry: { email: norm, createdAt: now },
        expiresAt: now + LINK_TTL_SEC * 1000,
      });
      memEmailToToken.set(norm, token);
      memLastSent.set(norm, now);
      return { ok: true, token };
    },
  );
}

export type ConfirmLinkResult = { ok: true; email: string } | { ok: false; reason: "expired" | "invalid" };

function parseLinkEntry(raw: unknown): LinkEntry | null {
  if (raw == null) return null;
  if (typeof raw === "object") {
    const e = raw as Partial<LinkEntry>;
    if (typeof e.email === "string" && e.email.includes("@")) {
      return {
        email: e.email.trim().toLowerCase(),
        createdAt: typeof e.createdAt === "number" ? e.createdAt : Date.now(),
      };
    }
    return null;
  }
  if (typeof raw === "string") {
    try {
      const e = JSON.parse(raw) as Partial<LinkEntry>;
      if (typeof e.email === "string" && e.email.includes("@")) {
        return {
          email: e.email.trim().toLowerCase(),
          createdAt: typeof e.createdAt === "number" ? e.createdAt : Date.now(),
        };
      }
      return null;
    } catch {
      // Valeur simple (token stocké comme string dans emailLinkKey) → pas un LinkEntry.
      return null;
    }
  }
  return null;
}

export async function confirmEmailLink(token: string): Promise<ConfirmLinkResult> {
  const clean = (token || "").trim();
  if (!clean || clean.length < 16) return { ok: false, reason: "invalid" };
  const now = Date.now();

  return withMemoryFallback(
    async (redis) => {
      const raw = await redis.get<unknown>(linkKey(clean));
      const entry = parseLinkEntry(raw);
      if (!entry) return { ok: false, reason: "expired" };
      // Usage unique : on supprime le lien + le mapping email->token.
      await redis.del(linkKey(clean)).catch(() => {});
      try {
        const mapped = await redis.get<unknown>(emailLinkKey(entry.email));
        const mappedToken = typeof mapped === "string" ? mapped : "";
        if (mappedToken === clean) await redis.del(emailLinkKey(entry.email)).catch(() => {});
      } catch {
        /* best-effort */
      }
      await redis.set(verifiedKey(entry.email), "1", { ex: VERIFIED_TTL_SEC });
      return { ok: true, email: entry.email };
    },
    async () => {
      const mem = memLinks.get(clean);
      if (!mem || mem.expiresAt <= now) {
        memLinks.delete(clean);
        return { ok: false, reason: "expired" };
      }
      memLinks.delete(clean);
      const mapped = memEmailToToken.get(mem.entry.email);
      if (mapped === clean) memEmailToToken.delete(mem.entry.email);
      memVerified.set(mem.entry.email, now + VERIFIED_TTL_SEC * 1000);
      return { ok: true, email: mem.entry.email };
    },
  );
}

export async function isEmailVerified(email: string): Promise<boolean> {
  const norm = email.trim().toLowerCase();
  // NB : pas de withMemoryFallback ici — un "miss" Redis (clé absente) doit
  // quand même consulter le store mémoire, pas seulement les erreurs Redis.
  const redis = getKv();
  if (redis) {
    try {
      // Upstash peut retourner "1" (string) ou 1 (number via JSON.parse("1")) → test truthy.
      const v = await redis.get<unknown>(verifiedKey(norm));
      if (v != null && v !== "" && v !== 0) return true;
    } catch {
      /* fallback mémoire */
    }
  }
  const exp = memVerified.get(norm);
  if (exp && exp > Date.now()) return true;
  if (exp) memVerified.delete(norm);
  return false;
}

/* ── Envoi mutualisé du lien de vérification ───────────────────────────── */

export type VerificationLinkOutcome =
  | { ok: true }
  | { ok: false; reason: "cooldown"; cooldownSec: number }
  | { ok: false; reason: "send_failed" };

/**
 * Émet un lien magique puis l'envoie par email (requestEmailLink +
 * buildVerifyUrl + sendVerificationLinkEmail en un seul appel).
 *
 * Mutualise la séquence dupliquée entre POST /api/members (onboarding) et
 * POST /api/verify-email (renvoi). Ne lève jamais : tout échec est journalisé
 * et retourné dans `VerificationLinkOutcome` (le cooldown 60 s reste géré par
 * `requestEmailLink`, l'appelant décide — 429 côté /api/verify-email, silencieux
 * côté onboarding).
 */
export async function sendVerificationLink(
  email: string,
  firstName: string,
): Promise<VerificationLinkOutcome> {
  const name = (firstName || "").trim() || "toi";
  let link: { ok: boolean; token: string; cooldownSec?: number };
  try {
    link = await requestEmailLink(email);
  } catch (err) {
    console.error("[sendVerificationLink] requestEmailLink : exception", err);
    return { ok: false, reason: "send_failed" };
  }
  if (!link.ok) {
    return { ok: false, reason: "cooldown", cooldownSec: link.cooldownSec ?? 60 };
  }
  try {
    const result = await sendVerificationLinkEmail({
      to: email,
      firstName: name,
      url: buildVerifyUrl(link.token),
    });
    if (!result.ok) {
      console.warn("[sendVerificationLink] envoi du lien échoué", {
        provider: result.provider,
        status: result.status,
        error: result.error,
        email,
      });
      return { ok: false, reason: "send_failed" };
    }
    return { ok: true };
  } catch (err) {
    console.error("[sendVerificationLink] envoi du lien : exception", err);
    return { ok: false, reason: "send_failed" };
  }
}
