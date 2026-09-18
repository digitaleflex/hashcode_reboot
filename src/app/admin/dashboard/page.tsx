"use client";

import * as React from "react";
import { AdminStats, type Stats, type FunnelData } from "@/components/reboot/admin/AdminStats";
import { EmailEngagement, type EmailStatsData } from "@/components/reboot/admin/EmailEngagement";
import { CohortRetention } from "@/components/reboot/admin/CohortRetention";
import { LoginActivity } from "@/components/reboot/admin/LoginActivity";
import { ActivityLog } from "@/components/reboot/admin/ActivityLog";
import {
  DashboardSkeleton,
  HealthAlertsBanner,
  EmailOpsSection,
  CronHealthSection,
  EmailDeliverabilitySummary,
} from "@/components/reboot/admin/dashboard";
import { fetchJson, isAbortError, withRetryAfter } from "@/components/reboot/admin/lib/fetchJson";
import { AlertCircle, Clock, RefreshCw } from "lucide-react";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";

const POLL_MS = 30_000;

// ── Types pour le dashboard unifié ─────────────────────────────────────

interface DashboardApiResponse {
  ok: boolean;
  generatedAt: string;
  stats: Stats | null;
  funnel: FunnelData | null;
  emailStats: EmailStatsData | null;
  emailDeliverability: {
    ok: boolean;
    dateRange: { start: string; end: string };
    summary: DeliverabilitySummary[];
    chartData: unknown[];
  } | null;
  emailOps: EmailOpsApiResponse | null;
  cronHealth: CronHealthItem[] | null;
  audience: AudienceSummary | null;
  errors?: Record<string, string>;
}

interface DeliverabilitySummary {
  provider: string;
  totals: {
    sent: number;
    delivered: number;
    bounced: number;
    complained: number;
    unsubscribed: number;
    opened: number;
    clicked: number;
    uniqueOpened: number;
    uniqueClicked: number;
  };
  rates: {
    deliveryRate: number;
    openRate: number;
    clickRate: number;
    bounceRate: number;
    complaintRate: number;
  };
  comparison: { volumeChange: number; deliveryChange: number };
  daysWithData: number;
}

interface EmailOpsApiResponse {
  ok: true;
  generatedAt: string;
  providers: Array<{
    provider: string;
    cap: number;
    used: number;
    attributed: number;
    unattributed: number;
    remaining: number;
    ratio: number;
    level: "ok" | "warn" | "critical" | "blocked";
    resetsAt: string;
    remainingBatches: number;
  }>;
  throughput: { minutes: number; sent: number };
  capacityBatchSize: number;
  unattributed: number;
  alerts: Array<{ level: string; provider?: string; message: string }>;
}

interface CronHealthItem {
  key: string;
  label: string;
  expectedEveryH: number | null;
  lastRun: string | null;
  summary: string | null;
  status: "ok" | "stale" | "never" | "manual";
}

interface AudienceSummary {
  total: number;
  blacklisted: number;
  bounced: number;
  annonceSent: number;
  annonceRemaining: number;
}

// ── Section-level error boundary ───────────────────────────────────────

interface SectionErrorProps {
  title: string;
  error: string | null;
  onRetry: () => void;
}

function SectionError({ title, error, onRetry }: SectionErrorProps) {
  if (!error) return null;
  return (
    <div className="rounded-md border border-destructive/40 bg-destructive/5 p-3 mt-4">
      <div className="flex items-start gap-2">
        <AlertCircle className="size-4 text-destructive shrink-0 mt-0.5" />
        <div className="flex-1">
          <p className="text-sm font-medium text-foreground">{title}</p>
          <p className="text-xs text-muted-foreground mt-0.5">{error}</p>
        </div>
        <button
          onClick={onRetry}
          className="text-xs px-2.5 py-1 rounded border border-border bg-card text-foreground hover:border-lime/60 hover:text-lime transition-colors focus-lime"
        >
          Réessayer
        </button>
      </div>
    </div>
  );
}

// ── Main page ──────────────────────────────────────────────────────────

