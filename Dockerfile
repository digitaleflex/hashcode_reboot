# syntax=docker/dockerfile:1
#
# HASHCODE REBOOT — build self-hosted
#
# Le projet active déjà `output: "standalone"` dans next.config.ts quand
# VERCEL n'est pas défini, ce qui produit un serveur Node autonome avec un
# traces de dépendances minimales. On s'appuie dessus au lieu d'un node_modules
# complet : image finale bien plus légère et surface d'attaque réduite.

# ─── Étape 1 : dépendances ────────────────────────────────────────────────
FROM node:22-alpine AS deps
WORKDIR /app

# libc6-compat est requis par le client Prisma sur musl.
RUN apk add --no-cache libc6-compat

COPY package.json package-lock.json* ./
# `npm ci` exige le lockfile. `--ignore-scripts` car le postinstall
# `prisma generate` n'a rien à faire ici : le client sera généré à l'étape
# build, une fois le schéma présent.
RUN npm ci --ignore-scripts

# ─── Étape 2 : build ──────────────────────────────────────────────────────
FROM node:22-alpine AS builder
WORKDIR /app

RUN apk add --no-cache libc6-compat
COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Le client Prisma doit pointer sur le schéma pour que le code compilé
# embarque les types corrects.
RUN npx prisma generate

# NEXT_PUBLIC_* sont inlinés dans le bundle au moment du build : ils doivent
# être présents ici, sinon ils vaudront undefined dans le navigateur.
# They ne sont pas des secrets — ne jamais y mettre de valeur sensible.
ARG NEXT_PUBLIC_SITE_URL
ARG NEXT_PUBLIC_URL
ARG NEXT_PUBLIC_APP_VERSION
ARG NEXT_PUBLIC_WHATSAPP_URL
ARG NEXT_PUBLIC_MEET_URL
ARG NEXT_PUBLIC_SENTRY_DSN
ARG NEXT_PUBLIC_TURNSTILE_SITE_KEY
ENV NEXT_PUBLIC_SITE_URL=$NEXT_PUBLIC_SITE_URL \
    NEXT_PUBLIC_URL=$NEXT_PUBLIC_URL \
    NEXT_PUBLIC_APP_VERSION=$NEXT_PUBLIC_APP_VERSION \
    NEXT_PUBLIC_WHATSAPP_URL=$NEXT_PUBLIC_WHATSAPP_URL \
    NEXT_PUBLIC_MEET_URL=$NEXT_PUBLIC_MEET_URL \
    NEXT_PUBLIC_SENTRY_DSN=$NEXT_PUBLIC_SENTRY_DSN \
    NEXT_PUBLIC_TURNSTILE_SITE_KEY=$NEXT_PUBLIC_TURNSTILE_SITE_KEY \
    NEXT_TELEMETRY_DISABLED=1

# VERCEL absent => next.config.ts active le mode standalone.
RUN npm run build

# ─── Étape cron : ordonnanceur interne ────────────────────────────────────
# Base postgres:16-alpine : busybox `crond` ET `pg_dump` déjà dedans, aucune
# image supplémentaire à maintenir. Cette étape DOIT rester AVANT `runner` :
# la cible par défaut du build (`docker build -t hashcode-reboot:local .`
# dans scripts/deploy.sh) est la DERNIÈRE étape, et c'est `runner` qui doit
# le rester pour que l'image de `web` ne change pas.
FROM postgres:16-alpine AS cron
WORKDIR /app

# tzdata : sans les fichiers zoneinfo, musl ignore TZ=Africa/Porto-novo et
# les heures du crontab seraient en UTC, silencieusement.
# nodejs : exécute le générateur `scripts/generate-crontab.ts` au boot.
# su-exec : l'entrypoint démarre en root (permissions des volumes hérités de
# l'ancien service `backup` qui tournait en root) puis redescend vers nextjs
# AVANT de lancer crond — crond et les jobs tournent en non-root.
RUN apk add --no-cache tzdata nodejs su-exec \
 && addgroup --system --gid 1001 nodejs \
 && adduser --system --uid 1001 nextjs \
 && mkdir -p /etc/crontabs /run/cron /backups \
 && chown nextjs:nodejs /etc/crontabs /run/cron /backups \
 && chmod 700 /run/cron \
 && command -v crond || ln -s /bin/busybox /usr/sbin/crond

# Le générateur lit le registre hors de scripts/ (src/lib/cron/registry.ts) :
# sans ce COPY, `node --import tsx scripts/generate-crontab.ts` crashe au
# boot sur un import introuvable. Même trio que `runner`, plus le registre.
COPY --from=builder --chown=nextjs:nodejs /app/scripts ./scripts
COPY --from=builder --chown=nextjs:nodejs /app/node_modules/tsx ./node_modules/tsx
COPY --from=builder --chown=nextjs:nodejs /app/tsconfig.json ./tsconfig.json
COPY --from=builder --chown=nextjs:nodejs /app/src/lib/cron ./src/lib/cron

