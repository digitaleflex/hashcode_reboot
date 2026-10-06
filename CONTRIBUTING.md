# Guide du contributeur — HASHCODE REBOOT

> Source de vérité : le dépôt. Toute affirmation de ce guide (chemin, route,
> script, variable, nombre) doit pouvoir être revérifiée par lecture du code ou
> par exécution de la commande nommée. Si tu ne peux pas la vérifier, ne l'écris
> pas — ou marque-la explicitement comme incertaine.

## Stack technique

- **Framework** : Next.js 16 (App Router, React 19, React Compiler, Turbopack)
- **Package manager** : **npm** — Node 22, `package-lock.json`. C'est ce que fait
  `.github/workflows/ci.yml` (`npm ci`), donc c'est ce qui décide si le dépôt
  est vert. Ne pas utiliser bun, ne pas régénérer `bun.lock`.
- **Langue** : TypeScript strict (`strict: true`, `tsc --noEmit` en CI)
- **Styling** : Tailwind CSS v4 + CSS variables (design tokens)
- **Auth** : Better Auth — email + mot de passe (espace admin) et plugin
  `emailOTP` (espace membre). **Pas de 2FA / TOTP.**
- **i18n** : `next-intl` v4 (fr sans préfixe, en sous `/en`)
- **DB** : PostgreSQL (Neon) + Prisma ORM — `POSTGRES_PRISMA_URL` (poolée,
  runtime) + `POSTGRES_URL_NON_POOLING` (directe, migrations CLI)
- **Email** : Resend (primaire) + Brevo (marketing / fallback)
- **Tests** : `node --test` avec `tsx` (unitaires), Playwright (E2E)
- **CI/CD** : GitHub Actions (`.github/workflows/ci.yml`, `copilot-setup-steps.yml`)

## Démarrage rapide

```bash
# 1. Dépendances (postinstall lance déjà `prisma generate`)
npm ci

# 2. Variables d'environnement
cp .env.example .env
# Éditer .env : POSTGRES_PRISMA_URL, POSTGRES_URL_NON_POOLING,
# BETTER_AUTH_SECRET, ADMIN_OPERATORS, RESEND_API_KEY, ...

# 3. Base de données
npx prisma migrate deploy     # applique les migrations existantes
npx prisma generate           # si le client n'est pas à jour

# 4. Dev server (Turbopack)
npm run dev

# 5. Vérifications — la même liste que `npm run validate`
npm run typecheck             # tsc --noEmit
npm run lint                  # eslint
npm run check:test-wiring     # chaque tests/*.cjs doit être branché
npm run test:unit             # enchaîne 23 fichiers .cjs
npm run check:i18n            # parité fr/en + placeholders ICU
```

## Structure du projet

