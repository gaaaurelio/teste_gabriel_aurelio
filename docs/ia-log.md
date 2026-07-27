# Log de uso de IA

Registro cronológico do desenvolvimento, com foco no que a IA gerou errado e em
como eu percebi. O resumo está no README; aqui ficam os detalhes.

Contexto pessoal: trabalho hoje com análise de dados (Python, Power BI) e minha
experiência anterior de backend é Laravel. NestJS, Prisma, React Query e
comunicação server-to-server eram novos para mim. Usei Cursor do começo ao fim.

---

## Estratégia geral

Três regras que segui:

1. **Nada entra sem ter rodado.** Compilar depois de cada arquivo, não no fim.
2. **Pedir tradução para o que eu já conheço.** "Isso equivale a que no
   Laravel?" foi o prompt que mais me ajudou a entender em vez de só aceitar.
3. **Desconfiar de código que parece de uma versão anterior.** Foi de longe a
   fonte de erro mais comum, e a mais perigosa, porque o resultado é plausível.

Liguei `strict: true` nos três projetos antes de escrever lógica. A ideia era
transformar erro de integração em erro de compilação — e funcionou: quase tudo
que quebrou, quebrou no `tsc` e não em runtime.

---

## Erro 1 — npm 11 bloqueia scripts de instalação em silêncio

**Sintoma.** `npm install` terminava com sucesso, mas com um aviso:

```
npm warn allow-scripts 1 package has install scripts not yet covered by allowScripts:
npm warn allow-scripts   @prisma/engines@7.9.1 (postinstall: node scripts/postinstall.js)
```

Código de saída 0. Nenhum erro.

**O problema real.** O npm 11 passou a exigir aprovação explícita para rodar
script de instalação de dependência — é proteção contra pacote malicioso. Só que
o postinstall do `@prisma/engines` é o que baixa o binário do schema engine, sem
o qual `prisma migrate` não funciona. Ou seja: a instalação "deu certo" e o
projeto estava quebrado.

**Como percebi.** Li o aviso em vez de ignorar. Foi tentador ignorar, porque o
comando tinha sucedido.

**Solução.**

```bash
npm approve-scripts prisma @prisma/engines @prisma/client
```

Aprovei pacote por pacote, não `--all`. A diferença importa: `--all` liberaria
qualquer script de qualquer dependência, presente e futura.

**Descoberta relevante depois.** Fui ver onde a aprovação ficou gravada. Está no
próprio `package.json`:

```json
"allowScripts": {
  "@prisma/client@7.9.1": true,
  "@prisma/engines@7.9.1": true,
  "prisma@7.9.1": true
}
```

Isso decidiu o design do Dockerfile. Como o `package.json` é copiado para dentro
da imagem, o `npm ci` do build respeita a aprovação. Se ela estivesse num
`.npmrc` de usuário, o build da imagem quebraria com o mesmo erro silencioso — e
esse é o tipo de falha que só aparece na máquina de quem for avaliar.

---

## Erro 2 — Prisma 7 mudou quase tudo, e a IA escrevia Prisma 5

Instalou a versão 7.9.1. A IA gerou, de forma consistente, o formato antigo:

```prisma
// o que a IA sugeriu (Prisma 5/6)
datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

generator client {
  provider = "prisma-client-js"
}
```

```ts
// e o import correspondente
import { PrismaClient } from '@prisma/client';
```

**Nada disso é a versão 7.** O que descobri rodando `npx prisma init` e lendo o
que ele efetivamente gerou:

| Assunto              | Prisma 5/6 (o que a IA gerou)      | Prisma 7 (o correto)                          |
| -------------------- | ---------------------------------- | --------------------------------------------- |
| URL do banco         | `url = env(...)` no `datasource`   | `prisma.config.ts`, com `dotenv`              |
| Generator            | `prisma-client-js`                 | `prisma-client`, com `output` obrigatório     |
| Import do client     | `@prisma/client`                   | caminho do `output`, ex. `./generated/prisma/client` |
| Conexão com o banco  | engine Rust embutida               | driver adapter (`@prisma/adapter-pg` + `pg`)  |
| `.env`               | carregado automaticamente          | não é mais; precisa de `dotenv` explícito     |

**Como percebi.** Não confiei na memória do modelo para uma versão recente. Rodei
`prisma init` de verdade e li os arquivos gerados. Levou dois minutos e evitou
uma sessão de depuração.

**Um ajuste extra que só apareceu no uso.** O generator do Prisma 7 emite o
client em ESM por padrão. O NestJS roda em CommonJS, e o `require` falhava.
Precisei declarar explicitamente:

```prisma
generator client {
  provider     = "prisma-client"
  output       = "../src/generated/prisma"
  moduleFormat = "cjs"
}
```

