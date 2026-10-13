# Audit expert — Landing page (`/`)

**Date :** 2026-10-13
**Périmètre :** landing publique (`src/app/[locale]/page.tsx` → `src/components/reboot/landing/*`), layout `[locale]`, styles `globals.css` liés.
**Méthode :** lecture exhaustive du code + **exécution réelle** de l'app (`next build` + `next start`, desktop 1440×900 et mobile 390×844) avec **axe-core** (`@axe-core/playwright`, tags WCAG 2.0/2.1/2.2 A/AA + best-practice), capture réseau, métriques Web Vitals et analyse du HTML SSR.
**Base :** `main` @ `9379c5c` (arbre propre).

---

## 1. Verdict

| Axe | Note | Commentaire |
|---|---|---|
| Accessibilité automatisable (axe) | **A** | 0 violation, 40 règles passées, sur **desktop et mobile** |
| Sémantique / structure | **A−** | `<main id="contenu">`, `<nav>` labellisés, 1 seul `<h1>`, listes réelles |
| Performance (perçue) | **C** | Hero **invisible en SSR** (`opacity:0`), JS ~423 Ko, LCP mesuré ≈ 3,7 s |
| Robustesse / progressive enhancement | **C** | Sans JS, le contenu above-the-fold reste invisible |
| Poids du payload i18n | **C** | Tout `messages/fr.json` (173 Ko, 13 namespaces dont `admin`) envoyé au client |
| Hygiène runtime | **B−** | `SpeedInsights` Vercel présent → 404 + erreur console MIME |

**Synthèse :** la landing est **soignée et accessible** (axe 0 violation est rare sur une page aussi riche). Les problèmes sérieux sont **de performance/robustesse**, pas d'accessibilité : le contenu principal est masqué jusqu'à l'hydratation JS, et le bundle embarque beaucoup trop d'i18n.

---

## 2. Constats prioritaires (P0)

### P0-1 — Le hero (et 44 éléments) démarre en `opacity:0` dans le HTML SSR
**Fichiers :** `src/components/reboot/motion/primitives.tsx:100`, `:225`, `:266` (Reveal/Fade/Slide `initial={{opacity:0, y}}`) ; `src/components/reboot/shared.tsx:220-231` (`animate-hash-in` + `animation-fill-mode:both`) ; `src/components/reboot/landing/hero.tsx:62-112`.

**Preuve (HTML SSR réel) :**
```html
<div id="hero-title">
  <div style="opacity:0;transform:translateY(18px)">
    <h1 class="...">…HASHCODE…REBOOT…</h1>
```
`grep -o "opacity:0" landing.html | wc -l` → **44**.

**Impacts :**
- **LCP** : l'élément de plus grand contenu (le `<h1>`) naît invisible → le navigateur attend l'hydratation + la fin de l'animation pour le peindre. C'est la cause la plus plausible du LCP ≈ 3,7 s mesuré.
- **Robustesse** : JS désactivé/en échec → hero, sous-titre, description et CTA **restent invisibles**.
- **SEO/perception** : le texte est dans le HTML (bon pour les crawlers), mais l'utilisateur voit un écran vide au premier paint.

**Recommandation :** pour le *above-the-fold* uniquement, ne pas partir de `opacity:0`.
- passer les primitives du hero en `initial={false}` (framer-motion applique alors l'état final, l'animation d'entrée est conservée pour les sections suivantes), ou
- conserver l'animation via CSS `@starting-style` (animation d'ouverture sans masquer le repos), ou
- au minimum retirer le wrapper `opacity:0` autour du `<h1>` et le `animation-fill-mode:both` du wordmark.

### P0-2 — `SpeedInsights` Vercel actif hors Vercel → 404 + erreur console
**Fichier :** `src/app/[locale]/layout.tsx:5` et `:171`.

**Preuve (réseau) :**
```
404  http://localhost:3000/_vercel/speed-insights/script.js
Refused to execute script ... MIME type ('text/html') is not executable
```
`RESOLUTION_FINAL.md` affirme avoir fermé ce point (« Vercel SpeedInsights MIME error → `<SpeedInsights />` supprimé ») : **il est de retour**. Sur un déploiement VPS/Traefik (hors Vercel), le script n'existe pas.

**Recommandation :** conditionner à `process.env.VERCEL` ou supprimer :
```tsx
{process.env.VERCEL ? <SpeedInsights /> : null}
```

### P0-3 — Tout le dictionnaire i18n est envoyé au client
**Fichier :** `src/app/[locale]/layout.tsx:147` (`getMessages`) + `:168` (`NextIntlClientProvider messages={messages}`).

**Preuve :** `messages/fr.json` = **173 669 octets**, 13 namespaces (`common, notFound, landing, profiling, auth, evenements, profile, error, dashboard, account, admin, legalPending, legal`). Ils sont sérialisés dans le payload RSC/HTML (HTML landing = 236 Ko).

**Impact :** la landing charge l'i18n de l'admin, du dashboard, du profiling… dont elle n'a aucun besoin.

**Recommandation :** ne transmettre que les namespaces utiles par route (next-intl permet de passer un sous-ensemble / `pick`), ou déplacer la fourniture des messages au niveau du segment concerné plutôt que du layout racine.

---

## 3. Constats moyens (P1)

### P1-1 — Performance perçue (à confirmer Lighthouse)
Mesures locales (headless, **non throttlé**, donc à relativiser) :
```
LCP ≈ 3700 ms · CLS ≈ 0.00000017 (excellent) · DOM 783 nœuds
Transfert total ≈ 580 Ko · dont JS ≈ 423 Ko (19 scripts)
Plus gros chunk ≈ 476 Ko (.next/static/chunks/2e7ed2dfde14dcab.js)
```
CLS excellent (aucune image raster, tout est CSS/SVG). Le problème est le **JS** et le **délai de paint** (P0-1). `test:perf` (lhci) existe mais l'outil n'est pas installé ici — à lancer en CI pour un chiffre fiable.

