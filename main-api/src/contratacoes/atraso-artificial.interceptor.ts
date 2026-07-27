import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { delay, dematerialize, materialize, type Observable } from 'rxjs';

/**
 * Atraso artificial no endpoint de mudanca de status, exigido pelo enunciado.
 *
 * Ficar num interceptor, e nao dentro do service, tem duas consequencias boas:
 * a regra de negocio continua testavel sem esperar 1,5s, e o atraso acontece
 * *depois* que o banco ja respondeu -- nenhuma conexao ou transacao fica presa
 * durante a espera.
 *
 * `materialize`/`dematerialize` transformam a notificacao do Observable
 * (inclusive um erro) em valor comum, para que o `delay` se aplique tambem
 * quando o handler lanca excecao. Sem isso, um 409 de transicao invalida
 * voltaria instantaneamente e o rollback do frontend nem seria visivel.
 */
@Injectable()
export class AtrasoArtificialInterceptor implements NestInterceptor {
  constructor(private readonly config: ConfigService) {}

  intercept(_context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const atrasoMs = this.config.getOrThrow<number>('STATUS_UPDATE_DELAY_MS');

    return next
      .handle()
      .pipe(materialize(), delay(atrasoMs), dematerialize()) as Observable<unknown>;
  }
}
