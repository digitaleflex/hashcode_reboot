/**
 * HASHCODE REBOOT — validation partagée des événements.
 *
 * Utilisée par POST /api/events (création) et PATCH /api/events/[id]
 * (modification partielle) pour garantir les mêmes règles des deux côtés :
 * - enums fermées (type, domain, level, status, recurrence)
 * - titre 3-200, description ≤2000
 * - startsAt valide, endsAt valide ET postérieure à startsAt
 * - url http(s) valide quand renseignée
 * - maxAttendees entier 1-9999 quand renseigné
 * - notifyWhere() : ciblage des destinataires (APPROVED + domain/level
 *   de l'event quand renseignés) — même filtre partout (POST, PATCH,
 *   GET notify-count).
 */

import type { Prisma } from "@prisma/client";

export const EVENT_TYPES = ["session", "workshop", "meetup", "webinar", "other"] as const;
export const EVENT_DOMAINS = ["web", "cybersecurity", "ai"] as const;
export const EVENT_LEVELS = ["beginner", "practicing", "autonomous", "advanced"] as const;
export const EVENT_STATUSES = ["scheduled", "live", "completed", "cancelled"] as const;
export const EVENT_RECURRENCES = ["weekly", "biweekly", "monthly"] as const;

export interface EventCreateData {
  title: string;
  description: string | null;
  startsAt: Date;
  endsAt: Date | null;
  location: string | null;
  url: string | null;
  type: string;
  domain: string | null;
  level: string | null;
  recurrence: string | null;
  recurrenceId: string | null;
  maxAttendees: number | null;
}

type Fail = { ok: false; error: string };
type Pass<T> = { ok: true; data: T };

function optStr(v: unknown): string | null {
  if (v === null || v === undefined || v === "") return null;
  const s = String(v).trim();
  return s || null;
}

/** Retourne l'URL normalisée, null si vide, false si invalide. */
function parseHttpUrl(v: unknown): string | null | false {
  const s = optStr(v);
  if (s === null) return null;
  try {
    const u = new URL(s);
    if (u.protocol !== "http:" && u.protocol !== "https:") return false;
    return u.toString();
  } catch {
    return false;
  }
}

function parseCapacity(v: unknown): number | null | false {
  if (v === null || v === undefined || v === "") return null;
  const n = Number(v);
  if (!Number.isInteger(n) || n < 1 || n > 9999) return false;
  return n;
}

function parseDate(v: unknown): Date | null {
  if (v === null || v === undefined || v === "") return null;
  const d = new Date(String(v));
  return isNaN(d.getTime()) ? null : d;
}

/** Validation création (tous les requis présents). */
export function validateEventCreate(body: Record<string, unknown>): Pass<EventCreateData> | Fail {
  const title = typeof body.title === "string" ? body.title.trim() : "";
  if (title.length < 3) return { ok: false, error: "Titre requis (min 3 caractères)." };
  if (title.length > 200) return { ok: false, error: "Titre trop long (max 200 caractères)." };

  const description = optStr(body.description);
  if (description && description.length > 2000) {
    return { ok: false, error: "Description trop longue (max 2000 caractères)." };
  }

  if (body.startsAt === undefined || body.startsAt === null || body.startsAt === "") {
    return { ok: false, error: "Date de début requise." };
  }
  const startsAt = parseDate(body.startsAt);
  if (!startsAt) return { ok: false, error: "Date de début invalide." };

  let endsAt: Date | null = null;
  if (body.endsAt !== undefined && body.endsAt !== null && body.endsAt !== "") {
    endsAt = parseDate(body.endsAt);
    if (!endsAt) return { ok: false, error: "Date de fin invalide." };
    if (endsAt <= startsAt) {
      return { ok: false, error: "La fin doit être après le début." };
    }
  }

  const type = String(body.type || "session");
  if (!(EVENT_TYPES as readonly string[]).includes(type)) {
    return { ok: false, error: "Type invalide." };
  }

  const domain = optStr(body.domain);
  if (domain && !(EVENT_DOMAINS as readonly string[]).includes(domain)) {
    return { ok: false, error: "Domaine invalide." };
  }

  const level = optStr(body.level);
  if (level && !(EVENT_LEVELS as readonly string[]).includes(level)) {
    return { ok: false, error: "Niveau invalide." };
  }

  const recurrence = optStr(body.recurrence);
  if (recurrence && !(EVENT_RECURRENCES as readonly string[]).includes(recurrence)) {
    return { ok: false, error: "Récurrence invalide." };
  }

  const url = parseHttpUrl(body.url);
  if (url === false) return { ok: false, error: "Lien externe invalide (http(s) requis)." };

  const maxAttendees = parseCapacity(body.maxAttendees);
  if (maxAttendees === false) {
    return { ok: false, error: "Capacité invalide (entier 1-9999)." };
  }

  return {
    ok: true,
    data: {
      title,
      description,
      startsAt,
      endsAt,
      location: optStr(body.location),
      url,
      type,
      domain,
      level,
      recurrence,
      recurrenceId: optStr(body.recurrenceId),
      maxAttendees,
    },
  };
}

