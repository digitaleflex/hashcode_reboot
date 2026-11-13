# Inventaire « reste à faire » — 2026-11-13

> Établi par vérification directe du dépôt (`main` @ `f629d34`), pas par lecture
> des documents de pilotage — plusieurs d'entre eux étaient périmés.
> Objectif : une liste actionnable, chaque point avec sa preuve.

## 0. État vérifié le 2026-11-13

| Élément | Valeur |
|---|---|
| Branche de référence | `main` @ `f629d34` (2026-11-10) |
| Issues GitHub ouvertes | **0** |
| PR ouvertes | **1** — #275 dependabot (2 bumps) |
| CI sur `main` | **ROUGE** (`validate` : 9 clés i18n orphelines) → corrigé ici |
| `npm run validate` local | était rouge sur Windows (bug de séparateur de chemins) → corrigé ici |
| Migrations Prisma | 16, la plus récente `20261016085821_add_dedup_expression_indexes` |

## 1. Corrigé dans cette PR

1. **CI rouge sur `main`** — `scripts/check-messages.mjs` refusait 9 clés i18n
   orphelines, restes de la refonte UI (`landing.community.cta`,
   `landing.community.audiencesLabel`, `landing.hero.altNote|scrollAria|scrollLabel`,
   `profiling.welcome.heroSubtitle|headerProfile|headerActive|whatsappCaptureTitle`).
   Supprimées après vérification qu'aucun `t()` ne les consomme
   (`community.tsx`, `hero.tsx`, `welcome.tsx`, `audience-marquee.tsx`).
2. **Export RGPD faux** (`src/app/api/account/export/route.ts`) — lisait
   `db.memberSession`, table plus écrite depuis la bascule Better Auth :
   `sessions: []` systématique. Bascule sur `db.session` filtré par
   `user.email`, `token` jamais sélectionné.
3. **DAU admin faux** (`src/app/api/admin/activity-logins/route.ts`) — SQL brut
   et `groupBy` sur `MemberSession` : DAU toujours à 0, affiché comme un vrai
   chiffre. Bascule sur `Session` (`updatedAt`, `expiresAt > NOW()`,
   `COUNT(DISTINCT "userId")`).
   Correctif d'origine : commit `fc61474` (D36) sur `chore/audit-d01`, branche
   jamais fusionnée (upstream supprimé).
   Garde anti-régression : `tests/session-readers.test.cjs`.
4. **`npm run validate` rouge sur Windows** — `tests/acquisition-foundation.test.cjs:457`
   comparait `src\lib\invitations.ts` (Windows) à `src/lib/invitations.ts`
   (Linux). Séparateurs normalisés : le vert local vaut désormais le vert CI.
5. **Tests orphelins branchés** :
   - `tests/a11y/*.spec.ts` étaient hors de `testDir: './tests/e2e'` → jamais
     exécutés. `playwright.a11y.config.ts` + `npm run test:a11y` + job CI `a11y`.
   - `tests/acquisition-state.test.ts` : ni script npm ni CI → `test:acquisition-state`.

## 2. Reste à faire — bloquants production / déploiement

| # | Point | Preuve |
|---|---|---|
| B1 | **Textes légaux inexistants** : `/cgu`, `/confidentialite`, `/mentions-legales`, `/cookies` rendent un placeholder assumé (« aucun document publié »), contact `contact@hashcode.reboot` | `src/components/reboot/legal/pending-document.tsx:41-52`, `docs/plan-qa-m6.md:36` « EN ATTENTE infos éditeur » |
| B2 | **Clés Turnstile prod** non posées (inscription) | `docs/plan-qa-m6.md:32` |
| B3 | **Contenu de départ absent** : installation neuve = 0 atelier, 0 mission, 0 événement (les seeds ont été supprimés) | `docs/CHECKLIST-LANCEMENT-BETA.md:44-51`, `scripts/` (aucun seed) |
| B4 | Vérifications manuelles de lancement (vrai code reçu, atelier de bout en bout, mentorat, mobile, **sauvegarde + restauration**) | `docs/CHECKLIST-LANCEMENT-BETA.md` (20 cases) |
| B5 | Vérifs post-déploiement + calibrage orientation (`RECOMMENDATION_MIN_SCORE`, `NEXT_ACTION_CONFIDENCE_THRESHOLD`) | `docs/deployment-checklist-v1.md` (11 cases) |
| B6 | `npm audit` : 15 vulnérabilités dont **1 critique** (après `npm ci` du 2026-11-13) | sortie `npm install` |

