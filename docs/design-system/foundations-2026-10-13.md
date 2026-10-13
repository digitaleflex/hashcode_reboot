# Design System Reboot — Fondations (lot `design/landing-foundations`)

**Date :** 2026-10-13
**Périmètre :** fondations uniquement — tokens, rôles typographiques, cartes,
boutons, états, contraste. **Aucune refonte de section** (à valider avant).
**Base :** `main` @ `9657020`.

> ⚠️ Le document `docs/design-system-reboot.md` (issue #127, phase 1) décrit une
> **révision antérieure** des tokens : ses valeurs (`--background` `oklch(0.16)`,
> `--border` `#2A2A2A`, `--muted-foreground` `#94A3B8`…) ne correspondent plus
> au CSS live. Ce document-ci fait foi pour les valeurs actuelles.

---

## 1. Audit des tokens (source : `src/app/globals.css`, `:root`)

| Token | Valeur live | Rôle | Où |
|---|---|---|---|
| `--background` | `#080A0C` | fond de page (VOID) | `body`, `.shell`, header/footer |
| `--foreground` | `#F5F7FA` | texte principal | corps, titres |
| `--card` | `#111418` | surface (cartes) | `Card`, `.ds-card`, landing `bg-card/40` |
| `--secondary` | `#171B1F` | surface élevée | boutons/surfaces secondaires |
| `--muted-foreground` | `#9AA3AD` | texte secondaire | `.soft-note`, `.ds-caption`, descriptions |
| `--primary` | `#C5F441` | accent lime (jamais fond plein) | CTA, `text-lime`, remplissages |
| `--primary-foreground` | `#080A0C` | texte sur accent | libellé CTA |
| `--destructive` | `oklch(0.62 0.22 25)` | erreurs | boutons/alertes d'erreur |
| `--border` | `#2A3036` | traits 1px | hairlines, bordures de carte |
| `--input` | **`#5C636B`** *(modifié — cf. §5)* | bordure de champ | `Input`, `Textarea`, `Select` |
| `--ring` | `#C5F441` | anneau de focus | `.focus-lime`, `.ds-focus-ring` |
| `--radius` | `8px` (`sm/md/lg/xl` = 4/6/8/12) | rayons | — |

**Polices** : `--font-sans` Geist (corps), `--font-mono` Geist Mono (labels),
`--font-display` Sora (titres/wordmark ; Inter dans `.admin-scope`).
**Breakpoints** : `sm 640 / md 768 / lg 1024 / xl 1280`.
**Rythme** : `.shell` max 1320px (padding 20/32/40px), `.section` 72/112/144px.

**Constat d'audit.** La hiérarchie typographique était implicite : ~17 tailles
arbitraires (`text-[8px]`…`text-[36px]`), dont `text-[11px]` ×62, `text-[13px]`
×35, `text-[10px]` ×31. Les cartes mélangeaient `rounded-sm/md/lg` sans règle.
Les boutons avaient des `focus-visible:ring` par variante (indicateur de focus
incohérent entre `primary`, `ghost`, `outline`).

---

## 2. Décision — échelle typographique explicite

Ajout d'un bloc **additif** `DS-FOUNDATIONS` dans `globals.css` : tokens
`--ds-text-*` + `--ds-leading-*` + classes de rôle. Les classes **reproduisent à
l'identique** les rendus live existants (aucun changement visuel là où elles
remplacent les tailles arbitraires).

| Rôle | Classe | Taille | Usage |
|---|---|---|---|
| Display | `.ds-display` | `clamp(2.75rem,13vw,6rem)` → 4.5/6rem | wordmark hero (H1) |
| Titre 1 | `.ds-h1` | 30 → 36px | titre de page secondaire |
| Titre 2 | `.ds-h2` | 24 → 30px | **un seul** titre de section |
| Titre 3 | `.ds-h3` | 20px | titre de carte |
| Chapô | `.ds-lead` | 16 → 18px | introduction de section |
| Corps | `.ds-body` | 16px | texte courant |
| Corps S | `.ds-body-sm` | 15px | corps compact |
| Légende | `.ds-caption` | 13px | notes, descriptions |
| Méta | `.ds-meta` | 12px | métadonnées |
| Label mono | `.mono-label` / `.eyebrow-mono` | 12.5px | labels techniques |

**Règle de hiérarchie** : un seul `ds-h2` par section, `ds-h3` pour les
sous-titres, `ds-caption`/`ds-meta` pour le texte secondaire. Le lime reste
réservé à l'accent (eyebrow, chiffres clés, CTA), jamais au texte courant.

---

## 3. Décision — cartes et contrôles

- **Rayon canonique des cartes : `--ds-card-radius` = `--radius-lg` (8px)**,
  aligné sur le `Card` shadcn. Les deux cartes « brand » qui utilisaient 6px
  (`reboot/shared Card`, `ui/card BrandCard`) sont passées à 8px → toutes les
  cartes sont désormais cohérentes.
- **Rayon des contrôles : `--ds-control-radius` = `--radius-md` (6px)** (boutons,
  inputs, pills restent `rounded-full`).
