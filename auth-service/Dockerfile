# Debian slim, e nao Alpine: o Prisma tem historico de atrito com a musl libc
# do Alpine. O Prisma 7 nao usa mais engine Rust no client, mas o schema engine
# usado pelas migrations continua sendo binario nativo.

# ---------------------------------------------------------------- build ------
FROM node:24-slim AS builder

WORKDIR /app

# package.json e lock antes do codigo: enquanto as dependencias nao mudam, o
# Docker reaproveita a camada do npm ci e o build fica em segundos.
COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund

COPY prisma ./prisma
COPY prisma.config.ts nest-cli.json tsconfig.json tsconfig.build.json ./
COPY src ./src

# Gera o Prisma Client dentro da imagem. O codigo gerado nao vai versionado, e
# gerar aqui garante que ele corresponde ao schema.prisma deste commit.
RUN npx prisma generate
RUN npm run build

# -------------------------------------------------------------- runtime ------
FROM node:24-slim AS runtime

ENV NODE_ENV=production
WORKDIR /app

# curl e usado pelo healthcheck do docker-compose.
RUN apt-get update \
    && apt-get install -y --no-install-recommends curl \
    && rm -rf /var/lib/apt/lists/*

# Só dependencias de producao. O CLI do Prisma esta em `dependencies` (e nao em
# devDependencies) justamente porque o entrypoint precisa dele para rodar
# `migrate deploy` na subida do container.
COPY package.json package-lock.json ./
RUN npm ci --omit=dev --no-audit --no-fund \
    && npm cache clean --force

COPY prisma ./prisma
COPY prisma.config.ts ./
COPY docker-entrypoint.sh ./
COPY --from=builder /app/dist ./dist

RUN chmod +x ./docker-entrypoint.sh \
    && chown -R node:node /app

# Container nao deve rodar como root.
USER node

EXPOSE 3001

ENTRYPOINT ["./docker-entrypoint.sh"]
CMD ["node", "dist/main"]
