// HASHCODE REBOOT — contrôles santé partagés (DB + mails + manifeste routes).
// Ne journalise ni ne retourne JAMAIS de valeur secrète (noms d'env uniquement).

import { db } from "@/lib/db";

/** Sonde Neon : SELECT 1 avec garde-fou 8000ms (couvre les cold starts ~3.5s). Ne lève jamais. */
export async function checkDb(): Promise<{ ok: boolean; latencyMs: number }> {
  const started = Date.now();
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    await Promise.race([
      db.$queryRaw`SELECT 1`,
      new Promise<never>((_, reject) => {
        timer = setTimeout(() => reject(new Error("db-timeout")), 8000);
      }),
    ]);
    return { ok: true, latencyMs: Date.now() - started };
  } catch {
    return { ok: false, latencyMs: Date.now() - started };
  } finally {
    if (timer !== undefined) clearTimeout(timer);
  }
}

export type MailStatus =
  | "valid"
  | "limited"
  | "invalid"
  | "unconfigured"
  | "rate-limited";

const MAIL_CACHE_MS = 30 * 60 * 1000; // 30 min (limite Resend : 10 req/s)
let mailCache: {
  at: number;
  value: { status: MailStatus; detail: string };
} | null = null;

/** Sonde Resend (mise en cache 30 min, jamais de secret en sortie). */
export async function checkMail(): Promise<{
  status: MailStatus;
  detail: string;
}> {
  if (mailCache !== null && Date.now() - mailCache.at < MAIL_CACHE_MS) {
    return mailCache.value;
  }
  const key = process.env.RESEND_API_KEY;
  if (!key) {
    const value = {
      status: "unconfigured" as const,
      detail: "RESEND_API_KEY non configurée",
    };
    mailCache = { at: Date.now(), value };
    return value;
  }
  try {
    const res = await fetch("https://api.resend.com/domains", {
      headers: { Authorization: `Bearer ${key}` },
      signal: AbortSignal.timeout(5000),
    });
    let value: { status: MailStatus; detail: string };
    if (res.status === 200) {
      value = { status: "valid", detail: "Resend OK" };
    } else if (res.status === 429) {
      value = { status: "rate-limited", detail: "Resend limite atteinte (429)" };
    } else if (res.status === 401 || res.status === 403) {
      // Les clés "Sending access" (envoi seul) ne peuvent pas lister les
      // domaines → 401/403 ici alors qu'elles PEUVENT envoyer. Indissociable
      // d'une clé invalide via cet appel → statut "limited", pas "invalid".
      // Seul un vrai envoi de test tranche (cf. POST /api/admin/test-email).
      value = {
        status: "limited",
        detail: `Resend (${res.status}) — clé envoi-seul probable, envoi à tester`,
      };
    } else {
      value = { status: "invalid", detail: `Resend inattendu (${res.status})` };
    }
    mailCache = { at: Date.now(), value };
    return value;
  } catch {
    const value = { status: "invalid" as const, detail: "unreachable" };
    mailCache = { at: Date.now(), value };
    return value;
  }
}
