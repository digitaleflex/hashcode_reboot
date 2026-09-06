"use client";

import * as React from "react";
import { AdminStats, type Stats, type FunnelData } from "@/components/reboot/admin/AdminStats";
import { AdminStatsSkeleton } from "@/components/reboot/admin/skeletons";
import { PendingApprovalsBanner } from "@/components/reboot/admin/PendingApprovalsBanner";
import { fetchJson, isAbortError, withRetryAfter } from "@/components/reboot/admin/lib/fetchJson";
import { AlertCircle } from "lucide-react";

export default function AdminStatsPage() {
  const [stats, setStats] = React.useState<Stats | null>(null);
  const [funnel, setFunnel] = React.useState<FunnelData | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  const loadData = React.useCallback(async (signal?: AbortSignal) => {
    setLoading(true);
    setError(null);
    try {
      const [statsResult, funnelResult] = await Promise.all([
        fetchJson("/api/stats", { cache: "no-store", signal }),
        fetchJson("/api/analytics", { cache: "no-store", signal }).catch(() => null),
      ]);

      if (signal?.aborted) return;

      if (statsResult.res.status === 401 || statsResult.code === "UNAUTHORIZED") {
        window.location.href = "/?admin=1";
        return;
      }

      if (!statsResult.res.ok) {
        const msg = statsResult.error ?? "Erreur de chargement des stats.";
        throw new Error(
          statsResult.res.status === 429 || statsResult.code === "RATE_LIMITED"
            ? withRetryAfter(msg, statsResult.retryAfterSec)
            : msg,
        );
      }

      setStats(statsResult.data);

      if (funnelResult?.res?.ok) {
        setFunnel(funnelResult.data);
      }
    } catch (e) {
      if (isAbortError(e)) return;
      if (e instanceof Error && e.message === "unauthorized") return;
      setError(
        e instanceof Error
          ? e.message
          : "Erreur de chargement des données. Vérifie ta connexion puis rafraîchis.",
      );
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    const ctrl = new AbortController();
    void loadData(ctrl.signal);
    return () => ctrl.abort();
  }, [loadData]);

  return (
    <div className="space-y-8">
      {error && (
        <div className="rounded-md border border-destructive/40 bg-destructive/5 p-4 flex items-center justify-between gap-4 animate-hash-in">
          <div className="flex items-center gap-3">
            <AlertCircle className="size-5 text-destructive shrink-0" />
            <p className="text-sm text-foreground">{error}</p>
          </div>
          <button
            onClick={() => void loadData()}
            className="text-xs px-3 py-1.5 rounded-md border border-border bg-card text-foreground hover:border-lime/60 hover:text-lime transition-colors focus-lime whitespace-nowrap"
          >
            Réessayer
          </button>
        </div>
      )}

      {stats && <PendingApprovalsBanner pendingCount={stats.pendingCount ?? 0} />}

      <section aria-label="Vue d'ensemble">
        {loading ? (
          <AdminStatsSkeleton />
        ) : (
          <AdminStats
            stats={stats}
            funnel={funnel}
            loading={loading}
            filters={{}}
            onFilter={() => {}}
            onClearFilters={() => {}}
          />
        )}
      </section>
    </div>
  );
}