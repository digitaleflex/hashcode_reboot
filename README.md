# HASHCODE REBOOT

Plateforme d'onboarding communautaire HASHCODE : landing → profiling guidé →
carte de profil générée → branchement (accès WhatsApp immédiat ou invitation
manuelle) → dashboard admin. Construit pour être déployé sur **Vercel** avec
**Neon Postgres**.

## Stack

- **Next.js 16** (App Router) + TypeScript + Tailwind CSS 4 + shadcn/ui
- **Prisma 6** + **Neon Postgres** (URL poolée + directe)
- **Resend** (emails transactionnels, API HTTP directe, sans SDK)
- Zustand, TanStack Query/Table, Zod
- **nextjs-toploader** (barre de progression lime)
- Package manager : **npm** (lockfile `package-lock.json`)

## Démarrage rapide

Prérequis : Node 22 (version de la CI), un projet Neon (branche `dev`
recommandée pour le local).

```bash
npm ci
cp .env.example .env   # puis renseigner les valeurs (voir ci-dessous)
npx prisma migrate dev --name init   # première fois seulement
npm run dev            # http://localhost:3000
```

> **npm fait seul foi.** `.github/workflows/ci.yml` fait `npm ci` et c'est
> elle qui décide si le dépôt est vert. Un `bun.lock` traîne encore à la racine :
> il n'est ni lu par la CI ni par Vercel, et il diverge de
> `package-lock.json` sur 56 paquets transitifs. Il faut le supprimer
> (cf. D15 dans `docs/ROADMAP-SUR-INGENIERIE-2026.md`), pas le maintenir.

## Variables d'environnement

Voir `.env.example` (jamais de secret commité — `.env` est ignoré).
Noms lus par le code, dans l'ordre d'importance :

