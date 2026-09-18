import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAdminRole } from "@/lib/admin-auth";
import { rateLimit, rateKey, retryAfterHeader } from "@/lib/rate-limit";
import { suggestMentors, type MentorProfile } from "@/lib/matching";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/admin/mentoring/match?menteeId=… — top 5 mentors suggérés.
 *
 * Score 0-100 (domaine +30, spécialités +20, fréquence +20, pays +10,
 * budget concret +20), triés avec équilibrage de charge (cf. matching.ts).
 *
 * AUTH : admin operator (403 sinon). 404 si mentoré introuvable.
 */
export async function GET(req: NextRequest) {
  if (!requireAdminRole(req, "operator")) {
    return NextResponse.json(
      { error: "Accès refusé.", code: "FORBIDDEN" },
      { status: 403 },
    );
  }

  const rl = await rateLimit(`admin-mentoring-match:${rateKey(req)}`, {
    capacity: 60,
    windowMs: 60_000,
  });
  if (!rl.ok) {
    return NextResponse.json(
      { error: "Trop de requêtes.", code: "RATE_LIMITED" },
      { status: 429, headers: { "Retry-After": retryAfterHeader(rl.retryAfterMs) } },
    );
  }

  const { searchParams } = new URL(req.url);
  const menteeId = searchParams.get("menteeId");
  if (!menteeId) {
    return NextResponse.json(
      { error: "menteeId requis.", code: "INVALID" },
      { status: 422 },
    );
  }

  const mentee = await db.member.findUnique({
    where: { id: menteeId },
    select: {
      id: true,
      primaryDomain: true,
      domainSpecialty: true,
      mentoringFrequency: true,
      country: true,
      budgetRange: true,
      deletedAt: true,
    },
  });
  if (!mentee || mentee.deletedAt) {
    return NextResponse.json(
      { error: "Mentoré introuvable.", code: "NOT_FOUND" },
      { status: 404 },
    );
  }

  const mentors = await db.member.findMany({
    where: {
      deletedAt: null,
      profileStatus: "APPROVED",
      mentoringInterest: "yes",
      id: { not: menteeId },
    },
    select: {
      id: true,
      firstName: true,
      lastName: true,
      primaryDomain: true,
      domainSpecialty: true,
      mentoringFrequency: true,
      country: true,
      level: true,
      profileArchetype: true,
      _count: {
        select: { mentorshipsAsMentor: { where: { status: "ACTIVE" } } },
      },
    },
    take: 50,
  });

  const profiles: MentorProfile[] = mentors.map((m) => ({
    id: m.id,
    primaryDomain: m.primaryDomain,
    domainSpecialty: m.domainSpecialty,
    mentoringFrequency: m.mentoringFrequency,
    country: m.country,
    level: m.level,
    activeMentees: m._count.mentorshipsAsMentor,
  }));

  const suggestions = suggestMentors(
    {
      primaryDomain: mentee.primaryDomain,
      domainSpecialty: mentee.domainSpecialty,
      mentoringFrequency: mentee.mentoringFrequency,
      country: mentee.country,
      budgetRange: mentee.budgetRange,
    },
    profiles,
    5,
  );

  const byId = new Map(mentors.map((m) => [m.id, m]));
  return NextResponse.json({
    menteeId,
    suggestions: suggestions.map((s) => {
      const m = byId.get(s.mentorId);
      return {
        ...s,
        mentor: m
          ? {
              id: m.id,
              firstName: m.firstName,
              lastName: m.lastName,
              primaryDomain: m.primaryDomain,
              level: m.level,
              profileArchetype: m.profileArchetype,
              activeMentees: m._count.mentorshipsAsMentor,
            }
          : null,
      };
    }),
  });
}
