import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

export const runtime = "nodejs";

/** GET /api/check-email?email=... — used for "already started" detection
 * before submitting, so the UI can offer a resume / status view. */
export async function GET(req: NextRequest) {
  const email = new URL(req.url).searchParams.get("email")?.trim().toLowerCase();
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) {
    return NextResponse.json({ exists: false });
  }
  const existing = await db.member.findUnique({
    where: { email },
    select: {
      id: true,
      accessLane: true,
      profileStatus: true,
      communityStatus: true,
      firstName: true,
    },
  });
  if (!existing) return NextResponse.json({ exists: false });
  return NextResponse.json({
    exists: true,
    memberId: existing.id,
    firstName: existing.firstName,
    accessLane: existing.accessLane,
    profileStatus: existing.profileStatus,
    communityStatus: existing.communityStatus,
  });
}
