/**
 * Référentiel des sections de l'espace admin — source de vérité unique.
 *
 * Ces tables vivaient dans `AdminShell.tsx` (client, `"use client"`). Les y
 * sortir remplit deux besoins :
 *
 *  - **Testabilité** : un module TypeScript pur s'importe dans `node --test`
 *    sans transformer de JSX, sans monter React et sans embarquer
 *    `next/navigation`. Le test de non-régression (`tests/admin-sections.test.cjs`)
 *    peut donc lire la VRAIE table et non un miroir.
 *  - **Cohérence** : le menu (`AdminSidebar`) et la coquille (`AdminShell`)
 *    partagent les mêmes identifiants, typés. Un `id` mal orthographié dans
 *    `AdminSidebar` devient une erreur de compilation (`AdminSectionId`), pas un
 *    onglet qui ne s'allume jamais.
 *
 * D27 — la table ne couvrait que 11 routes alors que le menu en déclare 14, et
 * que l'arborescence réelle en compte davantage. Sur `/admin/ateliers`,
 * `/admin/mentoring`, `/admin/email-templates` et `/admin/blacklist`,
 * `activeSectionId` retombait sur `"section-stats"` : le menu affichait
 * « Vue d'ensemble » pendant que l'admin était ailleurs.
 */

/** Les 14 sections déclarées par `AdminSidebar` (identifiants du menu). */
export const ADMIN_SECTION_IDS = [
  "section-stats",
  "section-members",
  "section-ateliers",
  "section-mentoring",
  "section-invitations",
  "section-marketing",
  "section-email-deliverability",
  "section-events",
  "section-email-templates",
  "section-activity",
  "section-exports",
  "section-blacklist",
  "section-audit-log",
  "section-settings",
] as const;

export type AdminSectionId = (typeof ADMIN_SECTION_IDS)[number];

/**
 * Route admin réelle -> section du menu.
 *
 * Deux routes pour `section-stats` : `/admin` (page qui redirige vers
 * `/admin/dashboard`) et `/admin/stats` (page stats conservée, hors menu).
 * Les pages de détail sont couvertes par la résolution par préfixe la plus
 * longue (`resolveAdminSectionId`) : `/admin/ateliers/<id>` et
 * `/admin/ateliers/submissions` retombent sur `/admin/ateliers`.
 */
export const SECTION_MAP: Record<string, AdminSectionId> = {
  "/admin": "section-stats",
  "/admin/dashboard": "section-stats",
  "/admin/stats": "section-stats",
  "/admin/members": "section-members",
  "/admin/ateliers": "section-ateliers",
  "/admin/mentoring": "section-mentoring",
  "/admin/invitations": "section-invitations",
  "/admin/marketing": "section-marketing",
  "/admin/email-deliverability": "section-email-deliverability",
  "/admin/email-templates": "section-email-templates",
  "/admin/events": "section-events",
  "/admin/activity": "section-activity",
  "/admin/exports": "section-exports",
  "/admin/blacklist": "section-blacklist",
  "/admin/audit-log": "section-audit-log",
  "/admin/settings": "section-settings",
};

/**
 * Section -> route d'atterrissage (destination du bouton dans le menu).
 *
 * Complète D27 : les 4 sections ajoutées à `SECTION_MAP` manquaient aussi ici.
 * Un `sectionId` absent de cette table était ignoré par `onNavigate` (aucune
 * navigation, aucune erreur) — le même mensonge que la surbrillance, mais en
 * silence.
 */
export const SECTION_ROUTES: Record<AdminSectionId, string> = {
  "section-stats": "/admin/dashboard",
  "section-members": "/admin/members",
  "section-ateliers": "/admin/ateliers",
  "section-mentoring": "/admin/mentoring",
  "section-invitations": "/admin/invitations",
  "section-marketing": "/admin/marketing",
  "section-email-deliverability": "/admin/email-deliverability",
  "section-events": "/admin/events",
  "section-email-templates": "/admin/email-templates",
  "section-activity": "/admin/activity",
  "section-exports": "/admin/exports",
  "section-blacklist": "/admin/blacklist",
  "section-audit-log": "/admin/audit-log",
  "section-settings": "/admin/settings",
};

/**
 * Préfixes triés du plus long au plus court : `/admin/email-deliverability`
 * doit gagner contre `/admin` sur `/admin/email-deliverability`.
 */
const SECTION_PREFIXES = Object.keys(SECTION_MAP).sort((a, b) => b.length - a.length);

/**
 * Section correspondant à un pathname admin, ou `undefined` si la route est
 * inconnue (le menu retombe alors sur son défaut, comme avant D27).
 *
 * Attend un pathname SANS préfixe de locale : `usePathname` de
 * `next/navigation` renvoie `/en/admin/members` alors que `SECTION_MAP` est
 * indexé par `/admin/members`. Les appelsites utilisent donc le `usePathname`
 * de `@/i18n/routing`, qui retire le préfixe.
 *
 * La comparaison se fait par segments entiers : `/admin` ne doit pas
 * correspondre à `/administrator`.
 */
export function resolveAdminSectionId(pathname: string | null | undefined): AdminSectionId | undefined {
  if (!pathname) return undefined;
  const normalized = pathname.replace(/\/+$/, "") || "/";
  const match = SECTION_PREFIXES.find(
    (prefix) => normalized === prefix || normalized.startsWith(`${prefix}/`),
  );
  return match ? SECTION_MAP[match] : undefined;
}