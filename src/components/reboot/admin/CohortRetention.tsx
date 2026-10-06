"use client";

import * as React from "react";
import { adminErrorMessage, useAdminQuery } from "@/components/reboot/admin/lib/adminQuery";

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
  /**
   * D32 : la boucle `tick` + `setTimeout` + `mounted` + `AbortController` +
   * 3 `useState` deviennent `refetchInterval` et deux valeurs dérivées.
   *
   * Le timer d'origine replanifiait APRÈS chaque réponse ; `refetchInterval`
   * mesure l'intervalle entre le début des requêtes. Sur une réponse lente
   * (> 30 s) le rythme diffère — sans effet ici, la donnée est un tableau de
   * cohortes qui se refreshing pas à la seconde.
   */
  const query = useAdminQuery<CohortRow[]>({
    queryKey: ["admin", "stats", "cohort"],
    url: "/api/stats/cohort",
    init: { cache: "no-store" },
    fallbackMessage: "Erreur de chargement des cohortes.",
    refetchInterval: POLL_MS,
  });

  const rows = query.data ?? null;
  const loading = query.isPending;
  const error = query.error
    ? adminErrorMessage(query.error, "Erreur de chargement des cohortes.")
    : null;

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
      <div className="rounded-md border border-border/60 bg-card/40 overflow-x-auto scroll-slim">
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
