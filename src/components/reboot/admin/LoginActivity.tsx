"use client";

import * as React from "react";
import { MonoLabel } from "../shared";
import { Skeleton } from "@/components/ui/skeleton";
import { useAdminQuery } from "./lib/adminQuery";
import { cn } from "@/lib/utils";

interface LoginActivityData {
  daily: { date: string; active: number }[];
  dau7Avg: number;
  distinct30: number;
}

export function LoginActivity() {
  /**
   * D32 : `useEffect` + `AbortController` + 2 `useState` -> une `useQuery`.
   * Le `catch` muet d'origine est conservé : `data` reste `null` sur échec et le
   * composant rend `null`. Même rendu, sans l'anneau `mounted`.
   */
  const query = useAdminQuery<LoginActivityData | null>({
    queryKey: ["admin", "activity-logins"],
    url: "/api/admin/activity-logins",
    init: { cache: "no-store" },
    selectData: (raw) => {
      const d = raw as (LoginActivityData & { ok?: boolean }) | null;
      return d?.ok ? d : null;
    },
  });

  const data = query.data ?? null;
  const loading = query.isPending;

  if (loading && !data) {
    return (
      <section className="mt-6">
        <MonoLabel className="text-muted-foreground">Activité connexions</MonoLabel>
        <div className="mt-3 rounded-md border border-border/60 bg-card/40 p-4">
          <Skeleton className="h-20 w-full" />
        </div>
      </section>
    );
  }
  if (!data) return null;

  const max = Math.max(1, ...data.daily.map((d) => d.active));

  return (
    <section className="mt-6">
      <MonoLabel className="text-muted-foreground">Activité connexions</MonoLabel>
      <div className="mt-3 rounded-md border border-border/60 bg-card/40 p-4 sm:p-5">
        <div className="grid grid-cols-2 gap-2 mb-4">
          <div className="rounded-md border border-border/60 bg-card/60 p-3 text-center">
            <div className="text-xl font-bold tabular-nums text-foreground">{data.dau7Avg}</div>
            <div className="mono-label text-muted-foreground">DAU moyen 7j</div>
          </div>
          <div className="rounded-md border border-border/60 bg-card/60 p-3 text-center">
            <div className="text-xl font-bold tabular-nums text-foreground">{data.distinct30}</div>
            <div className="mono-label text-muted-foreground">Actifs 30j</div>
          </div>
        </div>
        <div className="flex items-end gap-1 h-24">
          {data.daily.map((d) => (
            <div
              key={d.date}
              className="flex-1"
              title={`${d.date} — ${d.active} actif(s)`}
            >
              <div
                className={cn(
                  "rounded-sm transition-colors",
                  d.active > 0 ? "bg-lime/70 hover:bg-lime" : "bg-muted/40",
                )}
                style={{ height: `${Math.max(6, (d.active / max) * 100)}%` }}
              />
            </div>
          ))}
        </div>
        <div className="mt-1 flex justify-between mono-label text-muted-foreground">
          <span>{data.daily[0]?.date ?? ""}</span>
          <span>{data.daily[data.daily.length - 1]?.date ?? ""}</span>
        </div>
      </div>
    </section>
  );
}
