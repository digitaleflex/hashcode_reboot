import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/account-auth";
import { db } from "@/lib/db";
import { rateLimit, rateKey } from "@/lib/rate-limit";
import {
  buildExportPayload,
  EXPORT_ANALYTICS_MAX,
} from "@/lib/account-rgpd";
import { AuthError, RateLimitError, errorToResponse } from "@/lib/errors";

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
  try {
    const session = await getSession();
    if (!session) {
      throw new AuthError("Non authentifié.", "UNAUTHENTICATED");
    }

    const rl = await rateLimit(`account-export:${rateKey(req)}`, {
      capacity: 10,
      windowMs: 10 * 60 * 1000,
    });
    if (!rl.ok) {
      throw new RateLimitError(
        "Trop de requêtes. Réessaie dans quelques minutes.",
        rl.retryAfterMs,
      );
    }

    const memberId = session.member.id;
    const email = session.member.email;

    const [member, rsvps, enrollments, submissions, quizAttempts, emailLogs, sessions, draft, analytics, consents, qualifications, notes] =
      await Promise.all([
        // Allowlist explicite (#153) : JAMAIS adminNote ni adminRole (internes).
        db.member.findUnique({
          where: { id: memberId },
          select: {
            id: true, createdAt: true, updatedAt: true,
            firstName: true, lastName: true, email: true, phone: true,
            country: true, city: true, gender: true,
            primaryDomain: true, secondaryDomains: true, domainSpecialty: true,
            level: true, goal: true, goalProjectStage: true, goalSituation: true,
            availability: true, availabilityTimes: true, learningStyle: true,
            mentoringInterest: true, mentoringMaybeReason: true,
            mentoringTypes: true, mentoringFrequency: true, mentoringDomain: true,
            budgetWillingness: true, budgetRange: true, threeMonthGoal: true,
            profileArchetype: true, tags: true, customTags: true, source: true,
            profileStatus: true, communityStatus: true, accessLane: true,
            deletedAt: true, mentorContactedAt: true, userEmail: true,
            invitationStatus: true, invitedAt: true, invitationClicks: true,
            lastClickedAt: true, refusedAt: true, refusedReason: true,
            bouncedAt: true, acceptedAt: true, approvedAt: true, joinedAt: true,
          },
        }),
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
        // Preuves de consentement du membre (historique complet, versions incluses).
        db.consent.findMany({
          where: { email },
          select: { id: true, purpose: true, choice: true, textVersion: true, createdAt: true },
          orderBy: { createdAt: "desc" },
        }),
        // Résultats le concernant (jamais de scoring d'autrui).
        db.qualification.findMany({
          where: { memberId },
          select: {
            id: true, archetype: true, scores: true, reasons: true,
            confidence: true, engineVersion: true, qualificationScore: true,
            status: true, ruleVersion: true, createdAt: true,
          },
          orderBy: { createdAt: "desc" },
        }),
        // Notes admin le concernant : contenu + date, SANS l'auteur (#153).
        db.memberNote.findMany({
          where: { memberId },
          select: { id: true, content: true, createdAt: true },
          orderBy: { createdAt: "desc" },
        }),
      ]);

    if (!member || member.deletedAt) {
      throw new AuthError("Non authentifié.", "UNAUTHENTICATED");
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
      consents,
      qualifications,
      notes,
    });

    return NextResponse.json(payload, {
      headers: {
        "Cache-Control": "no-store, max-age=0",
        "Content-Disposition": `attachment; filename="hashcode-mes-donnees.json"`,
      },
    });
  } catch (err) {
    return errorToResponse(err);
  }
}
