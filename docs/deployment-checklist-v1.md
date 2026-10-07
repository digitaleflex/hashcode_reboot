# Checklist de déploiement — Reboot V1 (orientation engine)

Branche : `development` → preview Vercel d'abord, `main` ensuite.
Objectif : valider le build production (non vérifiable en sandbox) et la
Next Best Action de bout en bout avant toute communication publique.

## 1. Variables d'environnement (dashboard Vercel, Preview + Production)

| Variable | Requise | Notes |
|---|---|---|
| `POSTGRES_PRISMA_URL` | Oui | Poolée (runtime) |
| `POSTGRES_URL_NON_POOLING` | Oui | Directe (migrations CLI) |
| `NEXT_PUBLIC_WHATSAPP_URL` | Oui | Inlinée navigateur (welcome.tsx) — build cassé si absente |
| `WHATSAPP_URL` | Oui | Serveur (prioritaire) |
| `RESEND_API_KEY` / `EMAIL_FROM` | Oui | Transactionnel |
| `CRON_SECRET` | Oui | Bearer keepalive `/api/cron/keepalive`, 32 octets hex |
| `BETTER_AUTH_SECRET` / `BETTER_AUTH_URL` | Oui | OTP + liens magiques |
| `NEXT_PUBLIC_SITE_URL` | Oui | Emails, OG, sitemap |
| `SENTRY_DSN` / `NEXT_PUBLIC_SENTRY_DSN` | Optionnel | Monitoring erreurs |
| `BREVO_FALLBACK_ON_429` | Optionnel | `=1` si fallback Brevo actif |

## 2. Base de données

- [ ] `prisma migrate deploy` passe (7 migrations, dernière : `email_event_budget_idx`).
  Le `vercel-build` le fait automatiquement (`prisma generate && prisma migrate deploy && next build`).
- [ ] Rôle admin posé : `Member.adminRole = "operator"` via `scripts/seed-admin-role.ts`
  (fail-closed : `null` = aucun accès).
- [ ] Publier 3–5 activités réelles (condition de qualité des recommandations) :
  workshops `status = "published"` + events `status = scheduled/live` avec
  `domain`/`level` renseignés. Sans elles, le moteur retombe sur le seed statique.

## 3. Build & smoke tests (preview)

- [ ] `next build` vert sur Vercel (échec sandbox local : exit 143, mémoire —
  non représentatif, à confirmer ici).
- [ ] `GET /api/health` → `{ status: "ok" }` (200 ; 503 si DB down).
- [ ] Parcours inscription complet avec un profil Builder débutant Web :
  `POST /api/members` renvoie `nextBestAction` + `orientationStatus: "OK"`.
- [ ] La carte « Prochaine étape » s'affiche dans l'écran de bienvenue
  (lanes immediate ET pending).
- [ ] Membre connecté : `GET /api/account/orientation` renvoie
  `nextBestAction` + `observedActivity: false` (profil neuf) — jamais de scores.
- [ ] Vérifier qu'aucune réponse API n'expose `scores` / `confidence`
  (recherche : `scores`, `confidence` dans les payloads JSON).
- [ ] Cron keepalive : job cron-job.org toutes les 4 min vers
  `/api/cron/keepalive` avec le bearer (ou service `cron` interne sur VPS —
  jamais les deux, sinon double exécution).

## 4. Calibration post-lancement (2–4 semaines, données réelles)

- [ ] Part des statuts `OK` / `INSUFFICIENT_DATA` / `NO_MATCH` sur les inscriptions.
- [ ] Taux de `nextBestAction` non-null.
- [ ] Ajuster `RECOMMENDATION_MIN_SCORE` (0.3) et
  `NEXT_ACTION_CONFIDENCE_THRESHOLD` (0.4) selon les observations.
- [ ] Ajuster les poids d'archétypes (`scoring.ts`) si un profil domine abusivement.
- [ ] Incrémenter `ORIENTATION_ENGINE_VERSION` à chaque changement de règles
  (traçabilité des recommandations passées).

## 5. Rollback

- [ ] En cas de régression orientation : le `try/catch` de `POST /api/members`
  garantit l'inscription même si le moteur échoue (`NO_MATCH`).
- [ ] Rollback code = redeploy du commit précédent (`591801d` = M3 stable,
  `b3910d9` = M4, `bb10cd2` = M5). Aucune migration destructive liée au moteur
  (aucune table créée par M1–M5).
