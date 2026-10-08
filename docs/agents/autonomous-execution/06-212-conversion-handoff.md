# #212 — Conversion & Handoff

## Préconditions

#211 validée.

## Objectif

Faire passer proprement un prospect qualifié vers l'étape suivante sans implémenter JoinHashCode dans Reboot.

## Travail

1. Définir les états de conversion existants.
2. Réutiliser statuts/timestamps/events.
3. Garantir idempotence.
4. Empêcher double invitation/conversion.
5. Tracer les événements importants.
6. Vérifier consentement et conditions de handoff.
7. Définir le contrat de payload minimal.
8. Tester succès, refus, répétition, expiration et erreurs.
9. Documenter le handoff.

## Interdictions

Pas de nouvelle plateforme membre, pas de duplication du profil, pas de logique JoinHashCode, pas de transaction distribuée inutile.

## Done

Le handoff est fiable, traçable, idempotent, sécurisé et minimal.
