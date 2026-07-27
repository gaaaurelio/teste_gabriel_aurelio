#!/bin/sh
set -e

echo "[auth-service] aplicando migrations pendentes..."
# `migrate deploy` aplica migrations ja versionadas sem nunca gerar novas nem
# apagar dados -- e o comando correto para ambiente nao interativo. `migrate dev`
# aqui seria perigoso: ele pode decidir resetar o banco.
./node_modules/.bin/prisma migrate deploy

echo "[auth-service] iniciando aplicacao..."
exec "$@"
