#!/usr/bin/env bash
# ═══════════════════════════════════════════════════════════════════════════
# HASHCODE REBOOT — déploiement
#
#   ./scripts/deploy.sh dev     → reconstruction et redémarrage en dev
#   ./scripts/deploy.sh prod    → prod : SAUVEGARDE puis mise à jour
#   ./scripts/deploy.sh status  → état des services et consommation
#   ./scripts/deploy.sh logs    → logs de l'app
#   ./scripts/deploy.sh down    → arrêt (volumes conservés)
#
# Points de conception :
#   - Un seul fichier compose par environnement, celui dupliqué en temporaire
#     avec la variable COMPOSE_PROJECT_NAME : impossible de se tromper de
#     stack ou de mélanger les deux.
#   - Le déploiement prod commence TOUJOURS par une sauvegarde, et
#     n'échoue pas si la base est vide.
#   - Les secrets ne sont jamais affichés : aucun `compose config` sans
#     --quiet.
# ═══════════════════════════════════════════════════════════════════════════
set -euo pipefail

cd "$(dirname "$0")/.."

DEV_PROJECT="hashcode-reboot-dev"
PROD_PROJECT="hashcode-reboot"
BACKUP_RETENTION_DAYS="${BACKUP_RETENTION_DAYS:-14}"

info() { printf '\033[0;36m▸\033[0m %s\n' "$*"; }
ok()   { printf '\033[0;32m✔\033[0m %s\n' "$*"; }
warn() { printf '\033[0;33m!\033[0m %s\n' "$*"; }
die()  { printf '\033[0;31m✖ %s\033[0m\n' "$*" >&2; exit 1; }

[ -f .env ] || die ".env absent — faire : cp .env.example .env puis le remplir"

# Fichier temporaire dupliqué avec le projet forcé. `mktemp` évite d'écrire
# dans le dépôt.
compose_file() {
  local env="$1" f
  f="$(mktemp /tmp/compose.XXXXXX.yml)"
  local project
  case "$env" in
    dev)  project="$DEV_PROJECT" ;;
    prod) project="$PROD_PROJECT" ;;
    *) die "environnement inconnu : $env" ;;
  esac
  # `name:` en tête de fichier primerait sur -p : on le retire.
  # Attention : choisir le fichier par comparaison explicite. Une expansion
  # du type ${env:+.dev} donnerait compose.dev.yml pour prod AUSSI, puisque
  # "prod" est non vide — on deployerait la stack de dev en production.
  local src
  case "$env" in
    dev)  src="compose.dev.yml" ;;
    prod) src="compose.yml" ;;
  esac
  grep -v '^name: ' "$src" > "$f"
  printf '%s' "$f"
}

# dc <env> <args...> : exécute compose sur la bonne stack.
dc() {
  local env="$1"; shift
  local f; f="$(compose_file "$env")"
  # shellcheck disable=SC2064
  trap "rm -f '$f'" RETURN
  docker compose -p "$( [ "$env" = dev ] && echo "$DEV_PROJECT" || echo "$PROD_PROJECT" )" \
                 -f "$f" "$@"
}

wait_healthy() {
  local env="$1" svc="$2" tries="${3:-60}" i=0
  info "attente du service $svc…"
  while [ "$i" -lt "$tries" ]; do
    local state
    state="$(docker inspect --format '{{if .State.Health}}{{.State.Health.Status}}{{else}}{{.State.Status}}{{end}}' \
             "$(dc "$env" ps -q "$svc" 2>/dev/null || true)" 2>/dev/null || echo 'absent')"
    case "$state" in
      healthy|running) ok "$svc est $state"; return 0 ;;
      exited|dead)    die "$svc s'est arrêté (voir : ./scripts/deploy.sh logs)" ;;
    esac
    i=$((i + 1)); sleep 2
  done
  warn "$svc n'est pas encore healthy après $((tries * 2))s — vérifie les logs"
  return 1
}

