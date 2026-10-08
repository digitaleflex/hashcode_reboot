# Reboot — Issue Resolution Contract

## Purpose

Ce document est le contrat d'exécution commun à tous les agents travaillant sur les issues du dépôt `digitaleflex/hashcode_reboot`.

Il complète les issues GitHub. Une issue décrit **quoi faire** ; ce document impose **comment travailler sans dériver du périmètre**.

## 1. Source de vérité

Ordre de lecture obligatoire avant modification :

1. `docs/architecture/reboot-joinhashcode-boundary.md`
2. `docs/roadmap/reboot-roadmap-v2.md`
3. `docs/roadmap/reboot-execution-order-v2.md`
4. l'issue GitHub ciblée
5. les fichiers réellement concernés dans le dépôt
6. les tests existants
7. seulement ensuite le code

Branche de travail : `development`.

Ne jamais utiliser `main` comme baseline fonctionnelle de Reboot.

## 2. Frontière produit non négociable

### Reboot

Reboot est la couche :

- acquisition ;
- capture ;
- diagnostic initial ;
- consentement ;
- qualification d'acquisition ;
- attribution source/campagne ;
- conversion ;
- handoff ;
- analytics acquisition ;
- opérations sur les leads.

### JoinHashCode

JoinHashCode est propriétaire de :

- profil membre complet ;
- psychométrie ;
- spécialisation ;
- orientation ;
- CORE ;
- next best action ;
- parcours ;
- apprentissage ;
- pratique ;
- validation ;
- Evidence ;
- progression ;
- mentoring ;
- opportunités ;
- communauté membre.

**Règle absolue : si une implémentation Reboot commence à décider quel parcours, quelle spécialisation, quel mentor ou quelle prochaine activité un membre doit recevoir, elle dérive vers JoinHashCode et doit être arrêtée.**

## 3. Qualification ≠ profil ≠ orientation

Reboot peut calculer :

`Acquisition Qualification Score`

Ce score mesure la qualité/préparation/intention du lead pour l'acquisition.

Il ne doit pas devenir :

- score psychométrique ;
- archetype ;
- score de compétence ;
- orientation métier ;
- recommandation de parcours ;
- CORE ;
- matching membre.

Même entrée + même version de règles = même résultat.

## 4. Chaque issue doit produire cinq preuves

Avant de fermer une issue, l'agent doit pouvoir montrer :

### A. Preuve de code

Quels fichiers ont changé et pourquoi.

### B. Preuve fonctionnelle

Quel comportement nouveau ou corrigé est observable.

### C. Preuve de test

Quel test démontre le comportement.

### D. Preuve de frontière

Pourquoi la modification reste dans Reboot et ne déplace pas une responsabilité JoinHashCode.

### E. Preuve de non-régression

Build/typecheck/lint/tests concernés et résultat.

Une issue ne doit pas être considérée terminée parce que « le code compile ».

## 5. Discipline fichiers

Pour chaque fichier touché :

- identifier son rôle actuel avant modification ;
- éviter de déplacer une responsabilité sans justification ;
- préférer une extension locale à une nouvelle abstraction ;
- supprimer les anciennes branches mortes si la migration les rend obsolètes ;
- mettre à jour les tests associés ;
- documenter une migration si le schéma ou contrat change.

Ne jamais inventer un chemin de fichier. Si le fichier attendu par une issue n'existe pas, rechercher d'abord la responsabilité équivalente.

## 6. Discipline base de données

Pour toute modification Prisma :

1. modifier `prisma/schema.prisma` ;
2. générer une migration ;
3. vérifier la migration ;
4. préserver les données existantes ;
5. vérifier index/unique/relations ;
6. tester migration et rollback/procédure de récupération selon le contexte.

Ne pas stocker dans Reboot des données uniquement utiles au parcours pédagogique JoinHashCode.

## 7. Discipline API

Chaque endpoint doit avoir :

