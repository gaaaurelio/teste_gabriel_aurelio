# Contratação de Produto — Teste Técnico Ramper

Aplicação de contratação de produto com autenticação isolada em microserviço
próprio, comunicação server-to-server entre os serviços, dois bancos Postgres
independentes e frontend React lidando com estado assíncrono real.

**Stack:** TypeScript (strict mode), React 19, NestJS 11, PostgreSQL 18, Docker.

---

## Sumário

- [Como subir](#como-subir)
- [Credenciais de acesso](#credenciais-de-acesso)
- [O que dá para testar na interface](#o-que-dá-para-testar-na-interface)
- [Arquitetura](#arquitetura)
- [Decisões técnicas](#decisões-técnicas)
- [Onde o token de sessão fica guardado, e por quê](#onde-o-token-de-sessão-fica-guardado-e-por-quê)
- [API](#api)
- [Testes](#testes)
- [Rodando fora do Docker](#rodando-fora-do-docker)
- [Processo de uso de IA](#processo-de-uso-de-ia)
- [O que eu faria com mais tempo](#o-que-eu-faria-com-mais-tempo)

---

## Como subir

Pré-requisito: Docker com Compose v2.

```bash
docker compose up --build
```

É só isso. Não precisa criar `.env`, não precisa rodar migration à mão, não
precisa popular usuário: o `docker-compose.yml` tem valor default para toda
variável, cada serviço aplica as próprias migrations na subida e o Auth Service
cria os usuários de exemplo no bootstrap.

Quando os logs pararem, os endereços são:

| O quê             | URL                            |
| ----------------- | ------------------------------ |
| Frontend          | http://localhost:8080          |
| Auth Service      | http://localhost:3001          |
| Main API          | http://localhost:3000          |
| Postgres do Auth  | `localhost:5433`               |
| Postgres do Main  | `localhost:5434`               |

Para derrubar tudo, incluindo os dados:

```bash
docker compose down -v
```

---

## Credenciais de acesso

Criadas pelo seed, com senha guardada como hash bcrypt:

| E-mail                 | Senha       |
| ---------------------- | ----------- |
| `admin@ramper.com`     | `ramper123` |
| `analista@ramper.com`  | `ramper123` |

A tela de login já vem preenchida com o primeiro deles.

---

## O que dá para testar na interface

Vale conferir estes quatro cenários, que são o núcleo do desafio:

**1. Atualização otimista.** Mude o status de uma contratação. A etiqueta muda
na hora, embora o servidor leve ~1,5 s para confirmar (atraso artificial exigido
pelo enunciado). A linha fica esmaecida com "salvando..." enquanto isso.

**2. Rollback com mensagem.** Coloque uma contratação em `recusado`, espere
confirmar, e então tente `aprovado`. A interface mostra `aprovado` imediatamente,
o servidor recusa com 409 depois do atraso, e o status **volta** para `recusado`
com um aviso explicando o motivo no canto da tela.

**3. Race condition.** Clique várias vezes rápido em "Aprovar" na mesma linha.
Os cliques seguintes são descartados e o estado final é consistente — sem
requests duplicados e sem status oscilando.

**4. Resiliência quando o Auth cai.** Em outro terminal:

```bash
docker compose stop auth-service
```

Agora recarregue a lista. Em vez de a página travar esperando, o Main API
responde **503** rapidamente e a interface mostra a mensagem de serviço
indisponível com um botão de tentar de novo. Para voltar ao normal:

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
              │  tabela users  │   │ tab.contratacoes│
              └────────────────┘   └─────────────────┘
```

O ponto central: **o Main API não sabe validar um JWT.** Ele não tem o secret e
não importa nenhuma biblioteca de JWT — basta olhar o `package.json` dele. A cada
request autenticado, ele pergunta ao Auth Service se o token é válido, enviando
uma credencial de serviço própria no header `x-internal-api-key`.

São, portanto, duas camadas de autenticação distintas e independentes:

| Camada     | Credencial              | Quem ela identifica         |
| ---------- | ----------------------- | --------------------------- |
| Usuário    | JWT (header `Authorization`) | a pessoa logada        |
| Serviço    | API key (`x-internal-api-key`) | o Main API como sistema |

Um JWT válido sem a API key não consegue chamar `/auth/validate` direto. E a API
key sozinha não autentica usuário nenhum.

### Fluxo de um request autenticado

1. Navegador chama `PATCH /contratacoes/:id/status` no Main API com `Authorization: Bearer <jwt>`.
2. `S2SAuthGuard` extrai o token e chama `AuthClientService`.
3. `AuthClientService` faz `POST /auth/validate` no Auth Service com a API key interna e timeout de 2 s.
4. Auth Service confere a assinatura do JWT e devolve o payload decodificado.
5. Guard anexa o usuário ao request e libera o controller.
6. Service aplica a regra de transição e grava.
7. Interceptor segura a resposta por 1,5 s (atraso artificial).

---

## Decisões técnicas

### Monorepo, não três repositórios

Serviços independentes em runtime, mas um repositório só. O enunciado pede um
comando para subir tudo, e a alternativa (três repos + instruções de clonar na
ordem certa) adicionaria atrito de avaliação sem nenhum ganho arquitetural. Nada
aqui é compartilhado por import entre os serviços: cada um tem seu
`package.json`, seu `tsconfig`, seu Prisma e sua imagem Docker.

### Dois containers Postgres, não dois schemas

O enunciado permitia as duas coisas. Preferi containers separados porque o valor
de separar serviços é justamente a impossibilidade de acessar o dado do outro por
acidente. Com um Postgres compartilhado, bastaria uma connection string com o
schema errado para furar a fronteira; com instâncias separadas, o isolamento é
estrutural. O custo é mais memória, irrelevante em desenvolvimento.

### Prisma como ORM

Escolhi Prisma entre as opções livres por três razões:

1. **Migrations versionadas em SQL legível**, aplicáveis de forma não interativa
   com `migrate deploy` — o que o entrypoint do container precisa.
2. **Tipos gerados a partir do schema.** Como o projeto todo é strict, um erro de
   nome de coluna aparece em tempo de compilação e não em produção.
3. O schema declarativo é o mais fácil de ler para quem chega no projeto depois.

Caiu na versão 7, que trouxe uma mudança grande e favorável ao Docker: o client
não usa mais engine Rust (a query é compilada em WebAssembly e a conexão passa
por um *driver adapter*, aqui o `node-postgres`). Isso elimina toda a classe de
problema de binário nativo incompatível com a libc da imagem.

O trade-off honesto: TypeORM tem integração mais idiomática com o NestJS
(repositórios injetáveis, decorators nas entidades). Preferi migrations
confiáveis num ambiente que sobe do zero a cada `docker compose up`.

### Status como coluna de texto, não enum do Postgres

O enunciado especifica os valores `solicitado`, `em análise`, `aprovado`,
`recusado`. Um enum nativo exigiria identificadores sem acento nem espaço, e
portanto uma camada de tradução entre o valor do banco e o valor exposto na API.
Preferi que o que está no banco seja exatamente o que trafega no JSON.

O domínio de valores é garantido pelo DTO (`@IsIn`) na entrada e por um type
guard na saída — se um valor inesperado aparecer no banco, a API falha alto em
vez de devolver dado inválido. Reconheço o que se perde: uma escrita direta no
banco, por fora da aplicação, não é barrada. Com mais tempo eu acrescentaria uma
`CHECK constraint`.

### Só a transição que o enunciado pede é bloqueada

`recusado → aprovado` é proibida. Não inventei uma máquina de estados completa
(do tipo "não pode aprovar sem passar por análise") porque seria regra de negócio
que ninguém pediu e que quebraria uso legítimo da API. As proibições ficam num
mapa em [contratacao-status.ts](main-api/src/contratacoes/contratacao-status.ts),
de modo que acrescentar uma nova é mudar dado, não lógica.

A resposta é **409 Conflict**, e não 400: o corpo do request está perfeitamente
válido; o que impede a operação é o estado atual do recurso.

### O atraso artificial fica num interceptor

`AtrasoArtificialInterceptor` segura a resposta por 1,5 s **depois** que o banco
já respondeu. Duas consequências boas: a regra de negócio continua testável sem
esperar segundo e meio, e nenhuma conexão de banco fica presa durante a espera.

Detalhe que exigiu cuidado: `delay` do RxJS não atrasa notificação de erro. Sem
tratamento, um 409 voltaria instantâneo e o rollback do frontend seria invisível.
A solução foi `materialize() → delay() → dematerialize()`, que transforma o erro
em valor comum, atrasa, e restaura.

### Concorrência tratada também no servidor

O enunciado pede tratamento de clique duplo no frontend. Fiz também no backend,
porque proteção só de interface não é proteção: o update é condicionado ao status
que acabou de ser lido (`updateMany where: { id, status: statusLido }`). Se outro
request mudou o status nesse meio tempo, `count` volta 0 e a API responde 409 em
vez de sobrescrever em silêncio — o que, sem a condição, poderia produzir
justamente o `recusado → aprovado` que a regra proíbe.

Repetir o status atual é tratado como sucesso sem escrita, não como conflito: é o
que evita erro na tela por uma operação cujo resultado final é exatamente o
pedido.

### TanStack Query no frontend

Os três requisitos difíceis do enunciado — otimismo, rollback e race condition —
são exatamente o que `onMutate` / `onError` / `cancelQueries` resolvem. Escrever
isso à mão significaria reimplementar cache, invalidação e cancelamento.

O passo que costuma ser esquecido está comentado no código: `cancelQueries` antes
de escrever o valor otimista. Sem ele, um refetch já em voo chega depois com dado
anterior à mudança e apaga o valor otimista — o status "volta sozinho" sem erro
nenhum, e o bug é difícil de reproduzir.

### Sem JWT no Main API, de propósito

O caminho mais comum seria `passport-jwt` verificando a assinatura localmente:
mais rápido, sem chamada de rede, sem ponto de falha extra. O enunciado pede
explicitamente o contrário, e a razão faz sentido: com validação centralizada, a
autoridade sobre a sessão fica em um serviço só. Se amanhã o Auth passar a
revogar token ou trocar o algoritmo de assinatura, o Main API não muda uma linha.

O preço é uma chamada HTTP por request e uma dependência a mais no caminho
crítico — que é exatamente por que existe timeout, e por que a falha dela é
tratada como 503 e não 500.

---

## Onde o token de sessão fica guardado, e por quê

**`localStorage`**, gravado em
[armazenamento-token.ts](web/src/auth/armazenamento-token.ts).

A opção mais segura seria cookie `httpOnly`, que JavaScript não consegue ler. Não
é viável aqui, e o motivo é concreto: o frontend é servido em
`localhost:8080` e os serviços em `localhost:3001` e `localhost:3000`. Origens
diferentes. Um cookie enviado cross-origin exige `SameSite=None`, que por sua vez
exige `Secure`, que exige HTTPS — nada disso existe num ambiente local em HTTP.
Além disso, o enunciado dispensa refresh token, que é o mecanismo em que o cookie
httpOnly realmente brilha.

O custo que assumo, sem rodeio: qualquer JavaScript executado na página consegue
ler o `localStorage`. Um XSS rouba a sessão. Não uso `dangerouslySetInnerHTML` em
nenhum ponto e o React escapa conteúdo por padrão, então a superfície é pequena —
mas ela existe.

Em produção eu colocaria os serviços atrás do mesmo domínio (`app.exemplo.com` e
`app.exemplo.com/api`) via reverse proxy, e passaria a cookie `httpOnly` +
`SameSite=Lax` + `Secure`, com refresh token rotativo.

Detalhe de implementação: o estado inicial do contexto de autenticação lê o
`localStorage` de forma sincrona na primeira renderização. Sem isso, um F5
mostraria a tela de login por um instante antes de reconhecer a sessão.

---

## API

### Auth Service (`localhost:3001`)

```http
POST /auth/login
Content-Type: application/json

{ "email": "admin@ramper.com", "password": "ramper123" }
```

```json
{
  "accessToken": "eyJ...",
  "tokenType": "Bearer",
  "user": { "id": "...", "email": "admin@ramper.com", "name": "Admin Ramper" }
}
```

```http
POST /auth/validate
Content-Type: application/json
x-internal-api-key: dev-internal-api-key-troque-isto-em-producao

{ "token": "eyJ..." }
```

Sem a API key correta: **401**. Com token inválido ou expirado: **401** com a
mensagem distinguindo os dois casos. `GET /health` é aberto.

### Main API (`localhost:3000`)

Todas as rotas de `/contratacoes` exigem `Authorization: Bearer <token>`.

| Método   | Rota                       | O que faz                                    |
| -------- | -------------------------- | -------------------------------------------- |
| `POST`   | `/contratacoes`            | cria (status sempre `solicitado`)            |
| `GET`    | `/contratacoes`            | lista; aceita `?status=aprovado`             |
| `GET`    | `/contratacoes/:id`        | busca uma                                    |
| `PATCH`  | `/contratacoes/:id`        | atualiza nome, e-mail, produto               |
| `PATCH`  | `/contratacoes/:id/status` | muda status (regra + atraso de 1,5 s)        |
| `DELETE` | `/contratacoes/:id`        | remove (204)                                 |

Códigos de erro que importam:

| Código | Quando                                                              |
| ------ | ------------------------------------------------------------------- |
| 400    | DTO inválido (`class-validator`) ou id que não é UUID               |
| 401    | sem token, token malformado, inválido ou expirado                   |
| 404    | contratação inexistente                                             |
| 409    | `recusado → aprovado`, ou conflito de escrita concorrente           |
| 503    | Auth Service fora do ar, em timeout, ou respondendo de forma inválida |

### Verificando pela linha de comando

```bash
# 1. login
TOKEN=$(curl -s -X POST http://localhost:3001/auth/login \
  -H 'content-type: application/json' \
  -d '{"email":"admin@ramper.com","password":"ramper123"}' | jq -r .accessToken)

# 2. cria
ID=$(curl -s -X POST http://localhost:3000/contratacoes \
  -H "authorization: Bearer $TOKEN" -H 'content-type: application/json' \
  -d '{"nomeCliente":"Maria Souza","email":"maria@empresa.com","produto":"Ramper Pipeline"}' | jq -r .id)

# 3. recusa, depois tenta aprovar -> 409
curl -s -X PATCH "http://localhost:3000/contratacoes/$ID/status" \
  -H "authorization: Bearer $TOKEN" -H 'content-type: application/json' \
  -d '{"status":"recusado"}' > /dev/null

curl -i -X PATCH "http://localhost:3000/contratacoes/$ID/status" \
  -H "authorization: Bearer $TOKEN" -H 'content-type: application/json' \
  -d '{"status":"aprovado"}'
```

No PowerShell, troque `jq` por `ConvertFrom-Json`.

---

## Testes

```bash
cd main-api && npm test
```

Duas suítes, 16 casos:

**`contratacoes.service.spec.ts`** — a regra de transição, que é o teste exigido
pelo enunciado. Cobre o bloqueio de `recusado → aprovado`, o fato de que nada é
escrito no banco quando a transição é recusada, as transições que devem passar, a
idempotência de repetir o mesmo status, o conflito de concorrência e o 404. O
Prisma é substituído por um dublê: regra de domínio não precisa de banco, e um
teste que precisasse de Postgres no ar seria lento e frágil.

**`s2s-auth.guard.spec.ts`** — o teste bônus, do guard S2S. O `fetch` global é
mockado. Cobre header ausente e malformado (sem nem chamar o Auth), token válido,
propagação de 401, e os quatro modos de falha que devem virar 503: conexão
recusada, timeout, 500 do Auth e corpo em formato inesperado. Também verifica que
a chamada leva a API key interna e um `AbortSignal`.

---

## Rodando fora do Docker

Útil para desenvolvimento com hot reload. Os bancos continuam vindo do Docker.

```bash
docker compose up -d postgres-auth postgres-main

cd auth-service && npm install && npx prisma migrate deploy && npm run start:dev
cd main-api     && npm install && npx prisma migrate deploy && npm run start:dev
cd web          && npm install && npm run dev
```

Cada pasta já tem um `.env` apontando para `localhost:5433` / `localhost:5434`. O
frontend em modo dev sobe em `http://localhost:5173`, origem que já está liberada
no CORS dos dois serviços.

---

## Processo de uso de IA

Essa arquitetura era nova para mim. Minha experiência anterior é Laravel e
Python, e nunca havia escrito NestJS, Prisma, React Query nem comunicação S2S.
Usei Cursor durante todo o desenvolvimento. Registro abaixo o que funcionou, o
que veio errado e como percebi.

O log detalhado, com os erros na ordem em que apareceram, está em
[docs/ia-log.md](docs/ia-log.md). O resumo:

### O que funcionou como abordagem

**Ancorar no que eu já sabia.** Meus prompts mais produtivos pediam a tradução
explícita: "o guard do Nest equivale a que no Laravel?". Saber que guard ≈
middleware de rota, DTO com `class-validator` ≈ Form Request, e migration do
Prisma ≈ migration do Eloquent me deu um mapa mental para revisar o código em vez
de só aceitá-lo.

**Compilar e rodar a cada etapa, não no fim.** Liguei `strict` antes de escrever
a primeira linha de lógica e rodei `tsc` depois de cada arquivo. Isso transformou
erro de integração em erro de compilação, que aparece localizado.

**Desconfiar quando a IA escreve código de versão anterior.** Foi o erro mais
frequente e o mais perigoso, porque o código sai plausível. Prisma 7 e npm 11
mudaram coisas recentes o suficiente para não estarem no treino do modelo.

### Onde o que foi gerado estava errado

Sete casos concretos, todos que eu só peguei porque rodei:

**1. Scripts de instalação bloqueados pelo npm 11.** O `npm install` avisava
`allow-scripts: 1 package has install scripts not yet covered` e seguia com
código 0. Nenhum erro. Só que o postinstall do `@prisma/engines` não rodou, e
sem ele o binário de migrations não existe. Resolvi com
`npm approve-scripts prisma @prisma/engines @prisma/client` — aprovando pacote
por pacote em vez de `--all`. Detalhe que importou depois: a aprovação fica
gravada no próprio `package.json`, no campo `allowScripts`, o que significa que
o `npm ci` dentro do Docker também a respeita. Se ficasse em config de usuário, o
build da imagem quebraria.

**2. Prisma 7 mudou quase tudo.** A IA gerou consistentemente o formato antigo:
`url = env("DATABASE_URL")` dentro do `datasource`, generator
`prisma-client-js`, client importado de `@prisma/client`. Nada disso é a versão
7, que exige `prisma.config.ts` para a URL, generator `prisma-client` com
`output` obrigatório, e driver adapter em vez de engine Rust. Descobri rodando
`prisma init` de verdade e lendo o que ele gerou, em vez de confiar na memória do
modelo. Também precisei de `moduleFormat = "cjs"` no generator, senão o client
sai em ESM e o `require` do NestJS falha.

**3. O scaffold do NestJS não é strict.** O `nest new` gera `noImplicitAny:
false` e `strictBindCallApply: false`, sem `strict: true`. O enunciado exige
strict mode. Se eu tivesse assumido que "TypeScript no Nest já é strict",
entregaria fora da especificação. Ligar `strict` apontou um erro real: o
`expiresIn` do `@nestjs/jwt` é uma união de literais (`"1h"`, `"7d"`), e o valor
vem de env var resolvida em runtime — o compilador não tem como provar o formato,
e o cast precisa ser explícito e comentado.

**4. `tsc` colocaria o build no lugar errado.** Sem `rootDir`, o TypeScript
infere a raiz a partir do arquivo mais alto incluído. Como `prisma.config.ts`
fica na raiz do projeto, o resultado seria `dist/src/main.js` — e o
`CMD ["node", "dist/main"]` do Dockerfile quebraria. Peguei porque conferi a
estrutura do `dist` antes de escrever o Dockerfile, não depois.

**5. Jest não resolvia o client gerado.** O código que o Prisma gera importa com
extensão `.js` apontando para arquivos `.ts`. O Jest não faz essa tradução e
falhava com `Cannot find module './internal/class.js'`. A primeira sugestão da IA
foi mexer no `tsconfig`, o que não tem efeito — o problema é do resolver do Jest,
resolvido com `moduleNameMapper`.

**6. CRLF e BOM nos entrypoints do Docker.** No Windows, todo arquivo de texto
nasce com `\r\n`. O Linux lê `#!/bin/sh\r` e falha com "no such file or
directory" — o `\r` invisível corrompeu o nome do interpretador. Depois de
corrigir o CRLF com `sed -i 's/\r$//'` no Dockerfile, uma segunda falha: "exec
format error". Inspecionando os bytes brutos com `od`, descobri que o PowerShell
incluíra um BOM UTF-8 (`EF BB BF`) antes do `#!` — o kernel não reconheceu o
formato. Solução: trocar o encoder no PowerShell para
`New-Object System.Text.UTF8Encoding($false)` (sem BOM) e confirmar com `od`
antes de rebuildar.

**7. Volume do Postgres 18 no lugar errado.** A imagem `postgres:18-alpine`
mudou o diretório de dados de `/var/lib/postgresql/data` para
`/var/lib/postgresql`. O compose montava no path antigo; o container subia e
morria com a mensagem de erro claramente documentada na imagem. Resolução:
atualizar o ponto de montagem e limpar os volumes antigos com
`docker compose down -v`.

### Duas coisas que eu levantei e a IA não

**O atraso artificial não se aplicava a erros.** `delay` do RxJS deixa
notificação de erro passar direto. Isso significava que o 409 voltava instantâneo
e o rollback do frontend era invisível — justamente o cenário que o enunciado
quer ver demonstrado. Percebi testando o caminho de erro, não o de sucesso.

**As variáveis do Vite são de build time.** Passá-las como `environment:` no
compose não teria efeito nenhum: o Vite substitui `import.meta.env.VITE_*` por
texto literal durante o build. Precisam ser `args` do build. E o valor tem que
ser `localhost:3001`, não `http://auth-service:3001` — quem faz essas chamadas é
o navegador, que roda no host e não enxerga a rede interna do compose. Trocar
esses dois é o tipo de erro que só aparece quando se testa pelo navegador com
tudo containerizado.

### Como eu validei o que não sabia julgar

Regra que segui: nada entrou sem eu ter executado. Compilei os três projetos em
strict mode, rodei as 16 asserções dos testes, subi a stack do zero com
`docker compose down -v && docker compose up --build`, e verifiquei cada cenário
do enunciado à mão — inclusive derrubando o container do Auth para confirmar o
503. Onde o comportamento não era óbvio pelo código, escrevi um teste para
descrevê-lo.
