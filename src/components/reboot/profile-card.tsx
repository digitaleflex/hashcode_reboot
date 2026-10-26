"use client";

import * as React from "react";
import { cn } from "@/lib/utils";
import type { GeneratedProfile } from "@/lib/profiling/types";
import { HashSymbol } from "@/components/brand/logo";
import { MonoLabel, Tag } from "./shared";
import { EmojiIcon } from "./emoji-icon";
import { useTranslations } from "next-intl";
import { publicTagLabels } from "@/lib/profiling/public-tags";

/**
 * The HASHCODE profile card — the "reward" for completing the flow.
 * Engineered, not a generic SaaS confirmation. Resembles an ID card.
 */
type ProfileField =
  | "domain"
  | "level"
  | "goal"
  | "availability"
  | "style"
  | "mentoring";

export function ProfileCard({
  profile,
  goal,
  firstName,
  variant = "default",
  fields,
  showTags = true,
  headingLevel = 3,
}: {
  profile: GeneratedProfile;
  goal?: string;
  firstName?: string;
  variant?: "default" | "compact";
  /** Sous-ensemble de champs affichés. Défaut : tous (comportement historique). */
  fields?: ProfileField[];
  /** Afficher les tags d'intérêt. Défaut : oui. */
  showTags?: boolean;
  /**
   * Niveau du titre qui porte l'archétype.
   *
   * La carte est réutilisée sous des parents de niveaux différents (`h1` sur
   * l'écran de relecture du flow, `h2` sur la page welcome) : un niveau fixe
   * produirait un saut de hiérarchie (`heading-order`) invalide. Défaut `3` —
   * le seul contexte où le parent est un `h2`.
   */
  headingLevel?: 2 | 3;
}) {
  const t = useTranslations("profiling");
  const Heading = (headingLevel === 2 ? "h2" : "h3") as "h2" | "h3";

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

  const allRows: { field: ProfileField; label: string; value: string }[] = [
    {
      field: "domain",
      label: t("profileCard.domain"),
      value: localized("domain", profile.domain, profile.domainLabel),
    },
    {
      field: "level",
      label: t("profileCard.level"),
      value: localized("level", profile.level, profile.levelLabel),
    },
    {
      field: "goal",
      label: t("profileCard.goal"),
      value: localized("goal", profile.goal, profile.goalLabel),
    },
    {
      field: "availability",
      label: t("profileCard.availability"),
      value: localized("availability", profile.availability, profile.availabilityLabel),
    },
    {
      field: "style",
      label: t("profileCard.style"),
      value: localized("style", profile.learningStyle, profile.styleLabel),
    },
    {
      field: "mentoring",
      label: t("profileCard.mentoring"),
      value: localized(
        "mentoring",
        profile.mentoringInterest,
        profile.mentoringLabel,
      ),
    },
  ];
  const rows = fields
    ? allRows.filter((r) => fields.includes(r.field))
    : allRows;

  return (
    <div
      className={cn(
        "surface ring-gradient relative overflow-hidden rounded-[24px]",
        variant === "default" && "p-6 sm:p-7",
      )}
    >
      {/* Halo lime haut-droit : profondeur de la « carte d'identité ». */}
      <div
        className="pointer-events-none absolute -right-16 -top-16 size-44 rounded-full bg-lime/10 blur-3xl"
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
          <span className="chip chip--accent px-2.5 py-1 text-[11px] font-medium tracking-[0.12em]">
            <span className="size-1 rounded-full bg-lime animate-hash-pulse" aria-hidden />
            REBOOT
          </span>
        </div>

        <div className="mt-5 flex items-center gap-3">
          <span className="grid size-11 shrink-0 place-items-center rounded-2xl bg-gradient-to-br from-lime to-lime/60 text-black">
            <EmojiIcon emoji={profile.archetypeEmoji} className="size-5" />
          </span>
          <Heading className="font-display font-bold text-xl sm:text-2xl tracking-tight text-foreground italic">
            {profile.archetype}
          </Heading>
        </div>

        <div className="mt-5 grid grid-cols-1 gap-2.5 sm:grid-cols-2">
          {rows.map((r) => (
            <div
              key={r.label}
              className="rounded-xl border border-[var(--line-soft)] bg-background/50 px-3.5 py-2.5"
            >
              <span className="block text-[11px] text-muted-foreground">{r.label}</span>
              <div className="mt-0.5 text-sm text-foreground font-medium leading-snug">
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

        {showTags && publicTagLabels(profile.tags).length > 0 && (
          <div className="mt-5 flex flex-wrap gap-1.5">
            {publicTagLabels(profile.tags).slice(0, 8).map((tag) => (
              <Tag key={tag}>{tag}</Tag>
            ))}
          </div>
        )}
      </div>

    </div>
  );
}