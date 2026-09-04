"use client";

import * as React from "react";
import { MonoLabel } from "../shared";
import { cn } from "@/lib/utils";
import { fetchJson, isAbortError } from "./lib/fetchJson";

const EVENT_LABELS: Record<
  string,
  { label: string; tone: "lime" | "sky" | "amber" | "muted" | "destructive" }
> = {
  reboot_page_view: { label: "Page vue", tone: "muted" },
  reboot_cta_clicked: { label: "CTA cliqué", tone: "sky" },
  profiling_started: { label: "Profilage démarré", tone: "sky" },
  profiling_question_answered: { label: "Question répondue", tone: "muted" },
  profiling_back: { label: "Retour arrière", tone: "muted" },
  profiling_resumed: { label: "Reprise", tone: "muted" },
  profiling_completed: { label: "Profil complété", tone: "lime" },
  profil_generated: { label: "Profil généré", tone: "lime" },
  community_cta_clicked: { label: "Action communauté", tone: "amber" },
  whatsapp_join_clicked: { label: "Clic WhatsApp", tone: "lime" },
  share_profile_clicked: { label: "Partage profil", tone: "sky" },
};

const EVENT_TONES: Record<string, string> = {
  lime: "text-lime",
  sky: "text-sky-400",
  amber: "text-amber-300",
  muted: "text-muted-foreground",
  destructive: "text-destructive",
};

export function ActivityLogSkeleton({ rows = 6 }: { rows?: number }) {
  return (
    <div
      aria-hidden
      className="rounded-md border border-border/60 bg-card/40 divide-y divide-border/40"
    >
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="flex items-center gap-3 p-3">
          <div className="admin-skeleton admin-skeleton-dot" />
          <div className="flex-1 space-y-2">
            <div className="admin-skeleton admin-skeleton-line w-1/3" />
            <div className="admin-skeleton admin-skeleton-line w-1/2" />
          </div>
          <div className="admin-skeleton admin-skeleton-line w-16" />
        </div>
      ))}
      <span className="sr-only">Chargement de l’activité…</span>
    </div>
  );
}

export function ActivityLog() {
  const [events, setEvents] = React.useState<
    { id: string; type: string; ref: string | null; createdAt: string }[]
  >([]);
  const [loading, setLoading] = React.useState(true);
  const [expanded, setExpanded] = React.useState(false);

  React.useEffect(() => {
    const ctrl = new AbortController();
    let mounted = true;
    setLoading(true);
    (async () => {
      try {
        const { res, data } = await fetchJson(
          `/api/admin/activity?limit=${expanded ? 50 : 12}`,
          { cache: "no-store", signal: ctrl.signal },
        );
        if (ctrl.signal.aborted) return;
        if (mounted && res.ok)
          setEvents(
            (data?.events ?? []) as {
              id: string;
              type: string;
              ref: string | null;
              createdAt: string;
            }[],
          );
      } catch (e) {
        if (isAbortError(e)) return;
        /* activity optionnel — pas d'erreur dure */
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => {
      mounted = false;
      ctrl.abort();
    };
  }, [expanded]);

  return (
    <section className="mt-6">
      <div className="flex items-center justify-between mb-3">
        <MonoLabel className="text-muted-foreground">Journal d&apos;activité</MonoLabel>
        <span className="mono-label text-muted-foreground">
          {events.length} événement{events.length > 1 ? "s" : ""}
        </span>
      </div>
      {loading && events.length === 0 ? (
        <ActivityLogSkeleton />
      ) : (
      <div className="rounded-md border border-border/60 bg-card/40 divide-y divide-border/40 max-h-96 overflow-y-auto scroll-slim">
        {!loading && events.length === 0 && (
          <p className="p-4 text-xs text-muted-foreground">Aucun événement.</p>
        )}
        {events.map((ev) => {
          const meta = EVENT_LABELS[ev.type] ?? {
            label: ev.type,
            tone: "muted" as const,
          };
          const isAdminAction = ev.ref?.startsWith("admin-");
          return (
            <div
              key={ev.id}
              className="flex items-center gap-3 p-3 hover:bg-elevated/30 transition-colors"
            >
              <span
                className={cn(
                  "shrink-0 size-1.5 rounded-full",
                  meta.tone === "lime" && "bg-lime",
                  meta.tone === "sky" && "bg-sky-400",
                  meta.tone === "amber" && "bg-amber-400",
                  meta.tone === "destructive" && "bg-destructive",
                  meta.tone === "muted" && "bg-muted-foreground/50",
                )}
                aria-hidden
              />
              <div className="flex-1 min-w-0">
                <div className="flex items-baseline gap-2">
                  <span
                    className={cn("text-sm font-medium", EVENT_TONES[meta.tone])}
                  >
                    {meta.label}
                  </span>
                  {isAdminAction && (
                    <span className="mono-label text-amber-300 text-[11px]">ADMIN</span>
                  )}
                </div>
                {ev.ref && (
                  <div className="text-xs text-muted-foreground font-mono truncate mt-0.5">
                    {ev.ref}
                  </div>
                )}
              </div>
              <span className="shrink-0 mono-label text-muted-foreground tabular-nums admin-num text-[11px]">
                {new Date(ev.createdAt).toLocaleString("fr-FR", {
                  day: "2-digit",
                  month: "short",
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </span>
            </div>
          );
        })}
      </div>
      )}
      <button
        onClick={() => setExpanded((e) => !e)}
        className="mt-2 text-xs text-muted-foreground hover:text-lime transition-colors focus-lime mono-label"
      >
        {expanded ? "↑ Voir moins" : "↓ Voir plus (50)"}
      </button>
    </section>
  );
}
