import * as React from "react";
import { cn } from "@/lib/utils";
import { EventCard, type EventCardProps } from "./event-card";
import {
  formatDayBadge,
  formatDayNumber,
  formatFullDate,
  formatMonthUpper,
  formatWeekdayUpper,
  formatYear,
  relativeDayBadge,
} from "./format";

/** Le type de l'événement vient de la carte — une seule source de vérité. */
type EventItem = EventCardProps["event"];

export interface EventDateGroup {
  /** Clé de jour local (`YYYY-MM-DD`). */
  key: string;
  /** ISO du premier événement du groupe — référence de formatage du rail. */
  startsAt: string;
  events: EventItem[];
}

/**
 * Groupe de dates.
 *
 * Desktop : rail de date à gauche (jour de semaine, grand jour, mois, année)
 * aligné en haut du groupe, filet vertical 1px, cartes à droite.
 * Mobile : bandeau pleine largeur « DIM. 04 OCT. » + filet horizontal.
 *
 * Un SEUL `<h2>` par groupe (structure de titres correcte) : le contenu
 * desktop et mobile sont deux `<span>` display:none/inline, donc le nom
 * accessible ne contient qu'une seule des deux versions.
 */
function EventDateGroupSection({
  group,
  renderCard,
}: {
  group: EventDateGroup;
  renderCard: (event: EventItem) => React.ReactNode;
}) {
  const { startsAt, events, key } = group;
  const year = formatYear(startsAt);
  const relative = relativeDayBadge(startsAt);

  return (
    <section
      aria-labelledby={`date-group-${key}`}
      className="md:grid md:grid-cols-[160px_minmax(0,1fr)] md:gap-x-6"
    >
      {/* ── Date ──────────────────────────────────────────────────────── */}
      <h2
        id={`date-group-${key}`}
        className={cn(
          "md:sticky md:top-24 md:col-start-1 md:row-start-1 md:self-start md:pb-1 md:pr-2 md:text-right",
          "flex items-center gap-2 border-b border-border/70 pb-2",
          "font-mono text-[12px] font-medium uppercase tracking-[0.12em] text-muted-foreground",
        )}
      >
        {/* Version desktop — rail de date.
            aria-hidden : le nom accessible du h2 est fourni une seule fois
            par le <span className="sr-only"> ci-dessous. Sans ça, un lecteur
            d'écran annonçait « DIM. 04 OCT. 2026 dimanche 4 octobre 2026 ». */}
        <span className="hidden md:block" aria-hidden>
          <span className="block font-sans text-[11px] font-medium uppercase tracking-[0.14em] text-muted-foreground">
            {formatWeekdayUpper(startsAt)}
          </span>
          <span className="mt-1 block font-display text-4xl font-bold leading-none tracking-tight text-foreground tabular-nums">
            {formatDayNumber(startsAt)}
          </span>
          <span className="mt-1.5 block font-mono text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
            {formatMonthUpper(startsAt)}
          </span>
          <span className="block font-mono text-[11px] tracking-[0.14em] text-muted-foreground/70">
            {year}
          </span>
          {relative && (
            <span className="mt-2 inline-flex rounded-md border border-lime/40 bg-lime/10 px-2 py-0.5 text-[11px] tracking-[0.1em] text-lime">
              {relative}
            </span>
          )}
        </span>

        {/* Version mobile — bandeau compact */}
        <span className="md:hidden" aria-hidden>
          <span className="text-foreground">{formatDayBadge(startsAt)}</span>
          {relative && (
            <span className="ml-2 inline-flex rounded-md border border-lime/40 bg-lime/10 px-1.5 py-0.5 text-[11px] tracking-[0.1em] text-lime">
              {relative}
            </span>
          )}
          <span className="ml-auto text-[11px] tracking-[0.14em] text-muted-foreground/70">
            {year}
          </span>
        </span>

        <span className="sr-only">{formatFullDate(startsAt)}</span>
      </h2>

      {/* ── Cartes ────────────────────────────────────────────────────── */}
      <div className="mt-3 flex flex-col gap-3 pb-10 md:col-start-2 md:row-start-1 md:mt-0 md:border-l md:border-border/70 md:pl-6">
        {events.map((event) => renderCard(event))}
      </div>
    </section>
  );
}

export interface EventTimelineProps {
  groups: EventDateGroup[];
  /** UNE seule carte featured : la première de la liste. */
  featuredId: string | null;
  isAuthed: boolean;
  /** État par événement, lu par les cartes. */
  rsvpById: Record<string, string | null>;
  interestedIds: string[];
  interestCounts: Record<string, number>;
  /** RSVP en cours d'envoi. */
  pendingId: string | null;
  onInterest: (eventId: string, nextActive: boolean) => void;
  onRsvp: (eventId: string, status: "going" | "maybe") => void;
  onJoin: () => void;
  className?: string;
}

export function EventTimeline({
  groups,
  featuredId,
  isAuthed,
  rsvpById,
  interestedIds,
  interestCounts,
  pendingId,
  onInterest,
  onRsvp,
  onJoin,
  className,
}: EventTimelineProps) {
  const interested = React.useMemo(() => new Set(interestedIds), [interestedIds]);

  const renderCard = React.useCallback(
    (event: EventItem) => (
      <EventCard
        event={event}
        isAuthed={isAuthed}
        isFeatured={featuredId !== null && event.id === featuredId}
        myRsvp={rsvpById[event.id] ?? null}
        isInterested={interested.has(event.id)}
        interestCount={interestCounts[event.id] ?? 0}
        isPending={pendingId === event.id}
        onInterest={onInterest}
        onRsvp={onRsvp}
        onJoin={onJoin}
      />
    ),
    [isAuthed, featuredId, rsvpById, interested, interestCounts, pendingId, onInterest, onRsvp, onJoin],
  );

  if (groups.length === 0) return null;

  return (
    <div className={cn("flex flex-col", className)}>
      {groups.map((group) => (
        <EventDateGroupSection key={group.key} group={group} renderCard={renderCard} />
      ))}
    </div>
  );
}
