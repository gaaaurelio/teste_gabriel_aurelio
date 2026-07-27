import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { JwtModule, type JwtSignOptions } from '@nestjs/jwt';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { InternalApiKeyGuard } from './guards/internal-api-key.guard';

@Module({
  imports: [
    /**
     * O secret vem de env var e e o *mesmo* valor configurado no Main API.
     * Isso e o que torna possivel um servico confiar no token emitido pelo
     * outro: ambos conhecem a chave usada na assinatura HMAC.
     */
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        secret: config.getOrThrow<string>('JWT_SECRET'),
        signOptions: {
          // `expiresIn` e tipado como uma uniao de literais ("1h", "7d", ...).
          // O valor vem de env var, resolvida em runtime, entao o compilador
          // nao tem como provar que a string corresponde ao formato aceito.
          expiresIn: config.getOrThrow<string>(
            'JWT_EXPIRES_IN',
          ) as JwtSignOptions['expiresIn'],
        },
      }),
    }),
  ],
  controllers: [AuthController],
  providers: [AuthService, InternalApiKeyGuard],
})
export class AuthModule {}
