import {
  createParamDecorator,
  ExecutionContext,
  InternalServerErrorException,
} from '@nestjs/common';
import type { AuthenticatedUser } from './auth.types';
import type { RequestComUsuario } from './s2s-auth.guard';

/**
 * Le o usuario que o S2SAuthGuard anexou ao request, evitando espalhar
 * `request.usuario` (que e opcional e portanto exigiria checagem de undefined)
 * pelos controllers.
 */
export const UsuarioAtual = createParamDecorator(
  (_data: unknown, context: ExecutionContext): AuthenticatedUser => {
    const request = context.switchToHttp().getRequest<RequestComUsuario>();

    if (request.usuario === undefined) {
      // Chegar aqui significa que a rota usa @UsuarioAtual() sem o guard.
      // E um erro de programacao, nao um erro do cliente.
      throw new InternalServerErrorException(
        'Rota usa @UsuarioAtual() sem aplicar o S2SAuthGuard',
      );
    }

    return request.usuario;
  },
);
