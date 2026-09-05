"use client";

import * as React from "react";
import { MonoLabel } from "../shared";
import { cn } from "@/lib/utils";
import { fetchJson, isAbortError } from "./lib/fetchJson";
import { ActivityLogSkeleton } from "./skeletons/ActivityLogSkeleton";

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
  amber: "text-amber-200",
  muted: "text-muted-foreground",
  destructive: "text-destructive",
};

export { ActivityLogSkeleton };

export function ActivityLog() {
  const [events, setEvents] = React.useState<
    { id: string; type: string; ref: string | null; createdAt: string }[]
  >([]);
  const [loading, setLoading] = React.useState(true);
  const [expanded, setExpanded] = React.useState(false);

  const load = React.useCallback(async (showMore: boolean, signal?: AbortSignal) => {
    try {
      const { res, data } = await fetchJson(
        `/api/admin/activity?limit=${showMore ? 50 : 12}`,
        { cache: "no-store", signal },
      );
      if (signal?.aborted) return;
      if (res.ok)
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
    }
  }, []);

  React.useEffect(() => {
    const ctrl = new AbortController();
    let mounted = true;
    setLoading(true);
    (async () => {
      await load(expanded, ctrl.signal);
      if (mounted) setLoading(false);
    })();
    return () => {
      mounted = false;
      ctrl.abort();
    };
  }, [expanded, load]);

  return (
    <section aria-label="Journal d'activité" className="mt-6">
      <div className="flex items-center justify-between mb-3">
        <MonoLabel className="text-muted-foreground">Journal d&apos;activité</MonoLabel>
        <span className="mono-label text-muted-foreground tabular-nums" role="status">
          {loading && events.length === 0
            ? "Chargement…"
            : `${events.length} événement${events.length > 1 ? "s" : ""}`}
        </span>
      </div>
      {loading && events.length === 0 ? (
        <ActivityLogSkeleton />
      ) : (
      <div className="rounded-md border border-border/60 bg-card/40 divide-y divide-border/40 max-h-96 overflow-y-auto scroll-slim">
        {!loading && events.length === 0 && (
          <div className="p-5 text-center">
            <p className="text-sm text-foreground font-medium">Aucun événement pour l’instant.</p>
            <p className="mt-1 text-xs text-muted-foreground">
              Les inscriptions et actions apparaîtront ici.
            </p>
            <button
              type="button"
              onClick={() => {
                setLoading(true);
                void load(expanded).finally(() => setLoading(false));
              }}
              className="mt-3 inline-flex items-center min-h-[44px] px-4 rounded-md border border-border bg-card text-sm text-foreground hover:border-lime/60 hover:text-lime transition-colors focus-lime"
            >
              Actualiser
            </button>
          </div>
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
                <div className="flex items-baseline gap-2 flex-wrap">
                  <span
                    className={cn("text-sm font-medium", EVENT_TONES[meta.tone])}
                  >
                    {meta.label}
                  </span>
                  {isAdminAction && (
                    <span className="mono-label text-amber-200">ADMIN</span>
                  )}
                </div>
                {ev.ref && (
                  <div className="text-xs text-muted-foreground font-mono truncate mt-0.5">
                    {ev.ref}
                  </div>
                )}
              </div>
              <span className="shrink-0 mono-label text-muted-foreground tabular-nums admin-num">
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
      {events.length > 0 && (
        <button
          type="button"
          onClick={() => setExpanded((e) => !e)}
          aria-expanded={expanded}
          className="mt-2 min-h-[44px] px-2 -ml-2 text-xs text-muted-foreground hover:text-lime transition-colors focus-lime mono-label"
        >
          {expanded ? "Voir moins" : "Voir plus (50)"}
        </button>
      )}
    </section>
  );
}
