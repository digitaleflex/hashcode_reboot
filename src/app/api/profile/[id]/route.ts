import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { rateLimit, rateKey, retryAfterHeader } from "@/lib/rate-limit";
import { publicTags } from "@/lib/profiling/public-tags";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  // Anti-abus : 30 requêtes par IP toutes les 10 minutes.
  const rl = await rateLimit(`profile:${rateKey(req)}`, {
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

  const { id } = await params;

  const m = await db.member.findFirst({
    // Un membre supprimé (soft-delete RGPD) n'a plus de profil public.
    where: { id, deletedAt: null },
    // F5 : accessLane est un champ interne d'auto-contrôle — jamais exposé
    // sur une route publique sans rate-limit (voir aussi /members/[id]/share).
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
      // Liste blanche : jamais de GENDER:*, COUNTRY:*, HIGH-BUDGET en public.
      tags: publicTags(decode<string[]>(m.tags, [])),
    },
  });
}