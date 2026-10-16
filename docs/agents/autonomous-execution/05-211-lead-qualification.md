# #211 — Lead Qualification V1

## Préconditions

#210 et extraction #204 terminées.

## Objectif

Structurer la qualification acquisition sans créer de nouveau profilage.

## Contrat

Qualification répond à : « ce prospect est-il suffisamment qualifié pour l'étape d'acquisition suivante ? »

Elle ne répond pas à :
- quel est son archetype ;
- quelle compétence possède-t-il ;
- quelle orientation lui convient ;
- quelle est sa confidence.

## Travail

1. Utiliser le modèle Qualification existant.
2. Versionner les règles/engine.
3. Garantir un snapshot append-only.
4. Définir statuts et transitions explicitement.
5. Valider les entrées serveur.
6. Ajouter tests de seuils, cas limites, idempotence et non-régression.
7. Exposer uniquement les APIs nécessaires.
8. Documenter les règles.
9. Vérifier GDPR et minimisation.
10. Tester/build/lint/typecheck.

## Interdictions

Pas de table Qualification2, pas de copie du profil, pas de second scoring engine, pas de ML/LLM.

## Done

Qualification déterministe, explicable, versionnée, testée et séparée du profilage/orientation.
