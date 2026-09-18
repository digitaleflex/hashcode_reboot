"use client";

import * as React from "react";
import {
  Calendar,
  CheckCircle2,
  Clock,
  MapPin,
  ExternalLink,
  Users,
  Loader2,
  Video,
  Heart,
  AlertTriangle,
  Filter,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { track } from "@/lib/analytics";
import type { PublicEvent as SharedPublicEvent } from "@/lib/public-events";

/* ── Types ─────────────────────────────────────────────────────────────── */

/** Mêmes champs que l'endpoint public + `myRsvp` renvoyé par l'endpoint membre. */
interface PublicEvent extends SharedPublicEvent {
  /** RSVP du membre connecté (uniquement sur l'endpoint authentifié). */
  myRsvp?: string | null;
}

const TYPE_CONFIG: Record<
  string,
  { label: string; icon: React.ReactNode; color: string }
> = {
  session: { label: "Session", icon: <Users className="size-4" />, color: "text-lime" },
  workshop: { label: "Workshop", icon: <Video className="size-4" />, color: "text-blue-400" },
  meetup: { label: "Meetup", icon: <Users className="size-4" />, color: "text-amber-400" },
  webinar: { label: "Webinaire", icon: <Video className="size-4" />, color: "text-purple-400" },
  other: { label: "Événement", icon: <Calendar className="size-4" />, color: "text-muted-foreground" },
};

const DOMAIN_LABELS: Record<string, string> = {
  web: "Web",
  cybersecurity: "Cyber",
  ai: "AI",
};

const LEVEL_LABELS: Record<string, string> = {
  beginner: "Débutant",
  practicing: "Pratiquant",
  autonomous: "Autonome",
  advanced: "Avancé",
};

const RECURRENCE_LABELS: Record<string, string> = {
  weekly: "Chaque semaine",
  biweekly: "Toutes les 2 semaines",
  monthly: "Chaque mois",
};

const INTEREST_STORAGE_KEY = "hashcode:event-interest";

function readInterested(): string[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(INTEREST_STORAGE_KEY);
    const parsed = raw ? (JSON.parse(raw) as unknown) : [];
    return Array.isArray(parsed) ? parsed.filter((x): x is string => typeof x === "string") : [];
  } catch {
    return [];
  }
}

function writeInterested(ids: string[]) {
  try {
    window.localStorage.setItem(INTEREST_STORAGE_KEY, JSON.stringify(ids));
  } catch {
    /* stockage indisponible : la déduplication est best-effort */
  }
}

function formatEventDate(startsAt: string): string {
  const start = new Date(startsAt);
  const diffDays = Math.ceil((start.getTime() - Date.now()) / (1000 * 60 * 60 * 24));
  const dateStr = start.toLocaleDateString("fr-FR", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });
  const timeStr = start.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });
  if (diffDays === 0) return `Aujourd'hui à ${timeStr}`;
  if (diffDays === 1) return `Demain à ${timeStr}`;
  return `${dateStr} à ${timeStr}`;
}

function formatDuration(startsAt: string, endsAt: string | null): string | null {
  if (!endsAt) return null;
  const diffMin = Math.round(
    (new Date(endsAt).getTime() - new Date(startsAt).getTime()) / 60000,
  );
  if (diffMin <= 0) return null;
  if (diffMin < 60) return `${diffMin}min`;
  const h = Math.floor(diffMin / 60);
  const m = diffMin % 60;
  return m > 0 ? `${h}h${m}` : `${h}h`;
}

function groupByDate(events: PublicEvent[]): Map<string, PublicEvent[]> {
  const groups = new Map<string, PublicEvent[]>();
  for (const event of events) {
    const date = new Date(event.startsAt).toLocaleDateString("fr-FR", {
      weekday: "long",
      day: "numeric",
      month: "long",
      year: "numeric",
    });
    groups.set(date, [...(groups.get(date) ?? []), event]);
  }
  return groups;
}


/* Actions d'événement — hauteur tactile 40px, pleine largeur sur mobile,
   côte à côte dès sm. Aucune surcharge de tracking (design system). */
const ACTION_BASE =
  "inline-flex min-h-10 items-center justify-center gap-2 rounded-md px-4 text-sm font-medium transition-colors cursor-pointer disabled:cursor-not-allowed disabled:opacity-50 w-full sm:w-auto";
