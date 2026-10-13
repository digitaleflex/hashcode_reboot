# Design System Reboot — adoption dans la landing (lot `design/landing-sections`)

**Date :** 2026-10-13
**Prérequis :** lot fondations (`design/landing-foundations`, PR #227).
**Base :** `design/landing-foundations` @ `15e8065`.
**Périmètre :** appliquer les fondations aux sections de la landing. Aucune
nouvelle section, aucune modification fonctionnelle, aucune couleur de marque
changée.

---

## 1. Classes canoniques ajoutées (`globals.css`, `@layer components`)

Mises dans `@layer components` **volontairement** : les utilitaires Tailwind
(`sm:p-8`, `hover:border-lime/40`, `leading-none`…) restent prioritaires.

| Classe | Rôle | Remplace |
|---|---|---|
| `.ds-card` | surface `card/40`, bordure hairline, rayon 8px, padding 20→24px | le motif `rounded-lg border border-border/70 bg-card/40 p-X` |
| `.ds-overlabel` | label mono 11px, uppercase, tracking 0.14em, muted | `mono-label text-[10px] uppercase tracking-[0.1xem]` |
| `.ds-overlabel--accent` | variante lime | `… text-lime` |
| `.ds-badge` | pastille de statut bordée, mono 11px, uppercase | `mono-label rounded-sm border px-2 py-0.5 text-[10px] uppercase …` |
| `.ds-badge--accent` | variante lime (bordure/fond/texte lime) | `border-lime/50 bg-lime/5 text-lime` |

Les overlines passent de **10px à 11px** (plancher de lisibilité du design
system) ; tracking unifié à 0.14em.

---

## 2. Adoption par section

| Fichier | Cartes | Labels/badges | Titres |
|---|---|---|---|
| `landing/axes.tsx` | `.ds-card` (×3) | signal `.ds-overlabel--accent` | `.ds-h3` |
| `landing/activity.tsx` | `.ds-card` (×3) | badges type/statut `.ds-badge` | méta `.ds-caption` |
| `landing/community.tsx` | `.ds-card` (tuile + 3 cartes) | overlines `.ds-overlabel` (×2) | — |
| `landing/engine.tsx` | `.ds-card` (carte démo) | overline démo + index `.ds-overlabel` | — |
| `landing/roadmap.tsx` | — | badges statut `.ds-badge` / `--accent` | — |
| `landing/evolves.tsx` | — | index `.ds-overlabel--accent` | `.ds-h3` |
| `landing/method.tsx` | — | index `.ds-overlabel` | `.ds-h3` |

**Choix conservateurs** :
- pad de carte **uniforme** 20px (mobile) / 24px (≥640px) ; la tuile feature de
  `community` garde volontairement `sm:p-8` (hiérarchie, pas incohérence) ;
- `H3` : `.ds-h3` (20px, semibold) réservé aux **titres d'étape** (axes,
  evolves, method). Les titres de **cartes compactes** (activity, roadmap,
  community) restent à 16px — hiérarchie voulue, pas un oubli ;
- corps secondaires normalisés via `.ds-body-sm` (15px) et `.ds-caption`
  (13px) là où la taille était déjà équivalente ; aucun redimensionnement
  arbitraire ;
- **non touchés** : chips de pas du hero, skeleton d'activité, rail/timeline
  (ce ne sont pas des cartes).

---

## 3. Captures avant / après

`docs/design-system/captures/` (page complète, `prefers-reduced-motion: reduce`) :

| Viewport | Avant (main) | Après (adoption) |
|---|---|---|
| 1440×900 | `before-desktop-1440x900.png` | `after-desktop-1440x900.png` |
| 390×844 | `before-mobile-390x844.png` | `after-mobile-390x844.png` |

Composition et identité préservées ; les écarts visibles sont : rayons/paddings
de carte uniformes, overlines 11px, badges de statut normalisés, titres d'étape
en 20px semibold.

---

## 4. Vérifications exécutées

| Vérification | Résultat |
|---|---|
| `npm run typecheck` | ✅ |
| `npm run lint` | ✅ |
| `npm run build` | ✅ |
| `npm run test:unit` | ✅ 491 pass / 0 fail |
| `npm run check:contrast` | ✅ (inchangé) |
| Playwright `tests/e2e/landing.spec.ts` | ✅ 12/12 |
| axe-core desktop 1440×900 + mobile 390×844 | ✅ 0 violation (40 passes) |
| Débordement horizontal (2 viewports) | ✅ `scrollWidth == clientWidth` |

> Note de méthode : un scan axe lancé avant stabilisation de la page (révélations
> en cours) peut remonter un faux `color-contrast` transitoire ; le scan doit
> porter sur une page stabilisée (`networkidle` + attente). Le test
> `tests/a11y/landing-a11y.spec.ts` a été corrigé en ce sens (voir §6).

---

## 5. Limites

- Les classes `.ds-*` restent **décentralisées** : quelques `text-sm` /
  `text-[Npx]` subsistent dans les composants non concernés (site-header,
  sticky-cta, account-link, chips engine). Les rôles principaux (titres, corps,
  légendes, méta, overlines) sont désormais tokenisés (voir §6).
- Les `H3` de cartes compactes (16px) ne sont pas alignés sur `.ds-h3` : choix
  assumé (hiérarchie), à revoir si la charte évolue.
- Les captures sont des PNG pleine page (≈ 3,7 Mo) ; pas d'optimisation d'image
  dans ce lot.

---

## 6. Passe de nettoyage typographique (suivi)

Objectif : éliminer les dernières tailles arbitraires hors sections déjà
adoptées et stabiliser le scan axe.

- **`globals.css`** : les rôles typographiques (`.ds-display/h1/h2/h3/lead/
  body/body-sm/caption/meta`) sont déplacés dans `@layer components` → les
  utilitaires Tailwind (couleur, interligne) peuvent désormais les surcharger
  (`ds-meta tracking-[0.06em]`, `ds-caption leading-snug`…). Aucun changement de
  rendu (vérifié).
- **Suppression des dernières tailles arbitraires** :
  - `ecosystem-core` : overline orbites `text-[10px]` → `.ds-overlabel` (11px,
    plancher de lisibilité) ; description `text-[11px]` → `.ds-meta`.
  - `activity` : niveau `text-[11px]` → `.ds-meta`.
  - `hero` : label d'étape `text-[12px]` mono → `.ds-overlabel--accent` ;
    libellé de scroll `text-[12px]` → `.ds-meta` ; pas (chip) rayon 6px → 8px.
  - `site-footer` : copyright/tagline `text-[12px]` → `.ds-meta`.
  - `final-cta` : chapô `text-base sm:text-lg` → `.ds-lead`.
  - `faq` : contenu accordéon `text-sm sm:text-base` → `.ds-body` (16px, plus
    lisible sur mobile).
- **Test axe stabilisé** : `tests/a11y/landing-a11y.spec.ts` passe de
  `waitUntil: 'domcontentloaded'` + scan immédiat à `networkidle` + `load` +
  fermeture du bandeau cookies + attente 1200 ms avant scan. Fini les faux
  `color-contrast` transitoires.

Vérifications de la passe : typecheck, lint, build, 491 tests unitaires, 12/12
e2e, axe 0 violation (desktop + mobile), aucun débordement horizontal,
`check:contrast` OK.
