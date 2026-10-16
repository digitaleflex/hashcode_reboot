// HASHCODE REBOOT — rôles et chemins admin : logique PURE, testable sans DB.
//
// Extraite de `admin-auth.ts` / `proxy.ts` / layout admin pour être couverte
// par les tests unitaires (node:test, aucun accès base).
//
// ⚠️ CE MODULE DOIT RESTER SANS AUCUN IMPORT (hormis des types inline) :
// `proxy.ts` s'exécute en Edge runtime et son traçage de build
// (middleware.js.nft.json en mode standalone) suit le graphe d'imports —
// importer `@/lib/auth/admin` (qui tire `@prisma/client`) casserait le build
// de production. Le type `AdminRole` est donc redéclaré ici, en littéral.

/** Rôles admin — union TS, identique à celle de `@/lib/auth/admin`. */
export type AdminRole = "operator" | "viewer";

/**
 * Normalise un rôle brut en `AdminRole`, ou `null` si inconnu.
 *
 * Fail-closed : `null`, chaîne vide, casse/espace parasites, valeur inconnue
 * (« admin », « superadmin », « user »…) ⇒ `null`. Seuls `"operator"` et
 * `"viewer"` ouvrent l'espace admin — jamais de défaut vers operator.
 */
export function normalizeAdminRole(raw: unknown): AdminRole | null {
  if (typeof raw !== "string") return null;
  const role = raw.trim().toLowerCase();
  if (role === "operator") return "operator";
  if (role === "viewer") return "viewer";
  return null;
}

/**
 * Pages publiques de l'espace admin : uniquement le redirecteur /admin/login
 * (vers /login). Plus de formulaire nominatif, plus de setup 2FA séparé.
 *
 * Source unique partagée par `proxy.ts` (Edge) et le layout admin (Node) —
 * les deux doivent impérativement connaître la même liste.
 */
export const PUBLIC_ADMIN_PATHS = ["/admin/login"] as const;

/** true si le chemin (sans préfixe de locale) est une page publique admin. */
export function isPublicAdminPath(pathname: string): boolean {
  return (PUBLIC_ADMIN_PATHS as readonly string[]).includes(pathname);
}

/**
 * Confirme la révocation d'un compte : garde-fous serveur purs.
 * - auto-révocation interdite (on se couperait soi-même) ;
 * - dernier operator protégé (sinon plus aucun admin complet).
 */
export function canRevokeAdmin(params: {
  targetEmail: string;
  targetRole: AdminRole;
  actorEmail: string;
  operatorCount: number;
}): { ok: true } | { ok: false; reason: "SELF_REVOKE" | "LAST_OPERATOR" } {
  if (params.targetEmail.trim().toLowerCase() === params.actorEmail.trim().toLowerCase()) {
    return { ok: false, reason: "SELF_REVOKE" };
  }
  if (params.targetRole === "operator" && params.operatorCount <= 1) {
    return { ok: false, reason: "LAST_OPERATOR" };
  }
  return { ok: true };
}

/** Même logique pour une rétrogradation operator → viewer. */
export function canChangeAdminRole(params: {
  targetEmail: string;
  from: AdminRole;
  to: AdminRole;
  actorEmail: string;
  operatorCount: number;
}): { ok: true } | { ok: false; reason: "LAST_OPERATOR" } {
  if (params.from === "operator" && params.to === "viewer" && params.operatorCount <= 1) {
    return { ok: false, reason: "LAST_OPERATOR" };
  }
  return { ok: true };
}
