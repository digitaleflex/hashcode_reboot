# RAPPORT PHASE 1 — AUDIT ATELIERS

> **Statut** : terminé · **Branche** : `development` · **HEAD à l'audit** : `79f3779` · **Date** : 2026-09-18
> **Méthode** : inspection read-only du dépôt (code = source de vérité). Aucun fichier modifié, aucune migration, aucun commit.
> **Suivi** : milestone [ATELIERS — Parcours pédagogique (MVP)](https://github.com/digitaleflex/hashcode_reboot/milestone/5) · plan ordonné dans l'issue [EPIC #97](https://github.com/digitaleflex/hashcode_reboot/issues/97).

---

## 1. Résumé exécutif

1. **[FACT]** La plateforme est un Next.js 16 App Router / React 19 / Prisma 6 / PostgreSQL (Neon), auth maison à deux mondes séparés : membres (magic-link OTP) et admin (passcode partagé HMAC + rôles).
2. **[FACT]** Le domaine « Atelier » n'existe pas : **aucun** modèle pédagogique (Workshop, Session, Submission, Quiz, Progress…). Zéro occurrence de `quiz|submission|enroll` dans `src/`.
3. **[FACT]** Le programme « Maîtrise GitHub — Bases » existe déjà… **sous forme de 12 `Event`** avec le contenu noyé dans `description` (`scripts/seed-github-program.ts`, commit `d73022c`). C'est un contenu, pas un parcours : pas de semaines, pas de livrables, pas de quiz, pas de progression.
4. **[FACT]** L'Event engine est complet et solide : POST/GET/PATCH/DELETE + RSVP + notify ciblé + notify-count + audit + rate-limit + CSRF + page publique `/evenements`. Le formulaire admin Event fonctionne (création, édition, statuts, renotification, suppression).
5. **[GAP]** Le contrat API du protocole §6 correspond au code réel à un détail près : `notify` n'est pas validé comme booléen strict (`notify !== false` → toute autre valeur déclenche l'envoi) — mineur.
6. **[FACT]** Les briques réutilisables sont nombreuses et propres : `getSession()`, `requireAdminRole()`, `checkCSRF()`, `rateLimit()`, `audit()`, `blockIfTesting()`, `bodyLimit()`, mail multi-provider, `EmailTemplate`, `AnalyticsEvent`, patterns de seed idempotent, patterns de tests.
7. **[RISK]** `main` et `development` ont **divergé** : 40 commits dans `development` absents de `main`, 29 dans `main` absents de `development` (merge-base `92ea6f4` du 2026-09-10). Main contient des prune knip + analytics Vercel que dev n'a pas ; dev contient tout le travail Events/email récent.
8. **[RISK]** Pas de DB de test : les tests d'écriture d'intégration ont été retirés volontairement (pollution prod). Le guard `TESTING=1` bloque les writes. Toute la stratégie de test Atelier devra en tenir compte.
9. **[RISK]** Les tests unitaires sont des **miroirs CJS** de la logique TS (dérive possible). C'est le pattern maison assumé (documenté en tête de `tests/event-validation.test.cjs`).
10. **[GAP]** Programme initial → le seed devra créer le modèle pédagogique **et lier** les 12 Events existants (`recurrenceId: github-bases-*` + titre `Maîtrise GitHub #N — …` servent de clé d'identité stable).
11. **[DECISION PROPOSÉE]** Progression **dérivée côté serveur** (fonction pure) plutôt que table `WorkshopProgress` : pas de dérive de donnée, testable, minimal. Enrollment stocké, le reste se calcule.
12. **[DECISION PROPOSÉE]** Admin v1 = **file de review des soumissions** + pilotage des ateliers ; l'édition complète de structure (semaines/séances/quiz) se fait via seed idempotent dans un premier temps, CMS admin ensuite (documenté en « remaining work »).

---

## 2. Branche et état du dépôt

| Élément | Constat |
|---|---|
| Branche courante | `development` [FACT] |
| HEAD à l'audit | `79f3779` — `fix(email): rend l'heure de l'événement dans le fuseau du destinataire` (2026-09-18 11:21) [FACT] |
| Sync origin | `origin/development..development` = 0 commit non poussé [FACT] |
| `main` | 29 commits absents de `development` ; merge-base `92ea6f4` (2026-09-10) [FACT] |
| Branches locales | `main`, `pr-54`, `security/admin-hardening`, `security/api-hardening`, `security/email-enum`, `security/rate-limit`, `ux/admin-frictions-50-53` [FACT] |

**Travail local non commité à l'audit — À PRÉSERVER (ne rien écraser)** [FACT] :

| Fichier | Nature |
|---|---|
| `prisma/schema.prisma` (+6) | Ajout `EmailEvent.provider` + index `[provider, createdAt]` |
| `prisma/migrations/20260918120000_add_email_event_provider/` (untracked) | Migration correspondante |
| `src/lib/mail.ts` (+17/−5) | Tracking provider resend/brevo dans `trackEmailSent` |
| `src/lib/use-member-session.ts` (untracked) | Hook client de sonde de session |
| `src/app/api/auth/session/route.ts` (untracked) | `GET /api/auth/session` (200 anonyme, jamais 401) |
| `src/app/login/page.tsx` (+21) | « Tu es déjà connecté » si session active |
| `src/components/reboot/landing.tsx` (+24/−6) | Landing session-aware |
| `src/lib/profiling/questions.ts` (−14), `types.ts`, `profiling-flow.tsx` | Retrait de la question `phone` du profilage |
| `.probe-session2.mjs` (untracked) | Sonde de test locale |

> **Mise à jour (2026-09-18, post-audit)** : le volet email (schema + migration + `mail.ts`) a été commité entre-temps (`1b4d207 feat(email): garde-fou de quota d'envoi et supervision temps réel`). Restent à committer : sonde de session membre + retrait de la question phone.

**[DECISION]** Avant toute migration Atelier : committer ce WIP (commits dédiés). La migration Atelier devra s'horodater après `20260918120000`. Le WIP ne touche aucun fichier Atelier → risque de conflit quasi nul.

---

## 3. Stack réelle

| Domaine | Techno | Preuve |
|---|---|---|
| Framework | Next.js `^16.1.1` App Router, React 19, React Compiler activé | `package.json`, `next.config.ts` |
| Langage | TypeScript 5 strict, alias `@/*` → `./src/*` | `tsconfig.json` |
| UI | Tailwind 4 + shadcn/ui (54 composants `src/components/ui/`) + Radix + lucide + framer-motion | `package.json`, `src/components/ui/` |
| ORM/DB | Prisma 6.11 → PostgreSQL (Neon), `POSTGRES_PRISMA_URL` + `POSTGRES_URL_NON_POOLING` | `prisma/schema.prisma` (provider `postgresql`), `.env.example` |
| Auth membre | Maison : magic-link OTP + `MemberSession` DB + cookie `hashcode_session` 30 j sliding | `src/lib/account-auth.ts`, `src/lib/account-otp.ts` |
| Auth admin | Maison : `ADMIN_PASSCODE` + token HMAC stateless + cookie `hashcode-admin` 12 h + rôles `viewer\|operator` | `src/lib/admin-auth.ts`, `src/lib/admin-roles.ts` |
| Validation | Validation manuelle + Zod (profilage) ; enums en **String + union TS**, listes en **JSON String** | `src/lib/events-validation.ts`, en-tête de `schema.prisma` |
| Data fetching | Server Components + fetch client ; TanStack Query côté admin uniquement | `src/app/providers.tsx`, hooks admin |
| Forms | react-hook-form + zod (profilage) ; formulaires admin = inputs Tailwind bruts + `fetchJson` | `src/components/reboot/profiling-flow.tsx`, `src/app/admin/events/page.tsx` |
| Notifications | Emails Resend (transactionnel) + Brevo (marketing), fallback croisés ; templates DB activables | `src/lib/mail.ts`, `src/lib/email-templates/` |
| Rate limit | Upstash Redis + fallback mémoire, `rateKey` par IP | `src/lib/rate-limit.ts` |
| Monitoring | Sentry (source maps + tunnel `/monitoring`), Speed Insights | `next.config.ts` |
| Tests | `node:test` (.cjs), 5 suites : unit, magic-link, event-validation, profiling, integration (read-only) | `tests/`, scripts `test:*` |
| Package manager | **npm** (`package-lock.json` à jour 11/09) ; `bun.lock` obsolète (07/09) [DEBT] | racine |
| Déploiement | Vercel — `vercel-build` = `prisma generate && prisma migrate deploy && next build` | `package.json` |
| CI | **Aucune** : pas de dossier `.github/` ; gate = `npm run validate` (typecheck+lint+test:unit) [GAP] | `package.json`, racine |

**Dépendances mortes** (présentes mais jamais importées dans `src/`) [RISK/DEBT] : `next-auth`, `next-intl`, `zustand`, `resend` (SDK — mail.ts utilise `fetch`), probablement d'autres (le prune knip existe sur `main`, pas sur `development`).

---

## 4. Architecture applicative

- **Routage** : App Router, une seule app `src/app`. Pages publiques : `/`, `/evenements`, `/login`, `/verify-otp`, `/profile/[id]`, `/sitemap.ts`. Espace membre : `/dashboard/*` (+ `/account` redirigé). Admin : `/admin/*`.
- **API** : `src/app/api/**` — convention `route.ts` avec `export const runtime = "nodejs"` quand accès DB. Deux familles : membre (`/api/account/*`, `/api/events*`) et admin (`/api/admin/*`), plus des routes publiques (`/api/public/events`, `/api/health`, `/api/community/count`).
- **Middleware** (`src/middleware.ts`) : Edge, vérifie **uniquement la présence du cookie** `hashcode_session` sur `/account/*`, `/dashboard/*`, `/api/account/*` → redirect `/login` ou 401. La vraie validation (`getSession`) se fait dans les layouts/route handlers [FACT].
- **Composants transverses** : `src/components/reboot/shared.tsx` (`RebootButton`, `MonoLabel`), `src/components/reboot/mobile-bottom-nav.tsx` (nav mobile membre **et** admin), `src/components/brand/logo.tsx`.
- **DB singleton** : `src/lib/db.ts` (PrismaClient, log opt-in). Extensions d'erreurs/retry : `src/lib/prisma-extensions.ts`. Soft-delete géré par convention `where: { deletedAt: null }`, pas par extension [FACT].
- **Documentation interne** : `docs/interface-utilisateur.md` (inventaire UI exhaustif + §14 anomalies), `docs/espace-membre.md`, `docs/plan-invitation.md`.

---

## 5. Architecture utilisateur (membre)

```
PUBLIC (anonyme)                MEMBRE CONNECTÉ (/dashboard/*)
/  landing                      /dashboard            Vue d'ensemble
/evenements  page publique      /dashboard/agenda     Agenda + RSVP
/profile/[id]  carte publique   /dashboard/profile    Vitrine + objectif
/login  /verify-otp             /dashboard/settings   Coordonnées + session
                                /dashboard/profile-complet (complétion)
/account → redirect settings
```

- **Layout** : `src/app/dashboard/layout.tsx` — garde `getSession()` + redirect, top bar, `DashboardSidebar` (desktop pliable + drawer mobile), `MobileBottomNav`.
- **Navigation** : `DashboardSidebar.NAV_ITEMS` = Vue d'ensemble, Agenda, Mon profil, Paramètres [FACT] — **point d'ajout « Ateliers »**. `MobileBottomNav.DASHBOARD_ITEMS` = Accueil, Agenda, Profil, Paramètres — à considérer pour l'ajout (4 items actuels).
- **Dashboard** : `WelcomeCard`, `StatusCard`, `ProfileSummary`, `NextSteps` (étapes par archétype — préfiguration naturelle d'une « prochaine étape Atelier »), `QuickActions`, `AgendaCard` (5 prochains events).
- **Agenda** : `src/app/dashboard/agenda/page.tsx` (client) — fetch `/api/events?limit=50&memberId=me`, groupage par date, filtres type/domaine, RSVP optimiste (**bug documenté** : `res.ok` non testé, doc §14.1).
- **États** : loading/error/empty présents dans l'agenda ; skeletons admin dans `src/components/reboot/admin/skeletons/`.

---

## 6. Architecture admin

- **Layout** : `src/app/admin/layout.tsx` (client) — header, `AdminSidebar`, `CommandPalette` (Ctrl+K), `SessionReminder`, `ChangePasscodeDialog`, `MobileBottomNav` (variante admin).
- **Navigation** : `AdminSidebar` — 12 sections : stats, members, invitations, marketing, email-deliverability, events, email-templates, activity, exports, blacklist, audit-log, settings [FACT]. Ajout Atelier = `NAV_ITEMS` + `SECTION_MAP`/`routeMap` (layout) + entrée palette + `ADMIN_ITEMS` mobile.
- **Pages** : ~15 pages `src/app/admin/*/page.tsx`. Patterns : page client + `fetchJson` (`src/components/reboot/admin/lib/fetchJson.ts`, gère 429 + Retry-After) + `useToast` + invalidation TanStack Query.
- **Formulaire de référence** : `src/app/admin/events/page.tsx` — champs contrôlés maison, conversion `datetime-local → ISO`, compteur pré-envoi `notify-count` débouncé 300 ms, feedback succès/erreur, reset partiel.
- **Liste de référence** : `AdminEventList.tsx` — actions statut (PATCH), renotify (PATCH `{notify:true}`), édition inline, suppression (DELETE) + toasts.
- **Philosophie admin constatée** : mutations = `requireAdminRole("operator")` + `checkCSRF` + rate-limit + `audit()` ; lecture = `requireAdminRole("viewer")`. C'est ce contrat que l'admin Atelier doit adopter.

---

## 7. Authentification

**Membre** [FACT] :
- OTP magic-link : `src/lib/account-otp.ts` (code 6 chiffres, hash bcrypt, 15 min, 3 essais), vérification `verify-otp`, puis `createSession()` → cookie `hashcode_session` httpOnly/SameSite=Lax/30 j, sliding window rafraîchie > 1 h.
- `getSession(req?)` : lit cookie → `MemberSession` → vérifie révocation, expiration, `otpHash=null`, `member.deletedAt` → retourne `session.member`.
- Logout : `POST /api/auth/logout` (soft-revoke).
- WIP en cours : sonde client `/api/auth/session` + hook `useMemberSession` (préserve).

**Admin** [FACT] :
- Passcode unique `ADMIN_PASSCODE` (≥ 16 chars en prod, fail-closed au boot) → login `POST /api/admin/login` (CSRF + rate-limit 10/10 s) → token `exp.role[.identity].sig` HMAC-SHA256, cookie `hashcode-admin` 12 h.
- `requireAdminRole(req, "viewer" | "operator")` : `operator` ⊇ `viewer`.
- **Identité admin non renseignée au login** [RISK] : `issueAdminToken(role, identity?)` accepte une identité mais `admin/login` ne la fournit pas → `getAdminIdentity()` = `"unknown"` aujourd'hui. Conséquence directe sur la traçabilité des reviews Atelier (cf. §16).

---

## 8. Autorisation

| Contrôle | Implémentation existante |
|---|---|
| Auth membre | `getSession(req)` par route/layout [FACT] |
| Auth admin | `requireAdminRole(req, role)` / `isAdminAuthed` [FACT] |
| CSRF | `checkCSRF(req)` : `Origin.host === Host` — utilisé sur **toutes** les mutations admin [FACT] |
| Rate limit | `rateLimit(key, {capacity, windowMs})` + `retryAfterHeader` — Redis/Upstash, fallback mémoire [FACT] |
| Ownership | Vérifications ad hoc par requête (ex : RSVP unique `[eventId, memberId]`, `memberId === session.member.id` implicite) [FACT] |
| Guards de test | `blockIfTesting()` (TESTING=1 → 403), `bodyLimit()` (100 Ko défaut) [FACT] |
| Audit | `audit(action, entityType, entityId, metadata, actor)` — non bloquant, acteurs `admin\|system\|ip` [FACT] |

**[RISK préexistant]** Les mutations membre existantes (RSVP) n'appellent pas `checkCSRF` (SameSite=Lax uniquement). Pour l'Atelier : adopter `checkCSRF` en défense en profondeur est possible sans casser l'existant (fetch same-origin envoie `Origin`).

---

## 9. Database

**Modèles existants** (13) [FACT] : `Member`, `AdminKey`, `AuditLog`, `AnalyticsEvent`, `EmailEvent`, `MemberEmailLog`, `ProfilingDraft`, `MemberSession`, `MemberBlacklist`, `Event`, `EventRsvp`, `EmailProviderMetric`, `EmailTemplate`.

**Recherche des concepts Atelier** :

| Concept demandé | État | Preuve |
|---|---|---|
| Workshop / Program / Course | **N'existe pas** | schema complet |
| Week / Lesson / Session pédagogique | **N'existe pas** (`Event.type="session"` est un rendez-vous, pas une unité de contenu) | `Event` |
| Activity / Resource | **N'existe pas** (texte libre dans `Event.description`) | `seed-github-program.ts` |
| Deliverable / Submission / Review / Feedback | **N'existe pas** | — |
| Quiz / Question / Attempt | **N'existe pas** | grep `quiz` = 0 |
| Progress / Unlock / Badge / Skill | **N'existe pas** | grep |
| Enrollment / Cohort | **N'existe pas** | — |
| Event | Existe | `Event` (13 champs, 4 index) |
| RSVP | Existe | `EventRsvp` (unique `[eventId, memberId]`) |

Conventions à respecter (imposées par l'existant) : pas d'enums Prisma (String + union TS + validation fonction pure), JSON en String, `createdAt/updatedAt`, index sur les colonnes de filtre, cascade sur les enfants possédés, `deletedAt` soft-delete pour les entités member (les Events n'en ont pas).

---

## 10. API

**Routes Event existantes** [FACT] :

| Route | Méthodes | Auth | Protections |
|---|---|---|---|
| `/api/events` | GET, POST | membre OU admin viewer (GET) ; admin operator (POST) | POST : blockIfTesting, bodyLimit, rate 10/10 min/IP, CSRF, validate, audit |
| `/api/events/[id]` | GET, PATCH, DELETE | GET membre/admin viewer ; PATCH/DELETE operator | PATCH : rate 20/10 min, CSRF ; DELETE : CSRF ; audit |
| `/api/events/[id]/rsvp` | POST, DELETE | membre | rate 5/10 min/membre, validation statut, capacité, événement futur |
| `/api/events/notify-count` | GET | admin (any) | `notifyWhere` partagé avec l'envoi réel |
| `/api/public/events` | GET | public | rate 60/min, aucune donnée personnelle, `scheduled\|live` futurs uniquement |

Réponse GET enrichie : `goingCount`, `maybeCount`, `myRsvp` (jamais les RSVP des autres via cette route — **sauf** `?memberId=<id>` qui expose `myRsvp` d'un autre membre si l'id est connu [RISK mineur]).

---

## 11. Events — contrat réel vs contrat du protocole (§6)

Le payload du protocole §6 est **valide** contre le code réel. Différences constatées :

| Point | Constat |
|---|---|
| `notify` | Lu mais **non validé** : `notify !== false` déclenche (tout sauf `false` strict). `"no"` ou `0` déclencheraient l'envoi [GAP mineur] |
| Validation réelle | `validateEventCreate` : titre 3–200, description ≤ 2000, `endsAt > startsAt`, enums fermées, URL http(s), capacité 1–9999 [FACT] |
| Récurrence | `weekly\|biweekly\|monthly` ; `recurrenceId` = clé de regroupement libre — **utilisée par le seed GitHub** [FACT] |
| Notification | Fire-and-forget, lots de 10, fuseau par pays (`zoneForCountry`), marque `notifiedAt` [FACT] |
| Écarts de comportement | RSVP : capacité non transactionnelle (course possible → surréservation) ; re-POST `going` sur event complet → 409 même si déjà inscrit (pas de changement de capacité) [RISK] |
| UI RSVP | Bug documenté : succès affiché même sur 409/404/429/403 (`docs/interface-utilisateur.md` §14.1) [RISK] |

**Verdict** : le contrat Event est opérationnel et cohérent. Corrections candidates (minimales, justifiées) : (1) valider `notify` booléen strict, (2) corriger le res.ok côté RSVP UI, (3) rendre le contrôle de capacité transactionnel. Aucune de ces corrections ne doit remplacer le code — elles s'ajoutent.

---

## 12. Notifications

- **Mail** : `src/lib/mail.ts` (1408 l.) — providers Resend/Brevo avec routage par catégorie (`marketing` → Brevo, `transactional/notification/code` → Resend), tags, tracking `EmailEvent`, anti-doublon `MemberEmailLog` pour les campagnes [FACT].
- **Templates** : `EmailTemplate` en DB → `resolveActiveTemplate(key, values)` (cache 30 s, **jamais bloquant**, fallback HTML du code), catégories `marketing\|notification\|code` (notification/code verrouillées en édition) [FACT].
- **Fuseaux** : `src/lib/events-timezone.ts` — rendu dans le fuseau du destinataire, annonce de l'heure de référence [FACT].
- **Event notify** : `sendEventNotificationEmail` — HTML code + catégorie `notification`, pas encore passé par le registry de templates [FACT].
- **[GAP]** : aucun système de préférences de notification par membre ; l'anti-spam repose sur l'explicite (geste admin) + `MemberEmailLog`. Les notifications Atelier devront rester transactionnelles (déclenchées par un événement subi : review rendue, session validée) et non promotionnelles.

---

## 13. Tests

| Suite | Contenu | Nature |
|---|---|---|
| `tests/unit.test.cjs` | auth admin (tokens), rate-limit mémoire, rateKey, soft-delete, RBAC, audit | Unit, miroirs CJS [FACT] |
| `tests/magic-link.test.cjs` | parseLinkEntry, buildVerifyUrl, flow mémoire, OTP, sanitize `next` | Unit, miroirs |
| `tests/event-validation.test.cjs` | validateEventCreate/Patch, notifyWhere, mergeBySource | Unit, miroirs (337 l.) |
| `tests/profiling.test.cjs` | archétypes, tags, auto-controls | Unit, miroirs |
| `tests/integration.test.cjs` | admin login/verify/logout, 401 protected, notify-count, audit-log, activity — **spawne un dev server port 3737** | Intégration **read-only** (writes retirés pour ne pas polluer la prod) |

**Limites structurelles** [RISK] :
- Les miroirs peuvent dériver de la source (commentaire explicite dans les tests : « If the sources change, update the mirrors »).
- Aucune DB de test → pas de test d'écriture bout-en-bout ; `TESTING=1` renvoie 403 sur les writes (guard).
- Pas de couverture des routes Events en intégration (POST retiré).

**Conséquence Atelier** : privilégier des **fonctions pures** (validation, scoring, progression/unlock, transitions d'état) testables en miroir, + sondes intégration read-only (401/403/422, quiz qui n'expose jamais `correctJson`), + documenter la stratégie DB de test (proposition : `TESTING_DATABASE_URL` + branche Neon dédiée).

---

## 14. CI/CD

- **[GAP]** Aucun pipeline GitHub Actions (`.github/` absent).
- Gate manuel : `npm run validate` = `typecheck && lint && test:unit` [FACT].
- **[DOC/RISK]** Le manifeste global `AGENTS.md` référence `npm run verify` / `verify:fast` (« sondes HTTP live + E2E ») : **ces scripts n'existent pas dans ce repo**. Le gate réel est `validate` (+ `test:integration` manuel).
- Déploiement Vercel : `vercel-build` exécute `prisma migrate deploy` → les migrations suivent la branche déployée. **[INFERENCE]** branche prod probablement `main` — à confirmer (voir Gate 1).
- `next.config.ts` : headers sécurité (CSP, HSTS, X-Frame-Options…), Sentry branché, `output: standalone` hors Vercel.

---

## 15. Composants réutilisables

- **UI kit** : 54 composants `src/components/ui/` (button, card, badge, dialog, alert-dialog, table, tabs, progress, calendar, form, sheet, tooltip, skeleton, sonner, etc.) — disponibles mais **peu utilisés dans l'admin Events** (inputs natifs stylés + `mono-label`). Suivre le style de la surface concernée : dashboard = composants `reboot/` ; admin = inputs maison.
- **Reboot** : `shared.tsx` (`RebootButton`, `MonoLabel`), `option-card.tsx`, `donut-chart.tsx`, `country-select.tsx`, `mobile-bottom-nav.tsx`, `public-events*.tsx`, `admin/*` (17 composants + hooks + `fetchJson`).
- **Hooks** : `use-toast`, admin `useMembers/useStats/useActivity/useKeyboardShortcuts`.
- **Typo** : `mono-label` avec plancher 11px (commit `e07f3eb`).

---

## 16. Systèmes existants réutilisables (directement)

1. Auth membre + admin, rôles, CSRF, rate-limit, guards de test, body-limit.
2. AuditLog + helper `audit()` (extension d'acteur « member » envisageable = petite modif justifiée).
3. Mail multi-provider + templates + timezone + tracking.
4. AnalyticsEvent (funnel) — utilisable pour instrumenter l'Atelier (vues, soumissions).
5. Pattern seed idempotent (`--dry-run`, `--force`, identité stable par titre+clé).
6. Pattern validation pure + tests miroirs.
7. Pattern route API « membre » (RSVP) et « admin » (events).
8. Pattern page publique server-rendered (`/evenements`) — réutilisable pour une éventuelle vitrine publique des ateliers (hors DoD v1).
9. Pattern docs (`docs/*.md` mis à jour à chaque feature).

---

## 17. Gaps

| # | Gap | Impact Atelier |
|---|---|---|
| G1 | Aucun modèle pédagogique (Workshop→Session→…) | Cœur du chantier, à créer |
| G2 | Aucune notion d'enrollment à un parcours | Nécessaire pour gating/accès |
| G3 | Aucun quiz (question/attempt/scoring serveur) | À créer |
| G4 | Aucune progression/unlock serveur | À créer (dérivée) |
| G5 | Aucun stockage de fichiers (pas d'upload API, pas de Blob/R2) | Types livrables v1 = URL/texte/repo/PR/site ; « fichier/capture » = upload → infra à décider plus tard |
| G6 | Pas de préférences de notification | Contrainte : notifications transactionnelles uniquement |
| G7 | Pas de DB de test | Tests d'écriture limités |
| G8 | Pas de CI | Gate = commandes locales + discipline |
| G9 | Identité admin non capturée | Traçabilité reviewer limitée |
| G10 | Programme actuel = 12 Events à plat | Seed Atelier devra structurer + lier, sans dupliquer le contenu |
| G11 | `npm run verify` documenté mais absent | Utiliser `validate` — corriger la doc ou ajouter le script |

---

## 18. Risques

| # | Risque | Sévérité | Mitigation proposée |
|---|---|---|---|
| R1 | Divergence `main`/`development` (40 vs 29 commits) | Élevée | Ne pas merger ; travailler sur `development` ; planifier une réconciliation explicite séparée ; confirmer la branche prod |
| R2 | WIP non commité (schema + migration) | Moyenne | Commits dédiés avant chantier ; jamais de `db push --accept-data-loss` |
| R3 | Écriture en prod via tests | Élevée | Guard `TESTING=1` conservé ; tests read-only ; proposer DB de test |
| R4 | Dérive des miroirs de test | Moyenne | Fonctions pures courtes et stables ; commentaire de synchronisation systématique |
| R5 | Race sur capacité RSVP | Faible/Moyenne | Transaction ou check-and-set lors de la passe Event |
| R6 | Bug RSVP optimiste (UI) | Faible | Correction ciblée en Phase 3 (préexistante, documentée) |
| R7 | Fuite de réponses de quiz | Élevée | Projection serveur stricte (jamais `correctJson` côté client) + tests négatifs |
| R8 | Volume emails (quota Brevo 300/j) | Moyenne | Notifications transactionnelles seulement ; batching ; suivi `EmailEvent.provider` |
| R9 | Scope creep CMS admin | Moyenne | Admin v1 = review + pilotage ; structure via seed |
| R10 | `?memberId=<id>` expose `myRsvp` d'autrui | Faible | Optionnel : restreindre à `me` + admin |

---

## 19. Dette technique pertinente

- Dépendances mortes (`next-auth`, `next-intl`, `zustand`, SDK `resend`) — le prune knip n'existe que sur `main` [FACT].
- `bun.lock` obsolète vs `package-lock.json` actif.
- En-tête de `prisma/schema.prisma` : « SQLite datasource » alors que le provider est `postgresql` (commentaire périmé).
- Commentaire de `src/lib/admin-roles.ts` décrivant un format de token obsolète.
- `docs/interface-utilisateur.md` §14 : 15 anomalies documentées non corrigées (dont RSVP optimiste — pertinent Event).
- Scripts `import-*.mjs` historiques à la racine de `scripts/`.
- Pas de script `verify` malgré la doc globale.

---

## 20. Points d'intégration Atelier

| Couche | Point d'intégration précis |
|---|---|
| DB | Nouveaux modèles + FK `WorkshopSession.eventId → Event` (`onDelete: SetNull`) + index ; migration horodatée > `20260918120000` |
| API membre | Nouvelles routes `/api/workshops/*` (pattern RSVP : `getSession` + rate-limit + `blockIfTesting` ; + `checkCSRF`) |
| API admin | `/api/admin/workshops/*` (pattern Events : operator + CSRF + audit + rate-limit) |
| UI membre | `/dashboard/ateliers` → `/dashboard/ateliers/[slug]` → `/dashboard/ateliers/[slug]/sessions/[sessionId]` ; `DashboardSidebar.NAV_ITEMS` ; `MobileBottomNav.DASHBOARD_ITEMS` ; éventuelle carte sur `/dashboard` |
| UI admin | `/admin/ateliers` (liste + file review) ; `AdminSidebar.NAV_ITEMS` + `SECTION_MAP`/`routeMap` de `admin/layout.tsx` + `CommandPalette` + `MobileBottomNav` |
| Événements | Lecture des Events liés (`eventId`) pour afficher le prochain créneau ; aucun changement au contrat Event existant |
| Notifications | `src/lib/mail.ts` (nouveaux envois) ; éventuellement `email-templates/registry.ts` (clés `notification`, verrouillées) |
| Audit | `audit()` pour : `workshop.create/update`, `session.create/update`, `submission.review`, `program.seed` |
| Seed | `scripts/seed-github-workshop.ts` (idempotent, `--dry-run/--force`) + extraction des données du programme en module partagé avec `seed-github-program.ts` |
| Tests | `tests/workshop-validation.test.cjs` + extension `tests/integration.test.cjs` (read-only) |
| Docs | `docs/ateliers.md` (architecture + API + règles), mise à jour `docs/interface-utilisateur.md` |

---

## 21. Architecture cible minimale

### 21.1 Modèles (justification : aucun modèle existant ne couvre le pédagogique)

| Modèle | Rôle | Champs clés (esquisse) |
|---|---|---|
| `Workshop` | Parcours (« Maîtrise GitHub — Bases ») | `slug @unique`, `title`, `description`, `status` (draft/published/archived), `domain`, `level`, `createdAt/updatedAt` |
| `WorkshopWeek` | Semaine (S1–S4) | `workshopId`, `number`, `title`, `objective` ; `@@unique([workshopId, number])` |
| `WorkshopSession` | Séance (S01–S12) — unité pédagogique | `weekId`, `number`, `title`, `objective`, `program`, `deliverableRequired`, `quizRequired`, `eventId String? → Event (SetNull)` ; `@@unique([weekId, number])` ; **EVENT ≠ SESSION garanti** |
| `WorkshopActivity` | Activité ou ressource ordonnée de séance | `sessionId`, `order`, `kind` (practice/resource), `title`, `description?`, `url?` — un seul modèle : même structure, la ressource = activité externe référencée (pas de recopie du contenu joinhashcode) |
| `WorkshopDeliverable` | Preuve attendue (1/séance) | `sessionId @unique`, `type` (url/github_repo/pull_request/project/deployed_url/screenshot/text — String + union TS), `title`, `description`, `isRequired` |
| `WorkshopSubmission` | Dépôt participant, **append-only** (attempt n) | `deliverableId`, `memberId`, `attempt`, `content`, `status` (PENDING/IN_REVIEW/APPROVED/REVISION/REJECTED) ; historique conservé |
| `WorkshopReview` | Décision de review, append-only | `submissionId`, `reviewer` (identité admin), `decision`, `feedback` |
| `WorkshopQuiz` | Quiz de séance (0..1) | `sessionId @unique`, `title`, `passThreshold` (%), `maxAttempts Int?` (null = illimité), `isRequired` |
| `WorkshopQuestion` | Question | `quizId`, `order`, `type` (single/multiple/true_false), `prompt`, `optionsJson`, `correctJson` (**jamais exposé**), `points` |
| `WorkshopQuizAttempt` | Tentative + score serveur | `quizId`, `memberId`, `answersJson`, `score`, `passed` ; illimité par défaut |
| `WorkshopEnrollment` | Inscription au parcours | `workshopId`, `memberId`, `status` (active/completed) ; `@@unique([workshopId, memberId])` |

**Pas de table de progression en v1** [DECISION] : la progression et l'unlock sont **dérivés** par fonction pure à partir d'`enrollment` + `submissions` + `reviews` + `attempts`. Justification : toute table dénormalisée dérive ; tout est reconstructible ; la fonction pure est le « minimum nécessaire » du protocole §19. Cache éventuel plus tard si mesure de perf le justifie.

**Pas de Skill/Badge** en v1 : `skills String @default("[]")` (JSON) sur `WorkshopSession` suffit — le DoD ne les exige pas.

### 21.2 Libs pures (testables en miroir)

- `src/lib/workshop-validation.ts` — validation création/édition admin (workshop, semaine, séance, activité, livrable, quiz) + validation soumission (type/content) — sur le modèle exact de `events-validation.ts`.
- `src/lib/workshop-progression.ts` — `computeSessionState(session, submissions, reviews, attempts)` → `LOCKED \| NOT_STARTED \| IN_PROGRESS \| SUBMITTED \| IN_REVIEW \| REVISION \| COMPLETED` + `isUnlocked(index, states)` (séquentiel : N débloquée si N−1 COMPLETED) + `workshopSummary(states)`.
- `src/lib/workshop-quiz.ts` — `scoreAttempt(questions, answers)` → `{score, passed}` serveur, normalisation (exact match insensible casse/espaces pour `true_false`/single/multiple) ; **les réponses correctes ne quittent jamais le module**.

### 21.3 API (conventions existantes obligatoires)

**Membre** (via `getSession` + rate-limit + `blockIfTesting` + `checkCSRF` en défense) :
- `GET /api/workshops` — parcours publiés + état de progression du membre.
- `GET /api/workshops/[slug]` — structure (semaines/séances) + états/locks + prochain Event lié.
- `POST /api/workshops/[slug]/enroll` — enrollment.
- `GET /api/workshops/sessions/[id]` — détail séance (activités, ressources, livrable, submissions + reviews du membre, tentative/score ; **jamais** `correctJson`), accessible seulement si enrollment + non verrouillée.
- `POST /api/workshops/sessions/[id]/submissions` — soumettre / resoumettre (attempt suivant), ownership strict.
- `POST /api/workshops/quizzes/[id]/attempts` — réponses → scoring serveur.

**Admin** (operator + CSRF + audit + rate-limit) :
- `GET/POST /api/admin/workshops`, `GET/PATCH /api/admin/workshops/[id]` (publier/archiver, métadonnées).
- `GET /api/admin/workshops/[id]/submissions` — file de review (filtrable statut).
- `POST /api/admin/submissions/[id]/reviews` — `{decision: APPROVED\|REVISION\|REJECTED, feedback}` → crée `WorkshopReview`, calcule la transition (`APPROVED` → session possiblement COMPLETED → déblocage suivant) et déclenche les notifications.

**Écriture de structure (semaines/séances/activités/livrables/quiz)** : via seed v1, routes admin d'édition en « remaining work » (extension naturelle une fois les modèles en place) [DECISION de périmètre].

### 21.4 Règles serveur

- Validation session : `deliverableRequired` effectif = livrable existe ET requis ; `quizRequired` idem ; aucun des deux → séance complétée dès déblocage (documenté). Pas de condition fantôme rendue obligatoire.
- Review : admin seulement ; `reviewer` = identité admin (aujourd'hui `"unknown"` → limitation documentée + capture d'identité recommandée) ; un participant n'a aucune route de review.
- Quiz : attempts illimités sauf `maxAttempts` ; scoring serveur ; threshold configurable ; jamais d'émission des réponses correctes.
- Unlock : séquentiel serveur ; le client ne fournit jamais d'état.

---

## 22. Plan d'implémentation

| Étape | Contenu | Commit(s) proposés | Gate |
|---|---|---|---|
| A0 | Sécuriser le WIP existant (session-aware + email provider + profiling) | `feat(auth): sonde de session membre` etc. | `npm run validate` |
| A1 | Audit Event Admin (déjà largement fait) + corrections minimales si validées : booléen `notify` strict ; sectionnement léger du formulaire | `fix(events): valide notify en booléen strict` | GATE EVENT |
| A2 | Audit Event Utilisateur : corriger le bug RSVP optimiste (`res.ok`) ; test capacité | `fix(events): n'affiche plus « Inscrit » sur erreur RSVP` | GATE EVENT |
| B1 | Migration DB Atelier (11 modèles + FK Event) + `prisma generate` | `feat(workshop): domaine pédagogique (schéma)` | typecheck |
| B2 | Libs pures validation + progression + quiz + tests miroirs | `feat(workshop): validation, scoring et progression` | `test:unit` |
| B3 | API membre (liste, détail, enroll, séance, submission, attempt) | `feat(workshop): API membre` | tests négatifs |
| B4 | API admin (workshops, file review, reviews + audit + notifications) | `feat(workshop): API admin + reviews` | tests |
| B5 | UI membre (`/dashboard/ateliers*` + nav) | `feat(workshop): espace ateliers membre` | vérif manuelle + lint |
| B6 | UI admin (liste + file de review) | `feat(workshop): file de review admin` | vérif |
| B7 | Notifications (livrable reçu/accepté, correction demandée, session validée) | `feat(workshop): notifications` | test (mock) |
| B8 | Seed programme initial : 4 semaines, 12 séances, activités, livrables, quiz + **liaison aux 12 Events** (clé : titre `Maîtrise GitHub #N` + `recurrenceId`) | `feat(seed): programme Maîtrise GitHub structuré` | `--dry-run` puis exécution encadrée |
| C1 | Tests complets (unit + intégration read-only + cas négatifs permissions) | `test: couvre les parcours atelier` | `test:all` |
| C2 | Audit sécurité (ownership, quiz answers, unlock, permissions) + audit UX | `fix(workshop): durcissements` | revue |
| C3 | Documentation (`docs/ateliers.md` + mise à jour UI docs) + rapport final | `docs: architecture atelier` | GATE FINAL |

**Ordre du protocole §32 respecté** : 1-2 audit/rapport, 3-5 Event admin/corrections/tests, 6 Event user, 7-9 domaine DB API, 10-17 UI/sessions/livrables/reviews/quiz/validation/progression/unlock, 18 liaison Event↔Session, 19 notifications, 20 programme, 21-24 tests/sécurité/UX/doc.

---

## Matrice de traçabilité (extrait — les exigences critiques)

| Exigence | Règle | DB | API | UI | Permission | Test |
|---|---|---|---|---|---|---|
| Soumettre un livrable | Seulement si enrollment + séance débloquée | `WorkshopSubmission` | `POST /api/workshops/sessions/[id]/submissions` | Séance | ownership membre | unit + intégration 401/403 |
| Resoumettre après correction | historique conservé (attempt n+1) | idem (append-only) + `WorkshopReview` | idem | Séance (timeline) | ownership | unit transitions |
| Reviewer | décision + feedback, jamais l'auteur | `WorkshopReview` | `POST /api/admin/submissions/[id]/reviews` | Admin | operator + CSRF | unit + intégration |
| Quiz scoring | serveur, threshold configurable, réponses jamais exposées | `WorkshopQuestion.correctJson` (serveur) | `POST .../attempts` | Séance | membre | unit + test fuite |
| Validation séance | APPROVED + PASSED selon flags effectifs | dérivé | calculé | badges d'état | serveur only | unit |
| Unlock séquentiel | N unlocked si N−1 completed | dérivé | calculé | parcours | serveur only | unit |
| Liaison Event↔Session | horaire modifiable sans toucher le contenu | `WorkshopSession.eventId` SetNull | inclus aux GET | parcours/séance | lecture | unit + intégration |
| Progression visible | lecture seule côté client | dérivé | GET workshops | parcours | membre | intégration |

---

## Réponses aux 8 questions

1. **Architecture réelle ?** Next 16 App Router + Prisma/Neon, auth double (magic-link membre / passcode admin), API route handlers Node, design system Tailwind+shadcn, gate local `validate`, déploiement Vercel.
2. **Ce que possède déjà HashCode Reboot ?** Un CRM communautaire complet (membres, invitations, marketing, email deliverability, audit), un agenda Event avec RSVP/notifications/page publique, un espace membre dashboard, 12 événements du programme GitHub seedés.
3. **Réutilisable ?** Auth, rôles, CSRF, rate-limit, audit, mail+templates, analytics, guards, patterns de validation/test/seed/docs, composants UI — tout le socle est réutilisable ; **rien** du pédagogique.
4. **Ce qui manque ?** Les 11 modèles pédagogiques, enrollment, submissions/reviews, quiz/scoring, progression/unlock, UI membre et admin, notifications dédiées, seed structuré, DB de test, CI.
5. **Où intégrer Ateliers ?** Membre : `/dashboard/ateliers*` + sidebar/mobile nav. Admin : `/admin/ateliers*` + sidebar/palette. DB : nouveaux modèles + FK vers `Event`. API : `/api/workshops/*` et `/api/admin/workshops/*`. Aucun doublon : Event reste le rendez-vous, Atelier le contenu.
6. **Risques ?** Divergence main/dev, WIP non commité, pas de DB de test, fuite de réponses quiz, dérive des miroirs, quota email, scope creep admin.
7. **Architecture cible minimale ?** §21 : 11 modèles + 3 libs pures + ~9 routes membre/admin + UI membre 3 écrans + admin review + seed liant les 12 Events.
8. **Ordre exact ?** §22 : WIP → Event admin/user (+corrections minimes) → schéma → libs pures → API → UI → notifications → seed → tests → sécurité/UX → doc.

---

## GATE 1 — état

| Contrôle | État |
|---|---|
| Stack comprise | ✅ |
| Auth comprise | ✅ |
| User model compris | ✅ |
| Admin compris | ✅ |
| Event compris | ✅ (admin + membre + public + notify) |
| DB comprise | ✅ |
| APIs comprises | ✅ |
| Notifications comprises | ✅ |
| Tests compris | ✅ (+ limites DB de test identifiées) |
| Point d'intégration identifié | ✅ |
| Doublons identifiés | ✅ (aucun doublon nécessaire ; Event reste unique) |
| Gaps identifiés | ✅ (§17) |

**Décisions à valider avant Phase 2** (voir issue #75) :
1. Commiter le WIP existant (session-aware + email-provider + profiling) pour partir d'une base propre — confirmation ?
2. Progression **dérivée** (pas de table) — confirmation ?
3. Admin v1 = review + pilotage, structure via seed, CMS complet plus tard — confirmation ?
4. `main` vs `development` : quelle branche est déployée en production sur Vercel (le repo ne le dit pas) ?
