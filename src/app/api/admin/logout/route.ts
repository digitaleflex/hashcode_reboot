import { NextRequest, NextResponse } from "next/server";
import { checkCSRF } from "@/lib/admin-auth";
import { adminAuth } from "@/lib/auth/admin";
import { db } from "@/lib/db";
import { toServerEventData } from "@/lib/analytics";

export const runtime = "nodejs";

/**
 * POST /api/admin/logout — déconnexion admin.
 *
 * Signe d'abord la session ADMIN (cookie `hashcode-admin.session_token`),
 * puis — période de migration — la session membre si elle existe (un admin
 * connecté par l'ancien chemin avait les deux cookies actifs).
 */
export async function POST(req: NextRequest) {
  // CSRF protection: ensure same-origin request (defense in depth alongside SameSite=Lax)
  if (!checkCSRF(req)) {
    return NextResponse.json({ error: "CSRF validation failed." }, { status: 403 });
  }

  const headers = Object.fromEntries(req.headers.entries()) as Record<string, string>;

  // Identité AVANT révocation (pour l'audit analytics).
  const { getAdminIdentity } = await import("@/lib/admin-auth");
  const identity = await getAdminIdentity(req);

  try {
    await adminAuth.api.signOut({ headers: headers as never });
  } catch {
    /* best-effort */
  }

  // Transition : coupe aussi l'ancienne session membre si présente.
  try {
    const { auth } = await import("@/lib/auth");
    await auth.api.signOut({ headers: headers as never });
  } catch {
    /* best-effort */
  }

  try {
    await db.analyticsEvent.create({
      data: toServerEventData({ type: "community_cta_clicked", ref: `admin-logout:${identity}` }),
    });
  } catch {
    /* ignore */
  }

  return NextResponse.json({ ok: true });
}
