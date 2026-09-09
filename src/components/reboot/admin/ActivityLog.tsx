"use client";

import * as React from "react";
import { MonoLabel } from "../shared";
import { cn } from "@/lib/utils";
import { fetchJson, isAbortError } from "./lib/fetchJson";
import { useToast } from "@/hooks/use-toast";
import { ActivityLogSkeleton } from "./skeletons/ActivityLogSkeleton";
import { ChevronDown, Search } from "lucide-react";

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

interface ActivityMember {
  id: string;
  firstName: string;
  lastName: string | null;
  email: string;
  profileStatus: string;
  country: string;
  city: string | null;
}

interface FeedEvent {
  id: string;
  type: string;
  sessionId: string | null;
  memberId: string | null;
  member: ActivityMember | null;
  ref: string | null;
  value: number | null;
  createdAt: string;
}

export { ActivityLogSkeleton };

function shortId(id: string | null): string {
  if (!id) return "—";
  return id.length > 8 ? `${id.slice(0, 6)}…` : id;
}

function formatValue(v: number | null): string | null {
  if (v === null || v === undefined) return null;
  if (v >= 1000) return `${(v / 1000).toFixed(1)}s`;
  return `${v}ms`;
}

export function ActivityLog() {
  const [events, setEvents] = React.useState<FeedEvent[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [expanded, setExpanded] = React.useState(false);
  const [openId, setOpenId] = React.useState<string | null>(null);
  const [query, setQuery] = React.useState("");
  const { toast } = useToast();

const load = React.useCallback(async (showMore: boolean, signal?: AbortSignal) => {
  try {
    const { res, data, error, code, retryAfterSec } = await fetchJson(
      `/api/admin/activity?limit=${showMore ? 50 : 12}`,
      { cache: "no-store", signal },
    );
    if (signal?.aborted) return;
    if (res.ok) {
      setEvents((data?.events ?? []) as FeedEvent[]);
    } else {
      const msg = error ?? "Erreur de chargement de l'activité.";
      toast({
        variant: "destructive",
        title: "Erreur",
        description: msg,
      });
    }
  } catch (e) {
    if (isAbortError(e)) return;
    console.warn(e);
    toast({
      variant: "destructive",
      title: "Erreur",
      description: "Erreur réseau.",
    });
  }
}, [toast]);

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

  const filtered = React.useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return events;
    return events.filter((ev) => {
      const m = ev.member;
      return (
        ev.type.toLowerCase().includes(q) ||
        (ev.ref ?? "").toLowerCase().includes(q) ||
        (ev.sessionId ?? "").toLowerCase().includes(q) ||
        (m?.email ?? "").toLowerCase().includes(q) ||
        (m?.firstName ?? "").toLowerCase().includes(q)
      );
    });
  }, [events, query]);

  return (
    <section aria-label="Journal d'activité" className="mt-6">
      <div className="flex items-center justify-between mb-3 gap-3 flex-wrap">
        <MonoLabel className="text-muted-foreground">Journal d&apos;activité</MonoLabel>
        <span className="mono-label text-muted-foreground tabular-nums" role="status">
          {loading && events.length === 0
            ? "Chargement…"
            : `${filtered.length} événement${filtered.length > 1 ? "s" : ""}`}
        </span>
      </div>

      <div className="relative mb-3">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground/60" />
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Filtrer par email, prénom, session, type…"
          className="w-full rounded-md border border-border/60 bg-background pl-9 pr-3 py-2 text-sm placeholder:text-muted-foreground/60 focus:outline-none focus:border-lime/50"
        />
      </div>

      {loading && events.length === 0 ? (
        <ActivityLogSkeleton />
      ) : (
      <div className="rounded-md border border-border/60 bg-card/40 divide-y divide-border/40 max-h-[32rem] overflow-y-auto scroll-slim">
        {!loading && filtered.length === 0 && (
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
        {filtered.map((ev) => {
          const meta = EVENT_LABELS[ev.type] ?? {
            label: ev.type,
            tone: "muted" as const,
          };
          const isAdminAction = ev.ref?.startsWith("admin-");
          const isOpen = openId === ev.id;
          const val = formatValue(ev.value);
          return (
            <div key={ev.id} className="hover:bg-elevated/30 transition-colors">
              <button
                type="button"
                onClick={() => setOpenId(isOpen ? null : ev.id)}
                aria-expanded={isOpen}
                className="w-full flex items-center gap-3 p-3 text-left cursor-pointer"
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
                    {ev.member ? (
                      <span className="text-xs text-foreground/80 truncate">
                        {ev.member.firstName} · {ev.member.email}
                      </span>
                    ) : (
                      <span className="text-xs text-muted-foreground/60">Anonyme</span>
                    )}
                  </div>
                  <div className="flex items-center gap-2 mt-1 flex-wrap text-[11px] text-muted-foreground font-mono">
                    {ev.ref && <span className="truncate max-w-[180px]">{ev.ref}</span>}
                    <span title={ev.sessionId ?? ""}>sess:{shortId(ev.sessionId)}</span>
                    {val && (
                      <span className="rounded border border-border/60 px-1.5 py-0.5">{val}</span>
                    )}
                    {ev.member && (
                      <span className="rounded border border-lime/30 bg-lime/5 px-1.5 py-0.5 text-lime">
                        {ev.member.profileStatus}
                      </span>
                    )}
                  </div>
                </div>
                <span className="shrink-0 mono-label text-muted-foreground tabular-nums admin-num hidden sm:inline">
                  {new Date(ev.createdAt).toLocaleString("fr-FR", {
                    day: "2-digit",
                    month: "short",
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </span>
                <ChevronDown
                  className={cn("size-4 shrink-0 text-muted-foreground transition-transform", isOpen && "rotate-180")}
                />
              </button>

              {isOpen && (
                <div className="mx-3 mb-3 rounded-md border border-border/60 bg-background/60 p-3 text-xs space-y-2">
                  <p className="mono-label text-muted-foreground">Détail user & session</p>
                  <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-1.5">
                    <div className="flex justify-between gap-2">
                      <dt className="text-muted-foreground">Email</dt>
                      <dd className="font-medium truncate">
                        {ev.member ? (
                          <a href={`mailto:${ev.member.email}`} className="text-lime hover:underline">
                            {ev.member.email}
                          </a>
                        ) : (
                          "—"
                        )}
                      </dd>
                    </div>
                    <div className="flex justify-between gap-2">
                      <dt className="text-muted-foreground">Prénom / Nom</dt>
                      <dd className="font-medium truncate">
                        {ev.member ? `${ev.member.firstName} ${ev.member.lastName ?? ""}`.trim() : "—"}
                      </dd>
                    </div>
                    <div className="flex justify-between gap-2">
                      <dt className="text-muted-foreground">Statut</dt>
                      <dd className="font-medium">{ev.member?.profileStatus ?? "—"}</dd>
                    </div>
                    <div className="flex justify-between gap-2">
                      <dt className="text-muted-foreground">Localisation</dt>
                      <dd className="font-medium truncate">
                        {ev.member ? `${ev.member.city ?? ""} ${ev.member.country}`.trim() || "—" : "—"}
                      </dd>
                    </div>
                    <div className="flex justify-between gap-2">
                      <dt className="text-muted-foreground">Session</dt>
                      <dd className="font-mono truncate" title={ev.sessionId ?? ""}>{ev.sessionId ?? "—"}</dd>
                    </div>
                    <div className="flex justify-between gap-2">
                      <dt className="text-muted-foreground">Member ID</dt>
                      <dd className="font-mono truncate" title={ev.memberId ?? ""}>{ev.memberId ?? "—"}</dd>
                    </div>
                    <div className="flex justify-between gap-2">
                      <dt className="text-muted-foreground">Valeur</dt>
                      <dd className="font-mono">{ev.value ?? "—"}{val ? ` (${val})` : ""}</dd>
                    </div>
                    <div className="flex justify-between gap-2">
                      <dt className="text-muted-foreground">Ref complète</dt>
                      <dd className="font-mono truncate" title={ev.ref ?? ""}>{ev.ref ?? "—"}</dd>
                    </div>
                    <div className="flex justify-between gap-2">
                      <dt className="text-muted-foreground">Date complète</dt>
                      <dd className="font-mono">{new Date(ev.createdAt).toLocaleString("fr-FR")}</dd>
                    </div>
                    <div className="flex justify-between gap-2">
                      <dt className="text-muted-foreground">Event ID</dt>
                      <dd className="font-mono truncate" title={ev.id}>{shortId(ev.id)}</dd>
                    </div>
                  </dl>
                </div>
              )}
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
