import { Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcryptjs';
import { PrismaService } from '../prisma/prisma.service';
import { LoginDto } from './dto/login.dto';
import type {
  DecodedJwtUserPayload,
  JwtUserPayload,
  LoginResponse,
  ValidateTokenResponse,
} from './auth.types';

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
  ) {}

  async login({ email, password }: LoginDto): Promise<LoginResponse> {
    const user = await this.prisma.user.findUnique({
      where: { email: email.toLowerCase().trim() },
    });

    /**
     * Mesma mensagem para "usuario nao existe" e "senha errada", e o bcrypt
     * roda mesmo quando o usuario nao existe. Isso evita que a diferenca de
     * mensagem ou de tempo de resposta revele quais e-mails estao cadastrados.
     */
    const passwordHash = user?.passwordHash ?? DUMMY_HASH;
    const passwordMatches = await bcrypt.compare(password, passwordHash);

    if (!user || !passwordMatches) {
      this.logger.warn(`Login recusado para ${email}`);
      throw new UnauthorizedException('E-mail ou senha invalidos');
    }

    const payload: JwtUserPayload = {
      sub: user.id,
      email: user.email,
      name: user.name,
    };

    const accessToken = await this.jwt.signAsync(payload);
    this.logger.log(`Login efetuado por ${user.email}`);

    return {
      accessToken,
      tokenType: 'Bearer',
      user: { id: user.id, email: user.email, name: user.name },
    };
  }

  /**
   * Endpoint consumido pelo Main API a cada request autenticado. E aqui que a
   * assinatura do JWT e conferida -- o Main API deliberadamente nao faz isso
   * por conta propria.
   */
  async validateToken(token: string): Promise<ValidateTokenResponse> {
    try {
      const payload =
        await this.jwt.verifyAsync<DecodedJwtUserPayload>(token);

      return {
        valid: true,
        payload,
        expiresAt: new Date(payload.exp * 1000).toISOString(),
      };
    } catch (error) {
      const reason =
        error instanceof Error && error.name === 'TokenExpiredError'
          ? 'Token expirado'
          : 'Token invalido';

      this.logger.warn(`Validacao de token falhou: ${reason}`);
      throw new UnauthorizedException(reason);
    }
  }
}

/**
 * Hash bcrypt valido de uma senha que nao corresponde a nenhum usuario real.
 * Serve apenas para que a comparacao custe o mesmo tempo quando o e-mail
 * informado nao existe no banco.
 */
const DUMMY_HASH =
  '$2b$10$C6UzMDM.H6dfI/f/IKcEe.uMdVj2WdlqYPBc4kJHZ4rzWZ0oCPTVy';
