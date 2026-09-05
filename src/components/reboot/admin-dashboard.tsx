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
import { AdminStatsSkeleton } from "./admin/skeletons";
import { useQueryClient } from "@tanstack/react-query";
import {
  useAdminKeyboardShortcuts,
  ShortcutHelp,
  type ShortcutMap,
} from "./admin/hooks/useKeyboardShortcuts";

// Réexports mécaniques
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
    setPageSize,
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
  const [bulkProgress, setBulkProgress] = React.useState<{
    done: number;
    total: number;
  } | null>(null);
  const [confirmBulkDelete, setConfirmBulkDelete] = React.useState(false);
  const [exporting, setExporting] = React.useState<"csv" | "json" | null>(null);
  const [exportError, setExportError] = React.useState<string | null>(null);
  const [exportWarning, setExportWarning] = React.useState<string | null>(null);
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
  const isSearching =
    searchQuery !== debouncedSearchQuery || (membersLoading && !!searchQuery.trim());

  // Désarme la confirmation suppression dès que la sélection change (anti-clic réflexe).
  const selectedCount = selectedIds.size;
  React.useEffect(() => {
    setConfirmBulkDelete(false);
  }, [selectedCount]);

  // ── Refs for sidebar sections ────────────────────────────────────────────
  const statsRef = React.useRef<HTMLDivElement>(null);
  const membersRef = React.useRef<HTMLDivElement>(null);
  const activityRef = React.useRef<HTMLDivElement>(null);
  const exportsRef = React.useRef<HTMLDivElement>(null);

  // ── IntersectionObserver — scrollspy stabilisé avec hystérésis ───────────
  // Source unique de scroll : navigateToSection. L’observateur ne fait que lire.
  React.useEffect(() => {
    if (typeof window === "undefined") return;
    const sectionRefs = [
      { id: "section-stats", ref: statsRef },
      { id: "section-members", ref: membersRef },
      { id: "section-activity", ref: activityRef },
      { id: "section-exports", ref: exportsRef },
    ];

    // Mémorise le ratio par section pour éviter le sautillement entre callbacks.
    const ratios = new Map<string, number>();
    let ticking = false;
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          const id =
            (entry.target as HTMLElement).dataset.section ?? entry.target.id;
          ratios.set(id, entry.isIntersecting ? entry.intersectionRatio : 0);
        }
        if (ticking) return;
        ticking = true;
        requestAnimationFrame(() => {
          // Choisit la section la plus visible, avec seuil minimal (hystérésis).
          let bestId: string | null = null;
          let bestRatio = 0.05;
          for (const [id, ratio] of ratios) {
            if (ratio > bestRatio) {
              bestRatio = ratio;
              bestId = id;
            }
          }
          if (bestId) {
            setActiveSection((prev) => (prev === bestId ? prev : bestId));
          }
          ticking = false;
        });
      },
      { threshold: [0, 0.15, 0.3, 0.5], rootMargin: "-72px 0px -55% 0px" },
    );

    for (const { id, ref } of sectionRefs) {
      if (ref.current) {
        ref.current.dataset.section = id;
        observer.observe(ref.current);
      }
    }

    return () => observer.disconnect();
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

  // ── Refresh global (bouton header) ───────────────────────────────────────
  async function refresh() {
    setStatsLoading(true);
    setStatsError(null);
    setMembersError(null);
    setExportWarning(null);
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

  // ── Réessais locaux par bloc (erreurs non fusionnées) ─────────────────────
  async function retryStats() {
    setStatsLoading(true);
    setStatsError(null);
    const ctrl = new AbortController();
    try {
      await Promise.all([loadStats(ctrl.signal), loadFunnel(ctrl.signal)]);
    } catch (e) {
      if (isAbortError(e)) return;
      if (e instanceof Error && e.message === "unauthorized") return;
      setStatsError(
        e instanceof Error
          ? e.message
          : "Erreur de chargement des stats. Vérifie ta connexion puis réessaie.",
      );
    } finally {
      setStatsLoading(false);
    }
  }

  async function retryMembers() {
    // Les erreurs membres viennent de useMembers (TanStack) ; on relance ce bloc seul.
    try {
      await refreshMembers();
    } catch {
      /* l’erreur reste affichée par le bloc membres */
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

  // ── Bulk action (lots de 10, progression, messages métier) ─────────────────
  const BULK_LABEL: Record<string, string> = {
    approve: "validation",
    invite: "invitation",
    waitlist: "mise en waitlist",
    reject: "rejet",
    delete: "suppression",
  };

  async function runBulk(
    action: "approve" | "invite" | "waitlist" | "reject" | "delete",
  ) {
    if (selectedIds.size === 0) return;
    if (action === "delete" && !confirmBulkDelete) {
      setConfirmBulkDelete(true);
      return;
    }
    const ids = Array.from(selectedIds);
    const label = BULK_LABEL[action] ?? action;
    setBulkAction(action);
    setBulkResult(null);
    setBulkProgress(null);
    try {
      // Découpe front en lots de 10 (limite serveur) avec progression.
      const chunks: string[][] = [];
      for (let i = 0; i < ids.length; i += 10) chunks.push(ids.slice(i, i + 10));
      if (chunks.length > 1) setBulkProgress({ done: 0, total: chunks.length });

      let affectedTotal = 0;
      let missingTotal = 0;
      for (let i = 0; i < chunks.length; i++) {
        const { res, data, error, code, retryAfterSec } = await fetchJson(
          "/api/members/bulk",
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ ids: chunks[i], action }),
          },
        );
        if (res.status === 401 || code === "UNAUTHORIZED") {
          handleSessionExpired();
          return;
        }
        if (!res.ok || !data?.ok) {
          const base = error ?? "Échec de l’action groupée.";
          setBulkResult(
            `Erreur — ${res.status === 429 || code === "RATE_LIMITED" ? withRetryAfter(base, retryAfterSec) : base}`,
          );
          return;
        }
        affectedTotal += (data.affected as number) ?? 0;
        missingTotal += (data.missing as number) ?? 0;
        if (chunks.length > 1) setBulkProgress({ done: i + 1, total: chunks.length });
      }

      if (action === "delete") {
        setBulkResult(
          missingTotal > 0
            ? `${affectedTotal} membre${affectedTotal > 1 ? "s" : ""} supprimé${affectedTotal > 1 ? "s" : ""} (${missingTotal} introuvable${missingTotal > 1 ? "s" : ""}).`
            : `${affectedTotal} membre${affectedTotal > 1 ? "s" : ""} supprimé${affectedTotal > 1 ? "s" : ""}.`,
        );
      } else if (missingTotal > 0) {
        setBulkResult(
          `${affectedTotal} membre${affectedTotal > 1 ? "s" : ""} traité${affectedTotal > 1 ? "s" : ""} — ${label} partielle (${missingTotal} introuvable${missingTotal > 1 ? "s" : ""}).`,
        );
      } else {
        const successMsg =
          action === "approve"
            ? `${affectedTotal} membre${affectedTotal > 1 ? "s" : ""} validé${affectedTotal > 1 ? "s" : ""} et invité${affectedTotal > 1 ? "s" : ""}.`
            : action === "invite"
              ? `${affectedTotal} invitation${affectedTotal > 1 ? "s" : ""} envoyée${affectedTotal > 1 ? "s" : ""}.`
              : action === "waitlist"
                ? `${affectedTotal} membre${affectedTotal > 1 ? "s" : ""} placé${affectedTotal > 1 ? "s" : ""} en waitlist.`
                : `${affectedTotal} membre${affectedTotal > 1 ? "s" : ""} rejeté${affectedTotal > 1 ? "s" : ""}.`;
        setBulkResult(successMsg);
      }
      // Vide la sélection après succès pour éviter les rejouements.
      setSelectedIds(new Set());
      setConfirmBulkDelete(false);
      await refresh();
    } catch (e) {
      if (isAbortError(e)) return;
      setBulkResult("Échec de l’action groupée. Vérifie ta connexion puis réessaie.");
    } finally {
      setBulkAction(null);
      setBulkProgress(null);
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

  // ── Export (avertissement avant si total > 2000) ──────────────────────────
  async function handleExport(kind: "csv" | "json") {
    if (exporting) return;
    setExporting(kind);
    setExportError(null);
    setExportWarning(null);
    // Avertissement pré-export via le total déjà connu (liste filtrée).
    if (total > 2000) {
      setExportWarning(
        `Vue actuelle : ${total} membres. L’export sera limité aux 2000 premiers. Affine les filtres pour un export complet.`,
      );
    }
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
            ? "Session expirée. Reconnecte-toi — tes filtres sont conservés dans l’adresse."
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
        setExportWarning(
          `Export limité à 2000 lignes${totalHdr ? ` sur ${totalHdr}` : ""}. Le fichier contient les 2000 premiers — affine les filtres pour le reste.`,
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
  const isFiltered = Object.keys(filters).length > 0 || !!searchQuery.trim();
  return (
    <div className="min-h-screen flex flex-col bg-background">
      {/* Top bar */}
      <header className="sticky top-0 z-40 bg-background/90 backdrop-blur-sm border-b border-border/60">
        <div className="mx-auto max-w-7xl px-5 sm:px-8 h-14 flex items-center justify-between gap-2">
          <div className="flex items-center gap-3 min-w-0">
            <Logo variant="compact" size="sm" />
            <span className="hidden sm:inline text-border" aria-hidden>
              /
            </span>
            <MonoLabel className="text-lime hidden sm:inline">Admin</MonoLabel>
            <span
              className="hidden md:inline-flex items-center gap-1.5 ml-2 px-2 py-1 rounded-sm border border-lime/40 bg-lime/5"
              title="Session valable 12h. Après expiration, reconnecte-toi — tes filtres restent dans l’adresse."
            >
              <span className="size-1.5 rounded-full bg-lime animate-hash-pulse" aria-hidden />
              <span className="mono-label text-lime">Session 12h</span>
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
              <RefreshCw className={cn("size-4", loading && "animate-spin")} aria-hidden />
              <span className="hidden sm:inline">Rafraîchir</span>
              <span className="sr-only sm:hidden">Rafraîchir</span>
            </RebootButton>
            <span
              title={
                isFiltered
                  ? `Exporter la vue filtrée (${total} membres${total > 2000 ? ", limité à 2000" : ""})`
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
                <Download className="size-4" aria-hidden />
                <span className="hidden sm:inline">
                  {exporting === "csv"
                    ? "Export…"
                    : `CSV${isFiltered ? " (filtré)" : ""}`}
                </span>
                <span className="sr-only sm:hidden">Exporter CSV</span>
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
                <FileJson className="size-4" aria-hidden />
                <span className="hidden lg:inline">
                  {exporting === "json" ? "Export…" : "JSON"}
                </span>
                <span className="sr-only lg:hidden">Exporter JSON</span>
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
                <LogOut className="size-4" aria-hidden />
                <span className="hidden sm:inline">Déconnexion</span>
                <span className="sr-only sm:hidden">Se déconnecter</span>
              </RebootButton>
            </span>
            <RebootButton size="sm" variant="ghost" onClick={onExit}>
              <ArrowLeft className="size-4" aria-hidden />
              <span className="hidden sm:inline">Site</span>
              <span className="sr-only sm:hidden">Retour au site</span>
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
            {/* Export : erreur (rouge) vs avertissement (ambre) distincts */}
            {exportError && (
              <div
                className="mb-6 rounded-md border border-destructive/40 bg-destructive/5 p-4 flex items-center justify-between gap-4 animate-hash-in"
                role="alert"
              >
                <div className="flex items-center gap-3">
                  <AlertCircle className="size-5 text-destructive shrink-0" aria-hidden />
                  <p className="text-sm text-foreground">{exportError}</p>
                </div>
                <button
                  type="button"
                  onClick={() => setExportError(null)}
                  className="min-h-[36px] text-xs px-3 py-1.5 rounded-md border border-border bg-card text-foreground hover:border-lime/60 hover:text-lime transition-colors focus-lime whitespace-nowrap"
                >
                  Fermer
                </button>
              </div>
            )}
            {exportWarning && (
              <div
                className="mb-6 rounded-md border border-amber-500/40 bg-amber-500/[0.07] p-4 flex flex-wrap items-center justify-between gap-3 animate-hash-in"
                role="status"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <AlertCircle className="size-5 text-amber-300 shrink-0" aria-hidden />
                  <p className="text-sm text-foreground">{exportWarning}</p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  {total > 2000 && (
                    <button
                      type="button"
                      onClick={() => navigateToSection("section-members")}
                      className="min-h-[36px] text-xs px-3 py-1.5 rounded-md border border-amber-500/50 bg-card text-foreground hover:border-amber-400 hover:text-amber-200 transition-colors focus-lime whitespace-nowrap"
                    >
                      Voir les filtres
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => setExportWarning(null)}
                    className="min-h-[36px] text-xs px-3 py-1.5 rounded-md border border-border bg-card text-foreground hover:border-amber-400 hover:text-amber-200 transition-colors focus-lime whitespace-nowrap"
                  >
                    Compris
                  </button>
                </div>
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
              {statsError && (
                <div
                  className="mb-4 rounded-md border border-destructive/40 bg-destructive/5 p-4 flex items-center justify-between gap-4"
                  role="alert"
                >
                  <p className="text-sm text-foreground">{statsError}</p>
                  <button
                    type="button"
                    onClick={() => {
                      void retryStats();
                    }}
                    className="min-h-[36px] text-xs px-3 py-1.5 rounded-md border border-border bg-card text-foreground hover:border-lime/60 hover:text-lime transition-colors focus-lime whitespace-nowrap"
                  >
                    Réessayer les stats
                  </button>
                </div>
              )}
              {statsLoading ? (
                <AdminStatsSkeleton />
              ) : (
                <AdminStats
                  stats={stats}
                  funnel={funnel}
                  filters={filters}
                  onFilter={setFilter}
                  onClearFilters={() => setFilters({})}
                  onSeeQueue={() => navigateToSection("section-members")}
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
              {membersError && (
                <div
                  className="mb-4 rounded-md border border-destructive/40 bg-destructive/5 p-4 flex items-center justify-between gap-4"
                  role="alert"
                >
                  <p className="text-sm text-foreground">{membersError}</p>
                  <button
                    type="button"
                    onClick={() => {
                      void retryMembers();
                    }}
                    className="min-h-[36px] text-xs px-3 py-1.5 rounded-md border border-border bg-card text-foreground hover:border-lime/60 hover:text-lime transition-colors focus-lime whitespace-nowrap"
                  >
                    Réessayer la liste
                  </button>
                </div>
              )}
              <MemberTable
                members={members}
                total={total}
                page={page}
                pageSize={pageSize}
                sortKey={sortKey}
                sortDir={sortDir}
                filters={filters}
                searchQuery={searchQuery}
                isSearching={isSearching}
                recentMembers={recentMembers}
                selectedIds={selectedIds}
                bulkAction={bulkAction}
                bulkResult={bulkResult}
                bulkProgress={bulkProgress}
                confirmBulkDelete={confirmBulkDelete}
                loading={membersLoading}
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
                onPageSizeChange={setPageSize}
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
                      {isFiltered
                        ? `Vue filtrée : ${total} membre${total > 1 ? "s" : ""}${total > 2000 ? " — export limité aux 2000 premiers" : ""}.`
                        : `Tous les membres : ${total} au total${total > 2000 ? " — export limité aux 2000 premiers" : ""}.`}
                      {" "}CSV et JSON. Import CSV pour ajouter des membres.
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
              HASHCODE REBOOT · Admin — accès réservé. Session 12h. Les exports contiennent des données membres.
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
