"use client";

import * as React from "react";
import { ArrowLeft, Clock } from "lucide-react";
import { cn } from "@/lib/utils";
import { HashSymbol } from "@/components/brand/logo";
import { useTranslations } from "next-intl";

/* ------------------------------------------------------------------ */
/* Shell: nav + progression par étapes + panneau latéral optionnel     */
/* ------------------------------------------------------------------ */

const MILESTONE_KEYS: { key: string; labelKey: string }[] = [
  { key: "profil", labelKey: "shell.milestones.profil" },
  { key: "objectifs", labelKey: "shell.milestones.objectifs" },
  { key: "rythme", labelKey: "shell.milestones.rythme" },
  { key: "mentorat", labelKey: "shell.milestones.mentorat" },
  { key: "vision", labelKey: "shell.milestones.vision" },
];

/**
 * Coquille du questionnaire.
 *
 * Refonte 2026-10 :
 * - la barre unique + le pourcentage flottant (qui débordait sous la barre)
 *   sont remplacés par 5 segments nommés — on voit où l'on est ET ce qui
 *   reste, sans calcul mental ;
 * - `aside` : panneau latéral (desktop ≥ lg) où le profil se construit en
 *   direct au fil des réponses. Sur mobile il n'est pas rendu : la colonne
 *   unique reste concentrée sur la question.
 */
export function ProfilingShell({
  children,
  progress,
  onBack,
  stepLabel,
  microcopy,
  group,
  currentStep,
  totalSteps,
  aside,
}: {
  children: React.ReactNode;
  progress: number;
  onBack: () => void;
  stepLabel: string;
  microcopy?: string;
  group?: string;
  /** Conservé pour compatibilité : la progression est toujours affichée. */
  showCompletionIndicator?: boolean;
  currentStep?: number;
  totalSteps?: number;
  aside?: React.ReactNode;
}) {
  const t = useTranslations("profiling");
  const activeIdx = group
    ? MILESTONE_KEYS.findIndex((m) => m.key === group)
    : progress >= 1
      ? MILESTONE_KEYS.length
      : -1;
  const minutes = Math.max(1, Math.round((1 - progress) * 2));

  return (
    <div className="relative flex min-h-dvh flex-col overflow-x-clip bg-background">
      <div className="grid-radial opacity-60" aria-hidden />

      <header className="glass sticky top-0 z-40 border-b border-[var(--line-soft)]">
        <div
          className={cn(
            "mx-auto flex h-16 items-center justify-between gap-4 px-5 sm:px-8",
            aside ? "max-w-6xl" : "max-w-3xl",
          )}
        >
          <button
            onClick={onBack}
            className="inline-flex min-h-[44px] items-center gap-2 rounded-full pr-3 text-sm text-muted-foreground transition-colors hover:text-foreground focus-lime"
            aria-label={t("shell.back")}
          >
            <span className="grid size-9 place-items-center rounded-full border border-[var(--line-strong)]">
              <ArrowLeft className="size-4" />
            </span>
            <span className="hidden sm:inline">{t("shell.back")}</span>
          </button>

          <span className="hidden min-w-0 items-center gap-2 text-sm font-medium text-foreground sm:flex">
            <HashSymbol className="shrink-0 text-lime" size={18} />
            <span className="truncate">{stepLabel}</span>
          </span>

          <span
            className="flex items-center gap-3 text-xs text-muted-foreground tabular-nums"
            aria-live="polite"
            aria-atomic="true"
          >
            {currentStep !== undefined && totalSteps !== undefined && (
              <span>
                {t("shell.stepCounter", { currentStep: currentStep + 1, totalSteps })}
              </span>
            )}
            <span className="hidden items-center gap-1.5 rounded-full sm:inline-flex border border-[var(--line-soft)] px-2.5 py-1">
              <Clock className="size-3.5" aria-hidden />
              {t("shell.timeRemaining", { minutes })}
            </span>
          </span>
        </div>

        {/* Progression par étapes nommées. */}
        <div
          className={cn("mx-auto px-5 pb-3 sm:px-8", aside ? "max-w-6xl" : "max-w-3xl")}
          role="progressbar"
          aria-valuenow={Math.round(progress * 100)}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label={t("shell.progressAriaLabel")}
        >
          <ol className="grid grid-cols-5 gap-1.5">
            {MILESTONE_KEYS.map((m, i) => {
              const done = i < activeIdx;
              const active = i === activeIdx;
              return (
                <li key={m.key} className="min-w-0">
                  <span className="block h-1 overflow-hidden rounded-full bg-white/[0.07]">
                    <span
                      className={cn(
                        "block h-full rounded-full bg-lime transition-[width] duration-500 ease-out",
                        done ? "w-full" : active ? "w-1/2" : "w-0",
                      )}
                    />
                  </span>
                  <span
                    className={cn(
                      "mt-1.5 hidden truncate text-[11px] transition-colors sm:block",
                      active ? "text-lime" : done ? "text-foreground/70" : "text-muted-foreground/60",
                    )}
                  >
                    {t(m.labelKey)}
                  </span>
                </li>
              );
            })}
          </ol>
        </div>
      </header>

      <main
        className={cn(
          "relative z-10 mx-auto flex w-full flex-1 items-start justify-center gap-10 px-5 py-10 sm:px-8 sm:py-14 lg:py-16",
          aside ? "max-w-6xl" : "max-w-3xl",
        )}
      >
        <div className={cn("w-full", aside ? "max-w-2xl lg:flex-1" : "max-w-2xl")}>
          {microcopy && (
            <p className="mb-5 inline-flex items-center gap-2 rounded-full border border-lime/25 bg-lime/[0.06] px-3 py-1.5 text-sm text-lime animate-hash-in">
              <span className="chip__dot" aria-hidden />
              {microcopy}
            </p>
          )}
          {children}
        </div>
        {aside && (
          <aside className="sticky top-36 hidden w-[340px] shrink-0 lg:block">{aside}</aside>
        )}
      </main>

      <footer className="relative z-10 border-t border-[var(--line-soft)]">
        <div
          className={cn(
            "mx-auto flex items-center justify-between gap-4 px-5 py-3 sm:px-8",
            aside ? "max-w-6xl" : "max-w-3xl",
          )}
        >
          <p className="hidden text-xs text-muted-foreground sm:block">
            {t("shell.footer.description")}
          </p>
          {/* Raccourcis clavier — uniquement pour les questions à choix. */}
          {group && group !== "vision" && (
            <span className="hidden items-center gap-1.5 text-xs text-muted-foreground sm:flex">
              <kbd className="inline-flex h-5 min-w-5 items-center justify-center rounded border border-[var(--line-strong)] bg-card px-1 font-mono text-[11px]">1</kbd>
              <span>–</span>
              <kbd className="inline-flex h-5 min-w-5 items-center justify-center rounded border border-[var(--line-strong)] bg-card px-1 font-mono text-[11px]">9</kbd>
              <span>{t("shell.footer.keyboardHint")}</span>
            </span>
          )}
        </div>
      </footer>
    </div>
  );
}
