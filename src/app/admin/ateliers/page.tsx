"use client";

import * as React from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import {
  BookOpen,
  Users,
  FileText,
  ClipboardCheck,
  Target,
  Loader2,
  AlertCircle,
  GraduationCap,
  ChevronRight,
  CalendarDays,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { fetchJson, withRetryAfter } from "@/components/reboot/admin/lib/fetchJson";

// ── Types (miroir de GET /api/admin/workshops et /stats) ────────────────────

interface MemberSummary {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
}

interface EnrollmentRow {
  id: string;
  status: string;
  enrolledAt: string;
  member: MemberSummary;
}

interface WorkshopSessionRow {
  id: string;
  number: number;
  title: string;
  weekNumber: number;
  pendingReviews: number;
}

interface WorkshopListItem {
  id: string;
  slug: string;
  title: string;
  description: string | null;
  status: string;
  domain: string | null;
  level: string | null;
  createdAt: string;
  updatedAt: string;
  stats: {
    enrollmentCount: number;
    submissionCount: number;
    reviewCount: number;
  };
  sessions: WorkshopSessionRow[];
  recentEnrollments: EnrollmentRow[];
}

interface WorkshopsResponse {
  workshops: WorkshopListItem[];
  total: number;
}

interface PerWorkshopStat {
  id: string;
  slug: string;
  title: string;
  status: string;
  enrollmentCount: number;
  completedEnrollments: number;
  completionRate: number;
  submissionCount: number;
  avgSubmissionsPerMember: number;
}

interface StatsResponse {
  totals: {
    workshops: number;
    enrollments: number;
    submissions: number;
    reviews: number;
  };
  enrollmentsByStatus: Record<string, number>;
  submissionsByStatus: Record<string, number>;
  quiz: {
    totalAttempts: number;
    passedAttempts: number;
    passRate: number;
  };
  workshops: PerWorkshopStat[];
  recentReviews: unknown[];
}

// ── Présentation ────────────────────────────────────────────────────────────

const WORKSHOP_STATUS_STYLES: Record<string, string> = {
  draft: "bg-muted text-muted-foreground border-border/60",
  published: "bg-lime/15 text-lime border-lime/30",
  archived: "bg-muted/40 text-muted-foreground/60 border-border/40",
};

const WORKSHOP_STATUS_LABELS: Record<string, string> = {
  draft: "Brouillon",
  published: "Publié",
  archived: "Archivé",
};

const ENROLLMENT_STATUS_LABELS: Record<string, string> = {
  active: "Actif",
  completed: "Terminé",
  dropped: "Abandon",
};

const FILTERS = [
  { value: "all", label: "Tous" },
  { value: "draft", label: "Brouillons" },
  { value: "published", label: "Publiés" },
  { value: "archived", label: "Archivés" },
] as const;

type FilterValue = (typeof FILTERS)[number]["value"];

function formatNumber(n: number): string {
  return new Intl.NumberFormat("fr-FR").format(n);
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("fr-FR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function memberName(member: MemberSummary): string {
  return `${member.firstName} ${member.lastName}`.trim() || member.email;
}

function queryError(error: unknown): string {
  return error instanceof Error ? error.message : "Erreur de chargement.";
}

async function loadWorkshops(): Promise<WorkshopsResponse> {
  const { res, data, code, error, retryAfterSec } = await fetchJson(
    "/api/admin/workshops?limit=200",
    { cache: "no-store" },
  );
  if (res.status === 401 || code === "UNAUTHORIZED") {
    window.location.href = "/admin/login";
    throw new Error("unauthorized");
  }
  if (!res.ok) {
    throw new Error(
      code === "RATE_LIMITED"
        ? withRetryAfter(error ?? "Trop de requêtes.", retryAfterSec)
        : error ?? "Impossible de charger les ateliers.",
    );
  }
  return data as WorkshopsResponse;
}

async function loadStats(): Promise<StatsResponse> {
  const { res, data, code, error, retryAfterSec } = await fetchJson(
    "/api/admin/workshops/stats",
    { cache: "no-store" },
  );
  if (res.status === 401 || code === "UNAUTHORIZED") {
    window.location.href = "/admin/login";
    throw new Error("unauthorized");
  }
  if (!res.ok) {
    throw new Error(
      code === "RATE_LIMITED"
        ? withRetryAfter(error ?? "Trop de requêtes.", retryAfterSec)
        : error ?? "Impossible de charger les statistiques.",
    );
  }
  return data as StatsResponse;
}

function StatCard({
  icon: Icon,
  label,
  value,
  hint,
  accent,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
  hint?: string;
  accent?: boolean;
}) {
  return (
    <div className="rounded-lg border border-border/60 bg-card/40 p-4">
      <div className="flex items-center gap-2">
        <Icon className={cn("size-4", accent ? "text-lime" : "text-muted-foreground")} />
        <span className="mono-label text-muted-foreground uppercase">{label}</span>
      </div>
      <p className={cn("mt-2 font-display font-bold text-2xl", accent && "text-lime")}>
        {value}
      </p>
      {hint && <p className="mt-0.5 text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}

export default function AdminAteliersPage() {
  const [filter, setFilter] = React.useState<FilterValue>("all");

  const workshopsQuery = useQuery({
    queryKey: ["admin", "workshops", "list"],
    queryFn: loadWorkshops,
  });
  const statsQuery = useQuery({
    queryKey: ["admin", "workshops", "stats"],
    queryFn: loadStats,
  });

  const workshops = workshopsQuery.data?.workshops ?? [];
  const stats = statsQuery.data;

  const visible = React.useMemo(
    () => (filter === "all" ? workshops : workshops.filter((w) => w.status === filter)),
    [workshops, filter],
  );

  return (
    <div className="space-y-8">
      <header className="space-y-1.5">
        <div className="flex items-center gap-2">
          <BookOpen className="size-4 text-lime" />
          <h1 className="font-display font-bold text-xl sm:text-2xl tracking-tight">
            Ateliers
          </h1>
        </div>
        <p className="text-sm text-muted-foreground">
          Pilotage des ateliers : structure pédagogique, inscriptions, soumissions et quiz.
        </p>
      </header>

      {/* Statistiques globales */}
      <section className="space-y-3">
        <h2 className="font-display font-bold text-sm tracking-tight mono-label text-muted-foreground uppercase">
          Vue d&apos;ensemble
        </h2>
        {statsQuery.isError ? (
          <div className="flex items-center gap-2 rounded-md border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-400">
            <AlertCircle className="size-4 shrink-0" />
            {queryError(statsQuery.error)}
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-3">
            <StatCard
              icon={BookOpen}
              label="Ateliers"
              value={statsQuery.isLoading ? "…" : formatNumber(stats?.totals.workshops ?? 0)}
            />
            <StatCard
              icon={Users}
              label="Inscriptions"
              value={statsQuery.isLoading ? "…" : formatNumber(stats?.totals.enrollments ?? 0)}
              hint={
                stats
                  ? `${formatNumber(stats.enrollmentsByStatus.active ?? 0)} actifs · ${formatNumber(
                      stats.enrollmentsByStatus.completed ?? 0,
                    )} terminés`
                  : undefined
              }
            />
            <StatCard
              icon={FileText}
              label="Soumissions"
              value={statsQuery.isLoading ? "…" : formatNumber(stats?.totals.submissions ?? 0)}
              hint={
                stats
                  ? `${formatNumber(stats.submissionsByStatus.PENDING ?? 0)} en attente · ${formatNumber(
                      stats.submissionsByStatus.REVISION ?? 0,
                    )} en correction`
                  : undefined
              }
            />
            <StatCard
              icon={ClipboardCheck}
              label="Revues"
              value={statsQuery.isLoading ? "…" : formatNumber(stats?.totals.reviews ?? 0)}
            />
            <StatCard
              icon={Target}
              label="Réussite quiz"
              value={statsQuery.isLoading ? "…" : `${stats?.quiz.passRate ?? 0}%`}
              hint={
                stats
                  ? `${formatNumber(stats.quiz.passedAttempts)}/${formatNumber(
                      stats.quiz.totalAttempts,
                    )} tentatives réussies`
                  : undefined
              }
              accent
            />
          </div>
        )}
      </section>

      {/* Filtres + liste */}
      <section className="space-y-4">
        <div className="flex items-center gap-2 flex-wrap">
          {FILTERS.map((f) => (
            <button
              key={f.value}
              type="button"
              onClick={() => setFilter(f.value)}
              className={cn(
                "min-h-[44px] rounded-md border px-3 py-1.5 text-xs font-medium transition-colors cursor-pointer",
                filter === f.value
                  ? "border-lime/50 bg-lime/10 text-lime"
                  : "border-border/60 text-muted-foreground hover:border-lime/40 hover:text-foreground",
              )}
            >
              {f.label}
            </button>
          ))}
          <span className="flex-1" />
          <span className="mono-label text-muted-foreground">
            {formatNumber(visible.length)} atelier{visible.length > 1 ? "s" : ""}
          </span>
        </div>

        {workshopsQuery.isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="size-5 animate-spin text-muted-foreground" />
          </div>
        ) : workshopsQuery.isError ? (
          <div className="flex items-center gap-2 rounded-md border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-400">
            <AlertCircle className="size-4 shrink-0" />
            {queryError(workshopsQuery.error)}
          </div>
        ) : visible.length === 0 ? (
          <div className="rounded-lg border border-border/60 bg-card/40 p-10 text-center">
            <GraduationCap className="mx-auto mb-3 size-8 text-muted-foreground/30" />
            <p className="text-sm text-muted-foreground">
              {workshops.length === 0
                ? "Aucun atelier pour le moment."
                : "Aucun atelier ne correspond à ce filtre."}
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {visible.map((workshop) => {
              const pendingSessions = workshop.sessions.filter((s) => s.pendingReviews > 0);
              const recent = workshop.recentEnrollments.slice(0, 3);
              return (
                <article
                  key={workshop.id}
                  className="rounded-lg border border-border/60 bg-card/40 p-5 sm:p-6 space-y-4"
                >
                  <div className="flex items-start gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="font-display font-bold text-base truncate">
                          {workshop.title}
                        </h3>
                        <span
                          className={cn(
                            "inline-flex items-center rounded-full border px-2 py-0.5 mono-label",
                            WORKSHOP_STATUS_STYLES[workshop.status] ??
                              WORKSHOP_STATUS_STYLES.draft,
                          )}
                        >
                          {WORKSHOP_STATUS_LABELS[workshop.status] ?? workshop.status}
                        </span>
                      </div>
                      {workshop.description && (
                        <p className="mt-1.5 line-clamp-2 text-sm text-muted-foreground">
                          {workshop.description}
                        </p>
                      )}
                      <div className="mt-2 flex flex-wrap items-center gap-2">
                        {workshop.domain && (
                          <span className="inline-flex items-center rounded-full border border-border/60 px-2 py-0.5 text-[11px] mono-label text-muted-foreground">
                            {workshop.domain}
                          </span>
                        )}
                        {workshop.level && (
                          <span className="inline-flex items-center rounded-full border border-border/60 px-2 py-0.5 text-[11px] mono-label text-muted-foreground">
                            {workshop.level}
                          </span>
                        )}
                        <span className="inline-flex items-center gap-1 text-[11px] text-muted-foreground">
                          <CalendarDays className="size-3" />
                          {formatDate(workshop.createdAt)}
                        </span>
                      </div>
                    </div>
                    <Link
                      href={`/admin/ateliers/${workshop.id}`}
                      className="inline-flex shrink-0 items-center gap-1 rounded-md border border-border/60 px-3 py-2 text-xs text-muted-foreground transition-colors hover:border-lime/40 hover:text-lime"
                    >
                      Détail
                      <ChevronRight className="size-3.5" />
                    </Link>
                  </div>

                  {/* Compteurs */}
                  <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
                    <span className="inline-flex items-center gap-1.5">
                      <Users className="size-3.5" />
                      <strong className="font-medium text-foreground">
                        {formatNumber(workshop.stats.enrollmentCount)}
                      </strong>
                      inscrit{workshop.stats.enrollmentCount > 1 ? "s" : ""}
                    </span>
                    <span className="inline-flex items-center gap-1.5">
                      <FileText className="size-3.5" />
                      <strong className="font-medium text-foreground">
                        {formatNumber(workshop.stats.submissionCount)}
                      </strong>
                      soumission{workshop.stats.submissionCount > 1 ? "s" : ""}
                    </span>
                    <span className="inline-flex items-center gap-1.5">
                      <ClipboardCheck className="size-3.5" />
                      <strong className="font-medium text-foreground">
                        {formatNumber(workshop.stats.reviewCount)}
                      </strong>
                      revue{workshop.stats.reviewCount > 1 ? "s" : ""}
                    </span>
                  </div>

                  {/* Sessions en attente de revue */}
                  {pendingSessions.length > 0 ? (
                    <div className="rounded-md border border-amber-500/30 bg-amber-500/10 p-3">
                      <p className="mono-label text-amber-300 uppercase">
                        En attente de revue
                      </p>
                      <div className="mt-1.5 flex flex-wrap gap-1.5">
                        {pendingSessions.map((session) => (
                          <span
                            key={session.id}
                            className="inline-flex items-center gap-1.5 rounded-full border border-amber-500/30 bg-amber-500/10 px-2 py-0.5 text-[11px] text-amber-200"
                          >
                            <span className="mono-label">S{String(session.number).padStart(2, "0")}</span>
                            <span className="truncate max-w-[16rem]">{session.title}</span>
                            <strong className="font-semibold text-amber-100">
                              {session.pendingReviews}
                            </strong>
                          </span>
                        ))}
                      </div>
                    </div>
                  ) : (
                    <p className="text-xs text-muted-foreground">
                      Aucune soumission en attente de revue.
                    </p>
                  )}

                  {/* Dernières inscriptions */}
                  {recent.length > 0 && (
                    <div>
                      <p className="mono-label text-muted-foreground uppercase">
                        Dernières inscriptions
                      </p>
                      <ul className="mt-1.5 space-y-1">
                        {recent.map((enrollment) => (
                          <li
                            key={enrollment.id}
                            className="flex flex-wrap items-center gap-x-2 text-xs text-muted-foreground"
                          >
                            <span className="text-foreground">
                              {memberName(enrollment.member)}
                            </span>
                            <span className="text-muted-foreground/60">
                              {enrollment.member.email}
                            </span>
                            <span className="inline-flex items-center rounded-full border border-border/60 px-1.5 py-0.5 text-[10px] mono-label">
                              {ENROLLMENT_STATUS_LABELS[enrollment.status] ?? enrollment.status}
                            </span>
                            <span className="text-muted-foreground/60">
                              {formatDate(enrollment.enrolledAt)}
                            </span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </article>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}
