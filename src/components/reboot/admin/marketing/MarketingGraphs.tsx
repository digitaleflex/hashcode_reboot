"use client";

import * as React from "react";
import { MonoLabel } from "@/components/reboot/shared";
import { cn } from "@/lib/utils";
import { DonutChart, type DonutSegment } from "@/components/reboot/donut-chart";
import { Skeleton } from "@/components/ui/skeleton";
import { Mail, MailOpen, Pointer, UserCheck } from "lucide-react";
import type { EmailStatsData } from "@/components/reboot/admin/EmailEngagement";

export interface AudienceSplit {
  total: number;
  registered: number;
  invited: number;
}

export interface InviteStatusStats {
  total: number;
  NOT_INVITED: number;
  INVITED: number;
  ACCEPTED: number;
  REFUSED: number;
  BOUNCED: number;
  EXPIRED: number;
}

export interface InviteFunnel {
  accepted: number;
  approvedFromAccepted: number;
  joined: number;
  incompleteProfiles: number;
}

const CATEGORY_LABEL: Record<string, string> = {
  welcome: "Bienvenue",
  waitlist: "Waitlist",
  engagement: "Engagement",
  relance: "Relance",
  other: "Autre",
};

function pct(n: number, d: number): number {
  return d === 0 ? 0 : Math.round((n / d) * 100);
}