const ACTION_PRIMARY = `${ACTION_BASE} bg-lime text-background hover:bg-lime/90`;
const ACTION_OUTLINE = `${ACTION_BASE} border border-border bg-background text-muted-foreground hover:border-lime/40 hover:text-lime`;
const ACTION_GHOST_LIME = `${ACTION_BASE} border border-lime/30 bg-lime/10 text-lime hover:bg-lime/20`;
const ACTION_GHOST_AMBER = `${ACTION_BASE} border border-amber-500/30 bg-amber-500/10 text-amber-300 hover:bg-amber-500/20`;
const ACTION_GHOST_PINK = `${ACTION_BASE} border border-pink-500/40 bg-pink-500/10 text-pink-400 hover:bg-pink-500/20`;

/* ── Composant ─────────────────────────────────────────────────────────── */

export function PublicEvents({
  isAuthed,
  firstName,
  onJoin,
  initialEvents = [],
  initialLoaded = false,
}: {
  isAuthed: boolean;
  firstName?: string | null;
  onJoin: () => void;
  /** Événements rendus côté serveur (SEO + affichage sans JS). */
  initialEvents?: PublicEvent[];
  /** true si la requête serveur a abouti (évite un spinner infini sans JS). */
  initialLoaded?: boolean;
}) {
  const [events, setEvents] = React.useState<PublicEvent[]>(initialEvents);
  const [loading, setLoading] = React.useState(!initialLoaded);
  const [error, setError] = React.useState<string | null>(null);
  const [filterType, setFilterType] = React.useState("all");
  const [rsvpStates, setRsvpStates] = React.useState<Record<string, string | null>>({});
  const [interested, setInterested] = React.useState<string[]>([]);
  const [interestCounts, setInterestCounts] = React.useState<Record<string, number>>(() => {
    const seed: Record<string, number> = {};
    for (const e of initialEvents) seed[e.id] = e.interestCount ?? 0;
    return seed;
  });
  const [pendingId, setPendingId] = React.useState<string | null>(null);

  React.useEffect(() => {
    setInterested(readInterested());
  }, []);

  React.useEffect(() => {
    let cancelled = false;
    setError(null);

    // Connecté → endpoint authentifié (renvoie monRsvp). Anonyme → endpoint public.
    const endpoint = isAuthed
      ? `/api/events?limit=50${filterType !== "all" ? `&type=${filterType}` : ""}&memberId=me`
      : `/api/public/events?limit=50${filterType !== "all" ? `&type=${filterType}` : ""}`;

    fetch(endpoint, { cache: "no-store" })
      .then(async (res) => {
        if (!res.ok) throw new Error("load");
        return (await res.json()) as { events?: PublicEvent[] };
      })
      .then((data) => {
        if (cancelled) return;
        const list = data.events ?? [];
        setEvents(list);
        const states: Record<string, string | null> = {};
        const counts: Record<string, number> = {};
        for (const e of list) {
          states[e.id] = e.myRsvp ?? null;
          counts[e.id] = e.interestCount ?? 0;
        }
        setRsvpStates(states);
        setInterestCounts(counts);
      })
      .catch(() => {
        if (!cancelled) setError("Impossible de charger les événements.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [isAuthed, filterType]);

  const handleRsvp = React.useCallback(
    async (eventId: string, status: "going" | "maybe") => {
      const current = rsvpStates[eventId] ?? null;
      const next = current === status ? "cancelled" : status;
      setPendingId(eventId);
      setRsvpStates((prev) => ({ ...prev, [eventId]: next === "cancelled" ? null : status }));
      try {
        if (next === "cancelled") {
          await fetch(`/api/events/${eventId}/rsvp`, { method: "DELETE" });
        } else {
          await fetch(`/api/events/${eventId}/rsvp`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ status: next }),
          });
        }
        track({ type: "event_rsvp", ref: eventId });
      } catch {
        setRsvpStates((prev) => ({ ...prev, [eventId]: current }));
      } finally {
        setPendingId(null);
      }
    },
    [rsvpStates],
  );

  const handleInterest = React.useCallback(
    (eventId: string) => {
      if (interested.includes(eventId)) return;
      const next = [...interested, eventId];
      setInterested(next);
      setInterestCounts((prev) => ({ ...prev, [eventId]: (prev[eventId] ?? 0) + 1 }));
      writeInterested(next);
      // Signal anonyme (sendBeacon) — best-effort, ne bloque jamais l'UI.
      track({ type: "event_interest", ref: eventId });
    },
    [interested],
  );

  const grouped = groupByDate(events);

  const typeFilters = [
    { value: "all", label: "Tous" },
    { value: "session", label: "Sessions" },
    { value: "workshop", label: "Workshops" },
    { value: "meetup", label: "Meetups" },
    { value: "webinar", label: "Webinaires" },
  ];

  return (
    <div className="space-y-6">
      <header className="space-y-2">
        <h1 className="font-display font-bold text-3xl tracking-tight">
          Événements HASHCODE REBOOT
        </h1>
        <p className="text-sm text-muted-foreground max-w-2xl">
          Sessions, workshops et meetups ouverts à la communauté.
          {isAuthed
            ? ` Inscris-toi en un clic${firstName ? `, ${firstName}` : ""} — ton RSVP est enregistré dans ton espace.`
            : " Dis-nous que ça t'intéresse, puis crée ton profil pour t'inscrire officiellement."}
        </p>
      </header>

      {/* Filtres */}
      <div className="flex items-center gap-3 flex-wrap">
        <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
          <Filter className="size-4" aria-hidden />
          <span className="mono-label">Type :</span>
        </span>
        <div className="flex flex-wrap gap-1.5">
          {typeFilters.map((opt) => (
            <button
              key={opt.value}
              type="button"
              onClick={() => setFilterType(opt.value)}
              aria-pressed={filterType === opt.value}
              className={cn(
                "px-3 py-1.5 rounded-md text-xs font-medium transition-colors cursor-pointer",
                filterType === opt.value
                  ? "bg-lime/15 text-lime border border-lime/30"
                  : "text-muted-foreground border border-border/60 hover:border-lime/30",
              )}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {loading && (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="size-6 animate-spin text-muted-foreground" aria-label="Chargement" />
        </div>
      )}

      {!loading && error && (
        <div className="text-center py-16">
          <AlertTriangle className="size-8 text-muted-foreground/40 mx-auto mb-3" aria-hidden />
          <p className="text-sm text-muted-foreground">{error}</p>
        </div>
      )}

      {!loading && !error && events.length === 0 && (
        <div className="text-center py-16">
          <Calendar className="size-12 text-muted-foreground/20 mx-auto mb-4" aria-hidden />
          <p className="text-muted-foreground">Aucun événement à venir pour le moment.</p>
          <p className="text-xs text-muted-foreground/60 mt-1">
            Les prochaines sessions seront annoncées ici.
          </p>
        </div>
      )}

      {!loading && !error && events.length > 0 && (
        <div className="space-y-8">
          {Array.from(grouped.entries()).map(([date, dateEvents]) => (
            <div key={date}>
              <h2 className="mb-3 flex items-center gap-3 text-sm font-semibold text-foreground">
                <span>{date}</span>
                <span className="h-px flex-1 bg-border" aria-hidden />
              </h2>
              <div className="space-y-3">
                {dateEvents.map((event) => {
                  const config = TYPE_CONFIG[event.type] ?? TYPE_CONFIG.other;
                  const duration = formatDuration(event.startsAt, event.endsAt);
                  const myRsvp = rsvpStates[event.id] ?? null;
                  const isFull = event.spotsLeft === 0;
                  const alreadyInterested = interested.includes(event.id);

                  return (
                    <article
                      key={event.id}
                      className={cn(
                        "rounded-lg border border-border/60 bg-card/40 p-5",
                        "hover:border-lime/30 transition-colors",
                        event.status === "live" && "border-red-500/30 bg-red-500/5",
                      )}
                    >
                      <div className="flex items-start gap-4">
                        <span className={cn("shrink-0 mt-0.5", config.color)} aria-hidden>
                          {config.icon}
                        </span>

                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <h3 className="text-base font-medium">{event.title}</h3>
                            <span
                              className={cn(
                                "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium",
                                config.color,
                                "border-current/20 bg-current/5",
                              )}
                            >
                              {config.label}
                            </span>
                            {event.domain && (
                              <span className="inline-flex items-center rounded-full border border-border/60 bg-secondary/50 px-2.5 py-1 text-xs font-medium text-muted-foreground">
                                {DOMAIN_LABELS[event.domain] ?? event.domain}
                              </span>
                            )}
                            {event.level && (
                              <span className="inline-flex items-center rounded-full border border-border/60 bg-secondary/50 px-2.5 py-1 text-xs font-medium text-muted-foreground">
                                {LEVEL_LABELS[event.level] ?? event.level}
                              </span>
                            )}
                            {isFull && (
                              <span className="inline-flex items-center rounded-full border border-destructive/30 bg-destructive/10 px-2.5 py-1 text-xs font-medium text-destructive">
                                Complet
                              </span>
                            )}
                          </div>

                          {event.description && (
                            <p className="text-sm text-muted-foreground mt-2">{event.description}</p>
                          )}

                          <div className="flex items-center gap-4 mt-3 text-xs text-muted-foreground flex-wrap">
                            <span className="inline-flex items-center gap-1.5">
                              <Clock className="size-3.5" aria-hidden />
                              {formatEventDate(event.startsAt)}
                              {duration && (
                                <span className="text-muted-foreground/60">· {duration}</span>
                              )}
                            </span>
                            {event.location && (
                              <span className="inline-flex items-center gap-1.5">
                                <MapPin className="size-3.5" aria-hidden />
                                {event.location}
                              </span>
                            )}
                            {event.recurrence && (
                              <span className="text-muted-foreground/60">
                                {RECURRENCE_LABELS[event.recurrence] ?? event.recurrence}
                              </span>
                            )}
                            {event.goingCount > 0 && (
                              <span className="inline-flex items-center gap-1 text-lime">
                                <Users className="size-3.5" aria-hidden />
                                {event.goingCount} inscrit{event.goingCount > 1 ? "s" : ""}
                              </span>
                            )}
                            {!isAuthed && (interestCounts[event.id] ?? 0) > 0 && (
                              <span className="inline-flex items-center gap-1 text-pink-400">
                                <Heart className="size-3.5" aria-hidden />
                                {interestCounts[event.id]} intéressé
                                {(interestCounts[event.id] ?? 0) > 1 ? "s" : ""}
                              </span>
                            )}
                          </div>
                        </div>

                        {event.url && (
                          <a
                            href={event.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="shrink-0 p-2 rounded-md text-muted-foreground hover:text-lime hover:bg-lime/10 transition-colors"
                            title="Ouvrir le lien de l'événement"
                          >
                            <ExternalLink className="size-4" />
                          </a>
                        )}
                      </div>

                      {event.status === "live" && (
                        <div className="mt-3">
                          <span className="inline-flex items-center gap-1.5 rounded-full border border-red-500/30 bg-red-500/15 px-2.5 py-1 text-xs font-medium text-red-400">
                            <span className="inline-block size-1.5 rounded-full bg-red-400 animate-pulse" />
                            EN DIRECT
                          </span>
                        </div>
                      )}

                      {event.status === "scheduled" && (
                        <div className="mt-4">
                          {isAuthed ? (
                            myRsvp === "going" ? (
                              <button
                                type="button"
                                onClick={() => void handleRsvp(event.id, "going")}
                                disabled={pendingId === event.id}
                                className={ACTION_GHOST_LIME}
                              >
                                <CheckCircle2 className="size-4" aria-hidden />
                                Inscrit · Annuler
                              </button>
                            ) : myRsvp === "maybe" ? (
                              <button
                                type="button"
                                onClick={() => void handleRsvp(event.id, "maybe")}
                                disabled={pendingId === event.id}
                                className={ACTION_GHOST_AMBER}
                              >
                                <CheckCircle2 className="size-4" aria-hidden />
                                Peut-être · Annuler
                              </button>
                            ) : (
                              <div className="flex flex-col gap-2 sm:flex-row">
                                <button
                                  type="button"
                                  onClick={() => void handleRsvp(event.id, "going")}
                                  disabled={pendingId === event.id || isFull}
                                  className={ACTION_PRIMARY}
                                >
                                  <Users className="size-4" aria-hidden />
                                  {isFull ? "Complet" : "Je participe"}
                                </button>
                                <button
                                  type="button"
                                  onClick={() => void handleRsvp(event.id, "maybe")}
                                  disabled={pendingId === event.id}
                                  className={ACTION_OUTLINE}
                                >
                                  Peut-être
                                </button>
                              </div>
                            )
                          ) : alreadyInterested ? (
                            <span className="inline-flex items-center gap-2 rounded-md border border-pink-500/30 bg-pink-500/10 px-3.5 py-2.5 text-sm font-medium text-pink-400">
                              <Heart className="size-4" aria-hidden />
                              Intérêt enregistré
                            </span>
                          ) : (
                            <div className="flex flex-col gap-2 sm:flex-row">
                              <button
                                type="button"
                                onClick={() => handleInterest(event.id)}
                                className={ACTION_GHOST_PINK}
                              >
                                <Heart className="size-4" aria-hidden />
                                Ça m&apos;intéresse
                              </button>
                              <button type="button" onClick={onJoin} className={ACTION_PRIMARY}>
                                Créer mon profil pour m&apos;inscrire
                              </button>
                            </div>
                          )}
                        </div>
                      )}
                    </article>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}

      {!isAuthed && !loading && events.length > 0 && (
        <p className="text-xs text-muted-foreground">
          « Ça m&apos;intéresse » est un signal anonyme : aucun compte requis, aucune donnée
          personnelle collectée. Pour t&apos;inscrire réellement, crée ton profil — tu pourras alors
          t&apos;inscrire en un clic depuis ton espace.
        </p>
      )}
    </div>
  );
}
