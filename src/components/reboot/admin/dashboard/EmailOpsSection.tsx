"use client";

import { cn } from "@/lib/utils";
import { Skeleton } from "@/components/ui/skeleton";
import { MonoLabel } from "@/components/reboot/shared";
import { Card } from "@/components/reboot/shared";
import { AlertTriangle, Clock } from "lucide-react";

export interface OpsProvider {
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
}

export interface EmailOpsData {
  ok: true;
  generatedAt: string;
  providers: OpsProvider[];
  throughput: { minutes: number; sent: number };
  capacityBatchSize: number;
  unattributed: number;
  alerts: Array<{ level: string; provider?: string; message: string }>;
}

function formatPercent(value: number | null | undefined, digits = 1): string {
  if (value === null || value === undefined) return "—";
  return `${(value * 100).toFixed(digits)}%`;
}

function RateBar({ value, label }: { value: number; label: string }) {
  const width = Math.min(100, Math.max(0, value * 100));
  const good = value >= 0.95;
  const warn = value >= 0.85 && !good;
  return (
    <div className="space-y-1">
      <div className="flex justify-between text-xs">
        <span className="text-muted-foreground">{label}</span>
        <span className="mono-label text-foreground">{formatPercent(value)}</span>
      </div>
      <div className="h-1.5 rounded-sm bg-muted overflow-hidden">
        <div
          className={cn(
            "h-full rounded-sm transition-colors duration-500",
            good ? "bg-lime" : warn ? "bg-amber-500" : "bg-red-500",
          )}
          style={{ width: `${width}%` }}
        />
      </div>
    </div>
  );
}

function StatusBadge({ level }: { level: string }) {
  const colors: Record<string, string> = {
    ok: "border-lime/40 bg-lime/10 text-lime",
    warn: "border-amber-500/40 bg-amber-500/10 text-amber-500",
    critical: "border-red-500/40 bg-red-500/10 text-red-400",
    blocked: "border-red-500/60 bg-red-500/20 text-red-300",
  };
  const labels: Record<string, string> = {
    ok: "OK",
    warn: "WARN",
    critical: "CRITIQUE",
    blocked: "BLOQUÉ",
  };
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-semibold mono-label",
        colors[level] ?? colors.ok,
      )}
    >
      {labels[level] ?? level}
    </span>
  );
}

export function EmailOpsSkeleton() {
  return (
    <div className="space-y-4">
      <Skeleton className="h-4 w-28" />
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {Array.from({ length: 2 }).map((_, i) => (
          <Card key={i} className="p-4 space-y-3">
            <div className="flex items-center justify-between">
              <Skeleton className="h-3 w-20" />
              <Skeleton className="h-5 w-12 rounded-full" />
            </div>
            <Skeleton className="h-8 w-24" />
            <Skeleton className="h-2 w-full rounded" />
          </Card>
        ))}
      </div>
    </div>
  );
}

/**
 * Section TEMPS RÉEL — provider quotas + throughput + alertes.
 * Réutilise la logique de /admin/email-deliverability mais sous forme
 * de composant standalone, sans duplication de code de layout.
 */
export function EmailOpsSection({
  data,
  loading,
}: {
  data: EmailOpsData | null;
  loading: boolean;
}) {
  if (loading && !data) return <EmailOpsSkeleton />;
  if (!data) return null;

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Clock className="size-4 text-lime" />
        <MonoLabel className="text-foreground">QUOTAS TEMPS RÉEL</MonoLabel>
        <span className="text-xs text-muted-foreground mono-label">
          {new Date(data.generatedAt).toLocaleTimeString("fr-FR")}
        </span>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {data.providers.map((p) => (
          <Card key={p.provider} className="p-4">
            <div className="flex items-center justify-between mb-2">
              <MonoLabel className="text-xs text-muted-foreground">
                {p.provider.toUpperCase()}
              </MonoLabel>
              <StatusBadge level={p.level} />
            </div>
            <div className="text-2xl font-bold text-foreground">
              {p.used} <span className="text-sm font-normal text-muted-foreground">/ {p.cap}</span>
            </div>
            <div className="text-xs text-muted-foreground mt-1">
              {p.remaining} restants · reset à{" "}
              {new Date(p.resetsAt).toLocaleTimeString("fr-FR", {
                hour: "2-digit",
                minute: "2-digit",
              })}
            </div>
            <div className="mt-2">
              <RateBar value={p.ratio} label="Quota" />
            </div>
            {p.remainingBatches > 0 && (
              <div className="mt-1 text-xs text-muted-foreground">
                {p.remainingBatches} lot(s) de {data.capacityBatchSize} restant(s)
              </div>
            )}
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Card className="p-3">
          <MonoLabel className="text-xs text-muted-foreground mb-1 block">
            DÉBIT
          </MonoLabel>
          <div className="text-lg font-bold text-foreground">{data.throughput.sent}</div>
          <div className="text-xs text-muted-foreground">
            envois sur les {data.throughput.minutes} dernières minutes
          </div>
        </Card>
        {data.alerts.length > 0 && (
          <Card className="p-3 border-red-500/30">
            <div className="flex items-center gap-1.5 mb-1">
              <AlertTriangle className="size-3 text-red-400" />
              <MonoLabel className="text-xs text-red-400">ALERTES</MonoLabel>
            </div>
            {data.alerts.map((a, i) => (
              <div key={i} className="text-xs text-red-300 mt-1">
                {a.message}
              </div>
            ))}
          </Card>
        )}
      </div>
    </div>
  );
}
