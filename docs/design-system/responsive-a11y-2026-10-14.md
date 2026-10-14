# Landing — Responsive, accessibilité et finition UX (lot `fix/landing-responsive-a11y`)

**Date :** 2026-10-14
**Base :** `main` @ `ed60b7d` (pile design landing fusionnée).
**Périmètre :** responsive 320→1440, accessibilité WCAG AA, états dynamiques.
Aucun comportement métier, route ou traduction modifiés.

---

## 1. Audit responsive — constat initial

Mesure programmatique (`scrollWidth` vs `clientWidth`) + détection des éléments hors cadre :

| Taille | Avant | Cause identifiée |
|---|---|---|
| **320×700** | ❌ `docW=365` | **Header** (logo 145 + « Se connecter » 67 + CTA 113 > 280 dispo) **ET** hero forcé à 352 par `EcosystemCore` (min-content) |
| 360×780 | ❌ `docW=365` | Header (idem) |
| 390×844 | ✅ | — (marge limite) |
| 768 / 1024 / 1440 | ✅ | — |

Cause racine du hero : la colonne `lg:col-span-5` (visual `EcosystemCore`) a un **min-content de 352 px** — les 3 tuiles du visual étaient en `repeat(3, 1fr)` (min-content non réductible), ce qui forçait la colonne du hero (grid `min-width:auto`) puis débordait (clippé par `overflow-hidden`, donc texte coupé).

## 2. Corrections à la source (pas de hack par largeur)

1. **`globals.css` — `EcosystemCore` mobile** : `grid-template-columns: repeat(3, 1fr)` → **`repeat(auto-fit, minmax(108px, 1fr))`**. Résultat : 2 tuiles sur écran très étroit, 3 au-delà — plus de débordement, **sans césure de mot** (un premier essai `minmax(0,1fr)` + `overflow-wrap:anywhere` coupait « Development »/« Cybersecurity » ; abandonné).
2. **`hero.tsx`** : ajout de **`min-w-0`** sur les deux colonnes de la grille (`lg:col-span-7` / `lg:col-span-5`) — correctif générique du dépassement `min-width:auto` des enfants de grille.
3. **`site-header.tsx`** : sur mobile très étroit (`< 390px`), « Se connecter » est **masqué** (l'espace reste accessible via le footer « Mon espace ») ; le CTA principal et le logo restent. La tablette (≥ sm) et le desktop sont inchangés.

## 3. Résultats responsive (après)

| Taille | `scrollWidth − clientWidth` |
|---|---|
| 320×700 | **0** |
| 360×780 | **0** |
| 390×844 | **0** |
| 768×900 | **0** |
| 1024×768 | **0** |
| 1440×900 | **0** |

Aucun débordement horizontal. Les seuls éléments « hors cadre » restants sont des **décors absolus** (aura hero, motif H, glows) **volontairement clippés** par `overflow-hidden` (docW == clientW).

## 4. Accessibilité — checklist

| Point | Méthode | Résultat |
|---|---|---|
| axe-core | desktop 1440 + mobile 390 **+ 320 + 768 + 1024** (tags WCAG 2.0/2.1/2.2 A/AA + best-practice) | ✅ **0 violation / 40 passes** sur les **5 tailles** |
| Skip link + destination | e2e : 1er `Tab` → lien « Aller au contenu principal » focusé → `Entrée` → `#contenu` dans le viewport | ✅ |
| Hiérarchie des titres | règle axe `heading-order` (best-practice) | ✅ 0 violation (1 seul H1) |
| Noms accessibles des boutons | e2e « chaque bouton visible a un nom accessible » | ✅ |
| Focus clavier visible | `.focus-lime` / `focus-visible` (tokens) + axe | ✅ |
| Navigation & accordéons clavier | e2e FAQ (Enter → `aria-expanded` togglé) + skiptab | ✅ |
| Contrastes WCAG AA | `npm run check:contrast` (tokens live) + axe | ✅ toutes paires conformes |
| `prefers-reduced-motion` | `emulateMedia(reducedMotion:'reduce')` + CSS `[data-reveal]`/animations coupées | ✅ tout visible, zéro animation |
| Alternatives textuelles | e2e « images : alt ou décoratives » + icônes `aria-hidden` | ✅ |
| États dynamiques | e2e activité (chargement / vide / erreur 500 / 3 événements) en `role="status"` | ✅ |

Pas d'usage d'`aria-label` ajouté là où un libellé visible suffit (seuls les labels contextuels déjà justifiés subsistent).

## 5. Tests exécutés

| Vérification | Résultat |
|---|---|
| `npm run typecheck` / `npm run lint` / `npm run build` | ✅ |
| `npm run test:unit` | ✅ 491 pass / 0 fail |
| `npm run check:contrast` | ✅ |
| Playwright `tests/e2e/landing.spec.ts` | ✅ **18/18** (+1 : skip link) |
| axe-core (5 tailles) | ✅ 0 violation |
| Débordement horizontal (6 tailles) | ✅ aucun |

## 6. Captures

`docs/design-system/captures/responsive-a11y/` (page complète, soumise à
`prefers-reduced-motion` + `content-visibility` forcée) :

- `landing-{320x700,390x844,768x900,1024x768,1440x900}.png`
- `header-{320x700,390x844}.png` (zoom header/hero, montre le header sans débordement)

## 7. Limites restantes

- **axe-core ne certifie pas l'accessibilité** : il couvre les règles automatisables ; le clavier/tests manuels restent partiels (pas de test lecteur d'écran).
- **Locale unique `fr`** (EN archivé) : rendu vérifié en FR uniquement.
- **CI préexistante rouge** sur `main` (`Integration` + `Lighthouse`) — **hors périmètre** de ce lot, à traiter séparément.
- Tests de **zoom navigateur 200 %** et de **saisie clavier complète de tous les formulaires** non couverts ici.
- Sur `< 390px`, « Se connecter » n'est pas visible dans le header (accessible via le footer) : choix responsive assumé.
