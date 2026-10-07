/**
 * HASHCODE REBOOT — Catalogue d'activités depuis la base (M4).
 *
 * Mappe les objets réellement disponibles (Workshop publiés, Events
 * planifiés/en direct) vers `AvailableActivity`. Les valeurs inconnues
 * (domaine/niveau hors vocabulaire, statuts non publiables) sont écartées :
 * on ne recommande JAMAIS une ressource inexistante ou inéligible.
 *
 * Fonctions pures (mappers) + un adaptateur DB fin (`loadPublishedActivities`).
 * En cas d'échec DB, l'appelant retombe sur le seed statique de `features.ts`.
 */

import { db } from "@/lib/db";
import type { Domain, Goal, Level, LearningStyle } from "@/lib/profiling/types";
import type { ActivityType } from "./types";
import type { AvailableActivity } from "./features";

/** Bornes anti-abus sur le catalogue chargé. */
export const ACTIVITY_LOAD_LIMIT = 50;

const VALID_DOMAINS = ["web", "cybersecurity", "ai"] as const;
const VALID_LEVELS = ["beginner", "practicing", "autonomous", "advanced"] as const;

function asDomain(v: unknown): Domain | undefined {
  return typeof v === "string" &&
    (VALID_DOMAINS as readonly string[]).includes(v)
    ? (v as Domain)
    : undefined;
}

function asLevel(v: unknown): Level | undefined {
  return typeof v === "string" &&
    (VALID_LEVELS as readonly string[]).includes(v)
    ? (v as Level)
    : undefined;
}

function listOf<T>(v: T | undefined, isValid: (x: unknown) => x is T): T[] | undefined {
  if (v === undefined) return undefined; // ouvert à tous
  return isValid(v) ? [v] : undefined; // valeur inconnue → ouvert plutôt qu'exclu
}

type WorkshopRow = {
  id: string;
  slug: string;
  title: string;
  description: string | null;
  domain: string | null;
  level: string | null;
};

/** Workshop publié → activité. `null` si non publiable. */
export function workshopToActivity(w: WorkshopRow): AvailableActivity | null {
  return {
    id: `workshop:${w.slug}`,
    type: "workshop",
    title: w.title,
    description: w.description ?? "",
    domains: listOf(w.domain, (x): x is Domain => asDomain(x) !== undefined) as
      | Domain[]
      | undefined,
    levels: listOf(w.level, (x): x is Level => asLevel(x) !== undefined) as
      | Level[]
      | undefined,
    status: "published",
    url: "/evenements",
    tags: ["workshop"],
  };
}

type EventRow = {
  id: string;
  title: string;
  description: string | null;
  type: string;
  domain: string | null;
  level: string | null;
  url: string | null;
};

const EVENT_TYPE_MAP: Record<string, ActivityType> = {
  workshop: "workshop",
  session: "event",
  meetup: "event",
  webinar: "event",
  other: "event",
};

/** Event planifié/en direct → activité. `null` si type inconnu. */
export function eventToActivity(e: EventRow): AvailableActivity | null {
  const type = EVENT_TYPE_MAP[e.type];
  if (!type) return null;
  return {
    id: `event:${e.id}`,
    type,
    title: e.title,
    description: e.description ?? "",
    domains: listOf(e.domain, (x): x is Domain => asDomain(x) !== undefined) as
      | Domain[]
      | undefined,
    levels: listOf(e.level, (x): x is Level => asLevel(x) !== undefined) as
      | Level[]
      | undefined,
    status: "published",
    url: e.url ?? "/evenements",
    tags: ["event", e.type],
  };
}

/**
 * Charge le catalogue réel : workshops publiés + événements à venir/en direct.
 * Adaptateur fin — toute erreur remonte à l'appelant (fallback seed).
 */
export async function loadPublishedActivities(): Promise<AvailableActivity[]> {
  const [workshops, events] = await Promise.all([
    db.workshop.findMany({
      where: { status: "published" },
      select: {
        id: true,
        slug: true,
        title: true,
        description: true,
        domain: true,
        level: true,
      },
      take: ACTIVITY_LOAD_LIMIT,
      orderBy: { updatedAt: "desc" },
    }),
    db.event.findMany({
      where: { status: { in: ["scheduled", "live"] } },
      select: {
        id: true,
        title: true,
        description: true,
        type: true,
        domain: true,
        level: true,
        url: true,
      },
      take: ACTIVITY_LOAD_LIMIT,
      orderBy: { startsAt: "asc" },
    }),
  ]);

  const out: AvailableActivity[] = [];
  for (const w of workshops) {
    const a = workshopToActivity(w);
    if (a) out.push(a);
  }
  for (const e of events) {
    const a = eventToActivity(e);
    if (a) out.push(a);
  }
  return out;
}

/** Charge avec garde-fou temporel : au-delà du délai, rejette (fallback seed). */
export function loadPublishedActivitiesWithTimeout(
  ms = 1500,
): Promise<AvailableActivity[]> {
  return Promise.race([
    loadPublishedActivities(),
    new Promise<AvailableActivity[]>((_, reject) =>
      setTimeout(() => reject(new Error("activities-timeout")), ms),
    ),
  ]);
}

// Réexport de types utiles (évite les imports profonds côté routes).
export type { AvailableActivity, Domain, Goal, Level, LearningStyle };
