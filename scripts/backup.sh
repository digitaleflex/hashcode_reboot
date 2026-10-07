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

# pg_dump via le conteneur postgres : mêmes outils, même version que la base.
db_exec() {
  "${COMPOSE[@]}" exec -T postgres \
    pg_dump -U "$DB_USER" -d "$DB_NAME" "$@"
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