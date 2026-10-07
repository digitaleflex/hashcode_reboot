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

# Fichier d'env distinct par stack : prod → .env.prod, dev → .env.dev.
envfile() { [ "$1" = dev ] && echo ".env.dev" || echo ".env.prod"; }
[ -f "$(envfile "${1:-prod}")" ] || die "fichier $(envfile "${1:-prod}") absent — copier .env.example"

# Charge les variables d'un fichier d'env DANS le shell courant, sans
# l'exécuter : ni `source` (un .env est une donnée, pas du code), ni `set -a`.
# Indispensable pour build_image, dont les --build-arg sont lus par expansion
# indirecte : sans cela les NEXT_PUBLIC_* seraient vides à chaque build.
load_env_vars() {
  local file; file="$(envfile "$1")"
  [ -f "$file" ] || die "fichier $file absent"
  local line k v
  while IFS= read -r line || [ -n "$line" ]; do
    case "$line" in ''|'#'*) continue ;; esac
    line="${line%$'\r'}"
    case "$line" in *=*) ;; *) continue ;; esac
    k="${line%%=*}"; v="${line#*=}"
    # Les guillemets éventuels ne font pas partie de la valeur.
    v="${v%\"}"; v="${v#\"}"; v="${v%\'}"; v="${v#\'}"
    case "$k" in [A-Za-z_]*) ;; *) continue ;; esac
    printf -v "$k" '%s' "$v"
  done < "$file"
}

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
                 --env-file "$(envfile "$env")" -f "$f" "$@"
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
  # Premier déploiement : la stack prod n'existe pas encore, donc postgres
  # tourne dans le vide — une base jamais créée ne peut pas être perdue.
  # Sauvegarder ici serait un échec technique, pas une protection.
  local pg state
  pg="$(dc prod ps -q postgres 2>/dev/null || true)"
  state="$([ -n "$pg" ] && docker inspect --format '{{.State.Running}}' "$pg" 2>/dev/null || echo absent)"
  if [ "$state" != "true" ]; then
    warn "stack prod non démarrée (postgres: $state) — aucune sauvegarde à faire"
    return 0
  fi
  info "sauvegarde avant déploiement…"
  ./scripts/backup.sh || die "sauvegarde impossible — déploiement annulé"
}

# ─── Reconstruction de l'image ───────────────────────────────────────────
# Les NEXT_PUBLIC_* sont figées au build : --build-arg les transmet depuis le
# .env, sans jamais les afficher.
build_image() {
  local env="${1:-prod}"
  info "lecture de $(envfile "$env")…"
  load_env_vars "$env"

  # PUBLIC_URL est la seule URL garantie présente en prod : on en dérive les
  # deux alias NEXT_PUBLIC_* si le .env ne les définit pas (jamais l'inverse).
  if [ -n "${PUBLIC_URL:-}" ]; then
    NEXT_PUBLIC_SITE_URL="${NEXT_PUBLIC_SITE_URL:-$PUBLIC_URL}"
    NEXT_PUBLIC_URL="${NEXT_PUBLIC_URL:-$PUBLIC_URL}"
  fi

  # Version figée au build. Vide ou littéral non résolu (« $VERSION ») → sha.
  case "${NEXT_PUBLIC_APP_VERSION:-}" in
    ''|'$'*) NEXT_PUBLIC_APP_VERSION="$(git rev-parse --short HEAD 2>/dev/null || echo dev)" ;;
  esac

  # En prod, l'image courante est conservée sous :previous AVANT que le build
  # ne l'écrase : c'est la seule chose que do_rollback saura retrouver.
  if [ "$env" = prod ] && docker image inspect hashcode-reboot:local >/dev/null 2>&1; then
    docker tag hashcode-reboot:local hashcode-reboot:previous
    info "image précédente sauvegardée sous hashcode-reboot:previous"
  fi

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
  cid="$(dc "$env" ps -aq migrate | head -1)"
  [ -n "$cid" ] || die "aucun conteneur migrate dans la stack $env — migrations non lancées"
  wait "$cid" >/dev/null 2>&1 || true
  rc="$(docker inspect --format '{{.State.ExitCode}}' "$cid" 2>/dev/null || echo 1)"
  if [ "$rc" != "0" ]; then
    warn "---- logs de migrate ----"
    dc "$env" logs --no-color --tail=30 migrate || true
    die "migrate a échoué (code $rc) — l'app n'est pas démarrée"
  fi
  ok "migrations appliquées"
}