export default function AdminDashboardPage() {
  const router = useRouter();

  // Unified data
  const [data, setData] = React.useState<DashboardApiResponse | null>(null);

  // Per-section loading/error states
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [lastRefresh, setLastRefresh] = React.useState<number | null>(null);

  // Per-section error tracking for granular recovery
  const [sectionErrors, setSectionErrors] = React.useState<Record<string, string>>({});

  // Polling refs
  const ctrlRef = React.useRef<AbortController | null>(null);
  const timerRef = React.useRef<number | null>(null);
  const runningRef = React.useRef(false);

  const loadData = React.useCallback(
    async (signal?: AbortSignal, silent?: boolean) => {
      if (runningRef.current) return;
      runningRef.current = true;
      if (!silent) setLoading(true);
      setError(null);
      ctrlRef.current = new AbortController();
      const currentSignal = signal ?? ctrlRef.current.signal;

      try {
        const { res, data: result, code, error: errMsg, retryAfterSec } = await fetchJson(
          "/api/admin/dashboard",
          { cache: "no-store", signal: currentSignal },
        );

        if (currentSignal?.aborted) return;

        if (res.status === 401 || code === "UNAUTHORIZED") {
          window.location.href = "/?admin=1";
          return;
        }

        if (!res.ok) {
          const msg = errMsg ?? "Erreur de chargement du dashboard.";
          throw new Error(
            res.status === 429 || code === "RATE_LIMITED"
              ? withRetryAfter(msg, retryAfterSec)
              : msg,
          );
        }

        const errors = (result as DashboardApiResponse).errors ?? {};
        setSectionErrors(errors);
        setData(result as DashboardApiResponse);
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
        if (!currentSignal?.aborted) setLoading(false);
        runningRef.current = false;
      }
    },
    [],
  );

  // Polling — un timer à la fois, refresh silencieux
  React.useEffect(() => {
    let mounted = true;
    const schedule = () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = window.setTimeout(() => {
        if (mounted) {
          void loadData(undefined, true);
          schedule();
        }
      }, POLL_MS);
    };
    void loadData();
    schedule();

    const onVis = () => {
      if (!document.hidden) {
        void loadData(undefined, true);
        schedule();
      }
    };
    document.addEventListener("visibilitychange", onVis);

    return () => {
      mounted = false;
      if (timerRef.current) clearTimeout(timerRef.current);
      ctrlRef.current?.abort();
      document.removeEventListener("visibilitychange", onVis);
    };
  }, [loadData]);

  // Extract deliverability summary for the condensed section
  const deliverabilitySummary = data?.emailDeliverability?.summary ?? null;
  const deliverabilityAlerts = React.useMemo(() => {
    if (!deliverabilitySummary) return [];
    return deliverabilitySummary
      .filter((s) => s.rates.bounceRate > 0.05 || s.rates.complaintRate > 0.001)
      .map((s) => ({
        provider: s.provider,
        bounceRate: s.rates.bounceRate,
        complaintRate: s.rates.complaintRate,
      }));
  }, [deliverabilitySummary]);

  // Initial full-page load
  if (loading && !data) {
    return <DashboardSkeleton />;
  }

  return (
    <div className="space-y-8">
      {/* ── Global error banner (top-level fetch failure) ────────────── */}
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

      {/* ── Header: title + last refresh + manual refresh ───────────── */}
      <div className="flex items-center justify-between">
        <div>
          <div className="mono-label text-lime text-xs mb-1">HASHCODE · ADMIN</div>
          <h1 className="text-2xl font-bold text-foreground">Dashboard 360°</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Vue d'ensemble complète : membres, funnel, email, quotas et santé.
          </p>
        </div>
        <div className="flex items-center gap-3 shrink-0">
          <button
            onClick={() => void loadData()}
            disabled={loading}
            className="flex items-center gap-2 px-3 py-1.5 rounded-md border border-border bg-card text-foreground hover:border-lime/60 hover:text-lime transition-colors focus-lime text-sm mono-label min-h-[40px]"
          >
            <RefreshCw className={cn("size-4", loading && "animate-spin")} />
            Rafraîchir
          </button>
          {lastRefresh && (
            <span
              className="mono-label text-xs text-muted-foreground flex items-center gap-1"
              title={new Date(lastRefresh).toLocaleTimeString()}
            >
              <Clock className="size-3" />
              {Math.round((Date.now() - lastRefresh) / 1000)}s
            </span>
          )}
        </div>
      </div>

      {/* ── Section-level errors (non-blocking) ──────────────────────── */}
      {Object.keys(sectionErrors).length > 0 && (
        <div className="space-y-2">
          {Object.entries(sectionErrors).map(([section, err]) => (
            <SectionError
              key={section}
              title={`Alerte: ${section}`}
              error={err}
              onRetry={() => void loadData()}
            />
          ))}
        </div>
      )}

      {/* ── 1. Health & Alerts banner ────────────────────────────────── */}
      <HealthAlertsBanner
        pendingCount={data?.stats?.totals.pending ?? 0}
        cronHealth={data?.cronHealth ?? null}
        emailOpsAlerts={data?.emailOps?.alerts ?? null}
        deliverabilityAlerts={deliverabilityAlerts}
        onQueueClick={() => router.push("/admin/members?status=PENDING")}
        onCronsClick={() => {}}
      />

      {/* Section-level error: stats */}
      {sectionErrors.stats && (
        <SectionError
          title="Statistiques membres"
          error={sectionErrors.stats}
          onRetry={() => void loadData()}
        />
      )}

      {/* ── 2. AdminStats (totals, domains, funnel, breakdowns) ─────── */}
      <section aria-label="Vue d'ensemble membres">
        <AdminStats
          stats={data?.stats ?? null}
          funnel={data?.funnel ?? null}
          loading={loading}
          filters={{}}
          onFilter={() => {}}
          onClearFilters={() => {}}
          onSeeQueue={() => router.push("/admin/members?status=PENDING")}
        />
      </section>

      {/* Section-level error: emailStats */}
      {sectionErrors.emailStats && (
        <SectionError
          title="Email engagement"
          error={sectionErrors.emailStats}
          onRetry={() => void loadData()}
        />
      )}

      {/* ── 3. Email engagement + relance ────────────────────────────── */}
      <EmailEngagement
        data={data?.emailStats ?? null}
        loading={loading}
      />

      {/* Section-level error: emailOps */}
      {sectionErrors.emailOps && (
        <SectionError
          title="Quotas email temps réel"
          error={sectionErrors.emailOps}
          onRetry={() => void loadData()}
        />
      )}

      {/* ── 4. Email deliverability summary + real-time ops ─────────── */}
      <EmailDeliverabilitySummary summary={deliverabilitySummary} />

      <EmailOpsSection
        data={data?.emailOps ?? null}
        loading={loading}
      />

      {/* ── 5. Cron health ──────────────────────────────────────────── */}
      <CronHealthSection
        crons={data?.cronHealth ?? null}
        loading={loading}
      />

      {/* ── 6. Cohort retention (self-fetching) ─────────────────────── */}
      <CohortRetention />

      {/* ── 7. Login activity (self-fetching) ───────────────────────── */}
      <LoginActivity />

      {/* ── 8. Activity log (self-fetching) ─────────────────────────── */}
      <ActivityLog />
    </div>
  );
}
