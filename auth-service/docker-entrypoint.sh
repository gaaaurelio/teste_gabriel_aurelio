#!/bin/sh
set -e

echo "[auth-service] aplicando migrations pendentes..."
./node_modules/.bin/prisma migrate deploy

echo "[auth-service] iniciando aplicacao..."
exec "$@"
