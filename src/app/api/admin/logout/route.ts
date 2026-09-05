import { NextRequest, NextResponse } from "next/server";
import { adminCookieHeader, checkCSRF } from "@/lib/admin-auth";
import { db } from "@/lib/db";

export const runtime = "nodejs";

/** POST /api/admin/logout — clear admin cookie. */
export async function POST(req: NextRequest) {
  // CSRF protection: ensure same-origin request (defense in depth alongside SameSite=Lax)
  if (!checkCSRF(req)) {
    return NextResponse.json({ error: "CSRF validation failed." }, { status: 403 });
  }
  // Audit isolé : ne casse jamais le logout si l'audit échoue.
  try {
    await db.analyticsEvent.create({
      data: { type: "community_cta_clicked", ref: "admin-logout" },
    });
  } catch {
    /* ignore */
  }
  return NextResponse.json(
    { ok: true },
    { headers: { "Set-Cookie": adminCookieHeader(null) } },
  );
}
