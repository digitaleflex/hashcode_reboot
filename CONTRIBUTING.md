# Contribuer à HASHCODE REBOOT

## Setup

```bash
bun install
cp .env.example .env   # configurer les variables
bunx prisma migrate dev --name init
bun run dev             # http://localhost:3000
```

## Branches

- `development` — branche principale de travail
- `main` — production (déploiement Vercel automatique)

Toujours créer une branche feature depuis `development` :

```bash
git checkout -b feat/nom-feature development
```

## Commits

Format **Conventional Commits** :

```
type(scope): description

feat(onboarding): add phone optional step
fix(auth): prevent session refresh on every request
docs(readme): update env vars table
test(events): cover validation and merge
chore(deps): update prisma to 6.5
```

Types : `feat`, `fix`, `docs`, `test`, `chore`, `perf`, `refactor`, `security`

## Code

- **TypeScript** strict, `tsc --noEmit` doit passer (0 erreur)
- **Zod** pour toutes les validations d'entrée API
- **Rate-limit** sur tous les endpoints publics (`lib/rate-limit.ts`)
- **Guard `blockIfTesting`** sur les routes d'écriture (`lib/test-guard.ts`)
- **Audit trail** sur les mutations admin (`lib/admin-audit.ts`)
- **FR** pour les messages d'erreur (`{ error }` en français)
- Pas de `console.log` en production — utiliser `lib/logging.ts`

## Tests

```bash
bun run test:unit        # 153 tests (unit + profiling + events)
bun run test:integration # 29 tests (read-only, safe pour prod DB)
bun run typecheck        # tsc --noEmit
```

Les tests d'intégration sont **read-only** —aucun POST ne crée de données en base.
Ne jamais ajouter de tests d'écriture sans `TESTING=1` guard.

## Structure

```
src/app/           Pages + routes API
src/components/    UI (reboot/ + ui/shadcn)
src/lib/           Logique métier (auth, mail, rate-limit, profiling, ...)
prisma/            Schema + migrations
tests/             Tests node:test
```

## AVANT de push

```bash
bun run validate   # typecheck + lint + knip + test:unit
```

## PR

- Titre descriptif en français ou anglais
- Lien vers l'issue GitHub si applicable
- Screenshots si changement UI
- `bun run validate` vert
