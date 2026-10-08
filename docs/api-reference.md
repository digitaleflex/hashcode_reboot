# Référence API — HASHCODE REBOOT

> Source de vérité : les fichiers `src/app/api/**/route.ts` du dépôt.
> Ce document décrit ce que le code FAIT (comportements constatés à la lecture),
> pas ce qui est souhaité. En cas de doute, relire le fichier indiqué.
> Généré le 2026-10-08 — issue #122. Ne couvre que les routes API
> (pas les pages, pas les Server Actions).

Conventions de nommage : `POST /api/members` = méthode + chemin, implémenté
par `src/app/api/members/route.ts`. `[id]`, `[slug]`, `[noteId]`, `[key]`
sont des segments dynamiques Next.js.

---

## 1. Conventions transverses

### 1.1 Authentification — trois régimes

| Régime | Vérifié par | Utilisé par |
|---|---|---|
| Session membre (Better Auth, OTP email) | `getSession()` (`src/lib/account-auth.ts`) | `/api/account/*`, `/api/events` (lecture), `/api/workshops/*`, RSVP, enroll, community/join |
| Admin lecture (tout rôle) | `isAdminAuthed(req)` — accepte `viewer` ET `operator` | GET admin : dashboard, stats, email-log, invitations, activity-logins, cron-health, export, members (liste + détail), notes (lecture), notify-count |
| Admin écriture (rôle + CSRF) | `requireAdminRole(req, "operator")` + `checkCSRF(req)` | POST/PATCH/DELETE admin : members, events, workshops sessions, mentoring, blacklist, templates, test-email, import-invite, announce, bulk (voir 1.5 pour l'exception) |

- `checkCSRF` (`src/lib/admin-auth.ts`) : compare le header `Origin` au `Host`
  de la requête (égalité stricte des hôtes). Sans `Origin` ou hôte différent
  → refus. Les écritures membre (enroll, submissions, quiz, RSVP) exigent
  aussi le CSRF, mais via `getSession` + `checkCSRF` (pas de rôle admin).
- Rôles admin exacts : `"operator"` (tout) et `"viewer"` (lecture seule).
  `requireAdminRole(req, "viewer")` accepte les deux ; `"operator"` n'accepte
  que operator. Résolu depuis `member.adminRole` en base (fail-closed : inconnu → non-admin).
- `GET /api/admin/verify` : sonde `{ authed, role }` (lecture seule, tout rôle).

### 1.2 Erreurs — `src/lib/errors.ts` + `errorToResponse(err)`

Chaque route enveloppe son handler dans `try/catch` et retourne
`errorToResponse(err)`. Forme générale : `{ error: string, code: string, details?: unknown }`.

| HTTP | Code | Classe | Usage constaté |
|---|---|---|---|
| 400 | `INVALID_JSON` | `InvalidJsonError` | corps non-JSON |
| 400 | `BAD_REQUEST` (ad-hoc) | `AppError` | import sans rows/csvText, import trop de lignes, analytics POST, consents, profiling/draft |
| 401 | `UNAUTHENTICATED` | `AuthError` | session membre absente (message "Non authentifié.") |
| 401 | `UNAUTHORIZED` | `AuthError` | admin non reconnu ("Non autorisé.") ; cron sans Bearer valide |
| 401 | `INVALID_CODE` / `LOCKED` | Better Auth OTP | code OTP faux/expiré, trop de tentatives |
| 403 | `FORBIDDEN` | `ForbiddenError` | rôle insuffisant, CSRF invalide (message "CSRF validation failed."), email blacklisté (`EMAIL_NOT_ACCEPTED`) |
| 403 | `TESTING_GUARD` | `blockIfTesting` | écriture bloquée quand `TESTING=1` (voir 1.4) |
| 403 | `CSRF_FAILED` (ad-hoc) | `AppError` | uniquement `POST /api/admin/email-templates/preview` |
| 404 | `NOT_FOUND` | `NotFoundError` | ressource absente ; webhook Brevo à secret invalide (leurre, voir 13.2) |
| 409 | `CONFLICT` | `ConflictError` | état incompatible : soumission en cours, livrable approuvé, quiz maxAttempts, mentorship existant, template existant, complete-profile déjà complété |
| 413 | `PAYLOAD_TOO_LARGE` | `bodyLimit(req)` | corps trop volumineux (account, analytics, templates, auth) |
| 422 | `INVALID_PAYLOAD` (+ `INVALID_LINK`, `EXPIRED`, `CONFIRM_REQUIRED`) | `ValidationError` / `AppError` | échec Zod — `details` = `error.flatten()` ou `error.issues` |
| 429 | `RATE_LIMITED` (+ `COOLDOWN` pour verify-email) | `RateLimitError` | rate-limit nommé dépassé — header `Retry-After` (secondes) systématique |
| 500 | `INTERNAL` / `INTERNAL_ERROR` | `AppError` | repli générique, jamais de stack exposée |
| 503 | — | webhook Resend non configuré en prod | secret webhook absent en production (fail-closed) |

Écarts de forme (code fait foi) : quelques routes renvoient des erreurs
ad-hoc `{ error }` sans `code` (ex. `GET /api/stats`, `GET /api/stats/cohort`,
`POST /api/admin/logout` 403 CSRF, `GET /api/profile/[id]` 404) au lieu de
passer par `errorToResponse`. Le fond (statuts) reste celui du tableau.

### 1.3 Rate-limit — `src/lib/rate-limit.ts`

- `rateLimit(key, { capacity, windowMs })` par IP (`rateKey(req)`) ou par
  membre (`workshops:*`, `rsvp:*`, `workshop-*:memberId`).
- Dépassement → 429 + header `Retry-After` (secondes, via `retryAfterHeader`).
- Clés nommées par route (détail dans chaque fiche ci-dessous).
- Ordres de grandeur : lectures publiques 30–120 / 10 min ; lectures admin
  120 / min ; écritures admin 5–30 / 10 min ou / min ; OTP et actions
  sensibles 5 / 10 min.

### 1.4 Garde de test — `blockIfTesting()` (`src/lib/test-guard.ts`)

Si `TESTING=1` (ou `"true"`), les routes d'écriture retournent
**403 `{ error: "Write blocked: TESTING mode active.", code: "TESTING_GUARD" }`**
sans écrire. Constaté sur : account (profile, complete, phone, delete),
consents POST, members POST/bulk/import/[id]/notes/invite, events POST/PATCH,
workshops enroll/submissions/quiz, admin (announce, import-invite, test-email,
templates POST, mentoring POST, sessions PATCH, review), analytics POST,
invite/relance. Les lectures et les cron ne sont pas gardés.

### 1.5 CSRF — remarque importante

Toutes les écritures admin et membre vérifient `checkCSRF`, **sauf une** :
`POST /api/members/bulk` (requireAdminRole operator + rate-limit, mais aucun
appel à `checkCSRF` — imports vérifiés : `requireAdminRole` seul).
Lacune signalée, volontaire ou non : à trancher hors de ce document.

### 1.6 Pagination et plafonds

- Liste membres : `page` (1-based, défaut 1) + `pageSize` (défaut 50, max 200) ;
  legacy `limit` (= pageSize page 1) et `take`/`skip` supportés ; tri via
  `sort`/`sortKey`/`orderBy` + `dir`/`sortDir`/`order`
  (`createdAt`/`firstName`/`primaryDomain`|`domain`/`level`/`profileStatus`|`status`),
  défaut `createdAt desc`. Réponse `{ members, total, page, pageSize }`.
- Export CSV/JSON : plafond dur `MAX_EXPORT = 2000` lignes (`take`),
  réponse tronquée signalée par `truncated: true`.
- Analytics GET (funnel/timing) : `take: 5000` événements par requête
  d'agrégation.
- Import CSV : 500 lignes max par import (`MAX_ROWS`), chunks `createMany`
  de 150 ; `import-invite` confirmé plafonné à 200 lignes (`MAX_CONFIRM_ROWS`).
- Bulk : 10 ids max par appel. Relance : 50 ids max. Announce : lots de
  15 (défaut) à 25 max, paginés par `offset` (`{ sent, failed, nextOffset, done }`).
- Notes : 2000 caractères max. Tags libres : 20 tags × 40 caractères.
- Audit-log : `limit` paramétrable + export `?format=csv` (téléchargement).

---

## 2. AUTH

### `GET, POST /api/auth/[...betterAuth]` — OTP Better Auth
- Fichier : `src/app/api/auth/[...betterAuth]/route.ts`. Délègue à `auth.handler(req)`
  (`src/lib/auth.ts`, plugin OTP email : demande de code + vérification).
- Rate-limit : `otp-signin:<ip>` 5 / 10 min sur GET **et** POST (429 via `RateLimitError`).
- Erreurs OTP : 401 `INVALID_CODE` (code faux/expiré), 401 `LOCKED` (trop de tentatives).
- Effets : création/validation de session Better Auth (cookies), pas d'écriture
  directe dans `member` par cette route.

### `GET /api/auth/session` — sonde publique, jamais 401
- Fichier : `src/app/api/auth/session/route.ts`. Pas de rate-limit, pas de garde.
- Réponse : anonyme → `200 { authenticated: false }` ; connecté →
  `200 { authenticated: true, firstName }`. Header `Cache-Control: no-store`.
  Volontairement hors du matcher d'auth du middleware (pas d'erreur console
  sur les pages publiques).

