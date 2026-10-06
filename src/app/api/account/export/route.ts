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
        // Sessions : l'export RGPD doit contenir les sessions RÉELLES du membre.
        // Elle lisait `MemberSession`, doublon de l'ère pré-Better Auth resté
        // sans aucun écrivain : `sessions` valait toujours `[]`. Le membre
        // demandait ses données et le système lui répondait qu'il n'en avait
        // aucune, alors que la table `Session` en contient. Export incomplet.
        //
        // `Session.userId` référence `User`, pas `Member` : il n'y a pas de
        // `memberId` à filtrer. Le lien réel est l'email — c'est par lui que
        // `account-auth.ts:46` résout le membre depuis la session Better Auth,
        // et par lui que `api/account/route.ts:101` révoque les sessions. On
        // filtre donc sur `user.email` : le seul `email` présent dans la clause
        // est celui du membre authentifié (cf. `email` ligne 42), jamais celui
        // d'un autre. Aucun `OR`, aucun `in` : une seule identité possible.
        //
        // `token` n'est JAMAIS sélectionné — c'est le secret qui authentifie le
        // cookie. Le divulguer dans un JSON téléchargeable reviendrait à offrir
        // le vol de session. On garde les métadonnées utiles au membre.
        db.session.findMany({
          where: { user: { email } },
          select: {
            id: true, createdAt: true, updatedAt: true, expiresAt: true,
            ipAddress: true, userAgent: true,
          },
          orderBy: { updatedAt: "desc" },
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
