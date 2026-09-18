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
| `src/lib/workshop-emails.ts` | Templates transactionnels (inscription, soumission, review, quiz) — `escapeHtml` systématique | 135 |

### Routes API

| Route | Méthode | Rôle |
|-------|---------|------|
| `/api/admin/workshops` | GET/POST | Lister/Créer un atelier |
| `/api/admin/workshops/[id]` | GET/PUT/DELETE | Détail/Mettre à jour/Supprimer |
| `/api/admin/workshops/[id]/weeks` | GET/POST | Gérer les semaines |
| `/api/admin/workshops/[id]/quiz/[quizId]` | POST | Soumettre un quiz |
| `/api/admin/workshops/submissions/[id]/review` | POST | Review (Approuvé/Révision/Rejeté) + email membre |
| `/api/workshops/[slug]/enroll` | POST | Inscription membre + email (fire-and-forget) |
| `/api/workshops/sessions/[id]/submissions` | POST | Soumission livrable + email (fire-and-forget) |
| `/api/workshops/quizzes/[id]/attempts` | POST | Tentative quiz + email résultat (fire-and-forget) |

### Pages UI

| Page | Rôle |
|------|------|
| `/dashboard/ateliers` | Liste des ateliers (membre) |
| `/dashboard/ateliers/[slug]` | Détail atelier + séances par semaine (membre) |
| `/dashboard/ateliers/[slug]/sessions/[sessionId]` | Activités + livrable + quiz (membre) |
| `/admin/ateliers` | Gestion ateliers (admin) |
| `/admin/ateliers/[id]` | Détail atelier (admin) |
| `/admin/ateliers/submissions` | Revue des soumissions (admin) |

### Composants membre (`_components/`)

| Composant | Rôle |
|-----------|------|
| `EnrollButton.tsx` | Inscription (`POST enroll`, `focus-visible`, `aria-label`, spinner `motion-reduce`) |
| `SessionDetailView.tsx` | Activités + soumission + quiz interactif |
| `SessionStateBadge.tsx` | Badge verrouillée/débloquée/terminée |

### Seed

`scripts/seed-github-workshop.ts` (idempotent) : 1 Workshop, 4 semaines,
12 séances, 33 activités, 12 livrables, 12 quizzes (36 questions).

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

- 271 unit tests (`npm run test:unit`) : validation, progression, quiz,
  emails transactionnels (`workshop-emails`, XSS), gate Event
  (`events-gate` : fuseaux + filtres publics)
- Tous couvrent les cas limites et les erreurs

## Audits

- `docs/ateliers/00-audit-phase1.md` — audit d'architecture (GATE 1)
- `docs/ateliers/AUDIT-UX.md` — audit UX (8/10, #94 : `transition-[width]`,
  `focus-visible`, `aria-label`, `motion-reduce` appliqués)
- `docs/audit-securite-2026-09-18.md` — audit de sécurité (C2)

## ADR associés

| ADR | Sujet |
|-----|-------|
| ADR-001 | Event ≠ Session |
| ADR-002 | Progression séquentielle |
| ADR-003 | Scoring serveur |
| ADR-004 | Quiz sans fuite |

---

*Dernière mise à jour : 2026-09-18*
