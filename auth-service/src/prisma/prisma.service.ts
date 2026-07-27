import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../generated/prisma/client';

/**
 * O Prisma 7 nao embute mais a engine Rust: a traducao de query e feita em
 * WebAssembly e a conversa com o banco passa por um "driver adapter" (aqui o
 * node-postgres). Na pratica isso significa que a imagem Docker nao precisa de
 * binario nativo compativel com a libc do container.
 */
@Injectable()
export class PrismaService
  extends PrismaClient
  implements OnModuleInit, OnModuleDestroy
{
  private readonly logger = new Logger(PrismaService.name);

  constructor(config: ConfigService) {
    super({
      adapter: new PrismaPg({
        connectionString: config.getOrThrow<string>('DATABASE_URL'),
      }),
    });
  }

  async onModuleInit(): Promise<void> {
    await this.$connect();
    this.logger.log('Conectado ao Postgres do Auth Service');
  }

  async onModuleDestroy(): Promise<void> {
    await this.$disconnect();
  }
}
