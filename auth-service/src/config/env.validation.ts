/**
 * Validacao das variaveis de ambiente no boot.
 *
 * O objetivo e falhar imediatamente na subida do container quando falta uma
 * variavel, em vez de descobrir isso no meio de um request. E o equivalente ao
 * papel do config/*.php do Laravel: centralizar a leitura do ambiente em um
 * lugar tipado, em vez de espalhar process.env pelo codigo.
 */

export interface AuthEnv {
  PORT: number;
  DATABASE_URL: string;
  JWT_SECRET: string;
  JWT_EXPIRES_IN: string;
  INTERNAL_API_KEY: string;
  SEED_ON_BOOT: boolean;
  CORS_ORIGINS: string;
}

function requireString(raw: Record<string, unknown>, key: string): string {
  const value = raw[key];
  if (typeof value !== 'string' || value.trim() === '') {
    throw new Error(
      `[auth-service] Variavel de ambiente obrigatoria ausente ou vazia: ${key}`,
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

export function validateAuthEnv(raw: Record<string, unknown>): AuthEnv {
  const port = Number(optionalString(raw, 'PORT', '3001'));
  if (!Number.isInteger(port) || port <= 0) {
    throw new Error(`[auth-service] PORT invalida: ${String(raw['PORT'])}`);
  }

  const jwtSecret = requireString(raw, 'JWT_SECRET');
  if (jwtSecret.length < 16) {
    throw new Error(
      '[auth-service] JWT_SECRET precisa ter no minimo 16 caracteres.',
    );
  }

  return {
    PORT: port,
    DATABASE_URL: requireString(raw, 'DATABASE_URL'),
    JWT_SECRET: jwtSecret,
    JWT_EXPIRES_IN: optionalString(raw, 'JWT_EXPIRES_IN', '1h'),
    INTERNAL_API_KEY: requireString(raw, 'INTERNAL_API_KEY'),
    SEED_ON_BOOT: optionalString(raw, 'SEED_ON_BOOT', 'true') === 'true',
    CORS_ORIGINS: optionalString(raw, 'CORS_ORIGINS', 'http://localhost:8080'),
  };
}
