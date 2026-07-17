#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────────
# Runs ON THE VPS. Invoked by GitHub Actions over SSH with the image tag to
# roll out. Pulls the new images from GHCR and restarts the stack. The `migrate`
# one-shot applies pending DB migrations before server/worker come up.
#
#   deploy.sh <image-tag>
# ─────────────────────────────────────────────────────────────────────────────
set -euo pipefail

TAG="${1:-latest}"
DIR="/opt/azimuth/deploy"
COMPOSE="docker compose --env-file .env.production -f docker-compose.prod.yml"

cd "$DIR"

export IMAGE_TAG="$TAG"

echo "==> pulling images @ ${TAG}"
$COMPOSE pull

echo "==> applying migrations + rolling out"
$COMPOSE up -d --remove-orphans

echo "==> pruning dangling images"
docker image prune -f >/dev/null 2>&1 || true

echo "✅ deployed ${TAG}"
$COMPOSE ps
