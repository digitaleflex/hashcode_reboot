import { NextRequest, NextResponse } from "next/server";
import { isAdminAuthed } from "@/lib/admin-auth";

export const runtime = "nodejs";

/** GET /api/admin/verify — check if the current request is admin-authed. */
export async function GET(req: NextRequest) {
  return NextResponse.json({ authed: isAdminAuthed(req) });
}
