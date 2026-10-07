"use client";

import * as React from "react";
import { cn } from "@/lib/utils";
import type { GeneratedProfile } from "@/lib/profiling/types";
import { HashSymbol } from "@/components/brand/logo";
import { MonoLabel, Tag } from "./shared";
import { useTranslations } from "next-intl";

/**
 * The HASHCODE profile card — the "reward" for completing the flow.
 * Engineered, not a generic SaaS confirmation. Resembles an ID card.
 */
export function ProfileCard({
  profile,
  goal,
  firstName,
  variant = "default",
}: {
  profile: GeneratedProfile;
  goal?: string;
  firstName?: string;
  variant?: "default" | "compact";
}) {
  const t = useTranslations("profiling");

  /**
   * The engine emits `*Label` in French. When the raw enum code travels with
   * the profile, prefer the translated label for the active locale so the card
   * never mixes languages; fall back to the engine string when it does not.
   */
  function localized(
    group: "domain" | "level" | "goal" | "availability" | "style" | "mentoring",
    code: string | undefined,
    fallback: string,
  ): string {
    if (!code) return fallback;
    try {
      return t(`profileValues.${group}.${code}` as never);
    } catch {
      return fallback;
    }
  }

  const rows: { label: string; value: string }[] = [
    {
      label: t("profileCard.domain"),
      value: localized("domain", profile.domain, profile.domainLabel),
    },
    {
      label: t("profileCard.level"),
      value: localized("level", profile.level, profile.levelLabel),
    },
    {
      label: t("profileCard.goal"),
      value: localized("goal", profile.goal, profile.goalLabel),
    },
    {
      label: t("profileCard.availability"),
      value: localized("availability", profile.availability, profile.availabilityLabel),
    },
    {
      label: t("profileCard.style"),
      value: localized("style", profile.learningStyle, profile.styleLabel),
    },
    {
      label: t("profileCard.mentoring"),
      value: localized(
        "mentoring",
        profile.mentoringInterest,
        profile.mentoringLabel,
      ),
    },
  ];

  return (
    <div
      className={cn(
        "relative rounded-lg border border-border bg-card overflow-hidden lift-on-hover",
        variant === "default" && "p-6 sm:p-7",
      )}
    >
      {/* Top hairline + corner ticks (engineered motif) */}
      <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-lime/70 to-transparent" />
      <div className="absolute top-2 left-2 text-lime/50 mono-label text-[8px]">
        ┌
      </div>
      <div className="absolute top-2 right-2 text-lime/50 mono-label text-[8px]">
        ┐
      </div>
      {/* Bottom-left lime glow (subtle depth) */}
      <div
        className="absolute -bottom-12 -left-12 size-32 rounded-full blur-3xl opacity-[0.05] pointer-events-none"
        style={{ background: "var(--primary)" }}
        aria-hidden
      />

      <div className={cn(variant === "compact" && "p-5 sm:p-6")}>
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <span className="text-lime">
              <HashSymbol size={28} />
            </span>
            <MonoLabel className="text-muted-foreground">
              {firstName ? t("profileCard.profileWithName", { firstName }) : t("profileCard.profileHashcode")}
            </MonoLabel>
          </div>
          {/* Archetype badge ribbon — premium stamp */}
          <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-sm border border-lime/40 bg-lime/5 text-lime mono-label">
            <span className="size-1 rounded-full bg-lime animate-hash-pulse" aria-hidden />
            REBOOT
          </span>
        </div>

        <div className="mt-4 flex items-center gap-2.5">
          <span className="text-2xl" aria-hidden>
            {profile.archetypeEmoji}
          </span>
          <h3 className="font-display font-bold text-xl sm:text-2xl tracking-tight text-foreground italic">
            {profile.archetype}
          </h3>
        </div>

        <div className="mt-5 grid grid-cols-1 gap-x-5 gap-y-4 sm:grid-cols-2">
          {rows.map((r) => (
            <div key={r.label}>
              <MonoLabel className="text-muted-foreground">{r.label}</MonoLabel>
              <div className="mt-0.5 text-sm sm:text-base text-foreground font-medium leading-snug">
                {r.value}
              </div>
            </div>
          ))}
        </div>

        {goal && (
          <div className="mt-5 pt-5 border-t border-border/70">
            <MonoLabel className="text-muted-foreground">
              {t("profileCard.threeMonthGoal")}
            </MonoLabel>
            <p className="mt-1 text-foreground italic font-display text-base leading-snug">
              « {goal} »
            </p>
          </div>
        )}

        {profile.tags.length > 0 && (
          <div className="mt-5 flex flex-wrap gap-1.5">
            {profile.tags.slice(0, 8).map((tag) => (
              <Tag key={tag}>{tag}</Tag>
            ))}
          </div>
        )}
      </div>

      {/* Bottom hairline */}
      <div className="absolute bottom-0 left-0 right-0 h-px bg-border" />
    </div>
  );
}