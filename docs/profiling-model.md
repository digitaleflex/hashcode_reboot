# Modèle de progression membre — Reboot V1 (#147, #155)

Référence d'implémentation : `src/lib/profiling/dynamicProfile.ts` (règles),
`src/lib/profiling/layers.ts` (types + version), `src/lib/orientation/resolve.ts`
(point d'entrée de la boucle complète). En cas de divergence entre ce document
et le code, le code prime (frontière C1 :
`docs/architecture/reboot-joinhashcode-boundary.md`).

## Unités et états

| Couche | Contenu | Calcul | Persistance |
|---|---|---|---|
| DECLARED | `ProfileAnswers` (questionnaire) | Saisie membre | Colonnes `Member` |
| INFERRED | Scores Builder/Strategist/Creator/Catalyst + confiance | `orientationEngine.evaluate()` (pur, déterministe) | Non persisté, recalculé |
| OBSERVED | Compteurs d'activité (ateliers, events, mentorat, recos) | `toObservedSignals` + `loadObservedSignals` (lecture seule) | Non persisté, recalculé |
| DYNAMIQUE | Fusion + `effectiveLevel` + `observedConfidence` (paliers 0/0.5/1) | `buildLayeredProfile` (pur) | Non persisté, recalculé |
| HISTORIQUE | Une `Qualification` par évaluation significative | Écriture à l'inscription (append-only) | Table `Qualification` |

Pas de table d'historique dédiée au moteur d'orientation : l'historique
d'acquisition, c'est `Qualification` (append-only, une ligne par évaluation
significative avec `engineVersion` + `scores` + `confidence` + `reasons`,
jamais recalculée ni réécrite — arbitrage C1). Le profil dynamique
(INFERRED/OBSERVED/DYNAMIQUE) est volatil et recalculé à chaque affichage.

## Règles d'attribution et de validation

Ces règles sont implémentées dans `buildLayeredProfile`
(`src/lib/profiling/dynamicProfile.ts`) :

- Le niveau ne diminue **jamais** (l'observé ne punit pas) : `effectiveLevel`
  part du niveau déclaré et ne peut qu'augmenter d'un cran.
- Upgrade suggéré d'**un seul cran** si `workshopsCompleted >= 2`
  (beginner → practicing → autonomous → advanced, plafond `advanced`).
- Shift d'affinité de domaine si `eventsJoined + workshopsStarted >= 3`
  ET que `observedDominantDomain` (domaine dominant observé) diffère de
  `primaryDomain` déclaré.
- Mentorat observé (`mentoringRequested`) face à `mentoringInterest: "no"`
  déclaré : signalé via l'explication `mentoring:observed-overrides-declared`
  — sans jamais bloquer l'inverse ni modifier les recommandations.
- Chaque règle est un seuil documenté, pas une pondération opaque.
- `observedConfidence` : paliers discrets 0 (aucun signal) / 0.5 (< 3 signaux)
  / 1 (≥ 3 signaux) ; `isObservedEmpty` définit l'absence de signal.

## Lien activité → compétence → progression → recommandation

```
WorkshopEnrollment / Submission APPROVED / Quiz passed / EventRsvp going /
Mentorship / invitationClicks
  → ObservedSignals (toObservedSignals)
  → DynamicProfile (buildLayeredProfile : effectiveLevel)
  → resolveOrientation (ré-évalue au niveau effectif si upgrade)
  → recommendations + nextBestAction
```

Pas d'écriture d'historique dans cette boucle : les vues dashboard et
`GET /api/account/orientation` sont en lecture seule (recalcul pur).
La seule persistance d'évaluation reste la ligne `Qualification` écrite
à l'inscription.

## Persistance et reprise multi-appareils

- Aucun état de progression en localStorage : tout est serveur (DB lue à
  chaque affichage, recalcul pur). Seules les clés navigateur d'acquisition
  (`hashcode:reboot:session`, `hashcode:reboot:source`) y résident — elles
  portent la session et la source, pas la progression.
- `Qualification` : historique d'entrée append-only (jamais UPDATE/DELETE
  sur les lignes existantes), index `(memberId, createdAt)`. Traçabilité
  via `engineVersion` (+ `scores`, `confidence`, `reasons` en JSON).
- Corrections/revalidations : nouvelle évaluation → nouvelle ligne
  `Qualification` ; l'historique conserve les évaluations passées
  (pas de réécriture).

## Analytics associés

- `profil_generated` (inscription, émis par `POST /api/members`).
- Événements profiling existants (`profiling_*`, `orientation_evaluated`,
  `next_best_action_clicked`, `recommendation_*`) + `event_rsvp` /
  `event_interest` existants.
- Non-live (signalé, pas implémenté) : aucun événement `orientation_scored`
  n'est émis — `GET /api/account/orientation` ne trace pas ses re-scores.
  L'ajouter supposerait d'étendre l'allowlist `EVENT_TYPES`
  (`src/lib/analytics.ts`) ; en attendant, les re-scores restent invisibles
  en analytics.

## Cohérence Prisma

- Aucune FK Prisma sur `Qualification.memberId` (simple colonne + index
  `(memberId, createdAt)`, pas de relation) : pas de cascade, pas de
  jointure fragile.
- Zéro table ajoutée par le moteur M1–M5 + finalisation : couches
  INFERRED/OBSERVED/DYNAMIQUE non persistées, historique porté par la
  `Qualification` existante.