**O lado bom da mudança.** O client sem engine Rust resolve de graça um problema
clássico de Docker: binário nativo incompatível com a libc da imagem. Foi o que
me deu confiança de usar `node:24-slim` sem medo. (Mantive Debian em vez de Alpine
de todo jeito, porque o schema engine das *migrations* continua sendo binário
nativo.)

---

## Erro 3 — o scaffold do NestJS não é strict

O `nest new` gerou este `tsconfig.json`:

```json
"strictNullChecks": true,
"noImplicitAny": false,
"strictBindCallApply": false,
"noFallthroughCasesInSwitch": false
```

Não há `"strict": true`. O enunciado exige strict mode. Se eu tivesse assumido
que "TypeScript no Nest já vem strict", entregaria fora da especificação sem
perceber.

Liguei `strict`, e mais `noImplicitOverride` e `noUncheckedIndexedAccess`. Um
erro real apareceu na hora:

```
src/auth/auth.module.ts(18,7): error TS2322:
  Type 'string' is not assignable to type 'number | StringValue | undefined'
```

`expiresIn` do `@nestjs/jwt` é tipado como uma união de literais (`"1h"`,
`"7d"`, `"2 days"`). Meu valor vem de env var, resolvida em runtime, então o
compilador não tem como provar que a string está no formato aceito. O cast é
inevitável — o que fiz foi deixá-lo explícito e comentado, em vez de espalhar
`any`:

```ts
expiresIn: config.getOrThrow<string>('JWT_EXPIRES_IN') as JwtSignOptions['expiresIn']
```

O mesmo aconteceu no frontend: o template do Vite também não liga `strict`.

---

## Erro 4 — Jest não resolvia o client gerado pelo Prisma

```
Cannot find module './internal/class.js' from 'generated/prisma/client.ts'
```

O código que o Prisma gera importa com extensão `.js` apontando para arquivos
`.ts` — é o estilo NodeNext. O resolver do Jest não faz essa tradução.

A primeira sugestão da IA foi mexer no `tsconfig`, o que não tem efeito nenhum: o
`tsconfig` governa o compilador, e o problema é do resolver de módulos do Jest.
São duas coisas separadas. A correção é no `package.json`:

```json
"moduleNameMapper": {
  "^(\\.{1,2}/.*)\\.js$": "$1"
}
```

Reparei nisso porque o guard passou (9 casos verdes) e só a suíte do service
falhou. A diferença entre as duas: a do service importa `PrismaService`, que
importa o client gerado. Isso localizou a causa em segundos.

---

## Erro 5 — o build sairia no lugar errado

Antes de escrever os Dockerfiles, conferi a estrutura do `dist`. Era o que eu
esperava só por sorte: sem `rootDir` explícito, o `tsc` infere a raiz a partir do
arquivo mais alto incluído na compilação. Como `prisma.config.ts` fica na raiz do
projeto, o resultado seria `dist/src/main.js`, e não `dist/main.js`.

O `CMD ["node", "dist/main"]` do Dockerfile quebraria — e o erro apareceria só na
subida do container, longe da causa.

Corrigi com `"rootDir": "./src"` e `"include": ["src"]`, e confirmei o resultado:

```
dist/  →  auth | config | contratacoes | generated | health | prisma | main.js
```

Lição: conferir a saída do build antes de escrever a receita que depende dela.

---

## Erro 6 — o atraso artificial não valia para erros (esse fui eu que peguei)

O enunciado pede atraso de 1 a 2 segundos no endpoint de status. Coloquei num
interceptor com o `delay` do RxJS:

```ts
return next.handle().pipe(delay(atrasoMs));
```

Funcionava no caminho felizionário. Testei o caminho de erro (tentar
`recusado → aprovado`) e o 409 voltou **instantâneo**.

O motivo: `delay` só atrasa emissão de valor. Notificação de erro passa direto.
Consequência prática ruim: a interface mostrava o status otimista e revertia no
mesmo instante, então o rollback ficava invisível — justamente o comportamento
que o enunciado quer ver demonstrado.

Solução:

```ts
return next.handle().pipe(materialize(), delay(atrasoMs), dematerialize());
```

`materialize` converte a notificação — inclusive o erro — em valor comum, o
`delay` se aplica, e `dematerialize` restaura. Agora sucesso e erro levam o mesmo
1,5 s, e o rollback é visível.

Isso não veio de sugestão da IA. Veio de testar o caminho de erro.

---

## Erro 7 — as variáveis do Vite são de build time (esse também)

A sugestão inicial era passar `VITE_API_URL` como `environment:` do serviço `web`
no compose. Não funciona, e não é sutil: o Vite substitui `import.meta.env.VITE_*`
por texto literal **durante o build**. Em runtime a variável não existe — o valor
já está dentro do JavaScript minificado.

Precisa ser `args` do build:

```dockerfile
ARG VITE_API_URL
ENV VITE_API_URL=$VITE_API_URL
RUN npm run build
```

