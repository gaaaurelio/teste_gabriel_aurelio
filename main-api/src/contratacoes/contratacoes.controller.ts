import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { S2SAuthGuard } from '../auth/s2s-auth.guard';
import { UsuarioAtual } from '../auth/usuario-atual.decorator';
import type { AuthenticatedUser } from '../auth/auth.types';
import { AtrasoArtificialInterceptor } from './atraso-artificial.interceptor';
import { ContratacoesService, type Contratacao } from './contratacoes.service';
import { CreateContratacaoDto } from './dto/create-contratacao.dto';
import { ListContratacoesQuery } from './dto/list-contratacoes.query';
import { UpdateContratacaoDto } from './dto/update-contratacao.dto';
import { UpdateStatusDto } from './dto/update-status.dto';

/**
 * Todas as rotas exigem autenticacao. O guard aplicado no controller inteiro
 * evita o risco de criar uma rota nova e esquecer de proteger.
 */
@Controller('contratacoes')
@UseGuards(S2SAuthGuard)
export class ContratacoesController {
  constructor(private readonly contratacoes: ContratacoesService) {}

  @Post()
  create(
    @Body() dto: CreateContratacaoDto,
    @UsuarioAtual() usuario: AuthenticatedUser,
  ): Promise<Contratacao> {
    return this.contratacoes.create(dto, usuario.id);
  }

  @Get()
  findAll(@Query() query: ListContratacoesQuery): Promise<Contratacao[]> {
    return this.contratacoes.findAll(query.status);
  }

  @Get(':id')
  findOne(
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<Contratacao> {
    return this.contratacoes.findOne(id);
  }

  @Patch(':id')
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateContratacaoDto,
  ): Promise<Contratacao> {
    return this.contratacoes.update(id, dto);
  }

  /**
   * Endpoint com o atraso artificial de 1,5s exigido pelo enunciado. E o que
   * torna visivel a atualizacao otimista da interface.
   */
  @Patch(':id/status')
  @UseInterceptors(AtrasoArtificialInterceptor)
  updateStatus(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateStatusDto,
  ): Promise<Contratacao> {
    return this.contratacoes.updateStatus(id, dto.status);
  }

  @Delete(':id')
  @HttpCode(204)
  remove(@Param('id', ParseUUIDPipe) id: string): Promise<void> {
    return this.contratacoes.remove(id);
  }
}
