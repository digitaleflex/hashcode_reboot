#!/usr/bin/env bash
# ═══════════════════════════════════════════════════════════════════════════
# Sauvegarde et restauration PostgreSQL — HASHCODE REBOOT
#
#   ./scripts/backup.sh              → sauvegarde
#   ./scripts/backup.sh restore <f>  → restaure depuis un .dump
#   ./scripts/backup.sh list         → liste les sauvegardes
#   ./scripts/backup.sh verify <f>   → vérifie l'intégrité d'un .dump
#
# Laisse faire au conteneur : le script tourne depuis l'hôte et atteint la
# base via le réseau Docker, donc aucune installation de postgres-client.
# ═══════════════════════════════════════════════════════════════════════════
set -euo pipefail

BACKUP_DIR="${BACKUP_DIR:-./backups}"
RETENTION_DAYS="${BACKUP_RETENTION_DAYS:-14}"
DB_USER="${POSTGRES_USER:-hashcode}"
DB_NAME="${POSTGRES_DB:-hashcode_reboot}"
COMPOSE_FILE="${COMPOSE_FILE:-compose.yml}"

# Pile PROD, toujours explicitement. Sans -p ni --env-file, compose déduit la
# pile du répertoire courant et du premier .env trouvé : on pourrait sauvegarder
# la stack de dev en croyant écrire la prod (et avec le mauvais POSTGRES_DB).
PROJECT="${COMPOSE_PROJECT_NAME:-hashcode-reboot}"
ENV_FILE="${ENV_FILE:-.env.prod}"
# Chemin résolu depuis la racine du dépôt : le script est appelé d'où qu'on soit.
case "$ENV_FILE" in /*) ;; *) ENV_FILE="$(pwd)/$ENV_FILE" ;; esac

COMPOSE=(docker compose -p "$PROJECT" --env-file "$ENV_FILE" -f "$COMPOSE_FILE")

die() { echo "ERREUR: $*" >&2; exit 1; }
info() { echo "[backup] $*"; }
warn() { echo "[backup] AVERTISSEMENT : $*" >&2; }

# Lit une variable depuis l'environnement, sinon depuis le .env de la stack.
# --env-file ne concerne que docker compose : il n'exporte rien dans ce shell,
# d'où cette relecture explicite des clés B2.
env_get() {
  local key="$1" val
  val="${!key:-}"
  if [ -z "$val" ] && [ -f "$ENV_FILE" ]; then
    val="$(sed -n "s/^[[:space:]]*${key}[[:space:]]*=[[:space:]]*//p" "$ENV_FILE" | tail -n1)"
    val="${val%$'\r'}"
    case "$val" in
      \"*\") val="${val#\"}"; val="${val%\"}" ;;
      \'*\') val="${val#\'}"; val="${val%\'}" ;;
    esac
  fi
  printf '%s' "$val"
}

# pg_dump via le conteneur postgres : mêmes outils, même version que la base.
db_exec() {
  "${COMPOSE[@]}" exec -T postgres \
    pg_dump -U "$DB_USER" -d "$DB_NAME" "$@"
}

# ── Copie hors-site Backblaze B2 — API HTTP en curl pur ─────────────────────
# Rien à installer (ni b2 CLI, ni rclone, ni pip). Le dump reste en local ET
# est envoyé sur B2. Tout échec B2 est signalé mais JAMAIS bloquant : la copie
# locale est conservée dans $BACKUP_DIR.

# Extrait une valeur d'un JSON ; '' si absente ou illisible (jamais bloquant).
jqf() { printf '%s' "$1" | jq -r "${2} // empty" 2>/dev/null || true; }

