import { Logger, ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule);
  const config = app.get(ConfigService);

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      // Necessario para que os query params (que chegam sempre como string)
      // sejam convertidos para os tipos declarados no DTO.
      transformOptions: { enableImplicitConversion: false },
    }),
  );

  const corsOrigins = config
    .getOrThrow<string>('CORS_ORIGINS')
    .split(',')
    .map((origin) => origin.trim())
    .filter((origin) => origin.length > 0);

  app.enableCors({ origin: corsOrigins });

  const port = config.getOrThrow<number>('PORT');
  await app.listen(port, '0.0.0.0');

  new Logger('Bootstrap').log(`Main API ouvindo na porta ${port}`);
}

void bootstrap();
