"use client";

import { ChevronDown, Check } from "lucide-react";
import { HashSymbol } from "@/components/brand/logo";
import { RebootButton, CtaArrow, Eyebrow, RebootTitle } from "../shared";
import { scrollToId } from "./scroll";
import { EcosystemCore } from "./ecosystem-core";
import { STEPS } from "./data";
import { Fade, Reveal, Slide } from "../motion/primitives";
import { useTranslations } from "next-intl";

/**
 * HERO — layout scindé (brief §12).
 *
 * Desktop  : colonne éditoriale (7/12) + Ecosystem Core (5/12).
 * Mobile   : éditorial d'abord, visuel ensuite — pas une version réduite.
 *
 * Le H1 unique du site reste dans <RebootTitle>. Aucun autre H1.
 */
export function Hero({ onJoin }: { onJoin: (ref?: string) => void }) {
  const t = useTranslations("landing.hero");
  const stepsTranslated = t.raw("steps") as Array<{
    n: string;
    title: string;
    desc: string;
  }>;

  return (
    <section
      className="relative overflow-hidden bg-vignette bg-noise"
      aria-labelledby="hero-title"
    >
      <div className="absolute inset-0 bg-grid opacity-70" aria-hidden />
      {/* Aura lime haute-gauche : profondeur, jamais un dégradé décoratif. */}
      <div
        className="hero-aura absolute -top-32 -left-24 size-[28rem] rounded-full blur-3xl opacity-0 md:opacity-[0.06] transition-opacity duration-500"
        style={{ background: "var(--primary)" }}
        aria-hidden
      />
      {/* Motif H en filigrane — desktop uniquement, opacité ≤ 15%. */}
      <HashSymbol
        className="hero-hash absolute -right-16 -bottom-16 text-border/40 select-none pointer-events-none opacity-0 lg:opacity-[0.15] transition-opacity duration-500"
        size={360}
      />

      <div className="relative z-10">
        <div className="shell">
          {/* Grille éditoriale — rails verticaux très discrets. */}
          <div className="relative">
            <div className="rails" aria-hidden>
              <span />
              <span />
              <span />
              <span />
            </div>

            <div className="relative z-10 grid items-center gap-x-10 gap-y-14 lg:grid-cols-12 lg:gap-y-0">
              {/* -------------------------------------------------------- */}
              {/* Colonne éditoriale                                        */}
              {/* -------------------------------------------------------- */}
              <div className="lg:col-span-7 lg:pr-8">
                <Fade>
                  <Eyebrow>{t("eyebrow")}</Eyebrow>
                </Fade>

                <div id="hero-title">
                  <Slide from="up" distance={18}>
                    <RebootTitle className="mt-4" />
                  </Slide>
                </div>

                <Slide from="up" distance={16} delay={0.08}>
                  <h2 className="mt-7 max-w-xl text-2xl font-display font-bold leading-tight text-balance text-foreground sm:text-4xl">
                    {t("subtitle")}
                  </h2>
                </Slide>

                <Fade delay={0.14}>
                  <p className="mt-3 max-w-xl text-base leading-relaxed text-muted-foreground sm:text-lg">
                    {t("description")}
                  </p>
                </Fade>

                <Slide from="up" distance={12} delay={0.2}>
                  <div className="mt-8 flex flex-col items-stretch gap-3 sm:flex-row sm:items-center">
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

                <Fade delay={0.26}>
                  <p className="mt-6 flex flex-wrap items-center gap-2 text-sm leading-relaxed text-foreground">
                    <span className="inline-flex size-5 items-center justify-center rounded-full border border-lime/40 bg-lime/10">
                      <Check className="size-3.5 text-lime" strokeWidth={2.5} />
                    </span>
                    {t("reassurance")}
                  </p>
                </Fade>
              </div>

              {/* -------------------------------------------------------- */}
              {/* Visuel — Ecosystem Core                                    */}
              {/* -------------------------------------------------------- */}
              <div className="lg:col-span-5">
                <Reveal delay={0.1} y={26}>
                  <EcosystemCore />
                </Reveal>
              </div>
            </div>
          </div>

          {/* ------------------------------------------------------------ */}
          {/* 3 étapes — pleine largeur sous la grille                      */}
          {/* ------------------------------------------------------------ */}
          <div className="relative z-10 mt-16 lg:mt-24">
            <ol className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {STEPS.map((s) => {
                const step = stepsTranslated.find((st) => st.n === s.n);
                if (!step) return null;
                const Icon = s.icon;
                return (
                  <li
                    key={s.n}
                    className="flex items-start gap-3 rounded-md border border-border/60 bg-card/70 p-4"
                  >
                    <span className="flex size-10 shrink-0 items-center justify-center rounded-md border border-lime/40 bg-lime/5 text-lime">
                      <Icon className="size-5" aria-hidden />
                    </span>
                    <span className="min-w-0">
                      <span className="font-mono text-[12px] leading-none tracking-[0.06em] text-lime">
                        {t("stepLabel", { n: s.n })}
                      </span>
                      <span className="mt-1.5 block font-display text-[15px] font-semibold leading-snug text-foreground">
                        {step.title}
                      </span>
                      <span className="mt-0.5 block text-sm leading-snug text-muted-foreground">
                        {step.desc}
                      </span>
                    </span>
                  </li>
                );
              })}
            </ol>
            <p className="mt-3 text-sm text-muted-foreground">{t("altNote")}</p>
          </div>
        </div>
      </div>

      {/* Indicateur de scroll — desktop uniquement, absent sur mobile pour ne pas
          concurrencer le CTA dans le pouce. */}
      <button
        onClick={() =>
          window.scrollTo({
            top: window.innerHeight * 0.85,
            behavior: "smooth",
          })
        }
        className="group absolute bottom-6 left-1/2 hidden -translate-x-1/2 flex-col items-center gap-1.5 text-muted-foreground transition-colors hover:text-lime focus-lime sm:flex"
        aria-label={t("scrollAria")}
      >
        <span className="text-[12px] tracking-[0.06em]">{t("scrollLabel")}</span>
        <ChevronDown className="size-4 animate-bounce-slow" aria-hidden />
      </button>
    </section>
  );
}