import { NextResponse } from "next/server";
import { adminCookieHeader } from "@/lib/admin-auth";
import { db } from "@/lib/db";

export const runtime = "nodejs";

/** POST /api/admin/logout — clear admin cookie. */
export async function POST() {
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
