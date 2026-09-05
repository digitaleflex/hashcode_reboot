import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { rateLimit, rateKey, retryAfterHeader } from "@/lib/rate-limit";

export const runtime = "nodejs";

/**
 * GET /api/community/count — public endpoint that returns ONLY the total
 * member count (no PII). Used by the landing footer live counter for social
 * proof. No auth required (the count alone is not sensitive).
 */
export async function GET(req: NextRequest) {
  // Anti-abus : 30 lectures par IP toutes les 10 minutes.
  // refillPerSec = 1/20 req/sec = 3 req/min = 30 req/10min (window)
  const rl = await rateLimit(`community-count:${rateKey(req)}`, {
    capacity: 30,
    windowMs: 600000, // 10 minutes
  });
  if (!rl.ok) {
    return NextResponse.json(
      { error: "Trop de requêtes. Réessaie dans quelques minutes." },
      {
        status: 429,
        headers: { "Retry-After": retryAfterHeader(rl.retryAfterMs) },
      },
    );
  }
  const total = await db.member.count({
    where: { profileStatus: { in: ["APPROVED", "PENDING"] } },
  });
  return NextResponse.json({ count: total });
}
