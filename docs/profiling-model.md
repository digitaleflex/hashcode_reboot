# Modèle de progression membre — Reboot V1 (#147, #155)

## Unités et états

| Couche | Contenu | Calcul | Persistance |
|---|---|---|---|
| DECLARED | `ProfileAnswers` (questionnaire) | Saisie membre | Colonnes `Member` |
| INFERRED | Scores Builder/Strategist/Creator/Catalyst + confiance | `orientationEngine.evaluate()` (pur, déterministe) | Non persisté, recalculé |
| OBSERVED | Compteurs d'activité (ateliers, events, mentorat, recos) | `toObservedSignals` + `loadObservedSignals` (lecture seule) | Non persisté, recalculé |
| DYNAMIQUE | Fusion + `effectiveLevel` + `observedConfidence` (paliers 0/0.5/1) | `buildLayeredProfile` (pur) | Non persisté, recalculé |
| HISTORIQUE | Un `ProfileSnapshot` par évaluation significative | `recordSnapshot` (append-only) | Table `ProfileSnapshot` |

## Règles d'attribution et de validation

- Le niveau ne diminue **jamais** (l'observé ne punit pas).
- Upgrade suggéré d'**un seul cran** si `workshopsCompleted >= 2`
  (beginner → practicing → autonomous → advanced, plafond `advanced`).
- Shift de domaine uniquement si ≥ 3 activités hors `primaryDomain`.
- Mentorat observé (`mentoringRequested`) prime sur `mentoringInterest: "no"`
  déclaré — sans jamais bloquer l'inverse.
- Chaque règle est un seuil documenté, pas une pondération opaque.

## Lien activité → compétence → progression → recommandation

```
WorkshopEnrollment / Submission APPROVED / Quiz passed / EventRsvp going /
Mentorship / invitationClicks
  → ObservedSignals (toObservedSignals)
  → DynamicProfile (buildLayeredProfile : effectiveLevel)
  → resolveOrientation (ré-évalue au niveau effectif si upgrade)
  → recommendations + nextBestAction
  → ProfileSnapshot (historique) + orientation_scored (analytics)
```

## Persistance et reprise multi-appareils

- Aucun état de progression en localStorage : tout est serveur (DB lue à
  chaque affichage, recalcul pur).
- `ProfileSnapshot` : historique append-only (jamais UPDATE/DELETE),
  index `(memberId, createdAt)`. Traçabilité via `engineVersion` +
  `dynamicVersion`.
- Corrections/revalidations : nouvel événement observé → nouveau snapshot ;
  l'historique conserve les évaluations passées (pas de réécriture).

## Analytics associés

- `profil_generated` (inscription), `orientation_scored`
  (`engineVersion:status`, à chaque snapshot), événements profiling et
  `event_rsvp` / `event_interest` existants.
- Les vues dashboard n'écrivent PAS d'historique (lecture seule) ;
  l'historique est écrit à l'inscription et aux re-scores explicites
  (`GET /api/account/orientation`).

## Cohérence Prisma

- Aucune FK fragile : `ProfileSnapshot.memberId → Member(id)` en
  `onDelete: Cascade`.
- Aucune migration destructive liée au moteur M1–M5 + finalisation :
  une seule table ajoutée (`ProfileSnapshot`), zéro colonne modifiée.
