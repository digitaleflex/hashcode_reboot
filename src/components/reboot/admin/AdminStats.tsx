"use client";

import * as React from "react";
import { MonoLabel } from "../shared";
import { DonutChart } from "../donut-chart";
import { cn } from "@/lib/utils";
import { countryFlag, countryName } from "@/lib/profiling/countries";
import { CheckCircle2, ChevronRight, Clock, XCircle, Users } from "lucide-react";

export interface Stats {
  totals: {
    total: number;
    approved: number;
    pending: number;
    waitlist: number;
    rejected: number;
  };
  domains: { web: number; cyber: number; ai: number };
  mentoring: number;
  byCountry: { country: string; count: number }[];
  byLevel: { level: string; count: number }[];
  byAvailability: { availability: string; count: number }[];
  byBudget: { budget: string; count: number }[];
  byArchetype: { archetype: string; count: number }[];
  // Comparison mode fields
  previous?: {
    totals: {
      total: number;
      approved: number;
      pending: number;
      waitlist: number;
      rejected: number;
    };
    domains: { web: number; cyber: number; ai: number };
    mentoring: number;
    byCountry: { country: string; count: number }[];
    byLevel: { level: string; count: number }[];
    byAvailability: { availability: string; count: number }[];
    byBudget: { budget: string; count: number }[];
    byArchetype: { archetype: string; count: number }[];
  };
  change?: {
    totalPct: number;
    approvedPct: number;
    pendingPct: number;
    waitlistPct: number;
    rejectedPct: number;
  };
}

export interface FunnelData {
  events: { type: string; count: number }[];
  funnel: {
    sessionsStarted: number;
    sessionsCompleted: number;
    whatsappClicks: number;
    completionRate: number;
  };
  // Comparison mode fields
  previous?: {
    events: { type: string; count: number }[];
    funnel: {
      sessionsStarted: number;
      sessionsCompleted: number;
      whatsappClicks: number;
      completionRate: number;
    };
  };
  change?: {
    totalPct: number;
    startedPct: number;
    completedPct: number;
    whatsappPct: number;
    completionRatePct: number;
  };
}

const LEVEL_LABEL: Record<string, string> = {
  beginner: "Débutant",
  practicing: "Pratique",
  autonomous: "Autonome",
  advanced: "Avancé",
};

const BUDGET_LABEL: Record<string, string> = {
  "<2500": "< 2.5k",
  "2500-5000": "2.5–5k",
  "5000-10000": "5–10k",
  "10000-20000": "10–20k",
  "20000-30000": "20–30k",
  ">30000": "> 30k",
  unknown: "NSP",
};

export function AdminStatsSkeleton() {
  return (
    <div aria-hidden className="space-y-6">
      <div>
        <div className="admin-skeleton admin-skeleton-line w-28" />
        <div className="mt-3 grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-px bg-border/60 border border-border/60 rounded-md overflow-hidden">
          {Array.from({ length: 7 }).map((_, i) => (
            <div key={i} className="bg-card p-4 sm:p-5">
              <div className="admin-skeleton admin-skeleton-line w-16" />
              <div className="admin-skeleton admin-skeleton-value w-12 mt-2" />
            </div>
          ))}
        </div>
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {Array.from({ length: 3 }).map((_, i) => (
          <div
            key={i}
            className="rounded-md border border-border/60 bg-card p-4 sm:p-5"
          >
            <div className="admin-skeleton admin-skeleton-line w-24" />
            <div className="mt-4 space-y-2.5">
              {Array.from({ length: 4 }).map((_, j) => (
                <div key={j} className="admin-skeleton admin-skeleton-row" />
              ))}
            </div>
          </div>
        ))}
      </div>
      <span className="sr-only">Chargement des statistiques…</span>
    </div>
  );
}

