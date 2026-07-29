# Contratação de Produto — Teste Técnico Ramper

Aplicação fullstack com autenticação isolada em microserviço próprio,
comunicação server-to-server entre os serviços, dois bancos Postgres
independentes e frontend React com estado assíncrono.

**Stack:** TypeScript strict, React 19, NestJS 11, PostgreSQL 18, Docker.

---

## Como subir

Pré-requisito: Docker com Compose v2.

```bash
docker compose up --build
```

Não precisa criar `.env`, rodar migration à mão nem popular dados: o
`docker-compose.yml` tem valor padrão para toda variável, cada serviço aplica
as próprias migrations na subida e o Auth Service cria os usuários de exemplo
no bootstrap.

| O quê            | URL                   |
| ---------------- | --------------------- |
| Frontend         | http://localhost:8080 |
| Auth Service     | http://localhost:3001 |
| Main API         | http://localhost:3000 |

Para derrubar tudo incluindo os dados:

```bash
docker compose down -v
```

---

## Credenciais

| E-mail                | Senha       |
| --------------------- | ----------- |
| `admin@ramper.com`    | `ramper123` |
| `analista@ramper.com` | `ramper123` |

---

## O que testar

**1. Atualização otimista** — mude o status de uma contratação. A etiqueta
muda na hora, mesmo que o servidor leve ~1,5 s para confirmar.

**2. Rollback** — coloque em `recusado`, depois tente `aprovado`. O servidor
recusa com 409 após o atraso e o status **volta** para `recusado` com aviso na
tela.

**3. Race condition** — clique várias vezes rápido no mesmo botão de status.
Os cliques seguintes são descartados e o estado final é consistente.

**4. Auth fora do ar** — em outro terminal:

```bash
docker compose stop auth-service
```

A API responde **503** e a interface mostra mensagem de serviço indisponível.
Para voltar:

```bash
docker compose start auth-service
```

---

## Arquitetura

```
                    ┌──────────────────────────┐
                    │  Navegador (React 19)    │
                    │  http://localhost:8080   │
                    └────┬────────────────┬────┘
             POST /auth/login        Bearer <JWT>
                         │                │
              ┌──────────▼─────┐   ┌──────▼──────────┐
              │  Auth Service  │   │    Main API     │
              │     :3001      │   │     :3000       │
              └────────┬───────┘   └──────┬──────────┘
                       │                  │
                       │   POST /auth/validate
                       │   + x-internal-api-key
                       └◄─────────────────┘
                       │                  │
              ┌────────▼───────┐   ┌──────▼──────────┐
              │ postgres-auth  │   │  postgres-main  │
              └────────────────┘   └─────────────────┘
```

O Main API não valida JWT localmente — não tem o secret. A cada request
autenticado ele pergunta ao Auth Service se o token é válido, enviando uma
credencial de serviço própria (`x-internal-api-key`).

---

## Decisões técnicas relevantes

- **Dois containers Postgres** em vez de dois schemas: isolamento estrutural, impossível acessar o banco do outro serviço por acidente.
- **Prisma 7** com driver adapter: sem binário nativo, sem atrito de libc no Docker. Migrations versionadas em SQL aplicadas no entrypoint do container.
- **Status como texto** em vez de enum Postgres: evita camada de tradução para o valor `"em análise"` (com acento) e facilita adicionar novos status sem `ALTER TYPE`.
- **409 na transição bloqueada** (`recusado → aprovado`): o request é válido; o que impede é o estado do recurso, não o formato do dado.
- **503 na falha do Auth**: o Main API está funcionando — a dependência é que sumiu. Diferente de 500, que sinaliza bug interno.
- **Update condicional no banco** (`updateMany where: { id, status }`): proteção de concorrência no servidor, não só no frontend.
- **localStorage para o token**: cookie `httpOnly` exigiria mesmo domínio com HTTPS. Em HTTP local com portas diferentes, localStorage é a solução viável.
- **`materialize/dematerialize` no interceptor**: o `delay` do RxJS não atrasa erros; a materialização converte erro em valor comum, atrasa, e restaura — necessário para que o rollback do frontend seja visível.

---

## API

### Auth Service (`localhost:3001`)

```http
POST /auth/login
Content-Type: application/json

{ "email": "admin@ramper.com", "password": "ramper123" }
```

```http
POST /auth/validate
Content-Type: application/json
x-internal-api-key: dev-internal-api-key-troque-isto-em-producao

{ "token": "eyJ..." }
```

### Main API (`localhost:3000`)

Todas as rotas exigem `Authorization: Bearer <token>`.

| Método   | Rota                       | O que faz                             |
| -------- | -------------------------- | ------------------------------------- |
| `POST`   | `/contratacoes`            | cria (status sempre `solicitado`)     |
| `GET`    | `/contratacoes`            | lista; aceita `?status=aprovado`      |
| `GET`    | `/contratacoes/:id`        | busca uma                             |
| `PATCH`  | `/contratacoes/:id`        | atualiza nome, e-mail, produto        |
| `PATCH`  | `/contratacoes/:id/status` | muda status (regra + atraso de 1,5 s) |
| `DELETE` | `/contratacoes/:id`        | remove (204)                          |

| Código | Quando                                                    |
| ------ | --------------------------------------------------------- |
| 401    | sem token, token inválido ou expirado                     |
| 404    | contratação inexistente                                   |
| 409    | `recusado → aprovado`, ou conflito de escrita concorrente |
| 503    | Auth Service fora do ar ou em timeout                     |

---

## Testes

```bash
cd main-api && npm test
```

Duas suítes, 16 casos:

- **`contratacoes.service.spec.ts`** — regra de transição de status: bloqueio de `recusado → aprovado`, transições válidas, idempotência, conflito de concorrência e 404. Prisma substituído por dublê.
- **`s2s-auth.guard.spec.ts`** — guard S2S com `fetch` mockado: header ausente, token válido, propagação de 401, e os quatro modos de falha que viram 503.

---

## Rodando fora do Docker

```bash
docker compose up -d postgres-auth postgres-main

cd auth-service && npm install && npx prisma migrate deploy && npm run start:dev
cd main-api     && npm install && npx prisma migrate deploy && npm run start:dev
cd web          && npm install && npm run dev
```

Frontend em modo dev sobe em `http://localhost:5173`.

---

## Uso de IA

Projeto desenvolvido com Cursor (Claude). Minha experiência anterior é Laravel
e Python — NestJS, Prisma e React Query eram stacks novas. Compilei em strict
mode e testei cada cenário do enunciado manualmente antes de entregar.