# call-cron, pg-backup et l'entrypoint sont écrits ICI plutôt que dans des
# fichiers du dépôt : l'image reste autonome, aucun bind-mount nécessaire
# sur le VPS. Délimiteur quoté ('SCRIPT') : aucune expansion au build, le
# contenu est écrit tel quel et les `$` restent pour le runtime.
RUN cat > /usr/local/bin/call-cron <<'SCRIPT'
#!/bin/sh
# call-cron <slug> — GET $WEB_URL/api/cron/<slug> avec le Bearer.
#
# POURQUOI un wrapper plutôt qu'un wget direct dans le crontab :
#   1. Le secret vit dans /run/cron/secret (chmod 600), JAMAIS dans le
#      crontab — `crontab -l` est lisible par tous les process du conteneur.
#   2. busybox crond envoie la sortie des jobs par mail (sendmail absent :
#      sortie PERDUE). On redirige donc explicitement vers /proc/1/fd/1 et
#      /proc/1/fd/2 (stdout/stderr du conteneur, crond tournant en PID 1)
#      pour que chaque passage soit visible dans `docker compose logs cron`.
#      Sans ça, le service est muet et les échecs invisibles — c'est le
#      piège principal de ce montage.
#   3. Timeout borné (wget -T --tries=1) : un `web` bloqué ne doit pas
#      empiler les jobs.
# Le secret passe en argument de wget (visible dans `ps` DU conteneur
# uniquement, le temps de l'appel) : busybox wget n'offre pas d'option pour
# lire un header depuis un fichier, c'est le compromis documenté.
slug="${1:?usage : call-cron <slug>}"
: "${WEB_URL:=http://web:3000}"
secret="$(cat /run/cron/secret 2>/dev/null || true)"
if [ -z "$secret" ]; then
  echo "[cron] $slug : secret introuvable (/run/cron/secret)" >> /proc/1/fd/2 2>/dev/null \
    || echo "[cron] $slug : secret introuvable (/run/cron/secret)" >&2
  exit 1
fi
resp="$(wget -q -O - -T 25 --tries=1 --header="Authorization: Bearer $secret" "$WEB_URL/api/cron/$slug" 2>&1)"
rc=$?
# Corps tronqué : les réponses sont du petit JSON, 500 caractères suffisent
# dans les logs et évitent qu'un incident n'inonde le driver json-file.
resp="$(printf '%.500s' "$resp")"
if [ "$rc" -eq 0 ]; then
  echo "[cron] $slug OK : $resp" >> /proc/1/fd/1 2>/dev/null || echo "[cron] $slug OK : $resp"
else
  echo "[cron] $slug ECHEC (rc=$rc) : $resp" >> /proc/1/fd/2 2>/dev/null \
    || echo "[cron] $slug ECHEC (rc=$rc) : $resp" >&2
fi
exit "$rc"
SCRIPT
RUN chmod 755 /usr/local/bin/call-cron

RUN cat > /usr/local/bin/pg-backup <<'SCRIPT'
#!/bin/sh
# pg-backup — dump quotidien + vérification + rotation (tâche du cron).
# C'est le binaire que le registre (CRON_COMMANDS) doit référencer : la
# commande planifiée est exactement `pg-backup`, sans argument.
#
# Chemin AUTOMATIQUE. Pour agir à la main (restore, list, verify), utiliser
# l'outil HÔTE scripts/backup.sh — doublon VOULU, pas un bug.
# Contraintes conservées de l'ancien service `backup` :
#   - fichier `.partial` renommé SEULEMENT si le dump est propre ;
#   - contrôle d'intégrité `pg_restore --list` AVANT le `mv` : un fichier vide
#     ou tronqué passe silencieux jusqu'au jour de la restauration, et c'est
#     le contrôle que tout le monde oublie ;
#   - rotation par BACKUP_RETENTION_DAYS via find -mtime (pas de tri `ls`
#     qui casse sur les noms exotiques).
# Env : PGHOST/PGUSER/PGPASSWORD/PGDATABASE (lus nativement par libpq),
# BACKUP_DIR, BACKUP_RETENTION_DAYS.
set -u
: "${BACKUP_DIR:=/backups}"
: "${BACKUP_RETENTION_DAYS:=14}"
ts="$(date +%Y%m%d-%H%M%S)"
tmp="$BACKUP_DIR/$ts.dump.partial"
final="$BACKUP_DIR/$ts.dump"
echo "[backup] dump $ts"
if ! pg_dump -Fc -f "$tmp" 2>/tmp/pg-backup.err; then
  echo "[backup] ECHEC pg_dump :"
  cat /tmp/pg-backup.err
  rm -f "$tmp"
  exit 1
