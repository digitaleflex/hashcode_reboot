import * as React from "react";
import { Clock, MapPin, Users, Heart, ExternalLink, CheckCircle2, Sparkles } from "lucide-react";
import { Link } from "@/i18n/routing";
import { cn } from "@/lib/utils";
import { CtaArrow } from "@/components/reboot/shared";
import { EventStatusBadge } from "./event-status-badge";
import { InterestButton } from "./interest-button";
import {
  formatDuration,
  formatTimeRange,
  countLabel,
} from "./format";
import {
  RECURRENCE_LABELS,
  domainLabel,
  levelLabel,
  typeLabel,
  type PublicEvent,
} from "./types";

/* ── Styles ──────────────────────────────────────────────────────────────── */

const ACTION_BASE =
  "inline-flex min-h-[44px] items-center justify-center gap-2 rounded-md px-4 text-sm font-medium leading-none transition-colors duration-150 focus-lime cursor-pointer disabled:cursor-not-allowed disabled:opacity-50";

/** CTA primaire — lime, la seule action principale de la carte. */
const ACTION_PRIMARY = `${ACTION_BASE} bg-lime text-background hover:bg-lime/90`;

/** CTA secondaire — bordure neutre. */
const ACTION_SECONDARY = `${ACTION_BASE} border border-border text-foreground hover:border-lime/50 hover:text-lime`;

/** État « déjà choisi » — lime en contour, jamais en fond (le fond est réservé au CTA). */
const ACTION_ACTIVE = `${ACTION_BASE} border border-lime/50 bg-lime/10 text-lime hover:bg-lime/20`;

/* ── Sous-éléments ───────────────────────────────────────────────────────── */

function MetaRow({
  icon,
  children,
}: {
  icon: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <span className="inline-flex min-w-0 items-center gap-1.5 text-[13px] leading-5 text-foreground/80">
      <span className="shrink-0 text-muted-foreground" aria-hidden>
        {icon}
      </span>
      <span className="truncate">{children}</span>
    </span>
  );
}

/* ── Carte ───────────────────────────────────────────────────────────────── */

export interface EventCardProps {
  event: PublicEvent;
  isAuthed: boolean;
  /** Première carte de la liste uniquement. */
  isFeatured?: boolean;
  /** RSVP courant : "going" | "maybe" | null. */
  myRsvp: string | null;
  /** Nombre d'intérêts (serveur + optimiste). */
  interestCount: number;
  /** Interest déjà déclaré par ce visiteur. */
  isInterested: boolean;
  /** RSVP en cours d'envoi. */
  isPending: boolean;
  onInterest: (eventId: string, nextActive: boolean) => void;
  onRsvp: (eventId: string, status: "going" | "maybe") => void;
  onJoin: () => void;
}

