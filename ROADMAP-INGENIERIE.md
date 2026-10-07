# 🗺️ Roadmap d'Ingénierie — hashcode_reboot

> Généré le 2026-10-07 par analyse statique du codebase (4 lanes : architecture, sécurité/auth, DB/performance, over-engineering).
> Ce document est vivant :mettre à jour au fur et à mesure des corrections.

## Comment utiliser cette fiche

- **Statut** : `todo` → `in-progress` → `done` → `verified`
- **Priorité** : P0 (bloquant), P1 (haute), P2 (harden), Perf (performance), Struct (dette structurelle)
- **Effort** : S (petit, <1h), M (demi-journée), L (1-2j), XL (>2j)
- Quand une correction est faite, mettre à jour `statut`, `mis-à-jour`, et ajouter une ligne au changelog en bas.

## Phase 0 —urgence (P0) — sécurité bloquante

| Id | Problème | Fichier:ligne | Impact | Fix suggérée | Statut | Owner | Effort | Créé | Mis-à-jour |
|----|----------|---------------|--------|--------------|--------|-------|--------|------|------------|
| P0-1 | Token d'invitation jamais vérifié — `querySchema` capture `{email,token}` mais la logique ne compare pas le token stocké ; un inconnu peut accepter une invitation et déclencher `requestSignInOtp` | `app/api/invite/accept/route.ts:49-86` | Bypass auth / escalation | Désactiver les routes publiques mortes (accept/refuse) et retirer le système de jeton à moitié construit | done | | L | 2026-10-07 | 2026-10-07 |
| P0-2 | Aucun rate-limit sur surface OTP Better Auth (`/api/auth/[...betterAuth]`) + `requestSignInOtp` best-effort non limité (appelé depuis invite/accept) | `app/api/auth/[...betterAuth]/route.ts:1-6`, `lib/auth/index.ts:8-21` | Brute-force / oracle d'email | Ajouter rate-limit sur les routes OTP (sign-in et verification) | done | | M | 2026-10-07 | 2026-10-07 |
| P0-3 | Enumération publique de profils membres sans rate-limit (`profile/[id]`) — la twin `members/[id]/share` en a une, pas celle-ci | `app/api/profile/[id]/route.ts:4-51` | Scraping PII massif | Ajouter limiter `share:` (30/10min) | done | | S | 2026-10-07 | 2026-10-07 |
| P0-4 | Tous les rate-limits contournables par spoof `X-Forwarded-For` — `rate-limit-key.ts` lit `XFF` sans validation proxy de confiance | `lib/rate-limit-key.ts:4-13` | Contournement complet des limits | Utiliser `x-real-ip` depuis LB de confiance, ou key par `IP+memberId/email` | done | | M | 2026-10-07 | 2026-10-07 |

## Phase 1 — Haute priorité (P1)

| Id | Problème | Fichier:ligne | Impact | Fix suggérée | Statut | Owner | Effort | Créé | Mis-à-jour |
|----|----------|---------------|--------|--------------|--------|-------|--------|------|------------|
| P1-1 | CSRF absent sur PATCH/DELETE admin & membres | `app/api/members/[id]/route.ts:70-196` | CSRF state-changing | Ajouter `checkCSRF()` à toutes les routes mutating admin/member | done | | L | 2026-10-07 | 2026-10-07 |
| P1-2 | Cookie Edge proxy mal nommé en prod (`better-auth.session_token` vs `__Secure-better-auth.session_token`) | `proxy.ts:38`, `lib/auth/index.ts:91` | 401 auth disponibles en prod | Lire cookie name depuis config auth ou vérifier les deux noms | done | | M | 2026-10-07 | 2026-10-07 |
| P1-3 | Sentry exfiltre OTP/PII (`includeLocalVariables: true`, `beforeSend` incomplete) | `sentry.server.config.ts:16`, `sentry.edge.config.ts:29-54` | Fuite OTP/email/url en clair | `includeLocalVariables: false` + étendre `beforeSend` (URL, query, `code`, `email`, `phone`) | done | | M | 2026-10-07 | 2026-10-07 |
| P1-4 | Clé HMAC réutilisant `DATABASE_URL` | `lib/phone-fill-ticket.ts:35-40` | Forge tickets `hc_phone_fill` | Exiger `PHONE_FILL_SECRET` en prod, fail closed si absent | done | | S | 2026-10-07 | 2026-10-07 |

