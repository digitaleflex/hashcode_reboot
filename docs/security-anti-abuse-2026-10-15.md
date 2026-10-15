# Anti-abus point d'entrée — audit et durcissement (#118, 2026-10-15)

## 1. Correctifs du lot
| Route | Ajout | Pourquoi |
|---|---|---|
| `GET /api/community/join` | `rateLimit(community-join, 30/10min)` **avant** `getSession` + `code: RATE_LIMITED` | Écritures DB (`$transaction` + audit) à chaque hit ; le flood est coupé sans toucher la base |
| `POST /api/verify-email` | `blockIfTesting()` | Envoi d'emails : aucun envoi en mode TESTING |

## 2. Matrice de couverture (vérifiée dans le code le 2026-10-15)
Légende : RL = rate-limit, V = validation Zod serveur, BT = blockIfTesting, TS = Turnstile.

| Endpoint public en écriture | Auth | RL | V | BT | TS | Notes |
|---|---|---|---|---|---|---|
| `POST /api/members` (création) | non | ✅ 5/10min | ✅ | ✅ | ❌ retiré (décision produit) | endpoint le plus coûteux : rate-limit seul |
| `POST /api/verify-email` (envoi lien) | non | ✅ 5/10min + cooldown | ✅ | ✅ (ce lot) | — | fire-and-forget, réponse `ok` générique |
| `GET /api/verify-email` (confirm) | non | ✅ bucket dédié | ✅ token | — (lecture+confirm idempotente) | — | usage unique |
| `POST /api/consents` | non | ✅ | ✅ | ✅ | — | anti-énumération |
| `POST /api/analytics` | non | ✅ | ✅ | ✅ | — | événementiel, pas de PII |
| `POST /api/profiling/draft` | session | ✅ | ✅ | ✅ | — | reprise brouillon |
| `POST /api/check-email` | non | ✅ | ✅ | ✅ | — | réponse générique (anti-énumération) |
| `POST /api/account/phone` | ticket HMAC | ✅ 5/10min | ✅ | ✅ | — | réponse `{ok:true}` générique |
| `POST /api/account/*` (autres) | session (middleware 401) | ✅ | ✅ | ✅ | — | `/orientation` exclu (chantier `development` en cours) |
| `POST /api/workshops/*/enroll|submit|attempt` | session | ✅ | ✅ | ✅ | — | 401 sans session (couvert en intégration) |
| `GET /api/community/join` | session | ✅ (ce lot, avant DB) | — (pas de corps) | — (flux légitime, voir §4) | — | audit sans PII, idempotent |
| `POST /api/invite/refuse` | non | ✅ 10/10min | forme (inerte) | — (aucune écriture) | — | route inerte anti-énumération |
| `POST /api/auth/*` (Better Auth) | — | ✅ budget 5/10min partagé | ✅ | n/a | — | 6e appel → 500 (documenté dans le fichier d'intégration) |
| Webhooks brevo/resend | signature fournisseur | — (voir §4) | ✅ signature | — | — | HMAC fournisseur, pas d'acquisition |

## 3. Posture anti-bot (décision produit — Turnstile RETIRÉ)
- **Turnstile supprimé** (lib, gate `POST /api/members`, tests, vars d'env) : il
  bloquait 100 % des inscriptions en prod (clés jamais configurées, fail-closed).
- Seul le **rate-limit** protège la création (5/IP/10min). Pas de captcha :
  conversion et reprise jamais bloquées.
- **Réactiver si spam constaté** (signes : vagues de `POST /api/members` 200/IP
  tournantes, emails jetables en masse) : recâbler `verifyTurnstile` + clés
  Cloudflare. En attendant, surveiller `admin_announce_dashboard`/logs signup.

## 4. Choix assumés (non-corrections)
- Pas de `blockIfTesting` sur `community/join` : flux GET légitime ; la suite
  d'intégration ne le touche pas en mode TESTING ; le rate-limit suffit.
- Pas de rate-limit sur webhooks : signatures HMAC bon marché à vérifier ;
  un bucket trop agressif risquerait de faire perdre des événements fournisseur.
  Réévaluer avec métriques.
- `/api/account/orientation` non touchée : conflit de merge ouvert avec `development`.

## 5. Logs sans PII (revue)
- `rate-limit.ts` : un seul `console.warn` (panne Redis, objet erreur technique).
- `turnstile.ts` : warns sans email/IP/token (messages statiques + `err.message` technique).
- `community/join` : reçu d'audit explicite **sans PII** (`granted`/`missing-or-withdrawn`).

## 6. Preuves
- `tests/anti-abuse.test.ts` : 6/6 (quota→429, 429 non révélatrice, 422 stable,
  TESTING→403, Turnstile prod refusé / dev accepté sans réseau).
- `tests/integration.test.cjs` : 37/37 dont `community/join` trafic normal (3×307/308)
  et rafale 35 hits → 429 + `Retry-After` + `code RATE_LIMITED`.
