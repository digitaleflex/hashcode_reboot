"use client";

import { Logo } from "@/components/brand/logo";
import { RebootButton, CtaArrow } from "../shared";
import { AccountLink } from "./account-link";
import { scrollToId } from "./scroll";

export function SiteHeader({ onJoin }: { onJoin: () => void }) {
  return (
    <header className="sticky top-0 z-40 bg-background/85 backdrop-blur-sm border-b border-border/60">
      <div className="mx-auto max-w-6xl px-5 sm:px-8 h-16 flex items-center justify-between gap-3">
        <Logo variant="full" size="sm" />
        <nav
          className="hidden md:flex items-center gap-5 text-sm text-muted-foreground"
          aria-label="Navigation"
        >
          <button
            onClick={() => scrollToId("axes")}
            className="min-h-[44px] inline-flex items-center hover:text-lime transition-colors focus-lime"
          >
            Axes
          </button>
          <a
            href="/evenements"
            className="min-h-[44px] inline-flex items-center hover:text-lime transition-colors focus-lime"
          >
            Événements
          </a>
          <button
            onClick={() => scrollToId("faq")}
            className="min-h-[44px] inline-flex items-center hover:text-lime transition-colors focus-lime"
          >
            FAQ
          </button>
          <span className="text-[13px] text-muted-foreground" aria-hidden>
            Reboot · Édition 2026
          </span>
          <AccountLink />
          <RebootButton size="md" onClick={onJoin} className="group">
            Construire mon profil
            <CtaArrow />
          </RebootButton>
        </nav>
        <div className="hidden sm:flex md:hidden items-center gap-6">
          <a
            href="/evenements"
            className="min-h-[44px] inline-flex items-center text-sm text-muted-foreground hover:text-lime transition-colors focus-lime"
          >
            Événements
          </a>
          <AccountLink />
          <RebootButton size="md" onClick={onJoin} className="group">
            Construire mon profil
            <CtaArrow />
          </RebootButton>
        </div>
        <div className="flex sm:hidden items-center gap-2">
          <a
            href="/evenements"
            className="min-h-[44px] inline-flex items-center text-sm text-muted-foreground hover:text-lime transition-colors focus-lime"
          >
            Événements
          </a>
          <AccountLink />
          <RebootButton
            size="md"
            variant="outline"
            onClick={onJoin}
          >
            Rejoindre
          </RebootButton>
        </div>
      </div>
    </header>
  );
}
