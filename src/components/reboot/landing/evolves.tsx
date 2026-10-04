"use client";

import * as React from "react";
import { motion, useReducedMotion, useScroll, useSpring } from "framer-motion";
import { SectionHeader } from "../shared";
import { Reveal } from "../motion/primitives";
import { useTranslations } from "next-intl";

/**
 * §14 — HASHCODE ÉVOLUE.
 *
 * Timeline CONCEPTUELLE (Avant / Le pivot / Maintenant). Aucune date n'est
 * affichée : le dépôt ne contient aucune source permettant d'attribuer une
 * année à un état du produit, et en inventer une serait une fabrication.
 *
 * La ligne verticale se dessine au scroll (transform uniquement).
 */
export function Evolves() {
  const t = useTranslations("landing.evolves");
  const steps = t.raw("steps") as Array<{ k: string; t: string; d: string }>;

  const ref = React.useRef<HTMLDivElement>(null);
  const reduced = !!useReducedMotion();
  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ["start 0.75", "end 0.5"],
  });
  const fill = useSpring(scrollYProgress, {
    stiffness: 140,
    damping: 32,
    mass: 0.4,
  });

  return (
    <section className="section" aria-labelledby="evolves-title">
      <div className="shell">
        <div className="grid gap-10 lg:grid-cols-12 lg:gap-16">
          {/* Colonne éditoriale — collante sur desktop pour que le lecteur
              garde le titre pendant qu'il parcourt les 3 étapes. */}
          <div className="lg:col-span-4">
            <div className="lg:sticky lg:top-28">
              <SectionHeader
                index={t("index")}
                title={
                  <span id="evolves-title">{t("title")}</span>
                }
                intro={t("intro")}
              />
            </div>
          </div>

          <div className="lg:col-span-8">
            <div ref={ref} className="timeline">
              {/* Piste neutre */}
              <span className="timeline__spine" aria-hidden />
              {/* Lime = progression accomplishments, pas décoration. */}
              <motion.span
                className="timeline__spine timeline__spine--fill"
                style={{ scaleY: reduced ? 1 : fill }}
                aria-hidden
              />

              <ol className="relative flex flex-col gap-9 sm:gap-10">
                {steps.map((s, i) => (
                  <Reveal as="li" key={s.k} className="timeline__item" delay={i * 0.06}>
                    <span className="timeline__node" aria-hidden />
                    <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                      <h3 className="font-display text-lg font-bold tracking-tight text-foreground sm:text-xl">
                        {s.t}
                      </h3>
                      <span className="mono-label text-[10px] uppercase tracking-[0.16em] text-lime">
                        {s.k}
                      </span>
                    </div>
                    <p className="mt-2 max-w-lg text-[15px] leading-relaxed text-muted-foreground">
                      {s.d}
                    </p>
                  </Reveal>
                ))}
              </ol>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}