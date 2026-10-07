# HashCode Reboot — Roadmap V1

Date de référence: 2026-10-07
Branche de référence: `development`

## Vision

Reboot est le point d'entrée gratuit de l'écosystème HashCode. Il recueille les informations nécessaires pour comprendre les personnes qui rejoignent HashCode, identifier leurs profils, intérêts et besoins, puis les orienter vers les activités et opportunités adaptées.

Reboot ne vend rien. Il n'est ni une école, ni la communauté elle-même, ni un système de paiement.

Boucle cible:

`COLLECT → UNDERSTAND → IDENTIFY → ORIENT → ACTIVATE → OBSERVE → RE-SCORE`

Question centrale:

> Quelle est la meilleure prochaine action pour cette personne dans HashCode ?

## Calendrier

| Milestone | Nom | Deadline | Résultat attendu |
|---|---|---:|---|
| M0 | Backlog Reset & Alignment | 2026-10-09 | Backlog nettoyé et aligné |
| M1 | Reboot Foundation | 2026-10-13 | Architecture stable |
| M2 | Profiling Engine V1 | 2026-10-20 | Features et profil calculé |
| M3 | Orientation Engine V1 | 2026-10-30 | Classification + scoring + confidence |
| M4 | Matching & Recommendations | 2026-11-06 | Recommandations + Next Best Action |
| M5 | Behavioural Loop | 2026-11-20 | Observation + re-scoring |
| M6 | Reboot V1 Production | 2026-11-27 | V1 production-ready |

## M0 — Backlog Reset & Alignment

### Objectif
Reprendre toutes les issues ouvertes, supprimer les doublons, fermer les éléments obsolètes, conserver/réécrire les éléments pertinents et créer les issues manquantes.

### Règles
- Ne jamais supprimer une issue utile sans raison traçable.
- Classer chaque issue: KEEP, REWRITE, MERGE, MOVE, CLOSE ou NEW.
- Toute issue conservée doit avoir un domaine, une priorité et une milestone.
- Toute nouvelle issue doit être liée à la vision Reboot.
- Les fonctionnalités de paiement/monétisation ne font pas partie de Reboot V1.

### Issues structurantes
- REBOOT-001 — Audit complet du backlog
- REBOOT-002 — Classification KEEP/REWRITE/MERGE/MOVE/CLOSE
- REBOOT-003 — Taxonomie des labels
- REBOOT-004 — Fermeture documentée des issues obsolètes
- REBOOT-005 — Création des issues V1 manquantes

## M1 — Reboot Foundation

### Objectif
Stabiliser les fondations et séparer clairement Profiling, Access Control, Orientation, Matching, Recommendation et Analytics.

### Travail
- architecture actuelle
- modèle de données
- séparation des responsabilités
- architecture `src/lib/orientation/`
- documentation technique
- sécurité et confidentialité de base

## M2 — Profiling Engine V1

### Objectif
Transformer les réponses brutes du profilage en features normalisées.

### Axes
- identité
- domaine
- niveau
- objectifs
- disponibilité
- mode d'apprentissage
- motivation
- intention
- mentorat

Le profil doit distinguer:
1. déclaré
2. inféré
3. observé (structure préparée, données comportementales complètes en M5)

## M3 — Orientation Engine V1

### Objectif
Répondre à « Qui est cette personne selon les données disponibles ? ».

### Composants
- scoreArchetypes
- classification multidimensionnelle
- confidence
- explainability
- gestion des cas ambigus/incomplets
- versioning de l'engine
- tests déterministes

Archetypes V1:
- BUILDER
- CREATOR
- STRATEGIST
- CATALYST

Le score d'un archétype n'est pas la confiance. Ces concepts restent séparés.

## M4 — Matching & Recommendations

### Objectif
Répondre à « Que devrait faire cette personne maintenant ? ».

### Cibles
- Challenge
- Workshop
- Project
- Community activity
- Mentoring
- Learning path
- Event

### Capacités
- member → activity
- activity → members
- recommendation scoring
- explainability
- Next Best Action
- no-match / insufficient-data

## M5 — Behavioural Loop

### Objectif
Faire évoluer le profil à partir des comportements réels.

### Signaux
- challenge_started/completed
- workshop_started/completed
- event_joined
- community_joined
- mentor_requested
- project_started/completed
- accepted/ignored/started/completed/abandoned pour les recommandations

### Capacités
- profile enrichment
- re-scoring
- profile evolution
- recommendation evolution
- feedback loop
- engine evaluation

## M6 — Reboot V1 Production

### Objectif
Livrer une expérience stable et compréhensible.

### Travail
- Profile experience
- Orientation experience
- Next Best Action UI
- recommendation cards
- member dashboard
- admin intelligence
- privacy/security review
- unit/integration/E2E/regression QA
- production release

## Hors périmètre V1

- LLM utilisé comme moteur de décision principal
- machine learning complexe
- embeddings
- système prédictif
- paiement
- marketplace
- monétisation
- réseau social complet
- gamification massive

## Definition of Done globale

Une milestone n'est terminée que si:
- le code correspondant est implémenté ou la décision documentée;
- les tests pertinents passent;
- les dépendances sont résolues;
- aucune fonctionnalité future n'est présentée comme disponible;
- la documentation est cohérente;
- l'issue comporte des critères d'acceptation vérifiables.
