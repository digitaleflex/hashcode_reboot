/**
 * HASHCODE REBOOT — vérification anti-bot Cloudflare Turnstile (#215).
 *
 * Le widget (s'il est chargé côté client) dépose un token dans le body
 * (`turnstileToken`, optionnel, jamais bloquant côté client). Ce module
 * décide côté serveur, sur POST /api/members uniquement :
 * - dev (clé absente + NODE_ENV != "production") : fail-open — warn + skip,
 *   et aucun appel réseau si le client n'a fourni aucun token ;
 * - prod : fail-closed — clé absente, token absent ou vérification KO
 *   (y compris erreur réseau) → refus, sans créer le membre.
 *
 * Pur et testable : `extractTurnstileToken` / `shouldBypassTurnstile` sont
 * synchrones et sans I/O ; `verifyTurnstile` accepte un `fetchFn` injecté
 * (les tests n'appellent jamais le réseau).
 */

export const TURNSTILE_VERIFY_URL =
  "https://challenges.cloudflare.com/turnstile/v0/siteverify";

/** Taille max d'un token (garde-fou : un token Turnstile fait ~500 octets). */
export const TURNSTILE_TOKEN_MAX_LEN = 2048;

/** Délai max de l'appel de vérification (jamais bloquant pour l'UX). */
export const TURNSTILE_TIMEOUT_MS = 5000;

export interface TurnstileCheck {
  ok: boolean;
  /** Vrai quand la vérification a été ignorée (dev uniquement). */
  skipped?: boolean;
}

/**
 * Extrait le token anti-bot optionnel du body brut (jamais bloquant :
 * absent ou malformé → null, la décision appartient à `verifyTurnstile`).
 */
export function extractTurnstileToken(body: unknown): string | null {
  if (!body || typeof body !== "object" || Array.isArray(body)) return null;
  const raw = (body as Record<string, unknown>).turnstileToken;
  if (typeof raw !== "string") return null;
  const token = raw.trim();
  if (!token || token.length > TURNSTILE_TOKEN_MAX_LEN) return null;
  return token;
}

/**
 * Fail-open dev : pas de secret configuré hors production → la
 * vérification est ignorée (avec warn côté appelant).
 */
export function shouldBypassTurnstile(
  env: NodeJS.ProcessEnv = process.env,
): boolean {
  return !env.TURNSTILE_SECRET_KEY && env.NODE_ENV !== "production";
}

interface VerifyOptions {
  secret?: string;
  remoteIp?: string | null;
  fetchFn?: typeof fetch;
  env?: NodeJS.ProcessEnv;
}

/**
 * Vérifie un token Turnstile auprès de Cloudflare.
 * - Clé absente : fail-open en dev (warn + skip), fail-closed en prod.
 * - Token absent : aucun appel réseau ; warn + skip en dev, refus en prod.
 * - Réponse KO ou erreur réseau : warn + skip en dev, refus en prod.
 */
export async function verifyTurnstile(
  token: string | null,
  opts: VerifyOptions = {},
): Promise<TurnstileCheck> {
  const env = opts.env ?? process.env;
  const secret = opts.secret ?? env.TURNSTILE_SECRET_KEY;
  const isProd = env.NODE_ENV === "production";

  if (!secret) {
    if (isProd) {
      console.warn(
        "[turnstile] TURNSTILE_SECRET_KEY absente en production — inscription refusée (fail-closed).",
      );
      return { ok: false };
    }
    console.warn(
      "[turnstile] TURNSTILE_SECRET_KEY absente — vérification ignorée (dev uniquement).",
    );
    return { ok: true, skipped: true };
  }

  if (!token) {
    // Client sans widget (non chargé, bloqueur, JS coupé) : on n'envoie
    // rien au vérificateur sans token — warn + skip en dev, refus en prod.
    if (isProd) return { ok: false };
    console.warn(
      "[turnstile] aucun token fourni — vérification ignorée (dev uniquement).",
    );
    return { ok: true, skipped: true };
  }

  try {
    const params = new URLSearchParams({ secret, response: token });
    if (opts.remoteIp) params.set("remoteip", opts.remoteIp);
    const res = await (opts.fetchFn ?? fetch)(TURNSTILE_VERIFY_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: params,
      signal: AbortSignal.timeout(TURNSTILE_TIMEOUT_MS),
    });
    const data = (await res
      .json()
      .catch(() => null)) as { success?: boolean } | null;
    if (data?.success === true) return { ok: true };
    if (isProd) return { ok: false };
    console.warn(
      "[turnstile] vérification refusée — inscription acceptée (dev uniquement).",
    );
    return { ok: true, skipped: true };
  } catch (err) {
    if (isProd) {
      console.warn(
        "[turnstile] erreur de vérification en production — inscription refusée (fail-closed).",
        err instanceof Error ? err.message : err,
      );
      return { ok: false };
    }
    console.warn(
      "[turnstile] erreur de vérification — inscription acceptée (dev uniquement).",
      err instanceof Error ? err.message : err,
    );
    return { ok: true, skipped: true };
  }
}
