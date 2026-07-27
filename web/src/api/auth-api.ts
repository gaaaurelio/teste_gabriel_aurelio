import { env } from '../config/env';
import { requisitar } from './http';

export interface UsuarioLogado {
  id: string;
  email: string;
  name: string;
}

interface RespostaLogin {
  accessToken: string;
  tokenType: 'Bearer';
  user: UsuarioLogado;
}

/**
 * O login fala diretamente com o Auth Service, sem passar pelo Main API --
 * exatamente como o enunciado pede. O Main API nem conhece senha.
 */
export function fazerLogin(
  email: string,
  password: string,
): Promise<RespostaLogin> {
  return requisitar<RespostaLogin>(env.authUrl, '/auth/login', {
    method: 'POST',
    body: { email, password },
  });
}
