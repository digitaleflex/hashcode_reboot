# #215 — Production Readiness

## Préconditions

#210, #127, #204, #211, #212, #213 et #214 validées.

## Objectif

Amener Reboot à un état de production contrôlé.

## Vérifier

- tests unitaires/intégration/E2E pertinents ;
- typecheck ;
- lint ;
- build ;
- migrations ;
- secrets ;
- rate limits ;
- CSRF/auth ;
- audit trail ;
- GDPR ;
- logs ;
- observabilité ;
- erreurs ;
- performance ;
- accessibilité ;
- documentation ;
- rollback.

## Règle E2E

Une suite E2E ne doit jamais être déclarée verte si elle est silencieusement skipped à cause d'une configuration manquante. Distinguer clairement PASS, FAIL et BLOCKED.

## Done

La release est reproductible, testée, documentée et accompagnée d'un plan de rollback.
