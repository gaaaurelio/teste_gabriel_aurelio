# Guia de entrevista — Gabriel Aurélio

> Referência rápida para a conversa com os devs avaliadores. Leia antes de entrar na call.

---

## Sumário

1. [Glossário de conceitos usados no projeto](#1-glossário-de-conceitos-usados-no-projeto)
2. [Dúvidas que apareceram e como foram resolvidas](#2-dúvidas-que-apareceram-e-como-foram-resolvidas)
3. [Decisões tomadas e por quê](#3-decisões-tomadas-e-por-quê)
4. [Roteiro de demonstração ao vivo (5 min)](#4-roteiro-de-demonstração-ao-vivo-5-min)

---

## 1. Glossário de conceitos usados no projeto

---

### 1.1 TypeScript strict mode

**O que é**
O TypeScript tem dois modos: relaxado e estrito. Com `"strict": true` no `tsconfig.json`, o compilador passa a exigir que você trate todos os valores que podem ser nulos antes de usá-los. Este projeto vai além: `noUncheckedIndexedAccess` (acessar `array[0]` pode retornar `undefined`) e `noImplicitOverride`.

**Onde aparece**
`auth-service/tsconfig.json` e `main-api/tsconfig.json`.

**Como explicar em uma frase**
> "Strict mode faz o TypeScript reclamar de tudo que pode dar null pointer em runtime — pega o erro na compilação antes de chegar em produção."

**Analogia com PHP/Laravel**
É o `declare(strict_types=1)` no topo do arquivo, mas com muito mais profundidade.

---

### 1.2 NestJS e sua arquitetura

**O que é**
NestJS é um framework Node.js que organiza o código em peças com responsabilidades claras:

- **Module**: agrupa tudo que pertence a uma área do sistema. Equivale ao Service Provider do Laravel.
- **Controller**: recebe o request HTTP, chama o Service, devolve a resposta.
- **Service**: onde fica a lógica de negócio.
- **Guard**: decide se o request pode continuar ou é bloqueado (autenticação). Equivale ao Middleware do Laravel.
- **Interceptor**: envolve a execução, podendo adicionar lógica antes e depois do handler.
- **Decorator**: anotação que configura o comportamento de uma classe ou método (`@Controller`, `@Get`, `@UseGuards`).

**Onde aparece**
```
auth-service/src/auth/auth.controller.ts
auth-service/src/auth/auth.service.ts
auth-service/src/auth/guards/internal-api-key.guard.ts
main-api/src/contratacoes/contratacoes.controller.ts
main-api/src/contratacoes/atraso-artificial.interceptor.ts
```

**Como explicar em uma frase**
> "NestJS é o Laravel do Node: dá estrutura, injeção de dependência e convenções para que a API não vire uma bagunça de arquivos."

---

### 1.3 DTO (Data Transfer Object)

**O que é**
Uma classe simples que define o formato esperado dos dados que chegam na API. Não tem lógica de negócio, não salva nada no banco. Com o `class-validator`, cada campo recebe decorators de validação (`@IsEmail`, `@IsString`) que o NestJS executa automaticamente antes de o Controller ver a requisição.

**Diferença para Model/Entity**

| | DTO | Model/Entity |
|---|---|---|
| Representa | Formato do dado HTTP | Estrutura do banco |
| Salva no banco? | Não | Sim |

**Onde aparece**
`auth-service/src/auth/dto/login.dto.ts`, `main-api/src/contratacoes/dto/`

**Como explicar em uma frase**
> "DTO é o 'formulário de entrada' da rota — define o que pode vir e rejeita o request antes de chegar na lógica se algo estiver errado."

**Analogia com PHP/Laravel**
É o equivalente ao `$request->validate([...])` do Laravel, mas como uma classe separada em vez de inline no Controller.

---

### 1.4 ORM (Object-Relational Mapper) e Prisma

**O que é**
ORM é uma biblioteca que deixa você trabalhar com o banco de dados usando objetos da linguagem em vez de SQL bruto. Prisma é o ORM escolhido aqui, com três partes:

1. **Schema** (`prisma/schema.prisma`): descreve as tabelas em uma sintaxe própria.
2. **Migrations** (`prisma/migrations/`): SQL gerado automaticamente pelo Prisma quando o schema muda.
3. **Client gerado** (`src/generated/prisma/`): código TypeScript para fazer queries — não editar à mão.

**Onde aparece**
```
auth-service/prisma/schema.prisma
auth-service/prisma/migrations/
auth-service/src/prisma/prisma.service.ts
```

**Como explicar em uma frase**
> "Prisma é o Eloquent do Node: você escreve o schema, ele gera as migrations e o código de acesso ao banco, tudo com tipos TypeScript."

---

### 1.5 JWT (JSON Web Token)

**O que é**
Um JWT é uma string em três partes separadas por ponto: `header.payload.signature`. O header diz qual algoritmo foi usado, o payload carrega os dados do usuário (id, email, expiração), e a assinatura garante que ninguém alterou o conteúdo.

"Verificar um JWT" significa: refazer o cálculo da assinatura com o segredo e comparar. Se bater e o token não tiver expirado, ele é válido.

**Onde aparece**
`auth-service/src/auth/auth.service.ts` — `this.jwt.signAsync(payload)` gera o token, `this.jwt.verifyAsync(token)` valida.

**Como explicar em uma frase**
> "JWT é um bilhete assinado digitalmente: qualquer um lê o que está escrito, mas só quem tem a chave consegue provar que o bilhete é legítimo."

---

### 1.6 Microserviço

**O que é**
Em vez de uma única aplicação que faz tudo, o sistema é dividido em serviços independentes. Cada um tem seu próprio banco, seu próprio processo, sua própria porta. Eles se comunicam pela rede.

Se o Auth Service cair, o Main API continua no ar (responde com erro nas rotas autenticadas, mas não derruba tudo). Num sistema único, matar uma parte pode derrubar o todo.

**Onde aparece**
`auth-service/` e `main-api/` são aplicações NestJS independentes. O `docker-compose.yml` sobe os dois em containers separados.

**Como explicar em uma frase**
> "Microserviço é uma peça do sistema que roda sozinha — se uma cair, as outras sobrevivem."

---

### 1.7 Comunicação S2S (server-to-server)

**O que é**
S2S é quando um servidor chama outro servidor diretamente, sem um usuário humano no meio. Precisa de uma credencial própria porque o token do usuário identifica *quem está usando o sistema*, não *qual serviço está fazendo a chamada*.

**Onde aparece**
O Main API envia o header `x-internal-api-key` para o Auth Service ao chamar o endpoint `/auth/validate`. O `InternalApiKeyGuard` verifica essa chave antes de responder.

**Como explicar em uma frase**
> "S2S é a comunicação de máquina para máquina — precisa de credencial própria porque não tem usuário humano na chamada."

---

### 1.8 Guard (NestJS)

**O que é**
Um Guard decide se o request pode continuar. Retorna `true` (libera) ou lança uma exceção (bloqueia com 401 ou 403). Roda antes do Controller.

**Onde aparece**
- `S2SAuthGuard` (`main-api/src/auth/s2s-auth.guard.ts`): extrai o Bearer token e chama o Auth Service para validar.
- `InternalApiKeyGuard` (`auth-service/src/auth/guards/internal-api-key.guard.ts`): confere o header `x-internal-api-key`.

**Como explicar em uma frase**
> "Guard é o segurança da porta: decide se o request entra ou vai embora com 401."

**Analogia com PHP/Laravel**
É o Middleware do Laravel aplicado em rota ou grupo de rotas.

---

### 1.9 Interceptor (NestJS)

**O que é**
Envolve a execução do handler com lógica de "antes e depois". Pode transformar a resposta sem tocar no código de negócio.

**Onde aparece**
`main-api/src/contratacoes/atraso-artificial.interceptor.ts` — adiciona 1,5 s de delay em todo o endpoint `PATCH /contratacoes/:id/status`. O uso de `materialize`/`dematerialize` garante que o delay também se aplica a erros (o `delay` do RxJS sozinho só atrasa respostas de sucesso).

```typescript
return next.handle().pipe(materialize(), delay(atrasoMs), dematerialize());
```

**Como explicar em uma frase**
> "Interceptor é um wrapper em volta do handler — adiciona lógica antes e depois sem mexer no código de negócio."

---

### 1.10 CORS

**O que é**
Política de segurança do navegador: por padrão, um script em `localhost:8080` não pode chamar `localhost:3000` — origens diferentes. O servidor precisa responder com headers dizendo quais origens aceita.

**Onde aparece**
`auth-service/src/main.ts` e `main-api/src/main.ts`: `app.enableCors({ origin: corsOrigins })`.

**Como explicar em uma frase**
> "CORS é o servidor dizendo ao navegador 'pode me chamar dessa origem' — sem isso o browser bloqueia antes mesmo de você ver o erro."

---

### 1.11 Docker e Docker Compose

**O que é**
- **Imagem**: foto congelada do ambiente — sistema, dependências, código. Definida pelo `Dockerfile`.
- **Container**: instância rodando da imagem.
- **Docker Compose**: define quais containers rodar, como se comunicam, quais variáveis têm, quais portas expõem.

**Onde aparece**
Cada serviço tem seu `Dockerfile`. O `docker-compose.yml` na raiz sobe tudo: dois Postgres, Auth Service, Main API e o frontend.

**Como explicar em uma frase**
> "Docker empacota o app com tudo que precisa — não tem mais 'na minha máquina funciona'."

---

### 1.12 Volumes Docker

**O que são**
Containers são descartáveis — quando morrem, os arquivos somem. Volume é uma área de armazenamento que persiste entre reinicializações.

**Onde aparece**
`pgdata-auth` e `pgdata-main` no `docker-compose.yml`. Sem eles, cada `docker compose down` apagaria o banco inteiro.

**Como explicar em uma frase**
> "Volume é o HD externo do container — os dados ficam mesmo quando o container é destruído."

---

### 1.13 Healthcheck

**O que faz**
O Docker executa um comando periodicamente e marca o container como `healthy` ou `unhealthy`. O `depends_on: condition: service_healthy` faz um serviço esperar o outro estar pronto antes de iniciar.

**Onde aparece**
`postgres-auth` usa `pg_isready`. `auth-service` usa `curl http://localhost:3001/health`. Sem isso, o NestJS tentaria conectar antes do Postgres estar pronto.

**Como explicar em uma frase**
> "Healthcheck garante que um serviço só sobe depois que suas dependências estão realmente de pé."

---

### 1.14 React Query (TanStack Query)

**O que é**
Biblioteca de gerenciamento de dados do servidor no React. Em vez de `useEffect + useState + fetch`, você usa `useQuery` para dados que vêm da API. Cuida de cache, estados de loading/error, retry e cancelamento automaticamente.

**Onde aparece**
`web/src/contratacoes/use-contratacoes.ts` — `useContratacoes`, `useAtualizarStatus`, `useCriarContratacao`, `useExcluirContratacao`.

**Como explicar em uma frase**
> "React Query cuida do cache e dos estados de loading/erro — você declara o que quer buscar, ele gerencia o resto."

---

### 1.15 Atualização otimista

**O que é**
Quando o usuário faz uma ação, a UI atualiza imediatamente como se já tivesse funcionado. Se o servidor confirmar, ótimo. Se der erro, a tela volta ao estado anterior (rollback).

**Por que existe aqui**
O endpoint de status tem 1,5 s de delay artificial. Sem otimismo, o usuário ficaria olhando para uma tela congelada. Com ele, o status muda na hora do clique.

**Como explicar em uma frase**
> "Atualização otimista é 'fingir que já funcionou' na UI enquanto o servidor processa — se der errado, desfaz."

---

### 1.16 Race condition

**O que é**
Quando duas operações concorrentes dependem do mesmo estado e o resultado depende da ordem de chegada. Na UI aparece como a tela mostrando um estado diferente do que você clicou.

**Como foi resolvido**

1. **AbortController no React Query**: cancela o fetch anterior quando o filtro muda.
2. **`cancelQueries` antes da mutação**: cancela refetches em voo antes de escrever o valor otimista.
3. **Update condicional no banco** (`updateMany where: {id, status}`): garante que dois requests simultâneos não façam uma transição proibida passar em silêncio.

**Como explicar em uma frase**
> "Race condition é quando duas coisas concorrentes brigam pelo mesmo estado — a que chegar por último ganha, mesmo sendo a mais velha."

---

### 1.17 AbortController / AbortSignal

**O que faz**
Permite cancelar um `fetch` em andamento. Quando `controller.abort()` é chamado, o request para imediatamente.

**Onde aparece**
1. **Frontend**: o React Query passa um `signal` para o `queryFn` — se o componente sair da tela ou o filtro mudar, o fetch obsoleto é cancelado.
2. **Backend**: `main-api/src/auth/auth-client.service.ts` usa `AbortSignal.timeout(2000)` — se o Auth Service não responder em 2 segundos, o timeout dispara e o Main API retorna 503.

**Como explicar em uma frase**
> "AbortSignal é um botão de cancelamento passado para o fetch — quando ativado, a requisição para de esperar."

---

### 1.18 HTTP 409 Conflict

**Quando usar**
- **400**: request malformado — campo faltando, tipo errado.
- **409**: o request está correto, mas o **estado atual do recurso** impede a operação.

**Onde aparece**
Dois casos: tentativa de `recusado → aprovado` (transição bloqueada) e concorrência (dois requests chegaram ao mesmo tempo e o segundo perdeu a corrida).

**Como explicar em uma frase**
> "409 é 'seu pedido está certo, mas o recurso discorda' — o problema é o estado do objeto, não o formato do request."

---

### 1.19 HTTP 503 Service Unavailable

**Quando usar**
- **500**: bug inesperado na própria aplicação.
- **503**: a aplicação está funcionando, mas uma **dependência** está fora do ar.

**Onde aparece**
`main-api/src/auth/auth-client.service.ts`: se o Auth Service não responde, o Main API retorna 503 — não é um bug do Main API, é a dependência que sumiu.

**Como explicar em uma frase**
> "503 é 'eu estou de pé, mas o serviço do qual dependo não está' — diferente de 500, que é 'eu mesmo quebrei'."

---

### 1.20 bcrypt

**O que é**
Função de hash para senhas: transforma a senha em uma sequência irreversível. Para verificar, aplica a função na senha digitada e compara com o hash guardado. Os "rounds" (custo) controlam o quão lento o cálculo é — lento para quem tenta adivinhar por força bruta, imperceptível para um login legítimo.

**Onde aparece**
`auth-service/src/auth/auth.service.ts`: `bcrypt.compare(password, passwordHash)`. O bcrypt roda mesmo quando o usuário não existe (usando `DUMMY_HASH`) para que o tempo de resposta não revele quais emails estão cadastrados.

**Como explicar em uma frase**
> "bcrypt transforma a senha em algo irreversível — se o banco vazar, o atacante ainda precisa de muito tempo para descobrir as senhas."

---

### 1.21 timingSafeEqual

**O que é**
Comparação normal (`===`) para quando encontra o primeiro caractere diferente. Um atacante pode medir o tempo de resposta e descobrir caractere por caractere qual é o segredo (timing attack). `timingSafeEqual` compara sempre no mesmo tempo, independente de onde a diferença está.

**Onde aparece**
`auth-service/src/auth/guards/internal-api-key.guard.ts` — compara a `INTERNAL_API_KEY` recebida com a esperada.

**Como explicar em uma frase**
> "timingSafeEqual compara sempre no mesmo tempo — impede que alguém descubra a chave medindo quanto tempo a resposta demora."

---

### 1.22 Variáveis de ambiente

**Por que existem**
Separar configuração do código: a mesma imagem Docker funciona em dev e produção com variáveis diferentes. Evita que senhas e chaves fiquem no repositório.

**Diferença entre Vite e Node**

| | Vite (`VITE_*`) | Node.js |
|---|---|---|
| Quando é lido | Durante `npm run build` | Quando o processo inicia |
| Pode mudar sem rebuild? | Não | Sim |

**Onde aparece**
As variáveis `VITE_AUTH_URL` e `VITE_API_URL` são passadas como `args` no `docker-compose.yml` porque o JavaScript já está compilado quando o Nginx sobe — não existe mais Vite em runtime.

**Como explicar em uma frase**
> "Variáveis VITE_* são embutidas no bundle na hora do build, não em runtime — por isso precisam de build args no Docker."

---

### 1.23 Driver adapter (Prisma 7)

**O que mudou**
Versões anteriores do Prisma embutiam um binário nativo para executar queries. Esse binário precisava ser compatível com o sistema operacional do container. No Prisma 7, as queries passam por um driver Node.js separado (`@prisma/adapter-pg`), sem binário nativo no client.

**Onde aparece**
`auth-service/src/prisma/prisma.service.ts`:
```typescript
import { PrismaPg } from '@prisma/adapter-pg';
super({ adapter: new PrismaPg({ connectionString: ... }) });
```

**Como explicar em uma frase**
> "No Prisma 7 a query engine mudou para funcionar via driver Node.js — menos problemas com binário nativo no Docker."

---

## 2. Dúvidas que apareceram e como foram resolvidas

---

### 2.1 "O scaffold do NestJS não vem com strict mode?"

**O que aconteceu**
O `nest new` gera um `tsconfig.json` com configuração padrão, sem strict mode.

**O que foi investigado**
Ao tentar compilar com `"strict": true` habilitado, o compilador apontou vários pontos no código gerado automaticamente que precisavam de ajuste — valores que podiam ser `null` sem tratamento, retornos sem tipo explícito.

**O que foi feito**
Adicionou manualmente ao `tsconfig.json` dos dois serviços: `"strict": true`, `"noImplicitOverride": true`, `"noUncheckedIndexedAccess": true`. Exigiu ajustes no código, mas elimina classes inteiras de bugs.

---

### 2.2 "Por que o npm install passou mas o Prisma não funcionava?"

**O que aconteceu**
`npm install` saiu com sucesso, mas `npx prisma generate` não funcionava.

**O que foi investigado**
Relendo o log do `npm install`, havia um aviso que passa despercebido:
```
npm warn exec The following package was not installed because it failed to pass the security audit: prisma
```
O npm 11 passou a bloquear scripts de pós-instalação por padrão. O Prisma precisa de um script pós-instalação para baixar o schema engine.

**O que foi feito**
Rodou `npm approve-scripts prisma @prisma/engines` no diretório do serviço. Após isso, o `prisma generate` funcionou corretamente.

---

### 2.3 "Por que o build gerava os arquivos no lugar errado?"

**O que aconteceu**
O container esperava `dist/main.js`, mas o compilador gerava `dist/src/main.js`.

**O que foi investigado**
O TypeScript infere o `rootDir` a partir do arquivo mais "alto" na compilação. Como `prisma.config.ts` ficava na raiz (fora de `src/`) e era incluído implicitamente, o compilador considerava a raiz como ponto de partida.

**O que foi feito**
Adicionou `"rootDir": "./src"` explicitamente no `tsconfig.json` e excluiu `prisma.config.ts` do bundle principal. O `dist/main.js` passou a ficar no lugar certo.

---

### 2.4 "Por que o delay não atrasava as respostas de erro?"

**O que aconteceu**
O `AtrasoArtificialInterceptor` atrasava respostas de sucesso, mas erros (como o 409 de transição bloqueada) voltavam instantaneamente.

**O que foi investigado**
O operador `delay` do RxJS só atrasa valores de sucesso. Uma exceção do NestJS vira uma notificação de `error` no Observable, que passa pelo `delay` sem ser atrasada.

**O que foi feito**
Usou `materialize()` + `delay(atrasoMs)` + `dematerialize()`: a materialização converte qualquer notificação (inclusive erros) em um valor comum, o delay atrasa todos, e a desmaterialização restaura o tipo original. Assim o rollback da tela também tem o atraso esperado.

---

### 2.5 "Por que as variáveis VITE_* não funcionavam no docker-compose?"

**O que aconteceu**
Passar `VITE_AUTH_URL` no bloco `environment:` do serviço `web` não tinha efeito — as URLs continuavam vazias.

**O que foi investigado**
O frontend é um conjunto de arquivos estáticos gerados durante o build. O Vite substitui `import.meta.env.VITE_*` pelo valor literal no momento do `npm run build`. No container Nginx, não existe Vite — é só um servidor de arquivos. Variáveis de ambiente passadas ao Nginx não têm nenhum efeito no JavaScript já compilado.

**O que foi feito**
Moveu as variáveis para `build.args` no `docker-compose.yml`, disponíveis durante o `docker build`. No `Dockerfile` do web, os `ARG` são copiados para `ENV` antes do `npm run build`.

---

### 2.6 "Por que o Postgres 18 não iniciava?"

**O que aconteceu**
O container `postgres-auth` ficava reiniciando em loop e o healthcheck nunca passava.

**O que foi investigado**
O log do container (`docker compose logs postgres-auth`) mostrava erro de inicialização relacionado ao diretório de dados. O Postgres 18 mudou a convenção: espera o volume montado em `/var/lib/postgresql` (sem o `/data`) e cria a estrutura de versão por conta própria. Montar em `/var/lib/postgresql/data` (padrão das versões anteriores) causava conflito.

**O que foi feito**
Corrigiu o volume no `docker-compose.yml` de `/var/lib/postgresql/data` para `/var/lib/postgresql`. O container inicializou e o healthcheck passou.

---

## 3. Decisões tomadas e por quê

---

### 3.1 Prisma como ORM vs TypeORM

**Decisão:** Prisma.
**Alternativa descartada:** TypeORM.
**Razão:** Migrations do Prisma são confiáveis — você descreve o schema, ele gera o SQL. O TypeORM tem histórico de migrations instáveis em casos de rename de coluna. O Prisma também gera tipos TypeScript que refletem exatamente o schema, eliminando divergência entre código e banco.

---

### 3.2 Status como coluna de texto vs enum do Postgres

**Decisão:** coluna `TEXT`.
**Alternativa descartada:** `CREATE TYPE status_enum AS ENUM (...)`.
**Razão:** Um dos valores é `"em análise"` — com acento. Enums do Postgres são sensíveis a encoding e difíceis de alterar depois (`ALTER TYPE` não é transacional em algumas versões). Com texto, adicionar um novo status é só incluir no código sem precisar de migration especial.

---

### 3.3 localStorage para o token vs cookie httpOnly

**Decisão:** `localStorage`.
**Alternativa descartada:** cookie `httpOnly` com `SameSite=Strict`.
**Razão:** Cookie httpOnly é tecnicamente mais seguro, mas exige que o frontend e a API estejam no mesmo domínio. Em desenvolvimento local, `localhost:8080` (frontend) e `localhost:3001` (Auth) são origens diferentes — o cookie de um não vai para o outro sem HTTPS e configuração adicional. Para uma demonstração em HTTP local, `localStorage` é a solução que funciona sem complicações de infraestrutura.

---

### 3.4 Dois containers Postgres vs dois schemas no mesmo container

**Decisão:** dois containers separados.
**Alternativa descartada:** um container com dois schemas.
**Razão:** O objetivo dos microserviços é que nenhum acesse os dados do outro. Com dois schemas no mesmo servidor, uma connection string errada quebra esse isolamento sem aviso nenhum. Com dois containers, é impossível acidentalmente — o `main-api` não tem credenciais do banco do `auth-service`.

---

### 3.5 Validação S2S vs validação local do JWT

**Decisão:** Main API chama o Auth Service para validar o token.
**Alternativa descartada:** Main API lê o `JWT_SECRET` e valida localmente.
**Razão:** Se o `JWT_SECRET` for copiado para o Main API, qualquer comprometimento do Main API expõe o segredo de todo o sistema. Delegando ao Auth Service, a autoridade sobre "esse token é válido?" fica centralizada. O custo é uma chamada de rede por request autenticado.

---

### 3.6 503 na falha do Auth vs 500

**Decisão:** `ServiceUnavailableException` (503).
**Alternativa descartada:** `InternalServerErrorException` (500).
**Razão:** 500 indica bug na própria aplicação. 503 indica que uma dependência está indisponível. O Main API está funcionando — ele tentou chamar o Auth e não conseguiu. Isso é 503 e sinaliza ao cliente que vale tentar de novo em instantes.

---

### 3.7 409 na transição bloqueada vs 400

**Decisão:** `ConflictException` (409).
**Alternativa descartada:** `BadRequestException` (400).
**Razão:** O request está corretamente formado — o status existe, o ID existe, o formato está certo. O que impede a operação é o estado atual do recurso (`recusado`). Por definição, 409 é para "o request não pode ser completado por causa do estado atual do recurso". Usar 400 seria semanticamente errado.

---

### 3.8 DDD não implementado

**Decisão:** manter a lógica de domínio no Service, sem refatorar para DDD completo.
**O que seria o DDD completo:** extrair as regras de status para uma entidade `Contratacao` com métodos próprios (`contratacao.aprovar()`, `contratacao.recusar()`), e criar interfaces de repositório separadas do Prisma.
**Razão:** o domínio tem quatro status e uma regra de transição — pequeno demais para justificar essa separação. O prazo era fixo. Refatorar arquitetura sem mais cobertura de testes cria risco de quebrar o que funciona. A decisão foi documentada em vez de escondida.

---

### 3.9 Update condicional no banco

**Decisão:** `updateMany({ where: { id, status: atual.status } })`.
**Alternativa descartada:** verificar o status com `findOne` antes de fazer o `update`.
**Razão:** entre o `findOne` e o `update` existe uma janela de tempo. Dois requests podem ler `status: 'recusado'` ao mesmo tempo. O primeiro vai para `em análise` (válido). O segundo, que também leu `recusado`, ainda tentaria ir para `aprovado`. Com a condição no `updateMany`, o segundo update não afeta nenhum registro (o status já mudou) e retorna `count: 0`, disparando um 409.

---

### 3.10 Imagem node:24-slim e não Alpine

**Decisão:** `node:24-slim` (Debian Slim).
**Alternativa descartada:** `node:24-alpine`.
**Razão:** O Alpine Linux usa uma biblioteca C diferente (`musl libc`). O binário que executa as migrations do Prisma é compilado para `glibc` (padrão do Debian) e não roda no Alpine sem camadas extras. A imagem Debian Slim é maior, mas evita um problema de runtime difícil de diagnosticar.

---

## 4. Roteiro de demonstração ao vivo (5 min)

> Antes de começar: `docker compose up --build` rodando, todos os containers `healthy`. Abra `http://localhost:8080` no browser.

---

### Passo 1 — Login (30 s)

**Ação:** entre com `admin@ramper.com.br` / `admin123`.

**O que dizer:**
> "O frontend chama `POST /auth/login`. O Auth Service busca o usuário, compara a senha com bcrypt, assina um JWT e devolve o token. O frontend guarda em localStorage — não é o mais seguro, mas foi uma decisão deliberada para funcionar em HTTP local sem complicações de cookie cross-origin."

---

### Passo 2 — Listar e criar contratação (1 min)

**Ação:** observe a lista. Clique em "Nova Contratação" e crie uma com nome, email e produto.

**O que dizer:**
> "Toda chamada à Main API vai com `Authorization: Bearer <token>`. O `S2SAuthGuard` intercepta, chama `POST /auth/validate` com a `INTERNAL_API_KEY` no header, e o Auth confirma que o token é válido. O Main API nunca vê o JWT_SECRET — quem decide se o token é válido é sempre o Auth Service. O status começa em 'solicitado' — o cliente não pode escolher."

---

### Passo 3 — Atualização otimista e atraso artificial (1,5 min)

**Ação:** mude o status de "solicitado" para "em análise". Veja a tela atualizar na hora, mas o botão ficar desabilitado por ~1,5 s.

**O que dizer:**
> "O endpoint tem 1,5 s de delay artificial — implementado com `AtrasoArtificialInterceptor` usando `materialize/dematerialize` para atrasar também os erros, não só o sucesso. Sem atualização otimista, a UI ficaria travada 1,5 s. Com ela, o React Query escreve o novo status no cache imediatamente e desabilita a linha para evitar duplo clique."

---

### Passo 4 — Transição bloqueada e rollback (1 min)

**Ação:** mude para "recusado". Depois tente mudar para "aprovado".

**O que dizer:**
> "Retorna 409 Conflict — não 400, porque o request está bem formado. O problema é o estado do recurso: 'recusado' não pode ir direto para 'aprovado'. A tela volta para 'recusado' — isso é o rollback: o React Query restaurou o snapshot que salvou antes de escrever o valor otimista."

---

### Passo 5 — Auth Service fora do ar → 503 (1 min)

**Ação:** em outro terminal, `docker compose stop auth-service`. Tente qualquer operação autenticada.

**O que dizer:**
> "O Main API continua de pé — ele não depende do Auth para funcionar. Mas ao tentar validar o token, o `AuthClientService` tem um timeout de 2 segundos. Depois disso, retorna 503. O frontend mostra a mensagem de serviço indisponível. Depois: `docker compose start auth-service` — em alguns segundos tudo volta ao normal."

---

> **Sobre o uso de IA:** se perguntarem, seja direto — "usei o Cursor com Claude para montar o projeto porque as stacks eram novas para mim. O que está documentado aqui são as decisões que foram tomadas, por que cada uma foi feita assim, e os problemas que apareceram no caminho. É exatamente isso que posso explicar e defender."
