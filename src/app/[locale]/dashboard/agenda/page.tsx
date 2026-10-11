"use client";

import * as React from "react";
import {
  Calendar,
  CheckCircle2,
  Clock,
  MapPin,
  ExternalLink,
  Video,
  Users,
  Loader2,
  Filter,
  AlertCircle,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import Link from "next/link";
import { useTranslations } from "next-intl";

interface Event {
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
  goingCount?: number;
  myRsvp?: string | null;
  maxAttendees?: number | null;
}

export default function AgendaPage() {
  const t = useTranslations("dashboard.agenda");
  const [events, setEvents] = React.useState<Event[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [filterType, setFilterType] = React.useState<string>("all");
  const [filterDomain, setFilterDomain] = React.useState<string>("all");
  const [rsvpStates, setRsvpStates] = React.useState<Record<string, "going" | "maybe" | null>>({});
  // Erreur RSVP isolée de `error` (chargement) : un refus de RSVP ne doit
  // pas remplacer toute la liste de l'agenda.
  const [rsvpError, setRsvpError] = React.useState<string | null>(null);

  const TYPE_CONFIG: Record<string, { label: string; icon: React.ReactNode; color: string }> = {
    session: { label: t("type.session"), icon: <Users className="size-4" />, color: "text-lime" },
    workshop: { label: t("type.workshop"), icon: <Video className="size-6" />, color: "text-blue-400" },
    meetup: { label: t("type.meetup"), icon: <Users className="size-4" />, color: "text-amber-400" },
    webinar: { label: t("type.webinar"), icon: <Video className="size-6" />, color: "text-purple-400" },
    other: { label: t("type.other"), icon: <Calendar className="size-6" />, color: "text-muted-foreground" },
  };

  const DOMAIN_LABELS: Record<string, string> = {
    web: t("domain.web"),
    cybersecurity: t("domain.cybersecurity"),
    ai: t("domain.ai"),
  };

  const LEVEL_LABELS: Record<string, string> = {
    beginner: t("level.beginner"),
    practicing: t("level.practicing"),
    autonomous: t("level.autonomous"),
    advanced: t("level.advanced"),
  };

  const RECURRENCE_LABELS: Record<string, string> = {
    weekly: t("recurrence.weekly"),
    biweekly: t("recurrence.biweekly"),
    monthly: t("recurrence.monthly"),
  };

  function formatEventDate(startsAt: string): string {
    const start = new Date(startsAt);
    const now = new Date();
    const diffMs = start.getTime() - now.getTime();
    const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));

    const dateStr = start.toLocaleDateString("fr-FR", {
      weekday: "long",
      day: "numeric",
      month: "long",
    });
    const timeStr = start.toLocaleTimeString("fr-FR", {
      hour: "2-digit",
      minute: "2-digit",
    });

    if (diffDays === 0) return t("date.today", { timeStr });
    if (diffDays === 1) return t("date.tomorrow", { timeStr });
    return t("date.other", { dateStr, timeStr });
  }

  function formatEventDuration(startsAt: string, endsAt: string | null): string | null {
    if (!endsAt) return null;
    const start = new Date(startsAt);
    const end = new Date(endsAt);
    const diffMin = Math.round((end.getTime() - start.getTime()) / 60000);
    if (diffMin < 60) return `${diffMin}min`;
    const h = Math.floor(diffMin / 60);
    const m = diffMin % 60;
    return m > 0 ? `${h}h${m}` : `${h}h`;
  }

  function groupByDate(events: Event[]): Map<string, Event[]> {
    const groups = new Map<string, Event[]>();
    for (const event of events) {
      const date = new Date(event.startsAt).toLocaleDateString("fr-FR", {
        weekday: "long",
        day: "numeric",
        month: "long",
        year: "numeric",
      });
      const existing = groups.get(date) ?? [];
      existing.push(event);
      groups.set(date, existing);
    }
    return groups;
  }

  React.useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const params = new URLSearchParams({ limit: "50", memberId: "me" });
        if (filterType !== "all") params.set("type", filterType);
        if (filterDomain !== "all") params.set("domain", filterDomain);
        const res = await fetch(`/api/events?${params}`, { cache: "no-store" });
        if (!res.ok) throw new Error("Erreur chargement");
        const data = await res.json();
        if (!cancelled) {
          setEvents(data.events ?? []);
          const states: Record<string, "going" | "maybe" | null> = {};
          for (const e of data.events ?? []) {
            states[e.id] = e.myRsvp ?? null;
          }
          setRsvpStates(states);
        }
      } catch {
        if (!cancelled) setError(t("error.loading"));
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [filterType, filterDomain]);

  const handleRsvp = async (eventId: string, status: "going" | "maybe") => {
    const current = rsvpStates[eventId];
    const newStatus = current === status ? "cancelled" : status;

    // Optimiste — mais roulé arrière si l'API refuse : l'UI ne doit jamais
    // afficher « Inscrit » sur un 409 (complet), 404, 429 ou 403.
    setRsvpStates((prev) => ({ ...prev, [eventId]: newStatus === "cancelled" ? null : status }));
    setRsvpError(null);

    const rollback = () =>
      setRsvpStates((prev) => ({ ...prev, [eventId]: current }));

    try {
      const res =
        newStatus === "cancelled"
          ? await fetch(`/api/events/${eventId}/rsvp`, { method: "DELETE" })
          : await fetch(`/api/events/${eventId}/rsvp`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ status: newStatus }),
            });
      if (!res.ok) {
        rollback();
        const data = (await res.json().catch(() => null)) as { error?: string } | null;
        setRsvpError(data?.error ?? t("error.rsvp"));
      }
    } catch {
      // Erreur réseau : même rollback, message dédié.
      rollback();
      setRsvpError(t("error.network"));
    }
  };

  const grouped = groupByDate(events);

  // Filter options for type
  const typeOptions = [
    { value: "all", label: t("filters.type.all") },
    { value: "session", label: t("filters.type.session") },
    { value: "workshop", label: t("filters.type.workshop") },
    { value: "meetup", label: t("filters.type.meetup") },
  ];

  // Filter options for domain
  const domainOptions = [
    { value: "all", label: t("filters.domain.all") },
    { value: "web", label: t("filters.domain.web") },
    { value: "cybersecurity", label: t("filters.domain.cybersecurity") },
    { value: "ai", label: t("filters.domain.ai") },
  ];

  return (
    <div className="space-y-6">
      {/* En-tête professionnel */}
      <header className="border-b border-border/60 pb-6 mb-8">
        <h1 className="font-display font-bold text-3xl tracking-tight text-foreground">{t("title")}</h1>
        <p className="text-sm text-muted-foreground mt-2 max-w-xl">{t("subtitle")}</p>
      </header>

      {/* Filtres regroupés */}
      <div className="flex flex-wrap items-center gap-3 mb-2">
        <div className="flex items-center gap-2">
          <Filter className="size-4 text-muted-foreground" />
          <span className="text-xs text-muted-foreground mono-label uppercase tracking-wide">{t("filters.type.label")}</span>
        </div>
        <div className="flex gap-2 flex-wrap">
          {typeOptions.map((opt) => (
            <button
              key={opt.value}
              onClick={() => setFilterType(opt.value)}
              className={cn(
                "px-3 py-1.5 rounded-full text-xs font-medium transition-all cursor-pointer border",
                filterType === opt.value
                  ? "bg-lime/15 text-lime border-lime/40 shadow-sm shadow-lime/10"
                  : "text-muted-foreground border-border/50 hover:border-lime/30 hover:text-foreground",
              )}
              aria-pressed={filterType === opt.value}
            >
              {opt.label}
            </button>
          ))}
        </div>
        <div className="w-px h-5 bg-border/40 hidden sm:block" />
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground mono-label uppercase tracking-wide">{t("filters.domain.label")}</span>
        </div>
        <div className="flex gap-2 flex-wrap">
          {domainOptions.map((opt) => (
            <button
              key={opt.value}
              onClick={() => setFilterDomain(opt.value)}
              className={cn(
                "px-3 py-1.5 rounded-full text-xs font-medium transition-all cursor-pointer border",
                filterDomain === opt.value
                  ? "bg-lime/15 text-lime border-lime/40 shadow-sm shadow-lime/10"
                  : "text-muted-foreground border-border/50 hover:border-lime/30 hover:text-foreground",
              )}
              aria-pressed={filterDomain === opt.value}
            >
              {opt.label}
            </button>
          ))}
        </div>
        {(filterType !== "all" || filterDomain !== "all") && (
          <button
            onClick={() => { setFilterType("all"); setFilterDomain("all"); }}
            className="ml-auto text-xs text-muted-foreground hover:text-foreground underline underline-offset-2 cursor-pointer"
            aria-label={t("filters.resetAria") ?? "Réinitialiser"}
          >
            Réinitialiser
          </button>
        )}
      </div>

      {/* Contenu */}
      {loading && (
        <div className="flex items-center justify-center py-12" aria-live="polite" aria-label={t("loadingAria")}>
          <Loader2 className="size-6 animate-spin text-muted-foreground" />
        </div>
      )}

      {/* Erreur RSVP (isolée de l'erreur de chargement) */}
      {rsvpError && (
        <div className="flex items-start gap-2 rounded-md bg-amber-500/10 border border-amber-500/30 px-4 py-3 text-sm text-amber-500">
          <AlertCircle className="size-4 shrink-0 mt-0.5" />
          <span className="flex-1">{rsvpError}</span>
          <button
            onClick={() => setRsvpError(null)}
            className="p-0.5 rounded text-amber-500/70 hover:text-foreground transition-colors cursor-pointer"
            aria-label={t("closeMessageAria")}
          >
            <X className="size-4" />
          </button>
        </div>
      )}

      {error && (
        <div className="text-center py-12">
          <p className="text-sm text-muted-foreground">{error}</p>
        </div>
      )}

      {!loading && !error && events.length === 0 && (
        <div className="rounded-xl border border-border/60 bg-card/25 p-10 text-center space-y-4">
          <div className="mx-auto size-12 rounded-full bg-muted/30 flex items-center justify-center">
            <Calendar className="size-6 text-muted-foreground/40" />
          </div>
          <h3 className="font-display font-semibold text-lg">{t("empty.title")}</h3>
          <p className="text-sm text-muted-foreground max-w-sm mx-auto leading-relaxed">{t("empty.description")}</p>
          <Link href="/dashboard/ateliers" className="inline-flex items-center gap-1.5 rounded-md bg-lime px-4 py-2.5 text-sm font-medium text-background hover:bg-lime/90 transition-colors">
            Découvrir les ateliers
          </Link>
        </div>
      )}

      {!loading && !error && events.length > 0 && (
        <div className="space-y-8">
          {Array.from(grouped.entries()).map(([date, dateEvents]) => (
            <div key={date}>
              <h2 className="font-display font-bold text-sm tracking-tight mono-label text-muted-foreground uppercase mb-3">
                {date}
              </h2>
              <div className="space-y-3">
                {dateEvents.map((event) => {
                  const config = TYPE_CONFIG[event.type] ?? TYPE_CONFIG.other;
                  const duration = formatEventDuration(event.startsAt, event.endsAt);
                  const goingCount = event.goingCount ?? 0;
                  const myRsvp = rsvpStates[event.id] ?? null;

                  return (
                    <div
                      key={event.id}
                      className={cn(
                        "rounded-xl border border-border/60 bg-card p-5 transition-colors",
                        "hover:border-lime/30 hover:bg-card/80",
                        event.status === "live" && "border-red-500/30 bg-red-500/5",
                      )}
                    >
                      {/* Date proéminente */}
                      <div className="flex items-center gap-3 mb-3">
                        <span className="inline-flex items-center gap-2 rounded-lg bg-lime/10 border border-lime/20 px-3 py-1 text-sm font-medium text-lime tracking-tight">
                          <Calendar className="size-4" />
                          {formatEventDate(event.startsAt)}
                        </span>
                        {event.status === "live" && (
                          <span className="inline-flex items-center gap-1.5 rounded-full border border-red-500/30 bg-red-500/10 px-2.5 py-0.5 text-xs font-medium text-red-400">
                            <span className="inline-block size-1.5 rounded-full bg-red-400 animate-pulse" />
                            En cours
                          </span>
                        )}
                      </div>

                      <div className="flex items-start gap-4">
                        {/* Icône type */}
                        <span className={cn("shrink-0 mt-0.5", config.color)}>
                          {config.icon}
                        </span>

                        <div className="flex-1 min-w-0">
                          {/* Titre + badges */}
                          <div className="flex items-center gap-2 flex-wrap">
                            <h3 className="text-base font-medium">{event.title}</h3>
                            <span className={cn(
                              "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium",
                              config.color,
                              "border-current/20 bg-current/5",
                            )}>
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
                          </div>

                          {/* Description */}
                          {event.description && (
                            <p className="text-sm text-muted-foreground mt-2">
                              {event.description}
                            </p>
                          )}

                          {/* Métadonnées */}
                          <div className="flex items-center gap-4 mt-3 text-xs text-muted-foreground flex-wrap">
                            <span className="inline-flex items-center gap-1.5">
                              <Clock className="size-3.5" />
                              {formatEventDate(event.startsAt)}
                              {duration && <span className="text-muted-foreground/60">· {duration}</span>}
                            </span>
                            {event.location && (
                              <span className="inline-flex items-center gap-1.5">
                                <MapPin className="size-3.5" />
                                {event.location}
                              </span>
                            )}
                            {event.recurrence && (
                              <span className="text-muted-foreground/60">
                                🔄 {RECURRENCE_LABELS[event.recurrence] ?? event.recurrence}
                              </span>
                            )}
                            {goingCount > 0 && (
                              <span className="inline-flex items-center gap-1 text-lime">
                                <Users className="size-3.5" />
                                {goingCount}
                              </span>
                            )}
                          </div>
                        </div>

                        {/* Lien externe */}
                        {event.url && (
                          <a
                            href={event.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="shrink-0 p-2 rounded-md text-muted-foreground hover:text-lime hover:bg-lime/10 transition-colors"
                            title={t("openLinkTitle")}
                            aria-label={t("openLinkTitle")}
                          >
                            <ExternalLink className="size-6" />
                          </a>
                        )}
                      </div>

                      {/* Badge "live" */}
                      {event.status === "live" && (
                        <div className="mt-3">
                          <span className="inline-flex items-center gap-1.5 rounded-full border border-red-500/30 bg-red-500/15 px-2.5 py-1 text-xs font-medium text-red-400">
                            <span className="inline-block size-1.5 rounded-full bg-red-400 animate-pulse" />
                            {t("status.live")}
                          </span>
                        </div>
                      )}

                      {/* RSVP */}
                      {event.status === "scheduled" && (
                        <div className="mt-3">
                          {myRsvp === "going" ? (
                            <button
                              onClick={() => handleRsvp(event.id, "going")}
                              className="inline-flex items-center gap-1.5 rounded-md bg-lime/10 border border-lime/30 px-3 py-1.5 text-xs font-medium text-lime transition-colors hover:bg-lime/20 cursor-pointer"
                            >
                              <CheckCircle2 className="size-3.5" />
                              {t("rsvp.going.cancel")}
                            </button>
                          ) : myRsvp === "maybe" ? (
                            <button
                              onClick={() => handleRsvp(event.id, "maybe")}
                              className="inline-flex items-center gap-1.5 rounded-md bg-amber-500/10 border border-amber-500/30 px-3 py-1.5 text-xs font-medium text-amber-300 transition-colors hover:bg-amber-500/20 cursor-pointer"
                            >
                              <CheckCircle2 className="size-3.5" />
                              {t("rsvp.maybe.cancel")}
                            </button>
                          ) : (
                            <div className="flex gap-2">
                              <button
                                onClick={() => handleRsvp(event.id, "going")}
                                className="inline-flex items-center gap-1.5 rounded-md bg-lime px-3 py-1.5 text-xs font-medium text-background transition-colors hover:bg-lime/90 cursor-pointer"
                              >
                                <Users className="size-3.5" />
                                {t("rsvp.going.join")}
                              </button>
                              <button
                                onClick={() => handleRsvp(event.id, "maybe")}
                                className="inline-flex items-center gap-1.5 rounded-md border border-border/60 bg-background px-3 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:border-lime/30 hover:text-lime cursor-pointer"
                              >
                                {t("rsvp.maybe.join")}
                              </button>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}