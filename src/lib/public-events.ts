import { db } from "@/lib/db";

/**
 * Événements publics à venir — logique partagée entre la route
 * `GET /api/public/events` et la page publique `/evenements` (rendu serveur
 * pour le SEO et l'affichage sans JavaScript).
 *
 * Aucune donnée personnelle : uniquement des compteurs agrégés.
 */
export interface PublicEvent {
  id: string;
  title: string;
  description: string | null;
  startsAt: string;
  endsAt: string | null;
  location: string | null;
  url: string | null;
  type: string;
  domain: string | null;
  level: string | null;
  status: string;
  recurrence: string | null;
  maxAttendees: number | null;
  goingCount: number;
  maybeCount: number;
  interestCount: number;
  spotsLeft: number | null;
}

const EVENT_TYPES = ["session", "workshop", "meetup", "webinar", "other"];
const DOMAINS = ["web", "cybersecurity", "ai"];

/** Plafond de sécurité du nombre d'événements renvoyés (usage interne). */
const PUBLIC_EVENTS_MAX = 50;

export function normalizeEventFilters(args: {
  type?: string | null;
  domain?: string | null;
  limit?: number | null;
}): { type?: string; domain?: string; limit: number } {
  const rawLimit = Number(args.limit ?? 20);
  const limit = Number.isFinite(rawLimit)
    ? Math.min(Math.max(Math.trunc(rawLimit), 1), PUBLIC_EVENTS_MAX)
    : 20;
  return {
    type: args.type && EVENT_TYPES.includes(args.type) ? args.type : undefined,
    domain: args.domain && DOMAINS.includes(args.domain) ? args.domain : undefined,
    limit,
  };
}

export async function listPublicEvents(filters: {
  type?: string;
  domain?: string;
  limit?: number;
}): Promise<PublicEvent[]> {
  const limit = Math.min(Math.max(filters.limit ?? 20, 1), PUBLIC_EVENTS_MAX);

  const where: Record<string, unknown> = {
    status: { in: ["scheduled", "live"] },
    startsAt: { gte: new Date() },
  };
  if (filters.type) where.type = filters.type;
  if (filters.domain) where.domain = filters.domain;

  const events = await db.event.findMany({
    where,
    orderBy: { startsAt: "asc" },
    take: limit,
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
    },
  });

  const eventIds = events.map((e) => e.id);

  const [maybeGroups, interestGroups] = await Promise.all([
    eventIds.length
      ? db.eventRsvp.groupBy({
          by: ["eventId"],
          where: { eventId: { in: eventIds }, status: "maybe" },
          _count: true,
        })
      : Promise.resolve([] as { eventId: string; _count: number }[]),
    eventIds.length
      ? db.analyticsEvent.groupBy({
          by: ["ref"],
          where: { type: "event_interest", ref: { in: eventIds } },
          _count: true,
        })
      : Promise.resolve([] as { ref: string | null; _count: number }[]),
  ]);

  const maybeMap = new Map(maybeGroups.map((g) => [g.eventId, g._count]));
  const interestMap = new Map(
    interestGroups
      .filter((g): g is { ref: string; _count: number } => typeof g.ref === "string")
      .map((g) => [g.ref, g._count]),
  );

  return events.map((event) => {
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
      maybeCount: maybeMap.get(event.id) ?? 0,
      interestCount: interestMap.get(event.id) ?? 0,
      spotsLeft:
        typeof event.maxAttendees === "number"
          ? Math.max(0, event.maxAttendees - goingCount)
          : null,
    };
  });
}
