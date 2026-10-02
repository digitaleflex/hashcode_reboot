"use client";

import { Logo } from "@/components/brand/logo";
import { scrollToId } from "./scroll";
import { SocialProofBar } from "./social-proof";
import { useTranslations } from "next-intl";

export function SiteFooter({
  onJoin,
  onOpenPrivacy,
}: {
  onJoin: () => void;
  onOpenPrivacy?: () => void;
}) {
  const t = useTranslations("landing.footer");
  const links = t.raw("links") as string[];
  const socialProof = t.raw("socialProof") as Array<{ value: string; label: string }>;
  const liveCount = t.raw("liveCount") as {
    valueWithCount: string;
    valueEmpty: string;
    labelWithCount: string;
    labelEmpty: string;
  };
  return (
    <footer className="mt-auto border-t border-border/60 bg-background pb-24">
      {/* Social proof stats bar — modeste et crédible */}
      <SocialProofBar />
      <div className="mx-auto max-w-6xl px-5 sm:px-8 py-10 grid gap-6 sm:grid-cols-3 items-start">
        <div className="space-y-3">
          <Logo variant="full" size="sm" />
          <p className="text-sm text-muted-foreground max-w-xs leading-relaxed">
            {t("description")}
          </p>
        </div>
        <div className="space-y-2 sm:col-span-1">
          <p className="text-sm font-semibold text-foreground">{t("linksTitle")}</p>
          <ul className="space-y-1 text-sm text-muted-foreground">
            <li>
              <button
                onClick={onJoin}
                className="min-h-[44px] inline-flex items-center hover:text-lime transition-colors focus-lime"
              >
                {links[0]}
              </button>
            </li>
            <li>
              <button
                onClick={() => scrollToId("axes")}
                className="min-h-[44px] inline-flex items-center hover:text-lime transition-colors focus-lime"
              >
                {links[1]}
              </button>
            </li>
            <li>
              <button
                onClick={() => scrollToId("faq")}
                className="min-h-[44px] inline-flex items-center hover:text-lime transition-colors focus-lime"
              >
                {links[2]}
              </button>
            </li>
          </ul>
        </div>
        <div className="space-y-2 sm:text-right">
          <p className="text-sm font-semibold text-foreground sm:text-right">{t("privacyTitle")}</p>
          <p className="text-sm text-muted-foreground max-w-xs sm:ml-auto leading-relaxed">
            {t("privacyDesc")}
          </p>
          <button
            onClick={onOpenPrivacy}
            className="min-h-[44px] text-sm text-lime hover:text-lime/80 transition-colors focus-lime inline-flex items-center gap-1 sm:justify-end"
          >
            {t("privacyLink")}
          </button>
        </div>
      </div>
      <div className="border-t border-border/60">
        <div className="mx-auto max-w-6xl px-5 sm:px-8 py-4 flex flex-col sm:flex-row items-center justify-between gap-2">
          <span className="text-[12px] tracking-[0.06em] text-muted-foreground">
            {t("copyright")}
          </span>
          <span className="text-[12px] tracking-[0.06em] text-muted-foreground">
            {t("tagline")}
          </span>
        </div>
      </div>
    </footer>
  );
}