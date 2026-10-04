import type { PublicEvent as SharedPublicEvent } from "@/lib/public-events";

/**
 * Événement affiché par la page publique.
 * Même contrat que `PublicEvent` (src/lib/public-events.ts) + `myRsvp`, qui
 * n'est renvoyé que par l'endpoint authentifié.
 */
export interface PublicEvent extends SharedPublicEvent {
  /** RSVP du membre connecté (uniquement sur l'endpoint authentifié). */
  myRsvp?: string | null;
}

/** Type unifié des filtres (état local de la barre de filtres). */
export interface EventFilters {
  /** Type d'événement — SEUL filtre poussé sur l'API (param `type`). */
  type: string;
  /** Niveau — filtrage client. */
  level: string;
  /** Axe — filtrage client. */
  domain: string;
  /** Période — "week" | "month" | "all", filtrage client. */
  period: "all" | "week" | "month";
}

export const DEFAULT_FILTERS: EventFilters = {
  type: "all",
  level: "all",
  domain: "all",
  period: "all",
};

export const TYPE_LABELS: Record<string, string> = {
  session: "Session",
  workshop: "Workshop",
  meetup: "Meetup",
  webinar: "Webinaire",
  other: "Événement",
};

export const DOMAIN_LABELS: Record<string, string> = {
  web: "Web",
  cybersecurity: "Cybersécurité",
  ai: "IA",
};

export const LEVEL_LABELS: Record<string, string> = {
  beginner: "Débutant",
  practicing: "Pratiquant",
  autonomous: "Autonome",
  advanced: "Avancé",
};

export const RECURRENCE_LABELS: Record<string, string> = {
  weekly: "chaque semaine",
  biweekly: "toutes les 2 semaines",
  monthly: "chaque mois",
};

/** Ordre d'affichage des pills de type (le libellé est déjà au pluriel). */
export const TYPE_FILTERS: { value: string; label: string }[] = [
  { value: "all", label: "Tous" },
  { value: "session", label: "Sessions" },
  { value: "workshop", label: "Workshops" },
  { value: "meetup", label: "Meetups" },
  { value: "webinar", label: "Webinaires" },
];

export const LEVEL_FILTERS: { value: string; label: string }[] = [
  { value: "all", label: "Tous les niveaux" },
  { value: "beginner", label: "Débutant" },
  { value: "practicing", label: "Pratiquant" },
  { value: "autonomous", label: "Autonome" },
  { value: "advanced", label: "Avancé" },
];

export const DOMAIN_FILTERS: { value: string; label: string }[] = [
  { value: "all", label: "Tous les axes" },
  { value: "web", label: "Web" },
  { value: "cybersecurity", label: "Cybersécurité" },
  { value: "ai", label: "IA" },
];

export const PERIOD_FILTERS: { value: EventFilters["period"]; label: string }[] = [
  { value: "all", label: "Toute la période" },
  { value: "week", label: "Cette semaine" },
  { value: "month", label: "Ce mois-ci" },
];

export function typeLabel(type: string): string {
  return TYPE_LABELS[type] ?? TYPE_LABELS.other;
}

export function levelLabel(level: string | null): string | null {
  if (!level) return null;
  return LEVEL_LABELS[level] ?? level;
}

export function domainLabel(domain: string | null): string | null {
  if (!domain) return null;
  return DOMAIN_LABELS[domain] ?? domain;
}
