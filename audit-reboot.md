# HASHCODE REBOOT — COMPLETE AUDIT

> Audit READ-ONLY du 2026-10-08. Aucune modification de code effectuée pour produire ce rapport.
> Référentiel : `digitaleflex/hashcode_reboot` — disque = `main @641d7d3`, branche `development @41bd11a` observée sans checkout (via `git show` / `git diff`).

## 1. Executive Summary

`main` (@`641d7d3`) est verte en CI, déployée et fonctionnelle : c'est la seule baseline viable. `development` (@`41bd11a`) est rouge en CI sur un bug déjà corrigé sur `main`, avec 54 commits de retard pour 1 seul commit d'avance. Les 4 documents de gouvernance cités par la mission **n'existent pas**. Trois systèmes de milestones coexistent sans correspondance. Le backlog (31 issues, créées aujourd'hui) définit Reboot comme « acquisition seule, sans orientation/archetypes » **alors que `main` embarque déjà** moteur d'orientation, archétypes, Next Best Action, ateliers, mentoring : c'est la contradiction centrale. Verdict : **NOT READY (59/100)** — exécutable à condition de trancher la baseline et le périmètre avant tout code. Premier chantier : **#210**.

## 2. Repository State

- **Repository:** `digitaleflex/hashcode_reboot` — **Branch auditée :** `development` (prescrite) observée sans checkout, via `git show`/`git diff` uniquement ; travail sur disque = `main`.
- **HEAD (disque) :** `641d7d3` « docs(api): reference des routes API reellement exposees (#122) ».
- **Default branch :** `main` (`origin/HEAD → origin/main`).
- **Divergence :** `main` a 54 commits d'avance sur `development` ; `development` a 1 commit d'avance (`41bd11a` « Finalisation #155/#147 »).
- **Open issues :** 31. **Open PRs :** 2 (#204, #205, toutes deux `CONFLICTING`, base `main`).
- **CI :** `main` verte (CI + Build `success` sur `641d7d3`) ; `development` rouge (CI + Build `failure` — cause : `Module not found './events/local-time-note'`, bug `.gitignore` déjà corrigé sur `main` par `c3508c3`).

## 3. Current Architecture

Déclarée (`reboot-roadmap-v1.md`, `execution-prompt`) : moteur `src/lib/orientation/` indépendant de React, déterministe, sans LLM/ML, couches déclaré/inféré/observé, score ≠ confidence, boucle `COLLECT → UNDERSTAND → IDENTIFY → ORIENT → ACTIVATE → OBSERVE → RE-SCORE`. Réelle (vérifiée) : `src/lib/orientation/` (12 fichiers) + `src/lib/profiling/` (9 fichiers) existent et sont exécutés ; `engineVersion "1.1.0"` ; écarts non documentés : `confidence.ts` présent alors qu'interdit sauf justification, `recommendationEngine.ts` au lieu du `recommendations.ts` attendu, 6 fichiers surnuméraires. `docs/architecture/` **n'existe pas** (exigée par M1).

## 4. Current Product State

Présent et branché : landing + funnel (`page.tsx`, `landing/`, analytics `reboot_cta_clicked`), questionnaire + inscription (`profiling-flow`, `POST /api/members`, auto-controls), complétion invités, consentement RGPD (`Consent` append-only), drafts/relance J+7, OTP + session, profil public/partage, événements + RSVP, communauté WhatsApp (point d'entrée unique `/api/community/join`), orientation + NBA + archétypes, ateliers (11 modèles, unlock linéaire), analytics funnel (24 types). Partiel : boucle OBSERVE→RE-SCORE (moteur branché, effet nul sur recos sur `main`), mentoring côté membre (page mock, champs hors schéma → toujours « aucun mentor », lien mort `/setup`). Mort sur `main` : `OrientationSection` (n'existe que dans le patch `development`). DOC-ONLY : LMS/Evidence/Portfolio/CORE (un seed + du CSS, aucun modèle).

## 5. Profiling / Legacy State

`profiling/*` réellement exécuté (`engine`, `auto-controls`, `validate`, `questions`, `dynamicProfile` via `GET /api/account/orientation`) ; `matching.ts` seulement côté admin ; `orientation/*` consommé par inscription/complétion/orientation/welcome. Couches INFERRED/OBSERVED/DYNAMIQUE partiellement implémentées ; couche HISTORIQUE (`ProfileSnapshot`, `recordSnapshot`, `resolveOrientation`) absente de `main`, présente sur `development` (additif pur, best-effort, jamais de 500). Actions : REWRITE page mentoring membre ; REVIEW `matching.ts` côté membre, champs orientation JSON sans UI (le patch les consomme), `Consent.proof` sans borne, `ProfileCard` vs `PublicProfileCard` ; DEPRECATE pagination legacy ; KEEP garde-fous et double harnais de tests.

## 6. Issues Audit

31 ouvertes, bodies respectant le positionnement (interdits archetype/CORE explicites). Classification : READY : #210, #127. SAFE TO PARALLELIZE (doc/mesure) : #112, #133, #134, #137 (audit), #138 (baseline). BLOCKED : #101←#153, #103←#210, #104←#210+#211, #105←#211+#212, #113←#210→#211→#212 (+fusion avec #139), #118←#210, #128←#127, #129/#130/#135←#128, #132←#210+#211, #145←#153, #153←#210, #156←#158, #158←#210, #211←#210, #212←#210+#211+#153+externe, #213←#158+#156. DO NOT START : #136, #140, #159, #214, #215. Aucune OBSOLETE/MOVE/REWRITE. Références #106/#124/#141 dans les bodies = hors lot, non inférées.

## 7. Pull Requests Audit

- **#204** (1 commit, 11 fichiers, `CONFLICTING`, checks mixtes) : contenu = exactement le hors-scope (profiling-model, `ProfileSnapshot`, `OrientationSection`, `resolve`/`snapshots`) + base `main` fausse pour un travail issu de `development`. Verdict stratégique : CLOSE. Nuance technique : le contenu est additif pur, compatible, lecture seule, jamais de 500 — sa valeur comme archive de la couche HISTORIQUE documentée est réelle. Décision à prendre : CLOSE pur ou CLOSE + conservation de `docs/profiling-model.md` hors code.
- **#205** (7 commits, 5 fichiers, `CONFLICTING`, checks SUCCESS) : même erreur de base ; seul hunk sauvable = `.github/workflows/ci.yml`, probablement obsolète (`main` déjà verte). Verdict : CLOSE, micro-PR depuis `main` à jour si le fix CI reste pertinent.

## 8. Commit Audit

`development` : M1 (moteur orientation) → M2 (profiling engine) → M3 (orientation branchée) → M4 (matching catalogue réel) → M5 (boucle comportementale) → `41bd11a` (finalisation #155/#147). Ces commits M1-M5 sont les ancêtres du socle orientation déjà présent sur `main`. `main` au-dessus : 54 commits (déploiement, email, i18n, admin #100/#102/#106/#119/#120/#124, sécurité #117, docs #122). Le commit dev-only `41bd11a` ajoute : `ProfileSnapshot` + migration, `resolve`/`snapshots`, `OrientationSection`, snapshot à l'inscription et au re-score.

## 9. Database Audit

35 modèles, 28 migrations en chaîne croissante saine, zéro destruction active (que des rollbacks commentés), passif Neon soldé — déployable from scratch. Classes : acquisition (Member, ProfilingDraft, AnalyticsEvent, EmailEvent, MemberEmailLog, Event/EventRsvp/EventReminderLog, EmailProviderMetric, EmailTemplate, Consent, MemberSession), profiling-déclaratif (colonnes Member, Qualification double casquette), pédagogique (11 Workshop*), admin (AdminKey, AuditLog, MemberNote, MemberBlacklist, Mentorship*), auth Better Auth. Migration dev `20261008000000` : additive et applicable, mais **antérieure au tip `main` `20261008090000`** → renuméroter après rebase + `migrate status`/`diff --check`. Risques : `recordSnapshot` fail-silent sans la table ; index `Member_source_idx` en `IF NOT EXISTS` (drift nominal cosmétique) ; commentaire d'en-tête « SQLite » périmé.

## 10. API Audit

85 fichiers `route.ts`, `docs/api-reference.md` fraîche sur `main` (5/5 spot-checks conformes), déjà périmée vis-à-vis de `development` (snapshot non documenté). Répartition : acquisition (members, account, consents, profiling/draft, community, events, verify-email), auth, workshops + admin ateliers/mentoring/email/pilotage, 8 crons GET + Bearer + locks, webhooks, divers. Écarts sécurité auto-signalés et confirmés : `bulk` sans CSRF, lock `123459` partagé (admin-alerts/collect-metrics), `community/join` sans rate-limit, `profiling/draft` sans `blockIfTesting`, RSVP sans CSRF.

## 11. Test Audit

19 suites unit `.cjs` + 7 suites TS (seules 3 câblées en CI) + Playwright (skippé sans secrets). Couvert : profiling/orientation pur, matching, pipeline, imports, notes, workshops, crons-registry/auth. Non couvert : routes HTTP (auth/CSRF/rate-limit), migrations, webhooks, crons réels, providers email, Better Auth, RSVP concurrence, RGPD bout en bout. `integration.test.cjs` exclu de la CI ; 4 suites TS + `test:profiling-finalization` (dev) non câblées.

## 12. CI/CD Audit

`ci.yml` (typecheck+lint+unit+3 suites orientation+i18n, detect-secrets, e2e conditionnel) + `build.yml` (build avec env factices) sur `main` et `development`, Node 22. Manques : aucun contrôle migrations, aucun vrai secrets scan (gitleaks), E2E silencieusement skippé sans secrets (un `main` vert peut n'avoir jamais exercé les routes), `test:all` jamais exécuté, pas de SAST/dependabot, protection de branche non vérifiable depuis le disque. Rappel : la CI prouve la compilabilité, pas le déployé (prod = build local serveur).

## 13. Security Audit

CRITICAL : aucun (pas d'exposition de secret client détectée). HIGH : `bulk` sans CSRF ; `community/join` sans rate-limit (point d'entrée WhatsApp). MEDIUM : `Consent.proof` JSON sans borne ; E2E skippé = routes non exercées ; 2 PAT + clés B2/Resend/Upstash/webhook exposés dans le chat (rotation déjà recommandée). LOW : lock cron partagé, RSVP sans CSRF, `draft` sans `blockIfTesting`. INFO : runbook `docs/secrets-rotation.md` + `cron-auth.ts` + rotation CRON_SECRET déjà prouvée ; ne pas exposer publiquement avant #118 + #145.

## 14. Contradiction Register

- **C1 (bloquante) : backlog « acquisition seule » vs code `main` qui embarque orientation/archétypes/NBA/ateliers/mentoring.** Source A : bodies #105/#211/#213/#215. Source B : cartographie (§4). Décision : trancher si le socle existant est acquis (alors réécrire les interdits des issues) ou à démanteler (alors chiffrer le retrait avant #210).
- **C2 : baseline `development` prescrite vs `main` seule viable** (verte/déployée, dev rouge + 54 commits de retard). Décision : basculer la baseline sur `main@641d7d3`, geler ou resynchroniser `development`.
- **C3 : #204 CLOSE (stratégie) vs valeur d'archive (technique).** Décision : à prendre (§7).
- **C4 : trois milestones sans correspondance** (M0-M6, M01-M09, Operating-Model). Décision : figer une table M01-M09 ↔ M0-M6.
- **C5 : 4 docs de gouvernance attendus absents**, sans aucun lien cassé (attentes d'orchestration). Décision : créer ou abandonner explicitement (`docs/architecture/`, v2, execution-order, contract).
- **C6 : CONTRIBUTING obsolète** (Next 15, sans `development`, `middleware.ts` vs `proxy.ts`, `seed-workshops.ts` contesté). Décision : réaligner.
- **C7 : ADR-003 vs ADR-004 redondants.** Décision : fusionner.
- **C8 : `orientation_scored` écrit en direct, absent de la whitelist analytics** (patch dev). Décision : étendre `EVENT_TYPES` au merge ou retirer l'écriture.

## 15. Technical Debt

P0 : C1, C2 (décisions, pas du code). P1 : `bulk` sans CSRF ; `community/join` sans rate-limit ; mentoring membre mort (404) ; migration dev à renuméroter ; E2E #113/#139 à fusionner. P2 : suites TS non câblées ; pas de contrôle migrations/secrets-scan en CI ; `Consent.proof` sans borne ; pagination legacy ; `ProfileCard` dupliquée ; `Member_source_idx` ; commentaire SQLite. P3 : ADR redondants ; docs DOC-ONLY (`superpowers`, `plan-invitation`) ; double harnais CJS/tsx ; `analytics.ts` 24 vs 26 types.

## 16. Dependency Graph

```
#210 ─┬─→ #158 ─┬─→ #156 ─→ #213
      │         └─→ #211 (statuts partagés, lockstep, 1 reviewer)
      ├─→ #211 ─┬─→ #212 ─→ #215
      │         ├─→ #104 ─→ #101 (+#153 pour #101)
      │         ├─→ #105 ─→ (dashboard qualité)
      │         └─→ #132
      ├─→ #153 ─┬─→ #145 ─→ #214 ─→ #140 ─→ #159
      │         ├─→ #212 (transmission minimale)
      │         └─→ #215 (privacy review)
      ├─→ #103 ─→ (import #124, hors lot)
      └─→ #118 (dès #210 vert)

#127 ─→ #128 ─┬─→ #129, #130, #135 ─→ #136 (jamais avant stabilisation)
              └─→ #139 (∩#113 → fusionner en 1 E2E après #212) ─→ #140
Parallélisables doc/mesure : #133, #134, #137-audit, #138-baseline, #112 (avec re-calibrage)
```

Chaînes critiques : #210→#153→#145→#214 ; #210→#158→#156→#213 ; #210→#211→#212→#215. Nœud de convergence : #212.

## 17. 7-Lane Status

| Lane | Status | First ready | Parallèle max utile |
|---|---|---|---|
| Core Foundation | Démarrable (1 issue) | #210 | 1 agent |
| State/Qualification | Bloquée | #158 (puis #211 lockstep) | 2 après #210 |
| Security/Trust | Partielle (inventaire #153 + #137 + #138) | #153 | 2 après #210 |
| Admin/Data Ops | Bloquée | #103 (dès #210) | 2 après déblocage |
| Integration/Handoff | Bloquée | #212 | 1 (conception partagée) |
| UX/Acquisition | **Démarrable (seule verte)** | #127 | 2 max (#127 + 1 doc) |
| Quality/Release | Partielle (#112 seul) | #112 | 1 |

Max 2 chantiers avant #210 vert (Foundation + UX-doc/mesure). Propriété fichiers critiques : `schema.prisma`/`migrations/*` → lane 1 seule ; `src/lib/orientation|profiling` → lanes 1-2 avec reviewer commun ; `src/app/api/*` → lane propriétaire + revue lane 3 pour les gardes ; `tests/*` miroirs par lane ; `docs/*` lane 6/7.

## 18. File Ownership

`prisma/schema.prisma`, `prisma/migrations/*` → LANE 1 exclusif (conflit garanti sinon). `src/lib/orientation/*`, `src/lib/profiling/*`, `src/lib/qualification.ts` → LANE 1-2, 1 reviewer statuts partagé. `src/app/api/*` → lane du domaine, revue LANE 3 sur auth/CSRF/rate-limit. `src/lib/cron/*`, `registry.ts` → LANE 4/7. `src/app/[locale]/*`, `messages/fr.json` → LANE 6 (pas 5 en parallèle : churn copy). `tests/*` → chaque lane ses miroirs. `.github/*`, `docs/api-reference.md` → LANE 7.

## 19. First Three Issues

1. **#210 Acquisition Foundation** — seule READY du chemin critique ; tout le backend bloqué converge dessus ; inclure garde-fou « zéro dépendance JoinHashCode ».
2. **#153 Gouvernance données** — court, débloque #145/#212-transmission/#101/#215-privacy ; empêche le sur-stockage irréversible ; inventaire lecture seule parallélisable à la fin de #210.
3. **#158 Machine à états** — vérité VISITOR→HANDOFF, débloque #156→#213, aligne les statuts avec #211 ; impose idempotence avant #211/#212. Ensuite #211 (reviewer commun) → #118 + #145 en parallèle → #212.

## 20. Parallelization Plan

Phase 0 (sans code) : trancher C1 + C2 + C4 + CLOSE/NOT #204/#205. Phase 1 : #210 (1 agent) + en parallèle #127 + #138-baseline (1 agent, doc/mesure seule). Phase 2 : #153 (inventaire) + #158, puis #211 lockstep avec reviewer #158. Phase 3 : #118 + #145 en parallèle, #103 + #104, #132. Phase 4 : #212 (1 agent, conception partagée) + #105. Phase 5 : QA (#113/#139 fusionnés, #140, #137-correctifs, #135/#136), release #215 après #159. Jamais plus de 2 chantiers pré-#210 ; jamais 2 lanes sur `schema.prisma`.

## 21. Risks

Rebase `development` → `main` sans renumérotation migration (fourche d'historique) ; merge #204 par habitude (réintroduit du hors-scope + conflits) ; 7 agents d'un coup (conflits `schema.prisma`/`src/lib`) ; coder `archetype`/`recommendationEngine`/`snapshots` avant C1 tranchée ; exposer l'acquisition avant #118/#145 (spam + juridique) ; E2E verte en apparence jamais exécutée (secrets) ; `recordSnapshot` sans table = perte silencieuse.

## 22. Things NOT to do

1. Ne pas merger/rebaser #204 ni #205 ; ne pas pousser `development` vers `main`.
2. Ne pas coder `archetype`, `recommendationEngine`, `snapshots`, matching général, CORE, mentoring, communauté, LMS avant C1 tranchée.
3. Ne pas démarrer #212/#213/#101/#113/#214/#215 avant #210 vert + #153.
4. Ne pas lancer plus de 2 chantiers avant #210.
5. Ne pas étendre `matching.ts` ni importer le schéma JoinHashCode (#212 = contrat, pas import).
6. Ne pas exposer publiquement avant #118 + #145.
7. Ne pas supprimer `confidence.ts`/`recommendationEngine.ts` au motif du prompt (écarts consommés, à documenter pas à régresser).

## 23. Readiness Score

Architecture 6 · Code 7 · Database 8 · Tests 5 · Security 6 · CI 6 · Documentation 5 · Backlog 7 · PR hygiene 3 · Execution readiness 6 → **59/100 → NOT READY** (exécutable dès Phase 0 tranchée : baseline + C1 + table milestones).

## 24. Final Recommendation

Le repo est sain techniquement (`main` verte, DB from-scratch, docs API fraîches) mais **indécidable en l'état** : baseline contestée, périmètre contredit par le code, jalons concurrents. Recommandation : (1) figer `main@641d7d3` comme baseline et geler `development` ; (2) trancher C1 — avis : le socle orientation existant est testé et branché, le déclarer acquis et réécrire les interdits plutôt que le démanteler ; (3) CLOSE #204 (archive `profiling-model.md` hors code si valeur) et CLOSE #205 ; (4) lancer #210 + #127 en parallèle (2 agents max) ; (5) exiger table M01-M09↔M0-M6 + `docs/architecture/` minimale avant M3. Aucune modification effectuée pendant cet audit.
