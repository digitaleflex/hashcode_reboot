"use client";

import * as React from "react";
import { SectionHeader } from "../shared";
import { Reveal } from "../motion/primitives";
import { useScrollFill } from "../motion/use-scroll-fill";
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
  // Remplissage du rail piloté par le scroll (var CSS `--fill`), sans
  // framer-motion. Voir globals.css `.method-rail__fill`.
  useScrollFill(railRef);

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
            <span className="method-rail__fill" />
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
                <span className="ds-overlabel mt-4 block leading-none md:mt-0">
                  {it.k}
                </span>
                <h3 className="mt-2 ds-h3 text-foreground">
                  {it.t}
                </h3>
                <p className="mt-1.5 max-w-[26ch] ds-body-sm leading-relaxed text-muted-foreground">
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