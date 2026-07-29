# Guia de entrevista — Gabriel Aurélio

> Este guia foi escrito como se um colega sênior estivesse te preparando para a conversa com os devs avaliadores. Não é documentação fria — é o que você precisaria ouvir antes de sentar na sala.

---

## Sumário

1. [Glossário de conceitos usados no projeto](#1-glossário-de-conceitos-usados-no-projeto)
2. [Dúvidas registradas e como foram resolvidas](#2-dúvidas-registradas-e-como-foram-resolvidas)
3. [Decisões tomadas e por quê](#3-decisões-tomadas-e-por-quê)
4. [Visão de melhorias futuras](#4-visão-de-melhorias-futuras)
5. [Roteiro de demonstração ao vivo (5 min)](#5-roteiro-de-demonstração-ao-vivo-5-min)

---

## 1. Glossário de conceitos usados no projeto

---

### 1.1 TypeScript strict mode

**O que é**
O TypeScript tem um modo relaxado (padrão do scaffold do NestJS antes de você ajustar) e um modo estrito. `"strict": true` no `tsconfig.json` habilita um conjunto de verificações extras: proibição de `any` implícito, checagem de nulo/undefined em todo lugar, e mais. Além do `strict`, este projeto vai além com `noUncheckedIndexedAccess` (acessar `array[0]` pode retornar `undefined`) e `noImplicitOverride`.

**Como aparece neste projeto**
`auth-service/tsconfig.json` e `main-api/tsconfig.json` — linhas `"strict": true`, `"noImplicitOverride": true`, `"noUncheckedIndexedAccess": true`.

**Como explicar em uma frase**
> "Strict mode é o TypeScript pedindo que você seja explícito em tudo que pode ser nulo ou não tipado — é o que separa um TS que é só JavaScript glorificado de um TS que realmente pega bug em compile time."

**Analogia com Laravel/PHP**
É o `declare(strict_types=1)` no topo do arquivo PHP, mas com muito mais profundidade. O PHP no modo estrito rejeita coerção de tipo. O TS no modo estrito faz o compilador te forçar a tratar todo valor que pode ser `null` ou `undefined` antes de usá-lo.

---

### 1.2 NestJS e sua arquitetura

**O que é**
NestJS é um framework para Node.js construído em cima do Express. Ele organiza o código em peças com responsabilidades bem definidas:

- **Module**: agrupa tudo que pertence a uma fatia do sistema (ex: `AuthModule`, `ContratacoesModule`). É o equivalente a um Service Provider do Laravel.
- **Controller**: recebe a requisição HTTP, chama o Service, retorna a resposta. Igual a um Controller do Laravel.
- **Service**: contém a lógica de negócio. Igual a um Service do Laravel.
- **Guard**: decide se a requisição pode continuar (autenticação/autorização). Igual a um Middleware de autenticação do Laravel.
- **Interceptor**: envolve a execução do handler, podendo alterar entrada e saída. Equivale a um Middleware de mais baixo nível ou a um `around` hook.
- **Decorator**: anotação que adiciona metadados a uma classe ou método (ex: `@Controller`, `@Get`, `@UseGuards`). É o equivalente às annotations do PHP com Atributos ou às anotações do Doctrine.

**Como aparece neste projeto**
```
auth-service/src/
  app.module.ts          ← módulo raiz
  auth/auth.module.ts    ← módulo de auth
  auth/auth.controller.ts
  auth/auth.service.ts
  auth/guards/internal-api-key.guard.ts
main-api/src/
  contratacoes/contratacoes.module.ts
  contratacoes/contratacoes.controller.ts
  contratacoes/contratacoes.service.ts
  contratacoes/atraso-artificial.interceptor.ts
  auth/s2s-auth.guard.ts
```

**Como explicar em uma frase**
> "NestJS é o Laravel do Node: dá estrutura, injeção de dependência e convenções para que uma API grande não vire uma bagunça de arquivos."

---

### 1.3 DTO (Data Transfer Object)

**O que é**
Um DTO é uma classe simples cujo único papel é definir o formato esperado de um dado que chega ou sai da API. Não tem lógica de negócio, não acessa banco. Junto com o `class-validator`, cada campo do DTO ganha decorators de validação (`@IsEmail`, `@IsString`, `@MinLength`) que o `ValidationPipe` do NestJS executa automaticamente antes de o Controller ver qualquer coisa.

**Diferença de Model/Entity**
| | DTO | Model/Entity |
|---|---|---|
| Representa | Formato do dado HTTP | Estrutura do banco |
| Salva no banco? | Não | Sim |
| Tem validação HTTP? | Sim | Não |

**Como aparece neste projeto**
```typescript
// auth-service/src/auth/dto/login.dto.ts
export class LoginDto {
  @IsEmail({}, { message: 'email deve ser um endereco de e-mail valido' })
  email!: string;

  @IsString()
  @MinLength(6)
  password!: string;
}
```
Outros DTOs: `main-api/src/contratacoes/dto/create-contratacao.dto.ts`, `update-status.dto.ts`.

**Como explicar em uma frase**
> "DTO é o 'formulário de entrada' da rota — define o que pode vir e rejeita o request antes mesmo de chegar na lógica se algo estiver faltando."

**Analogia com Laravel/PHP**
É o equivalente ao `$request->validate([...])` do Laravel, mas como uma classe dedicada em vez de inline no Controller.

---

### 1.4 ORM (Object-Relational Mapper) e Prisma

**O que é**
ORM é uma biblioteca que deixa você interagir com o banco de dados usando objetos da linguagem em vez de SQL bruto. Prisma é o ORM escolhido aqui — ele tem três partes:
1. **Schema** (`prisma/schema.prisma`): arquivo que descreve as tabelas em uma sintaxe própria.
2. **Migrations** (`prisma/migrations/`): SQL gerado automaticamente pelo Prisma quando o schema muda. Versionado no Git.
3. **Client gerado** (`src/generated/prisma/`): código TypeScript gerado pelo `prisma generate`. É o que você usa no código para fazer queries.

**Como aparece neste projeto**
```
auth-service/prisma/schema.prisma
auth-service/prisma/migrations/20260727000000_init/migration.sql
auth-service/src/generated/prisma/          ← gerado, não editar à mão
auth-service/prisma.config.ts               ← config do Prisma 7
auth-service/src/prisma/prisma.service.ts   ← instância do PrismaClient
```

**Como explicar em uma frase**
> "Prisma é o Eloquent do Node: você escreve o schema, ele gera as migrations e o código de acesso ao banco, tudo com tipos TypeScript."

**Analogia com Laravel/PHP**
`prisma.schema` → `migrations/xxxx_create_users_table.php` + Eloquent Model. `prisma generate` → o Eloquent ORM em si.

---

### 1.5 JWT (JSON Web Token)

**O que é**
Um JWT é uma string em três partes separadas por ponto: `header.payload.signature`. O header diz qual algoritmo foi usado, o payload carrega os dados (claims: `sub`, `email`, `name`, `exp`), e a assinatura garante que ninguém alterou o conteúdo sem ter o segredo.

A assinatura usa HMAC-SHA256: o servidor pega `base64(header) + "." + base64(payload)`, aplica HMAC com o `JWT_SECRET`, e coloca o resultado como terceira parte. Para verificar, refaz o cálculo e compara — se bater, o token é autêntico.

**"Verificar um JWT" significa:**
1. Decodificar header e payload (qualquer um consegue, está em base64).
2. Recalcular a assinatura com o segredo e comparar com a assinatura do token.
3. Checar se `exp` (expiração) ainda não passou.

**Como aparece neste projeto**
`auth-service/src/auth/auth.service.ts` — `this.jwt.signAsync(payload)` gera o token, `this.jwt.verifyAsync(token)` valida. O Auth Service é o único que conhece o `JWT_SECRET` — o Main API não tem esse secret e deliberadamente não valida o token sozinho.

**Como explicar em uma frase**
> "JWT é um bilhete assinado digitalmente: qualquer um lê o que está escrito, mas só quem tem a chave consegue provar que o bilhete é legítimo."

---

### 1.6 Microserviço

**O que é**
Em vez de uma única aplicação que faz tudo (monolito), um sistema de microserviços divide o domínio em serviços independentes: cada um tem seu próprio banco, seu próprio processo, sua própria porta. Eles se comunicam pela rede.

A diferença prática: se você matar o Auth Service, o Main API continua no ar (responde 503 nas rotas autenticadas, mas não cai). Num monolito, matar o módulo de auth derruba tudo.

**Por que dois serviços aqui e não um**
O enunciado pede separação explícita de responsabilidades. O Auth cuida de sessão e credenciais; o Main API cuida de contratações. Cada um tem seu banco, suas migrations, sua lógica — nenhum sabe dos detalhes internos do outro.

**Como aparece neste projeto**
`auth-service/` e `main-api/` são aplicações NestJS independentes. O `docker-compose.yml` sobe os dois em containers separados.

**Como explicar em uma frase**
> "Microserviço é uma peça do sistema que roda sozinha, tem seu próprio banco e se comunica com as outras pela rede — se uma cair, as outras sobrevivem."

---

### 1.7 Comunicação S2S (server-to-server)

**O que é**
S2S é quando um servidor chama outro servidor sem que haja um usuário humano no meio daquela requisição específica. Precisa de uma credencial própria porque o JWT do usuário identifica *quem está usando*, não *qual serviço está chamando*.

**Por que credencial separada**
Se o Main API mandasse o JWT do usuário para se identificar no Auth Service, qualquer pessoa com um JWT válido poderia chamar o endpoint `/auth/validate` diretamente e sondar tokens alheios. A `INTERNAL_API_KEY` identifica o *serviço* chamador — é uma credencial de infraestrutura.

**Como aparece neste projeto**
Header `x-internal-api-key` enviado pelo `AuthClientService` (`main-api/src/auth/auth-client.service.ts`) e verificado pelo `InternalApiKeyGuard` (`auth-service/src/auth/guards/internal-api-key.guard.ts`).

**Como explicar em uma frase**
> "S2S é a comunicação de máquina para máquina — precisa de credencial própria porque não tem usuário humano identificando a chamada."

---

### 1.8 Guard (NestJS)

**O que é**
Um Guard implementa `CanActivate` e retorna `true` (deixa passar) ou lança uma exceção (bloqueia). Roda antes do Controller. A diferença em relação a um middleware tradicional do Express é que o Guard tem acesso ao contexto de execução do NestJS (sabe qual Controller, qual método, quais decorators foram aplicados), o que permite lógica de autorização mais sofisticada.

**Como aparece neste projeto**
Dois Guards:
- `S2SAuthGuard` (`main-api/src/auth/s2s-auth.guard.ts`): extrai o Bearer token e delega a validação ao Auth Service. Aplicado no `ContratacoesController` inteiro.
- `InternalApiKeyGuard` (`auth-service/src/auth/guards/internal-api-key.guard.ts`): confere o header `x-internal-api-key`. Aplicado no endpoint `POST /auth/validate`.

**Como explicar em uma frase**
> "Guard é o segurança da porta: roda antes de qualquer coisa no Controller e decide se a requisição entra ou vai embora com 401."

**Analogia com Laravel/PHP**
É o equivalente a um Middleware do Laravel aplicado em rota ou grupo de rotas — mas com acesso a metadados do controller via reflection.

---

### 1.9 Interceptor (NestJS)

**O que é**
Um Interceptor envolve a execução do handler como um "antes e depois". Implementa `NestInterceptor` com o método `intercept`, que recebe o `next.handle()` (o Observable que representa a execução do handler) e pode transformá-lo.

**Onde foi usado no projeto**
`main-api/src/contratacoes/atraso-artificial.interceptor.ts` — adiciona 1,5 s de delay artificial em todo o endpoint `PATCH /contratacoes/:id/status`. O truque com `materialize`/`dematerialize` é necessário porque o `delay` do RxJS por padrão só atrasa valores de sucesso; erros passariam imediatamente. Com a materialização, o erro vira um valor comum e também sofre o delay.

```typescript
return next
  .handle()
  .pipe(materialize(), delay(atrasoMs), dematerialize());
```

**Como explicar em uma frase**
> "Interceptor é um wrapper em volta do handler — pode adicionar lógica antes, depois, e até transformar a resposta, sem tocar no código de negócio."

---

### 1.10 CORS

**O que é**
CORS (Cross-Origin Resource Sharing) é uma política de segurança dos navegadores: por padrão, um script rodando em `http://localhost:8080` não pode chamar `http://localhost:3000` — origens diferentes. O servidor precisa responder com headers `Access-Control-Allow-Origin` dizendo que aceita aquela origem.

**O que configura no projeto**
`auth-service/src/main.ts` e `main-api/src/main.ts`: `app.enableCors({ origin: corsOrigins })`. As origens permitidas vêm da variável de ambiente `CORS_ORIGINS` (valor padrão: `http://localhost:8080,http://localhost:5173`).

**Como explicar em uma frase**
> "CORS é o servidor dizendo ao navegador 'pode me chamar dessa origem' — sem isso o browser bloqueia a requisição antes mesmo de você ver o erro na API."

---

### 1.11 Docker e Docker Compose

**O que é**
- **Imagem**: foto congelada do ambiente — sistema operacional, dependências, código. Definida pelo `Dockerfile`.
- **Container**: instância rodando de uma imagem. Como um processo isolado com seu próprio sistema de arquivos.
- **Dockerfile**: receita para construir a imagem (instalar deps, copiar código, definir comando de entrada).
- **Docker Compose**: orquestrador local. O `docker-compose.yml` define quais containers rodar, como se comunicam, quais variáveis de ambiente têm, quais portas expõem.

**Como aparece neste projeto**
Cada serviço tem seu `Dockerfile` (`auth-service/Dockerfile`, `main-api/Dockerfile`, `web/Dockerfile`). O `docker-compose.yml` na raiz sobe tudo: dois Postgres, Auth Service, Main API e o frontend Nginx.

**Como explicar em uma frase**
> "Docker empacota o aplicativo com tudo que ele precisa para rodar — não tem mais 'na minha máquina funciona'."

---

### 1.12 Volumes Docker

**O que são**
Containers são efêmeros — quando morrem, os arquivos internos somem. Volume é uma área de armazenamento gerenciada pelo Docker que persiste entre reinicializações do container. Sem volume, cada `docker compose down` apagaria o banco inteiro.

**Por que os bancos precisam deles**
```yaml
# docker-compose.yml
volumes:
  pgdata-auth:
  pgdata-main:
```
O Postgres grava os dados em disco. Sem o volume, o diretório fica dentro do container e desaparece. Com o volume, os dados ficam num local gerenciado pelo Docker Host e sobrevivem.

**Como explicar em uma frase**
> "Volume é o HD externo do container — os dados persistem mesmo quando o container é destruído e recriado."

---

### 1.13 Healthcheck

**O que faz no docker-compose**
Cada container com `healthcheck` fica sendo monitorado periodicamente. O Docker executa o comando definido e marca o container como `healthy` (saiu com 0) ou `unhealthy` (falhou).

**Como o `depends_on` usa**
```yaml
auth-service:
  depends_on:
    postgres-auth:
      condition: service_healthy
```
Isso significa: "só inicia o `auth-service` depois que o `postgres-auth` estiver `healthy`". Sem isso, o NestJS tentaria conectar antes do Postgres estar pronto para aceitar conexões e morreria no primeiro `docker compose up`.

**Como aparece neste projeto**
`postgres-auth` usa `pg_isready` para confirmar que o Postgres aceita conexões. `auth-service` usa `curl http://localhost:3001/health` para confirmar que o NestJS já está respondendo.

**Como explicar em uma frase**
> "Healthcheck é o Docker perguntando 'você está de pé?' — e `depends_on: condition: service_healthy` é um serviço esperando o outro responder antes de subir."

---

### 1.14 React Query (TanStack Query)

**O que é**
React Query é uma biblioteca de gerenciamento de estado assíncrono para React. Em vez de `useEffect + useState + fetch`, você usa `useQuery` para dados que vêm do servidor. Ela cuida de cache, revalidação, estados de loading/error, retry automático e cancelamento de requisições obsoletas.

**Cache e invalidação**
Cada query tem uma `queryKey`. Quando você muda dados com uma `useMutation`, você chama `queryClient.invalidateQueries` com a chave relevante — isso marca o cache como desatualizado e dispara um refetch na próxima oportunidade.

**Mutations**
`useMutation` é para operações que modificam dados (POST, PATCH, DELETE). Tem callbacks `onMutate` (antes de chamar), `onSuccess`, `onError`, `onSettled`.

**Como aparece neste projeto**
`web/src/contratacoes/use-contratacoes.ts` — `useContratacoes` (listagem), `useAtualizarStatus` (mutation com atualização otimista), `useCriarContratacao`, `useExcluirContratacao`.

**Como explicar em uma frase**
> "React Query é o gerenciador de cache para dados do servidor — você declara o que quer buscar e ele cuida do loading, erro, cache e revalidação automaticamente."

---

### 1.15 Atualização otimista

**O que é**
Técnica de UX: quando o usuário clica em algo que vai gerar uma chamada lenta ao servidor, você atualiza a UI *imediatamente* como se a operação já tivesse funcionado. Se o servidor confirmar, ótimo. Se der erro, você desfaz (rollback).

**Por que existe aqui**
O endpoint `PATCH /contratacoes/:id/status` tem 1,5 s de atraso artificial. Sem otimismo, o usuário clicaria num botão e ficaria olhando para a tela sem resposta por 1,5 segundo. Com otimismo, o status muda na tela na hora do clique.

**Quando fazer rollback**
Em `use-contratacoes.ts`, o `onMutate` tira um snapshot do cache antes de escrever o valor otimista. Se `onError` for chamado, cada lista é restaurada ao snapshot.

**Como explicar em uma frase**
> "Atualização otimista é 'fingir que já funcionou' na UI enquanto o servidor processa — se der errado, desfaz."

---

### 1.16 Race condition

**O que é**
Quando duas operações concorrentes dependem do mesmo estado e o resultado final depende da ordem de chegada, você tem uma race condition. Na UI, isso aparece como "a tela mostra um estado diferente do que você clicou" — porque uma resposta antiga chegou depois de uma resposta nova.

**Como aparece na UI**
Sem proteção: usuário troca o filtro de "todos" para "aprovados". A requisição de "todos" estava em voo, é lenta, e chega *depois* da requisição de "aprovados". A tela mostra "todos" mesmo estando no filtro "aprovados".

**Como foi resolvido — 3 camadas:**

1. **AbortController no React Query** (`use-contratacoes.ts`): o `signal` passado para o `queryFn` aborta a requisição anterior quando o filtro muda.
2. **`cancelQueries` antes da mutação otimista** (`use-contratacoes.ts`, `onMutate`): cancela qualquer refetch em voo antes de escrever o valor otimista — sem isso um refetch tardio apagaria o estado otimista.
3. **Update condicional no banco** (`contratacoes.service.ts`, `updateMany where: {id, status}`): garante que dois requests concorrentes de mudança de status não produzam uma transição proibida em silêncio.

**Como explicar em uma frase**
> "Race condition é quando duas coisas concorrentes brigam pelo mesmo estado e a que chegar por último ganha — mesmo que fosse a mais velha."

---

### 1.17 AbortController / AbortSignal

**O que faz**
`AbortController` cria um sinal (`AbortSignal`) que pode ser passado para o `fetch`. Quando você chama `controller.abort()`, o fetch em andamento é cancelado e lança um `DOMException` com `name === 'AbortError'`.

**Onde foi usado no projeto**

1. **Cancelamento de query** (`web/src/contratacoes/use-contratacoes.ts`): o React Query passa um `signal` para o `queryFn`. Quando o componente desmonta ou o filtro muda, o Query cancela o fetch obsoleto.

2. **Timeout de fetch no Main API** (`main-api/src/auth/auth-client.service.ts`): `AbortSignal.timeout(this.timeoutMs)` cria um sinal que dispara automaticamente após N milissegundos. Garante que uma chamada travada ao Auth Service não deixe o request do usuário pendurado indefinidamente.

```typescript
signal: AbortSignal.timeout(this.timeoutMs)
```

**Como explicar em uma frase**
> "AbortSignal é um botão de cancelamento que você passa para o fetch — quando ativado, a requisição para de esperar a resposta."

---

### 1.18 HTTP 409 Conflict

**Quando usar vs 400 e 422**
- **400 Bad Request**: o request está malformado — campo obrigatório faltando, tipo errado, JSON inválido.
- **422 Unprocessable Entity**: o request está bem formado, mas falha em validação de regra de negócio simples (ex: email inválido).
- **409 Conflict**: o request é válido *e* a regra de negócio está correta, mas o **estado atual do recurso** impede a operação.

**Como aparece neste projeto**
Dois casos de 409:
1. Transição de status bloqueada (`recusado → aprovado`): o request está correto, o status pedido existe, mas o recurso está num estado que conflita com a operação.
2. Conflito de concorrência: dois requests chegaram quase ao mesmo tempo e o segundo perdeu a corrida — `updateMany` não atualizou nenhum registro porque o status já mudou.

**Como explicar em uma frase**
> "409 é 'seu pedido está certo, mas o recurso discorda' — use quando o problema é o estado do objeto, não o formato do request."

---

### 1.19 HTTP 503 Service Unavailable

**Quando usar vs 500**
- **500 Internal Server Error**: bug inesperado na aplicação — algo que não deveria ter acontecido.
- **503 Service Unavailable**: a aplicação está saudável, mas uma **dependência** necessária está fora do ar.

**Como aparece neste projeto**
`main-api/src/auth/auth-client.service.ts`: se o Auth Service não responde (timeout, conexão recusada, resposta inválida), o Main API lança `ServiceUnavailableException` → 503. Isso sinaliza ao cliente que o problema é temporário e vale tentar de novo — não é um bug do Main API.

**Como explicar em uma frase**
> "503 é 'eu estou de pé, mas um serviço do qual dependo não está' — diferente de 500, que é 'eu mesmo quebrei'."

---

### 1.20 bcrypt

**O que é hash de senha**
Hash é uma função de mão única: você pega a senha, aplica a função, guarda o resultado. Para verificar, você aplica a função na senha fornecida e compara com o hash guardado. Não tem como "desfazer" o hash para descobrir a senha original.

**Por que não guardar em texto**
Se o banco vazar, senhas em texto deixam todas as contas expostas imediatamente. Com hash, o atacante precisa testar cada combinação possível — e bcrypt é propositalmente lento para isso.

**O que são "rounds"**
O bcrypt tem um parâmetro de "custo" (rounds ou salt rounds). Quanto maior o número, mais iterações o algoritmo executa — mais lento para calcular. Lento para o atacante que tenta força bruta, mas imperceptível para um login legítimo (alguns milissegundos).

**Como aparece neste projeto**
`auth-service/src/auth/auth.service.ts`: `bcrypt.compare(password, passwordHash)`. O bcrypt roda mesmo quando o usuário não existe (usando `DUMMY_HASH`) para evitar que a diferença de tempo de resposta revele quais e-mails estão cadastrados.

**Como explicar em uma frase**
> "bcrypt transforma a senha em uma sequência irreversível — se o banco vazar, o atacante ainda precisa de muito tempo para descobrir as senhas originais."

---

### 1.21 timingSafeEqual

**O que é timing attack**
Comparação de string normal (`===`) retorna `false` assim que encontra o primeiro caractere diferente. Um atacante consegue medir o tempo de resposta: se a comparação demora um pouco mais, significa que mais caracteres estão certos. Repetindo isso, dá para descobrir a chave secreta caractere por caractere.

**Por que a comparação normal é insegura para secrets**
```javascript
// Inseguro: sai no primeiro caractere diferente
"abc123" === "abc124"  // compara 6 chars, retorna em ~6ns
"abc123" === "xyz999"  // compara 1 char, retorna em ~1ns
```

**`timingSafeEqual` do Node.js**
Compara os dois buffers em **tempo constante** — sempre examina todos os bytes, independentemente de onde a diferença está. Timing attack não funciona porque o tempo de resposta não varia.

**Como aparece neste projeto**
`auth-service/src/auth/guards/internal-api-key.guard.ts` — `timingSafeEqual(providedBuffer, expectedBuffer)`. Protege a comparação da `INTERNAL_API_KEY`.

**Como explicar em uma frase**
> "timingSafeEqual compara sempre no mesmo tempo — impede que um atacante descubra a chave medindo quanto tempo a resposta demora."

---

### 1.22 Variáveis de ambiente

**Por que existem**
Separar configuração do código: a mesma imagem Docker funciona em dev, staging e produção simplesmente recebendo variáveis diferentes. Evita que secrets (senhas, chaves) fiquem no repositório.

**Diferença entre build-time (Vite) e runtime (Node)**

| | Vite (`VITE_*`) | Node.js |
|---|---|---|
| Quando é lido | Durante `npm run build` | Quando o processo inicia |
| Onde fica | Embutido no bundle JS | `process.env.VAR` em runtime |
| Pode mudar sem rebuild? | Não | Sim |

**Como aparece neste projeto**
`web/Dockerfile` passa `VITE_AUTH_URL` e `VITE_API_URL` como `ARG` e `ENV` para o momento do build. Se fossem passados como `environment:` no `docker-compose.yml`, o container Nginx não teria acesso — o JavaScript já estaria compilado sem elas.

**Como explicar em uma frase**
> "Variáveis VITE_* são substituídas no bundle na hora do build, não em runtime — por isso precisam de build args no Docker, não de environment."

---

### 1.23 Driver adapter (Prisma 7)

**O que mudou do Prisma 5/6 para o 7**
Versões anteriores do Prisma embutiam uma engine Rust compilada como binário nativo. Esse binário precisava ser compatível com a libc do sistema operacional do container — um problema frequente no Alpine Linux (que usa `musl libc` em vez de `glibc`).

No Prisma 7, a engine de query foi reescrita em WebAssembly e o acesso ao banco passou a usar um "driver adapter" — uma biblioteca Node.js separada (`@prisma/adapter-pg` para PostgreSQL, por exemplo). O binário nativo só existe para o schema engine (usado pelas migrations).

**Por que importa no Docker**
Com Prisma 7 + driver adapter, você pode usar `node:24-slim` (Debian) e o binário de migrations funciona. Alpine ainda pode ter atrito com o schema engine. O comentário no `Dockerfile` documenta exatamente essa decisão.

**Como aparece neste projeto**
`auth-service/src/prisma/prisma.service.ts`:
```typescript
import { PrismaPg } from '@prisma/adapter-pg';

super({
  adapter: new PrismaPg({
    connectionString: config.getOrThrow<string>('DATABASE_URL'),
  }),
});
```

**Como explicar em uma frase**
> "No Prisma 7, a query engine virou WebAssembly e você passa um driver Node.js para conectar ao banco — não tem mais binário nativo no client, só nas migrations."

---

## 2. Dúvidas registradas e como foram resolvidas

---

### 2.1 "O scaffold do NestJS não é strict mode?"

**Dúvida**
O `nest new` gera um `tsconfig.json` com configuração padrão. Era strict mode por padrão?

**Investigação**
Rodou o compilador (`tsc --noEmit`) com o tsconfig padrão e viu que `"strict": true` e `"noUncheckedIndexedAccess": true` não estavam presentes. O scaffold do NestJS coloca `strict: false` ou não coloca nada (o default do TypeScript é não-strict).

**Conclusão**
Adicionou manualmente ao `tsconfig.json` dos dois serviços:
- `"strict": true`
- `"noImplicitOverride": true`
- `"noUncheckedIndexedAccess": true`

Isso forçou vários ajustes no código (adicionar verificações de `null`, tipar retornos explicitamente), mas o resultado final tem muito menos margem para bugs silenciosos.

---

### 2.2 "Por que o npm install passou mas o Prisma não funcionava?"

**Dúvida**
`npm install` saiu com sucesso, mas ao tentar rodar `npx prisma generate` nada acontecia ou dava erro de permissão.

**Investigação**
Relendo o log do `npm install` com atenção, havia um aviso que a maioria ignora:

```
npm warn exec The following package was not installed because it failed to pass the security audit: prisma
npm warn To install it anyway, use `npm approve-scripts prisma`
```

O npm 11 introduziu um novo comportamento: scripts de pós-instalação (como o `postinstall` do Prisma que baixa o schema engine) são bloqueados por padrão e precisam de aprovação explícita.

**Conclusão**
Rodou `npm approve-scripts prisma` no diretório do serviço. Após isso, o `npm install` reexecutou o script de pós-instalação do Prisma corretamente e o `prisma generate` funcionou.

---

### 2.3 "Por que o tsconfig sem rootDir explícito colocaria o build no lugar errado?"

**Dúvida**
Ao compilar, o output não estava em `dist/main.js` como o container esperava — estava em `dist/src/main.js`.

**Investigação**
O tsc infere o `rootDir` a partir do arquivo mais "alto" incluído na compilação. Como `prisma.config.ts` fica na raiz do projeto (fora de `src/`) e estava sendo incluído implicitamente, o tsc considerava a raiz como o ponto mais alto. Resultado: `src/main.ts` compilava para `dist/src/main.js`, e o `node dist/main` do container quebrava.

**Conclusão**
Adicionou `"rootDir": "./src"` explicitamente no `tsconfig.json` e excluiu `prisma.config.ts` da compilação principal (ele é lido pelo CLI do Prisma, não precisa estar no bundle do NestJS). O `dist/main.js` passou a ficar no lugar certo.

---

### 2.4 "Por que o `delay` do RxJS não atrasava erros?"

**Dúvida**
O `AtrasoArtificialInterceptor` com `delay(1500)` funcionava para respostas de sucesso, mas um erro 409 de transição bloqueada voltava instantaneamente.

**Investigação**
Testou o caminho de erro (tentou `recusado → aprovado`) e cronometrou a resposta. Veio em ~0ms. O problema: o `delay` do RxJS só atrasa valores de sucesso (notificações `next`). Uma exceção do NestJS vira uma notificação de `error` no Observable, que passa pelo `delay` sem ser atrasada.

**Conclusão**
Usou `materialize()` + `dematerialize()`:
- `materialize()`: converte qualquer notificação (incluindo `error`) num valor `next` com um envelope `Notification`.
- `delay(atrasoMs)`: atrasa todos os valores, incluindo os que embrulham erros.
- `dematerialize()`: desembrulha de volta — sucesso vira sucesso, erro vira erro de novo.

Isso garante que o delay de 1,5 s se aplica a qualquer resposta, inclusive as de erro, tornando o rollback da atualização otimista visível na UI.

---

### 2.5 "Por que as variáveis VITE_* não funcionavam como environment no docker-compose?"

**Dúvida**
Tentou passar `VITE_AUTH_URL` e `VITE_API_URL` no bloco `environment:` do serviço `web` no `docker-compose.yml`. As URLs no frontend continuavam vazias ou com o valor padrão.

**Investigação**
O frontend é um conjunto de arquivos estáticos gerados pelo Vite em tempo de build. Durante o `npm run build`, o Vite substitui todas as ocorrências de `import.meta.env.VITE_*` pelo valor literal da variável de ambiente *naquele momento*. No container Nginx final, não existe Node.js nem Vite — é só um servidor de arquivos estáticos. Passar `environment:` para o container Nginx não tem nenhum efeito no JavaScript já compilado.

**Conclusão**
As variáveis precisam ser `build args` do Docker, disponíveis durante o `docker build`:
```yaml
web:
  build:
    context: ./web
    args:
      VITE_AUTH_URL: http://localhost:3001
      VITE_API_URL: http://localhost:3000
```
No `Dockerfile` do web, as `ARG` são copiadas para `ENV` antes do `npm run build`.

---

### 2.6 "Por que o Postgres 18 não iniciava no Docker?"

**Dúvida**
O container `postgres-auth` ficava em loop de reinicialização. O healthcheck falhava e o Auth Service nunca subia.

**Investigação**
Leu o log do container com `docker compose logs postgres-auth`. A mensagem era algo como:

```
initdb: error: directory "/var/lib/postgresql/data" exists but is not empty
```
ou o container não criava o diretório de dados corretamente.

O Postgres 17 e anteriores esperavam o volume montado em `/var/lib/postgresql/data`. O Postgres 18 mudou a convenção: ele espera o volume em `/var/lib/postgresql` (sem o `/data`) e cria o subdiretório da versão por conta própria. Montar o volume em `/data` criava um conflito com a estrutura que o Postgres 18 tentava inicializar.

**Conclusão**
Corrigiu o volume no `docker-compose.yml` de `/var/lib/postgresql/data` para `/var/lib/postgresql`. O container inicializou corretamente e o healthcheck passou.

---

## 3. Decisões tomadas e por quê

---

### 3.1 Prisma como ORM vs TypeORM

**Decisão:** Prisma.
**Alternativa descartada:** TypeORM.
**Razão da escolha:** Migrations do Prisma são confiáveis e determinísticas — você descreve o schema, ele gera o SQL. O TypeORM tem histórico de migrations instáveis em casos de rename de coluna. Além disso, o Prisma gera tipos TypeScript que refletem exatamente o schema, eliminando a divergência entre Model e banco. O Prisma 7 com driver adapter ainda remove a preocupação com binário nativo no Docker.

---

### 3.2 Status como coluna de texto vs enum do Postgres

**Decisão:** coluna `TEXT`.
**Alternativa descartada:** `CREATE TYPE status_enum AS ENUM (...)`.
**Razão da escolha:** Um dos valores de status é `"em análise"` — com acento. Enums do Postgres são case-sensitive e sensíveis a encoding. Adicionar um novo status num enum do Postgres exige `ALTER TYPE`, que não é transacional em algumas versões. Com texto, o Prisma trata como `String`, sem camada de tradução, e adicionar um novo status é só incluir no array `CONTRATACAO_STATUSES` e rodar uma migration simples (ou nenhuma, se o banco não tiver constraint).

---

### 3.3 localStorage para o token vs cookie httpOnly

**Decisão:** `localStorage`.
**Alternativa descartada:** cookie `httpOnly` com `SameSite=Strict`.
**Razão da escolha:** Cookie httpOnly é tecnicamente mais seguro (JavaScript não consegue ler), mas exige que o frontend e a API estejam no mesmo domínio (ou num subdomínio) para que o cookie seja enviado automaticamente. Em desenvolvimento local, `localhost:8080` (frontend) e `localhost:3001` (Auth) são origens diferentes — o cookie de um não vai para o outro sem CORS com `credentials: 'include'` e `SameSite=None; Secure`, que por sua vez exige HTTPS. Para um ambiente de demonstração HTTP local, `localStorage` é a solução pragmática. A melhoria correta (refresh token + httpOnly + reverse proxy no mesmo domínio) está documentada em melhorias futuras.

---

### 3.4 Dois containers Postgres vs dois schemas no mesmo container

**Decisão:** dois containers separados (`postgres-auth` e `postgres-main`).
**Alternativa descartada:** um container Postgres com dois schemas (`auth` e `main`).
**Razão da escolha:** O objetivo de separar microserviços é que nenhum acesse os dados do outro. Com dois schemas no mesmo container, uma connection string errada quebra esse isolamento sem nenhum aviso. Com dois containers, é impossível acidentalmente — o `main-api` literalmente não tem credenciais para se conectar ao banco do `auth-service`.

---

### 3.5 Validação S2S vs validação local do JWT

**Decisão:** Main API chama o Auth Service para validar o token (`S2SAuthGuard`).
**Alternativa descartada:** Main API importa `jsonwebtoken`, lê o `JWT_SECRET` e valida localmente.
**Razão da escolha:** Se o JWT_SECRET for copiado para o Main API, qualquer comprometimento do Main API expõe o secret de todo o sistema de autenticação. Além disso, se o Auth Service mudar o algoritmo de assinatura, trocar para tokens revogate-able, ou adicionar verificação de sessão, o Main API precisa ser atualizado também — isso cria acoplamento. Delegando ao Auth, a autoridade sobre "esse token é válido?" fica centralizada. O custo é uma chamada de rede por request autenticado.

---

### 3.6 503 na falha do Auth vs 500

**Decisão:** `ServiceUnavailableException` (503) quando o Auth Service não responde.
**Alternativa descartada:** `InternalServerErrorException` (500).
**Razão da escolha:** 500 sinaliza "eu quebrei". 503 sinaliza "minha dependência não está disponível". Para o cliente, a diferença importa: um 503 indica que vale tentar de novo em instantes, enquanto um 500 geralmente indica bug que não vai se resolver sozinho. O Main API está funcionando corretamente — ele tentou chamar o Auth e não conseguiu. Isso é 503.

---

### 3.7 409 na transição bloqueada vs 400/422

**Decisão:** `ConflictException` (409).
**Alternativa descartada:** `BadRequestException` (400) ou `UnprocessableEntityException` (422).
**Razão da escolha:** O request está perfeitamente formado — o status pedido existe, o ID existe, o formato é correto. O que impede a operação é o **estado atual do recurso** (`recusado`), não um problema no request em si. Por definição, 409 é para "o request não pode ser completado devido ao estado atual do recurso". 400/422 seriam semanticamente errados aqui.

---

### 3.8 DDD descartado

**Decisão:** não implementar DDD completo (entidade rica com invariantes + repositório com interface + camada de domínio separada).
**Alternativa descartada:** refatorar para a arquitetura DDD completa.
**Razão da escolha:** reconheceu o padrão (regras de transição de status são invariantes de domínio que deveriam viver numa entidade `Contratacao`, não no service), mas tomou uma decisão consciente de não refatorar. Motivos: o domínio tem quatro status e uma regra de transição — pequeno demais para justificar a cerimônia do DDD. O prazo era fixo. E refatorar arquitetura sem cobertura de testes é um vetor de regressão. A decisão foi documentada honestamente em vez de escondida.

---

### 3.9 Update condicional no banco (optimistic locking)

**Decisão:** `updateMany({ where: { id, status: atual.status } })` em vez de `update({ where: { id } })`.
**Alternativa descartada:** validar o status antes com `findOne` e depois fazer `update` sem condição.
**Razão da escolha:** Entre o `SELECT` (findOne) e o `UPDATE` existe uma janela de tempo. Em requests concorrentes, dois usuários podem estar olhando para `status: 'recusado'` ao mesmo tempo. O primeiro vai para `em análise` (válido). O segundo, que também leu `recusado`, tenta ir para `aprovado`. Sem a condição no UPDATE, o segundo request chegaria depois que o status já mudou para `em análise`, mas ainda faria o update — possivelmente criando a transição `recusado → aprovado` que deveria ser bloqueada. Com `updateMany({ where: { id, status: atual.status } })`, o segundo UPDATE não afeta nenhum registro (porque o status já mudou) e retorna `count: 0`, disparando um 409.

---

### 3.10 Imagem node:24-slim e não Alpine

**Decisão:** `node:24-slim` (Debian Slim).
**Alternativa descartada:** `node:24-alpine`.
**Razão da escolha:** O Prisma 7 eliminou o binário nativo do client (agora é WebAssembly), mas o **schema engine** — o binário que executa `prisma migrate deploy` — ainda é compilado nativamente. O Alpine Linux usa `musl libc` em vez de `glibc`; o binário do schema engine do Prisma é compilado para `glibc` e não roda no Alpine sem camadas adicionais de compatibilidade. A imagem Debian Slim é ~80MB maior que Alpine, mas evita um problema de runtime difícil de diagnosticar.

---

## 4. Visão de melhorias futuras

O projeto está funcional e atende ao enunciado. Com mais tempo, estas seriam as próximas evoluções, em ordem de impacto:

---

### 4.1 CHECK constraint no banco para o status

**O que é:** `ALTER TABLE contratacoes ADD CONSTRAINT status_valido CHECK (status IN ('solicitado', 'em análise', 'aprovado', 'recusado'))`.

**Por que importa:** atualmente, a única garantia de que o status é válido está no código TypeScript. Se alguém executar um SQL manual no banco (acidente, script de manutenção), pode inserir um status inválido que vai quebrar a aplicação de forma silenciosa. A constraint coloca a regra no banco, onde ela nunca pode ser burlada.

---

### 4.2 Refresh token + cookie httpOnly + reverse proxy

**O que é:** adicionar um refresh token de longa duração, trocar o access token por um de curta duração, guardar ambos em cookies `httpOnly`, e colocar um reverse proxy (ex: Nginx) para servir frontend e APIs no mesmo domínio.

**Por que importa:** `httpOnly` torna o token inacessível via JavaScript — XSS não consegue roubá-lo. O mesmo domínio elimina o problema de CORS com `credentials`. O refresh token evita que o usuário precise fazer login toda hora quando o access token expira.

---

### 4.3 Circuit breaker na chamada ao Auth Service

**O que é:** uma lógica que, após N falhas consecutivas ao Auth Service, para de tentar e retorna 503 imediatamente por um período, sem esperar o timeout.

**Por que importa:** atualmente, se o Auth estiver fora do ar, cada request autenticado espera 2 segundos (o `AUTH_VALIDATE_TIMEOUT_MS`) antes de receber 503. Com muitos requests simultâneos, o Main API fica com o event loop saturado de timeouts. O circuit breaker corta o problema na raiz: depois de confirmar que o Auth está fora, para de tentar por 30 segundos.

---

### 4.4 Testes e2e com Testcontainers

**O que é:** testes que sobem um banco Postgres real (em um container efêmero) via Testcontainers, rodam a API contra ele, e destroem tudo no final.

**Por que importa:** testes unitários com mock do PrismaService não cobrem a lógica de concorrência (o optimistic locking só faz sentido com banco real). Com Testcontainers, você consegue escrever um teste que dispara dois requests concorrentes e verifica que exatamente um deles recebe 409.

---

### 4.5 Request ID propagado entre serviços (correlação de logs)

**O que é:** gerar um UUID no início de cada request (`X-Request-ID`), propagá-lo em todas as chamadas S2S, e logar esse ID em todos os serviços.

**Por que importa:** quando um bug acontece em produção, você tem logs espalhados em dois serviços. Sem correlação, é impossível saber quais logs do Auth correspondem a qual request do Main API. Com o Request ID, você filtra por ele nos logs de todos os serviços e reconstrói o trace completo de um request específico.

---

### 4.6 Rate limit no /auth/login

**O que é:** limitar o número de tentativas de login por IP (ex: 10 tentativas por 15 minutos) usando uma biblioteca como `@nestjs/throttler` com backend Redis.

**Por que importa:** o endpoint de login é o alvo óbvio de ataques de força bruta. O bcrypt já torna cada tentativa lenta, mas não impede automação em escala. Rate limit corta o ataque antes mesmo de bcrypt ser chamado.

---

### 4.7 DDD completo (entidade rica + repositório com interface)

**O que é:** extrair as regras de transição de status para uma entidade `Contratacao` com invariantes (`contratacao.aprovar()`, `contratacao.recusar()`), criar interfaces de repositório (`IContratacoesRepository`) e implementações concretas com Prisma.

**Por que importa:** o código atual mistura lógica de domínio (`isTransicaoBloqueada`) no service, que também é responsável por persistência. DDD completo separa essas responsabilidades, tornando as regras de negócio testáveis sem banco e permitindo trocar o ORM sem tocar na lógica de domínio. Para o domínio atual (pequeno), o custo não justifica o benefício — mas seria o passo natural se o sistema crescesse.

---

## 5. Roteiro de demonstração ao vivo (5 min)

> Antes de começar: `docker compose up --build` está rodando, todos os containers estão `healthy`. Abra `http://localhost:8080` no browser.

---

### Passo 1 — Login (30 s)

**Ação:** entre com `admin@ramper.com.br` / `admin123`.

**O que dizer:**
> "O frontend chama `POST /auth/login`. O Auth Service busca o usuário, roda bcrypt.compare, assina um JWT com HMAC-SHA256 e devolve o token. O frontend guarda em localStorage — não é o ideal de segurança, mas foi uma decisão deliberada para funcionar em HTTP local sem as complicações de cookie cross-origin."

---

### Passo 2 — Listar e criar contratação (1 min)

**Ação:** observe a lista carregada. Clique em "Nova Contratação" e crie uma com nome, email e produto.

**O que dizer:**
> "Toda chamada à Main API vai com `Authorization: Bearer <token>`. O `S2SAuthGuard` intercepta, chama `POST /auth/validate` com a `INTERNAL_API_KEY` no header, e o Auth confirma que o token é legítimo. A Main API nunca vê o JWT_SECRET — a autoridade sobre sessão fica no Auth Service. Ao criar, o status começa como 'solicitado' — o cliente não pode escolher o status inicial."

---

### Passo 3 — Atualização otimista e atraso artificial (1,5 min)

**Ação:** mude o status de uma contratação de "solicitado" para "em análise". Observe que a tela atualiza instantaneamente, mas o botão fica desabilitado por ~1,5 s.

**O que dizer:**
> "O endpoint `PATCH /contratacoes/:id/status` tem 1,5 segundo de delay artificial — está no `AtrasoArtificialInterceptor` com `materialize/dematerialize` para atrasar também erros. Sem atualização otimista, a UI ficaria congelada esse tempo todo. Com ela, o React Query escreve o novo status no cache imediatamente, desabilita a linha para evitar duplo clique, e trata a resposta do servidor como confirmação — ou ordem de rollback se der erro."

---

### Passo 4 — Transição de status bloqueada / 409 (1 min)

**Ação:** mude o status da contratação para "recusado". Depois tente mudar para "aprovado".

**O que dizer:**
> "Isso deve retornar 409 Conflict — não 400, porque o request está bem formado. O problema é o estado do recurso: 'recusado' não pode ir direto para 'aprovado'. Observe o rollback: a tela volta para 'recusado' e aparece a mensagem de erro. Isso acontece no `onError` da mutation — o React Query restaura o snapshot que salvou antes de escrever o valor otimista."

---

### Passo 5 — Auth Service fora do ar → 503 (1 min)

**Ação:** em outro terminal, `docker compose stop auth-service`. Tente fazer qualquer operação autenticada no frontend (ex: listar contratações ou mudar status).

**O que dizer:**
> "O Main API está de pé — ele não depende do Auth para subir. Mas quando tenta validar o token, o `AuthClientService` tem um `AbortSignal.timeout(2000)` — depois de 2 segundos sem resposta, lança `ServiceUnavailableException`, que vira 503. O frontend recebe 503 e mostra a mensagem '...o serviço de autenticação pode estar fora do ar'. Depois: `docker compose start auth-service` — em alguns segundos o healthcheck passa e tudo volta ao normal."

---

> **Dica final:** se perguntarem sobre o uso de IA (Cursor/Claude), seja direto: "Usei o Cursor para acelerar partes que não conhecia bem, como a sintaxe específica do NestJS e a configuração do Docker Compose. As decisões de arquitetura — por que dois containers, por que 409 e não 400, por que optimistic locking — foram minhas. O guia que você está lendo documenta exatamente o que entrei para entender e por que cada escolha foi feita desse jeito."
