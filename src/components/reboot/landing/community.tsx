"use client";

import { Users, Swords, Video, LifeBuoy } from "lucide-react";
import { CtaArrow, RebootButton, SectionHeader, Tag } from "../shared";
import { LiveMemberCount } from "./social-proof";
import { Reveal, Stagger, StaggerItem } from "../motion/primitives";
import { useTranslations } from "next-intl";
import { cn } from "@/lib/utils";

const CARD_ICONS = [Swords, Video, LifeBuoy] as const;

/**
 * §19 — COMMUNITY.
 *
 * Composition volontairement asymétrique : le compteur réel occupe une grande
 * tuile, les 3 formats d'activité deux petites, et les profils types le
 * bandeau du bas. Aucune tuile « membre » n'est inventée.
 *
 * Seule donnée dynamique : `LiveMemberCount` (GET /api/community/count).
 */
export function Community({ onJoin }: { onJoin: (ref?: string) => void }) {
  const t = useTranslations("landing.community");
  const audiences = t.raw("audiences") as string[];
  const cards = t.raw("cards") as Array<{
    t: string;
    d: string;
    how: string;
    status: string;
    available: boolean;
  }>;

  return (
    <section
      id="community"
      className="section border-t border-border/60"
      aria-labelledby="community-title"
    >
      <div className="shell">
        <SectionHeader
          index={t("index")}
          title={<span id="community-title">{t("title")}</span>}
          intro={t("intro")}
        />

        <div className="mt-12 grid gap-4 lg:grid-cols-12">
          {/* Tuile principale : le compteur réel. */}
          <Reveal className="lg:col-span-5">
            <div className="ds-card relative flex h-full flex-col justify-between gap-8 overflow-hidden sm:p-8">
              {/* Aura lime très faible — profondeur, pas décoration. */}
              <div
                className="pointer-events-none absolute -left-16 -top-16 size-48 rounded-full blur-3xl"
                style={{ background: "var(--primary)", opacity: 0.05 }}
                aria-hidden
              />
              <div className="flex items-center gap-2.5 text-muted-foreground">
                <Users className="size-4 shrink-0" aria-hidden />
                <span className="ds-overlabel">
                  {t("liveAria")}
                </span>
              </div>
              <LiveMemberCount />
            </div>
          </Reveal>

          {/* 3 formats d'activité — empilés à droite sur mobile. */}
          <Stagger
            className="grid gap-4 sm:grid-cols-3 lg:col-span-7 lg:grid-cols-1"
            stagger={0.08}
          >
            {cards.map((c, i) => {
              const Icon = CARD_ICONS[i] ?? Users;
              return (
                <StaggerItem
                  key={c.t}
                  className="ds-card group flex flex-col gap-3 transition-colors hover:border-lime/40"
                >
                  <span className="flex size-9 items-center justify-center rounded-md border border-border bg-background text-muted-foreground transition-colors group-hover:text-lime">
                    <Icon className="size-4" aria-hidden />
                  </span>
                  <span className="min-w-0">
                    <span className="block font-display text-base font-semibold text-foreground">
                      {c.t}
                    </span>
                    <span className="mt-1 block text-sm leading-snug text-muted-foreground">
                      {c.d}
                    </span>
                    <span className="mt-2 block ds-caption">{c.how}</span>
                  </span>
                  <span
                    className={cn(
                      "ds-badge mt-auto self-start",
                      c.available && "ds-badge--accent",
                    )}
                  >
                    {c.status}
                  </span>
                </StaggerItem>
              );
            })}
          </Stagger>
        </div>

        {/* Profils types — ancienne section « audience », replacée ici. */}
        <Reveal delay={0.06} className="mt-12">
          <h3 className="ds-overlabel">
            {t("audiencesLabel")}
          </h3>
          <ul role="list" className="mt-4 flex flex-wrap gap-2">
            {audiences.map((a) => (
              <li key={a}>
                <Tag>{a}</Tag>
              </li>
            ))}
          </ul>
          <p className="mt-4 text-sm text-muted-foreground">{t("note")}</p>
        </Reveal>

        <Reveal
          delay={0.08}
          className="mt-8 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"
        >
          <p className="max-w-xl text-sm leading-relaxed text-muted-foreground">
            {t("ctaNote")}
          </p>
          <RebootButton
            size="lg"
            onClick={() => onJoin("community")}
            ariaLabel={t("ctaAria")}
            className="group w-full sm:w-auto"
          >
            {t("cta")}
            <CtaArrow />
          </RebootButton>
        </Reveal>
      </div>
    </section>
  );
}