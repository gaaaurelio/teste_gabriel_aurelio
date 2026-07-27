import { Injectable, Logger, OnApplicationBootstrap } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcryptjs';
import { PrismaService } from '../prisma/prisma.service';

interface SeedUser {
  email: string;
  name: string;
  password: string;
}

const SEED_USERS: readonly SeedUser[] = [
  { email: 'admin@ramper.com', name: 'Admin Ramper', password: 'ramper123' },
  {
    email: 'analista@ramper.com',
    name: 'Analista de Contratos',
    password: 'ramper123',
  },
] as const;

const BCRYPT_ROUNDS = 10;

/**
 * O enunciado pede um seed simples, sem fluxo de cadastro. Rodar no bootstrap
 * da aplicacao (em vez de um script separado com ts-node) mantem a imagem de
 * producao enxuta e garante que os usuarios existem no momento em que o
 * container fica pronto para receber requests.
 *
 * O upsert torna a operacao idempotente: subir o container dez vezes nao
 * duplica usuario nem sobrescreve senha ja existente.
 */
@Injectable()
export class UsersSeedService implements OnApplicationBootstrap {
  private readonly logger = new Logger(UsersSeedService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {}

  async onApplicationBootstrap(): Promise<void> {
    if (this.config.get<boolean>('SEED_ON_BOOT') !== true) {
      this.logger.log('SEED_ON_BOOT desligado, seed ignorado');
      return;
    }

    for (const user of SEED_USERS) {
      const passwordHash = await bcrypt.hash(user.password, BCRYPT_ROUNDS);

      await this.prisma.user.upsert({
        where: { email: user.email },
        update: {},
        create: {
          email: user.email,
          name: user.name,
          passwordHash,
        },
      });
    }

    const total = await this.prisma.user.count();
    this.logger.log(`Seed concluido. Usuarios no banco: ${total}`);
  }
}
