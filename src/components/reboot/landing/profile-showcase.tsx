"use client";

import * as React from "react";
import { ArrowUpRight, BrainCircuit, Code2, Shield, type LucideIcon } from "lucide-react";
import { HashSymbol } from "@/components/brand/logo";
import { cn } from "@/lib/utils";
import { useReducedMotion } from "@/hooks/use-reduced-motion";
import { useTranslations } from "next-intl";

/**
 * PROFILE SHOWCASE — visuel du Hero.
 *
 * Montre ce que le visiteur obtient à la fin du parcours : une carte de
 * profil (archétype, axe, rythme) et une prochaine étape concrète. Trois
 * exemples (Web / Cyber / IA) tournent automatiquement ; les onglets
 * permettent de choisir. Les données sont explicitement étiquetées comme
 * fictives (`showcase.label` / `showcase.note`) — aucune donnée membre réelle.
 *
 * Rotation coupée si `prefers-reduced-motion` ou si l'utilisateur a choisi un
 * onglet (il garde la main).
 */
type ShowcaseProfile = {
  key: "web" | "cybersecurity" | "ai";
  short: string;
  name: string;
  initial: string;
  archetype: string;
  domain: string;
  level: string;
  goal: string;
  rhythm: string;
  fit: number;
  next: string;
};

const ICONS: Record<ShowcaseProfile["key"], LucideIcon> = {
  web: Code2,
  cybersecurity: Shield,
  ai: BrainCircuit,
};

const ROTATE_MS = 4200;

export function ProfileShowcase() {
  const t = useTranslations("landing.hero.showcase");
  const profiles = t.raw("profiles") as ShowcaseProfile[];
  const reducedMotion = useReducedMotion();
  const [active, setActive] = React.useState(0);
  const [pinned, setPinned] = React.useState(false);

  React.useEffect(() => {
    if (reducedMotion || pinned) return;
    const id = window.setInterval(
      () => setActive((i) => (i + 1) % profiles.length),
      ROTATE_MS,
    );
    return () => window.clearInterval(id);
  }, [reducedMotion, pinned, profiles.length]);

  const p = profiles[active];
  const Icon = ICONS[p.key];

  return (
    <div className="relative mx-auto w-full max-w-[460px]">
      {/* Cartes « en pile » derrière : profondeur, aucun contenu. */}
      <div
        aria-hidden
        className="surface absolute inset-x-8 -bottom-4 top-6 rotate-[3deg] opacity-50"
      />
      <div
        aria-hidden
        className="surface absolute inset-x-4 -bottom-2 top-3 -rotate-[2deg] opacity-70"
      />

      <figure className="surface ring-gradient relative overflow-hidden rounded-[24px] p-5 shadow-[var(--shadow-float)] sm:p-6">
        <div
          aria-hidden
          className="pointer-events-none absolute -right-20 -top-20 size-56 rounded-full bg-lime/15 blur-3xl"
        />

        {/* En-tête : étiquette démo + onglets. */}
        <div className="relative flex items-center justify-between gap-3">
          <span className="ds-overlabel">{t("label")}</span>
          <HashSymbol className="text-lime" size={20} />
        </div>

        <div
          role="tablist"
          aria-label={t("tabsAria")}
          className="relative mt-4 grid grid-cols-3 gap-1 rounded-full border border-[var(--line-soft)] bg-background/60 p-1"
        >
          {profiles.map((pr, i) => {
            const TabIcon = ICONS[pr.key];
            const selected = i === active;
            return (
              <button
                key={pr.key}
                type="button"
                role="tab"
                aria-selected={selected}
                onClick={() => {
                  setActive(i);
                  setPinned(true);
                }}
                className={cn(
                  "inline-flex min-h-[40px] items-center justify-center gap-1.5 rounded-full px-2 text-xs font-medium transition-colors focus-lime",
                  selected
                    ? "bg-lime text-black"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                <TabIcon className="size-3.5" aria-hidden />
                <span className="truncate">{pr.short}</span>
              </button>
            );
          })}
        </div>

        {/* Carte de profil — rejouée à chaque changement (key). */}
        <div key={p.key} className="animate-card-in relative mt-5" aria-live="polite">
          <div className="flex items-center gap-3.5">
            <span className="grid size-12 shrink-0 place-items-center rounded-2xl bg-gradient-to-br from-lime to-lime/60 font-display text-lg font-bold text-black">
              {p.initial}
            </span>
            <div className="min-w-0">
              <p className="text-sm text-muted-foreground">{p.name}</p>
              <p className="flex items-center gap-2 font-display text-xl font-bold italic tracking-tight text-foreground">
                <Icon className="size-4 shrink-0 text-lime" aria-hidden />
                <span className="truncate">{p.archetype}</span>
              </p>
            </div>
          </div>

          <dl className="mt-5 grid grid-cols-2 gap-2.5">
            <Field label={t("level")} value={p.level} />
            <Field label={t("rhythm")} value={p.rhythm} />
            <Field label={t("goal")} value={p.goal} className="col-span-2" />
          </dl>

          {/* Jauge d'adéquation : la seule « donnée » animée. */}
          <div className="mt-5">
            <div className="flex items-baseline justify-between">
              <span className="text-xs text-muted-foreground">{t("fit")}</span>
              <span className="font-display text-sm font-semibold tabular-nums text-lime">
                {p.fit}%
              </span>
            </div>
            <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-white/[0.06]">
              <div
                className="h-full origin-left rounded-full bg-gradient-to-r from-lime/60 to-lime [animation:fill-in_900ms_var(--ds-ease)_both]"
                style={{ width: `${p.fit}%` }}
              />
            </div>
          </div>

          <div className="mt-5 flex items-center gap-3 rounded-2xl border border-lime/25 bg-lime/[0.06] p-3.5">
            <span className="icon-tile icon-tile--accent size-10">
              <ArrowUpRight className="size-4" aria-hidden />
            </span>
            <div className="min-w-0">
              <p className="text-[11px] uppercase tracking-[0.12em] text-lime/90">
                {t("recommended")}
              </p>
              <p className="truncate text-sm font-medium text-foreground">{p.next}</p>
            </div>
          </div>
        </div>

        {/* Indicateur de rotation. */}
        <div className="relative mt-5 flex items-center justify-center gap-1.5" aria-hidden>
          {profiles.map((pr, i) => (
            <span
              key={pr.key}
              className={cn(
                "h-1 rounded-full transition-all duration-300",
                i === active ? "w-6 bg-lime" : "w-1.5 bg-white/15",
              )}
            />
          ))}
        </div>
      </figure>

      <p className="relative mt-10 text-center text-xs text-muted-foreground">{t("note")}</p>
    </div>
  );
}

function Field({
  label,
  value,
  className,
}: {
  label: string;
  value: string;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "rounded-xl border border-[var(--line-soft)] bg-background/50 px-3 py-2.5",
        className,
      )}
    >
      <dt className="text-[11px] text-muted-foreground">{label}</dt>
      <dd className="mt-0.5 truncate text-sm font-medium text-foreground">{value}</dd>
    </div>
  );
}
