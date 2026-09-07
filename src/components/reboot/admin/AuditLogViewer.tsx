"use client";

import * as React from "react";
import { MonoLabel } from "../shared";
import { cn } from "@/lib/utils";
import { fetchJson, isAbortError } from "./lib/fetchJson";
import { Download, Search, Filter, AlertCircle } from "lucide-react";

interface AuditEntry {
  id: string;
  createdAt: string;
  actor: string | null;
  action: string;
  entityType: string;
  entityId: string | null;
  metadata: string | null;
}

const ACTION_COLORS: Record<string, string> = {
  "admin.login": "text-lime",
  "admin.key-rotate": "text-amber-400",
  "admin.key-revoke": "text-destructive",
  "member.approve": "text-lime",
  "member.reject": "text-destructive",
  "member.delete": "text-destructive",
  "member.update": "text-sky-400",
  "member.invite": "text-sky-400",
  "member.waitlist": "text-amber-400",
};

function getActionColor(action: string): string {
  for (const [prefix, color] of Object.entries(ACTION_COLORS)) {
    if (action.startsWith(prefix)) return color;
  }
  return "text-muted-foreground";
}

export function AuditLogViewer({
  onSessionExpired,
}: {
  onSessionExpired: () => void;
}) {
  const [logs, setLogs] = React.useState<AuditEntry[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [filter, setFilter] = React.useState("");
  const [expandedId, setExpandedId] = React.useState<string | null>(null);

  const loadLogs = React.useCallback(async (signal?: AbortSignal) => {
    setLoading(true);
    setError(null);
    try {
      const { res, data, code } = await fetchJson("/api/admin/audit-log?limit=500", {
        cache: "no-store",
        signal,
      });
      if (res.status === 401 || code === "UNAUTHORIZED") {
        onSessionExpired();
        return;
      }
      if (!res.ok) {
        throw new Error("Erreur de chargement des logs.");
      }
      setLogs((data?.logs ?? []) as AuditEntry[]);
    } catch (e) {
      if (isAbortError(e)) return;
      setError(e instanceof Error ? e.message : "Erreur de chargement.");
    } finally {
      setLoading(false);
    }
  }, [onSessionExpired]);

  React.useEffect(() => {
    const ctrl = new AbortController();
    void loadLogs(ctrl.signal);
    return () => ctrl.abort();
  }, [loadLogs]);

  const filtered = React.useMemo(() => {
    if (!filter.trim()) return logs;
    const q = filter.toLowerCase();
    return logs.filter(
      (l) =>
        l.action.toLowerCase().includes(q) ||
        l.entityType.toLowerCase().includes(q) ||
        (l.actor ?? "").toLowerCase().includes(q) ||
        (l.entityId ?? "").toLowerCase().includes(q),
    );
  }, [logs, filter]);

  async function handleExportCsv() {
    try {
      const res = await fetch("/api/admin/audit-log?format=csv&limit=10000", { cache: "no-store" });
      if (!res.ok) throw new Error("Échec de l'export.");
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `audit-log-${Date.now()}.csv`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch {
      setError("Échec de l'export CSV.");
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <MonoLabel className="text-muted-foreground">Journal d&apos;audit</MonoLabel>
          <p className="mt-1 text-xs text-muted-foreground">
            {filtered.length} entrée{filtered.length !== 1 ? "s" : ""} sur {logs.length}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => void loadLogs()}
            disabled={loading}
            className="inline-flex items-center gap-2 rounded-md border border-border bg-card px-3 py-2 text-sm text-foreground hover:border-lime/60 hover:text-lime transition-colors focus-lime min-h-[40px]"
          >
            Actualiser
          </button>
          <button
            type="button"
            onClick={() => void handleExportCsv()}
            disabled={logs.length === 0}
            className="inline-flex items-center gap-2 rounded-md border border-border bg-card px-3 py-2 text-sm text-foreground hover:border-lime/60 hover:text-lime transition-colors focus-lime min-h-[40px] disabled:opacity-50"
          >
            <Download className="size-4" />
            CSV
          </button>
        </div>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" aria-hidden />
        <input
          type="text"
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          placeholder="Filtrer par action, entité, acteur…"
          aria-label="Filtrer les logs d'audit"
          className="w-full h-10 rounded-md border bg-card pl-9 pr-4 text-sm text-foreground placeholder:text-muted-foreground transition-colors focus-lime border-border focus:border-lime"
        />
      </div>

      {error && (
        <div className="rounded-md border border-destructive/40 bg-destructive/5 px-3 py-2.5 text-sm text-foreground flex items-center gap-2" role="alert">
          <AlertCircle className="size-4 text-destructive shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {loading && logs.length === 0 ? (
        <div className="rounded-md border border-border/60 bg-card/40 p-5 text-center">
          <p className="text-sm text-muted-foreground">Chargement…</p>
        </div>
      ) : (
        <div className="rounded-md border border-border/60 bg-card/40 divide-y divide-border/40 max-h-[600px] overflow-y-auto scroll-slim">
          {filtered.length === 0 && (
            <div className="p-5 text-center">
              <p className="text-sm text-foreground font-medium">
                {logs.length === 0 ? "Aucun log d'audit." : "Aucun résultat pour ce filtre."}
              </p>
              {logs.length === 0 && (
                <p className="mt-1 text-xs text-muted-foreground">
                  Les actions admin apparaîtront ici.
                </p>
              )}
            </div>
          )}
          {filtered.map((entry) => {
            const isExpanded = expandedId === entry.id;
            const metaColor = getActionColor(entry.action);
            let parsedMeta: Record<string, unknown> | null = null;
            try {
              parsedMeta = entry.metadata ? JSON.parse(entry.metadata) : null;
            } catch {
              /* ignore */
            }

            return (
              <div
                key={entry.id}
                className="hover:bg-elevated/30 transition-colors"
              >
                <button
                  type="button"
                  onClick={() => setExpandedId(isExpanded ? null : entry.id)}
                  aria-expanded={isExpanded}
                  className="w-full flex items-center gap-3 p-3 text-left focus-lime"
                >
                  <span
                    className={cn(
                      "shrink-0 size-1.5 rounded-full",
                      metaColor === "text-lime" && "bg-lime",
                      metaColor === "text-destructive" && "bg-destructive",
                      metaColor === "text-amber-400" && "bg-amber-400",
                      metaColor === "text-sky-400" && "bg-sky-400",
                      metaColor === "text-muted-foreground" && "bg-muted-foreground/50",
                    )}
                    aria-hidden
                  />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-baseline gap-2 flex-wrap">
                      <span className={cn("text-sm font-medium", metaColor)}>
                        {entry.action}
                      </span>
                      <span className="mono-label text-xs text-muted-foreground">
                        {entry.entityType}
                      </span>
                      {entry.entityId && (
                        <span className="mono-label text-xs text-muted-foreground truncate max-w-[120px]">
                          {entry.entityId}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    {entry.actor && (
                      <span className="mono-label text-xs text-muted-foreground hidden sm:inline">
                        {entry.actor}
                      </span>
                    )}
                    <span className="mono-label text-xs text-muted-foreground tabular-nums admin-num">
                      {new Date(entry.createdAt).toLocaleString("fr-FR", {
                        day: "2-digit",
                        month: "short",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </span>
                  </div>
                </button>
                {isExpanded && (
                  <div className="px-3 pb-3 pt-0 ml-4">
                    <div className="rounded-md bg-elevated/50 border border-border/40 p-3 text-xs font-mono space-y-1.5">
                      <div>
                        <span className="text-muted-foreground">ID: </span>
                        <span className="text-foreground">{entry.id}</span>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Acteur: </span>
                        <span className="text-foreground">{entry.actor ?? "—"}</span>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Entité: </span>
                        <span className="text-foreground">{entry.entityType}</span>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Entity ID: </span>
                        <span className="text-foreground">{entry.entityId ?? "—"}</span>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Date: </span>
                        <span className="text-foreground">
                          {new Date(entry.createdAt).toLocaleString("fr-FR")}
                        </span>
                      </div>
                      {parsedMeta && (
                        <div>
                          <span className="text-muted-foreground">Métadonnées: </span>
                          <pre className="text-foreground whitespace-pre-wrap break-all mt-1">
                            {JSON.stringify(parsedMeta, null, 2)}
                          </pre>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