export function MarketingGraphs({
  emailStats,
  audience,
  inviteStats,
  funnel,
  loading,
}: {
  emailStats: EmailStatsData | null;
  audience: AudienceSplit | null;
  inviteStats: InviteStatusStats | null;
  funnel: InviteFunnel | null;
  loading: boolean;
}) {
  const hasAny = emailStats !== null || audience !== null || inviteStats !== null || funnel !== null;

  if (loading && !hasAny) {
    return (
      <section aria-label="Graphes marketing">
        <MonoLabel className="text-muted-foreground">Graphes & statistiques</MonoLabel>
        <div className="mt-3 grid grid-cols-2 sm:grid-cols-4 gap-2">
          {[0, 1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-20 w-full" />
          ))}
        </div>
        <div className="mt-2 grid grid-cols-1 lg:grid-cols-3 gap-2">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-36 w-full" />
          ))}
        </div>
      </section>
    );
  }

  if (!hasAny) return null;

  const sent = emailStats?.summary.totalSent ?? 0;
  const opened = emailStats?.summary.totalOpened ?? 0;
  const clicked = emailStats?.summary.totalClicked ?? 0;
  const invitedPool =
    (inviteStats?.INVITED ?? 0) +
    (inviteStats?.ACCEPTED ?? 0) +
    (inviteStats?.REFUSED ?? 0) +
    (inviteStats?.BOUNCED ?? 0) +
    (inviteStats?.EXPIRED ?? 0);

  const kpis = [
    { icon: <Mail className="size-4" />, label: "Emails envoyés", value: String(sent) },
    { icon: <MailOpen className="size-4" />, label: "Taux d'ouverture", value: `${pct(opened, sent)}%` },
    { icon: <Pointer className="size-4" />, label: "Taux de clic", value: `${pct(clicked, sent)}%` },
    {
      icon: <UserCheck className="size-4" />,
      label: "Acceptation invitations",
      value: `${pct(inviteStats?.ACCEPTED ?? 0, invitedPool)}%`,
    },
  ];

  const campaignSegments: DonutSegment[] = emailStats
    ? Object.keys(emailStats.byCategory)
        .filter((c) => emailStats.byCategory[c].sent > 0)
        .map((c) => ({ label: CATEGORY_LABEL[c] ?? c, value: emailStats.byCategory[c].sent }))
    : [];

  const audienceSegments: DonutSegment[] = audience
    ? [
        { label: "Inscrits réels", value: audience.registered, tone: "lime" as const },
        { label: "Invités", value: audience.invited, tone: "sky" as const },
      ]
    : [];

  const inviteSegments: DonutSegment[] = inviteStats
    ? (
        [
          { label: "Invités", value: inviteStats.INVITED, tone: "sky" as const },
          { label: "Acceptées", value: inviteStats.ACCEPTED, tone: "lime" as const },
          { label: "Refusées", value: inviteStats.REFUSED, tone: "amber" as const },
          { label: "Bounces", value: inviteStats.BOUNCED, tone: "muted" as const },
          { label: "Expirées", value: inviteStats.EXPIRED, tone: "muted" as const },
          { label: "Non invités", value: inviteStats.NOT_INVITED, tone: "muted" as const },
        ] satisfies DonutSegment[]
      ).filter((s) => s.value > 0)
    : [];

  return (
    <section aria-label="Graphes marketing" className="space-y-2">
      <MonoLabel className="text-muted-foreground">Graphes & statistiques</MonoLabel>

      {funnel && (
        <div className="rounded-md border border-border/60 bg-card/40 p-4">
          <MonoLabel className="text-muted-foreground">Entonnoir invitation</MonoLabel>
          <div className="mt-3 flex flex-col sm:flex-row sm:items-stretch gap-2">
            <FunnelStep label="Invités" value={invitedPool} tone="sky" />
            <FunnelArrow />
            <FunnelStep
              label="Acceptés"
              value={funnel.accepted}
              sub={invitedPool > 0 ? `${pct(funnel.accepted, invitedPool)}%` : undefined}
              tone="lime"
            />
            <FunnelArrow />
            <FunnelStep
              label="Approuvés"
              value={funnel.approvedFromAccepted}
              sub={funnel.accepted > 0 ? `${pct(funnel.approvedFromAccepted, funnel.accepted)}%` : undefined}
            />
            <FunnelArrow />
            <FunnelStep label="Rejoints" value={funnel.joined} tone="lime" />
          </div>
          {funnel.incompleteProfiles > 0 && (
            <p className="mt-3 text-xs text-amber-300">
              ⚠ {funnel.incompleteProfiles} profil(s) en attente de complétion (invités sans profil rempli).
            </p>
          )}
        </div>
      )}

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        {kpis.map((k) => (
          <div key={k.label} className="rounded-md border border-border/60 bg-card/60 p-3 text-center">
            <div className="flex items-center justify-center text-muted-foreground">{k.icon}</div>
            <div className="mt-1 text-xl font-bold tabular-nums text-foreground">{k.value}</div>
            <div className="text-[10px] text-muted-foreground uppercase tracking-wider">{k.label}</div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-2">
        {campaignSegments.length > 0 && (
          <div className="rounded-md border border-border/60 bg-card/40 p-4">
            <MonoLabel className="text-muted-foreground">Envoyés par campagne</MonoLabel>
            <div className="mt-3">
              <DonutChart segments={campaignSegments} centerValue={sent} centerLabel="emails" />
            </div>
          </div>
        )}
        {audienceSegments.length > 0 && (
          <div className="rounded-md border border-border/60 bg-card/40 p-4">
            <MonoLabel className="text-muted-foreground">Base contacts</MonoLabel>
            <div className="mt-3">
              <DonutChart
                segments={audienceSegments}
                centerValue={audience?.total ?? 0}
                centerLabel="contacts"
              />
            </div>
          </div>
        )}
        {inviteSegments.length > 0 && (
          <div className="rounded-md border border-border/60 bg-card/40 p-4">
            <MonoLabel className="text-muted-foreground">Invitations par statut</MonoLabel>
            <div className="mt-3">
              <DonutChart
                segments={inviteSegments}
                centerValue={inviteStats?.total ?? 0}
                centerLabel="invitations"
              />
            </div>
          </div>
        )}
      </div>
    </section>
  );
}

function FunnelStep({
  label,
  value,
  sub,
  tone,
}: {
  label: string;
  value: number;
  sub?: string;
  tone?: "lime" | "sky";
}) {
  return (
    <div
      className={cn(
        "flex-1 rounded-md border p-3 text-center",
        tone === "lime"
          ? "border-lime/40 bg-lime/[0.05]"
          : tone === "sky"
            ? "border-sky-400/40 bg-sky-400/5"
            : "border-border/60 bg-card/60",
      )}
    >
      <div
        className={cn(
          "text-xl font-bold tabular-nums",
          tone === "lime" ? "text-lime" : tone === "sky" ? "text-sky-300" : "text-foreground",
        )}
      >
        {value}
      </div>
      <div className="mt-0.5 text-[10px] text-muted-foreground uppercase tracking-wider">{label}</div>
      {sub && <div className="mt-0.5 text-[11px] mono-label text-lime">{sub}</div>}
    </div>
  );
}

function FunnelArrow() {
  return (
    <div className="flex items-center justify-center text-border shrink-0" aria-hidden>
      <span className="text-lg sm:-rotate-90">↓</span>
    </div>
  );
}
