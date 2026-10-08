# Agent A — #210 Acquisition Foundation V1

## Mission

Implémenter l'issue #210 sur la baseline `main`, en appliquant strictement l'arbitrage C1 de Phase 0.

## Préconditions

- Phase 0 validée.
- `main` est la baseline.
- `development` est gelée.
- #205 est fermée.
- Les deux documents de gouvernance existent.
- C1 est contractuel.

## Règle d'architecture

Réutiliser avant de créer.

Ne créer aucune nouvelle table parmi Lead, AcquisitionSession, LeadSource, Conversion ou AcquisitionEvent sans preuve technique documentée que l'existant ne couvre pas la responsabilité.

Décisions C1 :
- Lead = vue acquisition de Member.
- AcquisitionSession = sessionIds existants.
- LeadSource = Member.source.
- Qualification = modèle existant, snapshot figé et versionné.
- Consent = modèle existant.
- Conversion = statuts/timestamps/events existants.
- AcquisitionEvent = AnalyticsEvent existant.

## Travail

1. Lire #210, les deux docs de gouvernance et les conventions existantes.
2. Inspecter uniquement les fichiers nécessaires dans Reboot.
3. Formaliser les contrats d'acquisition.
4. Ajouter/compléter les services dans `src/lib/acquisition/*`.
5. Ajouter les validations Zod côté serveur.
6. Garantir auth, CSRF lorsque pertinent, rate-limit et audit.
7. Garantir l'idempotence des opérations.
8. Réutiliser Consent, Qualification et AnalyticsEvent.
9. Étendre l'allowlist analytics uniquement si nécessaire.
10. Ajouter les API strictement nécessaires.
11. Ajouter les tests unitaires/intégration.
12. Vérifier GDPR/minimisation des données.
13. Vérifier l'absence de dépendance à JoinHashCode.
14. Exécuter tests, typecheck, lint et build.
15. Documenter toute décision non triviale.
16. Commit atomique et PR.

## Interdictions

Pas de nouveau CORE, moteur d'orientation, moteur de profiling, ML, LLM, embeddings, matching complexe, table miroir, bypass sécurité, test désactivé ou `any`.

## STOP

Arrêter si une nouvelle table semble nécessaire, si C1 devient insuffisant, si une zone gelée doit être touchée ou si une migration destructive est proposée. Produire un rapport BLOCKER au lieu de deviner.

## Done

#210 est terminé seulement si comportement, tests, sécurité, architecture, boundary et build sont verts.
