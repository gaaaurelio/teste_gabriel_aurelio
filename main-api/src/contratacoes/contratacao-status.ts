/**
 * Dominio de status de uma contratacao e as regras de transicao entre eles.
 *
 * Este arquivo e deliberadamente puro (nenhuma dependencia de Nest, Prisma ou
 * HTTP), o que permite testar a regra de negocio sem instanciar modulo,
 * conectar banco nem subir servidor.
 */

export const CONTRATACAO_STATUSES = [
  'solicitado',
  'em análise',
  'aprovado',
  'recusado',
] as const;

export type ContratacaoStatus = (typeof CONTRATACAO_STATUSES)[number];

/** Toda contratacao nasce como "solicitado"; o cliente nao escolhe o status. */
export const STATUS_INICIAL: ContratacaoStatus = 'solicitado';

/**
 * Transicoes bloqueadas, indexadas pelo status de origem.
 *
 * O enunciado exige bloquear apenas `recusado -> aprovado`. Optei por nao
 * inventar outras restricoes: uma maquina de estados completa (por exemplo
 * proibir `solicitado -> aprovado` sem passar por analise) seria uma regra de
 * negocio que ninguem pediu, e que quebraria usos legitimos da API.
 *
 * A estrutura e um mapa em vez de um `if` justamente para que acrescentar uma
 * nova proibicao seja alterar dado, e nao logica.
 */
export const TRANSICOES_BLOQUEADAS: Readonly<
  Record<ContratacaoStatus, readonly ContratacaoStatus[]>
> = {
  solicitado: [],
  'em análise': [],
  aprovado: [],
  recusado: ['aprovado'],
};

export function isContratacaoStatus(value: unknown): value is ContratacaoStatus {
  return (
    typeof value === 'string' &&
    (CONTRATACAO_STATUSES as readonly string[]).includes(value)
  );
}

export function isTransicaoBloqueada(
  de: ContratacaoStatus,
  para: ContratacaoStatus,
): boolean {
  return TRANSICOES_BLOQUEADAS[de].includes(para);
}

/**
 * Mensagem de erro exibida ao usuario. Fica junto da regra para que o texto
 * nao se descole do comportamento.
 */
export function mensagemTransicaoBloqueada(
  de: ContratacaoStatus,
  para: ContratacaoStatus,
): string {
  return `Transicao de status invalida: uma contratacao com status "${de}" nao pode ir direto para "${para}".`;
}
