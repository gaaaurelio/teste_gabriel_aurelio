# Ver comentarios em auth-service/Dockerfile: a estrutura e deliberadamente
# identica nos dois servicos.

# ---------------------------------------------------------------- build ------
FROM node:24-slim AS builder

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund

COPY prisma ./prisma
COPY prisma.config.ts nest-cli.json tsconfig.json tsconfig.build.json ./
COPY src ./src

RUN npx prisma generate
RUN npm run build

# -------------------------------------------------------------- runtime ------
FROM node:24-slim AS runtime

ENV NODE_ENV=production
WORKDIR /app

RUN apt-get update \
    && apt-get install -y --no-install-recommends curl \
    && rm -rf /var/lib/apt/lists/*

COPY package.json package-lock.json ./
RUN npm ci --omit=dev --no-audit --no-fund \
    && npm cache clean --force

COPY prisma ./prisma
COPY prisma.config.ts ./
COPY docker-entrypoint.sh ./
COPY --from=builder /app/dist ./dist

RUN chmod +x ./docker-entrypoint.sh \
    && chown -R node:node /app

USER node

EXPOSE 3000

ENTRYPOINT ["./docker-entrypoint.sh"]
CMD ["node", "dist/main"]
