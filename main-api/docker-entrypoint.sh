#!/bin/sh
set -e

echo "[main-api] aplicando migrations pendentes..."
./node_modules/.bin/prisma migrate deploy

echo "[main-api] iniciando aplicacao..."
exec "$@"
