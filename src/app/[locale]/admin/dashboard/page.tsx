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
// D29 : les formes de reponse des sectionsetaient REDECLAREES ici, a
// l'identique, alors que les composants qui les consomment les exportent deja.
// Une redeclaration ne peut pas diverger silencieusement d'un `export interface`
// qu'on ne recompile pas ensemble. On importe donc la definition, et il n'y a
// plus qu'un endroit a corriger quand la forme change.
import type { CronHealthItem } from "@/components/reboot/admin/dashboard/CronHealthSection";
import type { EmailOpsData } from "@/components/reboot/admin/dashboard/EmailOpsSection";
import type { DeliverabilityProviderSummary } from "@/components/reboot/admin/dashboard/EmailDeliverabilitySummary";
import { adminErrorMessage, useAdminQuery } from "@/components/reboot/admin/lib/adminQuery";
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
    dateRange: { start: string; end: string };
    summary: DeliverabilityProviderSummary[];
    chartData: unknown[];
  } | null;
  emailOps: EmailOpsData | null;
  cronHealth: CronHealthItem[] | null;
  audience: AudienceSummary | null;
  errors?: Record<string, string>;
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

  /**
   * D25 + D32 — le fichier qui PORTAIT le bug D24.
   *
   * Il testait `res.status === 401 || code === "UNAUTHORIZED"` puis redirigeait
   * vers `/?admin=1`. Après D24, une route refusée à un viewer répond 403 : ce
   * dashboard le traitait comme une session expirée et renvoyait l'admin
   * légitime vers la page de connexion. `adminRequest` sépare désormais les deux.
   *
   * Le `useEffect` de polling, ses deux timers, le `visibilitychange`, la garde
   * `runningRef` et l'`AbortController` sont remplacés par `refetchInterval` +
   * `refetchOnWindowFocus`. `runningRef` devient inutile : React Query n'envoie
   * jamais deux requêtes concurrentes sur la même clé.
   *
   * `retry: false` : le 401 a déjà redirigé, réessayer ne fait que multiplier
   * les requêtes avant que l'écran ne se vide.
   */
  const query = useAdminQuery<DashboardApiResponse>({
    queryKey: ["admin", "dashboard"],
    url: "/api/admin/dashboard",
    init: { cache: "no-store" },
    fallbackMessage: "Erreur de chargement du dashboard.",
    retry: false,
    refetchInterval: POLL_MS,
    refetchOnWindowFocus: true,
  });

  const data = query.data ?? null;
  const loading = query.isPending;
  const error = query.error
    ? adminErrorMessage(
        query.error,
        "Erreur de chargement des données. Vérifie ta connexion puis rafraîchis.",
      )
    : null;
  const lastRefresh = query.dataUpdatedAt || null;
  // Alertes par section, fournies par le serveur : ce ne sont pas des erreurs de
  // requête, elles restent donc hors du canal `error` de React Query.
  const sectionErrors = data?.errors ?? {};

  const loadData = React.useCallback(async () => {
    await query.refetch();
  }, [query]);

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
