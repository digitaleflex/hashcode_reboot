import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSession } from "@/lib/account-auth";
import { rateLimit, rateKey, retryAfterHeader } from "@/lib/rate-limit";
import { blockIfTesting } from "@/lib/test-guard";

export const runtime = "nodejs";

/**
 * POST /api/events/[id]/rsvp — S'inscrire à un événement (RSVP).
 *
 * Body: { status: "going" | "maybe" }
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const blocked = blockIfTesting();
  if (blocked) return blocked;
  const session = await getSession(req);
  if (!session) {
    return NextResponse.json(
      { error: "Non authentifié.", code: "UNAUTHENTICATED" },
      { status: 401 },
    );
  }

  // Rate-limit: 5 rsvp per member per 10 minutes
  const rl = await rateLimit(`rsvp:${session.member.id}:${rateKey(req)}`, {
    capacity: 5,
    windowMs: 600000,
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

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      { error: "JSON invalide.", code: "INVALID_PAYLOAD" },
      { status: 400 },
    );
  }

  const { status } = body;
  if (!["going", "maybe", "cancelled"].includes(String(status))) {
    return NextResponse.json(
      { error: "Status invalide. Use: going | maybe | cancelled.", code: "INVALID_PAYLOAD" },
      { status: 422 },
    );
  }

  const { id } = await params;

  // Vérifier que l'événement existe et est à venir
  const event = await db.event.findUnique({
    where: { id },
    select: { id: true, status: true, startsAt: true, maxAttendees: true },
  });
  if (!event || event.status !== "scheduled") {
    return NextResponse.json(
      { error: "Événement introuvable ou terminé.", code: "NOT_FOUND" },
      { status: 404 },
    );
  }

  if (event.startsAt < new Date()) {
    return NextResponse.json(
      { error: "Impossible de s'inscrire à un événement passé.", code: "PAST_EVENT" },
      { status: 400 },
    );
  }

  // Vérifier la capacité
  if (event.maxAttendees) {
    const goingCount = await db.eventRsvp.count({
      where: { eventId: id, status: "going" },
    });
    if (goingCount >= event.maxAttendees) {
      return NextResponse.json(
        { error: "L'événement est complet.", code: "FULL" },
        { status: 409 },
      );
    }
  }

  // Upsert RSVP
  const rsvp = await db.eventRsvp.upsert({
    where: { eventId_memberId: { eventId: id, memberId: session.member.id } },
    update: { status: String(status) as "going" | "maybe" | "cancelled" },
    create: {
      eventId: id,
      memberId: session.member.id,
      status: String(status) as "going" | "maybe" | "cancelled",
    },
    select: { id: true, status: true, createdAt: true },
  });

  return NextResponse.json({ ok: true, rsvp });
}

/**
 * DELETE /api/events/[id]/rsvp — Annuler son RSVP.
 */
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const blocked = blockIfTesting();
  if (blocked) return blocked;
  const session = await getSession(req);
  if (!session) {
    return NextResponse.json(
      { error: "Non authentifié.", code: "UNAUTHENTICATED" },
      { status: 401 },
    );
  }

  const { id } = await params;

  const deleted = await db.eventRsvp.deleteMany({
    where: { eventId: id, memberId: session.member.id },
  });

  if (deleted.count === 0) {
    return NextResponse.json(
      { error: "Aucun RSVP trouvé.", code: "NOT_FOUND" },
      { status: 404 },
    );
  }

  return NextResponse.json({ ok: true });
}
