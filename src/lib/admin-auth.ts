import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { AppError, AuthError, ForbiddenError, ErrorBody, errorToResponse } from "@/lib/errors";

/** Check if the request origin matches the host (CSRF protection). */
export function checkCSRF(req: NextRequest): boolean {
  const origin = req.headers.get("origin");
  const host = req.headers.get("host");
  if (!origin || !host) return false;
  try {
    const originUrl = new URL(origin);
    return originUrl.host === host;
  } catch {
    return false;
  }
}

/** Admin email allow-lists (comma-separated env vars). */
function adminOperators(): string[] {
  return (process.env.ADMIN_OPERATORS || "")
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
}
function adminViewers(): string[] {
  return (process.env.ADMIN_VIEWERS || "")
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
}

/**
 * Every email allowed into the admin space, whatever its role.
 *
 * Single source of truth, shared by `resolveAdminSession` (authorization) and
 * `POST /api/admin/login` (gate) so the two can never disagree.
 *
 * Fail-closed by construction: an empty list means NOBODY is an admin. Never
 * reintroduce an `allowList.length === 0 -> allow everyone` shortcut — it turns
 * one missing env var into a full admin bypass.
 */
export function adminAllowList(): string[] {
  const legacy = (process.env.ADMIN_EMAILS || "")
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
  return [...adminOperators(), ...adminViewers(), ...legacy];
}

/**
 * Resolve the current Better Auth session and the admin role for it, if admin.
 *
 * Accepte soit un `NextRequest` (routes API), soit un objet `headers` — les
 * server components n'ont pas de `NextRequest` mais lisent `next/headers`.
 * Fail-closed : toute erreur ou session absente ⇒ `null` ⇒ pas admin.
 */
async function resolveAdminSessionFromHeaders(headers: Record<string, string>) {
  try {
    const session = await auth.api.getSession({ headers: headers as any });
    const email = session?.user?.email?.toLowerCase();
    if (!email) return null;
    if (adminOperators().includes(email)) return { email, role: "operator" as const };
    if (adminViewers().includes(email)) return { email, role: "viewer" as const };
    if (adminAllowList().includes(email)) return { email, role: "operator" as const };
    return null;
  } catch {
    return null;
  }
}

async function resolveAdminSession(req: NextRequest) {
  return resolveAdminSessionFromHeaders(Object.fromEntries(req.headers));
}

export type AdminRole = "viewer" | "operator";

/** Session admin résolue, ou absence de session admin. */
export interface AdminSession {
  email: string;
  role: AdminRole;
}

/**
 * Rôle admin pour un server component.
 *
 * `proxy.ts` tourne en Edge runtime, où la base de données n'est pas
 * accessible : la liste blanche ne peut donc pas y être évaluée. Cette
 * fonction comble ce trou côté serveur (runtime Node) pour que `/admin`
 * refuse un membre authentifié mais non-admin — un cookie Better Auth valide
 * ne suffit pas à ouvrir l'espace admin.
 */
export async function getAdminRoleFromRequestHeaders(): Promise<AdminSession | null> {
  try {
    const { headers } = await import("next/headers");
    const headersObj = Object.fromEntries((await headers()).entries());
    return resolveAdminSessionFromHeaders(headersObj);
  } catch {
    return null;
  }
}

/**
 * Verdict discriminant du garde admin.
 *
 * La distinction porte sur DEUX questions qui étaient confondues jusqu'ici :
 *   - `unauthenticated`  : « qui es-tu ? » → 401, le client doit re-logguer.
 *   - `insufficient_role`: « as-tu le droit ? » → 403, la session est valide,
 *                           re-logguer ne sert à rien.
 *
 * Un booléen ne permettait pas de brancher les deux : les 28 routes
 * `requireAdminRole()` renvoyaient 401 « pas admin » ET 401 « viewer sur une
 * route operator », ce qui faisait croire à une session expirée et faisait
 * boucler les clients qui réessaient sur 401.
 */
export type AdminGuard =
  | { ok: true; role: AdminRole; email: string }
  | { ok: false; reason: "unauthenticated" | "insufficient_role" };

/** Check if the current request is from an authenticated admin (any role). */
export async function isAdminAuthed(req: NextRequest): Promise<boolean> {
  return (await resolveAdminSession(req)) !== null;
}

/** Get the admin role for this request, or null if not an admin. */
export async function getAdminRole(req: NextRequest): Promise<AdminRole | null> {
  return (await resolveAdminSession(req))?.role ?? null;
}

/** Get the admin identity (email) for this request, or "unknown". */
export async function getAdminIdentity(req: NextRequest): Promise<string> {
  return (await resolveAdminSession(req))?.email ?? "unknown";
}

/**
 * Garde admin unique : une seule résolution de session, deux verdicts distincts.
 *
 * `operator` passe partout ; `viewer` ne passe que sur les routes `viewer`.
 * Remplace `requireAdminRole()`, qui ne renvoyait qu'un booléen et interdisait
 * donc à l'appelant de distinguer 401 de 403 (cf. `AdminGuard`).
 */
export async function requireAdmin(
  req: NextRequest,
  allowedRole: AdminRole = "operator",
): Promise<AdminGuard> {
  const ctx = await resolveAdminSession(req);
  if (!ctx) return { ok: false, reason: "unauthenticated" };
  if (ctx.role === "operator" || ctx.role === allowedRole) {
    return { ok: true, role: ctx.role, email: ctx.email };
  }
  return { ok: false, reason: "insufficient_role" };
}

/**
 * Traduit le verdict du garde en `AppError`, via `errors.ts`.
 *
 * On réutilise `AuthError` (401) et `ForbiddenError` (403) : aucune hiérarchie
 * d'erreur parallèle n'est introduite, le vocabulaire de `errors.ts` reste
 * l'unique source de vérité.
 *
 *   - `unauthenticated`   → 401 `AUTH_REQUIRED`  (« pas de session admin »)
 *   - `insufficient_role` → 403 `FORBIDDEN`      (« session valide, droits insuffisants »)
 *
 * Le message ne varie plus selon la route : c'est le statut et le `code` qui
 * portent le sens. Les 6 variantes de message pour un même refus disparaissent.
 */
export function adminGuardError(guard: Extract<AdminGuard, { ok: false }>): AppError {
  if (guard.reason === "unauthenticated") {
    return new AuthError("Authentification requise.");
  }
  return new ForbiddenError("Accès refusé.");
}

/**
 * Même chose, déjà convertie en `NextResponse` par `errorToResponse`.
 *
 * Pour les routes qui `return` au lieu de lever (et n'ont pas de `try/catch`).
 */
export function adminGuardResponse(
  guard: Extract<AdminGuard, { ok: false }>,
): NextResponse<ErrorBody> {
  return errorToResponse(adminGuardError(guard));
}

/**
 * Variante « throw » du garde, pour les routes déjà encadrées par
 * `try { … } catch { errorToResponse(err) }` : même verdict, levé en AppError.
 *
 * Retourne la session admin résolue (email + rôle) : évite la seconde
 * résolution de session quand la route a aussi besoin de l'identité (cf. D28).
 */
export async function requireAdminOrThrow(
  req: NextRequest,
  allowedRole: AdminRole = "operator",
): Promise<AdminSession> {
  const guard = await requireAdmin(req, allowedRole);
  if (!guard.ok) throw adminGuardError(guard);
  return { email: guard.email, role: guard.role };
}

