"use client";

import * as React from "react";
import { Link } from "@/i18n/routing";
import { ArrowRight, ChevronDown, Clock, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";
import { MonoLabel, RebootButton, CtaArrow } from "../shared";
import { resolveActivityDestination } from "@/lib/orientation/destination";
import { getActivityPresentation } from "@/lib/orientation/presentation";
import type { ActivityRecommendation, NextBestAction, OrientationResult } from "@/lib/orientation/types";
import { track } from "@/lib/analytics";

type Status = OrientationResult["status"];
const TYPE_LABELS: Record<string, string> = {
  challenge: "Défi",
  workshop: "Atelier",
  project: "Projet",
  community: "Communauté",
  mentoring: "Mentorat",
  learning_path: "Parcours",
  event: "Événement",
  content: "Contenu",
};

const REASON_LABELS: Record<string, string> = {
  "domain-match": "Ton domaine",
  "level-match": "Ton niveau",
  "goal-match": "Ton objectif",
  "learning-style-match": "Ton style d’apprentissage",
  "availability-match": "Ta disponibilité",
  "builder-activity-fit": "Ton profil Builder",
  "strategist-activity-fit": "Ton profil Strategist",
  "creator-activity-fit": "Ton profil Creator",
  "catalyst-activity-fit": "Ton profil Catalyst",
};

function reasonLabels(reasons: string[]): string[] {
  return reasons.map((reason) => REASON_LABELS[reason] ?? reason).slice(0, 4);
}

export function RecommendationExperience({
  action,
  status,
  recommendations,
  href,
  className,
  onCompleteProfile,
  onActionClick,
}: {
  action: NextBestAction | null;
  status: Status;
  recommendations: ActivityRecommendation[];
  href?: string;
  className?: string;
  onCompleteProfile?: () => void;
  onActionClick?: () => void;
}) {
  const [expanded, setExpanded] = React.useState(false);
  const viewedRef = React.useRef(false);

  React.useEffect(() => {
    if (viewedRef.current || recommendations.length === 0) return;
    viewedRef.current = true;
    track({
      type: "recommendation_viewed",
      ref: recommendations[0]?.id,
      value: recommendations.length,
    });
  }, [recommendations]);

  const primary = recommendations[0];
  const primaryActivity = primary ? getActivityPresentation(primary.id) : undefined;
  const target = action ? (href ?? resolveActivityDestination(action.id)) : "/evenements";
  const alternatives = recommendations.slice(1, 4);

  function handlePrimaryClick() {
    if (!primary) return;
    track({ type: "primary_recommendation_clicked", ref: primary.id });
    track({ type: "discovery_to_action", ref: primary.id, value: 1 });
    onActionClick?.();
  }

  function handleExpand() {
    setExpanded((value) => {
      const next = !value;
      if (next) track({ type: "recommendation_expanded", ref: primary?.id });
      return next;
    });
  }

  if (status === "INSUFFICIENT_DATA") {
    return (
      <StateCard className={className}>
        <h3 className="font-display font-bold text-xl tracking-tight">Encore une étape pour te guider</h3>
        <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
          Ton profil manque encore d’informations pour te recommander la bonne prochaine étape.
        </p>
        {onCompleteProfile && (
          <RebootButton size="lg" variant="outline" className="mt-5 w-full sm:w-auto" onClick={onCompleteProfile}>
            Compléter mon profil <ArrowRight className="size-4" aria-hidden />
          </RebootButton>
        )}
      </StateCard>
    );
  }

  if (!primary || status !== "OK") {
    return (
      <StateCard className={className}>
        <h3 className="font-display font-bold text-xl tracking-tight">Aucune activité adaptée pour le moment</h3>
        <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
          Rien ne correspond à ton profil dans les activités en cours. Explore l’agenda pour découvrir les prochaines sessions.
        </p>
        <Link href="/evenements" className="group mt-5 inline-flex min-h-[48px] w-full items-center justify-center gap-2 rounded-md border border-border px-6 text-base text-foreground hover:border-lime/60 hover:text-lime focus-lime sm:w-auto">
          Voir les événements <CtaArrow />
        </Link>
      </StateCard>
    );
  }

  if (!action) {
    return (
      <StateCard className={className}>
        <MonoLabel className="text-lime">Exploration</MonoLabel>
        <h3 className="mt-2 font-display font-bold text-xl tracking-tight">Ton profil est prêt à explorer</h3>
        <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
          Plusieurs activités correspondent à ton profil. Nous ne forçons pas une seule réponse : voici celles à découvrir en priorité.
        </p>
        <Link href="/evenements" className="group mt-5 inline-flex min-h-[48px] w-full items-center justify-center gap-2 rounded-md border border-border px-6 text-base text-foreground hover:border-lime/60 hover:text-lime focus-lime sm:w-auto">
          Explorer les événements <CtaArrow />
        </Link>
        <AlternativeList recommendations={recommendations} onClick={(id) => track({ type: "secondary_recommendation_clicked", ref: id })} />
      </StateCard>
    );
  }

  return (
    <div className={cn("relative h-full overflow-hidden rounded-lg border border-border bg-card", className)} role="region" aria-label="Recommandations personnalisées">
      <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-lime/70 to-transparent" />
      <div className="p-6 sm:p-7">
        <div className="flex items-center justify-between gap-3">
          <MonoLabel className="text-muted-foreground">Ta prochaine étape</MonoLabel>
          <span className="inline-flex items-center gap-1.5 rounded-sm border border-lime/40 bg-lime/5 px-2 py-0.5 text-lime mono-label">
            <Sparkles className="size-3" aria-hidden /> ORIENTATION
          </span>
        </div>

        <div className="mt-4">
          <p className="mono-label text-lime">{TYPE_LABELS[primary.type] ?? primary.type}</p>
          <h3 className="mt-1.5 font-display text-xl font-bold tracking-tight sm:text-2xl">
            {primaryActivity?.title ?? primary.id.replace(/-/g, " ")}
          </h3>
          <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
            {primaryActivity?.description ?? action.reason}
          </p>

          <div className="mt-4 flex flex-wrap gap-2">
            {reasonLabels(primary.reasons).map((reason) => (
              <span key={reason} className="rounded-full border border-border px-2.5 py-1 text-[11px] text-muted-foreground">
                {reason}
              </span>
            ))}
            {primaryActivity?.timeCommitment && (
              <span className="inline-flex items-center gap-1 rounded-full border border-border px-2.5 py-1 text-[11px] text-muted-foreground">
                <Clock className="size-3" aria-hidden /> {primaryActivity.timeCommitment}
              </span>
            )}
          </div>

          <p className="mt-4 text-xs leading-5 text-muted-foreground">
            <span className="font-medium text-foreground">Pourquoi ?</span>{" "}
            {action.reason}
          </p>

          <Link href={target} onClick={handlePrimaryClick} className="group mt-5 inline-flex min-h-[48px] w-full items-center justify-center gap-2 rounded-md bg-lime px-6 text-base font-medium text-black hover:bg-lime/90 focus-lime sm:w-auto">
            Commencer <CtaArrow />
          </Link>

          {alternatives.length > 0 && (
            <button type="button" onClick={handleExpand} aria-expanded={expanded} className="mt-4 inline-flex min-h-11 items-center gap-2 text-xs text-muted-foreground hover:text-foreground focus-lime">
              Voir {alternatives.length} alternative{alternatives.length > 1 ? "s" : ""}
              <ChevronDown className={cn("size-4 transition-transform", expanded && "rotate-180")} aria-hidden />
            </button>
          )}

          {expanded && (
            <AlternativeList
              recommendations={alternatives}
              onClick={(id) => track({ type: "secondary_recommendation_clicked", ref: id })}
            />
          )}
        </div>
      </div>
    </div>
  );
}

function AlternativeList({
  recommendations,
  onClick,
}: {
  recommendations: ActivityRecommendation[];
  onClick: (id: string) => void;
}) {
  if (recommendations.length === 0) return null;
  return (
    <div className="mt-5 space-y-2 border-t border-border/70 pt-4" aria-label="Alternatives recommandées">
      {recommendations.map((recommendation) => {
        const activity = getActivityPresentation(recommendation.id);
        const href = resolveActivityDestination(recommendation.id);
        return (
          <Link
            key={recommendation.id}
            href={href}
            onClick={() => onClick(recommendation.id)}
            className="group block rounded-lg border border-border/70 bg-background/30 p-3 transition-colors hover:border-lime/40 focus-lime"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="mono-label text-lime">{TYPE_LABELS[recommendation.type] ?? recommendation.type}</p>
                <p className="mt-1 text-sm font-medium text-foreground">{activity?.title ?? recommendation.id}</p>
                {activity?.timeCommitment && (
                  <p className="mt-1 text-xs text-muted-foreground">{activity.timeCommitment}</p>
                )}
              </div>
              <ArrowRight className="mt-0.5 size-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5" aria-hidden />
            </div>
          </Link>
        );
      })}
    </div>
  );
}

function StateCard({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={cn("h-full rounded-lg border border-border bg-card p-6 sm:p-7", className)} role="region" aria-label="Orientation">
      <MonoLabel className="text-muted-foreground">Prochaine étape</MonoLabel>
      {children}
    </div>
  );
}