/** Validation modification partielle (champs absents = inchangés).
 *  `current` sert au contrôle croisé endsAt > startsAt quand une seule
 *  des deux bornes est modifiée. */
export function validateEventPatch(
  body: Record<string, unknown>,
  current: { startsAt: Date; endsAt: Date | null },
): Pass<Record<string, unknown>> | Fail {
  const data: Record<string, unknown> = {};

  if (body.title !== undefined) {
    const t = typeof body.title === "string" ? body.title.trim() : "";
    if (t.length < 3) return { ok: false, error: "Titre requis (min 3 caractères)." };
    if (t.length > 200) return { ok: false, error: "Titre trop long (max 200 caractères)." };
    data.title = t;
  }
  if (body.description !== undefined) {
    const d = optStr(body.description);
    if (d && d.length > 2000) {
      return { ok: false, error: "Description trop longue (max 2000 caractères)." };
    }
    data.description = d;
  }
  if (body.startsAt !== undefined) {
    const s = parseDate(body.startsAt);
    if (!s) return { ok: false, error: "Date de début invalide." };
    data.startsAt = s;
  }
  if (body.endsAt !== undefined) {
    if (body.endsAt === null || body.endsAt === "") {
      data.endsAt = null;
    } else {
      const e = parseDate(body.endsAt);
      if (!e) return { ok: false, error: "Date de fin invalide." };
      data.endsAt = e;
    }
  }
  // Contrôle croisé sur les bornes effectives (nouvelles ou existantes).
  const effStart = (data.startsAt as Date | undefined) ?? current.startsAt;
  const effEnd = ("endsAt" in data ? (data.endsAt as Date | null) : current.endsAt) ?? null;
  if (effEnd && effEnd <= effStart) {
    return { ok: false, error: "La fin doit être après le début." };
  }
  if (body.location !== undefined) data.location = optStr(body.location);
  if (body.url !== undefined) {
    const u = parseHttpUrl(body.url);
    if (u === false) return { ok: false, error: "Lien externe invalide (http(s) requis)." };
    data.url = u;
  }
  if (body.type !== undefined) {
    if (!(EVENT_TYPES as readonly string[]).includes(String(body.type))) {
      return { ok: false, error: "Type invalide." };
    }
    data.type = String(body.type);
  }
  if (body.domain !== undefined) {
    const d = optStr(body.domain);
    if (d && !(EVENT_DOMAINS as readonly string[]).includes(d)) {
      return { ok: false, error: "Domaine invalide." };
    }
    data.domain = d;
  }
  if (body.level !== undefined) {
    const l = optStr(body.level);
    if (l && !(EVENT_LEVELS as readonly string[]).includes(l)) {
      return { ok: false, error: "Niveau invalide." };
    }
    data.level = l;
  }
  if (body.status !== undefined) {
    if (!(EVENT_STATUSES as readonly string[]).includes(String(body.status))) {
      return { ok: false, error: "Statut invalide." };
    }
    data.status = String(body.status);
  }
  if (body.recurrence !== undefined) {
    const r = optStr(body.recurrence);
    if (r && !(EVENT_RECURRENCES as readonly string[]).includes(r)) {
      return { ok: false, error: "Récurrence invalide." };
    }
    data.recurrence = r;
  }
  if (body.recurrenceId !== undefined) data.recurrenceId = optStr(body.recurrenceId);
  if (body.maxAttendees !== undefined) {
    const n = parseCapacity(body.maxAttendees);
    if (n === false) {
      return { ok: false, error: "Capacité invalide (entier 1-9999)." };
    }
    data.maxAttendees = n;
  }

  return { ok: true, data };
}

/** Filtre destinataires : APPROVED actifs, restreints au domaine/niveau
 *  de l'event quand renseignés. Même filtre pour POST, PATCH et notify-count. */
export function notifyWhere(event: { domain: string | null; level: string | null }): Prisma.MemberWhereInput {
  return {
    profileStatus: "APPROVED",
    deletedAt: null,
    ...(event.domain ? { primaryDomain: event.domain } : {}),
    ...(event.level ? { level: event.level } : {}),
  };
}
