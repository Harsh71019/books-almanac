#!/usr/bin/env sh
set -eu

docker compose --env-file .env up -d --build
docker image prune -f
curl -fsS "http://localhost:${APP_PORT:-3003}/api/health"
printf '\n'
