"use client";

import * as React from "react";
import { Logo } from "@/components/brand/logo";
import { Link as I18nLink } from "@/i18n/routing";
import { useMemberSession } from "@/lib/use-member-session";
import { scrollToId } from "./scroll";
import { SocialProofBar } from "./social-proof";
import { useTranslations } from "next-intl";

type LinkAction =
  | "join"
  | "axes"
  | "method"
  | "events"
  | "faq"
  | "account"
  | "privacy"
  | "cgu"
  | "legal"
  | "cookies";

type FooterColumn = { title: string; links: Array<{ t: string; a: string }> };

/**
 * Pages légales : /cgu, /mentions-legales, /cookies et /confidentialite
 * ont bien une route, mais leur namespace i18n `legal.*` est absent de
 * messages/{fr,en}.json — elles échouent au rendu et font échouer
 * `next build`. Elles ne sont donc pas encore liées depuis le footer : on
 * préfère zéro lien mort à trois liens cassés. À réactiver dès que le
 * contenu juridique réel est fourni (ici : `legal.privacy`).
 */
const LEGAL_HREF: Record<string, string> = {};

/** ancres de la landing (cf. ids structurels dans les sections). */
const ANCHOR: Record<string, string> = {
  axes: "axes",
  method: "method",
  faq: "faq",
};

const LINK_CLS =
  "inline-flex min-h-[44px] items-center text-sm text-muted-foreground underline-offset-4 transition-colors hover:text-foreground hover:underline focus-lime";

/**
 * §26 — FOOTER.
 *
 * Le contenu est piloté par `landing.footer.columns` (i18n) mais la
 * *destination* est résolue ici, en code : c'est la seule façon d'avoir des
 * liens vrais (`next/link` conscient de la locale, ancres, CTA) sans
 * mettre une URL dans les traductions.
 *
 * Toutes les cibles existent réellement :
 *   /evenements, /cgu, /mentions-legales, /cookies, /login, /dashboard
 * et les ancres #axes #method #faq présentes sur la page.
 */
export function SiteFooter({
  onJoin,
  onOpenPrivacy,
}: {
  onJoin: (ref?: string) => void;
  onOpenPrivacy?: () => void;
}) {
  const t = useTranslations("landing.footer");
  const columns = t.raw("columns") as FooterColumn[];
  const session = useMemberSession();
  const isAuthed = session.status === "authenticated";

  // Année calculée, pas codée en dur dans la traduction.
  const year = React.useMemo(() => new Date().getFullYear(), []);

  const renderLink = (action: string, label: string) => {
    if (action === "join") {
      return (
        <button type="button" onClick={() => onJoin("footer-join")} className={LINK_CLS}>
          {label}
        </button>
      );
    }
    if (action === "account") {
      return (
        <I18nLink href={isAuthed ? "/dashboard" : "/login"} className={LINK_CLS}>
          {label}
        </I18nLink>
      );
    }
    if (action === "privacy") {
      // Ouvre la modale existante — comportement historique à préserver.
      return (
        <button
          type="button"
          onClick={onOpenPrivacy}
          className={`${LINK_CLS} hover:text-lime`}
        >
          {label}
        </button>
      );
    }
    if (ANCHOR[action]) {
      return (
        <button
          type="button"
          onClick={() => scrollToId(ANCHOR[action])}
          className={LINK_CLS}
        >
          {label}
        </button>
      );
    }
    if (LEGAL_HREF[action]) {
      return (
        <I18nLink href={LEGAL_HREF[action]} className={LINK_CLS}>
          {label}
        </I18nLink>
      );
    }
    // "events" et tout cas inconnu.
    return (
      <I18nLink href="/evenements" className={LINK_CLS}>
        {label}
      </I18nLink>
    );
  };

  return (
    <footer className="mt-auto border-t border-border/60 bg-background pb-24 sm:pb-0">
      {/* Compteurs — uniquement des données réelles. */}
      <SocialProofBar />

      <div className="shell py-12 lg:py-14">
        <div className="grid gap-10 lg:grid-cols-12 lg:gap-8">
          {/* Marque */}
          <div className="lg:col-span-4">
            <Logo variant="full" size="sm" />
            <p className="mt-4 max-w-xs text-sm leading-relaxed text-muted-foreground">
              {t("description")}
            </p>
          </div>

          {/* Colonnes de navigation */}
          <nav
            aria-label={t("navAria")}
            className="grid grid-cols-2 gap-8 sm:grid-cols-4 lg:col-span-8"
          >
            {columns.map((col) => (
              <div key={col.title}>
                <h2 className="font-display text-[13px] font-semibold uppercase tracking-[0.08em] text-foreground">
                  {col.title}
                </h2>
                <ul role="list" className="mt-2 flex flex-col">
                  {col.links.map((l, i) => (
                    <li key={`${l.a}-${i}`}>{renderLink(l.a, l.t)}</li>
                  ))}
                </ul>
              </div>
            ))}
          </nav>
        </div>

        {/* Confiance — réassurance courte, avant la barre légale. */}
        <div className="mt-12 border-t border-border/60 pt-8">
          <div className="flex flex-wrap items-start justify-between gap-6">
            <div className="max-w-md">
              <h2 className="font-display text-sm font-semibold text-foreground">
                {t("privacyTitle")}
              </h2>
              <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
                {t("privacyDesc")}
              </p>
            </div>
            <button
              type="button"
              onClick={onOpenPrivacy}
              className="inline-flex min-h-[44px] items-center gap-1 text-sm text-lime underline underline-offset-4 transition-colors hover:text-lime/80 focus-lime"
            >
              {t("privacyLink")}
            </button>
          </div>
        </div>
      </div>

      <div className="border-t border-border/60">
        <div className="shell flex flex-col items-center justify-between gap-2 py-4 sm:flex-row">
          <span className="text-[12px] tracking-[0.06em] text-muted-foreground">
            {t("copyright", { year })}
          </span>
          <span className="text-[12px] tracking-[0.06em] text-muted-foreground">
            {t("tagline")}
          </span>
        </div>
      </div>
    </footer>
  );
}