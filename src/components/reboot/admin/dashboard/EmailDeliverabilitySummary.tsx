"use client";

import { cn } from "@/lib/utils";
import { Skeleton } from "@/components/ui/skeleton";
import { MonoLabel } from "@/components/reboot/shared";
import { Card } from "@/components/reboot/shared";
import { Mail, TrendingUp, TrendingDown } from "lucide-react";

export interface DeliverabilityProviderSummary {
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

/**
 * Version condensée de la délivrabilité email pour le dashboard 360°.
 * Affiche les summary cards + les provider-level rate bars, sans les
 * graphiques historiques détaillés (réservés à la page /admin/email-deliverability).
 */
export function EmailDeliverabilitySummary({
  summary,
}: {
  summary: DeliverabilityProviderSummary[] | null;
}) {
  if (!summary || summary.length === 0) return null;

  const totalSent = summary.reduce((a, s) => a + s.totals.sent, 0);
  const totalDelivered = summary.reduce((a, s) => a + s.totals.delivered, 0);
  const overallDelivery = totalSent > 0 ? totalDelivered / totalSent : 0;
  const alertCount = summary.reduce(
    (a, s) => a + (s.rates.bounceRate > 0.05 ? 1 : 0) + (s.rates.complaintRate > 0.001 ? 1 : 0),
    0,
  );

  return (
    <section className="mt-6">
      <MonoLabel className="text-muted-foreground">DÉLIVRABILITÉ EMAIL (30j)</MonoLabel>

      <div className="mt-3 grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card className="p-4">
          <MonoLabel className="text-xs text-muted-foreground mb-1 block">
            VOLUME ENVOYÉ
          </MonoLabel>
          <div className="text-2xl font-bold text-foreground">
            {formatNumber(totalSent)}
          </div>
          <div className="text-xs text-muted-foreground mt-1">
            emails sur la période
          </div>
        </Card>

        <Card className="p-4">
          <MonoLabel className="text-xs text-muted-foreground mb-1 block">
            TAUX DE DÉLIVRABILITÉ
          </MonoLabel>
          <div
            className={cn(
              "text-2xl font-bold",
              overallDelivery >= 0.95 ? "text-lime" : overallDelivery >= 0.85 ? "text-amber-500" : "text-red-400",
            )}
          >
            {formatPercent(overallDelivery)}
          </div>
          <div className="text-xs text-muted-foreground mt-1">
            {formatNumber(totalDelivered)} livrés
          </div>
        </Card>

        <Card className="p-4">
          <MonoLabel className="text-xs text-muted-foreground mb-1 block">
            ALERTES CRITIQUES
          </MonoLabel>
          <div
            className={cn(
              "text-2xl font-bold",
              alertCount > 0 ? "text-red-400" : "text-lime",
            )}
          >
            {alertCount}
          </div>
          <div className="text-xs text-muted-foreground mt-1">
            {alertCount > 0 ? "seuils dépassés" : "tous les seuils respectés"}
          </div>
        </Card>
      </div>

      {/* Provider breakdown — condensed */}
      <div className="mt-4 grid grid-cols-1 lg:grid-cols-2 gap-4">
        {summary.map((provider) => (
          <Card key={provider.provider} className="p-4">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <Mail className="size-4 text-lime" />
                <h3 className="font-semibold text-foreground mono-label">
                  {provider.provider.toUpperCase()}
                </h3>
              </div>
              <span className="text-xs text-muted-foreground mono-label">
                {provider.daysWithData} jours de données
              </span>
            </div>

            <div className="grid grid-cols-2 gap-2 mb-3">
              <div>
                <div className="text-xs text-muted-foreground">Livraison</div>
                <div className="font-bold text-foreground">
                  {formatPercent(provider.rates.deliveryRate)}
                </div>
              </div>
              <div>
                <div className="text-xs text-muted-foreground">Ouverture</div>
                <div className="font-bold text-foreground">
                  {formatPercent(provider.rates.openRate)}
                </div>
              </div>
              <div>
                <div className="text-xs text-muted-foreground">Clic</div>
                <div className="font-bold text-foreground">
                  {formatPercent(provider.rates.clickRate)}
                </div>
              </div>
              <div>
                <div className="text-xs text-muted-foreground">Rebond</div>
                <div
                  className={cn(
                    "font-bold",
                    provider.rates.bounceRate > 0.05 ? "text-red-400" : "text-foreground",
                  )}
                >
                  {formatPercent(provider.rates.bounceRate)}
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <RateBar value={provider.rates.deliveryRate} label="Délivrabilité" />
              <RateBar value={provider.rates.openRate} label="Taux d'ouverture" />
              <RateBar value={provider.rates.clickRate} label="Taux de clic" />
              <RateBar value={1 - provider.rates.bounceRate} label="Santé rebond" />
            </div>

            <div className="mt-3 flex items-center gap-4 border-t border-border/60 pt-2">
              <TrendBadge value={provider.comparison.volumeChange} label="volume" />
              <TrendBadge value={provider.comparison.deliveryChange} label="délivrance" />
            </div>
          </Card>
        ))}
      </div>
    </section>
  );
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
            "h-full rounded-sm transition-all duration-500",
            good ? "bg-lime" : warn ? "bg-amber-500" : "bg-red-500",
          )}
          style={{ width: `${width}%` }}
        />
      </div>
    </div>
  );
}

function TrendBadge({ value, label }: { value: number; label: string }) {
  const up = value >= 0;
  return (
    <div
      className={cn(
        "flex items-center gap-1 text-xs mono-label",
        up ? "text-lime" : "text-red-400",
      )}
    >
      {up ? <TrendingUp className="size-3" /> : <TrendingDown className="size-3" />}
      {formatDelta(value)} {label}
    </div>
  );
}