## Phase 2 — Harden (P2)

| Id | Problème | Fichier:ligne | Impact | Fix suggérée | Statut | Owner | Effort | Créé | Mis-à-jour |
|----|----------|---------------|--------|--------------|--------|-------|--------|------|------------|
| P2-1 | Lecture admin trop large — `viewer` reçoit la ligne complète (email, phone, adminNote) | `app/api/members/[id]/route.ts:41-63` | Sur-exposition PII | Projecter subset nécessaire au rôle | done | | M | 2026-10-07 | 2026-10-07 |
| P2-2 | Audit delete sans `actor` (suppression non imputable) | `app/api/members/[id]/route.ts:248` | Perte de traçabilité | Ajouter `actor: {type:"admin",role}` | done | | S | 2026-10-07 | 2026-10-07 |
| P2-3 | Boucle replay token `verify-email` — `get→del→set` non atomiques | `lib/verify-email.ts:158-187` | Replay théorique (faible) | Lua `GETDEL` / transaction | done | | M | 2026-10-07 | 2026-10-07 |
| P2-4 | Rôles fallback à `operator` au lieu de `unknown` (inflation) | multiples (`events/route:272`, …) | Attributions erronées | Fail-closed `unknown` | done | | S | 2026-10-07 | 2026-10-07 |

## Phase 3 — Performance / DB (risques opérationnels)

| Id | Problème | Fichier:ligne | Impact | Fix suggérée | Statut | Owner | Effort | Créé | Mis-à-jour |
|----|----------|---------------|--------|--------------|--------|-------|--------|------|------------|
| Perf-1 | Cron event-reminders : N+1 + full-table scan Member × offsets, writes séquentielles, idempotence P2002 sous overlap | `app/api/cron/event-reminders/route.ts:81-181` | DB saturée, emails doublés | Index composite `(status, notifiedAt, startsAt)` + `(profileStatus, deletedAt)`, advisory lock, batch `createMany` | done | | XL | 2026-10-07 | 2026-10-07 |
| Perf-2 | Cron relance : scan limité à 50 rows → travaux J+7 ignorés si backlog | `app/api/cron/relance/route.ts:38-60` | Travaux J+7 non traités | Filtrer SQL `createdAt <= now() - 7d` + index composite | done | | M | 2026-10-07 | 2026-10-07 |
| Perf-3 | Workshops : chargements sériels `for (w of published) await loadWorkshopForMember(...)` + cache TODO jamais implémenté | `app/api/workshops/route.ts:44-45`, `lib/workshop-server.ts:74-77` | Régression O(W×3) | `Promise.all` + `unstable_cache`/Redis TTL | todo | | L | 2026-10-07 | |
| Perf-4 | Dashboard admin : 20k lignes en mémoire, filtrage JS ×3 | `app/api/admin/dashboard/route.ts:182-186` | Payload massif + CPU | Pagination + agrégation SQL | todo | | L | 2026-10-07 | |
| Perf-5 | Budget email : counts redondants (getAllBudgets appelle getBudget ×2), pas de cache | `lib/email-budget.ts:154-159` | Requêtes ×n par offset | Cache 30s + index composite `(type, provider, createdAt)` | todo | | M | 2026-10-07 | |
| Perf-6 | email-alerts : second PrismaClient (double pool pgbouncer) | `lib/email-alerts.ts:11` | Pression connexions | Singleton via `db.ts` | done | | S | 2026-10-07 | 2026-10-07 |
| Perf-7 | Zéro `withPrismaRetry` utilisé (définition `lib/prisma-extensions.ts:120` inerte) | `lib/prisma-extensions.ts:120` | `P2024` pool exhaustion sans rebouclage | Activer sur les crons + dashboard 20-way parallel | done | | M | 2026-10-07 | 2026-10-07 |
| Perf-8 | Aucun lock distribué sur les crons → doubles envois sur ticks chevauchants | `app/api/cron/*` | Emails en double | Advisory lock pg + `schedule` décalé | done | | L | 2026-10-07 | 2026-10-07 |

