"use client";

import * as React from "react";
import {
  ArrowLeft,
  CalendarDays,
  Clock,
  ExternalLink,
  MapPin,
  Users,
  Heart,
} from "lucide-react";
import { Link } from "@/i18n/routing";
import { cn } from "@/lib/utils";
import { EventsHeader } from "@/components/reboot/events/events-header";
import { EventsFooter } from "@/components/reboot/events/events-footer";
import { EventStatusBadge } from "@/components/reboot/events/event-status-badge";
import {
  RECURRENCE_LABELS,
  domainLabel,
  levelLabel,
  typeLabel,
} from "@/components/reboot/events/types";
import {
  formatDuration,
  formatFullDate,
  formatTimeRange,
  relativeDayBadge,
} from "@/components/reboot/events/format";
import {
  InterestControl,
  SignupButtons,
  useEventSignup,
} from "./event-detail-actions";

/**
 * Page de détail d'un événement — /evenements/[id].
 *
 * Server Component par défaut : la pageiguille ne rend que le squelette et
 * passe les données déjà résolues (privacy : aucun RSVP nominatif).
 *
 * Les champs « intervenant » et « prérequis détaillés » n'existent pas dans le
 * modèle Event : ils ne sont donc pas inventés. Le niveau attendu, lui, est une
 * donnée réelle et est affiché dans la grille d'informations.
 */

export interface EventDetailProgrammeStep {
  number: number;
  title: string;
  objective: string | null;
  program: string | null;
  scheduledAt: string | null;
}

export interface EventDetailData {
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
  goingCount: number;
  interestCount: number;
  maxAttendees: number | null;
  spotsLeft: number | null;
  myRsvp: string | null;
  programme: EventDetailProgrammeStep[];
}

function MetaItem({
  icon,
  label,
  children,
}: {
  icon: React.ReactNode;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="min-w-0">
      <dt className="flex items-center gap-1.5 text-[12px] uppercase tracking-[0.1em] text-muted-foreground">
        <span className="shrink-0" aria-hidden>
          {icon}
        </span>
        {label}
      </dt>
      <dd className="mt-1 text-[15px] font-medium text-foreground">{children}</dd>
    </div>
  );
}