### P1-2 — Dépendances réseau non résilientes
**Fichiers :** `landing/activity.tsx:45-60`, `landing/social-proof.tsx:27-34`.
Preuve : `/api/public/events?limit=3` et `/api/community/count` → **500** sans base (attendu en local). Bon point : l'UI affiche des états `role="status"` propres (pas d'écran cassé). Manque : pas de retry/backoff, et un 500 n'est pas distingué d'un « vide ».

### P1-3 — Pas de lien d'évitement (skip link)
`SkipLink` existe (`src/components/reboot/shared/SkipLink.tsx`, ré-exporté par `shared.tsx:264`) et `<main id="contenu">` est présent, mais la landing n'a **aucun skip link**. axe ne le remonte pas (ce n'est pas une violation), mais c'est une recommandation WIG explicite pour une page à 783 nœuds.

### P1-4 — Logo non cliquable
`src/components/brand/logo.tsx` : le logo est un `<span aria-label>` dans le header, **pas un lien vers `/`**. Convention attendue (retour accueil). Faible impact ici (on est déjà sur l'accueil) mais incohérent.

### P1-5 — `suppressHydrationWarning` sur `<html>`
`src/app/[locale]/layout.tsx:150`. À garder seulement si un mismatch réel (thème) le justifie ; sinon il masque des divergences SSR/client.

---

## 4. Constats mineurs (P2)

- **P2-1 — 14 `<h2>`** dont 4 titres de colonnes du footer (`site-footer.tsx:147` : Produit/Ressources/Communauté/Confidentialité) qui sont des **groupes de navigation**, pas des sections de page. Suggestion : `<h2 class="sr-only">Pied de page</h2>` unique + titres de colonnes en `<p>`/`<h3>` (le `<nav aria-label>` porte déjà la sémantique).
- **P2-2 — 26 boutons, beaucoup nommés « Construire mon profil »** (header ×3, hero, axes ×3, FAQ, final, footer, sticky). Accessible mais un lecteur d'écran entend le même nom ~10×. Suggestion : `aria-label` contextuel (« Construire mon profil — section Axes ») sur les CTA secondaires.
- **P2-3 — `SITE_URL` codée en dur** (`layout.tsx:29`, `sitemap.ts`) alors que `PUBLIC_URL`/`NEXT_PUBLIC_SITE_URL` existent. Risque de divergence canonique/OG.
- **P2-4 — Commentaire obsolète** `site-footer.tsx:26-33` (« namespaces `legal.*` absent → liens non liés ») alors que `legal` **existe** dans `fr.json` et que le footer rend bien les liens légaux via `LEGAL_HREF`. À nettoyer.

---

## 5. Points forts (à préserver)

- **axe-core : 0 violation** (40 passes) desktop **et** mobile — sur une page de cette densité.
- **`prefers-reduced-motion` respecté par primitive** (`useReducedMotion` dans `motion/primitives.tsx`) en plus du CSS (`globals.css:385-408`, `:907`). Rare et bien fait.
- **Animations compositor-only** : `transform`/`opacity` uniquement, jamais `transition: all`.
- **Zéro image raster** : tout est SVG inline/CSS (logo, `ecosystem-core`, `bg-grid`, `bg-noise` en data-URI) → **CLS ≈ 0** et net à toute résolution.
- **`content-visibility: auto`** sur les sections lourdes (`axes`, `faq`) — optimisation mobile pertinente.
- **Sémantique** : `<main>`, `<nav>` avec `aria-label`, `<ol>`/`<ul>` réels, `<button>` pour les actions et `<a>`/`Link` pour la navigation, 1 seul `<h1>`.
- **Typographie** : `.mono-label`/`.eyebrow-mono` cohérents, `tabular-nums` sur les compteurs, `text-balance` sur les titres, **aucun `...` ni guillemet droit** dans le namespace `landing`.
- **Détails pro** : `color-scheme: dark`, `theme-color`, `viewport-fit=cover`, `env(safe-area-inset-bottom)` sur le CTA sticky, `inert`+`aria-hidden` quand il est masqué, focus déplacé au scroll d'ancre (`scroll.ts`).

---

## 6. Plan d'action recommandé

| Priorité | Action | Fichier(s) |
|---|---|---|
| P0 | Hero sans `opacity:0` au-dessus de la ligne de flottaison | `motion/primitives.tsx`, `landing/hero.tsx`, `shared.tsx:220-231` |
| P0 | Conditionner / retirer `SpeedInsights` | `app/[locale]/layout.tsx:5,171` |
| P0 | Ne transmettre que les namespaces i18n utiles | `app/[locale]/layout.tsx:147,168` |
| P1 | Skip link vers `#contenu` | `landing.tsx` |
| P1 | Logo → lien accueil | `brand/logo.tsx` / `site-header.tsx` |
| P1 | Confirmer LCP via LHCI (`npm run test:perf`) | CI |
| P2 | Sémantique footer (h2 colonnes), aria-labels CTA, SITE_URL, commentaire obsolète | footer, CTAs, layout |

---

## 7. Annexe — commandes de reproduction

```bash
npm run build && npm run start           # serveur prod local
# axe + métriques (desktop 1440×900 + mobile 390×844) : voir script d'audit
curl -s http://localhost:3000/ | grep -c 'opacity:0'   # -> 44
```
