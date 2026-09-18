import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSession } from "@/lib/account-auth";
import { rateLimit, retryAfterHeader } from "@/lib/rate-limit";
import { loadWorkshopForMember, type SessionStateView } from "@/lib/workshop-server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Params = { params: Promise<{ slug: string }> };

/**
 * GET /api/workshops/[slug] — structure d'un atelier + états/locks du
 * membre courant + prochain créneau des séances débloquées.
 *
 * AUTH   : session membre obligatoire (401 sinon).
 * INPUT  : slug dans le chemin.
 * OUTPUT : { workshop, enrollment, summary, weeks: [{ sessions }] } —
 *          les séances verrouillées n'exposent QUE { id, number, title,
 *          state } : jamais de contenu d'une séance verrouillée.
 * ERRORS : 401 non authentifié, 404 inexistant ou non publié, 429 rate
 *          limit.
 *
 * Le contenu pédagogique (programme, activités, quiz) vit dans
 * GET /api/workshops/sessions/[id] (#85), gated par enrollment + unlock.
 */
export async function GET(req: NextRequest, { params }: Params) {
  const session = await getSession(req);
  if (!session) {
    return NextResponse.json(
      { error: "Non authentifié.", code: "UNAUTHENTICATED" },
      { status: 401 },
    );
  }

  const rl = await rateLimit(`workshop:${session.member.id}`, {
    capacity: 60,
    windowMs: 60_000,
  });
  if (!rl.ok) {
    return NextResponse.json(
      { error: "Trop de requêtes.", code: "RATE_LIMITED" },
      { status: 429, headers: { "Retry-After": retryAfterHeader(rl.retryAfterMs) } },
    );
  }

  const { slug } = await params;
  const workshop = await db.workshop.findUnique({
    where: { slug },
    select: { id: true, status: true },
  });
  if (!workshop || workshop.status !== "published") {
    return NextResponse.json(
      { error: "Atelier introuvable.", code: "NOT_FOUND" },
      { status: 404 },
    );
  }

  const view = await loadWorkshopForMember(session.member.id, workshop.id);
  if (!view) {
    return NextResponse.json(
      { error: "Atelier introuvable.", code: "NOT_FOUND" },
      { status: 404 },
    );
  }

  // Prochain créneau des séances DÉBLOQUÉES liées à un Event.
  const eventIds = view.weeks
    .flatMap((w) => w.sessions)
    .filter((s) => s.state !== "LOCKED" && s.eventId)
    .map((s) => s.eventId as string);
  const events = eventIds.length
    ? await db.event.findMany({
        where: { id: { in: eventIds } },
        select: {
          id: true,
          title: true,
          startsAt: true,
          endsAt: true,
          location: true,
          url: true,
          status: true,
        },
      })
    : [];
  const eventById = new Map(events.map((e) => [e.id, e]));

  const weeks = view.weeks.map((week) => ({
    id: week.id,
    number: week.number,
    title: week.title,
    objective: week.objective,
    sessions: week.sessions.map((s): Record<string, unknown> => {
      // Séance verrouillée : squelette minimal, aucun contenu.
      if (s.state === "LOCKED") {
        return { id: s.id, number: s.number, title: s.title, state: s.state };
      }
      return {
        ...s,
        event:
          (s.eventId ? eventById.get(s.eventId) : null) ?? null,
      };
    }),
  }));

  return NextResponse.json({
    workshop: view.workshop,
    enrollment: view.enrollment,
    summary: view.summary,
    weeks,
  });
}