### `POST /api/auth/logout` — révocation session membre
- Fichier : `src/app/api/auth/logout/route.ts`. `auth.api.signOut` best-effort
  (idempotent : ok même en échec), puis cookie `better-auth.session_token`
  expiré explicitement (`Expires=1970`, `HttpOnly`, `SameSite=Lax`, `Secure` en prod).
- Réponse : `{ ok: true, message: "Déconnecté." }`.

### `POST /api/admin/logout`
- Fichier : `src/app/api/admin/logout/route.ts`. Vérifie `checkCSRF` seul
  (pas de rôle requis) → 403 `{ error: "CSRF validation failed." }` si échec.
- Effet : suppression du cookie de session admin. Réponse `{ ok: true }`.

### `GET /api/admin/verify`
- Fichier : `src/app/api/admin/verify/route.ts`. `isAdminAuthed` (tout rôle).
- Réponse : `{ authed: true, role: "viewer"|"operator" }` ou `{ authed: false, role: null }`.

---

## 3. MEMBERS (inscription + gestion)

### `POST /api/members` — inscription publique
- Fichier : `src/app/api/members/route.ts`. Gardé test, `bodyLimit`,
  rate-limit `members-submit:<ip>` 5 / 10 min.
- Entrée : schéma `createProfileSchema(t)` (i18n) — corps du formulaire de profiling.
- Anti-énumération : email blacklisté → 403 `EMAIL_NOT_ACCEPTED` (message
  générique + contact privacy) ; email déjà inscrit → **200**
  `{ ok: true, duplicate: true, message }` (même forme qu'un succès partiel,
  sans memberId) ; race P2002 → même forme `duplicate`.
- Succès : 201 `{ ok, duplicate: false, memberId, accessLane, profileStatus,
  communityStatus, reasons, profile, nextBestAction, orientationStatus,
  orientationRecommendations }`. Cookie `phone-fill` (ticket HMAC, voir 4.4)
  posé **uniquement** à la création (jamais sur doublon).
- Effets DB (création) : `member.create` (+ `approvedAt` si APPROVED) ;
  en parallèle best-effort (`allSettled`) : `analyticsEvent` (`profil_generated`),
  `qualification` (si orientation calculée), `profilingDraft.upsert` (si PENDING) ;
  emails d'onboarding en arrière-plan (`void sendOnboardingEmails`, non bloquant).
- Erreurs : 400 JSON, 422 Zod (issues `{ path, message }`), 429, 403 blacklisté.

### `GET /api/members` — liste admin avec filtres + pagination
- Fichier : `src/app/api/members/route.ts`. `isAdminAuthed` (tout rôle), pas de CSRF (lecture).
- Query : `domain`, `country`, `level`, `mentoring`, `budget`, `status`
  (profileStatus), `lane` (accessLane), `type`, `invitationStatus`, `q`
  (recherche), `tag`, `stage` (`pending|approved|invited|active`, sinon 422),
  + pagination/tri (voir 1.6).
- Réponse : `{ members (avec tags décodés), total, page, pageSize }`.

### `GET /api/members/[id]` — détail complet (admin lecture)
- `isAdminAuthed` ; 404 si absent. Réponse `{ member }` (champs JSON
  décodés : secondaryDomains, domainSpecialty, mentoringTypes, tags, customTags).

### `PATCH /api/members/[id]` — statuts / note (admin operator + CSRF)
- Gardé test, rate-limit `admin-member-write:<ip>` 20 / 10 min.
- Entrées : `profileStatus` (PENDING|APPROVED|REJECTED|WAITLIST),
  `communityStatus` (NOT_INVITED|INVITED|JOINED), `customTags` (validés :
  trim, minuscules, dédupliqués, 20 max × 40 car.).
- Effets : `member.update` (+ `approvedAt` si passage APPROVED),
  email de changement de statut (`sendStatusChangeEmail`), entrée blacklist
  éventuelle, `audit("member.update")`, `analyticsEvent`.
- Erreurs : 403 (rôle/CSRF), 404, 422, 429.

### `DELETE /api/members/[id]` — soft delete (admin operator + CSRF)
- Gardé test, rate-limit `admin-member-delete:<ip>` 20 / 10 min.
- Effets : `member.update { deletedAt }` (jamais de suppression physique),
  email auto-blacklisté, `audit("member.soft-delete")`, `analyticsEvent`
  (member-less, ref = action). Réponse `{ ok: true }`.