```
src/
├── app/
│   ├── layout.tsx            # layout racine minimal (styles uniquement)
│   ├── globals.css           # design tokens (thème sombre, accent lime)
│   ├── [locale]/             # TOUTES les pages (layout.tsx porte <html lang>)
│   │   ├── page.tsx          # landing + profilage + résultat
│   │   ├── login/, verify-otp/, verify-email/
│   │   ├── evenements/[id]/, profile/[id]/
│   │   ├── account/, dashboard/{agenda,profile,profile-complet,settings,mentoring,ateliers}/
│   │   ├── admin/{dashboard,members,events,ateliers,stats,settings,mentoring,
│   │   │          marketing,invitations,exports,blacklist,audit-log,activity,
│   │   │          email-templates,email-deliverability}/
│   │   └── mentions-legales/, cgu/, confidentialite/, cookies/
│   └── api/                  # routes non localisées
├── proxy.ts                  # auth + i18n (convention Next 16, ex-middleware.ts)
├── i18n/                     # routing.ts, request.ts
├── components/
│   ├── reboot/               # landing/, profiling/, profile/, welcome,
│   │                         # events/, event-detail/, legal/, motion/, admin/
│   └── ui/                   # shadcn (13 composants)
├── lib/
│   ├── auth/                 # config Better Auth + client
│   ├── admin-auth.ts         # requireAdmin, adminGuardError, adminGuardResponse
│   ├── account-auth.ts       # getSession() — pont vers Better Auth
│   ├── profiling/            # questions, types, engine, labels, validate, auto-controls
│   ├── mail.ts               # 14 wrappers send* + routage providers
│   ├── email-categories.ts   # taxonomie des catégories sémantiques
│   ├── events-validation.ts, workshop-*.ts, test-guard.ts, errors.ts
│   └── rate-limit.ts, blacklist.ts, verify-email.ts, analytics.ts, health.ts
messages/
├── fr.json                   # source de vérité
└── en.json                   # parité vérifiée par check:i18n
scripts/
├── check-messages.mjs        # validation i18n
├── check-test-wiring.mjs     # validation du câblage des tests
├── task-tracker.mjs          # suivi des tâches d'audit
└── seed-*.ts, copy-standalone.mjs, collect-email-metrics.ts
tests/
├── *.test.cjs                # unitaires et intégration (node:test + tsx)
└── e2e/*.spec.ts             # Playwright
docs/
├── interface-utilisateur.md  # inventaire UI
├── espace-membre.md          # parcours membre
├── i18n.md, adr/, ateliers/, audit-securite-2026-09-18.md
└── REGLE-EXECUTION.md, ROADMAP-SUR-INGENIERIE-2026.md
```

## Conventions de code

### TypeScript
- `strict: true` (attention : `noImplicitAny` est à `false`, d'où les `as any`
  legacies — ne pas en ajouter)
