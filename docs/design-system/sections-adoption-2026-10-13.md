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
> porter sur une page stabilisée (`networkidle` + attente).

---

## 5. Limites

- Les classes `.ds-*` restent **décentralisées** : beaucoup de `text-sm` /
  `text-[Npx]` subsistent dans les sections non concernées (FAQ, footer, hero).
  Une passe ultérieure pourra les migrer vers `.ds-body-sm` / `.ds-caption`.
- Les `H3` de cartes compactes (16px) ne sont pas alignés sur `.ds-h3` : choix
  assumé (hiérarchie), à revoir si la charte évolue.
- Les captures sont des PNG pleine page (≈ 3,7 Mo) ; pas d'optimisation d'image
  dans ce lot.
