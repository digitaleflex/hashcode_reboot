"use client";

import { ScrollReveal } from "../scroll-reveal";

export function Testimonial() {
  return (
    <section className="mx-auto max-w-4xl w-full px-5 sm:px-8 py-16 sm:py-24 cv-auto">
      <ScrollReveal>
      <div className="relative rounded-md border border-border/60 bg-card/60 p-6 sm:p-8">
        {/* Large quote mark — engineered motif */}
        <span
          className="absolute -top-6 -left-2 text-lime/20 font-display text-7xl select-none pointer-events-none"
          aria-hidden
        >
          «
        </span>
        <blockquote className="relative z-10">
          <p className="font-display text-xl sm:text-2xl text-foreground leading-relaxed text-balance">
            Je suis arrivé curieux, reparti avec un plan clair et mon premier
            challenge à faire cette semaine. On sait enfin où aller.
          </p>
          <footer className="mt-6 flex items-center gap-3">
            <span
              className="shrink-0 size-11 rounded-full border border-lime/50 bg-lime/10 flex items-center justify-center font-display font-bold text-lime"
              aria-hidden
            >
              A
            </span>
            <div>
              <div className="font-display font-semibold text-sm text-foreground">
                Aïcha · Étudiante
              </div>
              <div className="soft-note">
                Débutante web · Première cohorte 2026
              </div>
            </div>
          </footer>
        </blockquote>
      </div>
      </ScrollReveal>
    </section>
  );
}
