import { NextRequest, NextResponse } from "next/server";
import { unstable_cache } from "next/cache";
import { db } from "@/lib/db";
import { getSession } from "@/lib/account-auth";
import { rateLimit } from "@/lib/rate-limit";
import { loadWorkshopForMember } from "@/lib/workshop-server";
import { AuthError, RateLimitError, errorToResponse } from "@/lib/errors";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Liste des ateliers publiés + progression, mise en cache 60 s par membre.
 * La clé inclut le memberId (argument sérialisé) : deux membres ne partagent
 * jamais la même entrée. Les chargements par atelier sont parallélisés
 * (Promise.all) au lieu de la boucle séquentielle O(W×3 requêtes).
 */
const getWorkshopsForMember = unstable_cache(
  async (memberId: string) => {
    const published = await db.workshop.findMany({
      where: { status: "published" },
      orderBy: { createdAt: "asc" },
      select: { id: true },
    });

    const views = await Promise.all(
      published.map((w) => loadWorkshopForMember(memberId, w.id)),
    );

    return views
      .filter(
        (view): view is NonNullable<typeof view> => view !== null,
      )
      .map((view) => ({
        id: view.workshop.id,
        slug: view.workshop.slug,
        title: view.workshop.title,
        description: view.workshop.description,
        domain: view.workshop.domain,
        level: view.workshop.level,
        enrollment: view.enrollment
          ? {
              status: view.enrollment.status,
              enrolledAt:
                view.enrollment.enrolledAt instanceof Date
                  ? view.enrollment.enrolledAt.toISOString()
                  : view.enrollment.enrolledAt,
            }
          : null,
        summary: view.summary,
        // Mini-états pour l'affichage liste (id + état — aucun contenu).
        states: view.weeks.flatMap((week) =>
          week.sessions.map((s) => ({
            sessionId: s.id,
            number: s.number,
            state: s.state,
          })),
        ),
      }));
  },
  ["workshops-list"],
  { revalidate: 60, tags: ["workshops"] },
);

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

  const workshops = await getWorkshopsForMember(session.member.id);

  return NextResponse.json({ workshops });
  } catch (err) {
    return errorToResponse(err);
  }
}
