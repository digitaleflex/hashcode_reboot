import { NextRequest, NextResponse } from "next/server";
import { checkCSRF } from "@/lib/admin-auth";
import { db } from "@/lib/db";
import { toServerEventData } from "@/lib/analytics";

export const runtime = "nodejs";

/**
 * POST /api/admin/logout — déconnexion admin (= déconnexion membre).
 * Source unique : session membre OTP. Purge best-effort de l'ancien
 * cookie nominatif `hashcode-admin` pour les navigateurs qui l'ont encore.
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
    const { auth } = await import("@/lib/auth");
    await auth.api.signOut({ headers: headers as never });
  } catch {
    /* best-effort */
  }

  // Purge best-effort de l'ancien cookie nominatif (système déprécié).
  try {
    const { adminAuth } = await import("@/lib/auth/admin");
    await adminAuth.api.signOut({ headers: headers as never });
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