export function EventDetailPage({
  event,
  isAuthed,
}: {
  event: EventDetailData;
  isAuthed: boolean;
}) {
  const handleJoin = React.useCallback(() => {
    window.location.assign("/");
  }, []);

  const isFull = event.spotsLeft === 0;
  const isFinished = event.status === "completed" || event.status === "cancelled";
  const level = levelLabel(event.level);
  const domain = domainLabel(event.domain);
  const duration = formatDuration(event.startsAt, event.endsAt);
  const relative = relativeDayBadge(event.startsAt);

  // Un seul état, partagé par le bloc de CTA en ligne et la barre sticky mobile.
  const signup = useEventSignup({
    eventId: event.id,
    initialMyRsvp: event.myRsvp,
    initialInterestCount: event.interestCount,
    isFull,
  });

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <EventsHeader isAuthed={isAuthed} onJoin={handleJoin} />

      <main id="contenu" className="flex-1 pb-28 focus:outline-none md:pb-0">
        <div className="mx-auto w-full max-w-[1120px] px-5 py-8 sm:px-6 sm:py-10">
          <Link
            href="/evenements"
            className="inline-flex min-h-[44px] items-center gap-2 text-[13px] text-muted-foreground transition-colors hover:text-lime focus-lime"
          >
            <ArrowLeft className="size-4" aria-hidden />
            Tous les événements
          </Link>

          <article className="mt-4">
            {/* Chips — une seule teinte, statut à droite. */}
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-mono text-[11px] uppercase tracking-[0.12em] text-muted-foreground">
                {typeLabel(event.type)}
              </span>
              {level && (
                <span className="rounded-md border border-border px-2 py-0.5 text-[11px] font-medium leading-4 text-muted-foreground">
                  {level}
                </span>
              )}
              {relative && (
                <span className="rounded-md border border-lime/40 bg-lime/10 px-2 py-0.5 text-[11px] font-medium uppercase tracking-[0.08em] text-lime">
                  {relative}
                </span>
              )}
              <span className="ml-auto">
                <EventStatusBadge status={event.status} isFull={isFull && !isFinished} />
              </span>
            </div>

            <h1 className="mt-3 font-display text-[28px] font-bold leading-[1.15] tracking-tight text-foreground text-balance sm:text-[36px]">
              {event.title}
            </h1>

            <div className="mt-6 grid gap-8 md:grid-cols-[minmax(0,1fr)_320px] md:gap-10">
              {/* ── Colonne contenu ─────────────────────────────────────── */}
              <div className="min-w-0">
                <section aria-labelledby="event-infos">
                  <h2
                    id="event-infos"
                    className="font-mono text-[12px] uppercase tracking-[0.12em] text-muted-foreground"
                  >
                    Informations
                  </h2>

                  <dl className="mt-4 grid grid-cols-1 gap-x-6 gap-y-5 sm:grid-cols-2">
                    <MetaItem icon={<CalendarDays className="size-4" />} label="Date">
                      <time dateTime={event.startsAt}>{formatFullDate(event.startsAt)}</time>
                    </MetaItem>

                    <MetaItem icon={<Clock className="size-4" />} label="Horaires">
                      {formatTimeRange(event.startsAt, event.endsAt)}
                      {duration && (
                        <span className="text-muted-foreground"> · {duration}</span>
                      )}
                    </MetaItem>

                    <MetaItem icon={<MapPin className="size-4" />} label="Format">
                      {event.location ?? "En ligne"}
                    </MetaItem>

                    <MetaItem icon={<Users className="size-4" />} label="Participants">
                      {event.maxAttendees
                        ? `${event.goingCount} inscrit${event.goingCount > 1 ? "s" : ""} sur ${event.maxAttendees}`
                        : `${event.goingCount} inscrit${event.goingCount > 1 ? "s" : ""}`}
                    </MetaItem>

                    {level && (
                      <MetaItem icon={<Users className="size-4" />} label="Niveau attendu">
                        {level}
                      </MetaItem>
                    )}

                    {domain && (
                      <MetaItem icon={<Heart className="size-4" />} label="Axe">
                        {domain}
                      </MetaItem>
                    )}

                    <MetaItem icon={<Heart className="size-4" />} label="Intérêt">
                      {event.interestCount} intéressé{event.interestCount > 1 ? "s" : ""}
                    </MetaItem>

                    {event.recurrence && (
                      <MetaItem icon={<CalendarDays className="size-4" />} label="Récurrence">
                        {RECURRENCE_LABELS[event.recurrence] ?? event.recurrence}
                      </MetaItem>
                    )}
                  </dl>
                </section>

                {event.description && (
                  <section aria-labelledby="event-description" className="mt-10">
                    <h2
                      id="event-description"
                      className="font-mono text-[12px] uppercase tracking-[0.12em] text-muted-foreground"
                    >
                      Description
                    </h2>
                    <p className="mt-3 whitespace-pre-line text-[15px] leading-relaxed text-foreground">
                      {event.description}
                    </p>
                  </section>
                )}

                {event.programme.length > 0 && (
                  <section aria-labelledby="event-programme" className="mt-10">
                    <h2
                      id="event-programme"
                      className="font-mono text-[12px] uppercase tracking-[0.12em] text-muted-foreground"
                    >
                      Programme
                    </h2>
                    <ol className="mt-4 flex flex-col gap-3">
                      {event.programme.map((step) => (
                        <li
                          key={step.number}
                          className="rounded-lg border border-border/70 bg-card/40 p-4"
                        >
                          <div className="flex items-baseline gap-2.5">
                            <span className="font-mono text-[12px] tabular-nums text-lime">
                              {String(step.number).padStart(2, "0")}
                            </span>
                            <h3 className="text-[15px] font-semibold text-foreground">
                              {step.title}
                            </h3>
                          </div>
                          {step.objective && (
                            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                              {step.objective}
                            </p>
                          )}
                          {step.program && (
                            <p className="mt-1.5 whitespace-pre-line text-sm leading-relaxed text-foreground/80">
                              {step.program}
                            </p>
                          )}
                        </li>
                      ))}
                    </ol>
                  </section>
                )}

                {event.url && (
                  <a
                    href={event.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label={`Ouvre le lien de l'événement ${event.title} (nouvel onglet)`}
                    className="mt-10 inline-flex min-h-[44px] items-center gap-2 rounded-md border border-border px-4 text-sm font-medium text-foreground transition-colors hover:border-lime/50 hover:text-lime focus-lime"
                  >
                    <ExternalLink className="size-4" aria-hidden />
                    Lien de l&apos;événement
                    <span className="sr-only">(nouvel onglet)</span>
                  </a>
                )}
              </div>

              {/* ── Colonne CTA (desktop) ───────────────────────────────── */}
              <aside className="md:sticky md:top-24 md:self-start">
                <div className="rounded-lg border border-border/70 bg-card/40 p-5">
                  <h2 className="font-mono text-[12px] uppercase tracking-[0.12em] text-muted-foreground">
                    Participer
                  </h2>

                  {!isFinished ? (
                    <div className="mt-4 flex flex-col gap-2.5">
                      <SignupButtons state={signup} isAuthed={isAuthed} onJoin={handleJoin} />
                      <InterestControl
                        state={signup}
                        eventId={event.id}
                        eventTitle={event.title}
                        className="w-full"
                      />
                      {!isAuthed && (
                        <p className="text-[13px] leading-relaxed text-muted-foreground">
                          « Ça m&apos;intéresse » est un signal anonyme, sans
                          compte. Pour t&apos;inscrire réellement, crée ton profil.
                        </p>
                      )}
                    </div>
                  ) : (
                    <p className="mt-4 text-[15px] leading-relaxed text-muted-foreground">
                      {event.status === "cancelled"
                        ? "Cet événement a été annulé. Les prochaines dates sont sur la page des événements."
                        : "Cet événement est terminé. Le programme reste consultable ci-dessus."}
                    </p>
                  )}
                </div>
              </aside>
            </div>
          </article>
        </div>
      </main>

      {/* ── CTA sticky mobile ──────────────────────────────────────── */}
      {!isFinished && (
        <div
          className="fixed inset-x-0 bottom-0 z-30 border-t border-border/70 bg-background/95 px-5 py-3 backdrop-blur-md md:hidden"
          style={{ paddingBottom: "calc(0.75rem + env(safe-area-inset-bottom))" }}
        >
          <div className="flex items-center gap-2">
            <div className="min-w-0 flex-1">
              <SignupButtons
                state={signup}
                isAuthed={isAuthed}
                onJoin={handleJoin}
                size="bar"
              />
            </div>
            <InterestControl
              state={signup}
              eventId={event.id}
              eventTitle={event.title}
              className="shrink-0 px-3"
            />
          </div>
        </div>
      )}

      <EventsFooter />
    </div>
  );
}