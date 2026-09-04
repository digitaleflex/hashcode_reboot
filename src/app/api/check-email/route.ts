import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { rateLimit, rateKey } from "@/lib/rate-limit";

export const runtime = "nodejs";

/** GET /api/check-email?email=... — used for "already started" detection
 * before submitting, so the UI can offer a resume / status view. */
export async function GET(req: NextRequest) {
  // Anti-abus : 30 vérifications par IP toutes les 10 minutes.
  const rl = rateLimit(`check-email:${rateKey(req)}`, {
    capacity: 30,
    refillPerSec: 1 / 20,
  });
  if (!rl.ok) {
    return NextResponse.json(
      { error: "Trop de requêtes. Réessaie dans quelques minutes." },
      {
        status: 429,
        headers: { "Retry-After": String(Math.ceil(rl.retryAfterMs / 1000)) },
      },
    );
  }
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
