import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AuthModule } from './auth/auth.module';
import { validateAuthEnv } from './config/env.validation';
import { HealthController } from './health/health.controller';
import { PrismaModule } from './prisma/prisma.module';
import { UsersSeedService } from './users/users-seed.service';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      // Falha no boot se faltar variavel, em vez de estourar no primeiro request.
      validate: validateAuthEnv,
    }),
    PrismaModule,
    AuthModule,
  ],
  controllers: [HealthController],
  providers: [UsersSeedService],
})
export class AppModule {}
