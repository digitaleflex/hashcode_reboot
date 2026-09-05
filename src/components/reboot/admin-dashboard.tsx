"use client";

import * as React from "react";
import { Logo } from "@/components/brand/logo";
import { RebootButton, MonoLabel } from "./shared";
import { cn } from "@/lib/utils";
import { Download, RefreshCw, ArrowLeft, LogOut, FileJson, AlertCircle } from "lucide-react";
import { fetchJson, isAbortError, withRetryAfter } from "./admin/lib/fetchJson";
import { useMembers } from "./admin/hooks/useMembers";
import { AdminSidebar } from "./admin/AdminSidebar";
import { AdminStats, type Stats, type FunnelData } from "./admin/AdminStats";
import { MemberTable } from "./admin/MemberTable";
import { MemberDetailDialog } from "./admin/MemberDetailDialog";
import { ActivityLog } from "./admin/ActivityLog";
import { ImportCsvDialog } from "./admin/ImportCsvDialog";
import { ChangePasscodeDialog } from "./admin/ChangePasscodeDialog";
import { PendingApprovalsBanner } from "./admin/PendingApprovalsBanner";
import {
  AdminStatsSkeleton,
  MemberTableSkeleton,
  ActivityLogSkeleton,
} from "./admin/skeletons";
import { useQueryClient } from "@tanstack/react-query";
import {
  useAdminKeyboardShortcuts,
  ShortcutHelp,
  type ShortcutMap,
} from "./admin/hooks/useKeyboardShortcuts";

// Réexports mécaniques (Phase 3 split + Phase 1A sidebar, sans changement comportemental).
export { PendingApprovalsBanner } from "./admin/PendingApprovalsBanner";
export { AdminStats } from "./admin/AdminStats";
export { MemberTable } from "./admin/MemberTable";
export { MemberDetailDialog } from "./admin/MemberDetailDialog";
export { ActivityLog } from "./admin/ActivityLog";
export { AdminSidebar } from "./admin/AdminSidebar";
export { useMembers } from "./admin/hooks/useMembers";
export { fetchJson, isAbortError, withRetryAfter } from "./admin/lib/fetchJson";
export { ImportCsvDialog } from "./admin/ImportCsvDialog";
export { ChangePasscodeDialog } from "./admin/ChangePasscodeDialog";

// ── Helpers ────────────────────────────────────────────────────────────────
function readInitialSelectedId(): string | null {
  if (typeof window === "undefined") return null;
  try {
    const sp = new URLSearchParams(window.location.search);
    return sp.get("selectedId") ?? sp.get("member");
  } catch {
    return null;
  }
}

// ── Props ──────────────────────────────────────────────────────────────────
interface DashboardProps {
  onExit: () => void;
  onSessionExpired?: () => void;
}

