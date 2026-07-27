# Dossiê de defesa

Perguntas que provavelmente vêm numa conversa sobre este código, com as respostas
na linguagem que eu uso. Não é documentação do projeto — é a minha preparação.

Ordem de prioridade: as cinco primeiras são as que quase certamente vêm.

---

## 1. Por que o Main API não valida o JWT localmente? Seria mais rápido.

Seria, e é assim que a maioria dos projetos faz — `passport-jwt` conferindo a
assinatura no próprio processo, sem chamada de rede.

O enunciado pede o contrário, e a razão faz sentido: com validação centralizada,
a autoridade sobre a sessão fica em um único serviço. Se amanhã aparecer
necessidade de revogar token antes do vencimento, ou de trocar o algoritmo de
assinatura, ou de checar se o usuário foi desativado, tudo isso acontece dentro do
Auth Service e o Main API não muda uma linha. Com validação local, cada serviço
que valida token passa a ser um lugar que precisa saber dessas regras.

O preço é real e eu assumo: uma chamada HTTP por request e um ponto de falha a
mais no caminho crítico. É exatamente por isso que existe timeout de 2 s e que a
falha dela virou 503 em vez de 500.

Prova de que não estou trapaceando: o `package.json` do Main API não tem
`@nestjs/jwt` nem `jsonwebtoken`. Ele não teria como validar localmente nem se
quisesse.

---

## 2. Por que 503 e não 500 quando o Auth Service cai?

Porque 500 significa "eu tenho um bug" e 503 significa "eu estou bem, mas uma
dependência de que preciso não está disponível agora". São diagnósticos
diferentes, e quem lê o código de resposta age de forma diferente em cada caso.

Três consequências práticas:

- **Para o cliente:** 503 é um erro do qual vale a pena tentar de novo. 500 não —
  repetir provavelmente dá o mesmo resultado. Por isso a interface mostra um botão
  "tentar de novo" no 503.
- **Para o load balancer e o orquestrador:** 503 é o sinal padrão de "não me manda
  tráfego agora".
- **Para o alerta de plantão:** um pico de 500 manda alguém procurar bug no
  código. Um pico de 503 manda olhar a dependência. Errar isso faz o time procurar
  no lugar errado durante um incidente.

Um detalhe da implementação: 401 vindo do Auth Service **não** virou 503. Se o
token é ruim, o problema é do cliente, e ele precisa receber 401 para saber que
tem de logar de novo. Só falha de infraestrutura vira 503.

---

## 3. Explique a atualização otimista. O que acontece se a API der erro?

Sem otimismo, o clique em "aprovar" deixaria a interface parada por 1,5 s — o
tempo do atraso artificial. A aposta é que a operação vai dar certo (é o caso
comum), então escrevo o novo estado no cache imediatamente e trato a resposta do
servidor como confirmação.

O fluxo tem quatro passos, e cada um resolve um problema concreto:

**`onMutate`** — antes do request sair:

1. Marco o id como "em andamento", o que trava a linha na interface.
2. `cancelQueries` — cancela qualquer refetch da lista que já esteja em voo.
3. Tiro um snapshot de todas as listas em cache.
4. Escrevo o status novo no cache.

**`onError`** — restauro cada lista exatamente como estava no snapshot e mostro a
mensagem do servidor num aviso. Sem esse aviso, o status "voltaria sozinho" e a
pessoa não saberia por quê.

**`onSettled`** — libero a trava e reconcilio com o servidor.

O passo 2 é o que quase todo mundo esquece, e vale explicar por que existe: se
havia um refetch em voo, ele foi disparado *antes* da minha mudança, então vai
chegar com o dado anterior e sobrescrever o valor otimista. O sintoma é o status
voltar sozinho, sem erro nenhum, de forma intermitente — praticamente
irreproduzível se não se souber a causa.

Detalhe extra: como a lista pode estar filtrada por status, quando o item deixa
de casar com o filtro ativo ele sai da tela na hora, sem esperar o refetch.

---

## 4. Como você impede que dois cliques rápidos deixem o estado inconsistente?

Três camadas, e faço questão de que sejam três porque cada uma cobre uma falha das
outras.

**Camada 1 — trava visual.** Enquanto a mutação está pendente, a linha inteira
fica desabilitada e esmaecida com "salvando...". Resolve o caso normal.

