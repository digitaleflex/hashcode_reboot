# HashCode Reboot / JoinHashCode Boundary

Contrat de frontière architecturelle. Statut : canonique (Phase 0, C1 résolu).
Sans ce document, aucune issue M1+ ne démarre.

## Purpose

Fixer par écrit quelles données appartiennent à l'acquisition (Reboot) et
quelles données appartiennent au profilage / orientation / parcours
(JoinHashCode et socle existant), afin d'interdire toute duplication.

Règle de lecture : LE CODE ACTUEL DE MAIN PRIME sur les descriptions
historiques du backlog. EXISTANT > DUPLICATION > REWRITE.

## Reboot Responsibility

Reboot est la couche d'acquisition et d'entrée de l'écosystème HashCode.
Elle transforme un visiteur en prospect qualifié, recueille les informations
nécessaires à sa compréhension initiale, mesure son intention et son contexte,
puis l'oriente vers JoinHashCode lorsque celui-ci est prêt à poursuivre.

Responsabilités : acquisition, capture, consentement, qualification initiale,
compréhension initiale du visiteur, segmentation d'acquisition, qualification
du lead, attribution, analytics acquisition, conversion, transmission
(handoff) vers l'écosystème.

## JoinHashCode Responsibility

Parcours pédagogique, orientation métier complète, progression, mentorat,
validation des compétences. Ces fonctions appartiennent à JoinHashCode et ne
sont jamais réimplémentées dans Reboot.

## Data Boundary

| Concept | Côté | Support main |
|---|---|---|
| Prospect avant inscription | Acquisition | `Member` (Lead = vue : Member non converti) |
| Session d'acquisition | Acquisition | `ProfilingDraft.sessionId` + `AnalyticsEvent.sessionId` |
| Source du lead | Acquisition | `Member.source` + `normalizeSource` (`src/lib/acquisition.ts`) |
| Qualification d'entrée (snapshot figé) | Acquisition | `Qualification` (append-only, jamais recalculé) |
| Consentement | Acquisition | `Consent` (pré-inscription capable, append-only) |
| Conversion (passage d'état) | Acquisition | `communityStatus`/`invitationStatus` + timestamps + `AnalyticsEvent` |
| Événements d'acquisition | Acquisition | `AnalyticsEvent` (types étendus via allowlist) |
| Orientation dynamique, scoring vivant | Socle existant | `src/lib/orientation/*` (volatile, jamais dupliqué) |
| Parcours, progression, mentorat | JoinHashCode | Hors Reboot |

## AcquisitionContext

Pas de modèle `AcquisitionContext`. Le contexte d'acquisition = triptyque
existant : clés navigateur (`hashcode:reboot:session`, `hashcode:reboot:source`)
+ `ProfilingDraft` (réponses, `sourceUTM`, `sessionId`) + `Member.source`.
Interdiction de créer un contexte parallèle.

## Handoff

Le handoff est un contrat, pas une implémentation JoinHashCode : statuts
(`communityStatus`, `invitationStatus`), timestamps (`invitedAt`, `joinedAt`,
`acceptedAt`), événements (`admin_invite`, `whatsapp_join_clicked`),
lien d'invitation unitaire. Reboot ne gère ni ne rejoue le parcours cible.

## Forbidden Duplication

Interdits : second engine d'orientation, de profil, de recommandation,
d'archétype, second CORE, second système de scoring, seconde table
d'historique concurrente de `Qualification`, second système de consentement,
second système analytics, table `Lead`/`LeadSource`/`AcquisitionSession`/
`Conversion`/`AcquisitionEvent` tant qu'aucune preuve documentée ne montre
que le support existant est insuffisant. Ne jamais copier un score existant
dans un nouveau champ pour satisfaire une issue.

Quatre scores distincts, jamais mélangés : Qualification Score (« prospect
suffisamment qualifié pour une prochaine étape ? »), Profil (« qui est
cette personne ? »), Orientation (« quelle direction lui correspond ? »),
Confidence (« à quel point sommes-nous certains ? »). Le snapshot
`Qualification` est une copie d'entrée assumée et figée, pas une
duplication : il n'est jamais recalculé ni réécrit.

## Non-Goals

Pas de scoring d'orientation nouveau, pas de CORE, pas de matching membre,
pas de parcours pédagogique, pas d'IA/ML/LLM/embeddings, pas de moteur
de mentorat, pas de learning path.

## Architectural Rules

1. EXISTING CONTRACT > NEW ABSTRACTION. 2. REUSE > DUPLICATE.
3. MINIMAL CHANGE > REWRITE. 4. EXPLICIT DECISION > GUESS.
5. Un seul agent modifie un fichier critique à la fois.
6. Toute écriture publique est validée côté serveur (Zod), rate-limitée,
   auditée (best-effort, jamais bloquant).
7. Migrations : manuscrites, additives, reproductibles, avec rollback
   commenté ; jamais de migration manuelle en production.
8. Tests : `node --test` miroirs `.cjs` inscrits dans `test:unit`/`test:all` ;
   aucune suppression de test, aucun `any` de contournement, aucun test
   désactivé.

## Decision Log

- C1 (Phase 0) : arbitrage des 7 modèles — REUSE partout sauf `Qualification`
  et `Consent` déjà existants et conservés tels quels ; aucune table créée.
  Détails : `docs/roadmap/reboot-execution-order-v2.md` (Phase 0) et rapport
  PHASE 0 — RESOLUTION REPORT (chat).
- Alignement des deux nomenclatures d'archétypes (`profileArchetype`
  déterministe vs `Qualification.archetype` orientation) : DEFERRED, lecture
  seule côté acquisition en attendant ; aucun nouvel engine.
- Attribution via jointure `sessionId`/`memberId` (pas de `sourceUTM` sur
  l'événement) : à réévaluer sur preuve de douleur requête, pas avant.
