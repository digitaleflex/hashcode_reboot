# Architecture Ateliers — Documentation

## Vue d'ensemble

Le module Ateliers permet de créer et gérer des programmes pédagogiques structurés (semaines → séances → activités → livrables → quiz).

## Architecture technique

### Fichiers principaux

| Fichier | Rôle | Lignes |
|---------|------|--------|
| `src/lib/workshop-validation.ts` | Validation pure du domaine | 616 |
| `src/lib/workshop-progression.ts` | Progression & unlock | 158 |
| `src/lib/workshop-quiz.ts` | Scoring serveur | 209 |
| `src/lib/workshop-server.ts` | Glue DB → pure | 300 |

### Routes API

| Route | Méthode | Rôle |
|-------|---------|------|
| `/api/admin/workshops` | GET/POST | Lister/Créer un atelier |
| `/api/admin/workshops/[id]` | GET/PUT/DELETE | Détail/Mettre à jour/Supprimer |
| `/api/admin/workshops/[id]/weeks` | GET/POST | Gérer les semaines |
| `/api/admin/workshops/[id]/quiz/[quizId]` | POST | Soumettre un quiz |

### Pages UI

| Page | Rôle |
|------|------|
| `/dashboard/ateliers` | Liste des ateliers (membre) |
| `/dashboard/ateliers/[id]` | Détail atelier (membre) |
| `/admin/ateliers` | Gestion ateliers (admin) |
| `/admin/ateliers/[id]` | Détail atelier (admin) |

## Domaine métier

### Hiérarchie

```
Workshop (atelier)
  └── Week (semaine)
       └── Session (séance)
            ├── Activity (activité)
            ├── Deliverable (livrable)
            └── Quiz
                 └── Question
```

### Statuts

| Entité | Statuts possibles |
|--------|-------------------|
| Workshop | `draft`, `published`, `archived` |
| Week | `locked`, `unlocked`, `completed` |
| Session | `locked`, `unlocked`, `completed` |
| Activity | `locked`, `unlocked`, `completed` |
| Quiz | `locked`, `unlocked`, `completed`, `passed`, `failed` |

### Progression

La progression est **séquentielle** (voir ADR-002) :
- Semaine N débloquée après Semaine N-1 complétée
- Séance N débloquée après Séance N-1 complétée
- Activité N débloquée après Activité N-1 complétée

### Scoring

Le scoring est **exclusivement côté serveur** (voir ADR-003) :
- Le client soumet les réponses
- Le serveur compare avec `correctJson`
- Le score est retourné (jamais les bonnes réponses)

## Sécurité

- `correctJson` n'est **jamais** exposé au client (voir ADR-004)
- Les mutations sont protégées par `blockIfTesting`
- Validation stricte de toutes les entrées (Zod-like)

## Tests

- 247 unit tests (validation 630l, progression 326l, quiz 275l)
- Tous couvrent les cas limites et les erreurs

## ADR associés

| ADR | Sujet |
|-----|-------|
| ADR-001 | Event ≠ Session |
| ADR-002 | Progression séquentielle |
| ADR-003 | Scoring serveur |
| ADR-004 | Quiz sans fuite |

---

*Dernière mise à jour : 2026-09-18*
