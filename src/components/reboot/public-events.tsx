"use client";

import * as React from "react";
import { Loader2, AlertTriangle } from "lucide-react";
import { track } from "@/lib/analytics";
import { EventsFilterBar } from "./events/events-filter-bar";
import { EventTimeline, type EventDateGroup } from "./events/event-timeline";
import { EmptyEventsState } from "./events/empty-events-state";
import { LocalTimeNote } from "./events/local-time-note";
import { DEFAULT_FILTERS, type EventFilters, type PublicEvent } from "./events/types";
import { groupKey } from "./events/format";
import { matchesPeriod } from "@/lib/event-period";

/* ── Intérêt anonyme (localStorage) ──────────────────────────────────────── */

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

/* ── Filtrage + regroupement ─────────────────────────────────────────────── */

// La logique de période est extraite dans `@/lib/event-period` : c'est de la
// logique pure (semaine calendaire lundi→dimanche), testable sans React.
// `matchesPeriod` n'est plus défini ici.

/* ── Composant ───────────────────────────────────────────────────────────── */

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
  const [filters, setFilters] = React.useState<EventFilters>(DEFAULT_FILTERS);
  const [rsvpStates, setRsvpStates] = React.useState<Record<string, string | null>>({});
  const [interested, setInterested] = React.useState<string[]>([]);
  const [interestCounts, setInterestCounts] = React.useState<Record<string, number>>(() => {
    const seed: Record<string, number> = {};
    for (const e of initialEvents) seed[e.id] = e.interestCount ?? 0;
    return seed;
  });
  const [pendingId, setPendingId] = React.useState<string | null>(null);
  /**
   * Ids pour lesquels le signal d'intérêt a DÉJÀ été émis (ce navigateur).
   * Le toggle est réversible côté UI : sans cette garde, un « on → off → on »
   * enverrait deux beacons et `interestCount` gonflerait de 2 alors que
   * l'interface en affiche 1. Alimenté à partir du localStorage au montage.
   */
  const signalledInterest = React.useRef<Set<string>>(new Set());
  /** Le serveur a-t-il rendu des événements dans le HTML initial ? */
  const hasServerData = React.useRef(initialEvents.length > 0);
  /**
   * Clé de la dernière combinaison (auth, type) réellement fetchée.
   * Sans cette garde, le composant re-téléchargeait au montage la liste que le
   * serveur venait de rendre : le HTML indexable était systématiquement
   * écrasé par un aller-retour réseau inutile.
   */
  const fetchedKey = React.useRef<string | null>(null);

  // Restaure l'intérêt déclaré par ce visiteur (clef localStorage inchangée)
  // et alimente la garde d'émission.
  React.useEffect(() => {
    const ids = readInterested();
    setInterested(ids);
    signalledInterest.current = new Set(ids);
  }, []);

  // Seul le TYPE est poussé sur l'API — endpoint inchangé.
  React.useEffect(() => {
    const key = `${isAuthed ? "auth" : "anon"}:${filters.type}`;

    // Déjà chargé pour cette combinaison, ou rendu par le serveur : inutile
    // de refaire l'aller-retour.
    if (fetchedKey.current === key) return;
    const isFirstLoad = fetchedKey.current === null;
    fetchedKey.current = key;
    if (isFirstLoad && hasServerData.current) return;

    let cancelled = false;
    setError(null);

    const endpoint = isAuthed
      ? `/api/events?limit=50${filters.type !== "all" ? `&type=${filters.type}` : ""}&memberId=me`
      : `/api/public/events?limit=50${filters.type !== "all" ? `&type=${filters.type}` : ""}`;

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
  }, [isAuthed, filters.type]);

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

  /** Toggle : on peut revenir en arrière (suppression de l'intérêt). */
  const handleInterest = React.useCallback(
    (eventId: string, nextActive: boolean) => {
      const isActive = interested.includes(eventId);
      if (nextActive === isActive) return;

      const next = nextActive
        ? [...interested, eventId]
        : interested.filter((id) => id !== eventId);

      setInterested(next);
      setInterestCounts((prev) => ({
        ...prev,
        [eventId]: Math.max(0, (prev[eventId] ?? 0) + (nextActive ? 1 : -1)),
      }));
      writeInterested(next);
      // Signal anonyme (sendBeacon) — best-effort, ne bloque jamais l'UI.
      // Émis UNE FOIS par navigateur et par événement : le toggle UI est
      // réversible, mais on ne veut pas d-interestCount à chaque aller-retour.
      if (nextActive && !signalledInterest.current.has(eventId)) {
        signalledInterest.current.add(eventId);
        track({ type: "event_interest", ref: eventId });
      }
    },
    [interested],
  );

  const resetFilters = React.useCallback(() => setFilters(DEFAULT_FILTERS), []);

  /* ── Filtrage + groupement mémoïsés ───────────────────────────────────── */

  const filtered = React.useMemo(() => {
    return events.filter((e) => {
      if (filters.level !== "all" && e.level !== filters.level) return false;
      if (filters.domain !== "all" && e.domain !== filters.domain) return false;
      if (!matchesPeriod(e.startsAt, filters.period)) return false;
      return true;
    });
  }, [events, filters.level, filters.domain, filters.period]);

  const groups = React.useMemo<EventDateGroup[]>(() => {
    const map = new Map<string, EventDateGroup>();
    for (const event of filtered) {
      const key = groupKey(event.startsAt);
      const existing = map.get(key);
      if (existing) existing.events.push(event);
      else map.set(key, { key, startsAt: event.startsAt, events: [event] });
    }
    return Array.from(map.values());
  }, [filtered]);

  // UNE seule carte « à la une » : la première de la liste non filtrée.
  const featuredId = React.useMemo(() => events[0]?.id ?? null, [events]);

  const hasActiveFilters =
    filters.type !== "all" ||
    filters.level !== "all" ||
    filters.domain !== "all" ||
    filters.period !== "all";

  /* ── Rendu ────────────────────────────────────────────────────────────── */

  // Le contenu initial n'est JAMAIS masqué : le spinner ne s'affiche que
  // s'il n'y a rien à afficher (donc pas de trou au premier paint).
  const showSpinner = loading && events.length === 0;
  const showError = !loading && Boolean(error) && events.length === 0;

  return (
    <section aria-label="Liste des événements" className="pb-16">
      <EventsFilterBar
        filters={filters}
        onChange={setFilters}
        resultCount={filtered.length}
        totalCount={events.length}
      />

      <div className="mt-6">
        {showSpinner && (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="size-6 animate-spin text-muted-foreground" aria-hidden />
            <p className="sr-only">Chargement des événements</p>
          </div>
        )}

        {showError && (
          <div className="flex flex-col items-center rounded-lg border border-border/70 px-6 py-14 text-center">
            <AlertTriangle className="size-8 text-muted-foreground/50" aria-hidden />
            <p className="mt-4 text-sm text-foreground">{error}</p>
            <p className="mt-1.5 text-[13px] text-muted-foreground">
              Réessaie dans un instant — la programmation reste affichée entre-temps.
            </p>
          </div>
        )}

        {!showSpinner && !showError && events.length === 0 && (
          // Un filtre de TYPE actif vide aussi la liste côté API : dans ce cas
          // le site n'est pas vide, c'est la sélection qui ne matche rien.
          // L'ancienne version annonçait « aucun événement à venir », ce qui
          // poussait à croire que la programmation était terminée.
          hasActiveFilters ? (
            <EmptyEventsState
              variant="filtered"
              hasActiveFilters
              onReset={resetFilters}
            />
          ) : (
            <EmptyEventsState variant="empty" />
          )
        )}

        {!showSpinner && !showError && events.length > 0 && groups.length === 0 && (
          <EmptyEventsState
            variant="filtered"
            hasActiveFilters={hasActiveFilters}
            onReset={resetFilters}
          />
        )}

        {groups.length > 0 && (
          <>
            {/* Les horaires sont affichés en heure du navigateur ; la note
                n'apparaît que si le visiteur n'est pas sur l'heure du groupe. */}
            <LocalTimeNote startsAt={filtered[0]?.startsAt} />

            <EventTimeline
              groups={groups}
              featuredId={featuredId}
              isAuthed={isAuthed}
              rsvpById={rsvpStates}
              interestedIds={interested}
              interestCounts={interestCounts}
              pendingId={pendingId}
              onInterest={handleInterest}
              onRsvp={(id, status) => void handleRsvp(id, status)}
              onJoin={onJoin}
              className={loading ? "opacity-60 transition-opacity" : undefined}
            />

            {/* Badge de rechargement discret — ne remplace jamais le contenu. */}
            {loading && (
              <p className="mt-4 inline-flex items-center gap-2 text-[13px] text-muted-foreground">
                <Loader2 className="size-3.5 animate-spin" aria-hidden />
                Mise à jour de la programmation…
              </p>
            )}

            {!isAuthed && (
              <p className="mt-8 max-w-2xl text-[13px] leading-relaxed text-muted-foreground">
                « Ça m&apos;intéresse » est un signal anonyme : aucun compte
                requis, aucune donnée personnelle collectée. Pour
                t&apos;inscrire réellement, crée ton profil — tu pourras alors
                t&apos;inscrire en un clic depuis ton espace.
              </p>
            )}
          </>
        )}
      </div>
    </section>
  );
}
