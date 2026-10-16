import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { rateLimit, rateKey, retryAfterHeader } from "@/lib/rate-limit";
import { deriveRoadmapLive } from "@/lib/roadmap-status";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

/**
 * GET /api/public/roadmap — vivacité des jalons (#234, source de vérité).
 * Seuls les booléens `live` sont pilotés (missions/ateliers publiés) ;
 * le reste est éditorial (false). Libellés côté landing (i18n).
 */
export async function GET(req: NextRequest) {
  const rl = await rateLimit(`roadmap:${rateKey(req)}`, {
    capacity: 60,
    windowMs: 60_000,
  });
  if (!rl.ok) {
    return NextResponse.json(
      { error: "Trop de requêtes.", code: "RATE_LIMITED" },
      {
        status: 429,
        headers: { "Retry-After": retryAfterHeader(rl.retryAfterMs) },
      },
    );
  }
  const [missionsPublished, workshopsPublished] = await Promise.all([
    db.mission.count({ where: { status: "PUBLISHED" } }),
    db.workshop.count({ where: { status: "published" } }),
  ]);
  return NextResponse.json(
    { live: deriveRoadmapLive({ missionsPublished, workshopsPublished }) },
    {
      headers: {
        "Cache-Control": "public, s-maxage=300, stale-while-revalidate=600",
      },
    },
  );
}
