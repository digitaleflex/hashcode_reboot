# HASHCODE REBOOT — FINAL EXECUTION READINESS AUDIT

Date : 2026-10-08. Mission strictement READ-ONLY (aucune modification de code,
issue, PR ou branche — ce fichier de rapport excepté, publié sur demande explicite).
Dépôt : `digitaleflex/hashcode_reboot`. Baseline : `main @ 0b2f106` (= origin/main,
arbre propre). Fait suite à `audit-reboot.md` (V1), `audit-reboot-v2.md` (V2) et
`audit-reboot-pr-forensic.md` (PR #204 EXTRACT THEN CLOSE, PR #205 CLOSE).
Lanes de vérification : audit readiness #210 (2 docs contrat absents, 2/7 modèles
présents, verdict NOT READY) et évaluation parallèle #127 (verdict PARALLEL SAFE
sous périmètre disjoint). Score précédent : 58/100.

## 1. État actuel (revérifié le jour J)

- main opérationnelle : `0b2f106`, CI verte, prod déployée health ok.
- development divergente : 57/1 (l'écart vs V2 = les seuls commits de rapports d'audit).
- PR #204 et PR #205 : OPEN, CONFLICTING (reconfirmé ; un statut UNKNOWN transient
  observé entre-temps n'était qu'un recalcul GitHub).
- Issues #210 et #127 : OPEN.
- `docs/architecture/` : n'existe pas. `docs/roadmap/` : `reboot-roadmap-v1.md` seul.
- Aucun changement rendant les audits précédents obsolètes.

## 2. Phase 0 — décisions

| ID | Status | Décision | Blocker | Action / Owner / When |
|---|---|---|---|---|
| C1 périmètre orientation | DECISION REQUIRED | Scope #210 incompatible avec le code réel (Qualification persiste du scoring que l'issue exclut ; 5 modèles manquent mais 4 proxys existent) | BLOCKING | Arbitrage écrit modèle-par-modèle / Owner : toi / Avant tout code #210 |
| C2 baseline | DECISION REQUIRED | main = baseline (CI verte + prod) ; development gelée, jamais mergée | BLOCKING | Déclarer le gel de development / Owner : toi / Avant extraction #204 |
| C3 PR | RESOLVED | #204 EXTRACT THEN CLOSE, #205 CLOSE ; NON-BLOCKING pour #210 | NON-BLOCKING | Ordre : CLOSE #205 → C1 → extraction #204 |
| C4 milestones | DECISION REQUIRED | Canonique provisoire : `reboot-roadmap-v1.md` ; M0-M6/M01-M09/Operating Model à archiver | NON-BLOCKING | Archiver les 2 systèmes non retenus / Owner : toi / Avant #211 |
| C5 gouvernance | DECISION REQUIRED | Minimum : les 2 docs contrat manquants (boundary + execution-order) | NON-BLOCKING | Rédiger 2 docs courts / Délégable / Avant code #210 |

## 3. C1 — produit

Socle réel vérifié : profiling, orientation (engine/scoring), archetypes, scoring,
recommendations, Next Best Action, workshops — existe et tourne en prod.
Il n'empêche pas #210 : c'est l'énoncé de #210 qui contredit le code
(« pas de scoring d'orientation » alors que Qualification le persiste déjà).

- CURRENT PRODUCT SCOPE : socle orientation complet + acquisition phase 1
  (Consent, Qualification, API consents, transaction invite `#210 p2`).
- TARGET PRODUCT SCOPE : #210 phase 2 = les 5 modèles manquants + API + tests,
  branchés sur le socle existant, sans le réécrire.
- BOUNDARY RULE : aucune nouvelle table qui duplique un proxy existant sans
  arbitrage écrit ; aucun deuxième moteur (orientation, scoring, reco) ; tout
  champ scoring reste dans Qualification, jamais copié.

## 4. C2 — baseline

BASELINE : main. DEVELOPMENT POLICY : development gelée (aucun push, aucune PR
vers elle). REBASE/RESET/FREEZE : FREEZE — pas de reset (historique à conserver
pour l'extraction #204), pas de merge (fourche + CI rouge). Risque migration :
nul côté main ; côté dev : à évaluer à l'extraction, pas avant.

## 5. C4 — milestones

Canonique : `reboot-roadmap-v1.md` (M0 backlog, M1 Foundation, M2 features,
M3 classification). #210-#215 s'insèrent en M1. Archiver : toute référence
M01-M09 et Operating Model non rattachée à ce fichier. Résolution NON requise
avant #210 (provisoire suffit), requise avant #211.

## 6. C5 — gouvernance

Minimum indispensable : (1) `docs/architecture/reboot-joinhashcode-boundary.md`
(la frontière, 1 page) ; (2) `docs/roadmap/reboot-execution-order-v2.md`
(l'ordre + arbitrage C1, 2 pages). Ce sont exactement les 2 docs que #210 exige
déjà. Rien d'autre avant le code.

## 7. #210 — verdict : NOT READY

Criteria clairs, conventions/tests/API/audit/RGPD/rate-limit réutilisables,
aucune migration conflictuelle. Mais : 2 docs contrat absents, 5/7 modèles
manquants, arbitrage Lead/Member, AcquisitionSession/ProfilingDraft,
LeadSource/Member.source, Conversion/transaction-invite,
AcquisitionEvent/AnalyticsEvent non écrit, contradiction scoring non résolue,
preuves absentes. Prête à spécifier, pas à exécuter.

## 8. #127 — verdict : PARALLEL SAFE

Purement présentationnelle (tokens dark/lime/shadcn déjà live — consolidation,
pas création). Zéro dépendance à #210 (contrat provisoire `purpose`/`choice`
suffit). Frictions bornées : `messages/fr.json` (1 section ajoutée, en fin de
fichier) et `reboot/profiling/*` + `admin/**` (interdits).

## 9. Plan réel (démarre après levée des bloqueurs)

- DAY 1 : trancher C1 (arbitrage 5 modèles) + CLOSE #205 et supprimer les
  2 branches (console GitHub). 0 agent code.
- DAY 2 : 1 lane rédaction (2 docs contrat) → revue. 0 agent code.
- PHASE 1 (2 agents max) : A = #210 phase 2 (prisma/migrations,
  `src/lib/acquisition/*`, API, tests) ; B = #127 (globals.css,
  `components/ui` en ajout, doc design-system, QA). Files disjoints, review
  croisée obligatoire sur `messages/fr.json`.
