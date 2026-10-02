"use client";

import { Logo } from "@/components/brand/logo";
import { RebootButton, CtaArrow } from "../shared";
import { AccountLink } from "./account-link";
import { scrollToId } from "./scroll";
import { useTranslations } from "next-intl";

export function SiteHeader({ onJoin }: { onJoin: () => void }) {
  const t = useTranslations("landing.siteHeader");
  const navLinks = t.raw("links") as string[];
  return (
    <header className="sticky top-0 z-40 bg-background/85 backdrop-blur-sm border-b border-border/60">
      <div className="mx-auto max-w-6xl px-5 sm:px-8 h-16 flex items-center justify-between gap-3">
        <Logo variant="full" size="sm" />
        <nav
          className="hidden md:flex items-center gap-5 text-sm text-muted-foreground"
          aria-label={t("navAria")}
        >
          <button
            onClick={() => scrollToId("axes")}
            className="min-h-[44px] inline-flex items-center hover:text-lime transition-colors focus-lime"
          >
            {navLinks[0]}
          </button>
          <a
            href="/evenements"
            className="min-h-[44px] inline-flex items-center hover:text-lime transition-colors focus-lime"
          >
            {navLinks[1]}
          </a>
          <button
            onClick={() => scrollToId("faq")}
            className="min-h-[44px] inline-flex items-center hover:text-lime transition-colors focus-lime"
          >
            {navLinks[2]}
          </button>
          <span className="text-[13px] text-muted-foreground" aria-hidden>
            {t("editionBadge")}
          </span>
          <AccountLink />
          <RebootButton size="md" onClick={onJoin} className="group">
            {t("cta")}
            <CtaArrow />
          </RebootButton>
        </nav>
        <div className="hidden sm:flex md:hidden items-center gap-6">
          <a
            href="/evenements"
            className="min-h-[44px] inline-flex items-center text-sm text-muted-foreground hover:text-lime transition-colors focus-lime"
          >
            {navLinks[1]}
          </a>
          <AccountLink />
          <RebootButton size="md" onClick={onJoin} className="group">
            {t("cta")}
            <CtaArrow />
          </RebootButton>
        </div>
        <div className="flex sm:hidden items-center gap-2">
          <a
            href="/evenements"
            className="min-h-[44px] inline-flex items-center text-sm text-muted-foreground hover:text-lime transition-colors focus-lime"
          >
            {navLinks[1]}
          </a>
          <AccountLink />
          <RebootButton
            size="md"
            variant="outline"
            onClick={onJoin}
          >
            {t("ctaMobile")}
          </RebootButton>
        </div>
      </div>
    </header>
  );
}