**Camada 2 — trava programática.** A função de atualizar consulta o conjunto de
ids em andamento e descarta a chamada se o id já estiver lá. Isso existe porque a
camada 1 depende do React ter re-renderizado; dois cliques em poucos
milissegundos podem passar antes disso.

**Camada 3 — no servidor.** Esta é a que importa de verdade, porque as duas
primeiras protegem a interface e não o dado. Quem manda request pelo `curl` não
passa por nenhuma delas.

No servidor, o update é condicionado ao status que acabei de ler:

```ts
await this.prisma.contratacao.updateMany({
  where: { id, status: atual.status },   // <- a condição
  data: { status: novoStatus },
});
```

Se `count` volta 0, significa que outro request mudou o status entre o meu SELECT
e o meu UPDATE. Respondo 409 em vez de sobrescrever. Sem essa condição, a segunda
escrita venceria em silêncio — e poderia produzir justamente o
`recusado → aprovado` que a regra proíbe, porque cada request validou a transição
contra um estado que já não era o atual.

Uma escolha deliberada: repetir o status atual é tratado como **sucesso sem
escrita**, não como conflito. Dois cliques em "Aprovar" chegando quase juntos
terminam os dois em 200, e a tela não mostra erro por uma operação cujo resultado
final é exatamente o pedido.

---

## 5. Por que o token está no localStorage e não num cookie httpOnly?

Cookie `httpOnly` é mais seguro, porque JavaScript não consegue lê-lo — um XSS
não rouba a sessão.

Não é viável neste ambiente, e o motivo é concreto. O frontend está em
`localhost:8080` e os serviços em `localhost:3001` e `3000`. São origens
diferentes. Cookie enviado cross-origin exige `SameSite=None`, que exige
`Secure`, que exige HTTPS. Nada disso existe em ambiente local em HTTP. Somando a
isso, o enunciado dispensa refresh token, que é o mecanismo em que o cookie
httpOnly realmente compensa a complexidade.

O custo que assumo: qualquer JavaScript da página lê o `localStorage`. Não uso
`dangerouslySetInnerHTML` em nenhum lugar e o React escapa conteúdo por padrão,
então a superfície é pequena — mas ela existe, e eu não fingiria que não.

Em produção: os dois serviços atrás do mesmo domínio via reverse proxy
(`app.exemplo.com` e `app.exemplo.com/api`), cookie `httpOnly` + `SameSite=Lax` +
`Secure`, e refresh token rotativo.

---

## 6. Qual a diferença entre o JWT e a API key interna?

Elas respondem perguntas diferentes.

O **JWT** responde "quem é a pessoa que está pedindo isso?". Vai no header
`Authorization`, é emitido no login, expira em 1 hora e carrega id, e-mail e nome
do usuário.

A **API key interna** responde "qual sistema está me chamando?". Vai no header
`x-internal-api-key`, não expira, não tem relação com usuário nenhum, e serve
para o Auth Service saber que quem chamou `/auth/validate` foi o Main API e não
alguém que alcançou a porta.

Por que as duas são necessárias: sem a API key, qualquer um com acesso de rede
poderia usar `/auth/validate` como oráculo para descobrir se um token capturado
ainda vale. Sem o JWT, o Main API não saberia de quem é a contratação sendo
criada.

Um detalhe que eu cuidei: a comparação da API key usa `timingSafeEqual`, e não
`===`. Um `===` retorna mais rápido quando os primeiros caracteres já diferem, o
que em teoria permite descobrir a chave caractere por caractere medindo o tempo de
resposta. É ataque difícil na prática, mas o custo de fazer certo é uma linha.

---

## 7. Por que 409 na transição bloqueada, e não 400 ou 422?

400 significa "não entendi o seu request". Não é o caso: `{"status":"aprovado"}` é
um corpo perfeitamente válido, e o `class-validator` aprovou.

409 Conflict significa "entendi o pedido, é válido, mas ele conflita com o estado
atual do recurso". É exatamente a situação: o mesmo request funcionaria se a
contratação estivesse em outro status.

A prova de que a distinção é a certa: se eu mandar `{"status":"banana"}`, recebo
400 do `ValidationPipe`, porque aí sim o request está malformado. Dois problemas
diferentes, dois códigos diferentes.

---

