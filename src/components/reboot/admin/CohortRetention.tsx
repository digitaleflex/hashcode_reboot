"use client";

import * as React from "react";
import { fetchJson, isAbortError } from "@/components/reboot/admin/lib/fetchJson";

export interface CohortRow {
  cohort: string; // "2026-W36"
  total: number;
  week1: number;
  week2: number;
  week4: number;
  week8: number;
}

const POLL_MS = 30_000;

function pct(numerator: number, denominator: number): number {
  if (denominator === 0) return 0;
  return Math.round((numerator / denominator) * 100);
}

function colorForRate(rate: number): string {
  if (rate >= 60) return "text-lime bg-lime/10";
  if (rate >= 30) return "text-amber-400 bg-amber-500/10";
  return "text-red-400 bg-red-500/10";
}

export function CohortRetention() {
  const [rows, setRows] = React.useState<CohortRow[] | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  const load = React.useCallback(async (signal?: AbortSignal) => {
    try {
      const { res, data, error: errMsg } = await fetchJson("/api/stats/cohort", {
        cache: "no-store",
        signal,
      });
      if (signal?.aborted) return;
      if (!res.ok) {
        throw new Error(errMsg ?? "Erreur de chargement des cohortes.");
      }
      setRows(data);
    } catch (e) {
      if (isAbortError(e)) return;
      setError(
        e instanceof Error
          ? e.message
          : "Erreur de chargement des cohortes.",
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

  if (loading && !rows) {
    return (
      <section className="mt-6">
        <div className="flex items-center justify-between mb-3">
          <span className="mono-label text-muted-foreground">Rétention par cohorte</span>
        </div>
        <div className="rounded-md border border-border/60 bg-card/40 p-4 sm:p-5 h-32 animate-pulse" />
      </section>
    );
  }

  if (error && !rows) {
    return (
      <section className="mt-6">
        <div className="rounded-md border border-destructive/40 bg-destructive/5 p-4">
          <p className="text-sm text-foreground">{error}</p>
        </div>
      </section>
    );
  }

  if (!rows || rows.length === 0) {
    return null;
  }

  return (
    <section className="mt-6">
      <div className="flex items-center justify-between mb-3">
        <span className="mono-label text-muted-foreground">Rétention par cohorte</span>
        <span className="mono-label text-xs text-muted-foreground" title="% de membres approuvés qui restent actifs après N semaines">
          % retenus (approuvé/non-rejeté) à S1 · S2 · S4 · S8
        </span>
      </div>
      <div className="rounded-md border border-border/60 bg-card/40 overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-xs text-muted-foreground mono-label border-b border-border/40">
              <th className="px-3 py-2">Cohorte</th>
              <th className="px-3 py-2 text-right">Inscrits</th>
              <th className="px-3 py-2 text-right">S+1</th>
              <th className="px-3 py-2 text-right">S+2</th>
              <th className="px-3 py-2 text-right">S+4</th>
              <th className="px-3 py-2 text-right">S+8</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => {
              const r1 = pct(r.week1, r.total);
              const r2 = pct(r.week2, r.total);
              const r4 = pct(r.week4, r.total);
              const r8 = pct(r.week8, r.total);
              return (
                <tr key={r.cohort} className="border-b border-border/20 last:border-0">
                  <td className="px-3 py-2 font-mono text-xs text-foreground">{r.cohort}</td>
                  <td className="px-3 py-2 text-right tabular-nums text-foreground">{r.total}</td>
                  <td className={`px-3 py-2 text-right tabular-nums rounded-sm ${colorForRate(r1)}`}>{r1}%</td>
                  <td className={`px-3 py-2 text-right tabular-nums rounded-sm ${colorForRate(r2)}`}>{r2}%</td>
                  <td className={`px-3 py-2 text-right tabular-nums rounded-sm ${colorForRate(r4)}`}>{r4}%</td>
                  <td className={`px-3 py-2 text-right tabular-nums rounded-sm ${colorForRate(r8)}`}>{r8}%</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}
