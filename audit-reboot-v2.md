# HASHCODE REBOOT — COMPLETE AUDIT & DECISION READINESS (V2)

> Audit READ-ONLY du 2026-10-08 (second passage). Aucune modification de code, ni d'issue, ni de PR, ni de branche effectuée pour produire ce rapport.
> Référentiel : `digitaleflex/hashcode_reboot` — disque = `main @2951bc7` (le rapport V1 `audit-reboot.md` est commité, rien n'a bougé depuis : mêmes 31 issues, mêmes 2 PR, `development` inchangée @`41bd11a`).
> Ordre des sources de vérité appliqué : code exécuté > tests exécutés > migrations/schéma > CI > commits > PR > issues > documentation > hypothèses.

## 1. Executive Summary

`main` @`2951bc7` est verte en CI et déployée : seule baseline démontrable. `development` @`41bd11a` est inchangée, rouge en CI, avec 55 commits de retard pour 1 d'avance. Les 31 issues et 2 PR sont identiques. Apport de ce second audit : timeline des commits, table des milestones, registre étendu (main vs development comparé fichier par fichier via le patch dev de 731 lignes), analyse EXTRACT des PR, démonstration du premier chantier candidat par candidat, et décisions Phase 0. Conclusion : **NOT READY (58/100)**, exécutable dès Phase 0 tranchée.

## 2. Repository State

- **REPOSITORY :** `digitaleflex/hashcode_reboot` (remote `git@github.com:digitaleflex/hashcode_reboot.git`, accès SSH lecture seule + `gh` HTTPS).
- **BRANCHES :** `main` (locale + `origin/main`, default, `origin/HEAD → origin/main`), `origin/development` (aucune branche locale `development`). Aucun fork observé.
- **BASELINE CANDIDATES :** `main@2951bc7` (CI verte, déployée prod, health `ok`) vs `origin/development@41bd11a` (CI rouge, jamais déployée).
- **HEADS :** `HEAD` = `origin/main` = `2951bc7` ; `origin/development` = `41bd11a`.
- **DIVERGENCES :** `main` 55 commits d'avance, `development` 1 commit d'avance ; 11 fichiers divergents (+514/-39) ; arbre de travail propre (`?? backups/` seul, dossier local jamais suivi).

## 3. Main vs Development

- **Commits exclusifs `main` (55) :** tout le durcissement prod (deploy.sh, backup B2, migrations de rattrapage, image migrate, cron FIFO, email/Resend, i18n, proxy `__Secure-`, alertes Discord, #100/#102/#106/#119/#120/#124/#117/#122/#141, doc API, audit).
- **Commits exclusifs `development` (1) :** `41bd11a` « Finalisation #155/#147 ».
- **Fichiers divergents (11) :** `docs/profiling-model.md` (+59, dev-only), `package.json` (+1 script test), 1 migration (`20261008000000_add_profile_snapshot`), `prisma/schema.prisma` (+102/-39 : modèle `ProfileSnapshot` + whitespace), `OrientationSection.tsx` (+75, nouveau), `dashboard/page.tsx` (+3), `account/orientation/route.ts` (+11/-), `members/route.ts` (+26), `orientation/resolve.ts` (+52, nouveau), `orientation/snapshots.ts` (+76, nouveau), `tests/profiling-finalization.test.ts` (+130, nouveau).
- **Migrations divergentes :** 1 dev-only (`...08000000`), additive pure, mais antérieure au tip main (`...08090000`) → fourche d'historique au merge, renumérotation requise.
- **CI divergente :** `main` verte ; `development` rouge sur `Module not found './events/local-time-note'` (bug `.gitignore` corrigé sur `main` par `c3508c3`, jamais reporté sur `development`).
- **MAIN STATUS :** saine, déployée, documentée (`api-reference.md` fraîche). **DEVELOPMENT STATUS :** branche de travail fossilisée, non mergée depuis 54 commits, CI rouge pour cause connue et déjà résolue ailleurs.
- **BASELINE RECOMMANDÉE :** `main@2951bc7`. Preuves : CI verte vérifiée à l'instant, prod `health ok`, 85 routes + 35 modèles + 28 migrations chaînées, 0 commit dev-only indispensable au fonctionnement (le snapshot est best-effort et désactivable).

## 4. Current Architecture

Moteur `src/lib/orientation/` (12 fichiers, `engineVersion "1.1.0"`) + `src/lib/profiling/` (9 fichiers), déterministe, sans LLM, couches déclaré/inféré/observé, score ≠ confidence, boucle `COLLECT → UNDERSTAND → IDENTIFY → ORIENT → ACTIVATE → OBSERVE → RE-SCORE`. Table par système : acquisition ACTIVE (landing, questionnaire, inscription, consentement, drafts, OTP, partage, events, communauté, analytics) ; orientation ACTIVE (engine, scoring, NBA, recos) ; dynamic profile PARTIAL (effet nul sur `main`) ; mentoring membre LEGACY (mock + 404) ; `OrientationSection` DEAD-sur-`main` ; LMS/Evidence/Portfolio/CORE DOC-ONLY ; `docs/architecture/` absente.

## 5. Current Product State

Positionnement déclaré (roadmap-v1 + bodies M1-M6) : couche d'acquisition et d'entrée, avec interdits explicites (archetype, parcours, CORE). Produit réel : acquisition complète ET orientation/archetypes/NBA/ateliers/mentoring branchés et testés. **CONTRADICTION exposée, non corrigée** (cf. §17 C1) : soit les interdits sont périmés (le socle existe, est testé, est en prod), soit une déconstruction est à chiffrer — elle n'a jamais été chiffrée nulle part.

## 6. Profiling / Orientation State

Moteurs existants : `profiling/engine` (déclaré), `auto-controls`, `validate`, `dynamicProfile`/`layers` (dynamique), `orientation/observed` (observé), `engine`+`recommendationEngine` (recos, seuil 0.3, top1=NBA), `scoring`/`confidence`/`matching`. Appelés : oui (inscription, complétion, `GET /api/account/orientation`, welcome). Testés : oui (7 suites TS + `.cjs`, dont 4 non câblées en CI). Visibles UX : oui (ProfileCard, RecommendationExperience, NextBestActionCard, NextSteps par archétype). Persistés : `Member.profileArchetype/tags`, `Qualification` (scores, confidence, reasons, engineVersion) — jamais les snapshots (dev-only). Legacy : mentoring membre, champs orientation JSON sans UI sur `main`. Récent : couches dynamique/observée (M2/M5), tout le patch `development` (snapshots, resolve, section dashboard).

## 7. Issues Audit

31/31 relues (bodies intégraux). READY : #210, #127. SAFE TO PARALLELIZE : #112, #133, #134, #137-audit, #138-baseline. BLOCKED (19) : voir graphe §19. DO_NOT_START : #136, #140, #159, #214, #215. Aucune OBSOLETE/DUPLICATE/REWRITE_REQUIRED/MOVE_REQUIRED/UNKNOWN : les bodies sont cohérents avec le positionnement affiché ; les références #106/#124/#141 sont hors lot (non inférées, marquées UNKNOWN dans les dépendances). Aucune issue n'est devenue obsolète du seul fait de contredire une doc — et aucune n'est READY du seul fait d'être ouverte (#127 l'est parce qu'elle n'a aucune dep backend ; #210 parce qu'elle est le socle désigné sans prérequis).

## 8. Pull Requests Audit

- **#204** (base `main`, 1 commit, +514/-39, CONFLICTING, checks mixtes) : fait réellement = couche HISTORIQUE du profiling-model (spec + table + resolve + snapshots + section dashboard + 6 tests). Déjà intégrée autrement ? Non (0 occurrence sur `main`). Compatible ? Oui techniquement (additif, best-effort) mais **incompatible avec le positionnement des issues** (hors-scope interdit) et avec la base (conflits). Contient-elle de l'utile ? Oui : spec + tests purs + `resolveOrientation`. Que du doc ? Non. Mergeable ? Non. → **EXTRACT** (spec + `resolve.ts` + tests, rebasés depuis `main`, sans la migration tant que C1 n'est pas tranchée) puis **CLOSE**. À défaut d'extraction : CLOSE pur.
- **#205** (base `main`, 7 commits, +154/-8, CONFLICTING, checks SUCCESS) : corrections de review phase 6 sur `orientation/destination|recommendationEngine` + 1 hunk CI. Même erreur de base ; contenu métier hors-scope ; hunk CI probablement obsolète. → **CLOSE**, micro-PR depuis `main` si le hunk CI reste pertinent.

## 9. Commit Audit (timeline)

`0f28162` M1 (moteur orientation + stabilisation typecheck) → `33ddf59` M2 (profiling engine) → `96a5f38` M3 (orientation branchée, NBA bout en bout) → `6800e0d` M4 (matching catalogue réel) → `3eab5c3` M5 (boucle comportementale) → `41bd11a` (finalisation #155/#147, dev-only). Puis sur `main` : durcissement VPS/TLS, email Resend/Brevo, 3 vagues i18n, admin (#100 tags/notes, #106 pipeline, #119 alertes, #120 activation, #124 import), sécurité #117 (+rotation CRON prouvée), CI (#122 doc API, check-messages, build.yml), `2951bc7` audit. Ont façonné le déployable : M1-M5 (socle), `cf8e1ed`+`063755c` (DB from-scratch), `0044d04` (cookie `__Secure-`), `6dab642` (Discord), `79d89be` (i18n dashboard). Expérimentaux : phase 6 orientation (`fix/phase6-*`, jamais mergée). Legacy : `bd14b02` (import sans le fichier `.gitignore`), Neon `db push` (soldé).

## 10. Database Audit

35 modèles (11 acquisition, déclaratif profiling, 11 workshops, 4 admin, 4 auth, divers), 28 migrations croissantes, 0 destruction active, 0 table orpheline. Cohérence main : totale. Cohérence development : 1 migration additive antérieure au tip (fourche, renuméroter). Dangereuses : aucune active. Drift : `Member_source_idx` (`IF NOT EXISTS` vs déclaré, cosmétique), en-tête « SQLite » périmé. Champs legacy : `adminNote` singleton (conservé à côté de `MemberNote`), `acceptedAt` jamais écrit, colonnes mentoring membre non consommées.

## 11. API Audit

85 `route.ts`. ACQUISITION : members, account, consents, profiling/draft, community, events, verify-email. PROFILING/ORIENTATION : consommées via members/complete-profile/account-orientation (pas de routes dédiées). WORKSHOP (6+5 admin), MENTORING (admin seul + page membre mock), ADMIN (email, pilotage, invitations, activation), AUTH (Better Auth + session + logout), CRON (8, GET+Bearer+locks, collision `123459`), WEBHOOK (resend Svix, brevo `?secret=`), OTHER (health, export, analytics, share). Mortes/incohérentes : aucune route morte ; incohérences = `bulk` sans CSRF, `join` sans rate-limit, `invite/accept` inerte volontaire (403), `check-email` constante volontaire, `orientation` sans écriture sur `main` (doc §4 à régénérer au merge).

## 12. Test Audit

Exécutés en CI : 19 `.cjs` + 3 suites TS + typecheck + lint + i18n + build. Non câblés : 4 suites TS, `integration.test.cjs`, `test:profiling-finalization` (dev). Skippés : E2E sans secrets (silencieux). Ignorés : aucun marqueur d'ignore relevé. Sans tests : routes HTTP, migrations, webhooks, crons réels, providers email, Better Auth, RSVP concurrence, RGPD E2E. Obsolètes : aucun (les suites orientation testent un moteur toujours présent ; si C1 conclut au retrait, 7 suites deviennent obsolètes d'un coup — coût compté).

## 13. CI/CD Audit

`ci.yml` + `build.yml` sur `main, development`, Node 22, `concurrency` cancel. Garantit réellement : compilation TS stricte, lint, logique pure unitaire, parité i18n, build prod. Ne garantit pas : migrations (aucun check), secrets (pas de scan), routes (pas de supertest), E2E (skippée sans secrets), déploiement (build local serveur). « CI verte » ≠ « produit vérifié » : l'exemple prouve le contraire dans les deux sens (`development` rouge pour un bug d'environnement déjà fixé ; `main` verte sans jamais exercer ses routes).

## 14. Security Audit

CRITICAL : aucun. HIGH : `bulk` sans CSRF (`members/bulk/route.ts`, operator-only mais SameSite-Lax — recommandation : ajouter `checkCSRF` comme PATCH/invite) ; `community/join` sans rate-limit (point d'entrée public, gonflement `JOINED` — recommandation : `join:<ip>` 30/10min). MEDIUM : `Consent.proof` JSON libre (borner comme `draft`) ; E2E skippée ; secrets exposés en chat (PAT×2, B2, Resend, Upstash, Discord, webhook — rotation recommandée, hors code). LOW : lock `123459` partagé (sérialisation inutile, pas de faille) ; RSVP/`draft` CSRF/guard manquants. INFO : `cron-auth.ts` + runbook + rotation prouvée ; webhooks fail-closed ; anti-énumération volontaire (duplicate générique, `check-email` constante, `phone` toujours `ok`).

## 15. Documentation Audit

Attendues vs présentes : `docs/architecture/` (absente, exigée par M1) ; `reboot-roadmap-v2.md`, `reboot-execution-order-v2.md`, `reboot-issue-resolution-contract.md` (absents, jamais référencés — attentes d'orchestration, pas liens cassés). Présentes : `reboot-roadmap-v1.md` (M0-M6, baseline `development`), `reboot-roadmap-execution-prompt.md` (règles moteur, interdit `confidence.ts` sauf justification), `profiling-model.md` (dev-only), 5 ADR (003/004 redondants), `api-reference.md` (fraîche), `secrets-rotation.md` (factuel), CONTRIBUTING (obsolète : Next 15, sans `development`, `middleware.ts` vs `proxy.ts`), `OBSOLETE_SCRIPTS.md` (contradiction interne sur `seed-workshops.ts`), `ROADMAP-PRIORITES-2026.md` + `AI-AGENT-OPERATING-MODEL.md` (2 autres découpages, zéro référence croisée).

## 16. Milestone Audit

| Système | Milestone | Objectif | Correspondance | Contradiction |
|---|---|---|---|---|
| roadmap-v1 | M0 tri/backlog | M0-M6 (09/10→27/11) | Partielle : M1-M6 ≈ M1-M6 issues #210-#215 par nom | Issues REBOOT-001-005 (M0) inexistantes ; M0 jamais exécuté comme tri |
| ROADMAP-PRIORITES | M01-M09 funnel | visiteur→parrainage (#100-#176) | Inconnue : aucune table vers M0-M6 | Deux roadmaps sans référence croisée ; #210-#215 ignorent M01-M09 |
| Operating-Model | 7 milestones Foundation→UX V2 | agents par numéros d'issues | Inconnue | 3e découpage, fait foi nulle part |
| Issues M1-M6 | #210-#215 | acquisition→release | Noms alignés sur roadmap-v1 | Bodies interdisent ce que le code contient (C1) |

Décision requise : figer la table M01-M09 ↔ M0-M6 ↔ #210-#215 avant M3.

## 17. Contradiction Register

- **C1 SEV bloquante** — A : bodies #105/#211/#213/#215 (pas d'archetype/parcours). B : code `main` (orientation+NBU+archétypes+ateliers+mentoring branchés, testés, en prod). Impact : tout le plan dépend du sens de résolution. Décision : acquérir (réécrire les interdits) ou démanteler (chiffrer).
- **C2 SEV bloquante** — A : execution-prompt + mission V1 (baseline `development`). B : preuves (dev rouge + 55 commits de retard, main verte + déployée). Impact : toute exécution sur `development` régresse. Décision : baseline `main@2951bc7`, geler/resynchroniser `development`.
- **C3 SEV haute** — A : CLOSE #204 (hors-scope). B : valeur d'archive additive et testée. Impact : perte de la couche HISTORIQUE documentée. Décision : EXTRACT-then-CLOSE ou CLOSE pur (§8).
- **C4 SEV haute** — A/B/C : trois milestones (§16). Impact : double pilotage, issues orphelines. Décision : table de correspondance opposable.
- **C5 SEV moyenne** — A : mission V2 (4 docs attendus). B : disque (absents, jamais référencés). Impact : gouvernance inexécutable en l'état. Décision : créer minimal ou abandonner explicitement.
- **C6 SEV moyenne** — A : CONTRIBUTING/BRANCH-POLICY. B : réel (Next 16, `proxy.ts`, `development` baseline de fait hier). Impact : contributeur/IA désorientés. Décision : réaligner.
- **C7 SEV basse** — ADR-003 vs ADR-004 (même décision). Décision : fusionner.
- **C8 SEV basse** — A : `EVENT_TYPES` whitelist. B : patch dev écrit `orientation_scored` en direct. Décision : étendre ou retirer au merge.
- **C9 SEV basse (nouvelle)** — A : `main` verte sans E2E. B : E2E skippée sans secrets. Impact : faux sentiment de couverture. Décision : fournir les secrets CI ou marquer E2E « non vérifié ».

## 18. Technical Debt

P0 : C1, C2 (décisions). P1 : bulk CSRF ; join rate-limit ; mentoring membre mort ; migration dev à renuméroter ; E2E #113/#139 à fusionner ; C9 (secrets E2E). P2 : 4 suites TS non câblées ; pas de check migrations/scan en CI ; `Consent.proof` ; pagination legacy ; `ProfileCard` dupliquée ; `Member_source_idx` ; en-tête SQLite ; C6/C7. P3 : docs DOC-ONLY ; double harnais ; 24 vs 26 types analytics ; C8.

## 19. Dependency Graph

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

Chaînes critiques : #210→#153→#145→#214 ; #210→#158→#156→#213 ; #210→#211→#212→#215. Nœud #212.

## 20. 7-Lane Status

LANE 1 Core : DÉMARRABLE, #210, 1 agent. LANE 2 State/Quali : BLOQUÉE (#158 puis #211 lockstep), 2 après #210. LANE 3 Security : PARTIELLE (inventaire #153, #137, #138), 2 après #210. LANE 4 Admin/Ops : BLOQUÉE (#103 dès #210), 2 après déblocage. LANE 5 Handoff : BLOQUÉE (#212), 1 agent. LANE 6 UX : DÉMARRABLE, #127, 2 max. LANE 7 Quality : PARTIELLE (#112), 1 agent. **Capacité sûre aujourd'hui : 2 agents** (#210 + #127/#138). 7 lanes = plafond théorique post-#210, jamais un plan de démarrage.

## 21. File Ownership

`prisma/schema.prisma` + `migrations/*` → LANE 1, owner exclusif, conflit CRITIQUE. `src/lib/orientation/*`, `profiling/*`, `qualification.ts` → LANES 1-2, reviewer statuts commun, conflit HAUT. `src/app/api/*` → lane domaine + reviewer LANE 3 (gardes), conflit MOYEN. `src/lib/cron/*`, `registry.ts` → LANES 4/7, MOYEN. `src/app/[locale]/*`, `messages/fr.json` → LANE 6 seule, MOYEN (churn). `tests/*` → miroirs par lane, FAIBLE. `.github/*`, `docs/api-reference.md` → LANE 7, FAIBLE. `audit-reboot.md`, `audit-reboot-v2.md` → gelés (toute mise à jour = commit docs dédié).

## 22. Phase 0 Decisions

| DECISION | WHY | BLOCKS | SANS ELLE ? |
|---|---|---|---|
| Baseline `main@2951bc7`, gel `development` | C2 : exécuter sur dev régresse | Tout | Non : risquer 55 commits de régression |
| C1 : acquérir vs démanteler l'orientation | Code contredit les issues | #210 (modèles), #211 (règles), #212 (contrat) | Non : contrats sur périmètre faux = migrations en chaîne |
| #204/#205 : EXTRACT-then-CLOSE ou CLOSE | Conflits + base fausse + valeur partielle | `development`, migration snapshot | Oui pour le reste si on ne les touche pas |
| Table milestones opposable | C4 : triple pilotage | M3 et au-delà | Oui pour M1-M2 |
| Gouvernance minimale (`docs/architecture/`, contract ou abandon) | C5 : M1 l'exige | M1-dossier, revues | Oui pour le code, non pour la revue M1 |

## 23. First Three Issues (démonstration, pas de présomption)

- **#210** : VALUE = débloque 19 issues ; DEPS = ∅ ; RISK = moyen (modèles `Lead`/`AcquisitionSession` sur `schema.prisma`, migrations en chaîne si raté) ; READINESS = READY (body complet, fichiers identifiés) ; FILES = `schema.prisma`, `migrations/*`, `src/lib/acquisition*`, `src/app/api/members/*` ; CONFLICTS = exclusif lane 1 ; IMPACT = fondation de tout. → **FIRST**.
- **#153** : VALUE = débloque 4 issues, empêche sur-stockage irréversible ; DEPS = #210 (inventaire lecture seule parallélisable fin #210) ; RISK = faible (doc+tests) ; READINESS = READY-partiel ; FILES = `docs/*`, `schema.prisma` (lecture), tests ; CONFLICTS = aucun si lecture seule ; IMPACT = condition de #145/#212/#101. → **SECOND**.
- **#158** : VALUE = vérité d'état, débloque #156→#213, aligne #211 ; DEPS = #210 ; RISK = moyen (statuts partagés avec #211 → lockstep, 1 reviewer) ; READINESS = READY dès #210 vert ; FILES = `src/lib/*state*`, `members/route`, `Qualification` ; IMPACT = impose idempotence avant contrats. → **THIRD**.
- Écartés et pourquoi : #211/#212 (contrats sur modèles inexistants) ; #118 (protéger des endpoints pas encore figés) ; #145 avant #153 (textes sans matrice = réécriture) ; #127 n'est pas FIRST globale mais FIRST UX (lane verte indépendante, démarrable jour 1 en parallèle de #210).

## 24. Parallelization Plan

Phase 0 : 5 décisions (§22), zéro code. Phase 1 : #210 (agent A) + #127 + #138-baseline (agent B, doc/mesure). Phase 2 : #153-inventaire (fin #210) + #158, puis #211 lockstep. Phase 3 : #118 + #145, #103 + #104, #132. Phase 4 : #212 (1 agent) + #105. Phase 5 : QA (E2E fusionnée, #140, #137-correctifs, #135/#136), #215 après #159. Invariants : ≤2 chantiers pré-#210 ; jamais 2 lanes sur `schema.prisma` ; `api-reference.md` régénérée à chaque merge touchant les routes.

## 25. Risks

Merge #204 par habitude ; rebase dev sans renumérotation ; 7 agents jour 1 ; coder avant C1 ; exposer avant #118/#145 ; CI verte sans E2E (C9) ; snapshot sans table (perte silencieuse) ; `development` qui redérive après resync ; Phase 6 (`fix/phase6-*`) jamais statuée et confondue avec #205.

## 26. Things NOT to do

1. Ne pas merger/rebaser/pousser #204, #205, `development` vers `main`.
2. Ne pas coder `archetype`/`recommendationEngine`/`snapshots`/matching général/CORE/mentoring/communauté/LMS avant C1.
3. Ne pas démarrer #212/#213/#101/#113/#214/#215 avant #210 + #153.
4. Ne pas dépasser 2 chantiers avant #210 vert.
5. Ne pas importer le schéma JoinHashCode (#212 = contrat).
6. Ne pas exposer publiquement avant #118 + #145.
7. Ne pas supprimer `confidence.ts`/`recommendationEngine.ts` au nom du prompt ; ne pas recréer `ProfileSnapshot` sans la migration renumérotée.

## 27. Readiness Score

Architecture 6 · Code 7 · Database 8 · API 7 · Tests 5 · Security 6 · CI/CD 5 · Documentation 4 · Backlog 7 · PR Hygiene 3 · Execution readiness 6 → **58/100 → NOT READY** (exécutable dès Phase 0 : baseline + C1 + milestones ; le point retiré vs V1 sanctionne C9/E2E et la doc de gouvernance confirmée absente).

## 28. Final Recommendation

Même recommandation que V1, renforcée par l'absence totale de mouvement depuis : figer `main@2951bc7`, geler `development`, trancher C1 (avis maintenu : acquérir le socle existant — testé, branché, en prod — et réécrire les interdits), EXTRACT-then-CLOSE #204 / CLOSE #205, lancer #210 + #127 (2 agents max), exiger table milestones + `docs/architecture/` minimale avant M3. La qualité de cet audit se mesure à sa conclusion : **ce qui est vrai** (`main` verte et déployée, orientation branchée et testée, 28 migrations saines), **ce qui ne l'est plus** (`development` comme baseline, les interdits des issues face au code, les 4 docs attendus), **ce qui doit être décidé** (§22), **le premier chantier sans dette nouvelle** : #210, avec #127 en parallèle verte.

---

BASELINE: `main @2951bc7`
DEVELOPMENT STATUS: fossilisée, CI rouge (cause connue, fixée sur main), 55 commits de retard — à geler, pas à merger en l'état
PRODUCT SCOPE: acquisition + orientation/archetypes/NBA/ateliers/mentoring réellement embarqués — CONTESTÉ par les issues, décision C1 requise
ORIENTATION STATUS: UNDECIDED (recommandation : KEEP — socle testé et en prod — mais la décision vous appartient)
LEGACY PR STATUS: #204 EXTRACT-then-CLOSE, #205 CLOSE (non exécuté, à vous)
GOVERNANCE STATUS: 4 docs absents, 3 milestones concurrents, CONTRIBUTING obsolète — à créer/minimaliser avant M3
FIRST ISSUE: #210
SECOND ISSUE: #153
THIRD ISSUE: #158
MAX SAFE PARALLEL AGENTS: 2
READY TO EXECUTE: NO (YES dès Phase 0 tranchée)

Preuves : `audit-reboot.md` (rapport V1, commité `2951bc7`), `/tmp/opencode/audit/` (patch dev 731 lignes, 31 bodies d'issues, doc dev).
