import {
  CanActivate,
  ExecutionContext,
  Injectable,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { timingSafeEqual } from 'node:crypto';
import type { Request } from 'express';

export const INTERNAL_API_KEY_HEADER = 'x-internal-api-key';

/**
 * Protege os endpoints que sao de uso interno (server-to-server), nao do
 * usuario final. A credencial aqui identifica o *servico* chamador, e nao a
 * pessoa logada -- sao duas camadas de autenticacao diferentes e independentes.
 *
 * Sem isso, qualquer um na rede poderia chamar /auth/validate diretamente para
 * sondar tokens.
 */
@Injectable()
export class InternalApiKeyGuard implements CanActivate {
  private readonly logger = new Logger(InternalApiKeyGuard.name);

  constructor(private readonly config: ConfigService) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<Request>();
    const provided = request.headers[INTERNAL_API_KEY_HEADER];

    if (typeof provided !== 'string' || provided.length === 0) {
      this.logger.warn(
        `Chamada interna recusada: header ${INTERNAL_API_KEY_HEADER} ausente`,
      );
      throw new UnauthorizedException(
        `Header ${INTERNAL_API_KEY_HEADER} e obrigatorio para endpoints internos`,
      );
    }

    const expected = this.config.getOrThrow<string>('INTERNAL_API_KEY');
    if (!this.matches(provided, expected)) {
      this.logger.warn('Chamada interna recusada: API key invalida');
      throw new UnauthorizedException('Credencial de servico invalida');
    }

    return true;
  }

  /**
   * Comparacao em tempo constante. Um `===` normal retorna mais rapido quando
   * os primeiros caracteres diferem, o que em teoria permite descobrir a chave
   * caractere a caractere medindo o tempo de resposta.
   */
  private matches(provided: string, expected: string): boolean {
    const providedBuffer = Buffer.from(provided, 'utf8');
    const expectedBuffer = Buffer.from(expected, 'utf8');

    if (providedBuffer.length !== expectedBuffer.length) {
      return false;
    }

    return timingSafeEqual(providedBuffer, expectedBuffer);
  }
}
