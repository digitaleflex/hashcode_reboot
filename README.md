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
  (public, lien par id non devinable), `members/bulk`, `stats`, `analytics`,
  `export` (CSV), `export/json`, `check-email`, `community/count`,
  `admin/login|logout|verify|activity`, `admin/test-email`.

Conventions : erreurs FR (`{ error }`), 400/401/404/422/429/503, `Retry-After`
sur 429, exports plafonnés à 2000 lignes (`X-Export-Truncated`).

## Admin

Passcode (`ADMIN_PASSCODE`) → cookie `hashcode-admin` HttpOnly 7 jours
(`Secure` en prod). Fonctionnalités : stats, funnel, donut domaines, recherche,
filtres cliquables, notes internes, actions groupées (valider/inviter/waitlist/
rejeter/supprimer), invitation (message copiable), export CSV/JSON filtré,
journal d'activité, envoi d'emails de test (welcome/invitation).

## Mails (Resend)

`src/lib/mail.ts` — `sendWelcomeEmail` / `sendInvitationEmail` (fetch direct,
timeouts, ne lève jamais, aucun secret logué). `POST /api/admin/test-email`
(admin-only, Zod) pour tester. `GET /api/health` vérifie la clé via
`GET /domains` (cache 30 min).

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

- Auth admin = passcode partagé (pas de comptes/roles) — migrer vers
  NextAuth + rôles avant exposition large.
- Rate-limit en mémoire (par isolate) — passer sur KV/Upstash à l'échelle.
- Analytics fire-and-forget, sans retry client.
- Partage de profil rendu côté client (pas de SSR `/share/:id` pour les
  aperçus OG).
- TypeScript : erreurs pré-existantes tolérées au build
  (`ignoreBuildErrors`) — ESLint fait foi.

## Structure

```
src/app/            pages (/, /admin) + routes /api/*
src/components/     brand/ (logo SVG), reboot/ (landing, profiling, admin), ui/ (shadcn)
src/lib/            db, admin-auth, health, mail, rate-limit, analytics, profiling/
prisma/             schema.prisma + migrations/
scripts/            copy-standalone.mjs (postbuild cross-platform)
```
