# ---------------------------------------------------------------- build ------
FROM node:24-slim AS builder

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund

# PONTO DE ATENCAO: no Vite as variaveis VITE_* sao substituidas por texto
# literal durante o build. Elas nao existem em runtime, entao passar como
# `environment:` no docker-compose nao teria efeito nenhum -- precisam ser build
# args, disponiveis no momento em que o bundle e gerado.
ARG VITE_AUTH_URL
ARG VITE_API_URL
ENV VITE_AUTH_URL=$VITE_AUTH_URL
ENV VITE_API_URL=$VITE_API_URL

COPY . .
RUN npm run build

# -------------------------------------------------------------- runtime ------
# A imagem final serve arquivos estaticos: nao ha Node em producao, e o
# resultado tem alguns megabytes em vez de centenas.
FROM nginx:1.29-alpine AS runtime

COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=builder /app/dist /usr/share/nginx/html

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
