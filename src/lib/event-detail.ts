import { db } from "@/lib/db";
import type { PublicEvent } from "@/lib/public-events";

/**
 * Détail d'un événement public — utilisé par la page `/evenements/[id]`.
 *
 * Complète `PublicEvent` (utilisé par la liste) avec :
 *  - le programme réel (séances d'atelier liées via `WorkshopSession.eventId`,
 *    cf. ADR-001 : EVENT ≠ SESSION, le lien est optionnel) ;
 *  - le RSVP du membre connecté.
 *
 * Contraintes de confidentialité, identiques à `/api/public/events` :
 *  - aucun RSVP nominatif n'est renvoyé (compteurs agrégés uniquement) ;
 *  - `myRsvp` n'est renseigné que si un membre connecté est passé ;
 *  - les résultats d'analyse d'intérêt ne sont jamais individuels.
 *
 * Unlike `listPublicEvents`, AUCUN filtre de date ni de statut n'est appliqué :
 * une page de détail doit rester consultable après l'événement (statut
 * « Terminé » / « Annulé »), sinon les liens partagés cassent.
 */

/** Une étape de programme — données réelles, jamais générées. */
export interface EventProgrammeStep {
  number: number;
  title: string;
  objective: string | null;
  program: string | null;
  /** Horodatage prévu de la séance, si l'atelier l'a défini. */
  scheduledAt: string | null;
}

export interface PublicEventDetail extends PublicEvent {
  /** Séances d'atelier reliées, dans l'ordre d'unlock. Vide si l'événement est isolé. */
  programme: EventProgrammeStep[];
  /** RSVP du membre connecté : `going` | `maybe` | `cancelled` | null. */
  myRsvp: string | null;
}

/**
 * Charge un événement par son id, ou `null` s'il n'existe pas.
 * Ne lève pas : la page appelante traduit `null` en 404.
 */
export async function getPublicEventDetail(
  id: string,
  memberId?: string | null,
): Promise<PublicEventDetail | null> {
  if (!id) return null;

  const event = await db.event.findUnique({
    where: { id },
    select: {
      id: true,
      title: true,
      description: true,
      startsAt: true,
      endsAt: true,
      location: true,
      url: true,
      type: true,
      domain: true,
      level: true,
      status: true,
      recurrence: true,
      maxAttendees: true,
      _count: { select: { rsvps: { where: { status: "going" } } } },
      workshopSessions: {
        orderBy: { number: "asc" },
        select: {
          number: true,
          title: true,
          objective: true,
          program: true,
          scheduledAt: true,
        },
      },
    },
  });

  if (!event) return null;

  // Compteurs agrégés : 2 requêtes, jamais de N+1.
  const [maybeGroup, interestGroup, myRsvp] = await Promise.all([
    db.eventRsvp
      .groupBy({
        by: ["eventId"],
        where: { eventId: event.id, status: "maybe" },
        _count: true,
      })
      .catch(() => [] as { eventId: string; _count: number }[]),
    db.analyticsEvent
      .count({ where: { type: "event_interest", ref: event.id } })
      .catch(() => 0),
    memberId
      ? db.eventRsvp
          .findUnique({
            where: { eventId_memberId: { eventId: event.id, memberId } },
            select: { status: true },
          })
          .catch(() => null)
      : Promise.resolve(null),
  ]);

  const goingCount = event._count.rsvps;

  return {
    id: event.id,
    title: event.title,
    description: event.description,
    startsAt: event.startsAt.toISOString(),
    endsAt: event.endsAt?.toISOString() ?? null,
    location: event.location,
    url: event.url,
    type: event.type,
    domain: event.domain,
    level: event.level,
    status: event.status,
    recurrence: event.recurrence,
    maxAttendees: event.maxAttendees,
    goingCount,
    maybeCount: maybeGroup[0]?._count ?? 0,
    interestCount: interestGroup,
    spotsLeft:
      typeof event.maxAttendees === "number"
        ? Math.max(0, event.maxAttendees - goingCount)
        : null,
    programme: event.workshopSessions.map((s) => ({
      number: s.number,
      title: s.title,
      objective: s.objective,
      program: s.program,
      scheduledAt: s.scheduledAt?.toISOString() ?? null,
    })),
    myRsvp: myRsvp && myRsvp.status !== "cancelled" ? myRsvp.status : null,
  };
}