E tem um segundo detalhe no mesmo lugar, mais fácil ainda de errar: o valor
precisa ser `http://localhost:3000`, e **não** `http://main-api:3000`. Nomes de
serviço só resolvem dentro da rede do compose. Quem faz essas chamadas é o
navegador, que roda na máquina do host. Usar o nome do serviço geraria um erro de
DNS visível apenas no console do navegador, com a API funcionando perfeitamente
via `curl`.

---

## Decisão em que discordei da sugestão da IA

Pedi a modelagem do status e a sugestão foi um enum do Prisma:

```prisma
enum ContratacaoStatus {
  SOLICITADO
  EM_ANALISE
  APROVADO
  RECUSADO
}
```

Recusei. O enunciado especifica `em análise`, com acento e espaço. Identificador
de enum não aceita isso, então o esquema exigiria uma camada de tradução entre o
valor do banco (`EM_ANALISE`) e o valor do contrato HTTP (`em análise`) — em toda
leitura e toda escrita. Mais código, mais lugar para divergir.

Optei por coluna de texto com o valor exato do contrato, garantido por `@IsIn` na
entrada e por type guard na saída. O que se perde é a garantia no nível do banco
contra escrita direta por fora da aplicação; está anotado no README como
melhoria.

Também recusei implementar uma máquina de estados completa, que a IA sugeriu
"para ficar mais robusto". O enunciado pede uma proibição específica. Inventar
outras seria criar regra de negócio que ninguém pediu.

---

## Erro 8 — docker-entrypoint.sh com CRLF: "exec format error" e "no such file or directory"

**Contexto.** Os Dockerfiles copiavam um `docker-entrypoint.sh` para dentro das
imagens Linux. No Windows, todo arquivo criado no editor vem com `\r\n` (CRLF).

**Sintoma 1 — "no such file or directory".** O Linux tentava executar o script,
lia `#!/bin/sh\r` no primeiro ciclo, e falhava porque `/bin/sh\r` (com o `\r`)
não existe. O nome errado faz parecer que o arquivo é que está ausente.

**Tentativa 1.** Adicionei `sed -i 's/\r$//' ./docker-entrypoint.sh` no
Dockerfile antes do `chmod`. O build rodou sem erros. Os containers ainda
travavam.

**Sintoma 2 — "exec format error".** O arquivo existia, o `sed` tinha rodado, e
ainda assim o Linux recusava executar. Com `od -An -tx1`, vi os primeiros bytes:
`ef bb bf 23 21 2f`. Os três primeiros (`ef bb bf`) são o BOM do UTF-8 — quando o
PowerShell usa `[System.Text.Encoding]::UTF8`, ele inclui o BOM. Com BOM, o
shebang `#!/bin/sh` começa no quarto byte, e o kernel não reconhece o formato.

**Solução.** Trocar o encoder:

```powershell
$utf8NoBom = New-Object System.Text.UTF8Encoding($false)
[System.IO.File]::WriteAllText("docker-entrypoint.sh", $conteudo, $utf8NoBom)
```

Confirmei com `od` que os primeiros bytes eram `23 21` (== `#!`) antes de fazer
o rebuild. O `sed` no Dockerfile ficou como proteção extra para qualquer clone
feito no Windows no futuro.

**Lição.** São dois problemas diferentes com sintomas parecidos. `\r` invisível
corrompe o nome do interpretador; BOM invisível corrompe o início do arquivo. O
caminho para encontrar o segundo foi inspecionar os bytes brutos, não o conteúdo
em texto.

---

## Erro 9 — volume do Postgres 18 no lugar errado

Esse erro foi anterior ao build dos serviços NestJS, mas vale registrar.

**Sintoma.** O `docker compose up` subia os containers do Postgres e eles
paravam imediatamente com:

```
Error: in 18+, these Docker images are configured to store database data
in a different location than before (previously: /var/lib/postgresql/data,
now: /var/lib/postgresql)
```

**Causa.** A imagem `postgres:18-alpine` mudou o diretório de dados. O
`docker-compose.yml` montava volume em `/var/lib/postgresql/data`, que a versão
18 já não usa.

**Solução.** Atualizar o ponto de montagem no compose:

```yaml
volumes:
  - postgres-auth-data:/var/lib/postgresql   # era /var/lib/postgresql/data
```

E antes do primeiro up válido, limpar os volumes antigos:

```bash
docker compose down -v
```

---

## O que eu fiz para ter certeza de que entendo o código

- Reescrevi na minha própria linguagem, em [defesa.md](defesa.md), o porquê de
  cada decisão que não é óbvia.
- Quebrei coisas de propósito para ver o erro: parei o container do Auth (503),
  troquei a `INTERNAL_API_KEY` do Main API (401 na chamada interna), mandei um
  status inexistente (400), pedi `recusado → aprovado` (409).
- Onde o comportamento não era óbvio pelo código, escrevi um teste para
  descrevê-lo — os quatro modos de falha do guard S2S nasceram assim.