| Variable | Usage |
|---|---|
| `POSTGRES_PRISMA_URL` | Connexion poolée (runtime, fournie par l'intégration Vercel-Neon) |
| `POSTGRES_URL_NON_POOLING` | Connexion directe (migrations CLI) |
| `ADMIN_OPERATORS` | Emails admin (accès complet), séparés par des virgules. **Requis** : liste vide = aucun admin |
| `ADMIN_VIEWERS` | Emails admin en lecture seule, séparés par des virgules |
| `NEXT_PUBLIC_WHATSAPP_URL` | Lien communauté WhatsApp côté client (requis, aucune valeur en dur) |
| `WHATSAPP_URL` | Idem, côté serveur (prioritaire sur la précédente, aucune valeur en dur) |
| `RESEND_API_KEY` / `EMAIL_FROM` | Envoi + vérification Resend |
| `BREVO_FALLBACK_ON_429` | `=1` pour activer le fallback Brevo quand Resend retourne 429 |
| `SENTRY_DSN` | DSN Sentry côté serveur (optionnel, monitoring erreurs) |
| `NEXT_PUBLIC_SENTRY_DSN` | DSN Sentry côté client (optionnel) |
| `CRON_SECRET` | Bearer du keepalive (`/api/cron/keepalive`), 32 octets hex |
| `PRISMA_LOG_QUERIES` | `=1` pour réactiver les logs `prisma:query` (silencieux par défaut) |
| `TESTING` | `=1` pour activer le guard anti-écriture (tests d'intégration uniquement) |

## Scripts

| Commande | Effet |
|---|---|
| `npm run dev` | Dev local `:3000` |
| `npm run build` | Build + copie standalone cross-platform |
| `npm run vercel-build` | `prisma generate && prisma migrate deploy && next build` (Vercel) |
| `npm run lint` | ESLint (doit rester vert) |
| `npm run typecheck` | `tsc --noEmit` (0 erreur attendue) |
| `npm run check:i18n` | Parité fr/en + placeholders ICU (`scripts/check-messages.mjs`) |
| `npm run check:test-wiring` | Vérifie que chaque `tests/*.cjs` est branché dans un script |
| `npm run validate` | `typecheck` + `lint` + `check:test-wiring` + `test:unit` |
| `npm run test:unit` | Tests unitaires — `node --test` + `tsx`, 24 fichiers `.cjs`. Comptage exact : `npm run test:unit` (lignes `# tests` / `# suites`) |
| `npm run test:integration` | Tests d'intégration read-only (base réelle, `TESTING=1`) |
| `npm run test:all` | `test:unit` **puis** `test:integration` — les deux dans l'ordre |
| `npm run test:e2e` | Playwright (job `e2e` de la CI) |
| `npm run db:generate` | Régénère le client Prisma |
| `npm run db:migrate` | `prisma migrate dev` (jamais en prod) |
| `npm run db:push` / `db:reset` | **Local uniquement** — destructeurs face à Neon |
| `npm run roadmap` | État des tâches d'audit (`scripts/task-tracker.mjs`) |

## Routes

- `/` — tout le parcours utilisateur (landing → profiling → profil →
  bienvenue/branches). `?admin=1` est un alias vers `/admin`.
- `/admin` — dashboard admin (connexion email + mot de passe, garde serveur).
- Pages publiques : `/evenements`, `/profile/[id]`, `/mentions-legales`,
  `/cgu`, `/confidentialite`, `/cookies`.
- Connexion : `/login`, `/verify-otp`, `/verify-email`.
- `/api/health` — public : `{ status: ok|degraded|down, checks: {db, mail,
  routes} }`, 200 sauf DB down → 503.
- API métier : `members` (GET liste admin / POST inscription),
  `members/[id]` (GET/PATCH/DELETE), `members/[id]/invite`, `members/[id]/share`
  (public, lien par id non devinable), `members/bulk`, `members/import` (CSV),
  `stats`, `stats/cohort`, `analytics`, `email-stats`,
  `export` (CSV), `export/json`, `community/count`, `community/join`,
  `verify-email` (lien magique 1-clic), `auth/session`, `auth/logout`,
  `auth/[...betterAuth]` (Better Auth : email-otp, sign-in),
  `account/me`, `account/profile`, `account/phone` (POST public, remplissage
  unique WhatsApp post-inscription), `account/complete-profile`,
  `account/export` (RGPD), `invite/relance`,
  `events` (GET mixte / POST operator), `events/[id]` (GET/PATCH/DELETE),
  `events/[id]/rsvp` (POST/DELETE membre), `events/notify-count` (GET admin,
  compteur pré-envoi notification), `public/events`,
  `profiling/draft` (brouillons anti-abandon),
  `workshops` (`[slug]`, `[slug]/enroll`, `quizzes/[id]/attempts`,
  `sessions/[id]/submissions`),
  `admin/login|logout|verify|activity|activity-logins|audit-log|dashboard|cron-health|blacklist|blacklist/[id]|test-email|announce-dashboard|invitations|import-invite|member-emails|email-log|email-ops|email-deliverability|email-templates|email-templates/[key]|email-templates/preview|mentoring`,
  `admin/workshops` (`sessions/[id]`, `stats`, `submissions`,
  `submissions/[id]/review`),
  `webhooks/resend` (bounced/complained/suppressed → blacklist, engagement → analytics),
  `webhooks/brevo`, `cron/relance` (drafts >24h, lot 50),
  `cron/keepalive` (`SELECT 1` Neon), `cron/collect-metrics`,
  `cron/email-alerts`, `cron/event-reminders`.

Conventions : erreurs FR (`{ error }`), 400/401/403/404/422/429/503, `Retry-After`
sur 429, exports plafonnés à 2000 lignes (`X-Export-Truncated`).

> Les routes `auth/request-magic-link` et `auth/verify-otp` n'existent plus
> (dossiers vides) : le parcours OTP passe par le plugin `email-otp` de Better
> Auth sous `auth/[...betterAuth]`. `admin/keys` a été supprimé avec la
> rotation des clés.

## Admin

Connexion **email + mot de passe** (Better Auth) via `/?admin=1`, puis cookie de
session `better-auth.session_token` HttpOnly. Accès déterminé par les listes
blanches `ADMIN_OPERATORS` (accès complet) et `ADMIN_VIEWERS` (lecture seule),
fail-closed : liste vide = aucun admin. Rôles `viewer`/`operator` (operator
seul en écriture) + CSRF same-origin sur les mutations. Le garde est
`requireAdmin(req, role)` (`src/lib/admin-auth.ts`) : `unauthenticated` → 401
`AUTH_REQUIRED`, `insufficient_role` → 403 `FORBIDDEN`. Fonctionnalités : stats
(+ cohorte, funnel, engagement email), recherche, filtres cliquables, notes
internes, actions groupées (valider/inviter/waitlist/rejeter/supprimer),
invitation (message copiable), import CSV, export CSV/JSON filtré (audité),
blacklist (manuelle + auto via webhooks Resend/Brevo et soft-delete),
supervision emails (`email-log`, `email-ops`, `email-deliverability`,
`email-templates`), mentoring, journal d'audit
(`audit-log`, sidebar « Audit »), journal d'activité temps réel, pilotage
agenda (CRUD événements + renotification), annonce dashboard par lots,
envoi d'emails de test (welcome/invitation), validation partagée des events
(`lib/events-validation.ts`), audit trail (`event.create/update/delete/notify`).

## Mails (Resend primaire + Brevo fallback)

`src/lib/mail.ts` — 14 wrappers `send*` (welcome, invitation WhatsApp,
waitlist, engagement, vérification 1-clic 24 h, relance abandon 24 h+, OTP
connexion 15 min, changement de statut, invitation dashboard 72 h,
réadhésion, relance invitation, notification bounce admin, notification
événement, rappel événement), coquille commune (table 600 px, CSS inline,
préheader). Chaque wrapper déclare une `semanticCategory` validée par
`src/lib/email-categories.ts` — la catégorie n'est plus déduite du sujet
(verrouillé par `tests/email-categories.test.cjs`). `sendEmail` ne lève jamais,
timeout 8 s, routage par catégorie (`transactional`/`notification`/`code` →
Resend, `marketing` → Brevo) avec fallback croisé sur 429
(`BREVO_FALLBACK_ON_429`). `POST /api/admin/test-email` (operator, Zod) pour
tester. `POST /api/webhooks/resend` : bounces/complaints/suppressions →
blacklist + `EmailEvent`, delivered/opened/clicked → analytics.
`POST /api/webhooks/brevo` traite les équivalents Brevo. `GET /api/health`
vérifie la clé Resend via `GET /domains` (cache 30 min).

## Espace membre

Connexion par OTP 6 chiffres via le plugin `email-otp` de Better Auth
(`/login` → `/verify-otp`, `expiresIn: 900` s = 15 min, anti-énumération) ou
par lien magique 1-clic dans le même email. Session **Better Auth**, cookie
`better-auth.session_token` HttpOnly, `expiresIn` 30 j, `updateAge` 1 h
(sliding window) + `cookieCache` 1 h. Le nom du cookie est recopié en dur
dans 3 fichiers (`src/proxy.ts`, `src/app/api/account/route.ts`,
`src/app/api/auth/logout/route.ts`) : `src/proxy.ts` s'exécute en Edge et ne
doit pas tirer de module serveur. Pages : `/account`, `/dashboard`,
`/dashboard/agenda`, `/dashboard/profile`, `/dashboard/profile-complet`,
`/dashboard/settings`, `/dashboard/mentoring`, `/dashboard/ateliers/**`.
Voir `docs/espace-membre.md` et `docs/interface-utilisateur.md`.
Validation réelle via `getSession()` (`src/lib/account-auth.ts`) dans les API
routes. Guard `TESTING=1` sur les routes d'écriture (`src/lib/test-guard.ts`).

> `src/lib/account-otp.ts`, la table `MemberSession` comme source de session et
> le cookie `hashcode_session` n'existent plus : la session membre est celle de
> Better Auth. `MemberSession` a elle aussi été supprimée (D36) : c'était un
> doublon sans aucun écrivain applicatif, dont les deux lecteurs
> (`admin/activity-logins`, `account/export`) lisaient une table vide — le DAU
> admin valait donc toujours 0 et l'export RGPD renvoyait `sessions: []`. Les
> deux lisent désormais `Session`, le vrai magasin. `AdminKey` et `RateLimit`
> ont également disparu, sans lecteur ni écrivain.

## Santé & keepalive Neon

Neon (offre gratuite) suspend le compute après 5 min d'inactivité — n'importe
quelle requête le réveille. Le plan **Hobby Vercel interdit les crons < 1/jour**,
donc le keepalive passe par un cron **externe** :

1. `CRON_SECRET` dans `.env` + dashboard Vercel (Production/Preview/Development).
2. Job gratuit **cron-job.org** : toutes les 4 min,
   `GET https://<app>.vercel.app/api/cron/keepalive` avec
   `Authorization: Bearer <CRON_SECRET>`.
3. Au boot, `src/instrumentation.ts` loggue l'état DB/mails/routes (console
   uniquement, ne bloque jamais).

⚠️ Pinger toutes les 4 min ≈ compute toujours allumé ≈ ~180 CU-h/mois, au-delà
des ~100 CU-h gratuites → suspension au quota. Alternative acceptée : vivre
avec les cold starts (~1 s au réveil).

## Déploiement Vercel

1. Lier le projet à l'intégration Neon (injecte `POSTGRES_*` tout seul).
2. Renseigner `ADMIN_OPERATORS` + `CRON_SECRET` dans les vars du projet.
3. Push sur `main` : `vercel-build` migre (`migrate deploy`) puis build.
4. Créer le job cron-job.org (section précédente).

## UX & Loading

Barre de progression **nextjs-toploader** (lime `#C5F441`) dans `layout.tsx`.
Fallbacks de chargement : `loading.tsx` global (racine), dashboard et admin
(squelettes animés). Le `ProfilingFlow` utilise un fallback spinner dynamique
(`dynamic(..., { ssr: false })`). Le bouton WhatsApp est **facultatif** pendant
le profiling — un bandeau post-conversion sur l'écran de résultat propose de
remplir le numéro (remplissage unique, via `POST /api/account/phone`).

## Sécurité des tests

**Problème résolu :** les tests d'intégration tournent contre la base de
production (pas de base dev séparée). Pour éviter la pollution :

1. **`src/lib/test-guard.ts`** — guard `blockIfTesting()` dans **25 fichiers
   de route** d'écriture (POST/PATCH/DELETE). Retourne 403 quand `TESTING=1`.
2. **Tests intégration read-only** — aucun POST ne crée de données en base.
   Seuls les GET/verify/logout sont testés.
3. **Usage :** `TESTING=1 npm run test:integration`

Fichiers protégés (liste exhaustive, vérifiée par grep) : `account/route`,
`account/complete-profile`, `account/phone`, `account/profile`,
`admin/announce-dashboard`, `admin/email-templates` (+ `[key]`),
`admin/import-invite`, `admin/mentoring/assign`, `admin/mentoring/contacted`,
`admin/test-email`, `admin/workshops/sessions/[id]`, `analytics`,
`events/route`, `events/[id]`, `events/[id]/rsvp`, `invite/relance`,
`members/route`, `members/[id]`, `members/[id]/invite`, `members/bulk`,
`members/import`, `workshops/[slug]/enroll`, `workshops/quizzes/[id]/attempts`,
`workshops/sessions/[id]/submissions`.

## Limites connues (V1)

- L'identité admin repose sur deux listes blanches d'emails
  (`ADMIN_OPERATORS` / `ADMIN_VIEWERS`) : pas de comptes nominatifs gérés.
- Rate-limit Upstash Redis + fallback mémoire (par isolate en dégradé).
- Exports plafonnés (2000 lignes, `X-Export-Truncated`), sans streaming.
- Notifications événement : email uniquement, ciblage domaine/niveau
  (via `notifyWhere`), compteur pré-envoi, audit trail, sans retry auto.
- Analytics fire-and-forget, sans retry client.
- `reactStrictMode: true`, `typescript.ignoreBuildErrors: false` — le build
  casse sur erreur de type (ESLint + `tsc --noEmit` font foi).

## Structure

```
src/app/            layout racine + [locale]/ (toutes les pages : /, /login,
                    /verify-otp, /verify-email, /profile/[id], /evenements,
                    /account, /dashboard/*, /admin/*, pages légales)
                    + api/ (routes non localisées)
                    + loading.tsx (dashboard et admin ; pas de loading racine)
src/proxy.ts        auth + i18n (convention Next 16, ex-middleware.ts)
src/i18n/           routing.ts (localePrefix as-needed, localeDetection false),
                    request.ts
src/components/     brand/ (logo SVG), reboot/ (landing, profiling-flow,
                    welcome, profile, admin/*), ui/ (shadcn, 13 composants)
src/lib/            db, admin-auth (requireAdmin + adminGuardError), admin-audit,
                    account-auth (pont Better Auth), account-data, account-rgpd,
                    auth/ (config Better Auth + emailOTP), blacklist, mail
                    (Resend+Brevo + email-categories), rate-limit (Redis+mémoire),
                    rate-limit-key, verify-email, analytics, health, logging,
                    profiling/, events-validation, test-guard (blockIfTesting),
                    errors, body-limit, legal-content, storage-crypto, sentry,
                    workshop-* (validation/progression/quiz/server/emails)
prisma/             schema.prisma (Postgres Neon, 32 modèles) + migrations/
scripts/            copy-standalone.mjs, task-tracker.mjs, check-messages.mjs,
                    check-test-wiring.mjs, verify-d01.mjs, analyze-i18n.mjs,
                    seed-*.ts, collect-email-metrics.ts
tests/              24 fichiers .cjs — test:unit enchaîne 23 d'entre eux
                    (integration.test.cjs est séparé, read-only, safe pour la
                    base prod), e2e/ = 5 specs Playwright
```
