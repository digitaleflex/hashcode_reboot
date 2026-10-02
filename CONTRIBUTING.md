# Guide du contributeur — HASHCODE REBOOT

## Stack technique

- **Framework** : Next.js 15 (App Router, React 19, Turbopack)
- **Langue** : TypeScript strict (`tsc --noEmit` en CI)
- **Styling** : Tailwind CSS v4 + CSS variables (design tokens)
- **Auth** : Better Auth (email/password, magic link, 2FA TOTP)
- **i18n** : `next-intl` v3 (fr/en, locale routing)
- **DB** : PostgreSQL + Prisma ORM
- **Email** : Resend + Brevo (deliverability monitoring)
- **Tests** : Vitest (unit), Playwright (E2E)
- **CI/CD** : GitHub Actions

## Démarrage rapide

```bash
# 1. Dépendances
npm ci

# 2. Variables d'environnement
cp .env.example .env.local
# Éditer .env.local (DATABASE_URL, BETTER_AUTH_SECRET, RESEND_KEY, etc.)

# 3. Base de données
npx prisma migrate dev
npm run db:seed          # ou npx tsx scripts/seed-workshops.ts

# 4. Dev server (Turbopack)
npm run dev

# 5. Vérifications
npm run typecheck        # tsc --noEmit
npm run lint             # eslint
npm run test             # vitest
npm run test:e2e         # playwright
```

## Structure du projet

```
src/
├── app/                    # App Router (pages, layouts, API routes)
│   ├── [locale]/           # Routes localisées (tout sauf /api)
│   │   ├── dashboard/      # Espace membre
│   │   ├── admin/          # Interface admin
│   │   ├── ateliers/       # Workshops pédagogiques
│   │   └── ...
│   └── api/                # API routes (non localisées)
├── components/
│   ├── reboot/             # Composants Reboot (landing, profiling, dashboard)
│   │   ├── landing/        # Page d'accueil
│   │   ├── profiling/      # Questionnaire onboarding
│   │   └── ...
│   └── brand/              # Logo, wordmark
├── lib/
│   ├── profiling/          # Moteur profilage (questions, validation, labels)
│   ├── utils/              # Helpers (cn, dates, etc.)
│   └── auth/               # Config Better Auth
├── i18n/                   # Config next-intl (routing, request)
├── middleware.ts           # Auth + i18n middleware
messages/
├── fr.json                 # Messages FR (source)
└── en.json                 # Messages EN
scripts/
├── seed-workshops.ts       # Seed ateliers/sessions/quizzes
└── check-messages.mjs      # Validation i18n
docs/
├── i18n.md                 # Doc internationale
└── adr/                    # Architecture Decision Records
```

## Conventions de code

### TypeScript
- `strict: true`, `noUncheckedIndexedAccess: true`
- Pas de `any` (utiliser `unknown` + narrow)
- Types Prisma générés dans `prisma/generated`

### Composants
- **Server Components** par défaut (pas de `"use client"`)
- **Client Components** seulement si : interactivité, hooks, browser API
- Props typées avec `interface` (pas `type` pour props)
- `cn()` pour classNames conditionnels (Tailwind merge)

### i18n
- Toutes chaînes visibles → `messages/{locale}.json`
- Server : `getTranslations('namespace')`
- Client : `useTranslations('namespace')`
- Tableaux : `t.raw('key') as Array<...>`
- Pluriels : ICU dans JSON + `t('key', { count })`
- Validation : `node scripts/check-messages.mjs` avant commit

### API Routes
- `NextRequest` / `NextResponse` (pas `req/res` legacy)
- Validation Zod sur `request.json()`
- Erreurs : `{ ok: false, error: string, code?: string }`
- Succès : `{ ok: true, data: T }`

### Base de données
- Migrations Prisma : `npx prisma migrate dev --name <desc>`
- Seed : `npx tsx scripts/seed-workshops.ts`
- Pas de raw SQL sauf migration complexe

## Workflow Git

### Branches
- `main` : production (protégée, PR required)
- `feat/*`, `fix/*`, `chore/*`, `docs/*` : feature branches

