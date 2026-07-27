import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AuthModule } from './auth/auth.module';
import { validateMainApiEnv } from './config/env.validation';
import { ContratacoesModule } from './contratacoes/contratacoes.module';
import { HealthController } from './health/health.controller';
import { PrismaModule } from './prisma/prisma.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      validate: validateMainApiEnv,
    }),
    PrismaModule,
    AuthModule,
    ContratacoesModule,
  ],
  controllers: [HealthController],
})
export class AppModule {}
