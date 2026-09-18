"use client";

import * as React from "react";
import { Card } from "@/components/reboot/shared";
import { MonoLabel } from "@/components/reboot/shared";
import { cn } from "@/lib/utils";
import {
  AlertTriangle,
  CheckCircle2,
  Clock,
  Mail,
  Users,
} from "lucide-react";

export interface HealthAlert {
  level: "info" | "warn" | "critical";
  icon: React.ReactNode;
  message: string;
  action?: { label: string; href?: string; onClick?: () => void };
}

interface HealthAlertsBannerProps {
  pendingCount: number;
  cronHealth: CronHealthItem[] | null;
  emailOpsAlerts: EmailOpsAlert[] | null;
  deliverabilityAlerts: { provider: string; bounceRate: number; complaintRate: number }[];
  onQueueClick?: () => void;
  onCronsClick?: () => void;
}

interface CronHealthItem {
  key: string;
  label: string;
  status: "ok" | "stale" | "never" | "manual";
}

interface EmailOpsAlert {
  level: string;
  provider?: string;
  message: string;
}

function formatNumber(value: number): string {
  return new Intl.NumberFormat("fr-FR").format(value);
}

/**
 * Bannière combinée d'alertes système — agrège pending approvals, crons stale,
 * email ops alerts et délivrabilité. Une section avertit sans bloquer le reste.
 */
export function HealthAlertsBanner({
  pendingCount,
  cronHealth,
  emailOpsAlerts,
  deliverabilityAlerts,
  onQueueClick,
  onCronsClick,
}: HealthAlertsBannerProps) {
  const alerts: HealthAlert[] = [];

  // 1. Pending approvals
  if (pendingCount > 0) {
    const urgent = pendingCount > 50;
    alerts.push({
      level: urgent ? "critical" : "warn",
      icon: <Users className={cn("size-4 shrink-0", urgent ? "text-destructive" : "text-amber-400")} />,
      message: `${formatNumber(pendingCount)} membre${pendingCount > 1 ? "s" : ""} en attente de validation.`,
      action: { label: "Voir la file", onClick: onQueueClick },
    });
  }

  // 2. Stale crons
  if (cronHealth) {
    const staleCrons = cronHealth.filter((c) => c.status === "stale" || c.status === "never");
    if (staleCrons.length > 0) {
      alerts.push({
        level: "critical",
        icon: <Clock className="size-4 shrink-0 text-destructive" />,
        message: `${staleCrons.length} tâche${staleCrons.length > 1 ? "s" : ""} planifiée${staleCrons.length > 1 ? "s" : ""} en alerte.`,
        action: { label: "Vérifier les crons", onClick: onCronsClick },
      });
    }
  }

  // 3. Email ops alerts
  if (emailOpsAlerts && emailOpsAlerts.length > 0) {
    const critical = emailOpsAlerts.filter((a) => a.level === "critical");
    alerts.push({
      level: critical.length > 0 ? "critical" : "warn",
      icon: <Mail className="size-4 shrink-0 text-destructive" />,
      message: `${emailOpsAlerts.length} alerte${emailOpsAlerts.length > 1 ? "s" : ""} d'envoi email.`,
    });
  }

  // 4. Deliverability issues (high bounce/complaint rates)
  if (deliverabilityAlerts && deliverabilityAlerts.length > 0) {
    for (const alert of deliverabilityAlerts) {
      const issues: string[] = [];
      if (alert.bounceRate > 0.05) issues.push(`rebond ${Math.round(alert.bounceRate * 100)}%`);
      if (alert.complaintRate > 0.001) issues.push(`réclamation ${Math.round(alert.complaintRate * 1000)}‰`);
      if (issues.length > 0) {
        alerts.push({
          level: "warn",
          icon: <AlertTriangle className="size-4 shrink-0 text-destructive" />,
          message: `${alert.provider} : ${issues.join(", ")}`,
        });
      }
    }
  }

  if (alerts.length === 0) {
    return (
      <Card className="p-3 sm:p-4 flex items-center gap-3">
        <CheckCircle2 className="size-5 text-lime shrink-0" />
        <span className="text-sm text-foreground">
          <strong className="font-semibold">Tout roule</strong>
          <span className="text-muted-foreground"> — aucune alerte active.</span>
        </span>
      </Card>
    );
  }

  return (
    <div className="space-y-2">
      {alerts.slice(0, 5).map((alert, i) => {
        const isCritical = alert.level === "critical";
        return (
          <div
            key={i}
            className={cn(
              "rounded-md border p-3 sm:p-4 flex items-start gap-3 transition-colors",
              isCritical
                ? "border-destructive/40 bg-destructive/5"
                : "border-amber-500/40 bg-amber-500/5",
            )}
            role="status"
          >
            {alert.icon}
            <div className="flex-1 min-w-0">
              <p className="text-sm text-foreground">{alert.message}</p>
              {alert.action && (
                <button
                  onClick={alert.action.onClick}
                  className={cn(
                    "mt-1 text-xs px-2.5 py-1 rounded border transition-colors",
                    isCritical
                      ? "border-border bg-card hover:border-destructive/40 text-destructive"
                      : "border-border bg-card hover:border-amber-400/40 text-amber-300",
                  )}
                >
                  {alert.action.label}
                </button>
              )}
            </div>
          </div>
        );
      })}
      {alerts.length > 5 && (
        <p className="text-xs text-muted-foreground mono-label">
          + {alerts.length - 5} alerte{alerts.length - 5 > 1 ? "s" : ""} supplémentaire{alerts.length - 5 > 1 ? "s" : ""}
        </p>
      )}
    </div>
  );
}
