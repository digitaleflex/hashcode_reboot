# Rotation des secrets (runbook)

Ordre sûr : du moins impactant au plus critique. Ne jamais commiter `.env.prod`
(il est gitignoré). Ne jamais imprimer un secret : pour vérifier sa présence,
`printenv VAR | wc -c` (jamais `echo $VAR`). Les commandes ci-dessous utilisent
des placeholders `<...>` — jamais de valeur réelle dans un terminal partagé.

## 1. Webhooks dédiés (Resend, Brevo)

Secrets à coordination externe (`RESEND_WEBHOOK_SECRET`, `BREVO_WEBHOOK_SECRET`,
`TURNSTILE_SECRET_KEY`). Changer d'abord côté dashboard du provider, poser la
nouvelle valeur dans `.env.prod`, puis recréer le conteneur web :

```sh
docker compose -p hashcode-reboot --project-directory "$PWD" --env-file .env.prod -f compose.yml up -d web
```

Vérifier la réception d'un webhook (logs `docker compose logs web`), puis
révoquer l'ancien secret côté provider.

## 2. CRON_SECRET (fenêtre de grâce bornée)

Les 8 routes `/api/cron/*` acceptent `CRON_SECRET` **ou** `CRON_SECRET_PREVIOUS`
(comparaison à temps constant, voir `src/lib/cron-auth.ts`). Rotation sans
coupure :

```sh
# 1. Générer le nouveau secret (ne pas le copier ailleurs qu'en place)
openssl rand -base64 32   # → <NOUVEAU_SECRET>

# 2. Dans .env.prod : CRON_SECRET_PREVIOUS=<ANCIEN_SECRET>, CRON_SECRET=<NOUVEAU_SECRET>
# 3. Recréer cron + web (les deux lisent le secret : le cron appelle, le web vérifie)
docker compose -p hashcode-reboot --project-directory "$PWD" --env-file .env.prod -f compose.yml up -d cron web

# 4. Vérifier : le cron tourne encore avec l'ancien secret, puis avec le nouveau
docker compose -p hashcode-reboot --project-directory "$PWD" --env-file .env.prod -f compose.yml exec cron call-cron keepalive
# Les logs web qui affichent "[cron-auth] secret précédent utilisé" confirment la grâce.

# 5. BORNER la fenêtre : vider CRON_SECRET_PREVIOUS dans .env.prod, recréer, revérifier
docker compose -p hashcode-reboot --project-directory "$PWD" --env-file .env.prod -f compose.yml up -d cron web
```

`CRON_SECRET_PREVIOUS` ne doit jamais rester renseigné en permanence.

## 3. Clés mail (Resend, Brevo)

`RESEND_API_KEY`, `BREVO_API_KEY` : impact direct sur les OTP et les envois.
Poser la nouvelle clé dans `.env.prod`, recréer `web`, puis **tester un envoi
réel** (connexion par code sur un compte de test) avant de révoquer l'ancienne
clé. En cas de doute sur la délivrabilité, voir `/api/health` (statut mail).

## 4. BETTER_AUTH_SECRET (heures creuses uniquement)

Invalide **TOUTES** les sessions actives : tout le monde est déconnecté.
À faire en heures creuses, après annonce. Poser la nouvelle valeur, recréer
`web`, se reconnecter, contrôler les sessions.

## 5. DATABASE_URL / POSTGRES_PASSWORD (en dernier)

Jamais sans backup vérifié :

```sh
./scripts/backup.sh backup
# Contrôler la présence du backup (B2) avant toute rotation
```

Changer `POSTGRES_PASSWORD` + `DATABASE_URL` ensemble (même mot de passe des
deux côtés), recréer `postgres` + `web` + `cron` + `migrate`, vérifier
`/api/health` (DB `ok`) puis le dashboard.
