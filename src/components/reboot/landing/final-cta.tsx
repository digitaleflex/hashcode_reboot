"use client";

import { Check } from "lucide-react";
import { HashSymbol } from "@/components/brand/logo";
import { RebootButton, CtaArrow } from "../shared";
import { Glow, Reveal } from "../motion/primitives";
import { useTranslations } from "next-intl";

/**
 * §25 — FINAL CTA.
 *
 * `id="rejoindre"` est un point d'ancrage structurel : c'est lui que cible
 * `StickyMobileCta` pour se masquer une fois la section visible. Ne pas le
 * renommer ni le retirer du DOM.
 */
export function FinalCta({ onJoin }: { onJoin: (ref?: string) => void }) {
  const t = useTranslations("landing.finalCta");

  return (
    <section
      id="rejoindre"
      className="section relative scroll-mt-20 overflow-hidden bg-vignette bg-noise"
      aria-labelledby="final-cta-title"
    >
      <div className="absolute inset-0 bg-grid opacity-60" aria-hidden />
      {/* Aura lime — respiration lente, opacité ≤ 5%.
           Centré par calcul (`50% - demi-largeur`), pas par translate :
           Framer Motion sature la propriété `transform` pour animer `scale`. */}
      <Glow
        className="left-[calc(50%-13rem)] top-[33%] size-[26rem] rounded-full blur-3xl"
        intensity={0.05}
        duration={9}
        scale={1.1}
      />

      <div className="shell relative z-10 text-center">
        <Reveal>
          <div className="relative inline-flex items-center justify-center">
            <HashSymbol className="relative text-lime" size={48} />
          </div>
        </Reveal>

        <Reveal delay={0.06}>
          <h2
            id="final-cta-title"
            className="mx-auto mt-6 max-w-4xl text-balance font-display text-3xl font-extrabold tracking-tight text-foreground sm:text-5xl"
          >
            {t("title")}
          </h2>
        </Reveal>

        <Reveal delay={0.12}>
          <p className="mx-auto mt-4 max-w-xl text-base text-muted-foreground sm:text-lg">
            {t("description")}
          </p>
        </Reveal>

        <Reveal delay={0.18}>
          <div className="mt-8 flex justify-center">
            <RebootButton
              size="lg"
              onClick={() => onJoin("final")}
              className="group w-full sm:w-auto"
            >
              {t("cta")}
              <CtaArrow />
            </RebootButton>
          </div>
        </Reveal>

        <Reveal delay={0.24}>
          <p className="mt-6 flex flex-wrap items-center justify-center gap-2 text-sm text-foreground">
            <Check className="size-4 shrink-0 text-lime" strokeWidth={2.5} aria-hidden />
            {t("reassurance")}
          </p>
        </Reveal>
      </div>
    </section>
  );
}