## 3. Reste à faire — fonctionnel / dette

| # | Point | Preuve |
|---|---|---|
| F0 | **E2E funnel acquisition ROUGE depuis le 2026-10-26** (dernière CI verte : 2026-10-20). Diagnostic CI du 2026-11-13 : le parcours reste bloqué sur la question 3 (email), champ rempli, bouton « Continuer » cliqué, aucune erreur affichée — soit une dérive du harnais (saisie programmatique vs état React), soit une **vraie régression du funnel**. À trancher manuellement avec une base : c'est le garde-fou du parcours d'inscription, donc priorité beta. Deux filets défensifs ont été ajoutés au spec (refermer le popover pays, retenter « Continuer » après `Escape`) sans effet sur l'application | `tests/e2e/funnel-acquisition.spec.ts`, `gh run list --workflow=ci.yml` |
| F1 | **Ancien système d'invitation admin** à moitié vivant : autorité réelle = `Member.adminRole`, mais `sendAdminInvitationEmail` n'a aucun appelant, `/admin/setup` + `/api/admin/invite/verify` restent servis, `AdminInvitation` encore lu | `src/lib/email/builders.ts:1350`, `src/app/[locale]/admin/setup/page.tsx`, `src/lib/auth/admin.ts:161`, `docs/CHECKLIST-LANCEMENT-BETA.md:80-82` |
| F2 | **État vide agenda** toujours absent | `src/app/[locale]/dashboard/_components/AgendaCard.tsx:333` (0 occurrence de `empty` dans le fichier) |
| F3 | Commentaire TODO obsolète (drawer mobile admin **déjà** implémenté) | `src/components/reboot/admin/AdminShell.tsx:187` vs `AdminSidebar.tsx:272-315` |
| F4 | Job CI `a11y` désormais **bloquant** : baseline du 2026-11-13 = 27 specs, **0 violation axe** (0 critical, 0 serious), parcours publics + admin | `.github/workflows/ci.yml` job `a11y` |
| F5 | `tests/a11y/a11y-audit.spec.ts` cible `/en/*` (redirigé 301 → FR) : tests à retirer ou à garder comme garde de redirection | `tests/a11y/a11y-audit.spec.ts:12` |

## 4. Reste à faire — branches et dépôt

| Branche | État | Action recommandée |
|---|---|---|
| `chore/audit-d01` (locale, 52 commits, 2026-10-06) | upstream **supprimé**, jamais fusionnée ; contient D16→D38 (dont le fix D36 repris ici, + refactors `errors.ts`/`aggregates.ts`/`useQuery` absents de `main`) | conserver comme archive, ou reprendre au cas par cas — **ne pas supprimer sans revue** |
| `development` (locale + `origin/development`) | 1 commit local déjà présent dans `main` ; branche distante 47 commits derrière, encore déclenchée par `ci.yml` (`branches: [main, development]`) | recaler sur `main` ou acter son abandon (impact CI) |
| `origin/feat/phase8-activity-catalogue` (26 commits) | contenu déjà dans `main` (`src/lib/orientation/catalogue.ts` importé par `destination/matching/presentation.ts`) ; n'ajoute que des artefacts obsolètes (`playwright-report/`, `test-results/`) et 2 routes supprimées exprès | supprimable |
| `origin/fix/phase6-review-findings` (7 commits) | idem | supprimable |
| PR #275 (dependabot) | `validate` rouge à cause des clés i18n ci-dessus | à rebaser/relancer une fois cette PR mergée |

## 5. Documents à resynchroniser

- `ROADMAP_RESPONSIVE.md:8-11` : kanban explicitement obsolète, resync `#001`
  → `#020` annoncée « encore à faire » après la refonte UI (PR #273).
- `WCAG-22-AUDIT-CHECKLIST.md` : 14 cases de vérification non cochées → l'audit
  WCAG 2.2 AA n'est pas figé.
- `docs/final-release-review.md` (verdict `GO` au 2026-10-13) et
  `RESOLUTION_FINAL.md` (2026-10-11) précèdent les PR #266, #271-#273 et le lot
  du 2026-11-10 : verdict à re-prouver.
- `ROADMAP-INGENIERIE.md` : 27/27 `done`, rien à faire.

## 6. Sujet volontairement hors périmètre

`i18n` : site **FR-only** (`locales: ["fr"]`, `messages/en.json` archivé,
36 tests E2E EN ignorés). Réactivable, mais c'est une décision produit, pas une
dette.
