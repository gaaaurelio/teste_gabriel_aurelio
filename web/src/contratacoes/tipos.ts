/**
 * Espelho do contrato do Main API.
 *
 * Nao uso `enum` aqui de proposito: o tsconfig do frontend liga
 * `erasableSyntaxOnly`, que proibe construcoes TypeScript que geram codigo em
 * runtime. Uma tupla `as const` mais um tipo derivado dela resolve melhor: da
 * a mesma seguranca de tipos e ainda serve como lista iteravel para montar o
 * filtro e o seletor da interface.
 */
export const STATUSES = [
  'solicitado',
  'em análise',
  'aprovado',
  'recusado',
] as const;

export type Status = (typeof STATUSES)[number];

export interface Contratacao {
  id: string;
  nomeCliente: string;
  email: string;
  produto: string;
  status: Status;
  criadoPorId: string;
  criadoEm: string;
  atualizadoEm: string;
}

export interface NovaContratacao {
  nomeCliente: string;
  email: string;
  produto: string;
}

/** `null` representa "sem filtro". */
export type FiltroStatus = Status | null;

export const PRODUTOS = [
  'Ramper Prospect',
  'Ramper Pipeline',
  'Ramper Marketing',
  'Ramper Suite',
] as const;
