/**
 * Validacao das variaveis de ambiente no boot. Ver comentario equivalente em
 * auth-service/src/config/env.validation.ts.
 */

export interface MainApiEnv {
  PORT: number;
  DATABASE_URL: string;
  AUTH_SERVICE_URL: string;
  INTERNAL_API_KEY: string;
  AUTH_VALIDATE_TIMEOUT_MS: number;
  STATUS_UPDATE_DELAY_MS: number;
  CORS_ORIGINS: string;
}

function requireString(raw: Record<string, unknown>, key: string): string {
  const value = raw[key];
  if (typeof value !== 'string' || value.trim() === '') {
    throw new Error(
      `[main-api] Variavel de ambiente obrigatoria ausente ou vazia: ${key}`,
    );
  }
  return value;
}

function optionalString(
  raw: Record<string, unknown>,
  key: string,
  fallback: string,
): string {
  const value = raw[key];
  return typeof value === 'string' && value.trim() !== '' ? value : fallback;
}

function positiveInt(
  raw: Record<string, unknown>,
  key: string,
  fallback: string,
): number {
  const parsed = Number(optionalString(raw, key, fallback));
  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new Error(
      `[main-api] ${key} deve ser um inteiro positivo. Recebido: ${String(raw[key])}`,
    );
  }
  return parsed;
}

export function validateMainApiEnv(raw: Record<string, unknown>): MainApiEnv {
  const authServiceUrl = requireString(raw, 'AUTH_SERVICE_URL');
  if (!/^https?:\/\//.test(authServiceUrl)) {
    throw new Error(
      `[main-api] AUTH_SERVICE_URL precisa comecar com http:// ou https://. Recebido: ${authServiceUrl}`,
    );
  }

  return {
    PORT: positiveInt(raw, 'PORT', '3000'),
    DATABASE_URL: requireString(raw, 'DATABASE_URL'),
    // Sem barra no final, para montar as URLs por concatenacao sem duplicar "/".
    AUTH_SERVICE_URL: authServiceUrl.replace(/\/+$/, ''),
    INTERNAL_API_KEY: requireString(raw, 'INTERNAL_API_KEY'),
    AUTH_VALIDATE_TIMEOUT_MS: positiveInt(raw, 'AUTH_VALIDATE_TIMEOUT_MS', '2000'),
    STATUS_UPDATE_DELAY_MS: positiveInt(raw, 'STATUS_UPDATE_DELAY_MS', '1500'),
    CORS_ORIGINS: optionalString(raw, 'CORS_ORIGINS', 'http://localhost:8080'),
  };
}