### Commits (Conventional Commits)
```
<type>(<scope>): <description>

[body]

[footer]
```

| Type | Usage |
|------|-------|
| `feat` | Nouvelle fonctionnalité |
| `fix` | Correction bug |
| `docs` | Documentation |
| `refactor` | Refactor sans changement comportemental |
| `perf` | Performance |
| `test` | Tests |
| `chore` | Maintenance (deps, config, scripts) |
| `ci` | CI/CD |

Exemples :
```
feat(auth): add 2FA TOTP setup flow
fix(dashboard): correct workshop enrollment race condition
docs(i18n): add contributor guide for translations
```

### PR
- Titre = commit conventionnel (squash merge)
- Description : quoi, pourquoi, comment tester
- Checks obligatoires : typecheck, lint, test, build, e2e
- Review : 1 approbation minimum

## Tests

### Unit (Vitest)
```bash
npm run test              # watch
npm run test:run          # single run
npm run test:coverage     # coverage report
```
- Fichiers : `*.test.ts` / `*.test.tsx` à côté du code
- Mock Prisma avec `vitest-mock-extended`
- Test helpers dans `test/utils/`

### E2E (Playwright)
```bash
npm run test:e2e          # headless
npm run test:e2e:ui       # UI mode
```
- Fichiers : `e2e/**/*.spec.ts`
- Fixtures : `e2e/fixtures/`
- Config : `playwright.config.ts` (chromium, firefox, webkit)

## Ajouter une traduction

1. Trouver le namespace (ex: `dashboard.ateliers.session`)
2. Ajouter clé dans `messages/fr.json`
3. Traduire dans `messages/en.json`
4. Utiliser `t('dashboard.ateliers.session.maCle')`
5. `node scripts/check-messages.mjs` → doit passer
6. `npm run typecheck` → doit passer

## Ajouter un atelier (workshop)

1. `scripts/seed-workshops.ts` : ajouter objet dans `workshops[]`
2. Structure : `weeks[]` → `sessions[]` → `activities[]` + `deliverable` + `quiz`
3. `npm run db:seed` (ou `npx tsx scripts/seed-workshops.ts`)
4. Vérifier : `/dashboard/ateliers/<slug>` affiche le parcours

## Variables d'environnement requises

| Variable | Description | Requis |
|----------|-------------|--------|
| `DATABASE_URL` | PostgreSQL (Prisma) | ✅ |
| `BETTER_AUTH_SECRET` | Secret auth (32+ chars) | ✅ |
| `BETTER_AUTH_URL` | Base URL (ex: http://localhost:3000) | ✅ |
| `RESEND_API_KEY` | Emails transactionnels | ✅ |
| `BREVO_API_KEY` | Emails marketing/deliverability | ✅ |
| `NEXT_PUBLIC_APP_URL` | URL publique pour liens emails | ✅ |
| `ADMIN_PASSCODE` | Passcode admin (rotation via UI) | ✅ |

## Scripts utiles

```bash
npm run dev               # Turbopack dev server
npm run build             # Production build
npm run start             # Production server
npm run typecheck         # tsc --noEmit
npm run lint              # ESLint
npm run format            # Prettier
npm run db:studio         # Prisma Studio
npm run db:seed           # Seed workshops
npm run check:i18n        # node scripts/check-messages.mjs
```

## Dépannage courant

| Problème | Commande |
|----------|----------|
| Types Prisma obsolètes | `npx prisma generate` |
| DB schema drift | `npx prisma migrate dev` |
| Port 3000 occupé | `lsof -ti:3000 | xargs kill -9` |
| Cache Next.js corrompu | `rm -rf .next` |
| Modules node corrompus | `rm -rf node_modules package-lock.json && npm ci` |

## Ressources

- [Next.js 15 Docs](https://nextjs.org/docs)
- [next-intl Docs](https://next-intl-docs.vercel.app/)
- [Better Auth Docs](https://www.better-auth.com/docs)
- [Tailwind CSS v4](https://tailwindcss.com/docs)
- [Prisma ORM](https://www.prisma.io/docs)
- [Playwright](https://playwright.dev/)
- [Vitest](https://vitest.dev/)