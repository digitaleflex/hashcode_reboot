"use client";

import * as React from "react";
import { motion, useReducedMotion, useScroll, useSpring } from "framer-motion";
import { SectionHeader } from "../shared";
import { Reveal } from "../motion/primitives";
import { useTranslations } from "next-intl";

/**
 * §16 — THE METHOD : APPRENDRE → PRATIQUER → CONSTRUIRE → ÉVOLUER.
 *
 * Ce n'est pas une liste de promesses : c'est un rail de progression. Le
 * lime ne sert qu'à matérialiser la progression parcourue au fil du scroll.
 *
 * Les 3 premiers verbes reprennent les items de `pillars` (ancêtre de cette
 * section) ; « Évoluer » est adossé au mentorat réel du questionnaire et au
 * jalon Mentoring de la roadmap. Aucune promesse nouvelle.
 */
export function Method() {
  const t = useTranslations("landing.method");
  const items = t.raw("items") as Array<{ k: string; t: string; d: string }>;

  const railRef = React.useRef<HTMLDivElement>(null);
  const reduced = !!useReducedMotion();
  const { scrollYProgress } = useScroll({
    target: railRef,
    offset: ["start 0.85", "end 0.6"],
  });
  // Un seul ressort pilote le remplissage ; l'axe dépend du breakpoint
  // (vertical en mobile, horizontal en desktop) — voir globals.css.
  const fill = useSpring(scrollYProgress, {
    stiffness: 150,
    damping: 32,
    mass: 0.4,
  });

  return (
    <section
      id="method"
      className="section border-t border-border/60"
      aria-labelledby="method-title"
    >
      <div className="shell">
        <SectionHeader
          index={t("index")}
          title={<span id="method-title">{t("title")}</span>}
          intro={t("intro")}
        />

        <div ref={railRef} className="relative mt-12 lg:mt-14">
          {/* Rail purement décoratif : il ne doit pas voler la sémantique
              de la <ol> ci-dessous aux lecteurs d'écran. */}
          <div className="method-rail__track" aria-hidden>
            <motion.span
              className="method-rail__fill"
              style={reduced ? { scale: 1 } : { scaleX: fill, scaleY: fill }}
            />
          </div>

          <ol className="relative grid gap-9 md:grid-cols-4 md:gap-6">
            {items.map((it, i) => (
              <Reveal
                as="li"
                key={it.k}
                className="method-rail__step md:pt-8"
                delay={i * 0.08}
              >
                <span className="method-rail__dot" aria-hidden />
                <span className="mt-4 block font-mono text-[11px] leading-none tracking-[0.16em] text-muted-foreground md:mt-0">
                  {it.k}
                </span>
                <h3 className="mt-2 font-display text-lg font-bold tracking-tight text-foreground">
                  {it.t}
                </h3>
                <p className="mt-1.5 max-w-[26ch] text-[15px] leading-relaxed text-muted-foreground">
                  {it.d}
                </p>
              </Reveal>
            ))}
          </ol>
        </div>
      </div>
    </section>
  );
}