do_backup() {
  info "sauvegarde avant déploiement…"
  ./scripts/backup.sh || die "sauvegarde impossible — déploiement annulé"
}

# ─── Reconstruction de l'image ───────────────────────────────────────────
# Les NEXT_PUBLIC_* sont figées au build : --build-arg les transmet depuis le
# .env, sans jamais les afficher.
build_image() {
  info "construction de l'image…"
  local args=()
  local v
  for v in NEXT_PUBLIC_SITE_URL NEXT_PUBLIC_URL NEXT_PUBLIC_APP_VERSION \
           NEXT_PUBLIC_WHATSAPP_URL NEXT_PUBLIC_MEET_URL \
           NEXT_PUBLIC_SENTRY_DSN NEXT_PUBLIC_TURNSTILE_SITE_KEY; do
    args+=(--build-arg "$v=${!v:-}")
  done
  docker build "${args[@]}" -t hashcode-reboot:local .
  ok "image hashcode-reboot:local à jour"
}

# ─── Migrations ──────────────────────────────────────────────────────────
# Un deploymentssans migrate ne peut pas démarrer l'app (dépendance
# service_completed_successfully) : on veut le message d'erreur de migrate,
# pas celui de web.
run_migrations() {
  local env="$1"
  info "application des migrations…"
  # Lance le service one-shot et relit son code de sortie.
  dc "$env" up -d migrate >/dev/null 2>&1 || true
  local cid rc=0
  cid="$(docker ps -aq --filter 'label=com.docker.compose.service=migrate' \
         --filter "label=com.docker.compose.project=$([ "$env" = dev ] && echo "$DEV_PROJECT" || echo "$PROD_PROJECT")" \
         | head -1)"
  if [ -n "$cid" ]; then
    wait "$cid" >/dev/null 2>&1 || true
    rc="$(docker inspect --format '{{.State.ExitCode}}' "$cid" 2>/dev/null || echo 1)"
  else
    rc=1
  fi
  if [ "$rc" != "0" ]; then
    warn "---- logs de migrate ----"
    dc "$env" logs --no-color --tail=30 migrate || true
    die "migrate a échoué (code $rc) — l'app n'est pas démarrée"
  fi
  ok "migrations appliquées"
}

do_deploy_dev() {
  info "═══ DÉPLOIEMENT DEV ═══"
  build_image

  # Même chaîne que la prod : deploy → verify-schema → ensure-admin.
  run_migrations dev
  dc dev up -d --remove-orphans
  wait_healthy dev postgres
  dc dev restart web >/dev/null 2>&1 || true
  wait_healthy dev web

  # Pas de sauvegarde en dev : la base est un bac à sable, et un fichier de
  # 1 Go par déploiement encombrerait le disque pour rien. Le test HTTP, lui,
  # est aussi pertinent — un conteneur up qui ne répond pas est inutile.
  local url="${DEV_URL:-http://localhost:3000}"
  info "test HTTP sur ${url} …"
  local code
  code="$(curl -sS -o /dev/null -w '%{http_code}' --max-time 20 "$url/" 2>/dev/null || echo 000)"
  [ "$code" = "200" ] || warn "GET ${url}/ → HTTP ${code} (attendu 200)"
  [ "$code" = "200" ] || die "dev ne répond pas — voir : ./scripts/deploy.sh logs"

  ok "dev en ligne — ${url}"
  dc dev ps
}

