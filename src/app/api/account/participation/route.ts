import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSession } from "@/lib/account-auth";
import { deriveProgress } from "@/lib/missions/engine";
import { AuthError, errorToResponse } from "@/lib/errors";
import type { AssignmentStatus } from "@/lib/missions/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

/**
 * GET /api/account/participation — parcours unifié (#233).
 * Agrège missions (assignations), ateliers (inscriptions) et événements
 * (RSVP) du membre en une seule lecture. Auth via middleware (401 sans
 * cookie) + session ici. Zéro PII d'autrui (que ses propres lignes).
 */
export async function GET(req: NextRequest) {
  try {
    const session = await getSession(req);
    if (!session) throw new AuthError("Non authentifié.", "UNAUTHENTICATED");

    const memberId = session.member.id;
    const [assignments, enrollments, rsvps] = await Promise.all([
      db.missionAssignment.findMany({
        where: { memberId },
        orderBy: { createdAt: "desc" },
        select: {
          id: true,
          status: true,
          createdAt: true,
          validatedAt: true,
          mission: {
            select: {
              id: true,
              slug: true,
              title: true,
              domain: true,
              level: true,
              status: true,
            },
          },
        },
      }),
      db.workshopEnrollment.findMany({
        where: { memberId },
        orderBy: { enrolledAt: "desc" },
        select: {
          id: true,
          status: true,
          enrolledAt: true,
          workshop: {
            select: { id: true, slug: true, title: true, status: true },
          },
        },
      }),
      db.eventRsvp.findMany({
        where: { memberId, status: { not: "cancelled" } },
        orderBy: { createdAt: "desc" },
        select: {
          id: true,
          status: true,
          createdAt: true,
          event: {
            select: { id: true, title: true, startsAt: true, status: true },
          },
        },
      }),
    ]);

    const missionsProgress = deriveProgress(
      assignments.map((a) => ({
        missionId: a.mission.id,
        status: a.status as AssignmentStatus,
      })),
    );

    return NextResponse.json({
      missions: assignments,
      workshops: enrollments,
      events: rsvps,
      progress: missionsProgress,
      counts: {
        missions: assignments.length,
        workshops: enrollments.length,
        events: rsvps.length,
      },
    });
  } catch (err) {
    return errorToResponse(err);
  }
}