- validation serveur ;
- autorisation adaptée ;
- gestion explicite des erreurs ;
- idempotence lorsque l'opération peut être rejouée ;
- rate limit si public/sensible ;
- audit si mutation admin ;
- événements analytics si l'action appartient au funnel ;
- tests.

L'UI ne constitue jamais la sécurité.

## 8. Machine d'état

Source de vérité :

VISITOR
→ SESSION_STARTED
→ DIAGNOSTIC
→ LEAD_CAPTURED
→ QUALIFICATION
→ CONVERSION
→ HANDOFF

Les variantes QUALIFIED / DISQUALIFIED / INSUFFICIENT_DATA appartiennent à la qualification ; HANDOFF_FAILED appartient au résultat d'intégration.

Ne jamais introduire dans Reboot :

- MEMBER_ACTIVE ;
- LEARNING ;
- CHALLENGE ;
- PROJECT ;
- MENTORING ;
- COMMUNITY_ACTIVE ;
- EVIDENCE ;
- PROGRESS.

## 9. Handoff

Le contrat Reboot → JoinHashCode est `AcquisitionContext`, versionné et minimal.

Il contient seulement les informations d'acquisition nécessaires :

- source/campagne ;
- intention ;
- intérêts déclarés ;
- objectif déclaré ;
- niveau/contexte déclaré ;
- disponibilité si justifiée ;
- qualification + raisons ;
- consentement ;
- métadonnées de conversion.

Reboot ne connaît pas et ne doit pas importer les tables internes JoinHashCode.

L'intégration correspondante est JoinHashCode #394.

## 10. Ordre d'exécution

Ordre principal :

`210 → 158 → 153/145/117/118 → 211 → 103 → 124 → 212 + JoinHashCode #394 → 213/156/106/105/104/101 → 214 → 112/113/122/159 → 215`

Les issues UX 127–141 peuvent être travaillées dans leur track, mais elles ne doivent pas remplacer la stabilisation du socle métier.

## 11. Ce qu'un agent ne doit pas faire

- Réécrire tout le projet pour une issue locale.
- Créer un second CORE.
- Créer une seconde architecture d'orientation.
- Introduire une IA/LLM sans issue explicitement autorisée.
- Ajouter du matching membre dans Reboot.
- Ajouter une nouvelle couche d'abstraction « au cas où ».
- Modifier des fichiers hors périmètre sans justification.
- Fermer une issue sans tests/preuves.
- Déclarer une fonctionnalité comme disponible si elle n'est pas livrée.
- Copier le schéma JoinHashCode dans Reboot.
- Utiliser des données réelles dans les tests.
- Contourner auth, consentement ou audit pour aller plus vite.

## 12. Format recommandé pour un PR

### Résumé
Ce qui a été fait.

### Fichiers
Liste exacte des fichiers modifiés et responsabilité de chacun.

### Décisions
Choix techniques et raisons.

### Tests
Commandes exécutées + résultat.

### Preuves
Screenshots/logs/fixtures/contrats si pertinents.

### Frontière
Pourquoi la modification reste dans le périmètre de l'issue.

### Hors périmètre
Ce qui a volontairement été laissé à une autre issue.

## 13. Critère de fermeture

Une issue peut être fermée uniquement si :

- les critères de l'issue sont satisfaits ;
- les fichiers concernés sont identifiés ;
- les tests passent ;
- les changements sont cohérents avec l'architecture ;
- aucune responsabilité d'une autre issue n'a été absorbée silencieusement ;
- les preuves sont disponibles ;
- le résultat peut être repris par un autre agent sans connaissance implicite.

## 14. Principe directeur

**Une issue = une responsabilité clairement délimitée.**

Le but n'est pas de maximiser le nombre de fichiers modifiés.

Le but est de produire une modification minimale, vérifiable, réversible et cohérente avec l'architecture globale de HashCode Reboot.
