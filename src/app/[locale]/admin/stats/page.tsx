"use client";

import * as React from "react";
import { AdminStats, type Stats, type FunnelData } from "@/components/reboot/admin/AdminStats";
import { EmailEngagement, type EmailStatsData } from "@/components/reboot/admin/EmailEngagement";
import { AdminStatsSkeleton } from "@/components/reboot/admin/skeletons";
import { PendingApprovalsBanner } from "@/components/reboot/admin/PendingApprovalsBanner";
import { fetchJson, isAbortError, withRetryAfter } from "@/components/reboot/admin/lib/fetchJson";
import { AlertCircle, Clock } from "lucide-react";
import { CohortRetention } from "@/components/reboot/admin/CohortRetention";
import { LoginActivity } from "@/components/reboot/admin/LoginActivity";
import { useRouter } from "next/navigation";

const POLL_MS = 30_000;

export default function AdminStatsPage() {
  const router = useRouter();
  const [stats, setStats] = React.useState<Stats | null>(null);
  const [funnel, setFunnel] = React.useState<FunnelData | null>(null);
  const [emailStats, setEmailStats] = React.useState<EmailStatsData | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [lastRefresh, setLastRefresh] = React.useState<number | null>(null);

  const ctrlRef = React.useRef<AbortController | null>(null);
  const timerRef = React.useRef<number | null>(null);
  const runningRef = React.useRef(false);

  const loadData = React.useCallback(async (signal?: AbortSignal, silent?: boolean) => {
    if (runningRef.current) return;
    runningRef.current = true;
    if (!silent) setLoading(true);
    setError(null);
    try {
      const [statsResult, funnelResult, emailResult] = await Promise.all([
        fetchJson("/api/stats", { cache: "no-store", signal }),
        fetchJson("/api/analytics", { cache: "no-store", signal }).catch(() => null),
        fetchJson("/api/email-stats", { cache: "no-store", signal }).catch(() => null),
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
      if (funnelResult?.res?.ok) setFunnel(funnelResult.data);
      if (emailResult?.res?.ok) setEmailStats(emailResult.data);
      setLastRefresh(Date.now());
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
      runningRef.current = false;
    }
  }, []);

  // Polling — un seul timer à la fois (clear avant re-planif),
  // pas de flash skeleton sur les refreshs silencieux.
  React.useEffect(() => {
    let mounted = true;
    const schedule = () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = window.setTimeout(() => { if (mounted) { void loadData(undefined, true); schedule(); } }, POLL_MS);
    };
    void loadData();
    schedule();

    const onVis = () => { if (!document.hidden) { void loadData(undefined, true); schedule(); } };
    document.addEventListener("visibilitychange", onVis);

    return () => {
      mounted = false;
      if (timerRef.current) clearTimeout(timerRef.current);
      ctrlRef.current?.abort();
      document.removeEventListener("visibilitychange", onVis);
    };
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

      {stats && <PendingApprovalsBanner pendingCount={stats.totals?.pending ?? 0} />}

      <div className="flex items-center justify-between">
        <section aria-label="Vue d'ensemble" className="flex-1 min-w-0">
          {loading && !funnel ? <AdminStatsSkeleton /> : (
            <AdminStats
              stats={stats}
              funnel={funnel}
              loading={loading}
              filters={{}}
              onFilter={() => {}}
              onClearFilters={() => {}}
              onSeeQueue={() => {
                router.push("/admin/members?status=PENDING");
              }}
            />
          )}
        </section>
        {lastRefresh && (
          <span className="mono-label text-xs text-muted-foreground shrink-0 ml-4 flex items-center gap-1" title={new Date(lastRefresh).toLocaleTimeString()}>
            <Clock className="size-3" />
            {Math.round((Date.now() - lastRefresh) / 1000)}s
          </span>
        )}
      </div>

      <EmailEngagement data={emailStats} loading={loading} />

      <LoginActivity />

      <CohortRetention />
    </div>
  );
}