# Acquisition Contracts (#210 Foundation)

Faits vérifiés sur `main` — aucun modèle créé (arbitrage C1 : REUSE partout).
Référence frontière : `docs/architecture/reboot-joinhashcode-boundary.md`.

## 1. Modèles réutilisés (zéro table créée)

| Modèle (`prisma/schema.prisma`) | Rôle acquisition | Clé / invariant |
|---|---|---|
| `Member` (l.22) | Prospect ; Lead = vue (Member non converti) | `email @unique` (l.30) ; lien Better Auth via `userEmail` sans FK (l.98) |
| `ProfilingDraft` (l.357) | Brouillon d'abandon (relance) | `email @unique` (l.359) ; `sessionId`/`sourceUTM` optionnels (l.365-368) |
| `AnalyticsEvent` (l.257) | Événements d'acquisition | `type` = String libre, validé applicatif (`src/lib/analytics.ts`) |
| `Consent` (l.399) | Choix RGPD, append-only (create seul) | Pas de FK Member (l.402) ; courant = dernier `createdAt` pour (email, purpose) |
| `Qualification` (l.424) | Snapshot figé par complétion, append-only | Jamais `@unique` sur memberId ; courant = dernier `createdAt` |
| `MemberEmailLog` (l.313) | Anti-doublon envois par lot | `@@index([memberId, kind])` (l.331) via `src/lib/member-email-log.ts` |

Pas de `Lead` / `LeadSource` / `AcquisitionSession` / `Conversion` / `AcquisitionEvent`.

## 2. Statuts et transitions

- `profileStatus` : `PENDING | APPROVED | REJECTED | WAITLIST` (défaut `PENDING`, l.84).
- `communityStatus` : `NOT_INVITED | INVITED | JOINED` (défaut `NOT_INVITED`, l.85).
- `invitationStatus` : `NOT_INVITED | INVITED | ACCEPTED | REFUSED | BOUNCED | EXPIRED` (l.101) + timestamps `invitedAt` / `joinedAt` / `acceptedAt` / `approvedAt`.
- `accessLane` : `immediate | pending` (résultat `runAutoControls`, l.86).
- Funnel : VISITOR → ACQUISITION → LEAD → QUALIFICATION → CONVERSION → HANDOFF → ECOSYSTEM.
- Handoff = contrat (statuts + timestamps + `admin_invite` / `whatsapp_join_clicked`), jamais rejoué côté Reboot.

## 3. Index utilisés

- `Member` : `email`, `source`, `profileStatus`, `communityStatus`, `invitationStatus`, `createdAt`, `deletedAt`, `[profileStatus, deletedAt]` (l.126-136).
- `AnalyticsEvent` : `[type]`, `[sessionId]`, `[createdAt]` (l.272-274) — attribution par jointure `sessionId`/`memberId`.
- `Consent` : `[email, purpose, createdAt]` (l.417). `Qualification` : `[memberId, createdAt]` (l.440).
- `ProfilingDraft` : `[sessionId]`, `[completedAt, relanceSentAt, createdAt]` (relance J+7, l.379-382).

## 4. Règles d'écriture

- Toute écriture publique est validée Zod, rate-limitée, auditée best-effort jamais bloquant (boundary règle 6).
- `POST /api/members` : `blockIfTesting` + `bodyLimit` + 5 req/IP/10 min ; dedup email (pré-check + course P2002 → `200 duplicate`) ; `source` normalisée (`normalizeSource`, alias `""` → `direct`) ; `profil_generated` + `Qualification` en `allSettled`.
- `POST /api/consents` : `blockIfTesting` + `bodyLimit` + 30 req/IP/10 min ; create seul, email absent → marqueur `anonymous` (`src/lib/consents.ts`) ; lecture = `findFirst orderBy createdAt desc` (miroir pur : `pickLatestConsent`).
- `POST /api/profiling/draft` : `blockIfTesting` + `bodyLimit` + 30 req/IP/10 min ; `upsert where email` (idempotent) ; answers bornées (60 clés, 32 Ko) ; n'écrase jamais `sessionId`/`sourceUTM` avec du vide.
- `POST /api/account/phone` : `blockIfTesting` + `bodyLimit` + 5 req/IP/10 min ; ticket HMAC lié au memberId (`phone-fill-ticket`) sinon réponse générique sans écriture ; remplissage unique (`!member.phone`, pas d'écrasement).
- `POST /api/analytics` : `blockIfTesting` + `bodyLimit` + 120 req/IP/10 min ; `z.enum(EVENT_TYPES)` (26 types funnel) ; `memberId` client honoré seulement s'il égale la session (anti-empoisonnement).
- Écritures serveur : `toServerEventData` (`src/lib/analytics.ts`, union `SERVER_EVENT_TYPES` = 26 publics + 16 `SERVER_ONLY_*` admin/cron/onboarding) — plus aucune création directe non validée ; `POST /api/analytics` n'accepte jamais les types serveur.
- Lots : exclusion préalable via `memberIdsWithEmailLog` avant envoi, `logMemberEmail` après envoi.
