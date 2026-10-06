# Déploiement Docker + PostgreSQL natif

Auto-hébergement de HASHCODE REBOOT derrière un **Traefik déjà en place** sur le VPS.

---

## Architecture

```
                        Internet
                           │ 443
                    ┌──────▼──────┐
                    │   Traefik   │  certificat Let's Encrypt automatique
                    └──────┬──────┘
                           │ réseau « proxy » (externe)
        ┌──────────────────┼──────────────────┐
        │                  │                  │
  ┌─────▼─────┐      ┌─────▼─────┐      ┌─────▼─────┐
  │    web    │      │  migrate  │      │ postgres  │
  │  :3000    │      │  one-shot │      │  interne  │
  └─────┬─────┘      └───────────┘      └─────┬─────┘
        │                                       │
        └───────── réseau « internal » ─────────┘
                     (aucun port publié)
    ┌─────────────────────────────────────────┐
    │  cron — crons internes + pg-backup      │
    │  (remplace cron-job.org et le service   │
    │   backup : appelle web en HTTP interne) │
    └─────────────────────────────────────────┘
```

**Aucun port n'est publié sur l'hôte.** Seuls Traefik (80/443) et Postgres en local (5432 en dev) écoutent.

---

## Prérequis sur le VPS

- **Docker** + **Docker Compose** v2
- **Traefik** en route, avec le provider Docker activé
- Le réseau partagé existe :

```bash
docker network ls | grep proxy     # → PROXY  doit apparaître
```

S'il n'existe pas, crée-le **une seule fois** :

```bash
docker network create proxy
```

> Les labels de `compose.yml` supposent que le réseau s'appelle `proxy`.
> Si le tien porte un autre nom, change `name: proxy` dans la section `networks`.

Vérifie aussi que ton Traefik a bien `certificatesresolvers.letsencrypt` défini, et un entrypoint nommé `websecure`.

---

## Mise en production

### 1. Fichier `.env`

```bash
cp .env.example .env
```

À remplir impérativement :

| Variable | Rôle |
|---|---|
| `PUBLIC_HOST` | domaine, **sans** `https://` (routage Traefik) |
| `PUBLIC_URL` | domaine **avec** `https://` (Better Auth, emails) |
| `POSTGRES_PASSWORD` | `openssl rand -base64 24` |
| `BETTER_AUTH_SECRET` | `openssl rand -base64 32` — **jamais** le même que l'ancien |
| `ADMIN_OPERATORS` | ton email, séparé par des virgules |
| `BREVO_API_KEY` / `RESEND_API_KEY` | sans quoi **aucun code OTP ne part** |
| `CRON_SECRET` | `openssl rand -base64 32` — Bearer des crons internes (service `cron`) |

```bash
chmod 600 .env
```

### 2. Premier lancement

```bash
./scripts/deploy.sh prod
```

Le script sauvegarde d'abord, construit l'image, applique les migrations, puis
démarre l'app. Il s'arrête au premier échec. Pour deploying à la main :

```bash
docker compose up -d --build
docker compose logs -f migrate      # doit afficher les migrations appliquées
```

`migrate` doit sortir avec le code 0. **Si `web` ne démarre pas, c'est presque toujours `migrate` en échec** — l'app attend son succès (`service_completed_successfully`).

### 3. Créer le premier admin

Le rôle vit dans la base, pas dans l'environnement. Un membre avec `adminRole = null` n'est pas admin :

Automatique. Le service `migrate` enchaîne trois étapes, et le seed admin
fait partie de la chaîne :

```
migrate deploy → verify-schema → ensure-admin
```

`scripts/ensure-admin.ts` pose `adminRole = "operator"` pour chaque email de
`ADMIN_OPERATORS`, **seulement si le membre existe déjà**. Il ne crée jamais de
ligne `Member` : les champs `firstName`, `country`, `level` et `goal` sont
`NOT NULL`, une création manuelle produirait un profil incohérent.

Un compte encore absent est donc ignoré — le rôle sera posé au prochain
déploiement, après sa première connexion via `/login`.

