import type { AbstractIntlMessages } from "next-intl";

/**
 * Sous-ensemble de messages pour `NextIntlClientProvider`.
 *
 * Seuls les namespaces réellement consommés côté client transitent vers le
 * navigateur ; les autres restent côté serveur (`getTranslations`). Le layout
 * racine exclut les gros namespaces réservés à des routes authentifiées
 * (`admin`, `dashboard`), qui les réinjectent dans leur propre layout — ils ne
 * grossissent donc plus le payload des pages publiques (landing, login…).
 *
 * `NextIntlClientProvider` **remplace** les messages (pas de fusion avec le
 * provider parent) : chaque provider doit donc fournir l'ensemble complet dont
 * son sous-arbre a besoin.
 */
export function selectMessages(
  all: AbstractIntlMessages,
  exclude: readonly string[] = [],
): AbstractIntlMessages {
  if (exclude.length === 0) return all;
  const excluded = new Set(exclude);
  const out: AbstractIntlMessages = {};
  for (const [ns, value] of Object.entries(all)) {
    if (!excluded.has(ns)) out[ns] = value;
  }
  return out;
}

/** Namespaces réservés aux routes authentifiées (exclus des pages publiques). */
export const HEAVY_AUTH_NAMESPACES = ["admin", "dashboard"] as const;
