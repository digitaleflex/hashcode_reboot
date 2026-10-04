/**
 * Helpers d'UI pour le parcours d'authentification (email → code).
 *
 * Volontairement hors de `src/lib/auth/**` : ce module ne touche ni au
 * backend Better Auth ni au schéma Prisma. Il ne contient que de la logique
 * de présentation pure, testable et sans dépendance serveur.
 */

/** Destination par défaut après une connexion réussie. */
export const DEFAULT_NEXT = "/dashboard";

/**
 * Filtre anti open-redirect — défense en profondeur.
 *
 * `magic-link.test.cjs` rejoue exactement cette règle : seuls les chemins
 * internes starting with "/" sont acceptés, et `//evil.com` (protocol-relative)
 * est rejeté au profit de `/dashboard`.
 */
export function sanitizeNext(rawNext: string | null | undefined): string {
  if (!rawNext) return DEFAULT_NEXT;
  return rawNext.startsWith("/") && !rawNext.startsWith("//") ? rawNext : DEFAULT_NEXT;
}

/**
 * Masque une adresse pour l'affichage : `a***@gmail.com`.
 *
 * L'email reste en clair dans l'URL (le lien magique en dépend) mais ne doit
 * pas être lisible par-dessus l'épaule pendant la saisie du code.
 */
export function maskEmail(email: string): string {
  const value = email.trim();
  const at = value.lastIndexOf("@");
  if (at <= 0) return value ? `${value.slice(0, 1)}***` : "";
  const local = value.slice(0, at);
  const domain = value.slice(at + 1);
  const hidden = "*".repeat(Math.min(3, Math.max(2, local.length - 1)));
  return `${local.slice(0, 1)}${hidden}@${domain}`;
}

/* ------------------------------------------------------------------ */
/* Mapping des erreurs serveur → messages curatés                      */
/* ------------------------------------------------------------------ */

export type AuthErrorKind =
  /** Code / adresse refusés par le serveur. */
  | "invalid"
  /** Code trop ancien : il faut en demander un nouveau. */
  | "expired"
  /** Budget de tentatives du code épuisé côté serveur. */
  | "tooManyAttempts"
  /** 429 / rate limit (10 requêtes / 10 s sur le login). */
  | "rateLimited"
  /** Panne réseau : la requête n'est pas arrivée. */
  | "network"
  | "unavailable"
  | "generic";

/**
 * Traduit une réponse Better Auth en catégorie d'erreur affichable.
 *
 * Règle absolue : AUCUN texte du serveur n'est renvoyé tel quel à l'écran.
 * On ne regarde que `status` et `code` — deux valeurs stables — et chaque
 * résultat est rendu par une chaîne i18n curatée. C'est ce qui évite
 * d'exposer « 500 », « USER_NOT_FOUND » ou un message technique interne.
 *
 * Codes retenus côté Better Auth (plugins/email-otp) :
 * INVALID_OTP, OTP_EXPIRED, TOO_MANY_ATTEMPTS, RATE_LIMITED, USER_NOT_FOUND.
 */
export function classifyAuthError(err: unknown): AuthErrorKind {
  if (!err || typeof err !== "object") return "network";

  const e = err as { status?: unknown; statusCode?: unknown; code?: unknown };
  const status = Number(e.status ?? e.statusCode ?? 0);
  const code = typeof e.code === "string" ? e.code.toUpperCase() : "";

  if (status === 429 || code === "RATE_LIMITED" || code === "TOO_MANY_REQUESTS") {
    return "rateLimited";
  }
  if (status >= 500) return "unavailable";
  if (code === "OTP_EXPIRED") return "expired";
  if (code === "TOO_MANY_ATTEMPTS" || status === 403) return "tooManyAttempts";
  if (code === "INVALID_OTP" || code === "INVALID_EMAIL" || code === "USER_NOT_FOUND") {
    return "invalid";
  }
  if (status >= 400) return "generic";
  // Sans status exploitable : échec de transport (fetch interrompu, DNS…).
  return "network";
}