// ── Main Component ─────────────────────────────────────────────────────────
export function AdminDashboard({ onExit, onSessionExpired }: DashboardProps) {
  const handleSessionExpired = React.useCallback(() => {
    if (onSessionExpired) onSessionExpired();
    else onExit();
  }, [onExit, onSessionExpired]);

  // ── Members (hook) ───────────────────────────────────────────────────────
  const membersApi = useMembers({ onSessionExpired: handleSessionExpired });
  const {
    members,
    total,
    page,
    pageSize,
    setPage,
    filters,
    setFilters,
    setFilter,
    searchQuery,
    setSearchQuery,
    debouncedSearchQuery,
    sortKey,
    sortDir,
    toggleSort,
    selectedIds,
    setSelectedIds,
    toggleSelect,
    toggleSelectAll,
    recentMembers,
    loading: membersLoading,
    loadError: membersError,
    setLoadError: setMembersError,
    refreshMembers,
    serverSorted,
  } = membersApi;

  // ── Stats / funnel ───────────────────────────────────────────────────────
  const [stats, setStats] = React.useState<Stats | null>(null);
  const [funnel, setFunnel] = React.useState<FunnelData | null>(null);
  const [statsLoading, setStatsLoading] = React.useState(true);
  const [statsError, setStatsError] = React.useState<string | null>(null);

  // ── UI state ─────────────────────────────────────────────────────────────
  const [selectedId, setSelectedId] = React.useState<string | null>(() =>
    readInitialSelectedId(),
  );
  const [bulkAction, setBulkAction] = React.useState<string | null>(null);
  const [bulkResult, setBulkResult] = React.useState<string | null>(null);
  const [confirmBulkDelete, setConfirmBulkDelete] = React.useState(false);
  const [exporting, setExporting] = React.useState<"csv" | "json" | null>(null);
  const [exportError, setExportError] = React.useState<string | null>(null);
  const [activeSection, setActiveSection] = React.useState("section-stats");

  // Keyboard shortcuts
  const shortcuts = React.useMemo<ShortcutMap>(
    () => ({
      r: {
        handler: () => {
          void refresh();
        },
        description: "rafraîchir",
      },
      e: {
        handler: () => {
          const input = document.querySelector<HTMLInputElement>(
            'input[placeholder*="Recherche"]',
          );
          input?.focus();
        },
        description: "recherche",
      },
      // Key is lowercase "escape" because the hook lowercases e.key before lookup.
      escape: {
        handler: () => setSelectedId(null),
        description: "fermer",
      },
    }),
    [refresh, setSelectedId],
  );

  useAdminKeyboardShortcuts(shortcuts);

  const loading = membersLoading || statsLoading;
  const loadError = membersError ?? statsError;

  // ── Refs for sidebar sections ────────────────────────────────────────────
  const statsRef = React.useRef<HTMLDivElement>(null);
  const membersRef = React.useRef<HTMLDivElement>(null);
  const activityRef = React.useRef<HTMLDivElement>(null);
  const exportsRef = React.useRef<HTMLDivElement>(null);

  // ── IntersectionObserver — update activeSection on scroll ─────────────────
  React.useEffect(() => {
    if (typeof window === "undefined") return;
    const sectionRefs = [
      { id: "section-stats", ref: statsRef },
      { id: "section-members", ref: membersRef },
      { id: "section-activity", ref: activityRef },
      { id: "section-exports", ref: exportsRef },
    ];

    const observers: IntersectionObserver[] = [];

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            const id = (entry.target as HTMLElement).dataset.section ?? "section-stats";
            setActiveSection(id);
          }
        }
      },
      { threshold: 0.3, rootMargin: "-80px 0px -40% 0px" },
    );

    for (const { id, ref } of sectionRefs) {
      if (ref.current) {
        ref.current.dataset.section = id;
        observer.observe(ref.current);
        observers.push(observer);
      }
    }

    return () => {
      for (const obs of observers) obs.disconnect();
    };
  }, []);

  // ── URL persistence for selectedId (no useSearchParams / Suspense) ──────────
  React.useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const sp = new URLSearchParams(window.location.search);
      if (selectedId) sp.set("selectedId", selectedId);
      else {
        sp.delete("selectedId");
        sp.delete("member");
      }
      const qs = sp.toString();
      window.history.replaceState(
        null,
        "",
        `${window.location.pathname}${qs ? `?${qs}` : ""}`,
      );
    } catch {
      /* ignore */
    }
  }, [selectedId]);

  // ── Load stats ────────────────────────────────────────────────────────────
  const loadStats = React.useCallback(
    async (signal?: AbortSignal) => {
      const { res, data, error, code, retryAfterSec } = await fetchJson(
        "/api/stats",
        { cache: "no-store", signal },
      );
      if (signal?.aborted) return;
      if (res.status === 401 || code === "UNAUTHORIZED") {
        handleSessionExpired();
        throw new Error("unauthorized");
      }
      if (!res.ok) {
        const msg = error ?? "Erreur de chargement des stats.";
        throw new Error(
          res.status === 429 || code === "RATE_LIMITED"
            ? withRetryAfter(msg, retryAfterSec)
            : msg,
        );
      }
      setStats(data);
    },
    [handleSessionExpired],
  );

  // ── Load funnel (optional) ────────────────────────────────────────────────
  const loadFunnel = React.useCallback(
    async (signal?: AbortSignal) => {
      try {
        const { res, data, code } = await fetchJson("/api/analytics", {
          cache: "no-store",
          signal,
        });
        if (signal?.aborted) return;
        if (res.status === 401 || code === "UNAUTHORIZED") {
          handleSessionExpired();
          throw new Error("unauthorized");
        }
        if (!res.ok) throw new Error("funnel");
        setFunnel(data);
      } catch (e) {
        if (isAbortError(e)) return;
        /* analytics optional */
      }
    },
    [handleSessionExpired],
  );

  // ── Mount: load stats + funnel once ───────────────────────────────────────
  React.useEffect(() => {
    const ctrl = new AbortController();
    let mounted = true;
    (async () => {
      setStatsLoading(true);
      setStatsError(null);
      try {
        await Promise.all([loadStats(ctrl.signal), loadFunnel(ctrl.signal)]);
      } catch (e) {
        if (isAbortError(e)) return;
        if (e instanceof Error && e.message === "unauthorized") return;
        if (mounted)
          setStatsError(
            "Erreur de chargement des données. Vérifie ta connexion puis rafraîchis.",
          );
      } finally {
        if (mounted) setStatsLoading(false);
      }
    })();
    return () => {
      mounted = false;
      ctrl.abort();
    };
  }, [loadStats, loadFunnel]);

  // ── Refresh ───────────────────────────────────────────────────────────────
  async function refresh() {
    setStatsLoading(true);
    setStatsError(null);
    setMembersError(null);
    const ctrl = new AbortController();
    try {
      await Promise.all([
        loadStats(ctrl.signal),
        refreshMembers(),
        loadFunnel(ctrl.signal),
      ]);
    } catch (e) {
      if (isAbortError(e)) return;
      if (e instanceof Error && e.message === "unauthorized") return;
      const msg =
        e instanceof Error
          ? e.message
          : "Erreur de chargement des données. Vérifie ta connexion puis rafraîchis.";
      setStatsError(msg);
    } finally {
      setStatsLoading(false);
    }
  }

  // ── Logout ────────────────────────────────────────────────────────────────
  const queryClient = useQueryClient();
  async function logout() {
    try {
      await fetch("/api/admin/logout", { method: "POST" });
    } catch {
      /* ignore */
    }
    queryClient.clear();
    onExit();
  }

  // ── Bulk action ───────────────────────────────────────────────────────────
  async function runBulk(
    action: "approve" | "invite" | "waitlist" | "reject" | "delete",
  ) {
    if (selectedIds.size === 0) return;
    if (action === "delete" && !confirmBulkDelete) {
      setConfirmBulkDelete(true);
      return;
    }
    setBulkAction(action);
    setBulkResult(null);
    try {
      const { res, data, error, code, retryAfterSec } = await fetchJson(
        "/api/members/bulk",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ids: Array.from(selectedIds), action }),
        },
      );
      if (res.status === 401 || code === "UNAUTHORIZED") {
        handleSessionExpired();
        return;
      }
      if (!res.ok || !data?.ok) {
        const base = error ?? "Échec de l'action bulk.";
        setBulkResult(
          `Erreur: ${res.status === 429 || code === "RATE_LIMITED" ? withRetryAfter(base, retryAfterSec) : base}`,
        );
        return;
      }
      const affected = (data.affected as number) ?? 0;
      const partial = (data.partial as boolean) ?? false;
      const missing = (data.missing as number) ?? 0;
      setBulkResult(
        partial
          ? `${affected} membre(s) — action "${action}" partielle (${missing} introuvable(s)).`
          : `${affected} membre(s) — action "${action}" appliquée`,
      );
      setConfirmBulkDelete(false);
      await refresh();
    } catch (e) {
      if (isAbortError(e)) return;
      setBulkResult("Échec de l'action bulk.");
    } finally {
      setBulkAction(null);
    }
  }

  // ── Delete member ──────────────────────────────────────────────────────────
  async function deleteMember(id: string) {
    try {
      const { res, error, code, retryAfterSec } = await fetchJson(
        `/api/members/${id}`,
        { method: "DELETE" },
      );
      if (res.status === 401 || code === "UNAUTHORIZED") {
        handleSessionExpired();
        return;
      }
      if (!res.ok) {
        const base = error ?? "Échec de la suppression.";
        setMembersError(
          res.status === 429 || code === "RATE_LIMITED"
            ? withRetryAfter(base, retryAfterSec)
            : base,
        );
        return;
      }
      setSelectedId(null);
      await refresh();
    } catch (e) {
      if (isAbortError(e)) return;
      setMembersError("Échec de la suppression.");
    }
  }

  // ── Export ───────────────────────────────────────────────────────────────
  async function handleExport(kind: "csv" | "json") {
    if (exporting) return;
    setExporting(kind);
    setExportError(null);
    try {
      const q = debouncedSearchQuery.trim() || searchQuery.trim();
      const params = new URLSearchParams({
        ...filters,
        ...(q ? { q } : {}),
      }).toString();
      const url =
        kind === "csv"
          ? `/api/export?${params}`
          : `/api/export/json?${params}`;
      const res = await fetch(url, { cache: "no-store" });
      if (res.status === 401) {
        let code: string | undefined;
        try {
          const j = (await res.clone().json()) as { code?: string };
          code = j.code;
        } catch {
          code = undefined;
        }
        if (code === "UNAUTHORIZED" || res.status === 401) handleSessionExpired();
        setExportError(
          code === "UNAUTHORIZED"
            ? "Session expirée. Reconnecte-toi."
            : "Non autorisé.",
        );
        return;
      }
      if (res.status === 429) {
        const retry = res.headers.get("Retry-After");
        const sec =
          retry !== null && Number.isFinite(Number(retry)) ? Number(retry) : null;
        let base = "Trop de requêtes.";
        try {
          const j = (await res.clone().json()) as { error?: string };
          if (j.error) base = j.error;
        } catch {
          /* ignore */
        }
        setExportError(withRetryAfter(base, sec));
        return;
      }
      if (!res.ok) {
        let base = "Échec de l'export.";
        try {
          const j = (await res.clone().json()) as { error?: string };
          if (j.error) base = j.error;
        } catch {
          /* ignore */
        }
        setExportError(base);
        return;
      }
      const truncated = res.headers.get("X-Export-Truncated") === "1";
      const totalHdr = res.headers.get("X-Export-Total");
      const blob = await res.blob();
      const objectUrl = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = objectUrl;
      a.download =
        kind === "csv"
          ? `hashcode-reboot-members-${Date.now()}.csv`
          : `hashcode-reboot-members-${Date.now()}.json`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(objectUrl), 1000);
      if (truncated) {
        setExportError(
          `Export tronqué à 2000 lignes${totalHdr ? ` sur ${totalHdr}` : ""}. Affine les filtres.`,
        );
      }
    } catch (e) {
      if (isAbortError(e)) return;
      setExportError("Échec de l'export. Vérifie ta connexion.");
    } finally {
      setExporting(null);
    }
  }

  // ── Sidebar navigation ────────────────────────────────────────────────────
  function navigateToSection(sectionId: string) {
    setActiveSection(sectionId);
    if (typeof document !== "undefined") {
      const el = document.getElementById(sectionId);
      if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }

  // ── Render ───────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen flex flex-col bg-background">
      {/* Top bar */}
      <header className="sticky top-0 z-40 bg-background/90 backdrop-blur-sm border-b border-border/60">
        <div className="mx-auto max-w-7xl px-5 sm:px-8 h-14 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Logo variant="compact" size="sm" />
            <span className="hidden sm:inline text-border">/</span>
            <MonoLabel className="text-lime hidden sm:inline">Admin</MonoLabel>
            <span className="hidden md:inline-flex items-center gap-1.5 ml-2 px-2 py-0.5 rounded-sm border border-lime/40 bg-lime/5">
              <span className="size-1.5 rounded-full bg-lime animate-hash-pulse" />
              <span className="mono-label text-lime">Session active</span>
            </span>
          </div>
          <div className="flex items-center gap-2">
            <ShortcutHelp shortcuts={shortcuts} />
            <RebootButton
              size="sm"
              variant="outline"
              onClick={() => {
                void refresh();
              }}
              disabled={loading}
            >
              <RefreshCw className={cn("size-4", loading && "animate-spin")} />
              <span className="hidden sm:inline">Rafraîchir</span>
            </RebootButton>
            <span
              title={
                Object.keys(filters).length || searchQuery
                  ? "Exporter la vue filtrée"
                  : "Exporter tous les membres"
              }
            >
              <RebootButton
                size="sm"
                variant="outline"
                onClick={() => {
                  void handleExport("csv");
                }}
                disabled={exporting !== null}
              >
                <Download className="size-4" />
                <span className="hidden sm:inline">
                  {exporting === "csv"
                    ? "Export…"
                    : `CSV${Object.keys(filters).length || searchQuery ? " (filtré)" : ""}`}
                </span>
              </RebootButton>
            </span>
            <ChangePasscodeDialog
              onSessionExpired={handleSessionExpired}
              onChanged={() => { void refresh(); }}
            />
            <span className="hidden md:inline-block" title="Exporter en JSON">
              <RebootButton
                size="sm"
                variant="outline"
                onClick={() => {
                  void handleExport("json");
                }}
                disabled={exporting !== null}
              >
                <FileJson className="size-4" />
                <span className="hidden lg:inline">
                  {exporting === "json" ? "Export…" : "JSON"}
                </span>
              </RebootButton>
            </span>
            <span title="Se déconnecter">
              <RebootButton
                size="sm"
                variant="ghost"
                onClick={() => {
                  void logout();
                }}
              >
                <LogOut className="size-4" />
                <span className="hidden sm:inline">Déconnexion</span>
              </RebootButton>
            </span>
            <RebootButton size="sm" variant="ghost" onClick={onExit}>
              <ArrowLeft className="size-4" />
              <span className="hidden sm:inline">Site</span>
            </RebootButton>
          </div>
        </div>
      </header>

      {/* Body: sidebar + scrollable sections */}
      <div className="flex flex-1 min-h-0">
        {/* ── Sidebar ─────────────────────────────────────────────────── */}
        <AdminSidebar
          activeSection={activeSection}
          onNavigate={navigateToSection}
        />

        {/* ── Scrollable sections ────────────────────────────────────── */}
        <div className="flex-1 min-w-0">
          <main className="mx-auto max-w-7xl w-full px-5 sm:px-8 py-8 space-y-8">
            {/* Error banners */}
            {loadError && (
              <div className="mb-6 rounded-md border border-destructive/40 bg-destructive/5 p-4 flex items-center justify-between gap-4 animate-hash-in">
                <div className="flex items-center gap-3">
                  <AlertCircle className="size-5 text-destructive shrink-0" />
                  <p className="text-sm text-foreground">{loadError}</p>
                </div>
                <button
                  onClick={() => {
                    void refresh();
                  }}
                  className="text-xs px-3 py-1.5 rounded-md border border-border bg-card text-foreground hover:border-lime/60 hover:text-lime transition-colors focus-lime whitespace-nowrap"
                >
                  Réessayer
                </button>
              </div>
            )}
            {exportError && (
              <div
                className="mb-6 rounded-md border border-destructive/40 bg-destructive/5 p-4 flex items-center justify-between gap-4 animate-hash-in"
                role="alert"
              >
                <div className="flex items-center gap-3">
                  <AlertCircle className="size-5 text-destructive shrink-0" />
                  <p className="text-sm text-foreground">{exportError}</p>
                </div>
                <button
                  onClick={() => setExportError(null)}
                  className="text-xs px-3 py-1.5 rounded-md border border-border bg-card text-foreground hover:border-lime/60 hover:text-lime transition-colors focus-lime whitespace-nowrap"
                >
                  Fermer
                </button>
              </div>
            )}

            {/* ── Pending approvals banner ──────────────────────────────── */}
            {stats && (
              <PendingApprovalsBanner pendingCount={stats.pendingCount ?? 0} />
            )}

            {/* ── Section: Stats ─────────────────────────────────────── */}
            <section
              id="section-stats"
              ref={statsRef}
              data-section="section-stats"
              aria-label="Vue d'ensemble"
              className="scroll-mt-20"
            >
              {statsLoading ? (
                <AdminStatsSkeleton />
              ) : (
                <AdminStats
                  stats={stats}
                  funnel={funnel}
                  onFilter={setFilter}
                  onClearFilters={() => setFilters({})}
                />
              )}
            </section>

            {/* ── Section: Members ────────────────────────────────────── */}
            <section
              id="section-members"
              ref={membersRef}
              data-section="section-members"
              aria-label="Membres"
              className="scroll-mt-20"
            >
              <MemberTable
                members={members}
                total={total}
                page={page}
                pageSize={pageSize}
                sortKey={sortKey}
                sortDir={sortDir}
                filters={filters}
                searchQuery={searchQuery}
                recentMembers={recentMembers}
                selectedIds={selectedIds}
                bulkAction={bulkAction}
                bulkResult={bulkResult}
                confirmBulkDelete={confirmBulkDelete}
                loading={loading}
                serverSorted={serverSorted}
                onToggleSort={toggleSort}
                onToggleSelect={toggleSelect}
                onToggleSelectAll={toggleSelectAll}
                onFilter={setFilter}
                onClearFilters={() => setFilters({})}
                onSearchChange={setSearchQuery}
                onSelectMember={setSelectedId}
                onBulk={(a) => {
                  void runBulk(a);
                }}
                onCancelSelection={() => {
                  setSelectedIds(new Set());
                  setConfirmBulkDelete(false);
                }}
                onDismissBulkResult={() => setBulkResult(null)}
                onConfirmBulkDeleteChange={setConfirmBulkDelete}
                onPageChange={setPage}
              />
            </section>

            {/* ── Section: Activity ───────────────────────────────────── */}
            <section
              id="section-activity"
              ref={activityRef}
              data-section="section-activity"
              aria-label="Activité"
              className="scroll-mt-20"
            >
              <ActivityLog />
            </section>

            {/* ── Section: Exports ───────────────────────────────────── */}
            <section
              id="section-exports"
              ref={exportsRef}
              data-section="section-exports"
              aria-label="Exports"
              className="scroll-mt-20"
            >
              <div className="rounded-md border border-border/60 bg-card/40 p-4 sm:p-5">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="min-w-0">
                    <MonoLabel className="text-muted-foreground">Exports & Import</MonoLabel>
                    <p className="mt-1 text-sm text-muted-foreground">
                      Exporte la vue filtrée ou tous les membres. CSV et JSON. Importe un CSV pour ajouter des membres.
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <ImportCsvDialog />
                    <RebootButton
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        void handleExport("csv");
                      }}
                      disabled={exporting !== null}
                    >
                      <Download className="size-4" aria-hidden="true" />
                      <span>{exporting === "csv" ? "Export…" : "CSV"}</span>
                    </RebootButton>
                    <RebootButton
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        void handleExport("json");
                      }}
                      disabled={exporting !== null}
                    >
                      <FileJson className="size-4" aria-hidden="true" />
                      <span>{exporting === "json" ? "Export…" : "JSON"}</span>
                    </RebootButton>
                  </div>
                </div>
              </div>
            </section>
          </main>

          {/* Footer */}
          <footer className="border-t border-border/60 py-4">
            <p className="text-center text-xs text-muted-foreground">
              HASHCODE REBOOT · Admin — accès réservé. Les exports contiennent des données membres.
            </p>
          </footer>
        </div>
      </div>

      {/* ── Detail Dialog ────────────────────────────────────────────────── */}
      <MemberDetailDialog
        id={selectedId}
        onClose={() => setSelectedId(null)}
        onChanged={() => {
          void refresh();
        }}
        onDelete={deleteMember}
        onSessionExpired={handleSessionExpired}
      />
    </div>
  );
}
