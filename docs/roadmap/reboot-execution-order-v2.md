# Reboot Execution Order V2

Ordre d'exécution canonique. Référence : `main`. Document frère :
`docs/architecture/reboot-joinhashcode-boundary.md` (frontière C1).

## Baseline

`main` est la baseline officielle et la seule source de vérité.
`development` est gelée : aucune fusion vers main, aucun reset de main,
aucune réactivation implicite, aucune récupération sauvage de commits.
Si development contient une correction utile, elle est identifiée, isolée,
comparée, puis réintroduite explicitement — jamais par fusion globale.
Roadmap canonique provisoire : `docs/roadmap/reboot-roadmap-v1.md`
(M0 backlog, M1 Foundation, M2 features, M3 classification). Les systèmes
M01-M09 et Operating Model sont historiques / à archiver avant #211.

## Phase 0

Gouvernance + arbitrage + préparation (aucun code fonctionnel) :

1. C1 résolu par écrit (arbitrage des 7 modèles : REUSE partout ;
   `Qualification` et `Consent` conservés tels quels ; aucune table créée ;
   4 scores distincts ; snapshot d'entrée figé, jamais recalculé).
2. Baseline déclarée (main), development gelée.
3. PR #205 fermée sans perte (5 fichiers déjà dans main à l'identique
   ou en superset — vérifié pièce par pièce).
4. PR #204 découpée : EXTRACT = `docs/profiling-model.md` (adapté),
   `resolve.ts`, tests (adaptés au seul resolve), script `package.json`,
   partie resolve de la route orientation, `OrientationSection` ;
   DISCARD = hunk signup (SUPERSEDED par Qualification), whitespace,
   modèle `ProfileSnapshot` + migration `20261008000000` (antérieure au tip,
   sans rollback) + `snapshots.ts`/`recordSnapshot` + câblage snapshot
   (doublon conscient avec l'historique `Qualification`, tranché C1).
   Extraction interdite avant C1 — C1 étant résolu, elle peut être planifiée.
5. Les deux documents de gouvernance créés (ce fichier + boundary).
6. #210 requalifiée READY (périmètre borné § Phase 1), #127 READY (bornée).

## Phase 1

Deux agents maximum, en parallèle, fichiers disjoints :

- Agent A — #210 Acquisition Foundation (bornée) : contrats, validation Zod,
  idempotence, rate limiting, audit, consentement (existant), analytics
  (existants), tests CRUD/relations + test de non-dépendance JoinHashCode,
  doc modèle+invariants, RGPD. ZÉRO nouvelle table sans preuve documentée
  d'insuffisance du support existant. Interdit : globals.css, composants UI
  hors besoin strict, redesign global, tout moteur (orientation, scoring,
  CORE, matching, ML/LLM).
- Agent B — #127 Design System (bornée) : `globals.css`, `components/ui/*`
  en AJOUT (variantes existantes intouchées sans snapshot visuel),
  `docs/design-system-reboot.md` (ne pas réécrire l'archive
  `docs/interface-utilisateur.md`), inventaire tokens, états UI, QA
  responsive. Interdit : `prisma/**`, `src/app/api/**`,
  `src/lib/profiling/**`, `reboot/profiling/*`, `admin/**`,
  `lib/orientation/**`, acquisition. `messages/fr.json` : 1 section ajoutée
  en fin de fichier chacun, jamais de réécriture, et pas en parallèle
  avec Agent A pendant son premier checkpoint (étape i18n dédiée si besoin).

## Phase 2

Extraction #204 (morceaux EXTRACT ci-dessus, un commit par morceau),
puis #211, #212, #213, #214, #215 — sans détailler artificiellement
l'inédit : chaque issue est spécifiée à son tour, jamais avant.

## Issue Dependencies

#210 conditionne #158, #211, #212. #127 débloque partiellement #128-#140
(base anti-divergence ; tokens déjà live). #204 ne bloque ni #210 ni #127
(non-bloquant). Ordre :

Phase 0 → #210 + #127 (parallèle) → extraction #204 → #211 → #212 →
#213 → #214 → #215.

## Parallelization Rules

2 agents maximum en Phase 1. Jamais 7 agents = 7 tâches : chaque phase
nomme AGENTS, ISSUES, FILES, DEPENDENCIES, REVIEWERS, CONFLICTS.
Un seul agent possède une modification active d'un fichier critique.
Zones gelées (toute modification = STOP + CONFLICT/SCOPE EXPANSION REPORT) :
`reboot/profiling/*`, `admin/**`, `lib/orientation/*`.

## Definition of Done

Par issue : code + tests + typecheck + lint + build (si pertinent) +
security review + architecture review + boundary review + documentation +
commit atomique. Interdits : `any`, `@ts-ignore`, `@ts-expect-error`
injustifié, test supprimé/désactivé, suite skipped, migration manuelle prod,
secret hardcodé, bypass auth/CSRF, suppression de rate-limit, changement de
comportement pour faire passer un test.

## Stop Conditions

STOP → REPORT → WAIT FOR DECISION, sans improviser : architecture ambiguë,
migration conflictuelle, criteria contradictoires, scope contradictoire,
sécurité non résolue, fichier critique déjà modifié par un autre agent,
test existant contredit la spec, dépendance externe imprévue, duplication
détectée, besoin d'explorer JoinHashCode ou le serveur.

## Governance Rules

Un commit = un sujet ; ne jamais mélanger le WIP écrit en parallèle.
Aucune ambiguïté architecturale résolue silencieusement : DECISION,
EVIDENCE, ACTION, BLOCKER, STATUS — sinon UNKNOWN, voire AMBIGUITY
DETECTED avec ce qui bloque exactement. Pas d'overengineering : aucun
framework interne, event bus, CQRS, microservice, ML pipeline, broker,
repository inutile, scoring parallèle. Cible : VISITOR → ACQUISITION →
LEAD → QUALIFICATION → CONVERSION → HANDOFF → ECOSYSTEM, jamais un second
moteur de profil/orientation/CORE.
