import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import type { Request } from 'express';
import { AuthClientService } from './auth-client.service';
import type { AuthenticatedUser } from './auth.types';

/** Request depois que o guard identificou quem esta chamando. */
export interface RequestComUsuario extends Request {
  usuario?: AuthenticatedUser;
}

/**
 * Guard e o equivalente conceitual de um middleware de rota do Laravel: roda
 * antes do controller e decide se o request continua.
 *
 * Diferente do padrao mais comum (passport-jwt verificando a assinatura
 * localmente), este guard delega a decisao ao Auth Service via HTTP. Ver o
 * comentario em auth-client.service.ts para o porque.
 */
@Injectable()
export class S2SAuthGuard implements CanActivate {
  constructor(private readonly authClient: AuthClientService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<RequestComUsuario>();
    const token = extrairBearerToken(request.headers.authorization);

    if (token === null) {
      throw new UnauthorizedException(
        'Header Authorization ausente ou fora do formato "Bearer <token>"',
      );
    }

    // Pode lancar 401 (token ruim) ou 503 (Auth fora do ar).
    request.usuario = await this.authClient.validateToken(token);

    return true;
  }
}

export function extrairBearerToken(
  authorizationHeader: string | undefined,
): string | null {
  if (typeof authorizationHeader !== 'string') {
    return null;
  }

  const [esquema, ...resto] = authorizationHeader.trim().split(/\s+/);

  if (esquema?.toLowerCase() !== 'bearer' || resto.length !== 1) {
    return null;
  }

  const token = resto[0];
  return token !== undefined && token.length > 0 ? token : null;
}