- Ajout d'une classe canonique **`.ds-card`** (bordure, rayon, surface
  `color-mix(card 40%)`, padding 20→24px) destinée à l'adoption par les sections
  lors du lot suivant — **non appliquée** ici pour ne pas refondre les sections.
- **Ombres** : aucun `shadow-*` sur la landing (rendu plat) — préservé.

---

## 4. Décision — boutons et états

`RebootButton` (`reboot/shared.tsx`, 38 importeurs) :

- **focus unifié** : suppression des `focus-visible:ring` par variante au profit
  de `.focus-lime` unique sur le conteneur (un seul indicateur, identique pour
  `primary`/`ghost`/`outline`).
- **États explicites** : `hover`, `active` (`bg-primary/85`, `bg-secondary/80`,
  bordure lime), `disabled` (`opacity-50` + `pointer-events-none`).
- **Nouvel état `loading`** : prop `loading` → `aria-busy="true"`, spinner
  `Loader2`, bouton neutralisé. Zéro animation de layout, `transition-colors`
  uniquement (compositor-safe).
- Tailles `sm/md/lg` inchangées, cibles tactiles ≥ 44px conservées.

`Button` shadcn (`ui/button.tsx`) : **non modifié** (variants stables, doc #127).

---

## 5. Contraste — mesures réelles (WCAG 2.2)

Script : `npm run check:contrast` (`scripts/check-contrast.mjs`), qui lit les
tokens **live** depuis `globals.css` (source unique) et échoue si un seuil est
franchi. Ajouté au job CI `validate`.

| Paire | Avant | Après | Seuil |
|---|---|---|---|
| texte principal / page | 18.48 | 18.48 | 4.5 ✓ |
| texte principal / carte | 17.21 | 17.21 | 4.5 ✓ |
| texte secondaire / page | 7.76 | 7.76 | 4.5 ✓ |
| texte secondaire / carte | 7.23 | 7.23 | 4.5 ✓ |
| accent lime (texte) / page | 15.48 | 15.48 | 4.5 ✓ |
| libellé sur CTA lime | 15.48 | 15.48 | 4.5 ✓ |
| erreur / page | 4.89 | 4.89 | 3 ✓ |
| **bordure de champ (`--input`) / page** | **2.34 ✗** | **3.26 ✓** | 3 (1.4.11) |
| **bordure de champ / carte** | **2.18 ✗** | **3.04 ✓** | 3 (1.4.11) |
| hairline décorative / page | 1.49 | 1.49 | info |

**Correction** : `--input` passe de `oklch(0.42 0 0)` (≈2.3:1) à `#5C636B`
(3.26:1 vs page, 3.04:1 vs carte). Il s'agit d'un **neutre d'interface**, pas
d'une couleur de marque ; justification : WCAG 2.2 **1.4.11 Non-text Contrast**
(les champs `Input/Textarea/Select` utilisaient cette bordure comme seule
délimitation). Les **hairlines** de carte restent volontairement discrètes
(1.4:1, décoratif, non bloquant).

axe-core (desktop 1440×900 **et** mobile 390×844, tags WCAG 2.0/2.1/2.2 A/AA +
best-practice) : **0 violation, 40 règles passées** — inchangé.

---

## 6. Captures avant / après

Emulation `prefers-reduced-motion: reduce` (toutes les révélations visibles,
aucune animation), page complète.

| Viewport | Avant | Après |
|---|---|---|
| 1440×900 | `captures/before-desktop-1440x900.png` | `captures/after-desktop-1440x900.png` |
| 390×844 | `captures/before-mobile-390x844.png` | `captures/after-mobile-390x844.png` |

Résultat : **identité et composition inchangées** (fond anthracite, lime mesuré,
grille éditoriale, cartes plates). Les écarts sont limités aux fondations
ci-dessus ; aucune section n'a été restructurée.

---

## 7. Vérifications exécutées

| Vérification | Résultat |
|---|---|
| `npm run typecheck` | ✅ 0 erreur |
| `npm run lint` | ✅ 0 problème |
| `npm run build` | ✅ |
| `npm run test:unit` | ✅ 491 pass / 0 fail |
| `npm run check:contrast` | ✅ toutes les paires conformes |
| Playwright `tests/e2e/landing.spec.ts` | ✅ 12/12 |
| axe-core desktop + mobile | ✅ 0 violation (40 passes) |
| `node scripts/check-messages.mjs` | ✅ |

---

## 8. Limites & suite

- **Sections non refondues** (conforme à la consigne) : l'adoption de `.ds-card`,
  `.ds-h3`, `.ds-caption` dans `landing/*` reste à faire — c'est le **lot
  suivant**, après validation des présentes fondations.
- `--input` éclairci : impacte les formulaires auth/profiling/admin (bordure
  seulement, pas de mise en page). À re-capturer au lot suivant.
- Le script de contraste ne couvre pas les `color-mix()` translucides ; les
  teintes `chart-*` (dataviz, oklch) ne sont pas vérifiées ici.
- `docs/design-system-reboot.md` (issue #127) reste l'archive historique : ses
  valeurs ne sont plus à jour (cf. bandeau ajouté).
