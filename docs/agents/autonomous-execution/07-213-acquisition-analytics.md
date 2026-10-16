# #213 — Acquisition Analytics

## Préconditions

#212 validée.

## Objectif

Rendre le funnel d'acquisition mesurable de bout en bout.

## Travail

1. Réutiliser AnalyticsEvent.
2. Normaliser les événements nécessaires.
3. Vérifier allowlist et écritures serveur.
4. Relier session, member et conversion sans nouvelle base analytics.
5. Définir funnel et métriques.
6. Éviter les PII inutiles.
7. Ajouter tests de collecte et agrégation.
8. Vérifier attribution et limites de la jointure actuelle.
9. Documenter les événements canoniques.

## Risque connu

L'attribution sans source UTM portée directement par l'événement doit rester une question empirique. Ne pas ajouter sourceUTM uniquement par anticipation.

## Done

Le funnel est observable, cohérent, testable et exploitable sans deuxième système analytics.
