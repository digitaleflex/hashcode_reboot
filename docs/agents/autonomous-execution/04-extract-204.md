# Extraction contrôlée — PR #204

## Précondition

#210 et #127 terminées et validées. C1 reste contractuel.

## Objectif

Extraire uniquement la valeur utile de #204. Ne jamais fusionner #204 en bloc.

## EXTRACT

- `docs/profiling-model.md` adapté au modèle Qualification actuel.
- `resolve.ts`.
- tests associés à resolve.
- script package.json strictement nécessaire.
- hunk route resolve / OrientationSection si compatible avec main et sans nouvelle responsabilité.

## DISCARD

- reformatage/whitespace.
- ProfileSnapshot.
- migration `20261008000000`.
- `snapshots.ts` / recordSnapshot.
- signup hunk superseded.

## Règles

Le code extrait doit être rebasé conceptuellement sur main, testé et réécrit si nécessaire. Aucun ancien contrat ne doit réintroduire ProfileSnapshot ou un second système de snapshot.

## Validation

Tests ciblés → tests globaux → typecheck → lint → build → revue diff → boundary check.

Puis fermer #204 si son contenu utile a été extrait et validé.
