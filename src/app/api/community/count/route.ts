import { NextResponse } from "next/server";
import { db } from "@/lib/db";

export const runtime = "nodejs";

/**
 * GET /api/community/count — public endpoint that returns ONLY the total
 * member count (no PII). Used by the landing footer live counter for social
 * proof. No auth required (the count alone is not sensitive).
 */
export async function GET() {
  const total = await db.member.count({
    where: { profileStatus: { in: ["APPROVED", "PENDING"] } },
  });
  return NextResponse.json({ count: total });
}
