"use client";

import * as React from "react";
import { ArrowLeft } from "lucide-react";
import { cn } from "@/lib/utils";
import { MonoLabel } from "../shared";
import { useTranslations } from "next-intl";

/* ------------------------------------------------------------------ */
/* Shell: nav + progress + back                                        */
/* ------------------------------------------------------------------ */

const MILESTONE_KEYS: { key: string; labelKey: string }[] = [
  { key: "profil", labelKey: "shell.milestones.profil" },
  { key: "objectifs", labelKey: "shell.milestones.objectifs" },
  { key: "rythme", labelKey: "shell.milestones.rythme" },
  { key: "mentorat", labelKey: "shell.milestones.mentorat" },
  { key: "vision", labelKey: "shell.milestones.vision" },
];

export function ProfilingShell({
  children,
  progress,
  onBack,
  stepLabel,
  microcopy,
  group,
  showCompletionIndicator,
  currentStep,
  totalSteps,
}: {
  children: React.ReactNode;
  progress: number;
  onBack: () => void;
  stepLabel: string;
  microcopy?: string;
  group?: string;
  showCompletionIndicator?: boolean;
  currentStep?: number;
  totalSteps?: number;
}) {
  const t = useTranslations("profiling");
  const activeIdx = group ? MILESTONE_KEYS.findIndex((m) => m.key === group) : -1;

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <header className="sticky top-0 z-40 bg-background/85 backdrop-blur-sm border-b border-border/60">
        <div className="mx-auto max-w-2xl px-5 sm:px-8 h-14 flex items-center justify-between">
          <button
            onClick={onBack}
            className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors focus-lime"
            aria-label={t("shell.back")}
          >
            <ArrowLeft className="size-4" />
            <span className="hidden sm:inline">{t("shell.back")}</span>
          </button>
          <MonoLabel>{stepLabel}</MonoLabel>
          <div className="flex items-center gap-2">
            {currentStep !== undefined && totalSteps !== undefined && (
              <span
                className="text-xs text-muted-foreground mono-label tabular-nums"
                aria-live="polite"
                aria-atomic="true"
              >
                {t("shell.stepCounter", { currentStep: currentStep + 1, totalSteps })}
              </span>
            )}
            <span className="text-xs text-muted-foreground mono-label tabular-nums flex items-center gap-2" aria-live="polite" aria-atomic="true">
              <span>{t("shell.timeRemaining", { minutes: Math.max(1, Math.round((1 - progress) * 120)) })}</span>
              <span className="text-border">·</span>
              <span>{t("shell.percent", { percent: Math.round(progress * 100) })}</span>
            </span>
          </div>
        </div>
        <div
          className="h-0.5 bg-border"
          role="progressbar"
          aria-valuenow={Math.round(progress * 100)}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label={t("shell.progressAriaLabel")}
        >
          <div
            className="h-full bg-lime transition-[width] duration-320 ease-out"
            style={{ width: `${Math.max(2, progress * 100)}%` }}
          />
          {showCompletionIndicator && progress < 1 && (
            <span className="ml-2 text-xs text-muted-foreground mono-label">
              {Math.round(progress * 100)}%
            </span>
          )}
        </div>
        {/* Milestone group indicator — subtle stage tracker */}
        {activeIdx >= 0 && (
          <div className="mx-auto max-w-2xl px-5 sm:px-8 py-2 flex items-center gap-1.5 overflow-x-auto scroll-slim">
            {MILESTONE_KEYS.map((m, i) => {
              const done = i < activeIdx;
              const active = i === activeIdx;
              const isCurrentGroup = group === m.key;
              return (
                <React.Fragment key={m.key}>
                  <span
                    className={cn(
                      "mono-label whitespace-nowrap transition-colors",
                      active
                        ? "text-lime"
                        : done
                        ? "text-muted-foreground"
                        : isCurrentGroup
                        ? "text-lime/80"
                        : "text-border",
                    )}
                  >
                    {t(m.labelKey)}
                  </span>
                  {i < MILESTONE_KEYS.length - 1 && (
                    <span
                      className={cn(
                        "h-px w-3 shrink-0 transition-colors",
                        done ? "bg-muted-foreground/40" : isCurrentGroup ? "bg-lime/20" : "bg-border",
                      )}
                    />
                  )}
                </React.Fragment>
              );
            })}
          </div>
        )}
      </header>

      <main className="flex-1 flex items-start sm:items-center justify-center px-5 sm:px-8 py-10 sm:py-16">
        <div className="w-full max-w-2xl">
          {microcopy && (
            <p className="mb-5 text-center text-sm text-lime font-display italic animate-hash-in">
              {microcopy}
            </p>
          )}
          {children}
        </div>
      </main>

      <footer className="border-t border-border/60">
        <div className="mx-auto max-w-2xl px-5 sm:px-8 py-3 flex items-center justify-between gap-4">
          <p className="text-xs text-muted-foreground hidden sm:block">
            {t("shell.footer.description")}
          </p>
          {/* Keyboard shortcut hint — only on single-choice questions */}
          {group && group !== "vision" && (
            <span className="text-xs text-muted-foreground mono-label flex items-center gap-1.5">
              <kbd className="inline-flex items-center justify-center size-4 rounded-sm border border-border bg-card text-[11px] font-mono">1</kbd>
              <span>–</span>
              <kbd className="inline-flex items-center justify-center size-4 rounded-sm border border-border bg-card text-[11px] font-mono">9</kbd>
              <span className="hidden sm:inline">{t("shell.footer.keyboardHint")}</span>
            </span>
          )}
        </div>
      </footer>
    </div>
  );
}