## 8. Por que Prisma e não TypeORM?

Três razões, em ordem de peso:

1. **Migrations não interativas confiáveis.** `prisma migrate deploy` aplica o que
   está versionado, nunca gera migration nova e nunca apaga dado. É o que o
   entrypoint do container precisa. O caminho fácil do TypeORM é `synchronize:
   true`, que é conveniente em desenvolvimento e inaceitável em produção.
2. **Tipos gerados a partir do schema.** Com o projeto todo em strict, um nome de
   coluna errado vira erro de compilação em vez de erro em runtime.
3. **Legibilidade.** Um arquivo declarativo descreve o banco inteiro.

O que TypeORM tem de melhor, e reconheço: integração mais idiomática com o Nest
(repositórios injetáveis, decorators nas entidades) e mais flexibilidade em query
complexa. Para este escopo, migrations confiáveis pesaram mais.

**Se perguntarem do Prisma 7 especificamente:** a versão 7 removeu a engine Rust
do client. A query é compilada em WebAssembly e a conexão passa por um driver
adapter — no caso, `node-postgres`. Para Docker isso é ótimo, porque elimina a
classe de problema de binário nativo incompatível com a libc da imagem. Mantive
Debian em vez de Alpine de todo jeito, porque o schema engine usado pelas
*migrations* continua sendo binário nativo.

---

## 9. Por que dois containers Postgres e não um com dois schemas?

O enunciado permitia as duas coisas.

Escolhi containers separados porque o valor de separar serviços está justamente na
impossibilidade de um alcançar o dado do outro. Com um Postgres compartilhado,
bastaria alguém escrever a connection string com o schema errado, ou um `JOIN`
apressado numa correção de madrugada, para furar essa fronteira — e passaria no
code review, porque tecnicamente funciona.

Com instâncias separadas, o isolamento não depende de disciplina: não existe
caminho de SQL entre as duas. Se o Main API precisar do nome de um usuário, tem
que pedir ao Auth Service, e essa dependência fica visível no código.

O custo é mais memória e mais um container para operar. Em desenvolvimento é
irrelevante.

---

## 10. Por que o atraso artificial está num interceptor e não no service?

Duas razões concretas.

**Testabilidade.** Se o atraso estivesse no service, a suíte de testes da regra de
transição levaria 1,5 s por caso. Com ele no interceptor, o service é síncrono do
ponto de vista do teste e as 16 asserções rodam em ~1,3 s no total.

**Nada fica preso.** O interceptor segura a resposta *depois* que o banco já
respondeu e a transação já fechou. Se o atraso estivesse dentro do service, entre
o SELECT e o UPDATE, eu estaria segurando conexão de banco à toa — e sob carga é
assim que se esgota o pool.

Conceitualmente também é o lugar certo: o atraso é artificial, uma característica
do transporte para fins de demonstração, não regra de negócio.

**A parte que exigiu cuidado:** o `delay` do RxJS não atrasa notificação de erro,
só emissão de valor. Descobri testando o caminho de erro: o 409 voltava
instantâneo, e o rollback do frontend ficava invisível. Resolvi com
`materialize() → delay() → dematerialize()`, que transforma o erro em valor comum,
atrasa, e restaura. Agora sucesso e erro levam o mesmo tempo.

---

## 11. Como o Nest se compara ao que você já conhecia?

Foi assim que consegui avançar rápido numa stack nova: quase tudo tem equivalente
direto no Laravel.

| NestJS                          | Laravel                    | O que faz                          |
| ------------------------------- | -------------------------- | ---------------------------------- |
| Guard (`CanActivate`)           | Middleware de rota         | decide se o request continua       |
| DTO + `class-validator`         | Form Request               | valida a entrada antes do handler  |
| Interceptor                     | Middleware de resposta     | envolve a execução do handler      |
| Injeção de dependência via módulo | Service Container        | monta as dependências              |
| `prisma migrate`                | `artisan migrate`          | versiona o schema                  |
| `ConfigService`                 | `config()` + `.env`        | lê configuração de forma tipada    |

As diferenças que realmente exigiram aprendizado nova foram três: o sistema de
módulos (em Laravel o container é global; no Nest cada módulo declara o que
importa e o que exporta), o `strict` do TypeScript obrigando a tratar `null` e
`undefined` de forma explícita, e RxJS nos interceptors — que foi o que me mordeu
no caso do `delay` com erro.

