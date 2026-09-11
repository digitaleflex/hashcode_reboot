"use client";

import * as React from "react";
import { MonoLabel } from "../shared";
import { Skeleton } from "@/components/ui/skeleton";
import { fetchJson } from "./lib/fetchJson";
import { cn } from "@/lib/utils";

interface LoginActivityData {
  daily: { date: string; active: number }[];
  dau7Avg: number;
  distinct30: number;
}

export function LoginActivity() {
  const [data, setData] = React.useState<LoginActivityData | null>(null);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    const ctrl = new AbortController();
    (async () => {
      try {
        const { res, data } = await fetchJson("/api/admin/activity-logins", {
          cache: "no-store",
          signal: ctrl.signal,
        });
        if (res.ok && data?.ok) setData(data as LoginActivityData);
      } catch {
        /* silencieux */
      } finally {
        setLoading(false);
      }
    })();
    return () => ctrl.abort();
  }, []);

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
            <div className="text-[10px] text-muted-foreground uppercase tracking-wider">DAU moyen 7j</div>
          </div>
          <div className="rounded-md border border-border/60 bg-card/60 p-3 text-center">
            <div className="text-xl font-bold tabular-nums text-foreground">{data.distinct30}</div>
            <div className="text-[10px] text-muted-foreground uppercase tracking-wider">Actifs 30j</div>
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
        <div className="mt-1 flex justify-between text-[10px] text-muted-foreground mono-label">
          <span>{data.daily[0]?.date ?? ""}</span>
          <span>{data.daily[data.daily.length - 1]?.date ?? ""}</span>
        </div>
      </div>
    </section>
  );
}