export function AdminStats({
  stats,
  funnel,
  loading,
  onFilter,
  onClearFilters,
  compare = false,
  period = "month",
}: {
  stats?: Stats | null;
  funnel?: FunnelData | null;
  loading?: boolean;
  onFilter: (key: string, value: string) => void;
  onClearFilters: () => void;
  compare?: boolean;
  period?: "week" | "month";
}) {
  if (loading && !stats && !funnel) return <AdminStatsSkeleton />;
  
  // Compare mode: display current vs previous with delta percentages
  if (compare) {
    return (
      <section>
        <MonoLabel className="text-muted-foreground">Comparaison N/N-1</MonoLabel>
        <div className="mt-3 grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-px bg-border/60 border border-border/60 rounded-md overflow-hidden">
          {/* Current period card */}
          <div className="col-span-1 sm:col-span-2 bg-card p-4 sm:p-5 rounded-md border border-border">
            <MonoLabel className="text-sm text-muted-foreground">Current</MonoLabel>
            <div className="mt-2 font-display font-bold text-2xl sm:text-3xl text-foreground animate-hash-roll tabular-nums admin-num">
              {stats?.totals.total ?? "—"}
            </div>
            <MonoLabel className="text-xs text-muted-foreground">membres</MonoLabel>
            <div className="mt-2 text-lime font-bold text-lg sm:text-xl">
              +{((stats?.change?.totalPct ?? 0) + "%")}
            </div>
          </div>
          {/* Previous period card */}
          <div className="col-span-1 sm:col-span-2 bg-card p-4 sm:p-5 rounded-md border border-border mt-4 sm:mt-0">
            <MonoLabel className="text-sm text-muted-foreground">Previous</MonoLabel>
            <div className="mt-2 font-display font-bold text-2xl sm:text-3xl text-foreground animate-hash-roll tabular-nums admin-num">
              {stats?.previous?.totals.total ?? "—"}
            </div>
            <MonoLabel className="text-xs text-muted-foreground">membres</MonoLabel>
            <div className="mt-2 text-secondary font-bold text-lg sm:text-xl">
              -{Math.abs((stats?.change?.totalPct ?? 0))}%
            </div>
          </div>
          {/* Stats cards unchanged */}
          <StatCard
            icon={<Users className="size-4" />}
            label="Inscrits"
            value={stats?.totals.total ?? "—"}
            onClick={onClearFilters}
          />
          <StatCard
            icon={<CheckCircle2 className="size-4 text-lime" />}
            label="Validés"
            value={stats?.totals.approved ?? "—"}
            tone="lime"
            onClick={() => onFilter("status", "APPROVED")}
          />
          <StatCard
            icon={<Clock className="size-4" />}
            label="En attente"
            value={stats?.totals.pending ?? "—"}
            onClick={() => onFilter("status", "PENDING")}
          />
          <StatCard
            icon={<XCircle className="size-4" />}
            label="Waitlist"
            value={stats?.totals.waitlist ?? "—"}
            onClick={() => onFilter("status", "WAITLIST")}
          />
          <StatCard
            label="Web"
            value={stats?.domains.web ?? "—"}
            onClick={() => onFilter("domain", "web")}
          />
          <StatCard
            label="Cyber"
            value={stats?.domains.cyber ?? "—"}
            onClick={() => onFilter("domain", "cybersecurity")}
          />
          <StatCard
            label="AI"
            value={stats?.domains.ai ?? "—"}
            onClick={() => onFilter("domain", "ai")}
          />
        </div>
      </section>
    );
  }

  // Original behavior when not comparing
  return (
    <>
      {/* Stat overview */}
      <section>
        <MonoLabel className="text-muted-foreground">Vue d&apos;ensemble</MonoLabel>
        <div className="mt-3 grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-px bg-border/60 border border-border/60 rounded-md overflow-hidden">
          <StatCard
            icon={<Users className="size-4" />}
            label="Inscrits"
            value={stats?.totals.total ?? "—"}
            onClick={onClearFilters}
          />
          <StatCard
            icon={<CheckCircle2 className="size-4 text-lime" />}
            label="Validés"
            value={stats?.totals.approved ?? "—"}
            tone="lime"
            onClick={() => onFilter("status", "APPROVED")}
          />
          <StatCard
            icon={<Clock className="size-4" />}
            label="En attente"
            value={stats?.totals.pending ?? "—"}
            onClick={() => onFilter("status", "PENDING")}
          />
          <StatCard
            icon={<XCircle className="size-4" />}
            label="Waitlist"
            value={stats?.totals.waitlist ?? "—"}
            onClick={() => onFilter("status", "WAITLIST")}
          />
          <StatCard
            label="Web"
            value={stats?.domains.web ?? "—"}
            onClick={() => onFilter("domain", "web")}
          />
          <StatCard
            label="Cyber"
            value={stats?.domains.cyber ?? "—"}
            onClick={() => onFilter("domain", "cybersecurity")}
          />
          <StatCard
            label="AI"
            value={stats?.domains.ai ?? "—"}
            onClick={() => onFilter("domain", "ai")}
          />
        </div>
      </section>

      {/* Domain distribution donut + breakdowns */}
      <section className="mt-6 grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="rounded-md border border-border/60 bg-card p-4 sm:p-5">
          <div className="flex items-center justify-between">
            <MonoLabel className="text-muted-foreground">Par domaine</MonoLabel>
            <span className="mono-label text-muted-foreground">
              {stats ? stats.domains.web + stats.domains.cyber + stats.domains.ai : 0}
            </span>
          </div>
          <div className="mt-4">
            {stats ? (
              <DonutChart
                segments={[
                  { label: "Web Development", value: stats.domains.web },
                  { label: "Cybersecurity", value: stats.domains.cyber },
                  { label: "Applied AI", value: stats.domains.ai },
                ]}
                centerValue={stats.domains.web + stats.domains.cyber + stats.domains.ai}
                centerLabel="membres"
              />
            ) : (
              <p className="text-xs text-muted-foreground">Aucune donnée.</p>
            )}
          </div>
        </div>
        <Breakdown
          title="Par pays"
          rows={(stats?.byCountry ?? []).map((c) => [
            `${countryFlag(c.country)} ${countryName(c.country)}`,
            c.count,
          ])}
        />
        <Breakdown
          title="Par niveau"
          rows={(stats?.byLevel ?? []).map((l) => [
            LEVEL_LABEL[l.level] ?? l.level,
            l.count,
          ])}
        />
      </section>

      {/* Breakdowns (budget) — full width */}
      <section className="mt-4 grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Breakdown
          title="Par budget"
          rows={(stats?.byBudget ?? []).map((b) => [
            BUDGET_LABEL[b.budget] ?? b.budget ?? "—",
            b.count,
          ])}
        />
        <div className="rounded-md border border-border/60 bg-card p-4 sm:p-5">
          <div className="flex items-center justify-between">
            <MonoLabel className="text-muted-foreground">Par archétype</MonoLabel>
            <span className="mono-label text-muted-foreground">
              {stats?.byArchetype.length ?? 0}
            </span>
          </div>
          <div className="mt-3 space-y-2">
            {(stats?.byArchetype ?? []).length === 0 && (
              <p className="text-xs text-muted-foreground">Aucune donnée.</p>
            )}
            {(stats?.byArchetype ?? []).map((a) => {
              const total =
                (stats?.byArchetype ?? []).reduce((s, x) => s + x.count, 0) || 1;
              const pct = Math.round((a.count / total) * 100);
              return (
                <div key={a.archetype} className="group flex items-center gap-3">
                  <span className="text-xs text-foreground truncate w-32 font-mono">
                    {a.archetype}
                  </span>
                  <div className="flex-1 h-1.5 rounded-full bg-secondary overflow-hidden">
                    <div
                      className="h-full rounded-full bg-lime/70 transition-all duration-300 group-hover:bg-lime"
                      style={{
                        width: `${(a.count / Math.max(1, Math.max(...(stats?.byArchetype ?? []).map((x) => x.count)))) * 100}%`,
                      }}
                    />
                  </div>
                  <span className="mono-label text-muted-foreground w-12 text-right tabular-nums">
                    {a.count} · {pct}%
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* Funnel analytics — connected steps with arrows */}
      <section className="mt-6">
        <div className="flex items-center justify-between mb-3">
          <MonoLabel className="text-muted-foreground">Funnel</MonoLabel>
          <span className="mono-label text-muted-foreground">
            {funnel?.funnel.completionRate ?? 0}% complétion
          </span>
        </div>
        <div className="rounded-md border border-border/60 bg-card/40 p-4 sm:p-5">
          {loading && !funnel ? (
            <div
              aria-hidden
              className="flex flex-col sm:flex-row sm:items-stretch gap-2"
            >
              {Array.from({ length: 4 }).map((_, i) => (
                <div
                  key={i}
                  className="flex-1 rounded-md border border-border/60 bg-card p-3.5"
                >
                  <div className="admin-skeleton admin-skeleton-line w-20" />
                  <div className="admin-skeleton admin-skeleton-value w-14 mt-2" />
                </div>
              ))}
            </div>
          ) : funnel ? (
            <div className="flex flex-col sm:flex-row sm:items-stretch gap-2">
              <FunnelStep
                label="Sessions démarrées"
                value={funnel.funnel.sessionsStarted}
                className="flex-1"
              />
              <FunnelConnector />
              <FunnelStep
                label="Profils complétés"
                value={funnel.funnel.sessionsCompleted}
                className="flex-1"
              />
              <FunnelConnector />
              <FunnelStep
                label="Clics WhatsApp"
                value={funnel.funnel.whatsappClicks}
                className="flex-1"
              />
              <FunnelConnector />
              <FunnelStep
                label="Taux de complétion"
                value={`${funnel.funnel.completionRate}%`}
                tone="lime"
                className="flex-1"
              />
            </div>
          ) : (
            <p className="text-xs text-muted-foreground">
              Aucune donnée analytics pour l&apos;instant.
            </p>
          )}
        </div>
      </section>
    </>
  );
}

function StatCard({
  label,
  value,
  icon,
  tone,
  onClick,
}: {
  label: string;
  value: number | string;
  icon?: React.ReactNode;
  tone?: "lime";
  onClick?: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={!onClick}
      className={cn(
        "bg-card p-4 sm:p-5 relative overflow-hidden text-left",
        "transition-colors duration-180",
        onClick && "cursor-pointer hover:bg-elevated/60",
        tone === "lime" && "bg-lime/[0.04]",
        !onClick && "cursor-default",
      )}
    >
      {tone === "lime" && (
        <div
          className="absolute top-0 left-0 right-0 h-px bg-lime/60"
          aria-hidden
        />
      )}
      <div className="flex items-center gap-1.5">
        {icon}
        <MonoLabel className="text-muted-foreground">{label}</MonoLabel>
      </div>
      <div className="mt-2 font-display font-bold text-2xl sm:text-3xl text-foreground animate-hash-roll tabular-nums admin-num">
        {value}
      </div>
    </button>
  );
}

function Breakdown({
  title,
  rows,
}: {
  title: string;
  rows: [string, number][];
}) {
  const max = Math.max(1, ...rows.map((r) => r[1]));
  const total = rows.reduce((s, r) => s + r[1], 0);
  return (
    <div className="rounded-md border border-border/60 bg-card p-4 sm:p-5">
      <div className="flex items-center justify-between">
        <MonoLabel className="text-muted-foreground">{title}</MonoLabel>
        <span className="mono-label text-muted-foreground">{total}</span>
      </div>
      <div className="mt-3 space-y-2.5">
        {rows.length === 0 && (
          <p className="text-xs text-muted-foreground">Aucune donnée.</p>
        )}
        {rows.slice(0, 8).map(([label, count]) => {
          const pct = Math.round((count / total) * 100) || 0;
          return (
            <div key={label} className="group flex items-center gap-3">
              <span className="text-xs text-foreground truncate w-24 sm:w-32">
                {label}
              </span>
              <div className="flex-1 h-1.5 rounded-full bg-secondary overflow-hidden">
                <div
                  className="h-full rounded-full bg-lime/70 transition-all duration-300 group-hover:bg-lime"
                  style={{ width: `${(count / max) * 100}%` }}
                />
              </div>
              <span className="mono-label text-muted-foreground w-12 text-right tabular-nums">
                {count}
                <span className="opacity-50 ml-1">{pct}%</span>
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function FunnelStep({
  label,
  value,
  tone,
  className,
}: {
  label: string;
  value: number | string;
  tone?: "lime";
  className?: string;
}) {
  return (
    <div
      className={cn(
        "rounded-md border p-3.5 flex flex-col gap-1.5",
        tone === "lime"
          ? "border-lime/40 bg-lime/[0.04]"
          : "border-border/60 bg-card",
        className,
      )}
    >
      <MonoLabel className="text-muted-foreground">{label}</MonoLabel>
      <div
        className={cn(
          "font-display font-bold text-2xl sm:text-3xl tabular-nums admin-num animate-hash-roll",
          tone === "lime" ? "text-lime" : "text-foreground",
        )}
      >
        {value}
      </div>
    </div>
  );
}

/** Visual connector between funnel steps — animated chevron, hidden on narrow. */
function FunnelConnector() {
  return (
    <div className="hidden sm:flex items-center justify-center text-muted-foreground/50 self-stretch px-1">
      <ChevronRight className="size-4" />
    </div>
  );
}