---

## 12. O que quebra se eu mudar a `INTERNAL_API_KEY` só do Main API?

O login continua funcionando, porque ele não passa pela chamada interna. Mas toda
rota autenticada do Main API começa a responder **503**.

O caminho: o Main API chama `/auth/validate` com a chave errada, o
`InternalApiKeyGuard` do Auth responde 401, e o `AuthClientService` trata 401 na
chamada *interna* como falha de infraestrutura (é configuração nossa que está
errada, não credencial do usuário), devolvendo 503.

Testei isso de propósito. O log do Main API mostra
`Auth Service respondeu 401 em POST /auth/validate`, que é a pista para achar a
causa.

---

## 13. Se o Auth Service ficar lento em vez de cair, o que acontece?

É o caso mais perigoso, e o que o timeout resolve.

`AbortSignal.timeout(2000)` no `fetch`: se o Auth aceita a conexão TCP mas não
responde, o request é abortado em 2 s e o cliente recebe 503.

Sem isso, cada request ficaria pendurado esperando o timeout default do cliente
HTTP, que é longo. Com dezenas de requests nessa situação, o Main API esgota
conexões e event loop e cai também — a falha de um serviço viraria a falha de
dois. O nome disso é falha em cascata, e o timeout é a defesa mais barata.

Está coberto por teste: o dublê do `fetch` rejeita com um erro de nome
`TimeoutError` e o teste verifica que sai `ServiceUnavailableException`.

**O que falta, e eu admito:** com mais tempo eu acrescentaria um circuit breaker.
Hoje, com o Auth fora, todo request paga 2 s de espera antes do 503. Um breaker
passaria a falhar imediatamente depois de N falhas consecutivas, e voltaria a
tentar após um intervalo.

---

## 14. Por que o guard client-side, se ele não protege nada?

Porque ele não é segurança, é navegação — e essa distinção é o ponto.

O `RotaProtegida` evita que alguém sem sessão veja uma tela quebrada que faria
requests destinados a falhar. É experiência de uso.

Quem protege os dados é o `S2SAuthGuard` no Main API. Se alguém remover a
checagem do frontend pelo DevTools, chega numa tela vazia com erro 401 — porque a
API recusa o request. A regra que sigo: validação no cliente é conveniência,
validação no servidor é segurança, e nunca se troca uma pela outra.

---

## 15. O que você faria diferente com mais uma semana?

- **`CHECK constraint` no status**, para fechar a brecha de escrita direta no
  banco por fora da aplicação — hoje o domínio de valores é garantido só pela
  aplicação.
- **Refresh token com cookie `httpOnly`**, com os serviços atrás de reverse proxy
  no mesmo domínio, eliminando o trade-off do `localStorage`.
- **Circuit breaker** na chamada ao Auth, para não pagar 2 s de timeout por
  request enquanto ele está fora.
- **Testes e2e** com Testcontainers, subindo os dois serviços e cobrindo
  login → criar → transição bloqueada de ponta a ponta.
- **Request id propagado** do frontend até o Auth Service, para seguir um request
  pelos dois serviços num log só. Hoje, depurar algo que atravessa a fronteira
  exige correlacionar timestamps à mão.
- **Rate limit no `/auth/login`**, que hoje aceita tentativas ilimitadas de senha.

---

## Roteiro de demonstração ao vivo

Se pedirem para mostrar funcionando, nesta ordem:

1. `docker compose up --build` — um comando, nada de setup manual.
2. Login com `admin@ramper.com` / `ramper123`.
3. Criar uma contratação. Nasce como `solicitado`.
4. Mudar para `em análise` — apontar que a etiqueta muda na hora e que o servidor
   confirma 1,5 s depois.
5. Mudar para `recusado`, esperar confirmar, tentar `aprovado` — mostrar o
   rollback e a mensagem de 409.
6. Clicar cinco vezes rápido em "Aprovar" — mostrar que só um request sai (aba
   Network) e que o estado final é consistente.
7. `docker compose stop auth-service`, recarregar a lista — mostrar o 503 tratado.
8. `docker compose start auth-service` — mostrar que volta ao normal sozinho.
9. `cd main-api && npm test` — 16 asserções verdes.
