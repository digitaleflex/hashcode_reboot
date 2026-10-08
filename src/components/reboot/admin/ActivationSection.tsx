"use client";

import * as React from "react";
import { useTranslations } from "next-intl";
import { fetchJson, isAbortError } from "@/components/reboot/admin/lib/fetchJson";

interface CurvePoint {
  date: string;
  count: number;
}

interface InactiveRow {
  id: string;
  firstName: string;
  email: string;
  since: string;
  daysInactive: number;
}

interface ActivationData {
  rate: number;
  activated: number;
  eligible: number;
  curve: CurvePoint[];
  inactifs: InactiveRow[];
}

const POLL_MS = 30_000;

interface WeekRow {
  week: string;
  count: number;
}

/** Lundi (UTC) de la semaine contenant `dayKey` ("YYYY-MM-DD"). */
function weekStartOf(dayKey: string): string {
  const d = new Date(`${dayKey}T00:00:00Z`);
  const dow = (d.getUTCDay() + 6) % 7; // 0 = lundi
  d.setUTCDate(d.getUTCDate() - dow);
  return d.toISOString().slice(0, 10);
}

/** Agrège la courbe journalière en tableau hebdomadaire. */
function toWeekly(curve: CurvePoint[]): WeekRow[] {
  const byWeek = new Map<string, number>();
  for (const p of curve) {
    const week = weekStartOf(p.date);
    byWeek.set(week, (byWeek.get(week) ?? 0) + p.count);
  }
  return [...byWeek.entries()]
    .sort((a, b) => (a[0] < b[0] ? -1 : 1))
    .map(([week, count]) => ({ week, count }));
}

export function ActivationSection() {
  const t = useTranslations("admin.activation");
  const [data, setData] = React.useState<ActivationData | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  const load = React.useCallback(async (signal?: AbortSignal) => {
    try {
      const { res, data: result, error: errMsg } = await fetchJson(
        "/api/admin/activation",
        { cache: "no-store", signal },
      );
      if (signal?.aborted) return;
      if (!res.ok) {
        throw new Error(errMsg ?? "Erreur de chargement de l'activation.");
      }
      setData(result as ActivationData);
      setError(null);
    } catch (e) {
      if (isAbortError(e)) return;
      setError(
        e instanceof Error
          ? e.message
          : "Erreur de chargement de l'activation.",
      );
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    const ctrl = new AbortController();
    let mounted = true;
    let timer: number | null = null;
    const tick = async () => {
      if (!mounted) return;
      await load(ctrl.signal);
      timer = window.setTimeout(tick, POLL_MS);
    };
    void tick();
    return () => {
      mounted = false;
      if (timer) clearTimeout(timer);
      ctrl.abort();
    };
  }, [load]);

  if (loading && !data) {
    return (
      <section className="mt-6">
        <div className="flex items-center justify-between mb-3">
          <span className="mono-label text-muted-foreground">{t("title")}</span>
        </div>
        <div className="rounded-md border border-border/60 bg-card/40 p-4 sm:p-5 h-32 animate-pulse" />
      </section>
    );
  }

  if (error && !data) {
    return (
      <section className="mt-6">
        <div className="rounded-md border border-destructive/40 bg-destructive/5 p-4">
          <p className="text-sm font-medium text-foreground">{t("title")}</p>
          <p className="text-xs text-muted-foreground mt-0.5">{error}</p>
        </div>
      </section>
    );
  }

  if (!data) return null;

  const weekly = toWeekly(data.curve);

  return (
    <section className="mt-6">
      <div className="flex items-center justify-between mb-3">
        <span className="mono-label text-muted-foreground">{t("title")}</span>
        <span className="mono-label text-xs text-muted-foreground">{t("subtitle")}</span>
      </div>
      <div className="rounded-md border border-border/60 bg-card/40 p-4 sm:p-5">
        {/* KPIs */}
        <div className="grid grid-cols-3 gap-2 mb-4">
          <div className="rounded-md border border-border/60 bg-card/60 p-3 text-center">
            <div className="text-xl font-bold tabular-nums text-foreground">{data.rate}%</div>
            <div className="mono-label text-muted-foreground">{t("kpiRate")}</div>
          </div>
          <div className="rounded-md border border-border/60 bg-card/60 p-3 text-center">
            <div className="text-xl font-bold tabular-nums text-foreground">{data.activated}</div>
            <div className="mono-label text-muted-foreground">{t("kpiActivated")}</div>
          </div>
          <div className="rounded-md border border-border/60 bg-card/60 p-3 text-center">
            <div className="text-xl font-bold tabular-nums text-foreground">{data.eligible}</div>
            <div className="mono-label text-muted-foreground">{t("kpiEligible")}</div>
          </div>
        </div>

        {/* Courbe hebdo */}
        <p className="mono-label text-muted-foreground mb-2">{t("curveTitle")}</p>
        <ul className="mb-4 divide-y divide-border/20 rounded-md border border-border/40">
          {weekly.map((w) => (
            <li key={w.week} className="flex items-center justify-between px-3 py-2 text-sm">
              <span className="font-mono text-xs text-foreground">{w.week}</span>
              <span className="tabular-nums text-foreground">{w.count}</span>
            </li>
          ))}
        </ul>

        {/* Inactifs 7j+ */}
        <p className="mono-label text-muted-foreground mb-2">{t("inactiveTitle")}</p>
        {data.inactifs.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t("inactiveEmpty")}</p>
        ) : (
          <div className="overflow-x-auto scroll-slim">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs text-muted-foreground mono-label border-b border-border/40">
                  <th className="px-3 py-2">{t("table.member")}</th>
                  <th className="px-3 py-2">{t("table.since")}</th>
                  <th className="px-3 py-2 text-right">{t("table.daysInactive")}</th>
                </tr>
              </thead>
              <tbody>
                {data.inactifs.map((m) => (
                  <tr key={m.id} className="border-b border-border/20 last:border-0">
                    <td className="px-3 py-2 text-foreground">
                      {m.firstName}{" "}
                      <span className="text-xs text-muted-foreground">{m.email}</span>
                    </td>
                    <td className="px-3 py-2 font-mono text-xs text-foreground">
                      {m.since.slice(0, 10)}
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums text-foreground">
                      {m.daysInactive}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <p className="mt-3 text-xs text-muted-foreground">{t("relanceSent")}</p>
      </div>
    </section>
  );
}
