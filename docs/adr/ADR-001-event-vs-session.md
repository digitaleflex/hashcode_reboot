# ADR-001 : Event ≠ Session

## Statut : Accepté

## Contexte

Le domaine "Ateliers" utilise deux concepts temporels : les **Events** (événements, meetups) et les **Sessions** (séances d'un atelier). Ces deux concepts sont souvent confondus mais ont des semantics très différentes.

## Décision

Nous avons décidé de **séparer strictement Event et Session** :

| Concept | Définition | Temporalité | Rôle |
|---------|------------|-------------|------|
| **Event** | Rendez-vous ponctuel (meetup, conférence) | Horodatage unique | Rassembler, réseauter |
| **Session** | Unité pédagogique d'un atelier | Numérotée, séquentielle | Enseigner, pratiquer |

## Conséquences

### Positives
- Clarté sémantique : un Event n'est jamais confondu avec une Session
- Réutilisation : les Events existent indépendamment des Ateliers
- Testabilité : chaque concept a sa propre logique de validation

### Négatives
- Deux ensembles de routes API distincts (`/api/events` vs `/api/admin/workshops/...`)
- Nécessite de documenter la différence pour les nouveaux développeurs

## Alternatives considérées

1. **Unifier Event/Session** : Rejeté — un meetup n'est pas une séance pédagogique
2. **Session hérite d'Event** : Rejeté — trop de coupling, un atelier peut avoir des sessions sans Event associé

---

*ADR-001 | 2026-09-18 | ATELIER*
