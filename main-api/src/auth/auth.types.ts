/** Usuario autenticado, do jeito que o Main API o enxerga. */
export interface AuthenticatedUser {
  id: string;
  email: string;
  name: string;
}

/** Formato do corpo devolvido por POST /auth/validate no Auth Service. */
export interface ValidateTokenResponseBody {
  valid: true;
  payload: {
    sub: string;
    email: string;
    name: string;
    iat: number;
    exp: number;
  };
  expiresAt: string;
}

/**
 * O `fetch` devolve `unknown` depois do `.json()`. Como esse dado atravessa a
 * fronteira entre dois servicos, ele e tratado como entrada externa nao
 * confiavel e conferido em runtime -- o tipo declarado acima e apenas uma
 * promessa de compilacao, nao uma garantia.
 */
export function isValidateTokenResponseBody(
  value: unknown,
): value is ValidateTokenResponseBody {
  if (typeof value !== 'object' || value === null) {
    return false;
  }

  const payload = (value as { payload?: unknown }).payload;
  if (typeof payload !== 'object' || payload === null) {
    return false;
  }

  const { sub, email, name } = payload as Record<string, unknown>;

  return (
    typeof sub === 'string' &&
    sub.length > 0 &&
    typeof email === 'string' &&
    typeof name === 'string'
  );
}
