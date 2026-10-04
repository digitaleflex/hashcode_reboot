"use client";

import { Link as I18nLink } from "@/i18n/routing";
import { useMemberSession } from "@/lib/use-member-session";
import { useTranslations } from "next-intl";

const LINK_CLS =
  "inline-flex min-h-[44px] items-center text-sm text-muted-foreground transition-colors hover:text-foreground focus-lime";

/**
 * Entrée d'espace : « Mon espace » si connecté, sinon « Se connecter ».
 *
 * Un membre connecté ne doit pas voir « Se connecter » en quittant son espace.
 *
 * Le lien passe par `Link` de `@/i18n/routing` : en `localePrefix:
 * "as-needed"`, un `next/link` brut vers `/dashboard` envoyait un visiteur EN
 * vers la version FR.
 */
export function AccountLink() {
  const t = useTranslations("landing.accountLink");
  const session = useMemberSession();
  const isAuthed = session.status === "authenticated";

  return (
    <I18nLink href={isAuthed ? "/dashboard" : "/login"} className={LINK_CLS}>
      {isAuthed
        ? session.firstName
          ? t("authenticatedWithName", { firstName: session.firstName })
          : t("authenticated")
        : t("anonymous")}
    </I18nLink>
  );
}