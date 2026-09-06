import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;

  const m = await db.member.findUnique({
    where: { id },
    select: {
      id: true,
      firstName: true,
      profileArchetype: true,
      primaryDomain: true,
      level: true,
      goal: true,
      availability: true,
      mentoringInterest: true,
      threeMonthGoal: true,
      tags: true,
      accessLane: true,
    },
  });

  if (!m) {
    return NextResponse.json({ error: "Profil introuvable." }, { status: 404 });
  }

  const decode = <T,>(s: string | null, fallback: T): T => {
    if (!s) return fallback;
    try { return JSON.parse(s) as T; } catch { return fallback; }
  };

  return NextResponse.json({
    profile: {
      id: m.id,
      firstName: m.firstName,
      archetype: m.profileArchetype,
      domain: m.primaryDomain,
      level: m.level,
      goal: m.goal,
      availability: m.availability,
      mentoring: m.mentoringInterest,
      threeMonthGoal: m.threeMonthGoal,
      tags: decode<string[]>(m.tags, []),
      accessLane: m.accessLane,
    },
  });
}
