import { NextRequest, NextResponse } from "next/server";
import { isAdminAuthed, getAdminRoleFromToken, readAdminCookie } from "@/lib/admin-auth";

export const runtime = "nodejs";

/**
 * GET /api/admin/verify — check if the current request is admin-authed.
 * Returns { authed, role } where role is "viewer" | "operator" | null.
 */
export async function GET(req: NextRequest): Promise<{ authed: boolean; role: "viewer" | "operator" | null }> {
  const token = readAdminCookie(req);
  const isAuthenticated = isAdminAuthed(req);
  if (!isAuthenticated) {
    return { authed: false, role: null };
  }
  const role = getAdminRoleFromToken(token);
  return { authed: true, role };
}
