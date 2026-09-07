"use client";

import * as React from "react";
import { MonoLabel } from "../shared";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { Mail, MailOpen, Pointer, UserCheck, ArrowDown } from "lucide-react";

export interface EmailStatsData {
  summary: { totalSent: number; totalOpened: number; totalClicked: number };
  byCategory: Record<string, { sent: number; opened: number; clicked: number }>;
  relance: {
    drafts: number;
    relanceSent: number;
    relanceOpened: number;
    relanceClicked: number;
    recovered: number;
  };
}

const CATEGORY_LABEL: Record<string, string> = {
  welcome: "Bienvenue",
  waitlist: "Waitlist",
  engagement: "Engagement",
  relance: "Relance",
  other: "Autre",
};

export function EmailEngagement({
  data,
  loading,
}: {
  data: EmailStatsData | null;
  loading: boolean;
}) {
  if (loading && !data) {
    return (
      <section className="mt-6">
        <MonoLabel className="text-muted-foreground">Emails & relance</MonoLabel>
        <div className="mt-3 rounded-md border border-border/60 bg-card/40 p-4 sm:p-5 space-y-3">
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-8 w-full" />
          <Skeleton className="h-8 w-full" />
        </div>
      </section>
    );
  }

  if (!data) return null;

  const categories = Object.keys(data.byCategory).filter(
    (c) => data.byCategory[c].sent > 0,
  );
  const hasRelance = data.relance.relanceSent > 0;
  const hasEmails = data.summary.totalSent > 0;
  if (!hasEmails && !hasRelance && data.relance.drafts === 0) return null;

  return (
    <section className="mt-6">
      <MonoLabel className="text-muted-foreground">Emails & relance</MonoLabel>

      {hasEmails && (
        <div className="mt-3 rounded-md border border-border/60 bg-card/40 p-4 sm:p-5">
          <div className="grid grid-cols-3 gap-2 mb-4">
            <SummaryCard icon={<Mail className="size-4" />} label="Envoyés" value={data.summary.totalSent} />
            <SummaryCard icon={<MailOpen className="size-4" />} label="Ouverts" value={data.summary.totalOpened} />
            <SummaryCard icon={<Pointer className="size-4" />} label="Cliqués" value={data.summary.totalClicked} />
          </div>

          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border/60">
                <th className="text-left py-2 pr-3 font-mono text-[10px] uppercase tracking-wider text-muted-foreground">Campagne</th>
                <th className="text-right py-2 px-3 font-mono text-[10px] uppercase tracking-wider text-muted-foreground">Envoyés</th>
                <th className="text-right py-2 px-3 font-mono text-[10px] uppercase tracking-wider text-muted-foreground">Ouverts</th>
                <th className="text-right py-2 pl-3 font-mono text-[10px] uppercase tracking-wider text-muted-foreground">Clics</th>
              </tr>
            </thead>
            <tbody>
              {categories.map((cat) => {
                const c = data.byCategory[cat];
                const openRate = c.sent === 0 ? 0 : Math.round((c.opened / c.sent) * 100);
                return (
                  <tr key={cat} className="border-b border-border/40 last:border-0">
                    <td className="py-2.5 pr-3 text-foreground">{CATEGORY_LABEL[cat] ?? cat}</td>
                    <td className="py-2.5 px-3 text-right tabular-nums text-muted-foreground">{c.sent}</td>
                    <td className="py-2.5 px-3 text-right tabular-nums text-muted-foreground">
                      {c.opened}
                      {c.sent > 0 && (
                        <span className="ml-1.5 text-[10px]">{openRate}%</span>
                      )}
                    </td>
                    <td className="py-2.5 pl-3 text-right tabular-nums text-muted-foreground">{c.clicked}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {hasRelance && (
        <div className="mt-3 rounded-md border border-lime/25 bg-lime/[0.03] p-4 sm:p-5">
          <div className="flex items-center gap-2 mb-3">
            <MonoLabel className="text-lime">Relance des abandons</MonoLabel>
          </div>
          <div className="flex flex-col sm:flex-row sm:items-stretch gap-2">
            <RelanceStep label="Brouillons abandonnés" value={data.relance.drafts} />
            <ArrowConnector />
            <RelanceStep label="Relances envoyées" value={data.relance.relanceSent} />
            <ArrowConnector />
            <RelanceStep label="Ouvertes" value={data.relance.relanceOpened} />
            <ArrowConnector />
            <RelanceStep label="Clics" value={data.relance.relanceClicked} />
            <ArrowConnector />
            <RelanceStep label="Profil repris" value={data.relance.recovered} tone="lime" />
          </div>
          {data.relance.recovered > 0 && data.relance.relanceSent > 0 && (
            <p className="mt-3 text-xs text-muted-foreground text-center">
              <strong className="text-lime tabular-nums">
                {Math.round((data.relance.recovered / data.relance.relanceSent) * 100)}%
              </strong>{" "}
              des relances converties en profil complété.
            </p>
          )}
        </div>
      )}
    </section>
  );
}

function SummaryCard({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: number;
}) {
  return (
    <div className="rounded-md border border-border/60 bg-card/60 p-3 text-center">
      <div className="flex items-center justify-center text-muted-foreground">{icon}</div>
      <div className="mt-1 text-xl font-bold tabular-nums text-foreground">{value}</div>
      <div className="text-[10px] text-muted-foreground uppercase tracking-wider">{label}</div>
    </div>
  );
}

function RelanceStep({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone?: "lime";
}) {
  return (
    <div
      className={cn(
        "flex-1 rounded-md border p-3.5 text-center",
        tone === "lime" ? "border-lime/40 bg-lime/[0.05]" : "border-border/60 bg-card/60",
      )}
    >
      <div
        className={cn(
          "text-xl font-bold tabular-nums",
          tone === "lime" ? "text-lime" : "text-foreground",
        )}
      >
        {value}
      </div>
      <div className="mt-0.5 text-[10px] text-muted-foreground uppercase tracking-wider">{label}</div>
    </div>
  );
}

function ArrowConnector() {
  return (
    <div className="flex items-center justify-center text-border shrink-0">
      <ArrowDown className="size-4 sm:rotate-0 sm:-rotate-90" aria-hidden />
    </div>
  );
}