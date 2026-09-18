"use client";

import * as React from "react";
import { ArrowLeft } from "lucide-react";
import { cn } from "@/lib/utils";
import { MonoLabel } from "../shared";

/* ------------------------------------------------------------------ */
/* Shell: nav + progress + back                                        */
/* ------------------------------------------------------------------ */

const MILESTONES: { key: string; label: string }[] = [
  { key: "profil", label: "Profil" },
  { key: "objectifs", label: "Objectif" },
  { key: "rythme", label: "Rythme" },
  { key: "mentorat", label: "Mentorat" },
  { key: "vision", label: "Vision" },
];

export function ProfilingShell({
  children,
  progress,
  onBack,
  stepLabel,
  microcopy,
  group,
  showCompletionIndicator,
}: {
  children: React.ReactNode;
  progress: number;
  onBack: () => void;
  stepLabel: string;
  microcopy?: string;
  group?: string;
  showCompletionIndicator?: boolean;
}) {
  const activeIdx = group ? MILESTONES.findIndex((m) => m.key === group) : -1;

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <header className="sticky top-0 z-40 bg-background/85 backdrop-blur-sm border-b border-border/60">
        <div className="mx-auto max-w-2xl px-5 sm:px-8 h-14 flex items-center justify-between">
          <button
            onClick={onBack}
            className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors focus-lime"
          >
            <ArrowLeft className="size-4" />
            <span className="hidden sm:inline">Retour</span>
          </button>
          <MonoLabel>{stepLabel}</MonoLabel>
          <span className="text-xs text-muted-foreground mono-label tabular-nums flex items-center gap-2">
            <span>~{Math.max(1, Math.round((1 - progress) * 120))} min restantes</span>
            <span className="text-border">·</span>
            <span>{Math.round(progress * 100)}%</span>
          </span>
        </div>
        <div className="h-0.5 bg-border">
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
            {MILESTONES.map((m, i) => {
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
                    {m.label}
                  </span>
                  {i < MILESTONES.length - 1 && (
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
            Tes réponses servent à mieux comprendre ton profil.
          </p>
          {/* Keyboard shortcut hint — only on single-choice questions */}
          {group && group !== "vision" && (
            <span className="text-xs text-muted-foreground mono-label flex items-center gap-1.5">
              <kbd className="inline-flex items-center justify-center size-4 rounded-sm border border-border bg-card text-[11px] font-mono">1</kbd>
              <span>–</span>
              <kbd className="inline-flex items-center justify-center size-4 rounded-sm border border-border bg-card text-[11px] font-mono">9</kbd>
              <span className="hidden sm:inline">pour choisir</span>
            </span>
          )}
        </div>
      </footer>
    </div>
  );
}
