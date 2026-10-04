"use client";

import { RebootButton, CtaArrow, SectionHeader } from "../shared";
import { Faq } from "./faq";
import { Reveal } from "../motion/primitives";
import { useTranslations } from "next-intl";

/**
 * §24 — FAQ.
 *
 * Comportement fonctionnel inchangé : Accordion shadcn (single + collapsible),
 * bouton de confidentialité branché sur `onOpenPrivacy` — c'est lui qui ouvre
 * la modale de confidentialité de `page.tsx`. Ne pas le retirer.
 *
 * `id="faq"` est un point d'ancrage structurel (header + footer).
 */
export function FaqSection({
  onJoin,
  onOpenPrivacy,
}: {
  onJoin: (ref?: string) => void;
  onOpenPrivacy?: () => void;
}) {
  const t = useTranslations("landing.faq");

  return (
    <section
      id="faq"
      className="section scroll-mt-20 border-t border-border/60 cv-auto"
      aria-labelledby="faq-title"
    >
      <div className="shell">
        <div className="grid gap-10 lg:grid-cols-12 lg:gap-16">
          <div className="lg:col-span-4">
            <div className="lg:sticky lg:top-28">
              <SectionHeader
                index={t("index")}
                title={<span id="faq-title">{t("title")}</span>}
                intro={t("intro")}
              />
            </div>
          </div>

          <div className="lg:col-span-8">
            <Reveal>
              <Faq onOpenPrivacy={onOpenPrivacy} />
            </Reveal>
            <Reveal delay={0.08}>
              <div className="mt-10">
                <RebootButton
                  size="lg"
                  onClick={() => onJoin("faq")}
                  className="group w-full sm:w-auto"
                >
                  {t("cta")}
                  <CtaArrow />
                </RebootButton>
              </div>
            </Reveal>
          </div>
        </div>
      </div>
    </section>
  );
}