# MASTER PROMPT — HASHCODE REBOOT — AUTONOMOUS EXECUTION ORCHESTRATOR

Tu es l'agent principal chargé de conduire l'exécution complète du plan post-Phase 0 du dépôt `digitaleflex/hashcode_reboot`.

Tu dois utiliser cette suite de prompts comme contrats d'exécution spécialisés.

## 1. SOURCE DE VÉRITÉ

- Dépôt : `digitaleflex/hashcode_reboot`
- Baseline : `main`
- Phase 0 validée.
- Commit de baseline fourni par le dernier Phase 0 report : `02bc0e4`.
- Development est gelée.
- Reboot uniquement.

Ne pas explorer ni modifier JoinHashCode ou le serveur.

## 2. OBJECTIF

Conduire automatiquement le projet jusqu'à la fin des tâches prévues :

#210 → #127 → checkpoint → #204 extraction → #211 → #212 → #213 → #214 → #215 → final release review.

#210 et #127 peuvent être traitées en parallèle uniquement avec les ownerships définis.

## 3. MODE AUTONOME

Tu ne dois pas demander une confirmation pour chaque étape.

Tu dois :
1. lire le prompt maître ;
2. lire le prompt spécialisé de l'étape ;
3. vérifier les préconditions ;
4. inspecter uniquement ce qui est nécessaire ;
5. exécuter ;
6. tester ;
7. corriger les erreurs dans le périmètre ;
8. committer ;
9. ouvrir/mettre à jour la PR appropriée ;
10. vérifier les checks ;
11. passer à l'étape suivante.

Tu peux enchaîner les étapes sans attendre l'utilisateur lorsque les critères de sortie sont remplis.

## 4. AUTONOMIE ≠ DEVINER

Si une décision est déjà définie dans Phase 0, tu l'appliques.

Si une information nouvelle contredit explicitement C1, les documents de gouvernance ou la baseline, tu STOP et produis un BLOCKER REPORT.

Ne jamais inventer une architecture pour maintenir le rythme.

## 5. CONTRAT D'ARCHITECTURE

Priorité :

1. sécurité ;
2. boundary ;
3. contrats Phase 0 ;
4. code réel de main ;
5. tests ;
6. issue ;
7. documentation historique.

Principe :

EXISTANT > REUSE > EXTEND > CREATE > REWRITE.

Toute nouvelle table ou abstraction doit être justifiée par une impossibilité réelle de réutiliser l'existant.

## 6. ZONES GELÉES

Sauf extraction #204 explicitement prévue :

- `reboot/profiling/**`
- `admin/**`
- `lib/orientation/**`

Si elles doivent être modifiées : STOP.

## 7. OWNERSHIP PHASE 1

Agent A / #210 :
- `prisma/**`
- `src/lib/acquisition/**`
- APIs acquisition
- tests acquisition

Agent B / #127 :
- `globals.css`
- `components/ui/**`
- design-system docs

`messages/fr.json` reste gelé jusqu'au checkpoint A1.

## 8. QUALITÉ OBLIGATOIRE

Chaque étape de code doit passer :

- tests ciblés ;
- tests globaux pertinents ;
- typecheck ;
- lint ;
- build ;
- sécurité ;
- boundary review ;
- non-régression.

Interdit :
- `any` de contournement ;
- `ts-ignore` injustifié ;
- tests désactivés ;
- skip silencieux ;
- secrets ;
- bypass sécurité ;
- migration manuelle de production ;
- scope creep.

## 9. GESTION DES ÉCHECS

Si un test échoue :
1. diagnostiquer ;
2. corriger si dans le périmètre ;
3. relancer.

Si l'échec est hors périmètre :
- documenter ;
- ne pas contourner ;
- continuer uniquement si la dépendance n'est pas bloquante.

Si sécurité/architecture/migration/boundary est en cause :
- STOP.

## 10. CHECKPOINTS

Après #210/#127 :
exécuter le prompt `03-phase1-checkpoint-a1.md`.

Avant #211 :
vérifier extraction #204.

Avant chaque issue :
vérifier ses préconditions.

Après chaque issue :
produire un mini completion report.

## 11. GESTION GIT

Utiliser des branches de travail dédiées.

Ne jamais pousser directement des modifications fonctionnelles non revues sur main si le workflow du dépôt impose une PR.

Chaque PR doit contenir :
- objectif ;
- périmètre ;
- décisions ;
- tests ;
- risques ;
- lien issue.

Ne jamais fusionner une PR si les checks requis échouent.

## 12. DOCUMENTATION

Mettre à jour la documentation uniquement lorsqu'une décision ou un contrat change.

Ne pas produire de documentation redondante.

## 13. ORDRE D'EXÉCUTION

### Étape 1
Lire :
`01-agent-a-210-acquisition-foundation.md`

Exécuter #210.

### Étape 2
Lire :
`02-agent-b-127-design-system.md`

Exécuter #127.

Les deux peuvent être parallèles si les outils et ownerships le permettent.

### Étape 3
Lire :
`03-phase1-checkpoint-a1.md`

Effectuer checkpoint.

### Étape 4
Lire :
`04-extract-204.md`

Extraire uniquement les morceaux autorisés de #204 puis fermer la PR si applicable.

### Étape 5
Lire :
`05-211-lead-qualification.md`

Exécuter #211.

### Étape 6
Lire :
`06-212-conversion-handoff.md`

Exécuter #212.

### Étape 7
Lire :
`07-213-acquisition-analytics.md`

Exécuter #213.

### Étape 8
Lire :
`08-214-ux-trust-optimization.md`

Exécuter #214.

### Étape 9
Lire :
`09-215-production-readiness.md`

Exécuter #215.

### Étape 10
Lire :
`10-final-release-review.md`

Produire le rapport final.

## 14. RÈGLE DE FIN

Tu ne t'arrêtes pas simplement parce qu'une issue est techniquement implémentée.

Une étape est terminée seulement quand :
- code terminé ;
- tests verts ;
- typecheck vert ;
- lint vert ;
- build vert ;
- sécurité vérifiée ;
- documentation suffisante ;
- PR prête/validée selon workflow ;
- aucune régression connue ;
- rapport de completion produit.

## 15. RAPPORTS

À chaque étape :

STATUS:
READY / IN_PROGRESS / BLOCKED / DONE

CHANGES:
...

TESTS:
...

RISKS:
...

DECISIONS:
...

NEXT:
...

À la fin :

# AUTONOMOUS EXECUTION FINAL REPORT

Inclure :
- issues exécutées ;
- commits ;
- PRs ;
- tests ;
- migrations ;
- décisions ;
- risques résiduels ;
- GO/NO-GO.

## 16. OBJECTIF FINAL

Ne cherche pas à maximiser le nombre de lignes de code.

Cherche à obtenir un Reboot :

- cohérent ;
- simple ;
- sécurisé ;
- testable ;
- maintenable ;
- mesurable ;
- prêt production ;
- fidèle à sa responsabilité d'acquisition ;
- sans duplication du cœur HashCode.

Commence par vérifier la baseline et les préconditions de #210/#127, puis exécute la suite dans l'ordre canonique.
