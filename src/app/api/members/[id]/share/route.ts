import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { rateLimit, rateKey } from "@/lib/rate-limit";

export const runtime = "nodejs";

/**
 * GET /api/members/[id]/share — generate a public shareable profile summary
 * (no sensitive data, just the public profile card fields). Used by the
 * "Partager mon profil" button on the welcome screen.
 *
 * Vie privée : inchangé volontairement. L'id est un cuid indrôlable (pas
 * d'énumération séquentielle possible) et seuls les champs publics de la
 * carte profil sont exposés — jamais email, téléphone, ville ni statuts
 * internes. La chaîne est donc cassée à la source : connaître un lien share
 * ne révèle rien d'exploitable et ne permet pas de lister les membres.
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  // Anti-abus : 30 partages par IP toutes les 10 minutes.
  const rl = rateLimit(`share:${rateKey(req)}`, {
    capacity: 30,
    windowMs: 600000, // 10 minutes
  });
  if (!rl.ok) {
    return NextResponse.json(
      { error: "Trop de requêtes. Réessaie dans quelques minutes." },
      {
        status: 429,
        headers: { "Retry-After": String(Math.ceil(rl.retryAfterMs / 1000)) },
      },
    );
  }
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