function EventCardBase({
  event,
  isAuthed,
  isFeatured = false,
  myRsvp,
  interestCount,
  isInterested,
  isPending,
  onInterest,
  onRsvp,
  onJoin,
}: EventCardProps) {
  const duration = formatDuration(event.startsAt, event.endsAt);
  const timeRange = formatTimeRange(event.startsAt, event.endsAt);
  const level = levelLabel(event.level);
  const domain = domainLabel(event.domain);
  const isFull = event.spotsLeft === 0;
  const isFinished = event.status === "completed" || event.status === "cancelled";
  const canRsvp = !isFinished;
  const detailHref = `/evenements/${event.id}`;

  return (
    <article
      aria-labelledby={`event-${event.id}-title`}
      className={cn(
        "lift-on-hover group rounded-lg border bg-card/40 p-4 sm:p-5",
        isFeatured
          ? "border-lime/40 bg-card/70 p-5 sm:p-6"
          : "border-border/70 hover:border-border",
      )}
    >
      {/* Chips sobres — une seule rangée, une seule teinte. */}
      <div className="flex flex-wrap items-center gap-2">
        <span className="font-mono text-[11px] uppercase tracking-[0.12em] text-muted-foreground">
          {typeLabel(event.type)}
        </span>
        {level && (
          <span className="rounded-md border border-border px-2 py-0.5 text-[11px] font-medium leading-4 text-muted-foreground">
            {level}
          </span>
        )}
        {isFeatured && (
          <span className="inline-flex items-center gap-1 rounded-md border border-lime/40 bg-lime/10 px-2 py-0.5 text-[11px] font-medium uppercase leading-4 tracking-[0.08em] text-lime">
            <Sparkles className="size-3" aria-hidden />
            À la une
          </span>
        )}
        <span className="ml-auto">
          <EventStatusBadge status={event.status} isFull={isFull && !isFinished} />
        </span>
      </div>

      {/* Titre — PAS un lien : les boutons imbriqués casseraient le clic. */}
      <h3
        id={`event-${event.id}-title`}
        className="mt-2.5 font-sans text-[17px] font-semibold leading-snug tracking-tight text-foreground text-balance sm:text-[18px]"
      >
        {event.title}
      </h3>

      {event.description ? (
        <p className="mt-1.5 line-clamp-2 text-sm leading-relaxed text-muted-foreground">
          {event.description}
        </p>
      ) : null}

      <div className="mt-4 h-px w-full bg-border" aria-hidden />

      {/* Métadonnées en grille lisible (2 colonnes dès sm) — plus de ligne de "·". */}
      <dl className="mt-3 grid grid-cols-1 gap-x-6 gap-y-2 sm:grid-cols-2">
        <MetaRow icon={<Clock className="size-4" />}>
          <span className="font-medium text-foreground">
            {formatShortDay(event.startsAt)}
          </span>
          <span className="text-muted-foreground"> · {timeRange}</span>
        </MetaRow>

        <MetaRow icon={<MapPin className="size-4" />}>
          {event.location ?? "En ligne"}
          {duration ? (
            <span className="text-muted-foreground"> · {duration}</span>
          ) : null}
        </MetaRow>

        {(level || domain) && (
          <div className="flex min-w-0 flex-wrap items-center gap-x-4 gap-y-1 text-[13px] leading-5">
            {level && <span className="text-muted-foreground">Niveau {level.toLowerCase()}</span>}
            {domain && <span className="text-muted-foreground">Axe {domain}</span>}
          </div>
        )}

        <div className="flex min-w-0 flex-wrap items-center gap-x-4 gap-y-1 text-[13px] leading-5 text-muted-foreground">
          <span className="inline-flex items-center gap-1.5">
            <Users className="size-4" aria-hidden />
            {countLabel(event.goingCount, "inscrit", "inscrits")}
          </span>
          {interestCount > 0 && (
            <span className="inline-flex items-center gap-1.5">
              <Heart className="size-4" aria-hidden />
              {countLabel(interestCount, "intéressé", "intéressés")}
            </span>
          )}
          {event.recurrence && (
            <span>{RECURRENCE_LABELS[event.recurrence] ?? event.recurrence}</span>
          )}
        </div>
      </dl>

      {event.url ? (
        <a
          href={event.url}
          target="_blank"
          rel="noopener noreferrer"
          aria-label={`Ouvre le lien de l'événement ${event.title} (nouvel onglet)`}
          className="mt-3 inline-flex min-h-[44px] items-center gap-1.5 rounded-md text-[13px] text-muted-foreground transition-colors hover:text-lime focus-lime"
        >
          <ExternalLink className="size-4" aria-hidden />
          Lien de l&apos;événement
          <span className="sr-only">(nouvel onglet)</span>
        </a>
      ) : null}

      <div className="mt-4 h-px w-full bg-border" aria-hidden />

      {/* CTA — primaire EN PREMIER dans le DOM (mobile : pleine largeur, en tête). */}
      {canRsvp ? (
        <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
          {isAuthed ? (
            <AuthedActions
              event={event}
              myRsvp={myRsvp}
              isPending={isPending}
              isInterested={isInterested}
              interestCount={interestCount}
              onInterest={onInterest}
              onRsvp={onRsvp}
            />
          ) : (
            <>
              <button
                type="button"
                onClick={onJoin}
                className={cn(ACTION_PRIMARY, "group w-full sm:w-auto")}
              >
                Créer mon profil
                <CtaArrow />
              </button>
              <InterestButton
                eventId={event.id}
                eventTitle={event.title}
                active={isInterested}
                count={interestCount}
                onToggle={onInterest}
                className="w-full sm:w-auto"
              />
            </>
          )}
        </div>
      ) : (
        <div className="mt-4 flex items-center gap-4">
          <Link
            href={detailHref}
            className="group inline-flex min-h-[44px] items-center gap-2 rounded-md text-sm font-medium text-lime transition-colors hover:text-lime/80 focus-lime"
          >
            Voir les détails
            <CtaArrow />
          </Link>
          {isInterested && (
            <InterestButton
              eventId={event.id}
              eventTitle={event.title}
              active={isInterested}
              count={interestCount}
              onToggle={onInterest}
            />
          )}
        </div>
      )}
    </article>
  );
}

/** Actions du membre connecté — la sémantique RSVP existante est inchangée. */
function AuthedActions({
  event,
  myRsvp,
  isPending,
  isInterested,
  interestCount,
  onInterest,
  onRsvp,
}: {
  event: PublicEvent;
  myRsvp: string | null;
  isPending: boolean;
  isInterested: boolean;
  interestCount: number;
  onInterest: (eventId: string, nextActive: boolean) => void;
  onRsvp: (eventId: string, status: "going" | "maybe") => void;
}) {
  const isFull = event.spotsLeft === 0;

  return (
    <>
      {myRsvp === "going" ? (
        <button
          type="button"
          onClick={() => onRsvp(event.id, "going")}
          disabled={isPending}
          className={cn(ACTION_ACTIVE, "w-full sm:w-auto")}
        >
          <CheckCircle2 className="size-4" aria-hidden />
          Inscrit · Annuler
        </button>
      ) : myRsvp === "maybe" ? (
        <button
          type="button"
          onClick={() => onRsvp(event.id, "maybe")}
          disabled={isPending}
          className={cn(ACTION_ACTIVE, "w-full sm:w-auto")}
        >
          <CheckCircle2 className="size-4" aria-hidden />
          Peut-être · Annuler
        </button>
      ) : (
        <button
          type="button"
          onClick={() => onRsvp(event.id, "going")}
          disabled={isPending || isFull}
          className={cn(ACTION_PRIMARY, "w-full sm:w-auto")}
        >
          <Users className="size-4" aria-hidden />
          {isFull ? "Complet" : "Je participe"}
        </button>
      )}

      {myRsvp !== "going" && (
        <button
          type="button"
          onClick={() => onRsvp(event.id, "maybe")}
          disabled={isPending}
          className={cn(ACTION_SECONDARY, "w-full sm:w-auto")}
        >
          Peut-être
        </button>
      )}

      <InterestButton
        eventId={event.id}
        eventTitle={event.title}
        active={isInterested}
        count={interestCount}
        onToggle={onInterest}
        className="w-full sm:w-auto"
      />
    </>
  );
}

/** "dim. 04 oct." — compact, pour la ligne de créneau. */
function formatShortDay(startsAt: string): string {
  return new Date(startsAt)
    .toLocaleDateString("fr-FR", { weekday: "short", day: "2-digit", month: "short" })
    .replace(/\./g, "");
}

export const EventCard = React.memo(EventCardBase);
