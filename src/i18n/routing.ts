import { defineRouting } from "next-intl/routing";
import { createNavigation } from "next-intl/navigation";

/**
 * T08 — Routage i18n (next-intl).
 *
 * - `fr` = locale par défaut, SANS préfixe d'URL (`localePrefix: "as-needed"`).
 *   Toutes les URLs existantes (/dashboard, /login, …) continuent de
 *   fonctionner telles quelles — le middleware les réécrit en interne
 *   vers /fr/….
 * - `en` = seconde locale, servie SOUS préfixe (/en/…).
 *
 * T09 extraira les messages complets, T10 migrera les composants vers
 * useTranslations(). Ici : infra de routage uniquement.
 */
export const routing = defineRouting({
  locales: ["fr", "en"],
  defaultLocale: "fr",
  localePrefix: "as-needed",
});

export type Locale = (typeof routing.locales)[number];

// Helpers de navigation conscients de la locale (utilisés par T10).
export const { Link, redirect, usePathname, useRouter, getPathname } =
  createNavigation(routing);