- Pas de nouveau `any` : utiliser `unknown` + narrow
- Client Prisma généré par `prisma generate` (dossier par défaut
  `node_modules/.prisma` — il n'y a pas de `prisma/generated/`)

### Composants
- **Server Components** par défaut (pas de `"use client"`)
- **Client Components** seulement si : interactivité, hooks, browser API
- Alias `@/*` → `./src/*`
- `cn()` pour classNames conditionnels (Tailwind merge)
- Pas de `react-hook-form` dans ce dépôt : les formulaires sont des inputs
  contrôlés ou du `fetch` direct

### i18n
- Toutes chaînes visibles → `messages/{locale}.json`
- Server : `getTranslations('namespace')`
- Client : `useTranslations('namespace')`
- Tableaux : `t.raw('key') as Array<...>`
- Pluriels : ICU dans JSON + `t('key', { count })`
- Validation : `npm run check:i18n` avant commit
- `localePrefix: "as-needed"` et `localeDetection: false`
  (`src/i18n/routing.ts`) : `/` et `/dashboard` sont FR, `/en/...` est EN

### API Routes
- `NextRequest` / `NextResponse` (jamais `req`/`res` legacy)
- Validation Zod sur `request.json()`
- Erreurs : passer par `AppError` + `errorToResponse` (`src/lib/errors.ts`)
  plutôt que par un `NextResponse.json({error})` artisanal — c'est ce qui
  garantit le contrat 401 `AUTH_REQUIRED` / 403 `FORBIDDEN` du garde admin
- Écritures : `blockIfTesting()` en tête de handler

### Base de données
- Migrations Prisma : `npx prisma migrate dev --name <desc>` (local)
- Déploiement : `npm run vercel-build` enchaîne `prisma generate`,
  `prisma migrate deploy`, `next build`
- Pas de raw SQL sauf migration complexe

## Workflow Git

### Branches
- `development` : branche de travail
- `main` : production
- `chore/*`, `feat/*`, `fix/*`, `docs/*` : branches de travail

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
feat(auth): add phone fill confirmation step
fix(dashboard): correct workshop enrollment race condition
docs(i18n): add contributor guide for translations
```

### PR
- Titre = commit conventionnel
- Description : quoi, pourquoi, comment tester
- `npm run validate` vert avant de pousser

## Tests

### Unitaires et intégration (`node:test`)
```bash
npm run test:unit          # enchaîne 23 fichiers .cjs (24e = integration, séparé)
npm run test:integration   # read-only, tourne contre la base réelle
npm run test:all           # test:unit puis test:integration
npm run test:e2e           # Playwright
```
- Runner : `node --import tsx --test <fichiers>` (pas Vitest, pas Jest)
- Les tests vivent dans `tests/*.test.cjs` et sont importés par nom dans un
  script `package.json`. `npm run check:test-wiring` échoue si un fichier de
  test présent sur disque n'est branché dans aucun script.
- Les tests qui importent du code source doivent l'importer
  (`require("../src/lib/...")`), pas le recopier : un test qui recopie la
  logique qu'il teste ne protège rien.
- `tests/integration.test.cjs` est read-only et suppose `TESTING=1` (guard
  `blockIfTesting`, qui renvoie 403 sur les écritures).

### E2E (Playwright)
```bash
npm run test:e2e          # chromium, headless
npm run test:e2e:ui       # UI mode
npm run test:e2e:report   # rapport HTML
```
- Fichiers : `tests/e2e/*.spec.ts` (5 specs : auth, dashboard, ateliers,
  workshop-gate, locale-routing)
- `playwright.config.ts` : projet `chromium` uniquement, `workers: 1`,
  `testDir: ./tests/e2e`, serveur `npm run dev` en local / `npm run start` en CI
- Le job `e2e` de la CI ne s'exécute que si le secret `DATABASE_URL` est
  présent sur le dépôt.

## Ajouter une traduction

1. Trouver le namespace (ex: `dashboard.home.welcomeCard`)
2. Ajouter la clé dans `messages/fr.json`
3. Traduire dans `messages/en.json`
4. Utiliser `t('namespace.maCle')`
5. `npm run check:i18n` → doit passer
6. `npm run typecheck` → doit passer

## Ajouter un atelier (workshop)

Le contenu des ateliers passe par des **seeds idempotents**, pas par une API
d'écriture : `POST /api/admin/workshops` n'existe pas (seul `GET` est monté sur
`src/app/api/admin/workshops/route.ts`).

1. `scripts/seed-github-program.ts` (parcours GitHub) ou
   `scripts/seed-workshops.ts` : ajouter/ajuster les objets
2. Structure : `weeks[]` → `sessions[]` → `activities[]` + `deliverable` + `quiz`
3. `npm run seed:workshops` (= `npx tsx scripts/seed-workshops.ts`, lit `.env`)
4. Vérifier : `/dashboard/ateliers/<slug>` affiche le parcours, et
   `/admin/ateliers` la liste

Il n'existe **pas** de script `db:seed`, `db:studio` ni `format`. Pour ouvrir
Prisma Studio : `npx prisma studio`.

## Variables d'environnement

Source : `.env.example`. Le fichier s'appelle `.env` (pas `.env.local`) — les
scripts `seed:*` le lisent explicitement via `node --env-file=.env`.

| Variable | Description | Requis |
|----------|-------------|--------|
| `POSTGRES_PRISMA_URL` | Neon poolée — **la** variable que Prisma lit (`prisma/schema.prisma`) | ✅ |
| `POSTGRES_URL_NON_POOLING` | Neon directe — migrations CLI (`directUrl`) | ✅ |
| `BETTER_AUTH_SECRET` | Secret Better Auth (≥ 32 caractères) | ✅ |
| `BETTER_AUTH_URL` | URL de base auth | ✅ |
| `ADMIN_OPERATORS` | Emails admin (accès complet), séparés par des virgules. Fail-closed : vide = aucun admin | ✅ |
| `ADMIN_VIEWERS` | Emails admin lecture seule, séparés par des virgules | |
| `NEXT_PUBLIC_SITE_URL` | URL publique (emails, OG, sitemap, `trustedOrigins`) | ✅ |
| `RESEND_API_KEY` / `EMAIL_FROM` | Envoi transactionnel Resend | ✅ |
| `RESEND_WEBHOOK_SECRET` | Signature du webhook Resend (fail-closed en prod) | en prod |
| `BREVO_API_KEY` / `BREVO_EMAIL_FROM` | Envoi marketing Brevo | selon usage |
| `BREVO_WEBHOOK_SECRET` | Signature du webhook Brevo | en prod |
| `EMAIL_PROVIDER` | `brevo` bascule le primaire sur Brevo | |
| `BREVO_FALLBACK_ON_429` | `true` pour activer le fallback croisé sur 429 | |
| `BREVO_DAILY_CAP` / `RESEND_DAILY_CAP` | Plafonds journals d'envoi | |
| `NEXT_PUBLIC_WHATSAPP_URL` / `WHATSAPP_URL` | Lien communauté (client / serveur) | selon usage |
| `NEXT_PUBLIC_MEET_URL` | Salle Google Meet par défaut des événements | |
| `CRON_SECRET` | Bearer des 5 routes `/api/cron/*` | en prod |
| `KV_REST_API_URL` / `KV_REST_API_TOKEN` | Rate-limit et verify-email (fallback mémoire sinon) | |
| `TURNSTILE_SECRET_KEY` / `NEXT_PUBLIC_TURNSTILE_SITE_KEY` | Turnstile sur le login admin (fail-closed s'il est configuré) | |
| `SENTRY_DSN` / `NEXT_PUBLIC_SENTRY_DSN` | Monitoring erreurs | |
| `ADMIN_EMAIL` | Destinataire des notifications de bounce | |
| `ALERT_EMAILS` / `ALERT_SLACK_WEBHOOK` | Canaux d'alerte email | |
| `PHONE_FILL_SECRET` | Secret HMAC du ticket `/api/account/phone` (sinon l'URL de base) | |
| `PRISMA_LOG_QUERIES` | `1` pour réactiver les logs `prisma:query` | |
| `TESTING` | `1` pour activer le guard anti-écriture | tests seulement |

> **`DATABASE_URL` n'existe pas dans ce dépôt.** Le datasource Prisma lit
> `POSTGRES_PRISMA_URL` (`prisma/schema.prisma:11`). Le seul fallback vers
> `DATABASE_URL` est dans `src/lib/phone-fill-ticket.ts:57` et ne sert qu'à
> différer l'erreur d'un ticket HMAC si `PHONE_FILL_SECRET` est absent. La CI
> utilise un secret nommé `DATABASE_URL` pour ses propres variables
> d'environnement : c'est le nom du secret GitHub, pas celui que le code attend.

## Scripts utiles

```bash
npm run dev                # Turbopack dev server :3000
npm run build              # build production + copie standalone
npm run start              # serveur de production
npm run typecheck          # tsc --noEmit
npm run lint               # ESLint
npm run check:i18n         # parité fr/en
npm run check:test-wiring  # tests/*.cjs branchés dans package.json
npm run validate           # typecheck + lint + check:test-wiring + test:unit
npm run db:generate        # prisma generate
npm run db:migrate         # prisma migrate dev
npm run seed:workshops     # npx tsx scripts/seed-workshops.ts
npm run roadmap            # état des tâches d'audit
```

## Dépannage courant

| Problème | Commande |
|----------|----------|
| Types Prisma obsolètes | `npm run db:generate` |
| Client Prisma absent après install | `npx prisma generate` (`postinstall` le fait déjà) |
| DB schema drift | `npx prisma migrate dev` |
| Node modules corrompus | supprimer `node_modules`, puis `npm ci` |
| Un test n'est jamais exécuté | `npm run check:test-wiring` |
| Clé i18n introuvable / parité cassée | `npm run check:i18n` |

## Ressources

- [Next.js 16 Docs](https://nextjs.org/docs)
- [next-intl Docs](https://next-intl-docs.vercel.app/)
- [Better Auth Docs](https://www.better-auth.com/docs)
- [Tailwind CSS v4](https://tailwindcss.com/docs)
- [Prisma ORM](https://www.prisma.io/docs)
- [Playwright](https://playwright.dev/)