import { Controller, Get } from '@nestjs/common';

interface HealthResponse {
  status: 'ok';
  service: 'auth-service';
  timestamp: string;
}

/**
 * Usado pelo healthcheck do docker-compose: o Main API so e considerado
 * "pronto" depois que este endpoint responde.
 */
@Controller('health')
export class HealthController {
  @Get()
  check(): HealthResponse {
    return {
      status: 'ok',
      service: 'auth-service',
      timestamp: new Date().toISOString(),
    };
  }
}
