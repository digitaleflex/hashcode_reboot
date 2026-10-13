#!/usr/bin/env bash
# ═══════════════════════════════════════════════════════════════════
# HASHCODE REBOOT — Déploiement rapide (pull GHCR, sans build local)
#
# Récupère l'image publiée par .github/workflows/docker-publish.yml et la
# re-tague sous le nom attendu par compose.yml (`hashcode-reboot:local`),
# puis recrée le service `web`.
#
# Portée : le workflow ne publie que la cible `runner` (web). Les services
# `cron` et `migrate` sont des cibles Dockerfile distinctes, non publiées :
# ils restent construits localement (voir scripts/deploy.sh).
#
# Variables : GHCR_OWNER (défaut digitaleflex), GHCR_TAG (défaut main),
#             PROD_PROJECT (défaut hashcode-reboot).
# ═══════════════════════════════════════════════════════════════════
set -euo pipefail

cd "$(dirname "$0")/.."

OWNER="${GHCR_OWNER:-digitaleflex}"
TAG="${GHCR_TAG:-main}"
IMAGE="ghcr.io/${OWNER}/hashcode-reboot:${TAG}"
PROJECT="${PROD_PROJECT:-hashcode-reboot}"

if [ "$TAG" = "main" ]; then
  echo "! GHCR_TAG=main est un tag MOBILE : la prod devrait épingler un tag"
  echo "! immuable généré par le build CI (format YYYYMMDD-<sha7> ou sha-<sha7>)."
  echo "! Exemple : GHCR_TAG=\$(date -u +%Y%m%d)-\$(git rev-parse --short=7 HEAD) ./scripts/deploy-ghcr.sh"
fi

echo "▸ Pull image pré-construite : ${IMAGE}"
docker pull "${IMAGE}"

echo "▸ Digest : $(docker inspect --format '{{index .RepoDigests 0}}' "${IMAGE}" 2>/dev/null || echo '(indisponible)')"
docker tag "${IMAGE}" hashcode-reboot:local
echo "▸ Re-tag → hashcode-reboot:local (nom attendu par compose.yml)"

echo "▸ Recréation du service web (projet ${PROJECT})"
docker compose -p "${PROJECT}" -f compose.yml up -d --force-recreate --no-deps web

echo "✔ web recréé depuis ${IMAGE} (cron/migrate restent en build local)"
