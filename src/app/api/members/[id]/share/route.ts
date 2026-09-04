import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

export const runtime = "nodejs";

/**
 * GET /api/members/[id]/share — generate a public shareable profile summary
 * (no sensitive data, just the public profile card fields). Used by the
 * "Partager mon profil" button on the welcome screen.
 */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const m = await db.member.findUnique({
    where: { id },
    select: {
      firstName: true,
      profileArchetype: true,
      primaryDomain: true,
      level: true,
      goal: true,
      availability: true,
      learningStyle: true,
      mentoringInterest: true,
      threeMonthGoal: true,
      tags: true,
      accessLane: true,
    },
  });
  if (!m) return NextResponse.json({ error: "Introuvable." }, { status: 404 });

  const decode = <T,>(s: string, fallback: T): T => {
    try { return JSON.parse(s) as T; } catch { return fallback; }
  };
  return NextResponse.json({
    profile: {
      firstName: m.firstName,
      archetype: m.profileArchetype,
      domain: m.primaryDomain,
      level: m.level,
      goal: m.goal,
      availability: m.availability,
      learningStyle: m.learningStyle,
      mentoring: m.mentoringInterest,
      threeMonthGoal: m.threeMonthGoal,
      tags: decode<string[]>(m.tags, []),
      accessLane: m.accessLane,
    },
  });
}
