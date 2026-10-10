import { NextRequest, NextResponse } from "next/server";
import { isAdminAuthed, getAdminRole } from "@/lib/admin-auth";
import { getAdminSessionFromRequest } from "@/lib/auth/admin";
import { db } from "@/lib/db";

export const runtime = "nodejs";

/**
 * GET /api/admin/verify — check if the current request is admin-authed.
 * Returns { authed, role, identity, expiresAt, twoFactorEnabled }.
 */
export async function GET(req: NextRequest) {
  const isAuthenticated = await isAdminAuthed(req);
  if (!isAuthenticated) {
    return NextResponse.json({ authed: false, role: null });
  }

  const role = await getAdminRole(req);

  // Détails (session admin nominative uniquement — l'ancien chemin membre
  // n'a pas d'expiry propre à réexposer ici).
  let identity: string | null = null;
  let expiresAt: string | null = null;
  let twoFactorEnabled: boolean | null = null;

  const admin = await getAdminSessionFromRequest(req);
  if (admin) {
    identity = admin.email;
    twoFactorEnabled = admin.twoFactorEnabled;
    const session = await db.adminSession.findFirst({
      where: { user: { email: admin.email } },
      orderBy: { expiresAt: "desc" },
      select: { expiresAt: true },
    });
    expiresAt = session?.expiresAt.toISOString() ?? null;
  } else {
    const { getAdminIdentity } = await import("@/lib/admin-auth");
    identity = await getAdminIdentity(req);
  }

  return NextResponse.json({ authed: true, role, identity, expiresAt, twoFactorEnabled });
}
