"use client";

import * as React from "react";
import { useTranslations } from "next-intl";
import { fetchJson } from "./lib/fetchJson";
import { cn } from "@/lib/utils";

// Etapes du pipeline onboarding (#106), dans l'ordre du funnel.
// Les libelles/descriptions viennent de `admin.pipeline` :
// stages.{pending,approved,invited,active}.{label,description},
// filters.stageAll, empty.noMembers, errors.countsLoad.
export const PIPELINE_STAGES = [
  "pending",
  "approved",
  "invited",
  "active",
] as const;

export type PipelineStage = (typeof PIPELINE_STAGES)[number];

interface PipelineStagesProps {
  activeStage?: string | null;
  onSelect: (stage: string) => void;
}

export function PipelineStages({ activeStage, onSelect }: PipelineStagesProps) {
  const t = useTranslations("admin.pipeline");
  const [counts, setCounts] = React.useState<Record<PipelineStage, number | null>>({
    pending: null,
    approved: null,
    invited: null,
    active: null,
  });
  const [loadError, setLoadError] = React.useState<string | null>(null);

  // Compteurs par etape : GET /api/members?stage=<s>&pageSize=1 (champ total).
  React.useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const entries = await Promise.all(
          PIPELINE_STAGES.map(async (s) => {
            const { res, data } = await fetchJson(
              `/api/members?stage=${s}&pageSize=1`,
              { cache: "no-store" },
            );
            if (!res.ok || typeof data?.total !== "number") {
              throw new Error(`counts ${s} failed`);
            }
            return [s, data.total as number] as const;
          }),
        );
        if (cancelled) return;
        setCounts(Object.fromEntries(entries) as Record<PipelineStage, number | null>);
        setLoadError(null);
      } catch {
        if (!cancelled) setLoadError(t("errors.countsLoad"));
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, [t]);

  const allZero = PIPELINE_STAGES.every((s) => counts[s] === 0);

  return (
    <div>
      <div className="flex flex-wrap items-center gap-2" role="tablist" aria-label={t("filters.stageAll")}>
        <button
          type="button"
          role="tab"
          aria-selected={!activeStage}
          onClick={() => onSelect("all")}
          className={cn(
            "rounded-md border px-3 py-1.5 text-sm transition-colors focus-lime",
            !activeStage
              ? "border-lime/60 text-lime bg-lime/5"
              : "border-border bg-card text-muted-foreground hover:text-foreground",
          )}
        >
          {t("filters.stageAll")}
        </button>
        {PIPELINE_STAGES.map((s) => {
          const active = activeStage === s;
          const count = counts[s];
          return (
            <button
              key={s}
              type="button"
              role="tab"
              aria-selected={active}
              aria-pressed={active}
              onClick={() => onSelect(s)}
              className={cn(
                "rounded-md border px-3 py-1.5 text-sm transition-colors focus-lime",
                active
                  ? "border-lime/60 text-lime bg-lime/5"
                  : "border-border bg-card text-muted-foreground hover:text-foreground",
              )}
            >
              <span className="font-medium">{t(`stages.${s}.label`)}</span>
              <span className="ml-2 tabular-nums text-xs opacity-80">
                {count === null ? "..." : count}
              </span>
              <span className="sr-only">{t(`stages.${s}.description`)}</span>
            </button>
          );
        })}
      </div>
      <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-4" aria-hidden={false}>
        {PIPELINE_STAGES.map((s) => (
          <p key={s} className="text-xs text-muted-foreground">
            {t(`stages.${s}.description`)}
          </p>
        ))}
      </div>
      {loadError && (
        <p className="mt-2 text-xs text-destructive" role="alert">
          {loadError}
        </p>
      )}
      {!loadError && allZero && (
        <p className="mt-2 text-xs text-muted-foreground">{t("empty.noMembers")}</p>
      )}
    </div>
  );
}