### `POST /api/members/[id]/invite` — marquer INVITED + joinUrl
- Gardé test, operator + CSRF, rate-limit `admin-invite:<ip>` 20 / 10 min.
- Effets : `communityStatus → INVITED`, `invitedAt`, `invitationStatus`,
  `analyticsEvent (admin_invite)`, `audit("member.invite")`, email d'invitation.
- Réponse : `{ ok, joinUrl (/login?next=/api/community/join), inviteMessage }`.
  404 si membre absent.

### `GET /api/members/[id]/notes` — lecture notes (admin tout rôle)
- `isAdminAuthed`, pas de CSRF. Réponse `{ notes: [{ id, createdAt, author, content }] }`.

### `POST /api/members/[id]/notes` — ajouter une note (operator + CSRF)
- Gardé test, rate-limit `admin-member-notes:<ip>` 20 / 10 min.
- Entrée : `content` (string, 1–2000 caractères). Auteur = `getAdminIdentity(req)`.
- Réponse 201 `{ note }`. 404 si membre absent.

### `DELETE /api/members/[id]/notes/[noteId]` — supprimer une note (operator + CSRF)
- Gardé test, même rate-limit `admin-member-notes`. Réponse `{ ok: true, deleted: noteId }`.
  404 si note absente ou d'un autre membre.

### `GET /api/members/[id]/share` — carte profil publique, sans PII
- Fichier : `src/app/api/members/[id]/share/route.ts`. **Aucune auth**
  (id cuid non énumérable). Rate-limit `share:<ip>` 30 / 10 min.
- Réponse `{ profile: { firstName, archetype, domain, level, goal,
  availability, learningStyle, mentoring, threeMonthGoal, tags } }` —
  jamais email, téléphone, ville, statuts internes, accessLane. 404 si absent.

### `POST /api/members/bulk` — action groupée (operator, SANS CSRF — lacune)
- Gardé test, rate-limit `admin-bulk:<ip>` 20 / 10 min. **Pas de `checkCSRF`**
  (vérifié : imports = `requireAdminRole` seul).
- Entrée : `{ ids: string[1..10], action: approve|invite|waitlist|reject|delete }`.
- Effets : `updateMany` (approve → APPROVED+INVITED+lane immediate + `approvedAt` ;
  invite → INVITED + `invitedAt` si NOT_INVITED ; waitlist/reject ; delete →
  soft `deletedAt`), `audit("member.bulk-<action>")`, `analyticsEvent (admin_bulk_action)`.
- Réponse `{ ok, affected }`.

### `POST /api/members/import` — import CSV (operator + CSRF)
- Gardé test, rate-limit `import:<ip>` 10 / 10 min.
- Entrée : `{ rows?: Record<string,unknown>[] }` (rétro-compat client) **ou**
  `{ csvText?: string }` (parsé serveur via PapaParse ; en-têtes normalisés
  email/name/level/country/domain/accessLane, sinon mapping positionnel).
  Ni l'un ni l'autre → 400 `BAD_REQUEST` ; 0 ligne → 400 ; > 500 lignes → 400 `TOO_MANY_ROWS`.
- Effets : `createMany` par chunks de 150 (membres importés, profils factices),
  `audit`, analytics. Réponse : résumé `{ ok, created, skipped, errors[] }`.

---

## 4. ACCOUNT (espace membre connecté)

Toutes ces routes exigent `getSession` (401 `UNAUTHENTICATED` sinon).

### `GET /api/account/me`
- Fichier : `src/app/api/account/me/route.ts`. Pas de rate-limit.
- Réponse : `buildAccountData(member)` — identité, profil généré, statuts,
  createdAt. Exclut `deletedAt`, `otpHash`. `Cache-Control: no-store`.

### `PATCH /api/account/profile`
- Gardé test, `bodyLimit`, rate-limit `account-update:<ip>` 10 / 10 min.
- Entrée (tout optionnel) : `lastName` (≤60), `firstName` (≤40), `city` (≤80),
  `goal`/`threeMonthGoal` (4–280 caractères).
- Réponse : `{ ok: true, ... }` ou `{ ok: true, message: "Aucune modification." }`.

### `POST /api/account/complete-profile` — finalisation, 409 si déjà complété
- Gardé test, `bodyLimit`, rate-limit `account-complete:<ip>` 10 / 10 min.
- Réservé aux profils PENDING (APPROVED → 409 `alreadyCompleted`, message i18n).
  L'email n'est jamais modifiable. Rejoue contrôles auto + régénère le profil.
- 404 si membre introuvable ; 422 Zod ; réponse 200 `{ ok, member, profile, ... }`.

### `POST /api/account/phone` — remplissage WhatsApp via ticket, toujours `{ ok: true }`
- Fichier : `src/app/api/account/phone/route.ts`. **Pas de session requise.**
  Gardé test, `bodyLimit`, rate-limit `phone-fill:<ip>` 5 / 10 min.