## Phase 4 — Structure / Sur-ingénierie (dette technique)

| Id | Problème | Fichier(s) | Impact | Fix suggérée | Statut | Owner | Effort | Créé | Mis-à-jour |
|----|----------|------------|--------|--------------|--------|-------|--------|------|------------|
| Struct-1 | God-module `mail.ts` (1546L) : transport + 10+ builders + tracking DB + budget | `lib/mail.ts` | Maintenance impossible | Extraire `lib/email/{transport,templates/*.ts}`, supprimer doublon DB-active vs code | done | | XL | 2026-10-07 | 2026-10-07 |
| Struct-2 | Auth fragmentée en 4 couches avec même pattern `getSession + findUnique(email)` copié 4× | `lib/auth/index`, `account-auth`, `admin-auth`, `auth-ui` | Duplication logique, drift | `requireSession(req)` unique + `admin-auth` wrapper 10 lignes | done | | L | 2026-10-07 | 2026-10-07 |
| Struct-3 | 84 API routes non consolidés (admin/email 6 routes pour 1 concept, mentoring 6→2) | `app/api/admin/*`, `mentoring/*` | Surface d'attaque gonflée | Collapse mentoring→1 resource, email-ops→1, invites→1 | done | | XL | 2026-10-07 | 2026-10-07 |
| Struct-4 | Domaine workshop/event découpé en ~10 lib files + UI dupliquée | `workshop-{validation,server,quiz,progression,emails}` | Cohérence risquée | `lib/workshops/{validation,service,emails}.ts` (3f max) | done | | L | 2026-10-07 | 2026-10-07 |
| Struct-5 | Fallback KV réimplémenté 3× (`rate-limit`, `verify-email`, `logging`) | 3 files | Incohérence bug-prone | Un `lib/kv.ts` (`getKv()`, `withMemoryFallback()`), supprimer `rate-limit-key.ts` | done | | M | 2026-10-07 | 2026-10-07 |
| Struct-6 | 4 systèmes d'agents configurés + `.env` sprawl (6 files, dont `.env.neon-backup`) | `.claude`, `.codex`, `.agents`, `.slim`, `.env*` | Confusion, fuite potentielle | Garder `.env.example` + local `.env` (gitignored) ; choisir 1 système agents ; gitignore `.slim/` | done | | M | 2026-10-07 | 2026-10-07 |
| Struct-7 | `tests/*.test.cjs` duplique `lib/` (nommage dérivé → rupture de synchro) + scripts/root vs `src/lib` | `tests/`, `scripts/` | Tests deviennent inutiles | Adopter vitest ou accepter la dette ; fusionner scripts/imports en `scripts/migrate.ts` | done | | L | 2026-10-07 | 2026-10-07 |

## Evidence & sources (lanes d'analyse)

- Architecture / over-engineering : `ora-1` (oracle)
- Sécurité / auth : `fix-1` (fixer) — 11 findings P0→P2
- DB / performance : `fix-2` (fixer) — 8 risques Perf
- Carte structurelle : `exp-1` (explorer)

## Changelog

| Date | Auteur | Changement |
|------|--------|------------|
| 2026-10-07 | orchestrator | Création — analyse 4 lanes, 27 items priorisés P0→Struct |
| 2026-10-07 | orchestrator | Merge P0-P2 security hardening from worktree omos/p0-security (commit 3ef4a8d) |