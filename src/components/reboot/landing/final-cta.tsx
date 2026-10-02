"use client";

import { Check } from "lucide-react";
import { HashSymbol } from "@/components/brand/logo";
import { RebootButton, CtaArrow } from "../shared";
import { useTranslations } from "next-intl";

export function FinalCta({ onJoin }: { onJoin: () => void }) {
  const t = useTranslations("landing.finalCta");
  return (
    <section id="rejoindre" className="relative overflow-hidden bg-vignette bg-noise scroll-mt-20">
      <div className="absolute inset-0 bg-grid opacity-60" aria-hidden />
      <div className="relative z-10 mx-auto max-w-6xl w-full px-5 sm:px-8 py-20 sm:py-32 text-center">
        <div className="relative inline-flex items-center justify-center">
          <span
            className="absolute size-20 rounded-full opacity-20 animate-hash-pulse"
            style={{ background: "var(--primary)", filter: "blur(20px)" }}
            aria-hidden
          />
          <HashSymbol className="relative text-lime" size={48} />
        </div>
        <h2 className="mt-6 font-display font-bold text-3xl sm:text-4xl tracking-tight text-foreground text-balance">
          {t("title")}
        </h2>
        <p className="mt-4 max-w-xl mx-auto text-muted-foreground text-base sm:text-lg">
          {t("description")}
        </p>
        <div className="mt-8 flex justify-center">
          <RebootButton size="lg" onClick={onJoin} className="group w-full sm:w-auto">
            {t("cta")}
            <CtaArrow />
          </RebootButton>
        </div>
        <p className="mt-6 flex items-center justify-center gap-2 text-sm text-foreground">
          <Check className="size-4 text-lime shrink-0" strokeWidth={2.5} />
          {t("reassurance")}
        </p>
      </div>
    </section>
  );
}