# Envoie <fichier.dump> vers B2 puis applique la rétention distante.
# Retour 0 = envoyé (ou B2 non configuré), 1 = échec signalé.
b2_upload() {
  local dump="${1:?usage : b2_upload <fichier.dump>}" name
  name="$(basename "$dump")"
  [ -f "$dump" ] || { warn "B2 : fichier introuvable : $dump"; return 1; }

  local key_id key bucket
  key_id="$(env_get B2_APPLICATION_KEY_ID)"
  key="$(env_get B2_APPLICATION_KEY)"
  bucket="$(env_get B2_BUCKET_NAME)"
  if [ -z "$key_id" ] || [ -z "$key" ] || [ -z "$bucket" ]; then
    warn "B2 non configuré (B2_APPLICATION_KEY_ID / B2_APPLICATION_KEY / B2_BUCKET_NAME) — copie locale seule"
    return 0
  fi

  # 1) Autorisation. Ne journalise jamais les identifiants.
  local auth api_url token account_id bucket_id
  if ! auth="$(curl -fsS -u "$key_id:$key" \
        "https://api.backblazeb2.com/b2api/v2/b2_authorize_account" 2>/dev/null)"; then
    warn "B2 : autorisation échouée — copie locale conservée dans $BACKUP_DIR/"
    return 1
  fi
  api_url="$(jqf "$auth" '.apiUrl')"
  token="$(jqf "$auth" '.authorizationToken')"
  account_id="$(jqf "$auth" '.accountId')"
  bucket_id="$(jqf "$auth" '.allowed.bucketId')"
  if [ -z "$api_url" ] || [ -z "$token" ]; then
    warn "B2 : réponse d'autorisation illisible — copie locale conservée dans $BACKUP_DIR/"
    return 1
  fi

  # 2) bucketId par nom, sauf si la clé est déjà restreinte à un bucket.
  if [ -z "$bucket_id" ]; then
    local buckets
    if ! buckets="$(curl -fsS -H "Authorization: $token" \
          "$api_url/b2api/v2/b2_list_buckets?accountId=$account_id" 2>/dev/null)"; then
      warn "B2 : listing des buckets impossible — copie locale conservée dans $BACKUP_DIR/"
      return 1
    fi
    bucket_id="$(jqf "$buckets" ".buckets[]? | select(.bucketName == \"$bucket\") | .bucketId")"
    if [ -z "$bucket_id" ]; then
      warn "B2 : bucket « $bucket » introuvable — copie locale conservée dans $BACKUP_DIR/"
      return 1
    fi
  fi

  # 3) URL d'upload dédiée.
  local up upload_url upload_token
  if ! up="$(curl -fsS -H "Authorization: $token" \
        -d "{\"bucketId\":\"$bucket_id\"}" \
        "$api_url/b2api/v2/b2_get_upload_url" 2>/dev/null)"; then
    warn "B2 : URL d'upload indisponible — copie locale conservée dans $BACKUP_DIR/"
    return 1
  fi
  upload_url="$(jqf "$up" '.uploadUrl')"
  upload_token="$(jqf "$up" '.authorizationToken')"
  if [ -z "$upload_url" ] || [ -z "$upload_token" ]; then
    warn "B2 : réponse d'upload illisible — copie locale conservée dans $BACKUP_DIR/"
    return 1
  fi

  # 4) Envoi. Nom distant = basename du dump, sans dossier (encodage simple).
  local response http_code body sha1 rc=0
  sha1="$(sha1sum "$dump" | cut -d' ' -f1)"
  response="$(curl -sS -X POST "$upload_url" \
      -H "Authorization: $upload_token" \
      -H "X-Bz-File-Name: $name" \
      -H "X-Bz-Content-Sha1: $sha1" \
      -H "Content-Type: application/octet-stream" \
      --data-binary "@$dump" \
      --write-out $'\n%{http_code}' 2>/dev/null)" || rc=$?
  if [ "$rc" -ne 0 ]; then
    warn "B2 : échec de l'envoi de $name — copie locale conservée dans $BACKUP_DIR/"
    return 1
  fi
  http_code="${response##*$'\n'}"
  body="${response%$'\n'*}"
  if [ "$http_code" != "200" ]; then
    local msg
    msg="$(jqf "$body" '.message')"
    warn "B2 : échec de l'envoi de $name (HTTP $http_code${msg:+ — $msg}) — copie locale conservée dans $BACKUP_DIR/"
    return 1
  fi
  info "B2 : $name envoyé (rétention : $RETENTION_DAYS jours)"

  # 5) Rétention distante (best-effort, ignore tout fichier hors motif).
  b2_prune "$api_url" "$token" "$bucket_id"
  return 0
}

# Rétention B2 : ne supprime QUE les objets nommés YYYYMMDD-HHMMSS.dump
# (basename produit par do_backup) et plus vieux que $RETENTION_DAYS.
b2_prune() {
  local api_url="$1" token="$2" bucket_id="$3" listing cutoff n id ts
  if ! listing="$(curl -fsS -H "Authorization: $token" \
        "$api_url/b2api/v2/b2_list_file_names?bucketId=$bucket_id&maxFileCount=1000" 2>/dev/null)"; then
    warn "B2 : listing des fichiers impossible — rétention distante ignorée (aucune suppression)"
    return 0
  fi
  cutoff="$(date -d "-$RETENTION_DAYS days" +%Y%m%d%H%M%S)"
  while IFS=$'\t' read -r n id; do
    [ -n "$n" ] || continue
    # Motif strict = nom d'un dump local ; les autres objets du bucket sont ignorés.
    case "$n" in
      [0-9][0-9][0-9][0-9][0-9][0-9][0-9][0-9]-[0-9][0-9][0-9][0-9][0-9][0-9].dump) ;;
      *) continue ;;
    esac
    ts="${n:0:8}${n:9:6}"
    [ "$ts" \< "$cutoff" ] || continue
    if curl -fsS -X POST -H "Authorization: $token" \
        -d "{\"fileName\":\"$n\",\"fileId\":\"$id\"}" \
        "$api_url/b2api/v2/b2_delete_file_version" > /dev/null 2>&1; then
      info "B2 : supprimé (rétention) $n"
    else
      warn "B2 : suppression impossible pour $n (ignoré)"
    fi
  done < <(printf '%s' "$listing" | jq -r '.files[]? | [.fileName, .fileId] | @tsv' 2>/dev/null || true)
}

