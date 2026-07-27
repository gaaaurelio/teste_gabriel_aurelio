import { Logger, ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule);
  const config = app.get(ConfigService);

  app.useGlobalPipes(
    new ValidationPipe({
      // Remove campos que nao estao no DTO.
      whitelist: true,
      // E recusa o request se vierem campos desconhecidos, em vez de ignorar.
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  const corsOrigins = config
    .getOrThrow<string>('CORS_ORIGINS')
    .split(',')
    .map((origin) => origin.trim())
    .filter((origin) => origin.length > 0);

  app.enableCors({ origin: corsOrigins });

  const port = config.getOrThrow<number>('PORT');
  // 0.0.0.0 e obrigatorio dentro do container: o default do Node escuta apenas
  // no loopback e o mapeamento de porta do Docker nao alcancaria o processo.
  await app.listen(port, '0.0.0.0');

  new Logger('Bootstrap').log(`Auth Service ouvindo na porta ${port}`);
}

void bootstrap();
