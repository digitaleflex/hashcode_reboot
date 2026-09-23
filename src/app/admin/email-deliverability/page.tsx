"use client";

import * as React from "react";
import { Activity, AlertTriangle, CheckCircle2, ChevronDown, Mail, RefreshCw, TrendingDown, TrendingUp } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

interface MetricPoint {
  date: string;
  sent: number;
  delivered: number;
  bounced: number;
  opened: number;
  clicked: number;
  uniqueOpened: number;
  uniqueClicked: number;
  deliveryRate: number | null;
  openRate: number | null;
  clickRate: number | null;
  bounceRate: number | null;
  complaintRate: number | null;
}

interface ProviderSummary {
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
  comparison: {
    volumeChange: number;
    deliveryChange: number;
  };
  daysWithData: number;
}

interface ChartDatum {
  provider: string;
  data: MetricPoint[];
}

interface DeliverabilityData {
  ok: boolean;
  dateRange: { start: string; end: string };
  summary: ProviderSummary[];
  chartData: ChartDatum[];
}

interface CronHealth {
  key: string;
  label: string;
  expectedEveryH: number | null;
  lastRun: string | null;
  summary: string | null;
  status: "ok" | "stale" | "never" | "manual";
}

interface OpsProvider {
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

interface OpsData {
  ok: boolean;
  generatedAt: string;
  providers: OpsProvider[];
  throughput: { minutes: number; sent: number };
  capacityBatchSize: number;
  unattributed: number;
  alerts: Array<{ level: string; provider?: string; message: string }>;
}

function formatNumber(value: number): string {
  return new Intl.NumberFormat("fr-FR").format(value);
}

function formatPercent(value: number | null | undefined, digits = 1): string {
  if (value === null || value === undefined) return "—";
  return `${(value * 100).toFixed(digits)}%`;
}

function formatDelta(value: number): string {
  const sign = value >= 0 ? "+" : "";
  return `${sign}${(value * 100).toFixed(1)}%`;
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
          className={cn("h-full rounded-sm transition-colors duration-500", good ? "bg-lime" : warn ? "bg-amber-500" : "bg-red-500")}
          style={{ width: `${width}%` }}
        />
      </div>
    </div>
  );
}