- PHASE 2 : extraction #204 (post-C1), puis #211/#212.

## 10. File ownership

| Fichier | Owner | Secondary | Conflit |
|---|---|---|---|
| `prisma/schema.prisma` + migrations | A (#210) | toi | HIGH — B interdit |
| `src/lib/acquisition/*`, `src/app/api/*` (nouvelles) | A | reviewer B | LOW |
| `globals.css`, `components/ui` (ajouts) | B (#127) | reviewer A | MED si variants modifiés → snapshot visuel exigé |
| `messages/fr.json` | A et B (sections disjointes) | revue croisée | HIGH — 1 section chacun, jamais de réécriture |
| `reboot/profiling/*`, `admin/**`, `lib/orientation/*` | personne (gelé) | — | BLOCKING si touché → STOP |
| `docs/*`, `.github/*` | lane docs / toi | — | LOW |

## 11. Contrat d'exécution et stop conditions

Par issue : code + tests + typecheck + lint + build + security review +
architecture review + boundary review + doc + commit atomique. Interdits :
suppression de test, `any` de contournement, test désactivé, migration manuelle
prod, élargissement silencieux du scope.

STOP → REPORT → WAIT si : ambiguïté d'architecture, migration conflictuelle,
criteria contradictoires, scope contradictoire, sécurité non résolue, fichier
critique déjà modifié, test existant contredit la spec, dépendance externe
imprévue. Ne jamais improviser.

## 12. #210 phase 2 (borné)

5 modèles + migration reproductible, validation Zod serveur, services
(idempotence : clés uniques + anti-doublon sur le pattern MemberEmailLog), API
publiques/admin avec rate-limit, tests CRUD/relations + test de non-dépendance
JoinHashCode, analytics via AnalyticsEvent existant, consentement via Consent
existant. Bornes : pas de nouveau CORE, pas de nouveau moteur d'orientation,
pas d'implémentation JoinHashCode.

## 13. Score final

Architecture 6, Code 7, Database 6, API 7, Tests 7, Security 8, CI/CD 7,
Documentation 4, Backlog 6, PR Hygiene 4, Execution Readiness 5.
TOTAL : 67/110 → 61/100.

## 14. GO / NO-GO

- AUDIT COMPLETE: YES
- BASELINE: main @0b2f106, development gelée
- C1: REQUIRED (arbitrage 5 modèles + contradiction scoring)
- C2: REQUIRED (gel formel de development)
- C3: RESOLVED / NON-BLOCKING
- C4: REQUIRED (canon provisoire v1, archivage avant #211)
- C5: REQUIRED (2 docs contrat)
- #210: NOT READY (spécifiable, pas exécutable)
- #127: PARALLEL SAFE (bornée, après C1)
- MAX INITIAL AGENTS: 2 (après levée)
- GO FOR CODING: NO

## 15. Bloqueurs et suite

1. Arbitrage écrit C1 (créer vs réutiliser, redéfinition du « pas de scoring »).
2. 2 docs contrat (boundary + execution-order).
3. CLOSE #205 + supprimer 2 branches + geler development.

AFTER RESOLUTION — PHASE 1 : Agent A = #210 phase 2 (modèles, migration, API,
tests, doc invariants) ; Agent B = #127 (tokens, variants en ajout,
`docs/design-system-reboot.md`, QA responsive). Reviewers croisés, checkpoint
au premier commit de chacun, succès = typecheck+lint+tests verts + 0 fichier
gelé touché + boundary review passée.

Résultat binaire : NOT READY TO EXECUTE. Le chemin vers GO tient en
~1 journée (3 décisions + 2 docs) : le socle est sain, c'est l'arbitrage qui
manque, pas le code.
