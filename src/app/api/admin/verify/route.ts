import { NextRequest, NextResponse } from "next/server";
import { isAdminAuthed, getAdminRole, getAdminIdentity } from "@/lib/admin-auth";

export const runtime = "nodejs";

/**
 * GET /api/admin/verify — check if the current request is admin-authed.
 * Source unique : session membre + Member.adminRole.
 * Returns { authed, role, identity }.
 */
export async function GET(req: NextRequest) {
  const isAuthenticated = await isAdminAuthed(req);
  if (!isAuthenticated) {
    return NextResponse.json({ authed: false, role: null });
  }

  const [role, identity] = await Promise.all([getAdminRole(req), getAdminIdentity(req)]);

  return NextResponse.json({ authed: true, role, identity, expiresAt: null, twoFactorEnabled: null });
}