function TrendBadge({ value, label }: { value: number; label: string }) {
  const up = value >= 0;
  return (
    <div className={cn("flex items-center gap-1 text-xs mono-label", up ? "text-lime" : "text-red-400")}>
      {up ? <TrendingUp className="size-3" /> : <TrendingDown className="size-3" />}
      {formatDelta(value)} {label}
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
  const labels: Record<string, string> = { ok: "OK", warn: "WARN", critical: "CRITIQUE", blocked: "BLOQUÉ" };
  return (
    <span className={cn("inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-semibold mono-label", colors[level] ?? colors.ok)}>
      {labels[level] ?? level}
    </span>
  );
}

export default function EmailDeliverabilityPage() {
  const [data, setData] = React.useState<DeliverabilityData | null>(null);
  const [crons, setCrons] = React.useState<CronHealth[]>([]);
  const [ops, setOps] = React.useState<OpsData | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState("");
  const { toast } = useToast();

  const load = React.useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/admin/email-deliverability?days=30", { cache: "no-store" });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = (await res.json()) as DeliverabilityData;
      if (!json.ok) throw new Error("API error");
      setData(json);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur inconnue");
    } finally {
      setLoading(false);
    }
    try {
      const res = await fetch("/api/admin/cron-health", { cache: "no-store" });
      if (res.ok) {
        const json = await res.json();
        if (json.ok && Array.isArray(json.crons)) setCrons(json.crons as CronHealth[]);
      }
    } catch {
      /* la santé des crons ne bloque pas les métriques */
    }
    try {
      const res = await fetch("/api/admin/email-ops", { cache: "no-store" });
      if (res.ok) {
        const json = await res.json();
        if (json.ok) setOps(json as OpsData);
      }
    } catch {
      /* les métriques temps réel ne bloquent pas l'historique */
    }
  }, []);

  React.useEffect(() => { load(); }, [load]);

  const totalSent = data?.summary.reduce((a, s) => a + s.totals.sent, 0) ?? 0;
  const totalDelivered = data?.summary.reduce((a, s) => a + s.totals.delivered, 0) ?? 0;
  const overallDelivery = totalSent > 0 ? totalDelivered / totalSent : 0;
  const alertCount = data?.summary.reduce((a, s) => a + (s.rates.bounceRate > 0.05 ? 1 : 0) + (s.rates.complaintRate > 0.001 ? 1 : 0), 0) ?? 0;

  return (
    <div className="min-h-screen bg-muted/30">
      <div className="mx-auto max-w-7xl w-full px-5 sm:px-8 py-8">
        <div className="flex items-center justify-between mb-6">
          <div>
            <div className="mono-label text-lime text-xs mb-1">HASHCODE · ADMIN</div>
            <h1 className="text-2xl font-bold text-foreground">Suivi délivrabilité email</h1>
            <p className="text-sm text-muted-foreground mt-1">Tous les systèmes de livraison des providers actifs : Resend &amp; Brevo</p>
          </div>
          <button
            onClick={load}
            disabled={loading}
            className="flex items-center gap-2 px-4 py-2 bg-lime text-black rounded-sm text-sm font-semibold hover:bg-lime/90 disabled:opacity-50 transition-colors"
          >
            <RefreshCw className={cn("size-4", loading && "animate-spin")} />
            Rafraîchir
          </button>
        </div>

        {error && (
          <div className="bg-red-500/10 border border-red-500/40 text-red-300 p-3 rounded-sm text-sm mb-4">
            Impossible de charger les métriques : {error}
          </div>
        )}

        {loading && !data && (
          <div className="flex items-center gap-2 text-muted-foreground text-sm">
            <RefreshCw className="size-4 animate-spin" /> Chargement des métriques...
          </div>
        )}

        {/* ── TEMPS RÉEL ──────────────────────────────────────────────────── */}
        {ops && (
          <div className="space-y-4 mb-6">
            <div className="flex items-center gap-2">
              <Activity className="size-4 text-lime" />
              <h2 className="font-semibold mono-label text-foreground">TEMPS RÉEL</h2>
              <span className="text-xs text-muted-foreground">
                {new Date(ops.generatedAt).toLocaleTimeString("fr-FR")}
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {ops.providers.map((p) => (
                <div key={p.provider} className="bg-card border border-border/60 p-4 rounded-sm">
                  <div className="flex items-center justify-between mb-2">
                    <div className="mono-label text-xs text-muted-foreground">{p.provider.toUpperCase()}</div>
                    <StatusBadge level={p.level} />
                  </div>
                  <div className="text-2xl font-bold text-foreground">
                    {p.used} <span className="text-sm font-normal text-muted-foreground">/ {p.cap}</span>
                  </div>
                  <div className="text-xs text-muted-foreground mt-1">
                    {p.remaining} restants · reset à{" "}
                    {new Date(p.resetsAt).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}
                  </div>
                  <div className="mt-2">
                    <RateBar value={p.ratio} label="Quota" />
                  </div>
                  {p.remainingBatches > 0 && (
                    <div className="mt-1 text-xs text-muted-foreground">
                      {p.remainingBatches} lot(s) de {ops.capacityBatchSize} restant(s)
                    </div>
                  )}
                </div>
              ))}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="bg-card border border-border/60 p-3 rounded-sm">
                <div className="mono-label text-xs text-muted-foreground mb-1">DÉBIT</div>
                <div className="text-lg font-bold text-foreground">{ops.throughput.sent}</div>
                <div className="text-xs text-muted-foreground">
                  envois sur les {ops.throughput.minutes} dernières minutes
                </div>
              </div>
              {ops.alerts.length > 0 && (
                <div className="bg-red-500/5 border border-red-500/30 p-3 rounded-sm">
                  <div className="flex items-center gap-1.5 mb-1">
                    <AlertTriangle className="size-3 text-red-400" />
                    <span className="mono-label text-xs text-red-400">ALERTES</span>
                  </div>
                  {ops.alerts.map((a, i) => (
                    <div key={i} className="text-xs text-red-300 mt-1">{a.message}</div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {data && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="bg-card border border-border/60 p-4 rounded-sm">
                <div className="mono-label text-xs text-muted-foreground mb-1">VOLUME ENVOYÉ</div>
                <div className="text-2xl font-bold text-foreground">{formatNumber(totalSent)}</div>
                <div className="text-xs text-muted-foreground mt-1">emails sur la période</div>
              </div>
              <div className="bg-card border border-border/60 p-4 rounded-sm">
                <div className="mono-label text-xs text-muted-foreground mb-1">TAUX DE DÉLIVRABILITÉ</div>
                <div className={cn("text-2xl font-bold", overallDelivery >= 0.95 ? "text-lime" : overallDelivery >= 0.85 ? "text-amber-500" : "text-red-400")}>
                  {formatPercent(overallDelivery)}
                </div>
                <div className="text-xs text-muted-foreground mt-1">{formatNumber(totalDelivered)} livrés</div>
              </div>
              <div className="bg-card border border-border/60 p-4 rounded-sm">
                <div className="mono-label text-xs text-muted-foreground mb-1">ALERTES CRITIQUES</div>
                <div className={cn("text-2xl font-bold", alertCount > 0 ? "text-red-400" : "text-lime")}>
                  {alertCount}
                </div>
                <div className="text-xs text-muted-foreground mt-1">
                  {alertCount > 0 ? "seuils dépassés" : "tous les seuils respectés"}
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {data.summary.map((provider) => (
                <div key={provider.provider} className="bg-card border border-border/60 p-4 rounded-sm">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <Mail className="size-4 text-lime" />
                      <h2 className="font-semibold text-foreground mono-label">{provider.provider.toUpperCase()}</h2>
                    </div>
                    <span className="text-xs text-muted-foreground">{provider.daysWithData} jours de données</span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mb-4">
                    <div>
                      <div className="text-xs text-muted-foreground">Livraison</div>
                      <div className="font-bold text-foreground">{formatPercent(provider.rates.deliveryRate)}</div>
                    </div>
                    <div>
                      <div className="text-xs text-muted-foreground">Ouverture</div>
                      <div className="font-bold text-foreground">{formatPercent(provider.rates.openRate)}</div>
                    </div>
                    <div>
                      <div className="text-xs text-muted-foreground">Clic</div>
                      <div className="font-bold text-foreground">{formatPercent(provider.rates.clickRate)}</div>
                    </div>
                    <div>
                      <div className="text-xs text-muted-foreground">Rebond</div>
                      <div className={cn("font-bold", provider.rates.bounceRate > 0.05 ? "text-red-400" : "text-foreground")}>
                        {formatPercent(provider.rates.bounceRate)}
                      </div>
                    </div>
                  </div>

                  <div className="space-y-3 mb-4">
                    <RateBar value={provider.rates.deliveryRate} label="Délivrabilité" />
                    <RateBar value={provider.rates.openRate} label="Taux d'ouverture" />
                    <RateBar value={provider.rates.clickRate} label="Taux de clic" />
                    <RateBar value={1 - provider.rates.bounceRate} label="Santé rebond" />
                  </div>

                  <div className="flex gap-4 border-t border-border/60 pt-3">
                    <TrendBadge value={provider.comparison.volumeChange} label="volume" />
                    <TrendBadge value={provider.comparison.deliveryChange} label="délivrance" />
                  </div>

                  <div className="mt-3 flex items-center gap-1.5 text-xs mono-label">
                    {alertCount > 0 ? <AlertTriangle className="size-3 text-red-400" /> : <CheckCircle2 className="size-3 text-lime" />}
                    {alertCount > 0 ? "Attention : un ou plusieurs seuils sont dépassés" : "Aucune alerte sur cette période"}
                  </div>
                </div>
              ))}
            </div>

            {data.chartData.map((chart) => (
              <div key={chart.provider} className="bg-card border border-border/60 p-4 rounded-sm">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="font-semibold mono-label text-foreground">HISTORIQUE — {chart.provider.toUpperCase()}</h3>
                  <span className="text-xs text-muted-foreground mono-label">
                    {data.dateRange.start} → {data.dateRange.end}
                  </span>
                </div>
                <div className="flex items-end gap-1 h-28 mb-2">
                  {chart.data.slice(-30).map((point, i) => {
                    const h = point.deliveryRate ? Math.max(8, point.deliveryRate * 100) : 8;
                    return (
                      <div key={point.date} className="flex-1" title={`${point.date} — ${formatPercent(point.deliveryRate)}%`}>
                        <div
                          className="bg-lime/70 hover:bg-lime rounded-sm transition-colors"
                          style={{ height: `${h}%` }}
                        />
                      </div>
                    );
                  })}
                </div>
                <div className="flex justify-between mono-label text-muted-foreground">
                  <span>{chart.data[0]?.date ?? ""}</span>
                  <span>Dernier point : {chart.data[chart.data.length - 1]?.date ?? ""}</span>
                </div>
              </div>
            ))}

            {crons.length > 0 && (
              <div className="bg-card border border-border/60 p-4 rounded-sm">
                <div className="flex items-center gap-2 mb-1">
                  <Activity className="size-4 text-lime" />
                  <h3 className="font-semibold mono-label text-foreground">SANTÉ DES CRONS</h3>
                </div>
                <p className="text-xs text-muted-foreground mb-3">
                  Dernier passage de chaque tâche planifiée. Un cron quotidien en alerte = cron-job.org à vérifier.
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                  {crons.map((c) => (
                    <div
                      key={c.key}
                      className={cn(
                        "rounded-sm border p-3",
                        c.status === "ok" && "border-lime/40 bg-lime/[0.04]",
                        c.status === "stale" && "border-red-500/40 bg-red-500/5",
                        (c.status === "never" || c.status === "manual") && "border-border/60 bg-card/40",
                      )}
                    >
                      <div className="flex items-center gap-1.5">
                        {c.status === "ok" ? (
                          <CheckCircle2 className="size-3.5 text-lime" />
                        ) : c.status === "stale" ? (
                          <AlertTriangle className="size-3.5 text-red-400" />
                        ) : (
                          <Activity className="size-3.5 text-muted-foreground" />
                        )}
                        <span className="text-sm font-medium text-foreground">{c.label}</span>
                      </div>
                      <div className="mt-1 text-xs text-muted-foreground mono-label">
                        {c.lastRun
                          ? `Dernier passage : ${new Date(c.lastRun).toLocaleString("fr-FR", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })}`
                          : "Jamais exécuté"}
                      </div>
                      {c.summary && (
                        <div className="mt-0.5 text-xs text-muted-foreground font-mono truncate" title={c.summary}>
                          {c.summary}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