do_deploy_dev() {
  info "═══ DÉPLOIEMENT DEV ═══"
  build_image dev

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

  build_image prod

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

# Trois contrôles successifs, de portée croissante : l'app (bloquant), puis
# Traefik à l'origine, puis la vue publique via Cloudflare. Seul le premier
# est bloquant — un 526 de Cloudflare vient du certificat Let's Encrypt de
# l'origine, pas du déploiement.
# /api/health touche la base (cf. src/lib/health.ts).
smoke_test_prod() {
  local host="${PUBLIC_HOST:-}"
  local url="${PUBLIC_URL:-}"
  [ -n "$url" ] || [ -n "$host" ] || {
    warn "ni PUBLIC_URL ni PUBLIC_HOST dans le .env — contrôles publics sautés"
    return 0
  }
  [ -n "$url" ] || url="https://${host}"

  # ── 1. BLOQUANT : santé de l'app et de la base, depuis le conteneur ──────
  info "contrôle 1/3 — santé de l'app (interne au conteneur)…"
  # wget sort en erreur dès que la route renvoie autre chose que 200 : c'est
  # exactement le contrôle voulu (la route répond 503 si la base est coupée).
  local health rc=0
  health="$(dc prod exec -T web wget -qO- http://127.0.0.1:3000/api/health 2>/dev/null)" || rc=$?
  local r1="ÉCHEC"
  if [ "$rc" = 0 ] && [ -n "$health" ]; then
    ok "contrôle 1/3 — /api/health → 200 : ${health}"
    r1="OK"
  else
    warn "GET http://127.0.0.1:3000/api/health n'a pas renvoyé 200 (wget rc=$rc, corps='${health}')"
    dc prod logs --no-color --tail=30 web || true
    die "l'app ne répond pas depuis le conteneur — déploiement non validé"
  fi

  # ── 2. AVERTISSEMENT : routage Traefik à l'origine (IP publique) ──────────
  local r2="SKIP" code
  if [ -z "$host" ]; then
    warn "contrôle 2/3 — PUBLIC_HOST absent du .env — routage origine non testé"
  else
    info "contrôle 2/3 — routage Traefik sur l'origine…"
    local ip
    ip="$(curl -fsS --max-time 5 https://api.ipify.org 2>/dev/null || echo '')"
    if [ -z "$ip" ]; then
      warn "contrôle 2/3 — IP publique inconnue — routage origine non testé"
    else
      code="$(curl -sS -o /dev/null -w '%{http_code}' --max-time 10 \
              --resolve "${host}:443:${ip}" "https://${host}/" 2>/dev/null || echo 000)"
      case "$code" in
        200|301|302|401|403) ok "contrôle 2/3 — origine → HTTP $code" ; r2="OK ($code)" ;;
        *) warn "contrôle 2/3 — origine → HTTP $code sur https://${host}/ (non bloquant)"
           r2="HTTP $code" ;;
      esac
    fi
  fi

  # ── 3. AVERTISSEMENT : vue publique via Cloudflare ────────────────────────
  info "contrôle 3/3 — vue publique ${url} …"
  local r3
  code="$(curl -sS -o /dev/null -w '%{http_code}' --max-time 15 "${url}/" 2>/dev/null || echo 000)"
  case "$code" in
    526|495)
      warn "Cloudflare signale une erreur TLS d'origine (526/495) : le certificat Let's Encrypt de ${host} n'est pas encore émis ou a échoué — ce n'est pas un échec de déploiement"
      r3="TLS origine en attente (${code})" ;;
    2??|3??|401|403) ok "contrôle 3/3 — public → HTTP $code" ; r3="OK ($code)" ;;
    *) warn "contrôle 3/3 — GET ${url}/ → HTTP $code (non bloquant)" ; r3="HTTP $code" ;;
  esac

  echo
  info "récapitulatif : app=[$r1] origine=[$r2] public=[$r3]"
  return 0
}

# ─── Rollback ─────────────────────────────────────────────────────────────
# Ramène l'image précédente, celle que le build prod a sauvegardée sous
# :previous. Ne rejoue PAS les migrations dans l'autre sens : une migration
# appliquée est rarement réversible — c'est pourquoi la sauvegarde existe.
do_rollback() {
  info "═══ ROLLBACK PROD ═══"

  docker image inspect hashcode-reboot:previous >/dev/null 2>&1 \
    || die "aucune image précédente (hashcode-reboot:previous) : rien à rollbacker"

  docker tag hashcode-reboot:previous hashcode-reboot:local
  warn "hashcode-reboot:previous est redevenue l'image courante"

  dc prod up -d --force-recreate web cron
  dc prod ps

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
  help|-h|--help)
    cat <<EOF
usage : $0 {dev|prod|status|logs|rollback|down|help}

  dev        reconstruction de l'image + redémarrage de la stack dev
  prod       sauvegarde, build, migrations et redémarrage de la prod
  status     état des services, volumes et sauvegardes
  logs       logs du conteneur web de la prod
  rollback   redéploie l'image sauvegardée sous hashcode-reboot:previous
  down       arrêt des deux stacks (volumes conservés)
  help       cette aide
EOF
    ;;
  *) die "usage : $0 {dev|prod|status|logs|rollback|down|help}" ;;
esac