do_backup() {
  mkdir -p "$BACKUP_DIR"
  local ts f
  ts="$(date +%Y%m%d-%H%M%S)"
  f="$BACKUP_DIR/${ts}.dump"

  info "sauvegarde → $f"
  # -Fc : format custom compressé, restaurable avec pg_restore.
  #Ne pas écrire dans un fichier partiel : on dumpe sur stdout puis on
  # renomme seulement si le dump est propre.
  local tmp="$f.partial"
  if ! db_exec -Fc > "$tmp"; then
    rm -f "$tmp"
    die "pg_dump a échoué — aucune sauvegarde écrite"
  fi

  # Contrôle d'intégrité AVANT de considérer la sauvegarde comme valide.
  # C'est le point que tout le monde oublie : un fichier vide ou tronqué
  # passe silencieusement jusqu'au jour de la restauration.
  if ! "${COMPOSE[@]}" exec -T postgres \
       pg_restore --list < "$tmp" > /dev/null 2>&1; then
    rm -f "$tmp"
    die "sauvegarde corrompue (pg_restore --list échoue) — fichier supprimé"
  fi

  mv "$tmp" "$f"
  info "OK — $(du -h "$f" | cut -f1)"

  # Rotation.
  find "$BACKUP_DIR" -name '*.dump' -type f -mtime "+$RETENTION_DAYS" -print -delete \
    | sed 's/^/[backup] supprimé (retention) /' || true
  info "rétention : $RETENTION_DAYS jours"

  # Copie hors-site B2 (best-effort : n'échoue jamais la sauvegarde locale).
  b2_upload "$f" || true
}

do_restore() {
  local f="${1:?usage : backup.sh restore <fichier.dump>}"
  [ -f "$f" ] || die "fichier introuvable : $f"

  info "ATTENTION — cette opération REMPLACE les données actuelles."
  printf "Sauvegarde : %s (%s)\n" "$f" "$(du -h "$f" | cut -f1)"
  printf "Base cible : %s/%s\n" "$DB_USER" "$DB_NAME"
  read -r -p "Taper RESTAURER en majuscules pour confirmer : " c
  [ "$c" = "RESTAURER" ] || die "annulé"

  info "sauvegarde de sécurité de l'état courant avant écrasement"
  do_backup

  # --clean --if-exists : supprime les objets absents du dump. Sans ça, les
  # anciennes tables non présentes dans la sauvegarde subsistent.
  info "restauration…"
  # shellcheck disable=SC2086
  "${COMPOSE[@]}" exec -T postgres \
    pg_restore -U "$DB_USER" -d "$DB_NAME" \
      --clean --if-exists --no-owner --single-transaction < "$f"
  info "restauration terminée"
}

do_list() {
  if [ -z "$(ls -A "$BACKUP_DIR"/*.dump 2>/dev/null)" ]; then
    info "aucune sauvegarde dans $BACKUP_DIR"
    return 0
  fi
  ls -lht "$BACKUP_DIR"/*.dump | awk '{print "  "$9"  "$5}'
}

do_verify() {
  local f="${1:?usage : backup.sh verify <fichier.dump>}"
  [ -f "$f" ] || die "fichier introuvable : $f"
  if "${COMPOSE[@]}" exec -T postgres \
       pg_restore --list < "$f" > /dev/null 2>&1; then
    info "intègre : $(du -h "$f" | cut -f1)"
  else
    die "CORROMPU : $(basename "$f")"
  fi
}

case "${1:-backup}" in
  backup)          do_backup ;;
  restore)         shift; do_restore "${1:-}" ;;
  list)            do_list ;;
  verify)          shift; do_verify "${1:-}" ;;
  *)               die "usage : $0 {backup|restore <f>|list|verify <f>}" ;;
esac