import {
  Injectable,
  Logger,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  isValidateTokenResponseBody,
  type AuthenticatedUser,
} from './auth.types';

export const INTERNAL_API_KEY_HEADER = 'x-internal-api-key';

/**
 * Unico ponto do Main API que conversa com o Auth Service.
 *
 * Decisao central da arquitetura: este servico NAO tem o segredo do JWT e nao
 * importa nenhuma biblioteca de JWT. Ele nao sabe validar um token; ele sabe
 * *perguntar* se um token e valido. Isso mantem a autoridade sobre sessao
 * concentrada em um servico so -- se amanha o Auth passar a revogar tokens ou
 * trocar o algoritmo de assinatura, o Main API nao muda uma linha.
 *
 * O preco e uma chamada de rede por request e um ponto de falha adicional, o
 * que e exatamente por que existe timeout e tratamento de indisponibilidade
 * aqui.
 */
@Injectable()
export class AuthClientService {
  private readonly logger = new Logger(AuthClientService.name);
  private readonly baseUrl: string;
  private readonly internalApiKey: string;
  private readonly timeoutMs: number;

  constructor(config: ConfigService) {
    this.baseUrl = config.getOrThrow<string>('AUTH_SERVICE_URL');
    this.internalApiKey = config.getOrThrow<string>('INTERNAL_API_KEY');
    this.timeoutMs = config.getOrThrow<number>('AUTH_VALIDATE_TIMEOUT_MS');
  }

  async validateToken(token: string): Promise<AuthenticatedUser> {
    const response = await this.postValidate(token);

    // 401 vindo do Auth significa "token ruim", e nao "servico com problema":
    // e um erro do cliente e deve chegar ao navegador como 401.
    if (response.status === 401) {
      throw new UnauthorizedException(
        await this.extrairMensagem(response, 'Token invalido ou expirado'),
      );
    }

    // Qualquer outro status inesperado (500 do Auth, 404 de rota errada, 401
    // por API key interna errada) e um defeito de infraestrutura nosso, nao do
    // usuario. Nao faz sentido devolver 500 generico: o request falhou porque
    // uma dependencia nao esta operacional.
    if (!response.ok) {
      this.logger.error(
        `Auth Service respondeu ${response.status} em POST /auth/validate`,
      );
      throw new ServiceUnavailableException(
        'Servico de autenticacao respondeu de forma inesperada. Tente novamente em instantes.',
      );
    }

    const body: unknown = await response.json().catch(() => null);
    if (!isValidateTokenResponseBody(body)) {
      this.logger.error(
        'Auth Service respondeu 200 com corpo em formato inesperado',
      );
      throw new ServiceUnavailableException(
        'Resposta invalida do servico de autenticacao.',
      );
    }

    return {
      id: body.payload.sub,
      email: body.payload.email,
      name: body.payload.name,
    };
  }

  private async postValidate(token: string): Promise<Response> {
    try {
      return await fetch(`${this.baseUrl}/auth/validate`, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          // Credencial do SERVICO, distinta do JWT do usuario que vai no corpo.
          [INTERNAL_API_KEY_HEADER]: this.internalApiKey,
        },
        body: JSON.stringify({ token }),
        /**
         * Sem isso, um Auth Service que aceita a conexao TCP mas nunca responde
         * deixaria o request pendurado ate o timeout do cliente HTTP. Com
         * varios requests nessa situacao, o Main API esgota o event loop e cai
         * junto -- a falha de um servico viraria a falha de dois.
         */
        signal: AbortSignal.timeout(this.timeoutMs),
      });
    } catch (error) {
      this.logger.error(
        `Falha ao contatar o Auth Service: ${this.descreverFalha(error)}`,
      );
      throw new ServiceUnavailableException(
        'Servico de autenticacao indisponivel. Tente novamente em instantes.',
      );
    }
  }

  private descreverFalha(error: unknown): string {
    if (error instanceof Error) {
      // AbortSignal.timeout rejeita com um DOMException de nome TimeoutError.
      if (error.name === 'TimeoutError' || error.name === 'AbortError') {
        return `nao respondeu em ${this.timeoutMs}ms (timeout)`;
      }
      return `${error.name}: ${error.message}`;
    }
    return 'erro desconhecido';
  }

  private async extrairMensagem(
    response: Response,
    fallback: string,
  ): Promise<string> {
    const body: unknown = await response.json().catch(() => null);

    if (typeof body === 'object' && body !== null) {
      const { message } = body as { message?: unknown };
      if (typeof message === 'string' && message.length > 0) {
        return message;
      }
    }

    return fallback;
  }
}
