# HASHCODE REBOOT

Plateforme d'onboarding communautaire HASHCODE : landing → profiling guidé →
carte de profil générée → branchement (accès WhatsApp immédiat ou invitation
manuelle) → dashboard admin. Construit pour être déployé sur **Vercel** avec
**Neon Postgres**.

## Stack

- **Next.js 16** (App Router) + TypeScript + Tailwind CSS 4 + shadcn/ui
- **Prisma 6** + **Neon Postgres** (URL poolée + directe)
- **Resend** (emails transactionnels, API HTTP directe, sans SDK)
- Zustand, TanStack Query/Table, react-hook-form + Zod
- Package manager : **Bun** (lockfile `bun.lock`)

## Démarrage rapide

Prérequis : Bun 1.x (ou Node 20+), un projet Neon (branche `dev`
recommandée pour le local).

```bash
bun install
cp .env.example .env   # puis renseigner les valeurs (voir ci-dessous)
bunx prisma migrate dev --name init   # première fois seulement
bun run dev            # http://localhost:3000
```

## Variables d'environnement

Voir `.env.example` (jamais de secret commité — `.env` est ignoré).
Noms lus par le code, dans l'ordre d'importance :

| Variable | Usage |
|---|---|
| `POSTGRES_PRISMA_URL` | Connexion poolée (runtime, fournie par l'intégration Vercel-Neon) |
| `POSTGRES_URL_NON_POOLING` | Connexion directe (migrations CLI) |
| `ADMIN_PASSCODE` | Passcode admin. **Requis en production** (l'app refuse de démarrer sans) |
| `NEXT_PUBLIC_WHATSAPP_URL` | Lien communauté côté client (fallback : valeur en dur) |
| `WHATSAPP_URL` | Idem, côté serveur (prioritaire sur la précédente) |
| `RESEND_API_KEY` / `EMAIL_FROM` | Envoi + vérification Resend |
| `CRON_SECRET` | Bearer du keepalive (`/api/cron/keepalive`), 32 octets hex |
| `PRISMA_LOG_QUERIES` | `=1` pour réactiver les logs `prisma:query` (silencieux par défaut) |

## Scripts

| Commande | Effet |
|---|---|
| `bun run dev` | Dev local `:3000` |
| `bun run build` | Build + copie standalone cross-platform |
| `bun run vercel-build` | `prisma generate && prisma migrate deploy && next build` (Vercel) |
| `bun run lint` | ESLint (doit rester vert) |
| `bun run db:generate` | Régénère le client Prisma |
| `bun run db:migrate` | `prisma migrate dev` (jamais en prod) |
| `bun run db:push` / `db:reset` | **Local uniquement** — destructeurs face à Neon |

## Routes

- `/` — tout le parcours utilisateur (landing → profiling → profil →
  bienvenue/branches). Admin intégrable via `?admin=1`.
- `/admin` — dashboard admin (login passcode, même garde que `?admin=1`).
- `/api/health` — public : `{ status: ok|degraded|down, checks: {db, mail,
  routes} }`, 200 sauf DB down → 503.
- `/api/cron/keepalive` — `SELECT 1` Neon, protégé par `CRON_SECRET`.
- API métier : `members` (GET liste admin / POST inscription),
  `members/[id]` (GET/PATCH/DELETE), `members/[id]/invite`, `members/[id]/share`
  (public, lien par id non devinable), `members/bulk`, `members/import` (CSV),
  `stats`, `stats/cohort`, `analytics`, `email-stats`,
  `export` (CSV), `export/json`, `check-email`, `community/count`,
  `verify-email` (lien magique 1-clic), `auth/request-magic-link|verify-otp|logout`,
  `account/me`, `account/profile`, `events` (GET mixte / POST operator),
  `events/[id]` (GET/PATCH/DELETE), `events/[id]/rsvp` (POST/DELETE membre),
  `profiling/draft` (brouillons anti-abandon),
  `admin/login|logout|verify|activity|audit-log|keys|blacklist|test-email|announce-dashboard`,
  `webhooks/resend` (bounced/complained/suppressed → blacklist, engagement → analytics),
  `cron/relance` (drafts >24h, lot 50), `cron/keepalive` (`SELECT 1` Neon).

Conventions : erreurs FR (`{ error }`), 400/401/404/422/429/503, `Retry-After`
sur 429, exports plafonnés à 2000 lignes (`X-Export-Truncated`).

## Admin

Passcode (`ADMIN_PASSCODE`, ≥16 caractères requis en prod, fail-closed au boot)
→ cookie `hashcode-admin` HttpOnly 12h (`Secure` en prod, `SameSite=Lax`).
Rôles `viewer`/`operator` (operator seul en écriture) + CSRF same-origin sur
les mutations. Fonctionnalités : stats (+cohorte, funnel, engagement email),
recherche, filtres cliquables, notes internes, actions groupées
(valider/inviter/waitlist/rejeter/supprimer), invitation (message copiable),
import CSV, export CSV/JSON filtré (audité), blacklist (manuelle + auto via
webhooks Resend et soft-delete), rotation des clés (`keys`), journal d'audit
(`audit-log`, sidebar « Audit »), journal d'activité temps réel, pilotage
agenda (CRUD événements + renotification), annonce dashboard par lots,
envoi d'emails de test (welcome/invitation).

## Mails (Resend primaire + Brevo fallback)

`src/lib/mail.ts` — 11 templates (welcome, invitation WhatsApp, waitlist,
engagement, vérification 1-clic 24h, relance abandon 24h+, OTP connexion 15min,
changement de statut, invitation dashboard 72h, notification événement),
coquille commune (table 600px, CSS inline, préheader). `sendEmail` ne lève
jamais, timeout 8s, fallback Brevo sur 429 (opt-in `BREVO_FALLBACK_ON_429`).
`POST /api/admin/test-email` (operator, Zod) pour tester.
`POST /api/webhooks/resend` (signature Svix + anti-replay 5min, fail-closed
en prod) : bounces/complaints/suppressions → blacklist + `EmailEvent`,
delivered/opened/clicked → analytics. `GET /api/health` vérifie la clé via
`GET /domains` (cache 30 min).

## Espace membre

Connexion par OTP 6 chiffres (`/login` → `/verify-otp`, 3 essais max,
anti-énumération) ou lien magique 1-clic, session `hashcode_session` 30j
(sliding window, refresh DB >1h uniquement). Pages : `/account` (historique),
`/dashboard` (statut, profil, agenda), `/dashboard/agenda` (RSVP
going/maybe/cancelled, contrôle capacité), `/dashboard/profile` (vitrine +
partage public `/profile/[id]`), `/dashboard/settings` (coordonnées).
Middleware Edge : présence cookie seule, validation réelle via `getSession()`.

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
2. Renseigner `ADMIN_PASSCODE` + `CRON_SECRET` dans les vars du projet.
3. Push sur `main` : `vercel-build` migre (`migrate deploy`) puis build.
4. Créer le job cron-job.org (section précédente).

## Limites connues (V1)

- Auth admin = passcode partagé + rôles `viewer`/`operator` (pas de comptes
  nominatifs) — migrer vers NextAuth avant exposition large.
- Rate-limit Upstash Redis + fallback mémoire (par isolate en dégradé).
- Exports plafonnés (2000 lignes, `X-Export-Truncated`), sans streaming.
- Notifications événement : email uniquement, à tous les APPROVED (pas de
  ciblage domaine/niveau), sans retry auto.
- Analytics fire-and-forget, sans retry client.
- `reactStrictMode: true`, `typescript.ignoreBuildErrors: false` — le build
  casse sur erreur de type (ESLint + `tsc --noEmit` font foi).

## Structure

```
src/app/            pages (/, /login, /verify-otp, /verify-email, /profile/[id],
                    /account, /dashboard/*, /admin/*) + routes /api/*
src/components/     brand/ (logo SVG), reboot/ (landing, profiling-flow, welcome,
                    profile, admin/*), ui/ (shadcn)
src/lib/            db, admin-auth (+roles/CSRF), admin-audit, account-auth/otp/data,
                    blacklist, mail (Resend+Brevo), rate-limit (Redis+mémoire),
                    verify-email, analytics, health, logging, profiling/
prisma/             schema.prisma (Postgres Neon) + migrations/
scripts/            copy-standalone.mjs, test-email-services.mjs,
                    import-blacklist-from-soft-deleted.mjs
tests/              unit.test.cjs, magic-link.test.cjs, integration.test.cjs (node --test)
```
