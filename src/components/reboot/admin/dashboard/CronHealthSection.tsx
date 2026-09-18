"use client";

import { cn } from "@/lib/utils";
import { Skeleton } from "@/components/ui/skeleton";
import { MonoLabel } from "@/components/reboot/shared";
import { Card } from "@/components/reboot/shared";
import {
  Activity,
  AlertTriangle,
  CheckCircle2,
} from "lucide-react";

export interface CronHealthItem {
  key: string;
  label: string;
  expectedEveryH: number | null;
  lastRun: string | null;
  summary: string | null;
  status: "ok" | "stale" | "never" | "manual";
}

export function CronHealthSkeleton() {
  return (
    <div className="space-y-4">
      <Skeleton className="h-4 w-32" />
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
        {Array.from({ length: 6 }).map((_, i) => (
          <Card key={i} className="p-3 space-y-2">
            <Skeleton className="h-4 w-3/4" />
            <Skeleton className="h-3 w-1/2" />
          </Card>
        ))}
      </div>
    </div>
  );
}

/**
 * Section SANTÉ DES CRONS — affiche l'état de chaque tâche planifiée.
 * Réutilise la logique de visualisation du mode délivrabilité, extraite sous
 * forme de composant réutilisable.
 */
export function CronHealthSection({
  crons,
  loading,
}: {
  crons: CronHealthItem[] | null;
  loading: boolean;
}) {
  if (loading && !crons) return <CronHealthSkeleton />;
  if (!crons || crons.length === 0) return null;

  return (
    <section className="mt-6">
      <div className="flex items-center gap-2 mb-1">
        <Activity className="size-4 text-lime" />
        <h2 className="font-semibold mono-label text-foreground">SANTÉ DES CRONS</h2>
      </div>
      <p className="text-xs text-muted-foreground mb-3">
        Dernier passage de chaque tâche planifiée. Un cron quotidien en alerte =
        cron-job.org à vérifier.
      </p>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
        {crons.map((c) => {
          const isOk = c.status === "ok";
          const isStale = c.status === "stale";
          const isNever = c.status === "never";
          const isManual = c.status === "manual";
          return (
            <div
              key={c.key}
              className={cn(
                "rounded-sm border p-3",
                isOk && "border-lime/40 bg-lime/[0.04]",
                isStale && "border-red-500/40 bg-red-500/5",
                (isNever || isManual) && "border-border/60 bg-card/40",
              )}
            >
              <div className="flex items-center gap-1.5">
                {isOk ? (
                  <CheckCircle2 className="size-3.5 text-lime" />
                ) : isStale ? (
                  <AlertTriangle className="size-3.5 text-red-400" />
                ) : (
                  <Activity className="size-3.5 text-muted-foreground" />
                )}
                <span className="text-sm font-medium text-foreground">{c.label}</span>
              </div>
              <div className="mt-1 text-xs text-muted-foreground mono-label">
                {c.lastRun
                  ? `Dernier passage : ${new Date(c.lastRun).toLocaleString("fr-FR", {
                      day: "2-digit",
                      month: "short",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}`
                  : "Jamais exécuté"}
              </div>
              {c.summary && (
                <div
                  className="mt-0.5 text-xs text-muted-foreground font-mono truncate"
                  title={c.summary}
                >
                  {c.summary}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}
