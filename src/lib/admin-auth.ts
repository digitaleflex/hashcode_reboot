// HASHCODE REBOOT — garde d'accès admin (routes API + server components).
//
// Source de vérité : la session Better Auth ADMIN (`hashcode-admin.session_token`,
// cf. src/lib/auth/admin.ts) — compte nominatif avec rôle operator/viewer.
//
// PÉRIODE DE TRANSITION (migration passcode → comptes nominatifs) : à
// défaut de session admin, on tente l'ancien chemin (session membre +
// `Member.adminRole`) pour ne pas couper les sessions déjà ouvertes. Cette
// branche de compatibilité sera retirée une fois tous les admins migrés
// (voir scripts/migrate-admin-keys.ts et la migration follow-up qui supprime
// AdminKey).

import { NextRequest } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import {
  getAdminSessionFromHeaders,
  getAdminSessionFromRequest,
  type AdminRole,
} from "@/lib/auth/admin";
import { normalizeAdminRole } from "@/lib/admin-roles";

export type { AdminRole } from "@/lib/auth/admin";

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

type AdminContext = { email: string; role: AdminRole; twoFactorEnabled?: boolean };

/**
 * Ancien chemin (compatibilité transition) : session membre + Member.adminRole.
 * Fail-closed partout : membre absent, rôle null/inconnu, erreur DB ⇒ null.
 */
async function resolveLegacyAdminSession(
  headers: Record<string, string>,
): Promise<AdminContext | null> {
  try {
    const session = await auth.api.getSession({ headers: headers as never });
    const email = session?.user?.email?.toLowerCase();
    if (!email) return null;
    const member = await db.member.findUnique({
      where: { email },
      select: { adminRole: true },
    });
    const role = normalizeAdminRole(member?.adminRole);
    if (!role) return null;
    return { email, role };
  } catch {
    return null;
  }
}

/**
 * Résout le contexte admin depuis des headers bruts (routes API, SC).
 * Ordre : session admin nominative (vérité), puis ancien chemin membre.
 */
async function resolveAdminFromHeaders(
  headers: Record<string, string>,
): Promise<AdminContext | null> {
  const admin = await getAdminSessionFromHeaders(headers);
  if (admin) {
    return { email: admin.email, role: admin.role, twoFactorEnabled: admin.twoFactorEnabled };
  }
  // Ancien chemin (transition) : pas d'info 2FA — undefined = indéterminé,
  // le layout ne force alors rien (les comptes non migrés n'ont pas de 2FA
  // à enroler ; ils en recevront une à la migration).
  return resolveLegacyAdminSession(headers);
}

/**
 * Rôle admin pour un server component.
 *
 * `proxy.ts` tourne en Edge runtime, où la base n'est pas accessible : le
 * rôle ne peut pas y être évalué. Cette fonction comble ce trou côté serveur
 * (runtime Node) pour que `/admin` refuse un membre authentifié mais
 * non-admin — un cookie Better Auth membre valide ne suffit PAS à ouvrir
 * l'espace admin (seul `hashcode-admin.session_token` le fait ; l'ancien
 * chemin Member.adminRole est conservé le temps de la migration).
 */
export async function getAdminRoleFromRequestHeaders(): Promise<AdminContext | null> {
  try {
    const { headers } = await import("next/headers");
    const headersObj = Object.fromEntries((await headers()).entries());
    return resolveAdminFromHeaders(headersObj);
  } catch {
    return null;
  }
}

/** Contexte admin complet (email + rôle) pour un server component. */
export async function getAdminContextFromRequestHeaders(): Promise<AdminContext | null> {
  return getAdminRoleFromRequestHeaders();
}

/** Check if the current request is from an authenticated admin (any role). */
export async function isAdminAuthed(req: NextRequest): Promise<boolean> {
  return (await resolveAdminFromRequest(req)) !== null;
}

async function resolveAdminFromRequest(req: NextRequest): Promise<AdminContext | null> {
  const headers = Object.fromEntries(req.headers.entries()) as Record<string, string>;
  const admin = await getAdminSessionFromRequest(req);
  if (admin) return { email: admin.email, role: admin.role };
  return resolveLegacyAdminSession(headers);
}

/** Get the admin role for this request, or null if not an admin. */
export async function getAdminRole(req: NextRequest): Promise<AdminRole | null> {
  return (await resolveAdminFromRequest(req))?.role ?? null;
}

/** Get the admin identity (email) for this request, or "unknown". */
export async function getAdminIdentity(req: NextRequest): Promise<string> {
  return (await resolveAdminFromRequest(req))?.email ?? "unknown";
}

/**
 * Require admin authentication with a specific role.
 * operator can access everything; viewer only viewer-level resources.
 */
export async function requireAdminRole(
  req: NextRequest,
  allowedRole: "viewer" | "operator" = "operator",
): Promise<boolean> {
  const ctx = await resolveAdminFromRequest(req);
  if (!ctx) return false;
  return ctx.role === "operator" || ctx.role === allowedRole;
}
