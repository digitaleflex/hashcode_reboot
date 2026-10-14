import type { AbstractIntlMessages } from "next-intl";

/**
 * Sous-ensemble de messages pour `NextIntlClientProvider`.
 *
 * Seuls les namespaces réellement consommés côté client transitent vers le
 * navigateur ; les autres restent côté serveur (`getTranslations`).
 *
 * Le layout racine fournit un **jeu minimal** (`ROOT_CLIENT_NAMESPACES`) :
 * ceux dont la landing et les pages publiques sans provider dédié ont besoin.
 * Les routes qui consomment d'autres namespaces les réinjectent dans leur
 * propre layout (`auth`, `profile`, `dashboard`, `admin`).
 *
 * `NextIntlClientProvider` **remplace** les messages (pas de fusion avec le
 * provider parent) : chaque provider doit donc fournir l'ensemble complet dont
 * son sous-arbre a besoin.
 *
 * Note : `selectMessages` (liste d'exclusion) est conservé pour les layouts
 * authentifiés ; `pickMessages` (liste d'inclusion) est le modèle recommandé
 * pour toute nouvelle scoping, car il ne peut pas « fuiter » par omission.
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

/**
 * Ne conserve que les namespaces listés. Contrairement à `selectMessages`,
 * aucun namespace non listé ne peut être envoyé au client par accident.
 */
export function pickMessages(
  all: AbstractIntlMessages,
  include: readonly string[],
): AbstractIntlMessages {
  const out: AbstractIntlMessages = {};
  for (const ns of include) {
    if (ns in all) out[ns] = all[ns];
  }
  return out;
}

/* ------------------------------------------------------------------ */
/* Jeux de namespaces par frontière de provider                        */
/* ------------------------------------------------------------------ */

/**
 * Layout racine `[locale]` — landing + pages publiques sans provider dédié
 * (`/`, `/evenements`, pages légales, 404). Tous les `useTranslations` de ces
 * sous-arbres n'utilisent que ces deux namespaces (`legal`/`legalPending`/
 * `notFound` sont strictement serveur : `getTranslations`).
 *
 * ⚠️ `profiling` est nécessaire à la landing : `app/[locale]/page.tsx`
 * consomme `useTranslations("profiling")` pour les phases de soumission/résultat.
 */
export const ROOT_CLIENT_NAMESPACES = ["landing", "profiling"] as const;

/** Routes d'authentification (`/login`, `/verify-email`, `/verify-otp`). */
export const AUTH_CLIENT_NAMESPACES = ["auth"] as const;

/** Route de profil public (`/profile/[id]`). */
export const PROFILE_CLIENT_NAMESPACES = ["profile"] as const;

/** Namespaces réservés aux routes authentifiées (exclus des pages publiques). */
export const HEAVY_AUTH_NAMESPACES = ["admin", "dashboard"] as const;
