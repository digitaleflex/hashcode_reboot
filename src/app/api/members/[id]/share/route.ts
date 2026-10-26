import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { rateLimit, rateKey, retryAfterHeader } from "@/lib/rate-limit";
import { publicTags } from "@/lib/profiling/public-tags";

export const runtime = "nodejs";

/**
 * GET /api/members/[id]/share — generate a public shareable profile summary
 * (no sensitive data, just the public profile card fields). Used by the
 * "Partager mon profil" button on the welcome screen.
 *
 * Vie privée : inchangé volontairement. L'id est un cuid indrôlable (pas
 * d'énumération séquentielle possible) et seuls les champs publics de la
 * carte profil sont exposés — jamais email, téléphone, ville, statuts
 * internes (dont accessLane, champ d'auto-contrôle retiré, F5) ni statuts.
 * La chaîne est donc cassée à la source : connaître un lien share
 * ne révèle rien d'exploitable et ne permet pas de lister les membres.
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  // Anti-abus : 30 partages par IP toutes les 10 minutes.
  const rl = await rateLimit(`share:${rateKey(req)}`, {
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
      // Liste blanche : jamais de GENDER:*, COUNTRY:*, HIGH-BUDGET en public.
      tags: publicTags(decode<string[]>(m.tags, [])),
    },
  });
}