- Entrée : `{ memberId (≤64), phone (regex international, ≤40) }` → 422 si invalide.
- Ticket HMAC (`phone-fill-ticket.ts`, cookie posé à l'inscription) : si absent
  ou non lié au `memberId` → `{ ok: true }` **sans écrire** (pas d'oracle).
  Si valide : remplit `phone` uniquement si membre existant, non supprimé et
  sans numéro ; tous les autres cas → même `{ ok: true }` générique.

### `GET /api/account/export` — export RGPD
- Rate-limit `account-export:<ip>` 10 / 10 min.
- Réponse JSON : membre + RSVP (avec événement), enrollments ateliers,
  soumissions (+ livrable), tentatives quiz, logs email, sessions, brouillon,
  événements analytics. `Content-Disposition: attachment` (téléchargement).

### `GET /api/account/orientation`
- Recalcule l'orientation côté serveur (moteur déterministe + catalogue live
  avec repli seed, timeout 1500 ms) sans écrire.
- Réponse `{ ok, nextBestAction, orientationStatus, observedActivity,
  observedConfidence, ... }`.

### `DELETE /api/account` — suppression volontaire, confirm `SUPPRIMER`
- Rate-limit `account-delete:<ip>` 5 / 10 min. Corps `{ confirm: "SUPPRIMER" }`
  exigé → sinon 422 `CONFIRM_REQUIRED`.
- Effets : soft delete (`deletedAt`), suppression du brouillon (stoppe les
  relances), révocation de toutes les sessions (`session.deleteMany`),
  auto-blacklist de l'email, `audit("member.self-delete")`, cookies de session
  expirés. Réponse `{ ok: true, deleted: true }`.

---

## 5. EVENTS

### `GET /api/public/events` — vitrine publique (compteurs uniquement)
- Fichier : `src/app/api/public/events/route.ts`. Aucune auth.
  Rate-limit `public-events:<ip>` 60 / min.
- Query : `type`, `domain`, `limit` (défaut 20). `status=all` et `memberId`
  **ignorés** (pas de fuite de RSVP). N'expose que les événements à venir
  `scheduled`/`live` + compteurs agrégés (`interestCount` via analytics
  `event_interest`).
- Réponse `{ ok: true, events }`.

### `GET /api/events` — liste (membre ou admin, anti-IDOR)
- `getSession` + `requireAdminRole(viewer)` : il faut l'un OU l'autre
  (401 `UNAUTHENTICATED` si ni membre ni admin).
- Query : `domain`, `type`, `status` (`upcoming` défaut ; `all` réservé admin,
  sinon 403), `limit` (défaut 20, max 50), `memberId` (`me` = connecté ;
  **anti-IDOR** : valeur arbitraire honorée uniquement pour les admins, les
  membres voient toujours leurs propres RSVP).
- Réponse `{ events: [{ ..., myRsvp }] }` (RSVP joint du membre résolu).

### `POST /api/events` — création (operator + CSRF) + notify fire-and-forget
- Gardé test, rate-limit `events-create:<ip>` 10 / 10 min.
- Entrée : validée par `validateEventCreate` (`src/lib/events-validation.ts`) ;
  `notify` : booléen strict (`parseNotify` — une chaîne `"no"` ou `0` ne
  déclenche rien ; 422 sinon).
- Effets : `event.create` ; si `notify !== false` : ciblage
  `notifyWhere({ domain, level })` sur les APPROVED, envoi de masse
  **fire-and-forget** (`notifyPromise.catch` loggé, jamais bloquant),
  `audit("event.notify")`, `analyticsEvent`.
- Réponse 201 `{ ok, event, notify: { queued, ... } }`.

### `GET /api/events/[id]` — détail + mon RSVP
- Membre ou admin (même règle que la liste). Réponse `{ event, myRsvp }`
  (RSVP via clé `eventId_memberId`). 404 si absent.

### `PATCH /api/events/[id]` — modification (operator + CSRF) + renotification
- Gardé test, rate-limit `events-patch:<ip>` 20 / 10 min.
- Entrées : `type, domain, level, status, recurrence, maxAttendees, notify`
  (validées par `validateEventPatch` ; objet vide sans `notify: true` → 422
  "Rien à mettre à jour."). `notify: true` seul = renotification sans modification.
- Réponse `{ ok: true, event, notify }`. 404 si absent.

### `DELETE /api/events/[id]` — suppression (operator + CSRF)
- Gardé test (pas de rate-limit dédié). 404 si absent.
- Réponse `{ ok: true, deleted }`.

### `POST /api/events/[id]/rsvp` — RSVP membre, capacité en transaction
- Session membre requise (401), gardé test, rate-limit `rsvp:<memberId>:<ip>`
  5 / 10 min. Pas de CSRF (vérifié : imports = getSession + test-guard).
- Entrée : `{ status: going|maybe|cancelled }`.
- Capacité `maxAttendees` contrôlée **dans** la transaction (`$transaction`,
  repli historique hors transaction loggé si indisponible) : upsert sur
  `eventId_memberId`. Réponse `{ ok: true, rsvp }`.

### `DELETE /api/events/[id]/rsvp` — annuler mon RSVP
- Session membre, gardé test. 404 si aucun RSVP. Réponse `{ ok: true }`.

### `GET /api/events/notify-count` — compteur de ciblage (admin lecture)
- `isAdminAuthed`. Query `domain`, `level` (validés contre `EVENT_DOMAINS` /
  `EVENT_LEVELS`, 422 sinon). Réponse `{ count, domain, level }`
  (même filtre `notifyWhere` que l'envoi).

---

## 6. WORKSHOPS (ateliers côté membre)

Toutes exigent la session membre (401 `UNAUTHENTICATED` sinon).

### `GET /api/workshops` — liste + progression (cache 60 s)
- Rate-limit `workshops:<memberId>` 60 / min. `unstable_cache` 60 s par membre
  (tag `workshops`). Réponse `{ workshops: [{ ..., enrollment, summary, states }] }`
  (états dérivés serveur).

### `GET /api/workshops/[slug]` — détail + semaines/séances
- Rate-limit `workshop:<memberId>` 60 / min. 404 si slug inconnu ou non publié.
- Réponse `{ workshop, enrollment, summary, weeks: [{ sessions }] }`.
  Le contenu des séances verrouillées reste gated (voir route suivante).

### `POST /api/workshops/[slug]/enroll` — inscription idempotente
- Gardé test, session + `checkCSRF` (403 sinon), rate-limit
  `workshop-enroll:<memberId>` 5 / 10 min.
- `workshopEnrollment.upsert` (réinscription après `dropped` supportée),
  email de confirmation best-effort.
- Réponse `{ ok: true, enrollment: { workshopId, memberId, status, enrolledAt }, already }`.
  404 si atelier inconnu.

### `GET /api/workshops/sessions/[id]` — contenu gated
- Rate-limit `workshop-session:<memberId>` 60 / min.
- Gardes : enrollment actif (403 `NOT_ENROLLED` sinon) + déverrouillage
  (ordre/schedule ou `unlockOverride` admin). Réponse `{ session, access,
  submission: { id, score, passed, submittedAt }?, attempts: [{ id, score, ... }] }`.

### `POST /api/workshops/sessions/[id]/submissions` — livrable append-only
- Gardé test, session + CSRF, enrollment + unlock, rate-limit
  `workshop-submit:<memberId>` 10 / 10 min.
- 409 si soumission PENDING/IN_REVIEW en cours ("déjà en attente de review")
  ou livrable déjà APPROVED. Corps validé (contenu/URL selon livrable, 422 sinon).
- Réponse 201 `{ ok: true, submission }`. Jamais d'update (append-only).

### `POST /api/workshops/quizzes/[id]/attempts` — tentative scorée serveur
- Gardé test, session + CSRF, enrollment + unlock, rate-limit
  `workshop-quiz:<memberId>` 20 / 10 min.
- 409 si `maxAttempts` atteint. Scoring serveur (`scoreAttempt` + `passThreshold` ;
  réponses désalignées → 422).
- Réponse 201 `{ ok, attempt: { id, score, total, percent, passed } }` —
  **sans `perQuestion`** (volontaire : révélerait les bonnes réponses).

---

## 7. ADMIN ATELIERS (lecture + pilotage — pas de CRUD complet)

Constaté : **aucune route POST/PATCH/DELETE** sur `/api/admin/workshops` ni
`/api/admin/workshops/[id]` (lecture seule). La seule écriture atelier est le
`PATCH` session (`unlockOverride`) et la review des soumissions. Création et
suppression d'ateliers/sessions : absentes de l'API (seed/admin direct en base).

### `GET /api/admin/workshops` — liste (operator requis ici, pas viewer)
- `requireAdminRole(req, "operator")` (403 sinon), rate-limit
  `admin-workshops-list:<ip>` 120 / min. Query `status`
  (`draft|published|archived`, 422 sinon). Réponse `{ workshops, total }`.

### `GET /api/admin/workshops/[id]` — détail (operator)
- Rate-limit `admin-workshop-detail:<ip>` 120 / min. 404 si absent.
  Réponse `{ workshop (avec sessions, enrollments count) }`.

### `GET /api/admin/workshops/sessions/[id]` — lecture session (viewer+)
- `requireAdminRole(req, "viewer")`, rate-limit `admin-session-read:<ip>` 120 / min.
  Réponse `{ session }`.

### `PATCH /api/admin/workshops/sessions/[id]` — seuls `unlockOverride` + `scheduledAt`
- Gardé test, operator + CSRF, rate-limit `admin-session-write:<ip>` 30 / min.
- Entrée : `{ unlockOverride?: boolean (strict), scheduledAt?: date|null }`.
  `unlockOverride=true` lève le verrou d'ordre ; `false` reverrouille.
- Réponse `{ ok: true, session }`. 404 si absente, 422 si types invalides.

### `GET /api/admin/workshops/stats` — agrégats (operator)
- Rate-limit `admin-workshop-stats:<ip>` 120 / min.
- Réponse `{ totals (enrollments, submissions, passRate...), byWorkshop[], bySession[] }`.

### `GET /api/admin/workshops/submissions` — file de review (operator)
- Rate-limit `admin-workshop-submissions:<ip>` 120 / min.
- Query : `status` (PENDING/IN_REVIEW...), `workshopId`, `sessionId`.
  Réponse `{ submissions, total }`.

### `POST /api/admin/workshops/submissions/[id]/review` — review en transaction
- Operator + CSRF, rate-limit `admin-workshop-review:<reviewer>:<ip>` 30 / min.
- Entrée : `{ decision: APPROVED|REJECTED|... , feedback?: string }` (Zod).
- Effets en transaction : soumission + statut du livrable + progression
  enrollment ; `audit`, email au membre. Réponse `{ ok: true, review, submission }`.
  404 si absente.

---

## 8. ADMIN MENTORING

### `GET /api/admin/mentoring` — vues `leads|mentors|match` (operator)
- `requireAdminRole(req, "operator")` (403 sinon). Pas de `blockIfTesting`
  sur le GET (lecture).
- `?view=leads` (rate `admin-mentoring-leads` 120/min) : membres éligibles
  + suivis en tant que mentoré. `?view=mentors` (rate `admin-mentoring-mentors`
  120/min) : mentors + `activeMentees` (count). `?view=match&menteeId=`
  (rate `admin-mentoring-match` 60/min, 422 si `menteeId` absent, 404 si
  mentoré introuvable) : mentors compatibles scorés.
- Réponses `{ leads, total }` / `{ mentors, total }` / `{ mentee, matches[] }`.

### `POST /api/admin/mentoring` — `assign|contacted|end` (operator + CSRF)
- Gardé test.
- `assign` (rate `admin-mentoring-assign` 30/min) : `{ mentorId, menteeId,
  frequency }` ; 422 si identiques ; 404 si membre supprimé/absent ; 409 si
  suivi ACTIVE/PAUSED existant. → 201 `{ ok, mentorship }`.
- `contacted` (rate `admin-mentoring-contacted` 60/min) : `{ memberId }` →
  `mentorContactedAt = now`. → `{ ok, member }`.
- `end` (rate `admin-mentoring-end` 60/min) : `{ mentorshipId }` →
  `ENDED` + `endedAt` (idempotent : renvoie le suivi tel quel si déjà terminé).
- Chaque action : `audit("mentoring.<action>")`. Action inconnue → 422
  "action requise : assign | contacted | end".

---

## 9. ADMIN EMAIL

### `POST /api/admin/test-email` — envoi de test (operator + CSRF)
- Gardé test, rate-limit `admin-test-email:<ip>` 5 / 10 min.
- Entrée : `{ email, templateKey?/subject?/body? }` (Zod, email normalisé
  minuscules). Réponse `{ ok, sent }`. Échec provider → `sent: false`
  (pas de 500 : le résultat est dans le corps).

### `POST /api/admin/import-invite` — CSV → membres + invitations
- Gardé test, operator + CSRF, rate-limit `import-invite:<ip>` 5 / 10 min.
- Entrée : `{ csvText (≤ CSV_MAX_BYTES), confirm?: boolean (défaut false) }`.
- Sans `confirm` : **dry-run** (aucune écriture, aucun email) →
  `{ dryRun, valid, invalid, sample[5] }`.
- Avec `confirm: true` : **plafond 200 lignes** (`MAX_CONFIRM_ROWS`,
  400 au-delà — timeouts) → création membres + envois séquentiels
  (pause Resend 4/s), `{ ok, created, sent, failed, ... }`.

### `POST /api/admin/announce-dashboard` — annonce par lots paginés
- Gardé test, operator + CSRF, rate-limit `announce-dashboard:<ip>` 5 / 10 min.
- Entrée : `{ confirm? (défaut false), limit? (1–25, défaut 15), offset? }`.
- Sans `confirm` : dry-run `{ dryRun: true, total, limit }`. Avec :
  `{ sent, failed, nextOffset, done }` (pause Resend entre envois).
  Pas de garde one-shot côté API : la reprise se fait par `offset`
  (l'unicité d'une campagne repose sur l'appelant).

### `POST /api/invite/relance` — relance OTP ciblée (admin lecture suffit)
- Gardé test, **`isAdminAuthed`** (tout rôle, pas d'operator ni CSRF),
  rate-limit `invite-relance:<ip>` 5 / 10 min.
- Entrée : `{ memberIds: string[1..50], confirm?: boolean (défaut false) }`.
- Dry-run : `{ dryRun: true, eligible, alreadyRelanced, requested, sample[5] }`.
  Confirmé : `requestSignInOtp(email)` + lien `/verify-otp` par membre éligible
  (non relancé récemment) → `{ ok, sent, failed, total, skippedRelanced }`.

### `GET /api/admin/email-log` — journal des envois (admin lecture)
- `isAdminAuthed`. Query : `search` (≤120), `status?`, `page`, `pageSize`
  (1–100, défaut 25). Réponse `{ logs, total, page, pageSize, totalPages }`.

### `GET /api/admin/member-emails` — emails d'un membre (admin lecture)
- `isAdminAuthed`. Query : `memberId` (requis, ≤40). Réponse `{ emails }`
  (historique d'envois au membre). 422 si absent.

### `GET /api/admin/email-deliverability` — agrégats de délivrabilité (admin lecture)
- `isAdminAuthed`. Query : `days` (1–365, défaut 30).
- Réponse `{ totals: { sent, delivered, bounced, complained, bounceRate },
  byDay[] (7 derniers jours détaillés), byTemplate[] }`.
  Aucune métrique de "retard" explicite dans le code lu (ni seuil 24 h ni
  heartbeat) : les signaux de fraîcheur passent par `/api/admin/cron-health`
  (stale = 2× la fréquence attendue) et le cron `email-alerts`.

### `GET /api/admin/email-ops` — débit et file (admin lecture)
- `isAdminAuthed`. Query : `batchSize` (1–1000, défaut 48),
  `minutes` (5–1440, défaut 60). Réponse `{ throughput, pending, budget, ... }`
  (fenêtre glissante d'envois, garde budget Resend).

### `GET /api/admin/email-templates` — liste + variables (viewer+)
- `requireAdminRole(req, "viewer")`. Réponse `{ templates: [{ key, ... }],
  variables: [{ key, label, kind }] }` (variables built-in + custom).

### `POST /api/admin/email-templates` — créer (operator + CSRF)
- Gardé test. Entrée : `{ key, name (2–120), subject (1–200),
  preheader? (≤200), bodyHtml? (≤ MAX_BODY_HTML) }`.
- 409 si clé existante. → 201 `{ ok, template, warnings }`.

### `GET /api/admin/email-templates/[key]` — détail (viewer+)
- 404 si clé inconnue. Réponse `{ template }`.

### `PATCH /api/admin/email-templates/[key]` — modifier (operator + CSRF)
- Gardé test, rate-limit `email-template-write:<ip>` 30 / min.
- Entrées partielles (`subject`, `preheader`, `bodyHtml`, ...). Réponse
  `{ ok, template }`. Pas de DELETE (CRUD partiel : pas de suppression).

### `POST /api/admin/email-templates/preview` — rendu (viewer+ + CSRF)
- `requireAdminRole(viewer)` + `checkCSRF` (échec CSRF → 403 `CSRF_FAILED`
  ad-hoc) + rate-limit `email-template-preview:<ip>` 120 / min.
- Entrée : `{ key, subject, preheader, bodyHtml }`. Réponse `{ html }`
  (rendu avec variables d'exemple, sans envoi).

---

## 10. ADMIN PILOTAGE

### `GET /api/admin/dashboard` — agrégat isolé (admin lecture)
- `isAdminAuthed`. Query optionnelles : `deliveryDays`, `batchSize`,
  `throughputMinutes` (propagées aux sous-requêtes).
- Chaque source (stats, funnel, emailStats, deliverability, emailOps,
  cronHealth, audience, adminAlerts) est chargée **isolément** : une source
  en panne → `null` + entrée dans `errors`, jamais de 500 global.
- Réponse `{ ok, generatedAt, stats|funnel|emailStats|emailDeliverability|
  emailOps|cronHealth|audience|adminAlerts (ou null), errors? }`.

### `GET /api/stats` (+ alias `GET /api/admin/stats`)
- `src/app/api/admin/stats/route.ts` = **ré-export** (`export { GET } from "../../stats/route"`).
  `isAdminAuthed`, échec → 401 `{ error }` ad-hoc. Query : `period`
  (`week|month`, défaut `month`), `compare=true?`.
- Réponse `{ totals, curve[], compare? }` (membres, activation, RSVP...).

### `GET /api/stats/cohort` — cohortes hebdo (admin lecture)
- `isAdminAuthed` (401 `{ error: "Unauthorized" }` ad-hoc). SQL brut :
  `date_trunc('week', createdAt)` → `cohort` (format ISO `IYYY-IW`),
  triées DESC. Réponse `[{ cohort, size, activated, rate }]`.

### `POST /api/analytics` — ingestion publique anti-empoisonnement
- Fichier : `src/app/api/analytics/route.ts`. Gardé test, `bodyLimit`,
  rate-limit `analytics:<ip>` 120 / 10 min. Réponses d'échec aveugles :
  400/422/429 → `{ ok: false }` (sans détail, pour ne pas aider les bots ;
  erreur DB → 200 `{ ok: false }`).
- Entrée : `{ type: enum(26 types), sessionId?, memberId?, ref?, value? }`
  (voir 10.3 pour la liste). **Anti-empoisonnement** : `memberId` ignoré
  sauf s'il égale la session en cours ; anonymes → toujours `null`.
- Succès : `{ ok: true }`. Effet : `analyticsEvent.create`.

### `GET /api/analytics` — funnel + timing (admin lecture)
- `isAdminAuthed` (401 ad-hoc). Query `period`, `compare` (comme /stats).
- Agrégations (`take: 5000`) : funnel (started/completed/WhatsApp/completionRate),
  drop-off par question, **timing** (`samples, avgMs, p50Ms, p95Ms` par question).
- Réponse `{ totals, funnel, dropoff[], timing[], compare? }`.

### Types d'événements analytics (26, `src/lib/analytics.ts`)
`reboot_page_view`, `reboot_cta_clicked`, `profiling_started`,
`profiling_question_answered`, `profiling_question_timed`, `profiling_back`,
`profiling_resumed`, `profiling_completed`, `profiling_abandoned`,
`orientation_evaluated`, `next_best_action_clicked`, `recommendation_viewed`,
`recommendation_expanded`, `primary_recommendation_clicked`,
`secondary_recommendation_clicked`, `discovery_to_action`,
`profile_completion_cta_clicked`, `email_verified`, `profil_generated`,
`community_cta_clicked`, `whatsapp_join_clicked`, `share_profile_clicked`,
`status_change_email_sent`, `event_interest`, `event_rsvp`.

### `GET /api/admin/activity` — activité récente (operator)
- `requireAdminRole(req, "operator")` (403 sinon). Query `limit`.
  Réponse `{ events: [...] }` (événements enrichis membre/admin).

### `GET /api/admin/activity-logins` — connexions (admin lecture)
- `isAdminAuthed`. Réponse `{ logins: [{ email, at, ... }], total }`.

### `GET /api/admin/audit-log` — journal d'audit (operator) + CSV
- `requireAdminRole(req, "operator")`. Query `limit`, `format=json|csv`.
- JSON : `{ logs: [...], total }`. `?format=csv` : `text/csv` en
  téléchargement (`audit-log-<ts>.csv`).

### `GET /api/admin/cron-health` — fraîcheur des cron (admin lecture)
- `isAdminAuthed`. Statut par cron : `ok` (jamais exécuté mais sans
  fréquence attendue → `manual`/`never`), **`stale` si âge > 2×
  `expectedEveryH`**, sinon `ok`. Réponse `{ ok: true, crons: [{ key,
  lastRunAt, ageMs, expectedEveryH, status }] }`.

### `GET /api/admin/blacklist` — liste (operator)
- `requireAdminRole(operator)` (403 ad-hoc). Query : `page`, `perPage`,
  `reason`, `search`, `onlyActive=true?`. Réponse paginée `{ entries, total, ... }`.

### `POST /api/admin/blacklist` — ajouter (operator + CSRF)
- Rate-limit `admin-blacklist-add:<ip>` 10 / 10 min.
- Entrée : `{ email, reason, note? }`. Réponse `{ ok: true, id, email }`.

### `PATCH /api/admin/blacklist/[id]` — modifier (operator + CSRF)
- Entrée partielle (`reason`, `note`, `active?`). Réponse `{ ok: true, entry }`.

### `DELETE /api/admin/blacklist/[id]` — retirer (operator + CSRF)
- Réponse `{ ok: true, removed: email }`.

### `GET /api/admin/activation` — taux d'activation (operator)
- `requireAdminRole(operator)`, rate-limit `admin-activation:<ip>` 120 / min.
- Query `days` (1–90, défaut 30). Réponse `{ rate, activated, eligible,
  curve[], inactifs }` (inactifs 7 j).

### `GET /api/admin/invitations` — dashboard invitations (admin lecture)
- `isAdminAuthed`. Query : `status?`, `page` (défaut 1),
  `pageSize` (1–100, défaut 50). Réponse `{ stats, invitations[], total, page, pageSize }`.

### `GET /api/email-stats` — stats emails/relances (admin lecture)
- `isAdminAuthed`. Agrège `AnalyticsEvent` (`email.opened`, `email.clicked`
  croisés aux emails de relance). Réponse `{ sent, opened, clicked,
  relanceOpened, relanceClicked, ... }`.

---

## 11. CRON (`GET` uniquement, Bearer + verrou consultatif)

Régime commun (vérifié dans chaque fichier) : `Authorization: Bearer
<CRON_SECRET>` (ou `CRON_SECRET_PREVIOUS`, fenêtre de grâce avec `console.warn`),
comparaison **temps constant** (`timingSafeEqual`, `src/lib/cron-auth.ts`).
Secret absent des deux côtés → 401 `{ ok: false }` (ou `{ ok: false, error:
"...non configuré..." }`). Chaque cron prend un `pg_advisory_xact_lock(clé)`
(libéré en fin de transaction, `pg_advisory_unlock` best-effort en sortie) :
deux runs qui se chevauchent sont sérialisés. Pas de rate-limit, pas de garde test.

| Route | Lock | Effet |
|---|---|---|
| `GET /api/cron/relance` | 123457 | Relance brouillons abandonnés (vagues J+7/J+15/J+30, `take: 50`) → `{ ok, sent7, sent15, sent30, errors }` |
| `GET /api/cron/event-reminders` | 123456 | Rappels aux inscrits des événements imminents → `{ ok, sentTotal, ... }` |
| `GET /api/cron/activation-relance` | 123460 | Relance inactifs (`take: 50`) → `{ ok, sent, errors }` |
| `GET /api/cron/collect-metrics` | **123459** | Agrège les métriques du jour → `{ ok, date, result }` ; erreurs via `AuthError`/`AppError` (pas de `{ ok:false }` ad-hoc) |
| `GET /api/cron/email-alerts` | 123458 | Alertes délivrabilité (bounce/seuils) → `{ ok, ... }` |
| `GET /api/cron/admin-alerts` | **123459** | Alertes admin (pannes, files) → `{ ok, ... }` |
| `GET /api/cron/health-alert` | aucun (lecture seule : `checkDb` + `checkMail`, écrit un signal) | Statut `ok/degraded/down` (même règle que /health) → `{ ok: true, status }` (+ alerte si down) |
| `GET /api/cron/keepalive` | aucun (simple `checkDb`) | → `{ ok, latencyMs }` |

**Collision de verrou constatée** : `admin-alerts` et `collect-metrics`
utilisent la **même clé 123459** — ces deux cron se sérialisent mutuellement
au lieu de tourner en parallèle (probable copier-coller ; à corriger hors de ce document).

---

## 12. WEBHOOKS

### `POST /api/webhooks/resend` — événements Resend (signature Svix)
- Vérifie `resend-signature` (repli `svix-signature`), format
  `t=timestamp,v1=...` (HMAC). Secret configuré + signature invalide → 401 ;
  **secret absent en production → 503 fail-closed** (`Webhook not configured`) ;
  en dev uniquement : vérification sautée (warn). JSON invalide → 400.
- Effets : met à jour le statut des emails (`delivered`, `bounced`, `complained`,
  `opened`, `clicked`), `analyticsEvent`, métriques. Réponse `{ ok: true }`,
  500 en cas d'erreur interne.

### `POST /api/webhooks/brevo` — événements Brevo (`?secret=`)
- Brevo ne signe pas : auth par query `?secret=` comparée en **temps constant**
  à `BREVO_WEBHOOK_SECRET` (jamais loggée). Secret invalide/absent → **404
  `{ error: "Not found" }`** (leurre, pas 401/403). JSON invalide → 400,
  payload inconnu → 422.
- Effets : mêmes écritures que Resend (statuts + analytics + métriques).
  Réponse `{ ok: true }`, 500 sinon.

---

## 13. DIVERS

### `POST /api/consents` — choix RGPD append-only
- Gardé test, rate-limit `consents:<ip>` 30 / 10 min.
- Entrée : `{ email? (optionnel — absent → "anonymous"), purpose, value }`.
  **Jamais d'update** : chaque choix crée une ligne. → 201 `{ ok: true, consent }`.

### `GET /api/consents` — dernier choix (lecture)
- Gardé test (lecture gardée aussi), rate-limit `consents-read:<ip>` 60 / 10 min.
- Query : `email` (requis), `purpose?`. Dernier (`orderBy createdAt desc`).
  Réponse `{ ok: true, consent|null }`.

### `POST /api/verify-email` — demander le lien magique
- Rate-limit `verify-email:<ip>` 5 / 10 min. Entrée `{ email, firstName? }`.
- Cooldown : lien déjà envoyé → 429 `COOLDOWN` (`{ retryInSec }`).
  Envoi fire-and-forget (échec provider → ok quand même, cooldown actif).
  Réponse `{ ok: true, message: "Lien envoyé..." }`.

### `GET /api/verify-email` — valider le lien (usage unique)
- Query `token` (absent → 422 `INVALID_LINK`). Rate-limit
  `verify-email-verify:<ip>` 10 / 10 min.
- Expiré → 422 `EXPIRED` ; invalide → 422 `INVALID_LINK`.
  Réponse `{ ok: true, verified: true, email, message: "Email vérifié." }`.

### `GET /api/check-email` — sonde constante anti-énumération
- Rate-limit `check-email:<ip>` 10 / 10 min. **Toujours** `{ exists: false }`,
  sans requête DB (l'ancien oracle `{ exists: true/false }` a été neutralisé ;
  aucun client ne consommait le champ).

### `POST /api/invite/refuse` — route inerte anti-énumération
- Rate-limit `invite-refuse:<ip>` 10 / 10 min. Le corps est seulement validé
  en forme (Zod, ignoré ensuite) ; **toujours** 403 `{ error: "Lien invalide
  ou expiré." }`. Aucune écriture, aucun oracle.

### `GET /api/invite/refuse` — page HTML statique
- Renvoie une page HTML de confirmation ("Invitation refusée") ; le flux réel
  ne passe pas par cette route (affichage uniquement, pas de JS).

### `GET /api/community/join` — entrée unique vers WhatsApp (redirect)
- Session membre requise : anonyme → redirect `/login?next=/api/community/join`.
  **Pas de rate-limit** (vérifié : aucun appel `rateLimit` dans le fichier).
- Effets (best-effort, transaction) : `communityStatus → JOINED` + `joinedAt`
  + `analyticsEvent (whatsapp_join_clicked)` + `audit("member.community-join")`.
- Puis redirect vers l'URL WhatsApp officielle (liens directs interdits ailleurs).

### `GET /api/community/count` — compteur public (preuve sociale)
- Aucune auth. Rate-limit `community-count:<ip>` 30 / 10 min.
- Compte les vrais inscrits (`deletedAt: null`, `invitationStatus: NOT_INVITED`,
  `profileStatus ∈ {APPROVED, PENDING}`). Réponse `{ count }`
  (`Cache-Control: public, s-maxage=60, stale-while-revalidate=300`).

### `GET /api/profile/[id]` — profil public restreint
- Rate-limit `profile:<ip>` 30 / 10 min. 404 `{ error: "Profil introuvable." }`
  ad-hoc si absent. Réponse `{ profile }` (champs publics uniquement —
  même philosophie que la route share).

### `POST /api/profiling/draft` — brouillon d'abandon (upsert idempotent)
- Rate-limit `draft:<ip>` 30 / 10 min. Pas de garde test (écriture volontaire
  en test ? — le fichier n'importe pas `blockIfTesting`).
- Entrée : `{ email (≤200), answers: Record<clé≤80, string|string[]>
  (≤ MAX_DRAFT_KEYS clés, ≤ MAX_DRAFT_JSON_BYTES), lastQuestionId?,
  sessionId?, sourceUTM? }` — bornes anti-abus (F1 : `z.unknown()` interdit).
- `profilingDraft.upsert` par email (clé de relance). Échecs : 400/422
  `{ ok: false }`, DB → 200 `{ ok: false }` ; succès `{ ok: true }`.

### `GET /api/export` — CSV admin (plafond 2000)
- `isAdminAuthed`, rate-limit `export:<ip>` 20 / 10 min.
- Query : mêmes filtres que la liste membres (`domain`, `country`, `level`,
  `mentoring`, `budget`, `status`, `lane`, `type`, ...), `take: MAX_EXPORT`.
- `text/csv` en téléchargement + `truncated: true` si total > 2000.

### `GET /api/export/json` — JSON admin (plafond 2000)
- `isAdminAuthed` (+ `getAdminRole` pour enrichissement), rate-limit
  `export-json:<ip>` 20 / 10 min. Mêmes filtres. Réponse `{ members, total,
  truncated }`.

### `GET /api/health` — sonde publique minimale
- Rate-limit `health:<ip>` 30 / 10 min. `checkDb()` + `checkMail()` en parallèle.
- `status = down` si DB coupée (→ **503**), `degraded` si clé mail limitée
  (→ 200), `ok` sinon (→ 200). Réponse volontairement réduite
  `{ status, latencyMs }` (`Cache-Control: no-store`) — identique pour
  public et admin (pas de fuite infra).

### `GET /api` — hello-world
- Fichier : `src/app/api/route.ts`. Aucune auth, aucune logique.
  Réponse `{ message: "Hello, world!" }`.

---

## 14. Comportements de sécurité volontaires (récapitulatif)

- **Routes publiques aveugles** : `check-email` (constante `{ exists: false }`,
  sans DB), `account/phone` (`{ ok: true }` dans tous les cas, écriture
  conditionnée au ticket HMAC), `invite/refuse` POST (inerte, 403 constant),
  `analytics` POST (`{ ok: false }` sans détail ; `memberId` client ignoré
  sauf égalité session), `profiling/draft` (réponses `{ ok: false }` génériques).
- **Alias assumé** : `GET /api/admin/stats` = ré-export de `GET /api/stats`
  (un seul code, deux chemins).
- **Pas de streaming** : aucun `ReadableStream`/SSE constaté dans les routes ;
  les envois de masse (events notify, announce, import-invite, relance, cron)
  sont fire-and-forget ou séquentiels avec pause, jamais streamés au client.
- **Secrets jamais loggés** : `cron-auth` et webhook Brevo comparent en temps
  constant sans logger valeurs ni longueurs ; `CRON_SECRET_PREVIOUS` n'émet
  qu'un warn générique.
- **Soft-delete partout** : `member` n'est jamais supprimé physiquement
  (account, admin [id], bulk) ; blacklist auto-ajoutée à chaque suppression.
- **Écritures tracées** : `audit()` sur suppressions, statuts, bulk, invites,
  mentoring, events notify, community-join, templates, review, import.

## 15. Écarts relevés entre la description de la tâche et le code (le code fait foi)

1. `blockIfTesting` → **403** `TESTING_GUARD`, pas 503.
2. Admin ateliers : **lecture seule** (`GET` liste + détail) — pas de POST/PATCH/DELETE ;
   seules écritures : `PATCH` session (`unlockOverride`/`scheduledAt`) et review.
3. `POST /api/members/bulk` : **sans `checkCSRF`** (seule écriture admin/membre
   dans ce cas) — lacune à trancher.
4. Lock **123459 partagé** entre `cron/admin-alerts` et `cron/collect-metrics`
   (sérialisation mutuelle involontaire probable).
5. Analytics : **26 types** énumérés (pas 28) ; `GET` analytics = funnel + timing
   (take 5000), réservé admin.
6. CSRF : code `FORBIDDEN` + message "CSRF validation failed." partout, **sauf**
   `email-templates/preview` qui utilise `CSRF_FAILED` ad-hoc.
7. `GET /api/community/join` : **aucun rate-limit** (redirect + écriture best-effort).
8. `POST /api/profiling/draft` : **sans `blockIfTesting`** (seule écriture non gardée).
9. `email-deliverability` : aucune métrique "retard ≤ 24 h" trouvée — fraîcheur
   couverte par `cron-health` (stale = 2× `expectedEveryH`) et le cron `email-alerts`.
10. `announce-dashboard` : pas de garde one-shot côté API — lots paginés
    (`limit` 1–25, `offset`, `nextOffset`, `done`) ; l'unicité de campagne
    repose sur l'appelant.
11. Formes d'erreur ad-hoc (sans `code`) sur quelques routes : `GET /api/stats`,
    `GET /api/stats/cohort`, `GET /api/profile/[id]`, `POST /api/admin/logout`,
    `POST /api/admin/blacklist*` (403 `{ error }`), `GET /api/admin/email-deliverability`.
12. `POST /api/events/[id]/rsvp` : pas de `checkCSRF` (session + rate-limit par membre uniquement).
