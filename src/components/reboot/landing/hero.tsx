"use client";

import { ChevronDown, Check } from "lucide-react";
import { HashSymbol } from "@/components/brand/logo";
import { RebootButton, CtaArrow, Eyebrow, RebootTitle } from "../shared";
import { scrollToId } from "./scroll";
import { STEPS } from "./data";
import { useTranslations } from "next-intl";

export function Hero({ onJoin }: { onJoin: () => void }) {
  const t = useTranslations("landing.hero");
  const stepsTranslated = t.raw("steps") as Array<{ n: string; title: string; desc: string }>;
  return (
    <section className="relative overflow-hidden bg-vignette bg-noise">
      <div className="absolute inset-0 bg-grid opacity-70" aria-hidden />
      {/* Lime aura in upper-left for depth (subtle, never gradient-y) */}
      {/* Visible from md (768px) with fade-in, respects prefers-reduced-motion via CSS */}
      <div
        className="hero-aura absolute -top-32 -left-24 size-[28rem] rounded-full blur-3xl opacity-0 md:opacity-[0.06] transition-opacity duration-500"
        style={{ background: "var(--primary)" }}
        aria-hidden
      />
      {/* Faint large H in corner — engineered motif, not decoration (desktop ≥1024px only) */}
      <HashSymbol
        className="hero-hash absolute -right-16 -bottom-16 text-border/40 select-none pointer-events-none opacity-0 lg:opacity-[0.15] transition-opacity duration-500"
        size={360}
      />
      <div className="relative z-10 mx-auto max-w-6xl px-5 sm:px-8 py-10 sm:py-20 lg:py-24">
        <Eyebrow>{t("eyebrow")}</Eyebrow>
        <RebootTitle className="mt-4" />
        <h2 className="mt-7 max-w-xl text-3xl sm:text-4xl text-foreground font-display font-bold leading-tight text-balance">
          {t("subtitle")}
        </h2>
        <p className="mt-3 max-w-xl text-muted-foreground text-base sm:text-lg leading-relaxed">
          {t("description")}
        </p>

        <div className="mt-8 flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
          <RebootButton size="lg" onClick={onJoin} className="group w-full sm:w-auto">
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

        {/* Micro-réassurance lisible */}
        <p className="mt-6 flex flex-wrap items-center gap-2 text-sm text-foreground leading-relaxed">
          <span className="inline-flex size-5 items-center justify-center rounded-full bg-lime/10 border border-lime/40">
            <Check className="size-3.5 text-lime" strokeWidth={2.5} />
          </span>
          {t("reassurance")}
        </p>

        {/* 3 étapes visuelles */}
        <ol className="mt-8 grid gap-3 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
          {STEPS.map((s) => {
            const stepTranslated = stepsTranslated.find((st) => st.n === s.n);
            if (!stepTranslated) return null;
            const Icon = s.icon;
            return (
              <li
                key={s.n}
                className="flex items-start gap-3 rounded-md border border-border/60 bg-card/70 p-4 backdrop-blur-[2px]"
              >
                <span className="shrink-0 size-10 rounded-md border border-lime/40 bg-lime/5 flex items-center justify-center text-lime">
                  <Icon className="size-5" />
                </span>
                <span className="min-w-0">
                  <span className="text-[12px] font-medium tracking-[0.06em] text-lime">{t("stepLabel", { n: s.n })}</span>
                  <span className="block mt-1 font-display font-semibold text-[15px] text-foreground leading-snug">
                    {stepTranslated.title}
                  </span>
                  <span className="block mt-0.5 text-sm text-muted-foreground leading-snug">
                    {stepTranslated.desc}
                  </span>
                </span>
              </li>
            );
          })}
        </ol>
        <p className="mt-3 text-sm text-muted-foreground">
          {t("altNote")}
        </p>
      </div>

      {/* Scroll indicator — subtle animated chevron, desktop only */}
      <button
        onClick={() =>
          window.scrollTo({
            top: window.innerHeight * 0.85,
            behavior: "smooth",
          })
        }
        className="absolute bottom-6 left-1/2 -translate-x-1/2 hidden sm:flex flex-col items-center gap-1.5 text-muted-foreground hover:text-lime transition-colors focus-lime group"
        aria-label={t("scrollAria")}
      >
        <span className="text-[12px] tracking-[0.06em]">{t("scrollLabel")}</span>
        <ChevronDown className="size-4 animate-bounce-slow" />
      </button>
    </section>
  );
}