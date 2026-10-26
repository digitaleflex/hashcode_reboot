"use client";

import { ArrowLeft } from "lucide-react";
import { generateProfile } from "@/lib/profiling/engine";
import type { ProfileAnswers } from "@/lib/profiling/types";
import { HashSymbol } from "@/components/brand/logo";
import { RebootButton, CtaArrow } from "../shared";
import { ProfileCard } from "../profile-card";
import { ProfilingShell } from "./shell";
import { useTranslations } from "next-intl";

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
  const t = useTranslations("profiling");
  const gen = generateProfile(answers);
  return (
    <ProfilingShell
      progress={0.98}
      onBack={onEdit}
      stepLabel={t("preview.stepLabel")}
      group="vision"
      showCompletionIndicator
    >
      <div className="animate-hash-in">
        <div className="max-w-xl mx-auto text-center">
          <span className="chip chip--accent">
            <span className="chip__dot" aria-hidden />
            {t("preview.badge")}
          </span>
          <h1 className="mt-5 font-display font-bold text-3xl sm:text-4xl tracking-tight text-gradient">
            {t("preview.title")}
          </h1>
          <p className="mt-2 text-muted-foreground">
            {t("preview.body", { archetype: gen.archetype, domainLabel: gen.domainLabel })}
          </p>
        </div>
        <div className="mt-8 max-w-lg mx-auto">
          {/* `headingLevel={2}` : le titre de cette carte est enfant direct du
              `h1` de l'étape de relecture — le défaut `3` y produirait un saut
              `h1` → `h3` (violation axe `heading-order`). */}
          <ProfileCard profile={gen} goal={answers.threeMonthGoal} headingLevel={2} />
        </div>
        <div className="mt-8 max-w-lg mx-auto flex flex-col gap-2">
          <RebootButton
            size="lg"
            className="group w-full"
            onClick={onFinalize}
          >
            {t("preview.finalize")}
            <CtaArrow />
          </RebootButton>
          <RebootButton
            size="lg"
            variant="ghost"
            onClick={onEdit}
            className="w-full text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="size-4 shrink-0" /> {t("preview.edit")}
          </RebootButton>
        </div>
        <p className="mt-4 max-w-lg mx-auto text-center text-xs text-muted-foreground">
          {t("preview.whatsappNote")}
        </p>
      </div>
    </ProfilingShell>
  );
}

/* --- Finalizing transition (replaces the old black-screen `return null`) --- */

export function FinalizingState({ onBack }: { onBack: () => void }) {
  const t = useTranslations("profiling");
  return (
    <ProfilingShell
      progress={1}
      onBack={onBack}
      stepLabel={t("finalizing.title")}
      showCompletionIndicator
    >
      <div className="text-center animate-hash-in">
        <div className="relative inline-flex">
          <HashSymbol className="text-lime" size={36} />
          <span className="absolute inset-0 animate-hash-sweep rounded-sm overflow-hidden" />
        </div>
        <h1 className="mt-5 font-display font-bold text-lg text-foreground">
          {t("finalizing.body")}
        </h1>
        <p className="mt-1.5 text-sm text-muted-foreground">
          {t("finalizing.subtitle")}
        </p>
      </div>
    </ProfilingShell>
  );
}