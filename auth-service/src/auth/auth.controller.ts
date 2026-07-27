import { Body, Controller, HttpCode, Post, UseGuards } from '@nestjs/common';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { ValidateTokenDto } from './dto/validate-token.dto';
import { InternalApiKeyGuard } from './guards/internal-api-key.guard';
import type { LoginResponse, ValidateTokenResponse } from './auth.types';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  /** Chamado diretamente pelo navegador. Publico por natureza. */
  @Post('login')
  @HttpCode(200)
  login(@Body() dto: LoginDto): Promise<LoginResponse> {
    return this.authService.login(dto);
  }

  /**
   * Chamado apenas pelo Main API (server-to-server). Exige a API key interna,
   * que e uma credencial do servico e nao do usuario.
   */
  @Post('validate')
  @HttpCode(200)
  @UseGuards(InternalApiKeyGuard)
  validate(@Body() dto: ValidateTokenDto): Promise<ValidateTokenResponse> {
    return this.authService.validateToken(dto.token);
  }
}
