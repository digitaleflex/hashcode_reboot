"use client";

import { Check } from "lucide-react";
import { RebootButton, CtaArrow } from "../shared";
import { scrollToId } from "./scroll";
import { ProfileShowcase } from "./profile-showcase";
import { STEPS } from "./data";
import { Fade, Reveal, Slide } from "../motion/primitives";
import { useTranslations } from "next-intl";

/**
 * HERO — proposition de valeur d'abord, preuve ensuite.
 *
 * Desktop : colonne éditoriale (7/12) + vitrine de profil (5/12).
 * Mobile  : éditorial, CTA, puis la vitrine — jamais une version réduite.
 *
 * Le H1 porte la promesse (ce que le visiteur gagne), plus le nom de marque :
 * la marque est déjà dans le header et l'eyebrow. C'est le seul H1 du site.
 */
export function Hero({ onJoin }: { onJoin: (ref?: string) => void }) {
  const t = useTranslations("landing.hero");
  const stepsTranslated = t.raw("steps") as Array<{
    n: string;
    title: string;
    desc: string;
  }>;
  const reassurance = t.raw("reassuranceItems") as string[];

  return (
    <section
      className="relative overflow-hidden"
      aria-labelledby="hero-title"
    >
      <div className="grid-radial" aria-hidden />
      <div className="spotlight" aria-hidden />

      <div className="relative z-10 pb-20 pt-12 sm:pt-16 lg:pb-28 lg:pt-24">
        <div className="shell">
          <div className="grid items-center gap-x-12 gap-y-14 lg:grid-cols-12">
            {/* -------------------------------------------------------- */}
            {/* Colonne éditoriale                                        */}
            {/* -------------------------------------------------------- */}
            <div className="min-w-0 lg:col-span-7">
              <Fade initial={false}>
                <span className="chip">
                  <span className="chip__dot" aria-hidden />
                  {t("eyebrow")}
                </span>
              </Fade>

              <Slide from="up" distance={18} initial={false}>
                <h1
                  id="hero-title"
                  className="mt-6 font-display text-[clamp(2.5rem,6.2vw,4.75rem)] font-bold leading-[0.98] tracking-[-0.04em] text-balance"
                >
                  <span className="block text-gradient">{t("headline1")}</span>
                  <span className="block text-gradient-lime">{t("headline2")}</span>
                </h1>
              </Slide>

              <Fade delay={0.1} initial={false}>
                <p className="mt-6 max-w-xl text-lg leading-relaxed text-foreground/85 sm:text-xl">
                  {t("subtitle")}
                </p>
                <p className="mt-3 max-w-xl text-base leading-relaxed text-muted-foreground">
                  {t("description")}
                </p>
              </Fade>

              <Slide from="up" distance={12} delay={0.18} initial={false}>
                <div className="mt-9 flex flex-col items-stretch gap-3 sm:flex-row sm:items-center">
                  <RebootButton
                    size="lg"
                    onClick={() => onJoin("hero")}
                    className="group w-full sm:w-auto"
                  >
                    {t("primaryCta")}
                    <CtaArrow />
                  </RebootButton>
                  <RebootButton
                    size="lg"
                    variant="outline"
                    onClick={() => scrollToId("axes")}
                    className="w-full sm:w-auto"
                  >
                    {t("secondaryCta")}
                  </RebootButton>
                </div>
              </Slide>

              <Fade delay={0.26} initial={false}>
                <ul
                  className="mt-7 flex flex-wrap items-center gap-x-5 gap-y-2 text-sm text-muted-foreground"
                  aria-label={t("reassurance")}
                >
                  {reassurance.map((r) => (
                    <li key={r} className="inline-flex items-center gap-2">
                      <Check className="size-4 text-lime" strokeWidth={2.5} aria-hidden />
                      {r}
                    </li>
                  ))}
                </ul>
              </Fade>
            </div>

            {/* -------------------------------------------------------- */}
            {/* Vitrine — ce que le visiteur obtient                      */}
            {/* -------------------------------------------------------- */}
            <div className="min-w-0 lg:col-span-5">
              <Reveal delay={0.1} y={26} initial={false}>
                <ProfileShowcase />
              </Reveal>
            </div>
          </div>

          {/* ------------------------------------------------------------ */}
          {/* Comment ça marche — 3 étapes reliées                          */}
          {/* ------------------------------------------------------------ */}
          <div className="relative mt-20 lg:mt-28">
            <h2 className="ds-overlabel text-center">{t("stepsTitle")}</h2>
            <ol className="relative mt-6 grid grid-cols-1 gap-3 md:grid-cols-3 md:gap-4">
              {/* Fil conducteur entre les étapes (desktop). */}
              <span
                aria-hidden
                className="pointer-events-none absolute left-[16%] right-[16%] top-[42px] hidden h-px bg-gradient-to-r from-lime/0 via-lime/40 to-lime/0 md:block"
              />
              {STEPS.map((s) => {
                const step = stepsTranslated.find((st) => st.n === s.n);
                if (!step) return null;
                const Icon = s.icon;
                return (
                  <li
                    key={s.n}
                    className="surface surface-interactive relative flex items-start gap-4 p-5 md:flex-col md:items-center md:p-6 md:text-center"
                  >
                    <span className="icon-tile icon-tile--accent relative size-12 rounded-2xl bg-background">
                      <Icon className="size-5" aria-hidden />
                      <span className="absolute -right-1.5 -top-1.5 grid size-5 place-items-center rounded-full bg-lime font-mono text-[10px] font-bold text-black">
                        {Number(s.n)}
                      </span>
                    </span>
                    <span className="min-w-0">
                      <span className="sr-only">{t("stepLabel", { n: s.n })} — </span>
                      <span className="block font-display text-base font-semibold leading-snug text-foreground">
                        {step.title}
                      </span>
                      <span className="mt-1 block text-sm leading-relaxed text-muted-foreground">
                        {step.desc}
                      </span>
                    </span>
                  </li>
                );
              })}
            </ol>
          </div>
        </div>
      </div>
    </section>
  );
}
