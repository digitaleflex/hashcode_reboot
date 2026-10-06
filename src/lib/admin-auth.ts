import { NextRequest } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";

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

/**
 * Resolve the current Better Auth session and the admin role for it, if admin.
 *
 * Accepte soit un `NextRequest` (routes API), soit un objet `headers` — les
 * server components n'ont pas de `NextRequest` mais lisent `next/headers`.
 *
 * La colonne `Member.adminRole` est la seule source de vérité : seuls les
 * rôles exacts `"operator"` et `"viewer"` (après normalisation
 * casse/espaces) ouvrent l'espace admin. Tout le reste — rôle `null`,
 * membre introuvable, valeur inconnue, erreur DB, session absente — vaut
 * `null` ⇒ pas admin (fail-closed, jamais de défaut vers operator).
 */
async function resolveAdminSessionFromHeaders(headers: Record<string, string>) {
  try {
    const session = await auth.api.getSession({ headers: headers as any });
    const email = session?.user?.email?.toLowerCase();
    if (!email) return null;
    let member: { adminRole: string | null } | null;
    try {
      member = await db.member.findUnique({
        where: { email },
        select: { adminRole: true },
      });
    } catch {
      return null;
    }
    const role = String(member?.adminRole ?? "")
      .trim()
      .toLowerCase();
    if (role === "operator") return { email, role: "operator" as const };
    if (role === "viewer") return { email, role: "viewer" as const };
    return null;
  } catch {
    return null;
  }
}

async function resolveAdminSession(req: NextRequest) {
  return resolveAdminSessionFromHeaders(Object.fromEntries(req.headers));
}

/**
 * Rôle admin pour un server component.
 *
 * `proxy.ts` tourne en Edge runtime, où la base de données n'est pas
 * accessible : le rôle ne peut donc pas y être évalué. Cette
 * fonction comble ce trou côté serveur (runtime Node) pour que `/admin`
 * refuse un membre authentifié mais non-admin — un cookie Better Auth valide
 * ne suffit pas à ouvrir l'espace admin.
 */
export async function getAdminRoleFromRequestHeaders(): Promise<{
  email: string;
  role: "viewer" | "operator";
} | null> {
  try {
    const { headers } = await import("next/headers");
    const headersObj = Object.fromEntries((await headers()).entries());
    return resolveAdminSessionFromHeaders(headersObj);
  } catch {
    return null;
  }
}

/** Check if the current request is from an authenticated admin (any role). */
export async function isAdminAuthed(req: NextRequest): Promise<boolean> {
  return (await resolveAdminSession(req)) !== null;
}

/** Get the admin role for this request, or null if not an admin. */
export async function getAdminRole(req: NextRequest): Promise<"viewer" | "operator" | null> {
  return (await resolveAdminSession(req))?.role ?? null;
}

/** Get the admin identity (email) for this request, or "unknown". */
export async function getAdminIdentity(req: NextRequest): Promise<string> {
  return (await resolveAdminSession(req))?.email ?? "unknown";
}

/**
 * Require admin authentication with a specific role.
 * operator can access everything; viewer only viewer-level resources.
 */
export async function requireAdminRole(
  req: NextRequest,
  allowedRole: "viewer" | "operator" = "operator",
): Promise<boolean> {
  const ctx = await resolveAdminSession(req);
  if (!ctx) return false;
  return ctx.role === "operator" || ctx.role === allowedRole;
}