fi
if ! pg_restore --list "$tmp" > /dev/null 2>&1; then
  echo "[backup] ECHEC : dump corrompu (pg_restore --list) — fichier supprimé, RIEN n'est conservé"
  rm -f "$tmp"
  exit 1
fi
mv "$tmp" "$final"
echo "[backup] OK $(du -h "$final" | cut -f1)"
find "$BACKUP_DIR" -maxdepth 1 -name '*.dump' -type f -mtime "+$BACKUP_RETENTION_DAYS" -print -delete \
  | sed 's/^/[backup] rotation : supprime /' || true
echo "[backup] retention : $BACKUP_RETENTION_DAYS jours"
SCRIPT
RUN chmod 755 /usr/local/bin/pg-backup

RUN cat > /usr/local/bin/cron-entrypoint <<'SCRIPT'
#!/bin/sh
# Entrypoint du service cron. Tourne en root AU BOOT uniquement, pour
# réparer les permissions (le volume backup-data hérité de l'ancien service
# `backup` — qui tournait en root — appartient sinon à root et nextjs ne
# peut pas y écrire), puis `exec su-exec nextjs crond` : crond ET les jobs
# tournent en non-root. Voir l'étape `cron` ci-dessus.
set -eu
: "${BACKUP_DIR:=/backups}"
mkdir -p /run/cron /etc/crontabs "$BACKUP_DIR"
chown nextjs:nodejs /run/cron /etc/crontabs "$BACKUP_DIR"
chmod 700 /run/cron
# 1. Secret HORS du crontab, chmod 600. `set -u` fait échouer le boot si
# CRON_SECRET est absent : un cron sans secret spammerait des 401 en silence.
umask 077
printf '%s' "$CRON_SECRET" > /run/cron/secret
chown nextjs:nodejs /run/cron/secret
chmod 600 /run/cron/secret
[ -s /run/cron/secret ] || { echo "[cron] CRON_SECRET vide — arrêt" >&2; exit 1; }
# 2. `call-cron` est déjà installé dans l'image (/usr/local/bin).
# 3. Crontab régénéré depuis le registre embarqué — jamais édité à la main,
# le redémarrage suivant écraserait toute modification.
: "${WEB_URL:=http://web:3000}"
node --import tsx scripts/generate-crontab.ts --out /etc/crontabs/nextjs
chown nextjs:nodejs /etc/crontabs/nextjs
chmod 600 /etc/crontabs/nextjs
echo "[cron] crontab installé depuis le registre :"
cat /etc/crontabs/nextjs
# 4. crond au premier plan (PID 1 → Docker le supervise), logs propres vers
# le stderr du conteneur (`docker compose logs cron`). `-c` explicite : le
# répertoire par défaut de busybox varie selon la compilation, on ne devine
# pas. Fichier nommé `nextjs` = l'utilisateur qui exécute les jobs.
exec su-exec nextjs:nodejs crond -f -c /etc/crontabs -L /dev/stderr
SCRIPT
RUN chmod 755 /usr/local/bin/cron-entrypoint

# USER root VOLONTAIRE : seule la préparation au boot (permissions, secret)
# exige root, et le `exec su-exec` final fait tourner crond en nextjs.
# Conséquence : `docker compose exec cron …` ouvre un shell root — pour lire
# le crontab tel que crond le voit, préférer `cat /etc/crontabs/nextjs`.
USER root
ENTRYPOINT ["/usr/local/bin/cron-entrypoint"]

# ─── Étape 3 : runtime ────────────────────────────────────────────────────
FROM node:22-alpine AS runner
WORKDIR /app

RUN apk add --no-cache libc6-compat wget

ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    PORT=3000 \
    HOSTNAME=0.0.0.0

# Utilisateur non-root : le process n'a aucun besoin d'écrire dans l'OS.
RUN addgroup --system --gid 1001 nodejs \
 && adduser  --system --uid 1001 nextjs

# Le serveur standalone et ses dépendances minimales.
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
COPY --from=builder --chown=nextjs:nodejs /app/public ./public
# Le schéma est relu au démarrage des scripts de seed / migrate.
COPY --from=builder --chown=nextjs:nodejs /app/prisma ./prisma

# Les scripts de migration et de vérification tournent DANS le conteneur au
# déploiement. Sans ce COPY, `migrate` échoue sur un module introuvable.
COPY --from=builder --chown=nextjs:nodejs /app/scripts ./scripts
# tsx est nécessaire pour exécuter les scripts .ts du dépôt.
COPY --from=builder --chown=nextjs:nodejs /app/node_modules/tsx ./node_modules/tsx
COPY --from=builder --chown=nextjs:nodejs /app/tsconfig.json ./tsconfig.json

USER nextjs
EXPOSE 3000

# Vérifie que l'app répond réellement, pas seulement que le port est ouvert.
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD wget -q --spider http://127.0.0.1:3000/api/health || exit 1

CMD ["node", "server.js"]