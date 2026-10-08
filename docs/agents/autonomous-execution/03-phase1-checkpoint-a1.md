# Phase 1 — Checkpoint A1

## Déclenchement

À exécuter lorsque Agent A #210 et Agent B #127 ont produit leur premier état substantiel, avant de les laisser poursuivre aveuglément.

## Vérifications

### Agent A
- respect exact de C1 ;
- aucun nouveau modèle injustifié ;
- aucune duplication ;
- ownership respecté ;
- APIs validées ;
- auth/CSRF/rate-limit ;
- idempotence ;
- tests ;
- migrations sûres ;
- aucune zone gelée touchée.

### Agent B
- uniquement UI/design system ;
- aucun fichier métier interdit ;
- aucune modification de `messages/fr.json` prématurée ;
- accessibilité/responsive ;
- aucune régression.

### Global
- git diff lisible ;
- changements proportionnés ;
- pas de scope creep ;
- pas de secret ;
- pas de test contourné ;
- pas de dépendance cachée.

## Décision

- PASS : poursuivre.
- BLOCKED : arrêter l'agent concerné et corriger avant poursuite.
- SCOPE EXPANSION : ne pas corriger silencieusement ; documenter et demander arbitrage.

## Sortie

Produire un checkpoint avec : fichiers touchés, décisions, risques, tests, statut et prochaine action.
