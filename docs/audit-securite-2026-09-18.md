# Audit de sécurité — 2026-09-18

> Périmètre : branche `development`, code applicatif + configuration +
> dépendances. Interface **admin exclue de l'inventaire fonctionnel** mais
> **incluse** pour ses contrôles d'accès. Méthode : lecture directe du code
> (extraits `fichier:ligne` pour chaque finding), exécution de `npm audit`,
> forensique git des branches. Audit statique — pas d'intrusion en direct.
>
> Deux passes : exposition/données/XSS/config, puis OTP/sessions/CSRF/routes.
> Correctifs appliqués en 5 lots, gate `npm run validate` vert après chaque
> lot (typecheck 0, lint 0 erreur, tests 247/247 au final).

## 0. Décision structurante : ne jamais merger les branches sécurité

| Branche | Base | Main depuis | Diff vs main |
|---|---|---|---|
| `security/email-enum` | `ac21a22` (05/09) | **150 commits** | 242 fichiers, +8 578 / **−49 011** |
| `origin/fix-quality-issues` | `458876d` (07/09) | **99 commits** | 140 fichiers, +633 / −19 526 |
| PR #54 `fix-admin-passcode-hashing` | (ancienne) | — | 198 fichiers, +8 269 / −38 413 |

Preuve (`git ls-tree security/email-enum`) : `src/app/login/page.tsx`,
`src/app/dashboard/page.tsx`, `src/middleware.ts`, `src/lib/account-auth.ts`
**n'existent plus** sur ces branches — elles ont forké les 5-7 septembre,
**avant que l'application actuelle n'existe**. Les merger effacerait
~40 000 lignes. Le contenu récupérable a été ré-appliqué au cas par cas
sur `development` (voir §2) ; le reste (rewrite `admin-auth` DB-backed
`ed44382`, PR #54) est obsolète face à l'architecture actuelle, jugée saine.

## 1. Findings et statut

| # | Gravité | Finding | Statut |
|---|---|---|---|
| S1 | CRITICAL | `invite/accept` : brute-force OTP sans rate limit ni compteur → prise de compte (la route recréait un OTP frais dans la redirect) | ✅ corrigé (`c9df5a2`) |
| S2 | HIGH | `invite/refuse` : même surface + sabotage d'invitation (REFUSED + révocation) | ✅ corrigé (`c9df5a2`) |
| S3 | HIGH | `account/phone` : écriture non authentifiée sur membre arbitraire | ✅ corrigé — ticket HMAC (`5305ece`) |
| F1 | MAJEUR | `profiling/draft` : `answers: z.unknown()` sans borne, upsert par email, pas de bodyLimit | ✅ corrigé — schéma strict + bodyLimit (`e0cb7ed`) |
| F2 | MAJEUR | `mail.ts` : `location`/`description` bruts dans l'email de masse | ✅ corrigé — `escapeHtml()` (`e0cb7ed`) |
| F3 | MAJEUR | `GET /api/events` : `memberId` arbitraire → lecture RSVP d'autrui | ✅ corrigé — admin-only (`5305ece`) |
| F4 | MINEUR | `check-email` : oracle `{ exists }` (la normalisation timing ne compensait rien) | ✅ corrigé — réponse constante (`63f6b9f`) |
| F5 | MINEUR | `accessLane` (interne) exposé sur `/profile/[id]` (sans rate-limit) et `/members/[id]/share` | ✅ retiré des deux + type client (`63f6b9f`) |
| F6 | MINEUR | `analytics` : `memberId` client stocké tel quel | ✅ honoré seulement si = session (`63f6b9f`) |
| F10 | INFO | `next-auth` déclaré, jamais importé (avis CRITICAL) | ✅ supprimé (`10df577`) |
| F11 | Dette | 25 vuln. dépendances → **23** après F10 + bump `uuid` 11.1.1 (GHSA-w5hq-g745-h8pq) | ⚠️ partiel (`9446146`) — reste en §3 |
| S4 | MEDIUM | Sessions = `cuid()` comme bearer token (entropie < 128 bits) | ⏳ différé — migration `tokenHash` |
| S5 | MEDIUM | `request-magic-link` : messages différenciés (oracle) + oracle temporel | ⏳ différé — uniformisation |
| S6 | MEDIUM | Blacklist non consultée par l'auth (sessions actives + reconnexion possibles) | ⏳ différé — décision produit |
| S7-S10 | LOW | Token verify-email en clair dans Redis ; CSRF membre = SameSite seul ; OTP en query param ; fallback mémoire verify-email | ⏳ différé — durcissement |
| F7 | MINEUR | `bodyLimit` basé sur `Content-Length` (contournable en chunked) | ⏳ différé — comptage d'octets |
| F8/F11-rate | À VÉRIFIER | `rateKey` (1ʳᵉ entrée XFF) — sûr derrière Vercel, à confirmer si auto-hébergé | ⏳ à tester en préprod |

## 2. Correctifs appliqués (commits)

| Commit | Contenu | Gate |
|---|---|---|
| `c9df5a2` | Lot A — rateLimit 10/IP/10min + compteur `attempts` partagé (`MAX_OTP_ATTEMPTS=3`) + révocation + erreurs uniformes + usage unique sur accept ; `deletedAt` vérifié ; token borné 64 car. | ✅ 205/205 |
| `5305ece` | Lot B — ticket HMAC `memberId.expiry.signature` (cookie httpOnly 15 min, clé `PHONE_FILL_SECRET` sinon `DATABASE_URL`, fail-closed), posé à la création fraîche uniquement ; capture masquée sur doublons ; `memberId` arbitraire réservé aux admins | ✅ 205/205 |
| `e0cb7ed` | Lot C — `escapeHtml()` location/description ; draft strict (record ≤60 clés, string≤1000 / string[]≤20 / number / boolean / null, JSON ≤32 Ko) + `bodyLimit` | ✅ 205/205 |
| `63f6b9f` | Lot D — check-email constante ; `accessLane` retiré (API + type) ; `memberId` analytics = session | ✅ 231/231 |
| `10df577` | Lot E/1 — suppression `next-auth` (zéro usage prouvé par grep) + resync `bun.lock` périmé | ⚠️ gate bloqué par le chantier workshop d'une autre session, puis vert |
| `9446146` | Lot E/2 — `uuid` 11.1.0 → 11.1.1 via bun | ✅ 247/247 |

Décisions de design notables :
- **Pas de session exigée sur `account/phone`** : elle casserait l'écran de
  résultat post-inscription. Le ticket HMAC prouve la possession du
  navigateur d'inscription sans session, sans secret obligatoire, sans
  changement d'UX.
- **Pas de `npm audit fix` global** : il brasserait 96 paquets sur
  `package-lock.json` alors que `bun.lock` fait foi, pendant qu'une autre
  session travaille. Correctifs chirurgicaux uniquement.
- **`check-email` neutralisée plutôt que supprimée** : aucun appelant UI
  (reprise via `?resume=1`), seul le manifeste de santé la référence.

## 3. Dette restante (ordre suggéré)

1. **Montées majeures** : `next`, `sharp` 0.35.4 (libvips/libheif),
   `react-syntax-highlighter` 16, `@mdxeditor/editor`, `lodash`,
   `prisma` — une par une, avec tests, jamais en aveugle.
2. **S4** : colonne `tokenHash` (`randomBytes(32)`) pour les sessions
   (migration + double lecture transitoire).
3. **S5/S6** : uniformiser `request-magic-link` ; appliquer la blacklist
   dans `getSession` (ou soft-delete + `destroyAllSessions` au blacklistage).
4. **Svix** : le fix `a29d11f` (bien écrit) cible l'ancien webhook de
   ~100 lignes ; le webhook actuel (437+ l.) vérifie déjà une signature
   HMAC en fail-closed — lecture comparée avant toute ré-implémentation.
5. **Durcissement** : `checkCSRF` sur routes membres, nonces CSP
   (`unsafe-inline` actuel), comptage d'octets dans `bodyLimit`.
6. **Restaurer knip** au merge main→development (retiré de `validate`
   car script inexistant ; ses findings seront résolus par ce merge).
7. **Hygiène** : purger les 6 branches déjà mergées, fermer PR #3
   (bundle ECC redondant), clore PR #54 après réécriture TS si besoin.

## 4. Zones vérifiées propres

Injection SQL (zéro interpolation) · XSS React (1 `dangerouslySetInnerHTML`
sur JSON-LD statique) · render templates email (`escapeHtml` + `sandbox=""`) ·
webhooks (signatures vérifiées) · crons (`Bearer` + `timingSafeEqual`) ·
`logout` (révocation base + cookie) · `verify-otp` (anti-énumération, usage
unique) · `test-guard` (fail-closed) · 27 handlers admin/members/export/stats
(tous avec `isAdminAuthed`/`requireAdminRole`) · secrets (aucun en clair,
`.env` ignorés) · SSRF (aucun fetch sur entrée utilisateur) · open redirect
(`next` validé) · `/api/public/events`, `/api/community/count` (pas de PII).

## 5. Références

- `src/app/api/invite/accept|refuse/route.ts`, `src/app/api/account/phone/route.ts`,
  `src/lib/phone-fill-ticket.ts`, `src/app/api/profiling/draft/route.ts`,
  `src/lib/mail.ts:1423-1424`, `src/app/api/events/route.ts:36-42`,
  `src/app/api/check-email/route.ts`, `src/app/api/profile/[id]/route.ts`,
  `src/app/api/members/[id]/share/route.ts`, `src/app/api/analytics/route.ts`.
- `docs/interface-utilisateur.md` (inventaire UI), `docs/espace-membre.md`.
