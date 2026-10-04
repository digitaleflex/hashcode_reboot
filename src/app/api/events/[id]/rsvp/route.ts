import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { getSession } from "@/lib/account-auth";
import { rateLimit, rateKey } from "@/lib/rate-limit";
import { blockIfTesting } from "@/lib/test-guard";
import { decideRsvp } from "@/lib/events-validation";
import {
  AppError,
  AuthError,
  ConflictError,
  NotFoundError,
  RateLimitError,
  ValidationError,
  errorToResponse,
  parseJsonBody,
} from "@/lib/errors";

export const runtime = "nodejs";

/** Codes de décision → erreur applicative (contrat historique conservé). */
const RSVP_ERRORS: Record<
  string,
  (message: string) => AppError
> = {
  INVALID_STATUS: (message) => new ValidationError(message),
  NOT_FOUND: (message) => new NotFoundError(message),
  // 400 historique : l'événement a déjà commencé.
  PAST_EVENT: (message) => new AppError(message, { status: 400, code: "INVALID_PAYLOAD" }),
  FULL: (message) => new ConflictError(message),
};

type RsvpOutcome =
  | { ok: true; rsvp: { id: string; status: string; createdAt: Date } }
  | { ok: false; code: string; error: string };

/**
 * POST /api/events/[id]/rsvp — S'inscrire à un événement (RSVP).
 *
 * Body: { status: "going" | "maybe" | "cancelled" }
 *
 * Le contrôle de capacité s'exécute DANS la transaction (même vue de la
 * base que l'écriture) : deux inscriptions concurrentes ne peuvent pas
 * dépasser `maxAttendees`. Si la transaction interactive n'est pas
 * supportée par l'infrastructure (pooler/connexion), repli sur le
 * contrôle historique hors transaction.
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
  const blocked = blockIfTesting();
  if (blocked) return blocked;
  const session = await getSession(req);
  if (!session) {
    throw new AuthError("Non authentifié.", "UNAUTHENTICATED");
  }

  // Rate-limit: 5 rsvp per member per 10 minutes
  const rl = await rateLimit(`rsvp:${session.member.id}:${rateKey(req)}`, {
    capacity: 5,
    windowMs: 600000,
  });
  if (!rl.ok) {
    throw new RateLimitError(
      "Trop de requêtes. Réessaie dans quelques minutes.",
      rl.retryAfterMs,
    );
  }

  const body = (await parseJsonBody(req)) as Record<string, unknown>;

  const { id } = await params;

  /** Contrôle + écriture sur une même vue de la base (tx ou db directe). */
  const decide = async (client: Prisma.TransactionClient): Promise<RsvpOutcome> => {
    const event = await client.event.findUnique({
      where: { id },
      select: { id: true, status: true, startsAt: true, maxAttendees: true },
    });
    const existing = event
      ? await client.eventRsvp.findUnique({
          where: { eventId_memberId: { eventId: id, memberId: session.member.id } },
          select: { status: true },
        })
      : null;
    const goingCount = event
      ? await client.eventRsvp.count({ where: { eventId: id, status: "going" } })
      : 0;

    const decision = decideRsvp({
      eventExists: Boolean(event),
      eventStatus: event?.status ?? null,
      startsAt: event?.startsAt ?? null,
      maxAttendees: event?.maxAttendees ?? null,
      goingCount,
      currentStatus: existing?.status ?? null,
      requestedStatus: String(body.status),
      now: new Date(),
    });
    if (!decision.ok) return decision;

    return {
      ok: true,
      rsvp: await client.eventRsvp.upsert({
        where: { eventId_memberId: { eventId: id, memberId: session.member.id } },
        update: { status: String(body.status) as "going" | "maybe" | "cancelled" },
        create: {
          eventId: id,
          memberId: session.member.id,
          status: String(body.status) as "going" | "maybe" | "cancelled",
        },
        select: { id: true, status: true, createdAt: true },
      }),
    };
  };

  let outcome: RsvpOutcome;
  try {
    outcome = await db.$transaction(decide);
  } catch (txErr) {
    // Transaction interactive indisponible : repli sur le contrôle
    // historique hors transaction (comportement d'avant, jamais pire).
    console.warn("[rsvp] transaction indisponible, contrôle hors transaction :", txErr);
    outcome = await decide(db);
  }

  if (!outcome.ok) {
    const build = RSVP_ERRORS[outcome.code];
    throw build
      ? build(outcome.error)
      : new ConflictError(outcome.error);
  }

  return NextResponse.json({ ok: true, rsvp: outcome.rsvp });
  } catch (err) {
    return errorToResponse(err);
  }
}

/**
 * DELETE /api/events/[id]/rsvp — Annuler son RSVP.
 */
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
  const blocked = blockIfTesting();
  if (blocked) return blocked;
  const session = await getSession(req);
  if (!session) {
    throw new AuthError("Non authentifié.", "UNAUTHENTICATED");
  }

  const { id } = await params;

  const deleted = await db.eventRsvp.deleteMany({
    where: { eventId: id, memberId: session.member.id },
  });

  if (deleted.count === 0) {
    throw new NotFoundError("Aucun RSVP trouvé.");
  }

  return NextResponse.json({ ok: true });
  } catch (err) {
    return errorToResponse(err);
  }
}
