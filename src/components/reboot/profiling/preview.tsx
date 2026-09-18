"use client";

import { ArrowLeft } from "lucide-react";
import { generateProfile } from "@/lib/profiling/engine";
import type { ProfileAnswers } from "@/lib/profiling/types";
import { HashSymbol } from "@/components/brand/logo";
import { RebootButton, CtaArrow } from "../shared";
import { ProfileCard } from "../profile-card";
import { ProfilingShell } from "./shell";

/* --- Profile preview interlude (after threeMonthGoal, before contact) --- */

export function ProfilePreview({
  answers,
  onFinalize,
  onEdit,
}: {
  answers: ProfileAnswers;
  onFinalize: () => void;
  onEdit: () => void;
}) {
  const gen = generateProfile(answers);
  return (
    <ProfilingShell
      progress={0.98}
      onBack={onEdit}
      stepLabel="Ton profil HASHCODE est prêt"
      group="vision"
      showCompletionIndicator
    >
      <div className="animate-hash-in">
        <div className="max-w-xl mx-auto text-center">
          <HashSymbol className="mx-auto text-lime" size={40} />
          <h2 className="mt-5 font-display font-bold text-2xl sm:text-3xl tracking-tight">
            Ton profil HASHCODE est prêt.
          </h2>
          <p className="mt-2 text-muted-foreground">
            {gen.archetype} — {gen.domainLabel}. Voici la première orientation qu&apos;on tire de tes réponses.
          </p>
        </div>
        <div className="mt-8 max-w-md mx-auto">
          <ProfileCard profile={gen} goal={answers.threeMonthGoal} />
        </div>
        <div className="mt-8 max-w-md mx-auto flex flex-col sm:flex-row gap-3">
          <RebootButton
            size="lg"
            className="group w-full"
            onClick={onFinalize}
          >
            Finaliser mon profil
            <CtaArrow />
          </RebootButton>
          <RebootButton
            size="lg"
            variant="outline"
            onClick={onEdit}
            className="w-full sm:w-auto whitespace-nowrap"
          >
            <ArrowLeft className="size-4 shrink-0" /> Modifier mes réponses
          </RebootButton>
        </div>
        <p className="mt-6 max-w-md mx-auto text-center text-xs text-muted-foreground">
          Tu pourras compléter ton numéro WhatsApp plus tard, depuis ton espace membre.
        </p>
      </div>
    </ProfilingShell>
  );
}

/* --- Finalizing transition (replaces the old black-screen `return null`) --- */

export function FinalizingState({ onBack }: { onBack: () => void }) {
  return (
    <ProfilingShell
      progress={1}
      onBack={onBack}
      stepLabel="Finalisation…"
      showCompletionIndicator
    >
      <div className="text-center animate-hash-in">
        <div className="relative inline-flex">
          <HashSymbol className="text-lime" size={36} />
          <span className="absolute inset-0 animate-hash-sweep rounded-sm overflow-hidden" />
        </div>
        <h2 className="mt-5 font-display font-bold text-lg text-foreground">
          On finalise ton profil…
        </h2>
        <p className="mt-1.5 text-sm text-muted-foreground">
          Une seconde.
        </p>
      </div>
    </ProfilingShell>
  );
}
