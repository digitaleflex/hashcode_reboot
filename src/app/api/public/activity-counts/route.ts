import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { rateLimit, rateKey, retryAfterHeader } from "@/lib/rate-limit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

/**
 * GET /api/public/activity-counts — compteurs agrégés par activité (#235).
 * Preuve sociale SANS PII : seuls des nombres (jamais d'identités).
 * Missions publiées + validations, ateliers publiés + inscriptions actives,
 * événements à venir + RSVP. Prêt pour la section communauté (#133).
 */
export async function GET(req: NextRequest) {
  const rl = await rateLimit(`activity-counts:${rateKey(req)}`, {
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

  const now = new Date();
  const [
    missionsPublished,
    missionsValidated,
    workshopsPublished,
    workshopEnrollments,
    upcomingEvents,
    goingRsvps,
  ] = await Promise.all([
    db.mission.count({ where: { status: "PUBLISHED" } }),
    db.missionAssignment.count({ where: { status: "VALIDATED" } }),
    db.workshop.count({ where: { status: "published" } }),
    db.workshopEnrollment.count({ where: { status: "active" } }),
    db.event.count({
      where: { status: { in: ["scheduled", "live"] }, startsAt: { gte: now } },
    }),
    db.eventRsvp.count({ where: { status: "going" } }),
  ]);

  return NextResponse.json(
    {
      missions: { published: missionsPublished, validated: missionsValidated },
      workshops: { published: workshopsPublished, enrollments: workshopEnrollments },
      events: { upcoming: upcomingEvents, going: goingRsvps },
    },
    {
      headers: {
        "Cache-Control": "public, s-maxage=60, stale-while-revalidate=300",
      },
    },
  );
}
