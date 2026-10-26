"use client";

import * as React from "react";
import { Check } from "lucide-react";
import { cn } from "@/lib/utils";
import { HashSymbol } from "@/components/brand/logo";
import { generateProfile } from "@/lib/profiling/engine";
import { countryFlag, countryName } from "@/lib/profiling/countries";
import type { ProfileAnswers } from "@/lib/profiling/types";
import { useTranslations } from "next-intl";

/**
 * Panneau latéral du questionnaire (desktop) : le profil se construit en
 * direct, champ par champ. Chaque réponse produit un retour visible
 * immédiat — c'est le principal levier anti-abandon du parcours.
 *
 * Purement dérivé de `answers` (aucun appel réseau) via le moteur
 * déterministe `generateProfile`, identique à celui du serveur.
 */
export function LiveProfilePanel({ answers }: { answers: ProfileAnswers }) {
  const t = useTranslations("profiling");
  const gen = React.useMemo(() => generateProfile(answers), [answers]);

  const rows: { key: string; label: string; value: string | null }[] = [
    {
      key: "country",
      label: t("livePanel.country"),
      value: answers.country ? `${countryFlag(answers.country)} ${countryName(answers.country)}` : null,
    },
    { key: "domain", label: t("profileCard.domain"), value: answers.primaryDomain ? gen.domainLabel : null },
    { key: "goal", label: t("profileCard.goal"), value: answers.goal ? gen.goalLabel : null },
    { key: "level", label: t("profileCard.level"), value: answers.level ? gen.levelLabel : null },
    {
      key: "availability",
      label: t("profileCard.availability"),
      value: answers.availability ? gen.availabilityLabel : null,
    },
    { key: "style", label: t("profileCard.style"), value: answers.learningStyle ? gen.styleLabel : null },
    {
      key: "mentoring",
      label: t("profileCard.mentoring"),
      value: answers.mentoringInterest ? gen.mentoringLabel : null,
    },
  ];
  const filled = rows.filter((r) => r.value).length;
  const pct = Math.round((filled / rows.length) * 100);
  const name = answers.firstName?.trim();

  return (
    <div className="surface ring-gradient overflow-hidden rounded-[24px] p-5">
      <div
        aria-hidden
        className="pointer-events-none absolute -right-16 -top-16 size-40 rounded-full bg-lime/10 blur-3xl"
      />
      <div className="relative flex items-center justify-between">
        <span className="ds-overlabel">{t("livePanel.title")}</span>
        <span className="font-display text-sm font-semibold tabular-nums text-lime">{pct}%</span>
      </div>

      <div className="relative mt-4 flex items-center gap-3">
        <span className="grid size-12 shrink-0 place-items-center rounded-2xl bg-gradient-to-br from-lime to-lime/60 font-display text-lg font-bold text-black">
          {name ? name.charAt(0).toUpperCase() : <HashSymbol size={20} />}
        </span>
        <div className="min-w-0">
          <p className="truncate text-sm text-muted-foreground">
            {name ?? t("livePanel.anonymous")}
          </p>
          <p
            key={answers.primaryDomain ?? "none"}
            className={cn(
              "truncate font-display text-lg font-bold italic tracking-tight",
              answers.primaryDomain ? "animate-hash-in text-foreground" : "text-muted-foreground/60",
            )}
          >
            {answers.primaryDomain ? gen.archetype : t("livePanel.archetypePending")}
          </p>
        </div>
      </div>

      <ul className="relative mt-5 space-y-1.5">
        {rows.map((r) => (
          <li
            key={r.key}
            className={cn(
              "flex items-center gap-3 rounded-xl px-3 py-2 transition-colors",
              r.value ? "bg-white/[0.03]" : "border border-dashed border-[var(--line-soft)]",
            )}
          >
            <span
              className={cn(
                "grid size-5 shrink-0 place-items-center rounded-full",
                r.value ? "bg-lime text-black" : "border border-[var(--line-strong)]",
              )}
              aria-hidden
            >
              {r.value && <Check className="size-3" strokeWidth={3} />}
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-[11px] text-muted-foreground">{r.label}</span>
              <span
                key={r.value ?? "empty"}
                className={cn(
                  "block truncate text-sm",
                  r.value ? "animate-hash-in font-medium text-foreground" : "text-muted-foreground/50",
                )}
              >
                {r.value ?? "—"}
              </span>
            </span>
          </li>
        ))}
      </ul>

      <p className="relative mt-4 text-xs leading-relaxed text-muted-foreground">
        {t("livePanel.note")}
      </p>
    </div>
  );
}
