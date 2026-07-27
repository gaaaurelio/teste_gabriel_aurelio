/**
 * Erro de API com o status HTTP preservado. Sem isso, a camada de UI so
 * receberia uma string e nao conseguiria distinguir "token expirado" (401, que
 * exige logout) de "regra de negocio violada" (409, que exige apenas mostrar a
 * mensagem e desfazer a mudanca otimista).
 */
export class ApiError extends Error {
  readonly status: number;

  constructor(status: number, message: string) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
  }

  get ehNaoAutorizado(): boolean {
    return this.status === 401;
  }

  get ehServicoIndisponivel(): boolean {
    return this.status === 503;
  }
}

/** Erro de rede: o servidor nao respondeu (nao chegou a existir status). */
export class ErroDeRede extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ErroDeRede';
  }
}

interface OpcoesRequisicao {
  method?: 'GET' | 'POST' | 'PATCH' | 'DELETE';
  body?: unknown;
  token?: string | null;
  /** Repassado pelo React Query para cancelar requisicoes obsoletas. */
  signal?: AbortSignal;
}

export async function requisitar<T>(
  baseUrl: string,
  caminho: string,
  opcoes: OpcoesRequisicao = {},
): Promise<T> {
  const { method = 'GET', body, token, signal } = opcoes;

  const headers: Record<string, string> = {};
  if (body !== undefined) {
    headers['content-type'] = 'application/json';
  }
  if (token != null && token !== '') {
    headers.authorization = `Bearer ${token}`;
  }

  let resposta: Response;
  try {
    resposta = await fetch(`${baseUrl}${caminho}`, {
      method,
      headers,
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
      ...(signal === undefined ? {} : { signal }),
    });
  } catch (erro) {
    // Um AbortError precisa continuar sendo AbortError: o React Query o usa
    // para saber que a requisicao foi cancelada, e nao que falhou.
    if (erro instanceof DOMException && erro.name === 'AbortError') {
      throw erro;
    }
    throw new ErroDeRede(
      'Nao foi possivel falar com o servidor. Verifique se os containers estao no ar.',
    );
  }

  if (resposta.status === 204) {
    return undefined as T;
  }

  const corpo: unknown = await resposta.json().catch(() => null);

  if (!resposta.ok) {
    throw new ApiError(resposta.status, extrairMensagem(corpo, resposta.status));
  }

  return corpo as T;
}

/**
 * O Nest devolve `message` como string em excecoes lancadas por nos e como
 * array de strings quando o ValidationPipe reprova o DTO. A UI trata os dois
 * casos aqui, uma vez, em vez de em cada tela.
 */
function extrairMensagem(corpo: unknown, status: number): string {
  if (typeof corpo === 'object' && corpo !== null) {
    const { message } = corpo as { message?: unknown };

    if (typeof message === 'string' && message !== '') {
      return message;
    }
    if (Array.isArray(message)) {
      const mensagens = message.filter(
        (item): item is string => typeof item === 'string',
      );
      if (mensagens.length > 0) {
        return mensagens.join('. ');
      }
    }
  }

  return `O servidor respondeu com erro ${status}.`;
}
