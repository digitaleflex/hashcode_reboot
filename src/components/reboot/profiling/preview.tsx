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
      stepLabel={t("preview.title")}
      group="vision"
      showCompletionIndicator
    >
      <div className="animate-hash-in">
        <div className="max-w-xl mx-auto text-center">
          <HashSymbol className="mx-auto text-lime" size={40} />
          <h2 className="mt-5 font-display font-bold text-2xl sm:text-3xl tracking-tight">
            {t("preview.title")}
          </h2>
          <p className="mt-2 text-muted-foreground">
            {t("preview.body", { archetype: gen.archetype, domainLabel: gen.domainLabel })}
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
            {t("preview.finalize")}
            <CtaArrow />
          </RebootButton>
          <RebootButton
            size="lg"
            variant="outline"
            onClick={onEdit}
            className="w-full sm:w-auto whitespace-nowrap"
          >
            <ArrowLeft className="size-4 shrink-0" /> {t("preview.edit")}
          </RebootButton>
        </div>
        <p className="mt-6 max-w-md mx-auto text-center text-xs text-muted-foreground">
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
        <h2 className="mt-5 font-display font-bold text-lg text-foreground">
          {t("finalizing.body")}
        </h2>
        <p className="mt-1.5 text-sm text-muted-foreground">
          {t("finalizing.subtitle")}
        </p>
      </div>
    </ProfilingShell>
  );
}