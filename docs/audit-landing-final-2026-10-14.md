# Rapport QA final — Landing HASHCODE REBOOT (2026-10-14)

> **Rapport de suivi** daté. Ne remplace pas l'audit initial
> `docs/audit-landing-2026-10-13.md` (conservé tel quel). Périmètre : valider la
> fin des améliorations de la landing (lots design #227-#238 + responsive/a11y
> #239) sans régression.
> **Baseline testée :** branche `docs/qa-landing-final` = `fix/landing-responsive-a11y`
> (#239) sur `main` (`ed60b7d`, pile design fusionnée).

---

## 0. Verdict

**PASS avec réserves.** Build, types, lint, unitaires, e2e publics, axe-core et
responsive sont verts. **2 corrections a11y** et **1 correction de test** ont été
apportées en cours de QA (§2.1). Deux limites **hors périmètre** subsistent :
CI `main` préexistante rouge (Integration/Lighthouse) et absence de base locale
(API publiques 500 attendues).

---

## 1. Build et tests (exécutés réellement)

| Commande | Résultat |
|---|---|
| `npm run build` | ✅ Compiled successfully (~2 min) |
| `npm run typecheck` (`tsc --noEmit`) | ✅ 0 erreur |
| `npm run lint` (`eslint .`) | ✅ 0 problème |
| `npm run test:unit` | ✅ **491 pass / 0 fail** |
| `node scripts/check-messages.mjs` | ✅ 0 clé orpheline (2876 strings) |
| `node scripts/check-contrast.mjs` | ✅ toutes paires WCAG AA |
| `tests/e2e/landing.spec.ts` | ✅ **18/18** |
| `tests/e2e/locale-routing.spec.ts` | ✅ 9 pass / 3 skipped (EN archivé) |
| `tests/e2e/auth-redirects.spec.ts` | ✅ (inclus dans le run public) |
| axe-core (script Playwright dédié) | ✅ **0 violation / 40 passes** (1440 + 390, bannière visible **et** FAQ ouverte) |

Aucun échec masqué : les commandes ci-dessus réussissent réellement. Les specs
`dashboard-flows` / `ateliers-flows` / `a11y-audit` (admin/dashboard) **ne sont
pas exécutables sans base** — non lancées, non revendiquées.

### 2.1. Problèmes corrigés pendant la QA (à la source)

1. **Bannière cookies** (`cookie-consent.tsx`) : son texte visible n'était
   contenu dans aucun *landmark* → violation axe `region` (best-practice,
   présente dès que la bannière est affichée). → ajout `role="region"` +
   `aria-label="Consentement aux cookies"`.
2. **Barre CTA sticky mobile** (`sticky-cta.tsx`) : même cause (visible après le
   hero sur mobile) → ajout `role="region"` + `aria-label` (i18n
   `landing.stickyCta.regionAria`).
3. **Test locale** (`locale-routing.spec.ts`) : l'assertion sur `/api/health`
   n'acceptait que `[200,404]` alors que le health renvoie **503** sans base
   (local/CI). Assouplie à `[200,404,503]` — l'intention (pas de redirect i18n)
   reste vérifiée de façon fiable.

## 2. Rendu SSR et hydratation

- SSR `/` : **HTTP 200**, HTML **134 374 o brut** / **26 022 o gzip**.
- **Hero visible sans JS** : `grep opacity:0` → **0** élément masqué au-dessus de
  la ligne de flottaison. H1 « HASHCODE », proposition de valeur et CTA présents
  dans le HTML initial.
- **Sans JavaScript** (contexte `javaScriptEnabled:false`) : le H1, le
  sous-titre, le descripteur, le CTA « Construire mon profil » et le contenu des
  sections (« Trois terrains. Un seul système. ») sont **visibles** ;
  **0 requête échouée**.
- **`suppressHydrationWarning`** : **absent** du rendu (`grep` → 0). Aucune
  erreur d'hydratation observée en console (seules les erreurs réseau 500
  attendues, cf. §3).
- **`content-visibility:auto`** : sections `axes`/`faq` — rendues correctement
  (le défaut ne concerne que les captures pleine page, contournées).

## 3. Performance — mesures de laboratoire (à ne pas confondre avec le terrain)

**Conditions :** `next start` (build prod), Chromium headless, **non throttlé**,
machine locale, `networkidle`. LCP/CLS via `PerformanceObserver`. **Ce ne sont
pas** des données terrain : les objectifs Core Web Vitals (LCP ≤ 2,5 s, INP ≤
200 ms, CLS ≤ 0,1 au p75) **ne peuvent pas être déclarés atteints** sur cette
base.

| Métrique | Avant (baseline audit / main initiale) | Après (14/10, local) |
|---|---|---|
| HTML brut | 166 009 o | **134 374 o** (−19 %) |
| HTML gzip | 34 963 o | **26 022 o** (−26 %) |
| JS chargé (encoded) | ~423 Ko (audit) | **382,9 Ko** (17 scripts) |
| CSS (encoded) | — | 84,1 Ko |
| Transfert total | ~580 Ko (audit) | ~543 Ko |
| LCP (lab, non throttlé) | ≈ 3 700 ms (audit) | **260–456 ms** |
| CLS | ≈ 0 | **0,00004** (1440) / **0,0199** (390) |
| Nœuds DOM | 783 | 840 |
| Requêtes échouées | 2× 500 (API) | 2× 500 (API) + aborts d'optimistic-nav |
| Erreurs console | — | 10 (toutes = ressources API 500, cf. ci-dessous) |

**Requêtes échouées / erreurs console** : **toutes** proviennent de
`/api/public/events?limit=3` et `/api/community/count` → **500 sans
`DATABASE_URL`** (local/CI), plus des `net::ERR_ABORTED`
(annulation de prefetch RSC). **Attendu, non bloquant** : l'UI affiche des états
`role="status"` propres (vide / erreur / retry). **Aucune** erreur d'hydratation
ou d'application.

> INP : non mesuré de façon fiable en laboratoire (l'API `event` après clic n'est
> pas représentative sans interaction utilisateur réelle). Latence de clic
> observée ~0,8–1,7 s incluant scroll/dismiss, **non représentative** — à
> mesurer via données terrain (RUM/Lighthouse en CI).

## 4. Accessibilité

- **axe-core** : 0 violation / 40 passes sur **1440×900** et **390×844**, avec
  la **bannière cookies visible** et la **FAQ ouverte** (après correction §2.1).
  Idem 320/768/1024 (lot #239).
- **Skip link** : 1ᵉʳ `Tab` → « Aller au contenu principal » focusé → `Entrée`
  → `#contenu` dans le viewport (e2e).
- **Noms accessibles des boutons** : ✅ (e2e « chaque bouton visible a un nom »).
- **Hiérarchie de titres** : 1 seul `<h1>` ; ordre valide (axe `heading-order` 0).
- **Contraste** : `check:contrast` (tokens live) ✅ + axe ✅.
- **Clavier** : accordéons FAQ (Enter → `aria-expanded`), footer, skip link.
- **`prefers-reduced-motion`** : `emulateMedia(reduce)` → tout visible, animations
  coupées (CSS `[data-reveal]` + keyframes).

## 5. Fonctionnel

| Cas | Résultat |
|---|---|
| CTA hero/sticky/footer/engine/community/final | ✅ e2e → `reboot_cta_clicked` + `profiling_started` |
| Navigation localisée | ✅ `locale-routing` (FR servi ; `/en` redirigé ; assets non redirigés) |
| Liens du footer (logo + 4 liens légaux) | ✅ e2e (`href` vérifiés) |
| Accordéons FAQ (clic + clavier) | ✅ e2e |
| États dynamiques activité | ✅ e2e (chargement / vide / erreur 500 / 3 événements, `role="status"`) |
| État sans données / erreur API | ✅ reproduits via mocks e2e (le local renvoie 500 sans DB) |

## 6. Cohérence visuelle (captures 1440×900 et 390×844)

`docs/design-system/captures/qa-final/` :
- `before-1440x900.png` / `after-1440x900.png`
- `before-390x844.png` / `after-390x844.png`

Vérifié : hiérarchie des titres (`.ds-h2`/`.ds-h3`), alignements grille 12 col,
espacements `.section`, cartes `.ds-card` cohérentes, boutons unifiés, **aucun
contenu tronqué**, identité (fond anthracite, lime mesuré, bordures fines)
préservée.

## 7. Résultats non concluants / régressions

- **INP** : non concluant en laboratoire (cf. §3) — requiert données terrain.
- **CI `main`** : `Integration` + `Lighthouse` **rouges depuis avant ce lot**
  (préexistant, hors périmètre). `Typecheck/Lint/Unit` + `Build` verts.
- **E2E admin/dashboard/ateliers** : non exécutés (base absente).
- **Aucune régression** fonctionnelle ou visuelle détectée dans le périmètre.

## 8. Éléments restants à traiter (hors ce lot)

1. **CI préexistante rouge** : `Integration (ephemeral Postgres)` (test
   « protected endpoints require auth ») et `Lighthouse CI` (seuils) sur `main`.
2. **Mesure terrain** des Core Web Vitals (RUM / LHCI en CI) pour valider p75.
3. **Participer/valider les missions** : modèle `Mission/Challenge` non persisté
   (issue **#232**), etc. (backlog backend, hors landing).

## 9. Fichiers modifiés par ce lot QA

```
M src/components/reboot/cookie-consent.tsx   (role=region + aria-label)
M src/components/reboot/landing/sticky-cta.tsx (role=region + aria-label)
M messages/fr.json                            (landing.stickyCta.regionAria)
M tests/e2e/locale-routing.spec.ts            (assertion /api/health robuste)
A docs/audit-landing-final-2026-10-14.md      (ce rapport)
A docs/design-system/captures/qa-final/*      (captures avant/après)
```

## 10. Livraison

Pull request **empilée sur #239** (elle-même à fusionner dans `main`).
**Pas de fusion automatique.** La livraison **n'est pas déclarée définitive** :
la CI `main` reste rouge sur des jobs **préexistants et hors périmètre**, et
l'INP/nullissement terrain n'est pas mesuré.
