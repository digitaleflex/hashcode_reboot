# Agent B — #127 Design System

## Mission

Implémenter #127 exclusivement comme chantier UI/design system.

## Ownership

Autorisé :
- `globals.css`
- `components/ui/*`
- tokens/design-system
- documentation design system
- QA visuelle

Interdit :
- `prisma/**`
- `src/lib/acquisition/**`
- `src/lib/orientation/**`
- `reboot/profiling/**`
- `admin/**`
- APIs métier
- logique d'acquisition

## messages/fr.json

Ne pas modifier `messages/fr.json` avant le checkpoint A1. Si une évolution i18n est réellement nécessaire, l'isoler dans une étape dédiée et coordonnée.

## Travail

1. Lire #127 et les conventions UI existantes.
2. Définir/normaliser tokens, primitives et composants nécessaires.
3. Éviter toute réécriture massive non justifiée.
4. Préserver les comportements métier.
5. Vérifier responsive, accessibilité et cohérence visuelle.
6. Ajouter les tests pertinents.
7. Exécuter lint/typecheck/build et QA visuelle.
8. Documenter les conventions introduites.
9. Commit atomique et PR.

## Interdictions

Pas de refonte métier, pas de modification Prisma/API, pas de modification du profiling/orientation/admin, pas de dépendance à Agent A.

## Done

#127 est terminé lorsque le design system est cohérent, documenté, accessible, responsive et sans régression fonctionnelle.