Pour l'exécuter seul :
```bash
docker compose exec web node --import tsx scripts/ensure-admin.ts
```
curl -sI https://ton-domaine.fr/            # 200
curl -s  https://ton-domaine.fr/api/health   # JSON
```

---

## Sauvegardes

Le dump quotidien (`pg_dump -Fc` + vérification `pg_restore --list` +
rotation) est la tâche `pg-backup` du service `cron` (voir section
« Crons » ci-dessous). L'ancien service `backup` (boucle `sleep 86400`) a
été supprimé : son rythme dérivait à chaque redémarrage.

`scripts/backup.sh` reste l'outil **manuel** depuis l'hôte (sauvegarde
immédiate, pre-deploy de `scripts/deploy.sh`, restore, list, verify).
Doublon voulu : le cron fait le quotidien automatique, le script sert quand
il faut agir à la main.

```bash
./scripts/backup.sh              # sauvegarde immédiate
./scripts/backup.sh list         # lister
./scripts/backup.sh verify <f>   # contrôler l'intégrité
./scripts/backup.sh restore <f>  # restaurer (demande confirmation)
```

`verify` contrôle le dump avec `pg_restore --list` avant de le déclarer valide. **Une sauvegarde jamais testée n'est pas une sauvegarde.**

Copie les `.dump` **hors du VPS**. Un backup sur la même machine qui tombe ne protège de rien :

```bash
rsync -avz user@vps:/chemin/backups/ ./backups-locaux/
```

---

## Crons

Les 5 tâches HTTP (`/api/cron/*` : keepalive, collect-metrics, email-alerts,
relance, event-reminders) et le dump `pg-backup` tournent dans le service
`cron` — plus sur cron-job.org (SaaS tiers, 5 configs manuelles à maintenir
à la main, et un appel par le domaine public via Traefik).

Le crontab est GÉNÉRÉ depuis le registre `src/lib/cron/registry.ts` par
`scripts/generate-crontab.ts`, à CHAQUE démarrage du conteneur (voir
l'entrypoint dans le Dockerfile, étape `cron`). Ne jamais l'éditer à la main
dans le conteneur : le redémarrage suivant l'écraserait. Le secret
(`CRON_SECRET`) n'y figure jamais : il vit en chmod 600 dans
`/run/cron/secret`, lu par le wrapper `call-cron`.

Vérifier le crontab installé :

```bash
docker compose exec cron cat /etc/crontabs/nextjs
```

Lire les logs d'un passage (chaque `call-cron` y écrit `[cron] <slug> OK…`
ou `ECHEC…` — busybox crond n'enregistrant rien d'exploitable par défaut,
le wrapper redirige explicitement vers la sortie du conteneur) :

```bash
docker compose logs cron
docker compose logs -f cron     # en continu
```

Après une modification du planning (`src/lib/cron/registry.ts`),
reconstruire l'image cron — le crontab régénéré au boot vient du registre
EMBARQUÉ dans l'image :

```bash
docker compose build cron && docker compose up -d cron
```

### Bascule depuis cron-job.org (checklist, une seule fois)

1. Déployer et attendre `cron` démarré : `docker compose ps cron`.
2. Vérifier un passage dans les logs (`[cron] <slug> OK`).
3. DÉSACTIVER les 5 jobs cron-job.org — sinon double exécution (relances
   envoyées deux fois, métriques collectées deux fois).
4. Surveiller la santé des crons au dashboard admin le lendemain.

---

## Développement

```bash
./scripts/deploy.sh dev
```

Ou manuellement : `docker compose -f compose.dev.yml up -d --build`

Base **séparée** (`hashcode-postgres-dev-data`), port 5432 sur `localhost` uniquement, pas de Traefik. Un `migrate reset` en dev ne peut pas toucher la prod : les volumes sont distincts et nommés explicitement.

---

## Variables `NEXT_PUBLIC_*`

Elles sont **inlinées dans le bundle au build**. Changer l'une implique :

```bash
docker compose build --no-cache web
```

Elles ne sont jamais des secrets — ne jamais y mettre de valeur sensible.

---

## Mise à jour

```bash
./scripts/deploy.sh prod
```

La sauvegarde est automatique. En manuel, l'ordre compte :
`./scripts/backup.sh` → `git pull` → `docker compose up -d --build`.

Si `migrate` échoue, **l'app ne redémarre pas** — c'est voulu. Diagnostique avant de forcer :

```bash
docker compose logs migrate
```

> ⚠️ Une migration en échec laisse l'entrée correspondante dans
> `_prisma_migrations` avec `finished_at = NULL`, et **bloque toutes les
> suivantes** (erreur P3009). Ne supprime jamais cette ligne à la main ;
> utilise `prisma migrate resolve`.

---

## Diagnostic

```bash
./scripts/deploy.sh status               # services, volumes, sauvegardes
./scripts/deploy.sh logs                 # logs applicatifs
docker network inspect proxy             # web est-il sur le réseau ?
```

**`/admin` redirige vers `/login` en boucle** → aucun membre n'a `adminRole`. Relancer le seed.

**Aucun email OTP reçu** → `BREVO_API_KEY` / `RESEND_API_KEY` absente ou `EMAIL_FROM` non vérifié.

**502 de Traefik** → l'app ne répond pas. `docker compose ps` montre si elle tourne ; vérifier aussi que le réseau partagé porte bien le nom `proxy`.

---

## Variables supprimées de l'ex Migré Vercel

Le système de **clés API admin** et de **passcode** a été retiré au profit d'un rôle en base (`Member.adminRole`). Ces variables ne sont plus lues par le code et peuvent être supprimées :

```
ADMIN_PASSCODE   ADMIN_KEYS   ADMIN_KEY_ROTATION_DAYS
```