import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAdminRole } from "@/lib/admin-auth";
import { rateLimit, rateKey } from "@/lib/rate-limit";
import {
  coherenceFlags,
  scoreCompleteness,
} from "@/lib/lead-quality";
import {
  errorToResponse,
  ForbiddenError,
  RateLimitError,
} from "@/lib/errors";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

/**
 * GET /api/admin/leads/quality — qualité des leads (#105, opérateurs).
 * Lecture seule, agrégats SQL (aucun chargement massif) + échantillon
 * scoré (20 plus récents). Jamais de psychométrie : complétude,
 * consentement, cohérence déclarative, qualification, conversion, handoff.
 */
export async function GET(req: NextRequest) {
  try {
    if (!(await requireAdminRole(req, "operator"))) {
      throw new ForbiddenError("Accès refusé.");
    }
    const rl = await rateLimit(`admin-lead-quality:${rateKey(req)}`, {
      capacity: 60,
      windowMs: 60_000,
    });
    if (!rl.ok) throw new RateLimitError("Trop de requêtes.", rl.retryAfterMs);

    const base = { deletedAt: null };
    const [
      total,
      withPhone,
      withCity,
      withGoal,
      converted,
      profilingGranted,
      contactGranted,
      qualifications,
      handoffGap,
      incoherentEmployment,
      incoherentMentoring,
      incoherentProject,
      sample,
    ] = await Promise.all([
      db.member.count({ where: base }),
      // Chaînes vides comptent comme absentes (formulaires).
      db.member.count({ where: { ...base, AND: [{ phone: { not: null } }, { phone: { not: "" } }] } }),
      db.member.count({ where: { ...base, AND: [{ city: { not: null } }, { city: { not: "" } }] } }),
      db.member.count({
        where: { ...base, AND: [{ threeMonthGoal: { not: null } }, { threeMonthGoal: { not: "" } }] },
      }),
      db.member.count({ where: { ...base, profileStatus: "APPROVED" } }),
      // Consentement courant = dernière ligne par (email, purpose).
      db.$queryRaw<{ n: number }[]>`
        SELECT COUNT(*)::int AS n FROM (
          SELECT DISTINCT ON (email) email, choice FROM "Consent"
          WHERE purpose = 'profiling' ORDER BY email, "createdAt" DESC
        ) t WHERE choice = 'granted'
      `.then((r) => (r as { n: number }[])[0]?.n ?? 0),
      db.$queryRaw`
        SELECT COUNT(*)::int AS n FROM (
          SELECT DISTINCT ON (email) email, choice FROM "Consent"
          WHERE purpose = 'contact' ORDER BY email, "createdAt" DESC
        ) t WHERE choice = 'granted'
      `.then((r) => (r as { n: number }[])[0]?.n ?? 0),
      // Statut de qualification courant par membre.
      db.$queryRaw<{ status: string | null; n: number }[]>`
        SELECT status, COUNT(*)::int AS n FROM (
          SELECT DISTINCT ON ("memberId") "memberId", status FROM "Qualification"
          ORDER BY "memberId", "createdAt" DESC
        ) t GROUP BY status
      `,
      // Convertis sans consentement handoff courant.
      db.$queryRaw<{ n: number }[]>`
        SELECT COUNT(*)::int AS n FROM "Member" m
        WHERE m."deletedAt" IS NULL AND m."profileStatus" = 'APPROVED'
          AND NOT EXISTS (
            SELECT 1 FROM "Consent" c WHERE c.email = m.email
              AND c.purpose = 'handoff'
              AND c."createdAt" = (
                SELECT MAX("createdAt") FROM "Consent" c2
                WHERE c2.email = c.email AND c2.purpose = 'handoff'
              )
              AND c.choice = 'granted'
          )
      `.then((r) => (r as { n: number }[])[0]?.n ?? 0),
      db.member.count({
        where: { ...base, goal: "employment", goalSituation: null },
      }),
      db.member.count({
        where: { ...base, mentoringInterest: "yes", mentoringTypes: "[]" },
      }),
      db.member.count({
        where: {
          ...base,
          goal: { in: ["project", "business"] },
          goalProjectStage: null,
        },
      }),
      db.member.findMany({
        where: base,
        orderBy: { createdAt: "desc" },
        take: 20,
        select: {
          id: true,
          email: true,
          firstName: true,
          createdAt: true,
          lastName: true,
          phone: true,
          city: true,
          secondaryDomains: true,
          goal: true,
          goalProjectStage: true,
          goalSituation: true,
          availabilityTimes: true,
          mentoringInterest: true,
          mentoringMaybeReason: true,
          mentoringTypes: true,
          mentoringFrequency: true,
          mentoringDomain: true,
          budgetWillingness: true,
          budgetRange: true,
          threeMonthGoal: true,
        },
      }),
    ]);

    return NextResponse.json({
      totals: { members: total, converted },
      contactability: { withPhone, withCity, withGoal },
      consents: { profilingGranted, contactGranted },
      qualifications,
      handoffGap,
      coherence: {
        employmentWithoutSituation: incoherentEmployment,
        mentoringWithoutTypes: incoherentMentoring,
        projectWithoutStage: incoherentProject,
      },
      sample: sample.map((m) => ({
        id: m.id,
        email: m.email,
        firstName: m.firstName,
        createdAt: m.createdAt,
        score: scoreCompleteness(m),
        flags: coherenceFlags(m),
      })),
    });
  } catch (err) {
    return errorToResponse(err);
  }
}
