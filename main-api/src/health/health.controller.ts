import { Controller, Get } from '@nestjs/common';

interface HealthResponse {
  status: 'ok';
  service: 'main-api';
  timestamp: string;
}

/**
 * Fora do guard de autenticacao de proposito: um healthcheck que depende do
 * Auth Service estar no ar reportaria o Main API como morto sempre que o Auth
 * caisse, escondendo qual dos dois e o servico com problema.
 */
@Controller('health')
export class HealthController {
  @Get()
  check(): HealthResponse {
    return {
      status: 'ok',
      service: 'main-api',
      timestamp: new Date().toISOString(),
    };
  }
}
