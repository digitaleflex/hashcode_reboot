// HASHCODE REBOOT — garde d'accès admin (routes API + server components).
//
// Source de vérité UNIQUE : session membre Better Auth (`better-auth.session_token`)
// + `Member.adminRole` ("operator"/"viewer").
//
// Le système nominatif séparé (AdminUser/AdminSession, cookie `hashcode-admin`,
// page /admin/login) est DÉPRÉCIÉ : /admin/login redirige vers /login.
// Ce module ne lit plus que le chemin membre — fail-closed partout.

import { NextRequest } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { normalizeAdminRole } from "@/lib/admin-roles";
import { isEmailBlacklisted } from "@/lib/blacklist";
import type { AdminRole } from "@/lib/admin-roles";

export type { AdminRole } from "@/lib/admin-roles";

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
 * Chemin unique : session membre + Member.adminRole.
 * Fail-closed : membre absent ou supprimé, email blacklisté, rôle null/inconnu,
 * erreur DB ⇒ null.
 */
async function resolveAdminFromHeaders(
  headers: Record<string, string>,
): Promise<AdminContext | null> {
  try {
    const session = await auth.api.getSession({ headers: headers as never });
    const email = session?.user?.email?.toLowerCase();
    if (!email) return null;
    const member = await db.member.findUnique({
      where: { email },
      select: { adminRole: true, deletedAt: true },
    });
    // Un membre supprimé (soft-delete) perd son accès admin immédiatement,
    // même avec une session encore valide (cookieCache jusqu'à 1 h).
    if (!member || member.deletedAt) return null;
    const role = normalizeAdminRole(member.adminRole);
    if (!role) return null;
    // Même coupe-circuit que `getSession` côté membre : un email blacklisté
    // après sa connexion ne garde pas la main sur l'espace admin.
    if (await isEmailBlacklisted(email)) return null;
    return { email, role };
  } catch {
    return null;
  }
}

/**
 * Rôle admin pour un server component.
 *
 * `proxy.ts` tourne en Edge runtime, où la base n'est pas accessible : le
 * rôle ne peut pas y être évalué. Cette fonction comble ce trou côté serveur
 * (runtime Node) pour que `/admin` refuse un membre authentifié mais
 * non-admin — seul un `Member.adminRole` operator/viewer ouvre l'espace.
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
  return resolveAdminFromHeaders(headers);
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
