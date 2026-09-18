"use client";

import { SectionHeader } from "./shared";
import { ScrollReveal } from "./scroll-reveal";
import { SiteHeader } from "./landing/site-header";
import { Hero } from "./landing/hero";
import { Axes } from "./landing/axes";
import { Pillars } from "./landing/pillars";
import { Audience } from "./landing/audience";
import { Testimonial } from "./landing/testimonial";
import { Coming } from "./landing/coming";
import { FaqSection } from "./landing/faq-section";
import { FinalCta } from "./landing/final-cta";
import { SiteFooter } from "./landing/site-footer";
import { StickyMobileCta } from "./landing/sticky-cta";

export function Landing({
  onJoin,
  onOpenPrivacy,
}: {
  onJoin: () => void;
  onOpenPrivacy?: () => void;
}) {
  return (
    <div className="bg-background min-h-screen flex flex-col pb-[76px] sm:pb-0">
      {/* Nav */}
      <SiteHeader onJoin={onJoin} />

      {/* Hero */}
      <Hero onJoin={onJoin} />

      <div className="divider-grad" />

      {/* Why */}
      <section className="mx-auto max-w-6xl w-full px-5 sm:px-8 py-12 sm:py-24 cv-auto">
        <ScrollReveal>
          <SectionHeader
            index="01 · Pourquoi on revient"
            title="HASHCODE évolue."
            intro="Le contenu seul ne suffit plus. On veut un environnement où les membres peuvent apprendre, pratiquer, construire, collaborer et progresser — pour de vrai."
          />
        </ScrollReveal>
      </section>

      <div className="divider-grad" />

      {/* 3 Axes — index list, not 3 identical cards */}
      <Axes onJoin={onJoin} />

      <div className="divider-grad" />

      {/* What changes — carrousel mobile, grille desktop */}
      <Pillars />

      <div className="divider-grad" />

      {/* For who */}
      <Audience onJoin={onJoin} />

      <div className="divider-grad" />

      {/* Témoignage membre — preuve humaine */}
      <Testimonial />

      <div className="divider-grad" />

      {/* What's coming — timeline avec statuts */}
      <Coming />

      <div className="divider-grad" />

      {/* FAQ — questions fréquentes */}
      <FaqSection onJoin={onJoin} onOpenPrivacy={onOpenPrivacy} />

      <div className="divider-grad" />

      {/* Final CTA */}
      <FinalCta onJoin={onJoin} />

       {/* Sticky footer */}
      <SiteFooter onJoin={onJoin} onOpenPrivacy={onOpenPrivacy} />
      <StickyMobileCta onJoin={onJoin} />
    </div>
  );
}
