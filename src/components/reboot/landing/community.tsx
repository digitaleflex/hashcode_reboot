"use client";

import { Users, Swords, Video, LifeBuoy } from "lucide-react";
import { SectionHeader, Tag } from "../shared";
import { LiveMemberCount } from "./social-proof";
import { Reveal, Stagger, StaggerItem } from "../motion/primitives";
import { useTranslations } from "next-intl";

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
export function Community() {
  const t = useTranslations("landing.community");
  const audiences = t.raw("audiences") as string[];
  const cards = [
    { t: t("cardChallenge.t"), d: t("cardChallenge.d") },
    { t: t("cardWorkshop.t"), d: t("cardWorkshop.d") },
    { t: t("cardMentoring.t"), d: t("cardMentoring.d") },
  ];

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
            <div className="relative flex h-full flex-col justify-between gap-8 overflow-hidden rounded-lg border border-border/70 bg-card/40 p-6 sm:p-8">
              {/* Aura lime très faible — profondeur, pas décoration. */}
              <div
                className="pointer-events-none absolute -left-16 -top-16 size-48 rounded-full blur-3xl"
                style={{ background: "var(--primary)", opacity: 0.05 }}
                aria-hidden
              />
              <div className="flex items-center gap-2.5 text-muted-foreground">
                <Users className="size-4 shrink-0" aria-hidden />
                <span className="mono-label text-[10px] uppercase tracking-[0.16em]">
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
                  className="group flex items-start gap-4 rounded-lg border border-border/70 bg-card/40 p-5 transition-colors hover:border-lime/40 sm:block lg:flex lg:gap-0 lg:p-6"
                >
                  <span className="flex size-9 shrink-0 items-center justify-center rounded-md border border-border bg-background text-muted-foreground transition-colors group-hover:text-lime sm:mb-3 lg:mb-4">
                    <Icon className="size-4" aria-hidden />
                  </span>
                  <span className="sm:mt-0 lg:mt-0 block min-w-0">
                    <span className="block font-display text-base font-semibold text-foreground">
                      {c.t}
                    </span>
                    <span className="mt-1 block text-sm leading-snug text-muted-foreground">
                      {c.d}
                    </span>
                  </span>
                </StaggerItem>
              );
            })}
          </Stagger>
        </div>

        {/* Profils types — ancienne section « audience », replacée ici. */}
        <Reveal delay={0.06} className="mt-12">
          <h3 className="mono-label text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
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
      </div>
    </section>
  );
}