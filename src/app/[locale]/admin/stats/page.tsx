"use client";

import * as React from "react";
import { AdminStats, type Stats, type FunnelData } from "@/components/reboot/admin/AdminStats";
import { EmailEngagement, type EmailStatsData } from "@/components/reboot/admin/EmailEngagement";
import { AdminStatsSkeleton } from "@/components/reboot/admin/skeletons";
import { PendingApprovalsBanner } from "@/components/reboot/admin/PendingApprovalsBanner";
import { adminErrorMessage, adminRequest, useAdminQuery } from "@/components/reboot/admin/lib/adminQuery";
import { AlertCircle, Clock } from "lucide-react";
import { CohortRetention } from "@/components/reboot/admin/CohortRetention";
import { LoginActivity } from "@/components/reboot/admin/LoginActivity";
import { useRouter } from "next/navigation";

const POLL_MS = 30_000;

export default function AdminStatsPage() {
  const router = useRouter();

  /**
   * D25 + D32 : le `useEffect` de polling, ses DEUX timers, le
   * `visibilitychange`, la garde `runningRef`, le `AbortController` et les 5
   * `useState` disparaissent au profit de `refetchInterval` +
   * `refetchOnWindowFocus`, qui sont exactement ces deux comportements.
   *
   * Les 3 fetch sont conservés en UNE query, pas en trois : `/api/stats` est la
   * requêteCritique (son échec faisait échouer tout l'écran), les deux autres
   * étaient en `.catch(() => null)` — best-effort. `Promise.allSettled` rend
   * cette hiérarchie explicite, et la garde `runningRef` devient inutile car
   * React Query n'envoie jamais deux requêtes concurrentes sur la même clé.
   *
   * `retry: false` : sur 401 la redirection est déjà partie. Réessayer 3 fois
   * ne ferait que multiplier les requêtes avant que l'écran ne se vide.
   */
  const query = useAdminQuery<{
    stats: Stats | null;
    funnel: FunnelData | null;
    emailStats: EmailStatsData | null;
  }>({
    queryKey: ["admin", "stats"],
    retry: false,
    refetchInterval: POLL_MS,
    refetchOnWindowFocus: true,
    queryFn: async ({ signal }) => {
      const [statsR, funnelR, emailR] = await Promise.allSettled([
        adminRequest<Stats>("/api/stats", { cache: "no-store", signal }, {
          fallbackMessage: "Erreur de chargement des stats.",
        }),
        adminRequest<FunnelData>("/api/analytics", { cache: "no-store", signal }),
        adminRequest<EmailStatsData>("/api/email-stats", { cache: "no-store", signal }),
      ]);
      // Le critique : son rejet fait échouer la query entière, comme avant.
      if (statsR.status === "rejected") throw statsR.reason;
      const unwrap = <T,>(r: PromiseSettledResult<T>): T | null =>
        r.status === "fulfilled" ? r.value : null;
      return {
        stats: statsR.value ?? null,
        funnel: unwrap(funnelR),
        emailStats: unwrap(emailR),
      };
    },
  });

  const stats = query.data?.stats ?? null;
  const funnel = query.data?.funnel ?? null;
  const emailStats = query.data?.emailStats ?? null;
  const loading = query.isPending;
  const error = query.error
    ? adminErrorMessage(
        query.error,
        "Erreur de chargement des données. Vérifie ta connexion puis rafraîchis.",
      )
    : null;
  const lastRefresh = query.dataUpdatedAt || null;
  const loadData = React.useCallback(async () => {
    await query.refetch();
  }, [query]);

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