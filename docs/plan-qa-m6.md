# Plan QA M6 — gaps #215 (bulk-CSRF, Turnstile, verify-schema, CI, proof)

Objectif : fermer les 6 gaps validés sans toucher aux pages légales, à
`community/join`, `WHATSAPP_URL`, `cron/event-reminders`, `orientation`,
ni aux artefacts générés (`playwright-report/`, `test-results/`).

Chaque critère ci-dessous est vérifiable par une commande. Statuts :
`VERT` (prouvé localement), `CI` (prouvé par la CI), `EN ATTENTE`
(action extérieure requise).

## 1. Bulk-CSRF : POST /api/members/bulk → 403 sans Origin — VERT

- Code : `checkCSRF(req)` après `requireAdminRole(req, "operator")`
  (`src/app/api/members/bulk/route.ts`, calque `members/[id]` PATCH/DELETE).
- Preuve : `node --test tests/unit.test.cjs` (bloc "admin CSRF wiring").
- Vérification manuelle : POST sans header `Origin` avec cookie operator →
  `403 { code: "FORBIDDEN", error: "CSRF validation failed." }`.

## 2. Turnstile POST /api/members — VERT (dev) / CI (prod)

- Code : `src/lib/turnstile.ts` (`extractTurnstileToken`, `shouldBypassTurnstile`,
  `verifyTurnstile`) + appel avant toute écriture DB dans `POST /api/members`.
  Token via champ body optionnel `turnstileToken`, jamais bloquant côté client.
- Matrice :
  - dev (clé absente + `NODE_ENV != production`) : fail-open — warn + skip,
    aucun appel réseau si le client n'envoie pas de token. VERT :
    `npx tsx --test tests/turnstile.test.ts` (12 cas).
  - prod (clé absente, token absent, vérif KO ou erreur réseau) : fail-closed —
    403 `ForbiddenError`, membre non créé. VERT en logique (mêmes 12 cas),
    preuve réseau réelle = CI (job `integration`, serveur en `development` →
    fail-open, donc vert sans clé).
- Activation prod (EN ATTENTE, hors code) : poser `TURNSTILE_SECRET_KEY` +
  `NEXT_PUBLIC_TURNSTILE_SITE_KEY` (cf. `.env.example`), charger le widget
  côté client, puis POST sans token → 403 et aucun `Member` créé.

## 3. Légaux réels — EN ATTENTE infos éditeur

- Pages existantes (NON touchées) : `cgu`, `confidentialite`, `cookies`,
  `mentions-legales` sous `src/app/[locale]/`.
- Critère de sortie : textes validés par l'éditeur (identité, contact DPO,
  durées de conservation) puis relecture `node scripts/check-messages.mjs`.

## 4. Restore backup.sh — VERT (dev) ou procédure ci-dessous

- Preuve VERT (2026-10-08) : `pg_restore --list` OK sur
  `backups/20261008-130736.dump` (96K, lecture seule, sans Docker) puis
  `backup.sh restore` sur stack **dev** (projet `hashcode-reboot-dev`, base
  `hashcode_reboot_dev`, via `POSTGRES_DB=hashcode_reboot_dev`) → 4 membres,
  36 tables, identique au comptage prod en lecture seule (4). Stack dev
  arrêtée après (`down`). La prod n'a jamais été visée (projet Compose et
  base distincts ; conteneurs prod restés `Up` en continu).
- Procédure reproductible (ne touche que dev) :
  1. `docker compose -p hashcode-reboot-dev --env-file .env.dev -f compose.dev.yml up -d postgres`
  2. `pg_restore --list < backups/<dernier>.dump` (intégrité, lecture seule)
  3. `COMPOSE_PROJECT_NAME=hashcode-reboot-dev ENV_FILE=.env.dev COMPOSE_FILE=compose.dev.yml ./scripts/backup.sh restore backups/<dernier>.dump` (confirmer `RESTAURER`)
  4. `docker compose -p hashcode-reboot-dev ... exec -T postgres psql -U hashcode -d hashcode_reboot_dev -tAc 'SELECT count(*) FROM "Member"'`
  5. `docker compose -p hashcode-reboot-dev ... down` (rend l'environnement)

## 5. Health degraded accepté — VERT (documenté)

- `/api/health` renvoie `status: "degraded"` quand la clé Resend est
  "sending only" (401 sur `/domains` mappé `limited` dans `src/lib/health.ts`) :
  c'est voulu, et `deploy.sh` ne teste que le code de sortie, donc le
  déploiement passe. DB coupée → 503 (bloquant, voulu).
- Critère : `degraded` + code 200 = OK ; seul `503` bloque.

## 6. Validate + integration verts — CI

- `validate` (inchangé) : `typecheck + lint + test:unit + 3 suites
  orientation + check-messages`. Les tests #215 tournent dedans
  (`unit`, `acquisition-foundation`, `account-rgpd`).
- `integration` (nouveau, `.github/workflows/ci.yml`) : service Postgres 16
  éphémère → `prisma migrate deploy` → `node --test tests/integration.test.cjs`.
  Aucune condition secrets (DB fournie par le service, secret Better Auth
  factice) ; `needs: [validate]` ; autres jobs inchangés.
- Commandes locales : `bun run typecheck`, `npm run test:unit`,
  `npx tsx --test tests/turnstile.test.ts`, `node scripts/check-messages.mjs`.

## Écarts connus

- `docs/api-reference.md` § bulk mentionne encore "sans checkCSRF" : doc
  non retouchée (hors scope du gap), à mettre à jour à part.
