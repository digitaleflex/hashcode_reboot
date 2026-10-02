import { NextRequest, NextResponse } from "next/server";
import { checkCSRF } from "@/lib/admin-auth";
import { db } from "@/lib/db";
import { auth } from "@/lib/auth";

export const runtime = "nodejs";

/** POST /api/admin/logout — sign out via Better Auth. */
export async function POST(req: NextRequest) {
  // CSRF protection: ensure same-origin request (defense in depth alongside SameSite=Lax)
  if (!checkCSRF(req)) {
    return NextResponse.json({ error: "CSRF validation failed." }, { status: 403 });
  }
  try {
    await auth.api.signOut({ headers: Object.fromEntries(req.headers.entries()) as any });
  } catch {
    /* best-effort */
  }
  try {
    await db.analyticsEvent.create({
      data: { type: "community_cta_clicked", ref: "admin-logout" },
    });
  } catch {
    /* ignore */
  }
  return NextResponse.json({ ok: true });
}
