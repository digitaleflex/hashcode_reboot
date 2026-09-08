"use client";

import * as React from "react";
import {
  Calendar,
  Clock,
  MapPin,
  ExternalLink,
  Video,
  Users,
  Loader2,
  Filter,
} from "lucide-react";
import { cn } from "@/lib/utils";

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
}

const TYPE_CONFIG: Record<string, { label: string; icon: React.ReactNode; color: string }> = {
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

  if (diffDays === 0) return `Aujourd'hui à ${timeStr}`;
  if (diffDays === 1) return `Demain à ${timeStr}`;
  return `${dateStr} à ${timeStr}`;
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

export default function AgendaPage() {
  const [events, setEvents] = React.useState<Event[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [filterType, setFilterType] = React.useState<string>("all");
  const [filterDomain, setFilterDomain] = React.useState<string>("all");

  React.useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const params = new URLSearchParams({ limit: "50" });
        if (filterType !== "all") params.set("type", filterType);
        if (filterDomain !== "all") params.set("domain", filterDomain);
        const res = await fetch(`/api/events?${params}`, { cache: "no-store" });
        if (!res.ok) throw new Error("Erreur chargement");
        const data = await res.json();
        if (!cancelled) setEvents(data.events ?? []);
      } catch {
        if (!cancelled) setError("Impossible de charger l'agenda.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [filterType, filterDomain]);

  const grouped = groupByDate(events);

  return (
    <div className="space-y-6">
      {/* Header */}
      <header>
        <h1 className="font-display font-bold text-2xl tracking-tight">
          Agenda
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Sessions, workshops et meetups à venir.
        </p>
      </header>

      {/* Filtres */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="flex items-center gap-2">
          <Filter className="size-4 text-muted-foreground" />
          <span className="text-xs text-muted-foreground mono-label">Type :</span>
        </div>
        <div className="flex gap-1.5">
          {[
            { value: "all", label: "Tous" },
            { value: "session", label: "Sessions" },
            { value: "workshop", label: "Workshops" },
            { value: "meetup", label: "Meetups" },
          ].map((opt) => (
            <button
              key={opt.value}
              onClick={() => setFilterType(opt.value)}
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

        <div className="w-px h-4 bg-border/60 mx-1" />

        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground mono-label">Domaine :</span>
        </div>
        <div className="flex gap-1.5">
          {[
            { value: "all", label: "Tous" },
            { value: "web", label: "Web" },
            { value: "cybersecurity", label: "Cyber" },
            { value: "ai", label: "AI" },
          ].map((opt) => (
            <button
              key={opt.value}
              onClick={() => setFilterDomain(opt.value)}
              className={cn(
                "px-3 py-1.5 rounded-md text-xs font-medium transition-colors cursor-pointer",
                filterDomain === opt.value
                  ? "bg-lime/15 text-lime border border-lime/30"
                  : "text-muted-foreground border border-border/60 hover:border-lime/30",
              )}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {/* Contenu */}
      {loading && (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="size-6 animate-spin text-muted-foreground" />
        </div>
      )}

      {error && (
        <div className="text-center py-12">
          <p className="text-sm text-muted-foreground">{error}</p>
        </div>
      )}

      {!loading && !error && events.length === 0 && (
        <div className="text-center py-12">
          <Calendar className="size-12 text-muted-foreground/20 mx-auto mb-4" />
          <p className="text-muted-foreground">Aucun événement à venir.</p>
          <p className="text-xs text-muted-foreground/60 mt-1">
            Les prochaines sessions seront bientôt annoncées.
          </p>
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

                  return (
                    <div
                      key={event.id}
                      className={cn(
                        "rounded-lg border border-border/60 bg-card/40 p-5",
                        "hover:border-lime/30 transition-colors",
                        event.status === "live" && "border-red-500/30 bg-red-500/5",
                      )}
                    >
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
                              "inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-medium mono-label",
                              config.color,
                              "border-current/20 bg-current/5",
                            )}>
                              {config.label}
                            </span>
                            {event.domain && (
                              <span className="inline-flex items-center rounded-full border border-border/60 bg-secondary/50 px-2 py-0.5 text-[10px] font-medium text-muted-foreground mono-label">
                                {DOMAIN_LABELS[event.domain] ?? event.domain}
                              </span>
                            )}
                            {event.level && (
                              <span className="inline-flex items-center rounded-full border border-border/60 bg-secondary/50 px-2 py-0.5 text-[10px] font-medium text-muted-foreground mono-label">
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
                          <div className="flex items-center gap-4 mt-3 text-xs text-muted-foreground">
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
                          </div>
                        </div>

                        {/* Lien externe */}
                        {event.url && (
                          <a
                            href={event.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="shrink-0 p-2 rounded-md text-muted-foreground hover:text-lime hover:bg-lime/10 transition-colors"
                            title="Ouvrir le lien"
                          >
                            <ExternalLink className="size-4" />
                          </a>
                        )}
                      </div>

                      {/* Badge "live" */}
                      {event.status === "live" && (
                        <div className="mt-3">
                          <span className="inline-flex items-center gap-1.5 rounded-full bg-red-500/15 border border-red-500/30 px-2.5 py-0.5 text-[10px] font-medium text-red-400 mono-label">
                            <span className="inline-block size-1.5 rounded-full bg-red-400 animate-pulse" />
                            EN DIRECT
                          </span>
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
