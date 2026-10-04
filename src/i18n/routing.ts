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
  /**
   * `localeDetection: false` — la locale est déterminée par l'URL uniquement.
   *
   * next-intl applique `true` par défaut, ce qui envoyait :
   *   - `/`        -> `/en`        pour un navigateur anglophone
   *   - `/login`   -> `/en/login`  (bascule de langue en plein parcours d'auth)
   *
   * Deux conséquences incompatibles avec le reste du site :
   * 1. `metadata.alternates.canonical` vaut `"/"` — une URL canonique qui ne
   *    l'est plus dès que le visiteur préfère l'anglais.
   * 2. Un lien FR partagé vers `/` peut afficher la version anglaise.
   *
   * Le choix de langue se fait donc par l'URL (`/en/...`), ce qui rend chaque
   * version stable et partageable. Pour revenir au comportement précédent :
   * supprimer cette ligne (ou passer `localeDetection: true`).
   */
  localeDetection: false,
});

export type Locale = (typeof routing.locales)[number];

// Helpers de navigation conscients de la locale (utilisés par T10).
export const { Link, redirect, usePathname, useRouter, getPathname } =
  createNavigation(routing);
