"use client";

import * as React from "react";
import { Logo } from "@/components/brand/logo";
import { Link as I18nLink } from "@/i18n/routing";
import { RebootButton, CtaArrow } from "../shared";
import { AccountLink } from "./account-link";
import { scrollToId } from "./scroll";
import { cn } from "@/lib/utils";
import { useTranslations } from "next-intl";

const NAV_CLS =
  "inline-flex min-h-[44px] items-center text-sm text-muted-foreground transition-colors hover:text-foreground focus-lime";

/** Nav partagée entre les 3 breakpoints — une seule source de vérité. */
function SiteNav({
  labels,
  ariaLabel,
}: {
  labels: string[];
  ariaLabel: string;
}) {
  return (
    <nav className="hidden items-center gap-5 md:flex" aria-label={ariaLabel}>
      <button type="button" onClick={() => scrollToId("axes")} className={NAV_CLS}>
        {labels[0]}
      </button>
      <I18nLink href="/evenements" className={NAV_CLS}>
        {labels[1]}
      </I18nLink>
      <button type="button" onClick={() => scrollToId("faq")} className={NAV_CLS}>
        {labels[2]}
      </button>
    </nav>
  );
}

/**
 * Header du site.
 *
 * - Le badge « Édition 2026 » a été retiré : c'était une donnée fabriquée
 *   (aucune source dans le dépôt), et le lime n'est censé porter que du sens.
 * - `/evenements` passe par `Link` de `@/i18n/routing` : avec `next/link`
 *   brut, un visiteur EN arrivait sur la version FR.
 * - Le CTA de droite déclenche exactement le même `onJoin` que le hero
 *   (avec un `ref` distinct pour l'attribution).
 */
export function SiteHeader({ onJoin }: { onJoin: (ref?: string) => void }) {
  const t = useTranslations("landing.siteHeader");
  const navLinks = t.raw("links") as string[];

  return (
    <header className="sticky top-0 z-40 border-b border-border/60 bg-background/85 backdrop-blur-md">
      <div className="shell flex h-16 items-center justify-between gap-3">
        <Logo variant="full" size="sm" />

        {/* Desktop : nav complète + compte + CTA */}
        <div className="hidden items-center gap-5 md:flex">
          <SiteNav labels={navLinks} ariaLabel={t("navAria")} />
          <AccountLink />
          <RebootButton
            size="md"
            onClick={() => onJoin("header-desktop")}
            className="group"
          >
            {t("cta")}
            <CtaArrow />
          </RebootButton>
        </div>

        {/* Tablette : moins de liens, on garde l'accès aux événements + compte */}
        <div className="hidden items-center gap-5 sm:flex md:hidden">
          <I18nLink href="/evenements" className={NAV_CLS}>
            {navLinks[1]}
          </I18nLink>
          <AccountLink />
          <RebootButton
            size="md"
            onClick={() => onJoin("header-tablet")}
            className="group"
          >
            {t("cta")}
            <CtaArrow />
          </RebootButton>
        </div>

        {/* Mobile : CTA raccourci, pas de menu (le sticky CTA couvre l'entrée) */}
        <div className="flex items-center gap-2 sm:hidden">
          <AccountLink />
          <RebootButton
            size="md"
            onClick={() => onJoin("header-mobile")}
          >
            {t("ctaMobile")}
          </RebootButton>
        </div>
      </div>
    </header>
  );
}