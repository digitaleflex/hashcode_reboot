import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSession } from "@/lib/account-auth";
import { rateLimit } from "@/lib/rate-limit";
import { loadWorkshopForMember } from "@/lib/workshop-server";
import { AuthError, RateLimitError, errorToResponse } from "@/lib/errors";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/workshops — ateliers publiés + progression du membre courant.
 *
 * AUTH   : session membre obligatoire (401 sinon).
 * INPUT  : aucun.
 * OUTPUT : { workshops: [{ id, slug, title, description, domain, level,
 *          enrollment, summary, states }] } — états dérivés serveur.
 * ERRORS : 401 non authentifié, 429 rate limit.
 *
 * Les ateliers draft/archived ne sont jamais visibles ici.
 */
export async function GET(req: NextRequest) {
  try {
  const session = await getSession(req);
  if (!session) {
    throw new AuthError("Non authentifié.", "UNAUTHENTICATED");
  }

  const rl = await rateLimit(`workshops:${session.member.id}`, {
    capacity: 60,
    windowMs: 60_000,
  });
  if (!rl.ok) {
    throw new RateLimitError("Trop de requêtes.", rl.retryAfterMs);
  }

  const published = await db.workshop.findMany({
    where: { status: "published" },
    orderBy: { createdAt: "asc" },
    select: { id: true },
  });

  const workshops: Record<string, unknown>[] = [];
  for (const w of published) {
    const view = await loadWorkshopForMember(session.member.id, w.id);
    if (!view) continue;
    workshops.push({
      id: view.workshop.id,
      slug: view.workshop.slug,
      title: view.workshop.title,
      description: view.workshop.description,
      domain: view.workshop.domain,
      level: view.workshop.level,
      enrollment: view.enrollment,
      summary: view.summary,
      // Mini-états pour l'affichage liste (id + état — aucun contenu).
      states: view.weeks.flatMap((week) =>
        week.sessions.map((s) => ({
          sessionId: s.id,
          number: s.number,
          state: s.state,
        })),
      ),
    });
  }

  return NextResponse.json({ workshops });
  } catch (err) {
    return errorToResponse(err);
  }
}
