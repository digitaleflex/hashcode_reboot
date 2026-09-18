"use client";

import { RotateCcw } from "lucide-react";
import { HashSymbol } from "@/components/brand/logo";
import { RebootButton, CtaArrow, MonoLabel } from "../shared";

/* ------------------------------------------------------------------ */
/* Resume prompt                                                       */
/* ------------------------------------------------------------------ */

export function ResumePrompt({
  onResume,
  onRestart,
  progress,
  answeredCount,
  duplicate,
}: {
  onResume: () => void;
  onRestart: () => void;
  progress: number;
  answeredCount: number;
  duplicate: boolean;
}) {
  return (
    <div className="min-h-screen flex flex-col bg-background">
      <header className="border-b border-border/60">
        <div className="mx-auto max-w-2xl px-5 sm:px-8 h-14 flex items-center justify-between">
          <MonoLabel>Ton profil HASHCODE</MonoLabel>
          <span className="text-xs text-muted-foreground mono-label">
            {Math.round(progress * 100)}%
          </span>
        </div>
        <div className="h-0.5 bg-border">
          <div
            className="h-full bg-lime"
            style={{ width: `${Math.max(2, progress * 100)}%` }}
          />
        </div>
      </header>
      <main className="flex-1 flex items-center justify-center px-5 sm:px-8">
        <div className="w-full max-w-md text-center animate-hash-in">
          <HashSymbol className="mx-auto text-lime" size={40} />
          <h2 className="mt-5 font-display font-bold text-2xl tracking-tight">
            {duplicate
              ? "Tu as déjà un compte HASHCODE."
              : "Tu avais un brouillon en cours."}
          </h2>
          <p className="mt-2 text-muted-foreground">
            {duplicate
              ? "Reprends là où tu en étais — on a retrouvé ton profil."
              : `Tu as déjà répondu à ${answeredCount} question${
                  answeredCount > 1 ? "s" : ""
                }. Tu peux reprendre là où tu t'étais arrêté.`}
          </p>
          <div className="mt-7 flex flex-col sm:flex-row gap-3 justify-center">
            <RebootButton size="lg" className="group w-full sm:w-auto" onClick={onResume}>
              Reprendre
              <CtaArrow />
            </RebootButton>
            <RebootButton size="lg" variant="outline" onClick={onRestart}>
              <RotateCcw className="size-4" /> Recommencer
            </RebootButton>
          </div>
        </div>
      </main>
    </div>
  );
}
