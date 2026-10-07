# Checklist de déploiement — Reboot V1 (orientation engine, VPS)

Cible : VPS Docker (Traefik + compose.yml). Plus de Vercel.
Référence : `docs/deploiement-docker.md` (architecture, scripts, diagnostic).
Branche : `development` → valider en `dev` (`compose.dev.yml`) si besoin, puis `prod`.

## 1. Fichier `.env` sur le VPS (chmod 600, jamais commité)

```bash
cp .env.example .env && chmod 600 .env
```

À remplir impérativement :

| Variable | Rôle |
|---|---|
| `PUBLIC_HOST` | domaine sans `https://` (routage Traefik) |
| `PUBLIC_URL` | domaine avec `https://` (Better Auth, emails) |
| `POSTGRES_PASSWORD` | `openssl rand -base64 24` |
| `BETTER_AUTH_SECRET` | `openssl rand -base64 32` |
| `ADMIN_OPERATORS` | ton email (virgule si plusieurs) |
| `BREVO_API_KEY` / `RESEND_API_KEY` | sans quoi aucun OTP ne part |
| `CRON_SECRET` | `openssl rand -base64 32` (crons internes) |
| `NEXT_PUBLIC_WHATSAPP_URL` / `WHATSAPP_URL` | communauté (client inliné + serveur) |
| `NEXT_PUBLIC_SITE_URL` | emails, OG, sitemap |

Rappel : les `NEXT_PUBLIC_*` sont inlinées au build → tout changement impose
`docker compose build --no-cache web`. Jamais de secret dedans.

## 2. Déploiement

```bash
./scripts/deploy.sh prod
```

Le script : sauvegarde auto → build image → `migrate deploy` →
`verify-schema` → `ensure-admin` → démarrage. Il s'arrête au premier échec.
`migrate` doit sortir en code 0, sinon `web` ne démarre pas (voulu).

Premier admin : `ensure-admin` pose `operator` pour `ADMIN_OPERATORS`
uniquement si le membre existe déjà (sinon : première connexion `/login`,
puis redéployer ou `docker compose exec web node --import tsx scripts/ensure-admin.ts`).

Publier ensuite 3–5 activités réelles (condition de qualité des
recommandations) : workshops `published` + events `scheduled`/`live` avec
`domain`/`level` renseignés. Sans elles, le moteur retombe sur le seed statique.

## 3. Build & smoke tests (sur le VPS, pas en sandbox)

Le build sandbox local échoue (mémoire) — le build de référence est celui de
l'image Docker sur le VPS.

- [ ] `docker compose logs migrate` : migrations appliquées, code 0.
- [ ] `curl -sI https://<domaine>/` → 200.
- [ ] `curl -s https://<domaine>/api/health` → `{ status: "ok" }`.
- [ ] Parcours inscription complet (profil Builder débutant Web) :
  `POST /api/members` renvoie `nextBestAction` + `orientationStatus: "OK"`.
- [ ] Carte « Prochaine étape » visible dans l'écran de bienvenue
  (lanes immediate ET pending).
- [ ] Membre connecté : `GET /api/account/orientation` → `nextBestAction`,
  `observedActivity: false` (profil neuf) — jamais de `scores`/`confidence`.
- [ ] Crons internes : `docker compose exec cron cat /etc/crontabs/nextjs`,
  puis `docker compose logs cron` → `[cron] <slug> OK`. DÉSACTIVER les jobs
  cron-job.org s'ils existent encore (sinon double exécution).

## 4. Sauvegardes

- Dump quotidien auto via le service `cron` (`pg-backup`, rotation incluse).
- Manuel : `./scripts/backup.sh` (sauvegarde, list, verify, restore).
- Copier les `.dump` hors du VPS (`rsync`) — un backup sur la machine qui
  tombe ne protège de rien.

## 5. Calibration post-lancement (2–4 semaines, données réelles)

- [ ] Part des statuts `OK` / `INSUFFICIENT_DATA` / `NO_MATCH`.
- [ ] Taux de `nextBestAction` non-null.
- [ ] Ajuster `RECOMMENDATION_MIN_SCORE` (0.3), `NEXT_ACTION_CONFIDENCE_THRESHOLD`
  (0.4), poids d'archétypes (`scoring.ts`) selon les observations.
- [ ] Incrémenter `ORIENTATION_ENGINE_VERSION` à chaque changement de règles.

## 6. Mise à jour & rollback

Mise à jour : `./scripts/backup.sh` → `git pull` → `docker compose up -d --build`.
Si `migrate` échoue : `docker compose logs migrate`, jamais de suppression
manuelle dans `_prisma_migrations` (utiliser `prisma migrate resolve`).

Rollback code : redeployer le commit précédent (`591801d` = M3 stable,
`b3910d9` = M4, `bb10cd2` = M5). Aucune migration destructive liée au moteur
M1–M5. En cas de doute données : `./scripts/backup.sh restore <fichier>`
(demande confirmation).
