"use client";

import * as React from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { AlertCircle, ArrowRight, BookOpen, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * /dashboard/ateliers — liste des ateliers publiés avec la progression du
 * membre. Client Component : consomme GET /api/workshops (les états sont
 * dérivés CÔTÉ SERVEUR par workshop-progression.ts — le client n'en calcule
 * ni n'en modifie aucun).
 *
 * L'auth est garantie par le layout /dashboard/* (redirect login) : une
 * réponse 401 de l'API est traitée comme une erreur de chargement.
 */

/** États réels d'une séance (workshop-progression.ts) — 8 états, pas 4. */
type SessionState =
  | "LOCKED"
  | "NOT_STARTED"
  | "IN_PROGRESS"
  | "SUBMITTED"
  | "IN_REVIEW"
  | "REVISION"
  | "REJECTED"
  | "COMPLETED";

interface WorkshopSummary {
  total: number;
  completed: number;
  percent: number;
  nextSessionIndex: number | null;
  isComplete: boolean;
}

interface WorkshopStateItem {
  sessionId: string;
  number: number;
  state: SessionState;
}

interface Enrollment {
  status: string;
  enrolledAt: string;
}

interface WorkshopListItem {
  id: string;
  slug: string;
  title: string;
  description: string | null;
  domain: string | null;
  level: string | null;
  enrollment: Enrollment | null;
  summary: WorkshopSummary;
  states: WorkshopStateItem[];
}

interface WorkshopListResponse {
  workshops?: WorkshopListItem[];
}

const DOMAIN_LABELS: Record<string, string> = {
  web: "Web",
  cybersecurity: "Cyber",
  ai: "AI",
};

const LEVEL_LABELS: Record<string, string> = {
  beginner: "Débutant",
  practicing: "Pratiquant",
  autonomous: "Autonome",
  advanced: "Avancé",
};

/** Pastille d'état — green=validée, lime=en cours, gris=à commencer, sombre=verrouillée. */
const STATE_DOT: Record<SessionState, { labelKey: string; className: string }> = {
  COMPLETED: { labelKey: "stateValidated", className: "bg-emerald-400" },
  IN_PROGRESS: { labelKey: "stateInProgress", className: "bg-lime" },
  SUBMITTED: { labelKey: "stateSubmitted", className: "bg-blue-400" },
  IN_REVIEW: { labelKey: "stateInReview", className: "bg-amber-400" },
  REVISION: { labelKey: "stateRevision", className: "bg-orange-400" },
  REJECTED: { labelKey: "stateRejected", className: "bg-red-400" },
  NOT_STARTED: { labelKey: "stateNotStarted", className: "bg-muted-foreground/40" },
  LOCKED: { labelKey: "stateLocked", className: "bg-border" },
};

function stateDot(state: SessionState, t: ReturnType<typeof useTranslations>): { label: string; className: string } {
  const config = STATE_DOT[state] ?? STATE_DOT.NOT_STARTED;
  return { label: t(config.labelKey), className: config.className };
}

export default function AteliersPage() {
  const t = useTranslations("dashboard.ateliers.list");
  const [workshops, setWorkshops] = React.useState<WorkshopListItem[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/workshops", { cache: "no-store" });
        if (!res.ok) {
          const data = (await res.json().catch(() => null)) as { error?: string } | null;
          throw new Error(data?.error ?? t("loadError"));
        }
        const data = (await res.json()) as WorkshopListResponse;
        if (!cancelled) setWorkshops(data.workshops ?? []);
      } catch (err) {
        if (!cancelled) {
          setError(
            err instanceof Error ? err.message : t("loadError"),
          );
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [t]);

  return (
    <div className="mx-auto max-w-4xl w-full px-5 sm:px-8 py-8 space-y-6">
      {/* Header */}
      <header>
        <h1 className="font-display font-bold text-2xl tracking-tight">{t("title")}</h1>
        <p className="text-sm text-muted-foreground mt-1">
          {t("subtitle")}
        </p>
      </header>

      {loading && (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="size-6 animate-spin motion-reduce:animate-none text-muted-foreground" />
        </div>
      )}

      {!loading && error && (
        <div className="flex items-start gap-2 rounded-md bg-amber-500/10 border border-amber-500/30 px-4 py-3 text-sm text-amber-500">
          <AlertCircle className="size-4 shrink-0 mt-0.5" />
          <span>{error}</span>
        </div>
      )}

      {!loading && !error && workshops.length === 0 && (
        <div className="rounded-md border border-border/60 bg-card/40 px-6 py-12 text-center">
          <BookOpen className="size-12 text-muted-foreground/20 mx-auto mb-4" />
          <p className="text-muted-foreground">{t("empty")}</p>
          <p className="text-xs text-muted-foreground/60 mt-1">
            {t("emptySub")}
          </p>
        </div>
      )}

      {!loading && !error && workshops.length > 0 && (
        <div className="grid gap-4 md:grid-cols-2">
          {workshops.map((workshop) => {
            const enrolled = workshop.enrollment?.status === "active";
            const { summary } = workshop;
            const states = [...workshop.states].sort((a, b) => a.number - b.number);

            return (
              <article
                key={workshop.id}
                className="rounded-lg border border-border/60 bg-card/40 p-5 sm:p-6 flex flex-col gap-4"
              >
                {/* Titre + badges domaine/niveau */}
                <div className="flex items-start justify-between gap-3">
                  <h2 className="font-display font-bold text-lg tracking-tight">
                    {workshop.title}
                  </h2>
                  {(workshop.domain || workshop.level) && (
                    <div className="flex gap-1.5 shrink-0">
                      {workshop.domain && (
                        <span className="inline-flex items-center rounded-full border border-border/60 bg-secondary/50 px-2.5 py-1 text-xs font-medium text-muted-foreground">
                          {DOMAIN_LABELS[workshop.domain] ?? workshop.domain}
                        </span>
                      )}
                      {workshop.level && (
                        <span className="inline-flex items-center rounded-full border border-border/60 bg-secondary/50 px-2.5 py-1 text-xs font-medium text-muted-foreground">
                          {LEVEL_LABELS[workshop.level] ?? workshop.level}
                        </span>
                      )}
                    </div>
                  )}
                </div>

                {workshop.description && (
                  <p className="text-sm text-muted-foreground line-clamp-2">
                    {workshop.description}
                  </p>
                )}

                {/* Progression */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-muted-foreground">
                      {t("progress", { completed: summary.completed, total: summary.total })}
                    </span>
                    <span className="text-lime font-medium">{t("percent", { percent: summary.percent })}</span>
                  </div>
                  <div className="h-1.5 rounded-full bg-secondary overflow-hidden">
                    <div
                      className="h-full rounded-full bg-lime transition-[width]"
                      style={{ width: `${summary.percent}%` }}
                    />
                  </div>
                </div>

                {/* Indicateurs d'état par séance */}
                {states.length > 0 && (
                  <div className="flex items-center gap-1.5 flex-wrap" aria-label={t("stateDotsAria")}>
                    {states.map((s) => {
                      const dot = stateDot(s.state, t);
                      return (
                        <span
                          key={s.sessionId}
                          title={t("stateDotTitle", { number: String(s.number).padStart(2, "0"), label: dot.label })}
                          className={cn("inline-block size-2 rounded-full", dot.className)}
                        />
                      );
                    })}
                  </div>
                )}

                {/* CTA */}
                <div className="mt-auto pt-1">
                  <Link
                    href={`/dashboard/ateliers/${workshop.slug}`}
                    className="inline-flex items-center gap-2 rounded-md bg-lime px-4 py-2 text-sm font-medium text-background transition-colors hover:bg-lime/90 focus-visible:ring-2 focus-visible:ring-lime focus-visible:ring-offset-2"
                    aria-label={t("ctaAria", { title: workshop.title })}
                  >
                    {enrolled ? t("ctaContinue") : t("ctaDiscover")}
                    <ArrowRight className="size-4" />
                  </Link>
                </div>
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}