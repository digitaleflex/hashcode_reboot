# Agent Execution Prompt — HashCode Reboot

Tu travailles sur `digitaleflex/hashcode_reboot`.

## Référence absolue

- Branche de travail: `development`
- Ne prends pas `main` comme baseline.
- Vision produit: Reboot est le point d'entrée gratuit de HashCode qui collecte, comprend, identifie et oriente les membres.
- Boucle cible: COLLECT → UNDERSTAND → IDENTIFY → ORIENT → ACTIVATE → OBSERVE → RE-SCORE.
- Question centrale: « Quelle est la meilleure prochaine action pour cette personne dans HashCode ? »

## Mission immédiate

Ne code pas immédiatement le Super Algorithm.

1. Inspecte le repository et l'état réel de `development`.
2. Lis `docs/roadmap/reboot-roadmap-v1.md`.
3. Audite toutes les issues ouvertes.
4. Pour chaque issue, décide: KEEP / REWRITE / MERGE / MOVE / CLOSE / NEW.
5. Ne ferme aucune issue sur une simple intuition: vérifie son contenu et, si nécessaire, le code concerné.
6. Regroupe le backlog selon les milestones M0 à M6 et les domaines:
   - foundation
   - profiling
   - orientation
   - matching
   - recommendation
   - behaviour
   - community
   - analytics
   - security
   - admin
7. Ferme uniquement les éléments définitivement obsolètes ou explicitement hors périmètre, avec un commentaire indiquant le remplacement ou la raison.
8. Fusionne les doublons lorsque possible; sinon documente la relation.
9. Réécris les issues qui restent pertinentes mais correspondent à l'ancienne vision.
10. Crée les issues manquantes pour l'Orientation Engine V1.

## Ordre obligatoire

M0 → M1 → M2 → M3 → M4 → M5 → M6.

Ne commence pas M3 avant que les décisions de M0 et les fondations de M1/M2 soient suffisamment spécifiées.

## Architecture cible

`src/lib/orientation/` doit rester indépendant de React et contenir progressivement:
- types.ts
- features.ts
- scoring.ts
- matching.ts
- recommendations.ts
- engine.ts

N'ajoute confidence.ts, normalization.ts ou feedback.ts que lorsque le besoin est justifié par le design réel.

## Règles métier

- Access control et orientation confidence sont deux concepts différents.
- Score et confidence sont deux concepts différents.
- Le moteur V1 doit être déterministe, explicable, testable, versionnable et reproductible.
- Pas de LLM, ML ou embeddings comme moteur de décision principal en V1.
- Une absence de match est un résultat valide.
- Une donnée insuffisante est un résultat valide.
- Toute recommandation importante doit avoir une justification exploitable.
- Le profil doit distinguer déclaré, inféré et observé.
- Ne transforme pas Reboot en école, réseau social, marketplace ou plateforme de paiement.

## Avant chaque modification

- Vérifie l'état réel du code.
- Vérifie les dépendances.
- Vérifie les tests existants.
- Évite les refactors massifs non nécessaires.
- Préfère des changements petits, traçables et réversibles.

## Definition of Done

Une issue n'est terminée que si:
- critères d'acceptation remplis;
- tests pertinents ajoutés/mis à jour;
- typecheck/lint passent;
- aucune régression critique;
- documentation mise à jour si nécessaire;
- le changement est cohérent avec la roadmap.

## Mode d'exécution

Travaille de façon autonome mais contrôlée:
1. Inspecter
2. Diagnostiquer
3. Planifier
4. Modifier
5. Tester
6. Vérifier
7. Résumer

Ne demande pas confirmation pour chaque micro-décision. Demande uniquement lorsqu'une décision produit irréversible ou une ambiguïté bloquante ne peut pas être résolue à partir du repository et de la roadmap.