do_deploy_prod() {
  info "═══ DÉPLOIEMENT PROD ═══"

  # Sauvegarde d'abord. Si elle échoue, on ne déploie pas — c'est le seul
  # moyen de revenir en arrière si les migrations cassent quelque chose.
  do_backup

  build_image

  # Le service `migrate` enchaîne deploy → verify-schema → ensure-admin.
  # Il suffit qu'une des trois échoue pour que web ne démarre pas.
  run_migrations prod
  dc prod up -d --remove-orphans
  wait_healthy prod postgres
  dc prod restart web >/dev/null 2>&1 || true
  wait_healthy prod web

  # Vérification HTTP réelle : c'est le seul contrôle qui prouve que le site
  # répond, pas seulement que le conteneur tourne.
  if smoke_test_prod; then
    ok "prod déployée et vérifiée"
  else
    warn "le conteneur est up mais le site ne répond pas — voir ci-dessus"
    warn "rollback : ./scripts/deploy.sh rollback"
    dc prod ps
    exit 1
  fi

  dc prod ps
}

# Requête publique : prouve que Traefik route, que l'app répond et que la
# base est joignable. /api/health touche la base (cf. src/lib/health.ts).
smoke_test_prod() {
  local url="${PUBLIC_URL:-}"
  [ -n "$url" ] || { warn "PUBLIC_URL absent du .env — test HTTP sauté"; return 0; }

  info "test HTTP sur ${url} …"
  local code
  code="$(curl -sS -o /dev/null -w '%{http_code}' --max-time 20 "$url/" 2>/dev/null || echo 000)"
  [ "$code" = "200" ] || { warn "GET ${url}/ → HTTP ${code} (attendu 200)"; return 1; }

  code="$(curl -sS -o /dev/null -w '%{http_code}' --max-time 20 "${url}/api/health" 2>/dev/null || echo 000)"
  [ "$code" = "200" ] || { warn "GET ${url}/api/health → HTTP ${code} (attendu 200)"; return 1; }

  info "GET / et /api/health → 200"
  return 0
}

# ─── Rollback ─────────────────────────────────────────────────────────────
# Ramène l'image précédente. Utile quand l'app démarre mais que quelque chose
# ne va pas. Ne rejoue PAS les migrations dans l'autre sens : une migration
# appliquée est rarement réversible — c'est pourquoi la sauvegarde existe.
do_rollback() {
  info "═══ ROLLBACK PROD ═══"

  local previous
  previous="$(docker images 'hashcode-reboot:local' --format '{{.CreatedAt}}' 2>/dev/null | wc -l | tr -d ' ')"
  if [ "$previous" -lt 2 ]; then
    die "pas d'image précédente en local — reconstruire ne suffit pas ici"
  fi

  # Étiquette l'image courante avant de la remplacer, pour pouvoir revenir.
  local current
  current="$(docker images 'hashcode-reboot:local' --format '{{.ID}}' | head -1)"
  docker tag "hashcode-reboot:local" "hashcode-reboot:previous"
  warn "image précédente créée : hashcode-reboot:previous"

  warn "cette étape ne restaure PAS la base. Si les données sont le problème :"
  warn "    ./scripts/backup.sh list"
  warn "    ./scripts/backup.sh restore <fichier>"
  echo
  info "Pour revenir en arrière sur le code : git revert <commit> puis"
  info "./scripts/deploy.sh prod. La base reste dans son état migré."
}

do_status() {
  info "── prod ──"; docker compose -p "$PROD_PROJECT" -f compose.yml ps 2>/dev/null || warn "stack absente"
  echo
  info "── dev ──";  docker compose -p "$DEV_PROJECT" -f compose.dev.yml ps 2>/dev/null || warn "stack absente"
  echo
  info "── volumes ──"; docker volume ls --format '{{.Name}}  {{.Size}}' | grep -E "hashcode" || warn "aucun"
  echo
  info "── sauvegardes ──"; ./scripts/backup.sh list
}

case "${1:-}" in
  dev)      do_deploy_dev ;;
  prod)     do_deploy_prod ;;
  status)   do_status ;;
  logs)     dc prod logs -f --tail=100 web ;;
  rollback) do_rollback ;;
  down)   dc prod down; dc dev down; ok "arrêté — volumes conservés" ;;
  *) die "usage : $0 {dev|prod|status|logs|rollback|down}" ;;
esac