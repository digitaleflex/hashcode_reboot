import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/account-auth";
import { db } from "@/lib/db";
import { rateLimit, rateKey, retryAfterHeader } from "@/lib/rate-limit";
import {
  buildExportPayload,
  EXPORT_ANALYTICS_MAX,
} from "@/lib/account-rgpd";

export const runtime = "nodejs";

/**
 * GET /api/account/export
 *
 * Export RGPD : le membre connecté télécharge l'intégralité de ses données
 * (profil, RSVP, progression ateliers, emails reçus, brouillon, sessions,
 * événements analytics liés, plafonnés).
 * Lecture seule : pas de garde TESTING, pas de mutation.
 *
 * Anti-abus : 10 exports / IP / 10 min.
 */
export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json(
      { error: "Non authentifié.", code: "UNAUTHENTICATED" },
      { status: 401 },
    );
  }

  const rl = await rateLimit(`account-export:${rateKey(req)}`, {
    capacity: 10,
    windowMs: 10 * 60 * 1000,
  });
  if (!rl.ok) {
    return NextResponse.json(
      { error: "Trop de requêtes. Réessaie dans quelques minutes.", code: "RATE_LIMITED" },
      { status: 429, headers: { "Retry-After": retryAfterHeader(rl.retryAfterMs) } },
    );
  }

  const memberId = session.member.id;
  const email = session.member.email;

  const [member, rsvps, enrollments, submissions, quizAttempts, emailLogs, sessions, draft, analytics] =
    await Promise.all([
      db.member.findUnique({ where: { id: memberId } }),
      db.eventRsvp.findMany({
        where: { memberId },
        select: { id: true, status: true, createdAt: true, event: { select: { id: true, title: true, startsAt: true } } },
        orderBy: { createdAt: "desc" },
      }),
      db.workshopEnrollment.findMany({
        where: { memberId },
        select: { id: true, status: true, createdAt: true, workshop: { select: { id: true, title: true } } },
        orderBy: { createdAt: "desc" },
      }),
      db.workshopSubmission.findMany({
        where: { memberId },
        select: {
          id: true, status: true, content: true, createdAt: true, updatedAt: true,
          deliverable: { select: { id: true, title: true } },
        },
        orderBy: { createdAt: "desc" },
      }),
      db.workshopQuizAttempt.findMany({
        where: { memberId },
        select: {
          id: true, score: true, passed: true, submittedAt: true,
          quiz: { select: { id: true, title: true } },
        },
        orderBy: { submittedAt: "desc" },
      }),
      db.memberEmailLog.findMany({
        where: { memberId },
        select: { id: true, kind: true, createdAt: true },
        orderBy: { createdAt: "desc" },
      }),
      // Sessions : sans otpHash (secret), avec métadonnées utiles au membre.
      db.memberSession.findMany({
        where: { memberId },
        select: { id: true, createdAt: true, lastSeenAt: true, revokedAt: true, expiresAt: true, ip: true, userAgent: true },
        orderBy: { lastSeenAt: "desc" },
      }),
      db.profilingDraft.findUnique({ where: { email } }),
      db.analyticsEvent.findMany({
        where: { memberId },
        select: { id: true, type: true, ref: true, value: true, createdAt: true },
        orderBy: { createdAt: "desc" },
        take: EXPORT_ANALYTICS_MAX + 1,
      }),
    ]);

  if (!member || member.deletedAt) {
    return NextResponse.json(
      { error: "Non authentifié.", code: "UNAUTHENTICATED" },
      { status: 401 },
    );
  }

  const truncated = analytics.length > EXPORT_ANALYTICS_MAX;
  const payload = buildExportPayload(member as unknown as Record<string, unknown>, {
    rsvps,
    enrollments,
    submissions,
    quizAttempts,
    emailLogs,
    sessions,
    draft,
    analytics: truncated ? analytics.slice(0, EXPORT_ANALYTICS_MAX) : analytics,
    analyticsTruncated: truncated,
  });

  return NextResponse.json(payload, {
    headers: {
      "Cache-Control": "no-store, max-age=0",
      "Content-Disposition": `attachment; filename="hashcode-mes-donnees.json"`,
    },
  });
}
