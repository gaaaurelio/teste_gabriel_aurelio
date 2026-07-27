import { env } from '../config/env';
import { requisitar } from './http';
import type {
  Contratacao,
  FiltroStatus,
  NovaContratacao,
  Status,
} from '../contratacoes/tipos';

export function listarContratacoes(
  token: string,
  filtro: FiltroStatus,
  signal: AbortSignal,
): Promise<Contratacao[]> {
  const query =
    filtro === null ? '' : `?status=${encodeURIComponent(filtro)}`;

  return requisitar<Contratacao[]>(
    env.apiUrl,
    `/contratacoes${query}`,
    { token, signal },
  );
}

export function criarContratacao(
  token: string,
  dados: NovaContratacao,
): Promise<Contratacao> {
  return requisitar<Contratacao>(env.apiUrl, '/contratacoes', {
    method: 'POST',
    body: dados,
    token,
  });
}

/** Endpoint com o atraso artificial de ~1,5s no servidor. */
export function atualizarStatus(
  token: string,
  id: string,
  status: Status,
): Promise<Contratacao> {
  return requisitar<Contratacao>(env.apiUrl, `/contratacoes/${id}/status`, {
    method: 'PATCH',
    body: { status },
    token,
  });
}

export function excluirContratacao(token: string, id: string): Promise<void> {
  return requisitar<void>(env.apiUrl, `/contratacoes/${id}`, {
    method: 'DELETE',
    token,
  });
}
