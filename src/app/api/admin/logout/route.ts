import { NextResponse } from "next/server";
import { adminCookieHeader } from "@/lib/admin-auth";

export const runtime = "nodejs";

/** POST /api/admin/logout — clear admin cookie. */
export async function POST() {
  return NextResponse.json(
    { ok: true },
    { headers: { "Set-Cookie": adminCookieHeader(null) } },
  );
}
