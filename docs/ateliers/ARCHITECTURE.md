# Architecture Ateliers — Documentation

## Vue d'ensemble

Le module Ateliers permet de créer et gérer des programmes pédagogiques structurés (semaines → séances → activités → livrables → quiz).

## Architecture technique

> **Vérifié 2026-10-06.** Les chemins sont sous `src/app/[locale]/` (migration
> i18n). La structure des ateliers passe par des **seeds idempotents** : il
> n'existe pas d'API d'écriture de la structure (ni `POST /workshops`, ni
> `PUT`/`DELETE /workshops/[id]`, ni `/weeks`).

### Fichiers principaux

| Fichier | Rôle | Lignes |
|---------|------|--------|
| `src/lib/workshop-validation.ts` | Validation pure du domaine | 134 |
| `src/lib/workshop-progression.ts` | Progression & unlock | 185 |
| `src/lib/workshop-quiz.ts` | Scoring serveur | 191 |
| `src/lib/workshop-server.ts` | Glue DB → pure | 304 |
| `src/lib/workshop-emails.ts` | Templates transactionnels (inscription, soumission, review, quiz) — `escapeHtml` systématique | 144 |

### Routes API

| Route | Méthode | Rôle |
|-------|---------|------|
| `/api/admin/workshops` | GET | Lister les ateliers — **pas de POST** : la structure passe par le seed |
| `/api/admin/workshops/[id]` | GET | Détail d'un atelier — **pas de PUT/DELETE** |
| `/api/admin/workshops/sessions/[id]` | GET/PATCH | Détail et mise à jour d'une séance |
| `/api/admin/workshops/stats` | GET | Statistiques ateliers |
| `/api/admin/workshops/submissions` | GET | Liste des soumissions |
| `/api/admin/workshops/submissions/[id]/review` | POST | Review (Approuvé/Révision/Rejeté) + email membre |
| `/api/workshops` | GET | Liste des ateliers publiés |
| `/api/workshops/[slug]` | GET | Détail public d'un atelier |
| `/api/workshops/[slug]/enroll` | POST | Inscription membre + email (fire-and-forget) |
| `/api/workshops/sessions/[id]` | GET | Détail d'une séance |
| `/api/workshops/sessions/[id]/submissions` | POST | Soumission livrable + email (fire-and-forget) |
| `/api/workshops/quizzes/[id]/attempts` | POST | Tentative quiz + email résultat (fire-and-forget) |

Les dossiers `src/app/api/workshops/quizzes/` et `src/app/api/workshops/sessions/`
ne contiennent pas de route « liste » : seuls les segments `[id]` sont montés.

### Pages UI

| Page | Rôle |
|------|------|
| `/dashboard/ateliers` | Liste des ateliers (membre) |
| `/dashboard/ateliers/[slug]` | Détail atelier + séances par semaine (membre) |
| `/dashboard/ateliers/[slug]/sessions/[sessionId]` | Activités + livrable + quiz (membre) |
| `/admin/ateliers` | Gestion ateliers (admin) |
| `/admin/ateliers/[id]` | Détail atelier (admin) |
| `/admin/ateliers/submissions` | Revue des soumissions (admin) |

Fichiers : `src/app/[locale]/dashboard/ateliers/...` et
`src/app/[locale]/admin/ateliers/...`.

### Composants membre (`_components/`)

| Composant | Rôle |
|-----------|------|
| `src/app/[locale]/dashboard/ateliers/_components/EnrollButton.tsx` | Inscription (`POST enroll`, `focus-visible`, `aria-label`, spinner `motion-reduce`) |
| `src/app/[locale]/dashboard/ateliers/_components/SessionDetailView.tsx` | Activités + soumission + quiz interactif |
| `src/app/[locale]/dashboard/ateliers/_components/SessionStateBadge.tsx` | Badge verrouillée/débloquée/terminée |

### Seed

- `scripts/seed-workshops.ts` — seed générique des ateliers.
- `scripts/seed-github-program.ts` — programme « Maîtrise GitHub ».
- `scripts/seed-github-workshop.ts` — le seed de l'atelier GitHub au format
  workshop structuré (idempotent).

> Les trois scripts existent. Aucun n'est exposé comme `npm run db:seed` ; le
> script npm correspondant est `npm run seed:workshops`.

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

Les statut sont des `String` (pas des `enum` Prisma) : la validation est faite
par l'application.

| Entité | Statuts possibles | Source |
|--------|-------------------|--------|
| Workshop | `draft` (défaut), `published`, `archived` | `schema.prisma:578` |
| WorkshopSubmission | `PENDING`, `IN_REVIEW`, `APPROVED`, `REVISION`, `REJECTED` | `schema.prisma:706` |
| WorkshopReview | `APPROVED`, `REVISION`, `REJECTED` (`decision`) | `schema.prisma:731` |
| WorkshopEnrollment | `ACTIVE` (défaut), + `status` de l'inscription | `schema.prisma:809` |
| Mentorship | `ACTIVE` (défaut) | `schema.prisma:826` |

Les statuts `locked` / `unlocked` / `completed` / `passed` / `failed` ne sont
**pas** persistés : la progression et le déblocage sont dérivés côté serveur par
`src/lib/workshop-progression.ts` à partir des soumissions et des tentatives de
quiz. C'est une décision d'architecture explicite (ADR-002), pas une omission.

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

- Les tests du domaine Atelier sont :
  `workshop-validation`, `workshop-progression`, `workshop-quiz`,
  `workshop-emails` (XSS), `events-gate` (fuseaux + filtres publics), et
  `tests/e2e/workshop-gate.spec.ts` côté Playwright.
- `npm run check:test-wiring` échoue si l'un de ces fichiers n'est branché dans
  un script `package.json`.
- Le nombre de tests évolue à chaque ajout : ne pas recopier un total dans la
  doc. Mesurer avec `npm run test:unit` et lire les lignes `# tests` / `# suites`.

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
