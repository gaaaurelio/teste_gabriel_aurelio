import {
  ConflictException,
  Injectable,
  InternalServerErrorException,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import {
  isContratacaoStatus,
  isTransicaoBloqueada,
  mensagemTransicaoBloqueada,
  STATUS_INICIAL,
  type ContratacaoStatus,
} from './contratacao-status';
import type { CreateContratacaoDto } from './dto/create-contratacao.dto';
import type { UpdateContratacaoDto } from './dto/update-contratacao.dto';

export interface Contratacao {
  id: string;
  nomeCliente: string;
  email: string;
  produto: string;
  status: ContratacaoStatus;
  criadoPorId: string;
  criadoEm: string;
  atualizadoEm: string;
}

/** Formato cru vindo do Prisma, antes de validarmos o status. */
interface ContratacaoRow {
  id: string;
  nomeCliente: string;
  email: string;
  produto: string;
  status: string;
  criadoPorId: string;
  criadoEm: Date;
  atualizadoEm: Date;
}

@Injectable()
export class ContratacoesService {
  private readonly logger = new Logger(ContratacoesService.name);

  constructor(private readonly prisma: PrismaService) {}

  async create(
    dto: CreateContratacaoDto,
    criadoPorId: string,
  ): Promise<Contratacao> {
    const criada = await this.prisma.contratacao.create({
      data: {
        nomeCliente: dto.nomeCliente,
        email: dto.email,
        produto: dto.produto,
        // Status nao vem do cliente: toda contratacao nasce como "solicitado".
        status: STATUS_INICIAL,
        criadoPorId,
      },
    });

    this.logger.log(`Contratacao ${criada.id} criada por ${criadoPorId}`);
    return this.toContratacao(criada);
  }

  async findAll(status?: ContratacaoStatus): Promise<Contratacao[]> {
    const rows = await this.prisma.contratacao.findMany({
      // `status: undefined` faz o Prisma ignorar a clausula, entao a mesma
      // consulta serve para "com filtro" e "sem filtro".
      where: { status },
      orderBy: { criadoEm: 'desc' },
    });

    return rows.map((row) => this.toContratacao(row));
  }

  async findOne(id: string): Promise<Contratacao> {
    const row = await this.prisma.contratacao.findUnique({ where: { id } });

    if (row === null) {
      throw new NotFoundException(`Contratacao ${id} nao encontrada`);
    }

    return this.toContratacao(row);
  }

  async update(id: string, dto: UpdateContratacaoDto): Promise<Contratacao> {
    // Garante o 404 antes de tentar o update, para nao depender do codigo de
    // erro P2025 do Prisma.
    await this.findOne(id);

    const atualizada = await this.prisma.contratacao.update({
      where: { id },
      data: {
        nomeCliente: dto.nomeCliente,
        email: dto.email,
        produto: dto.produto,
      },
    });

    return this.toContratacao(atualizada);
  }

  async remove(id: string): Promise<void> {
    await this.findOne(id);
    await this.prisma.contratacao.delete({ where: { id } });
    this.logger.log(`Contratacao ${id} removida`);
  }

  /**
   * Regra de negocio do enunciado: bloquear a transicao direta
   * `recusado -> aprovado`.
   */
  async updateStatus(
    id: string,
    novoStatus: ContratacaoStatus,
  ): Promise<Contratacao> {
    const atual = await this.findOne(id);

    /**
     * Repetir o status atual e tratado como sucesso sem efeito, e nao como
     * conflito. Isso importa para o duplo clique: dois requests iguais chegando
     * quase juntos terminam os dois em 200, e a tela nao mostra erro por uma
     * operacao que, no fim, produziu exatamente o estado pedido.
     */
    if (atual.status === novoStatus) {
      return atual;
    }

    if (isTransicaoBloqueada(atual.status, novoStatus)) {
      this.logger.warn(
        `Transicao bloqueada na contratacao ${id}: ${atual.status} -> ${novoStatus}`,
      );
      // 409 e nao 400: o corpo do request esta correto, o que impede a operacao
      // e o estado atual do recurso.
      throw new ConflictException(
        mensagemTransicaoBloqueada(atual.status, novoStatus),
      );
    }

    /**
     * Update condicionado ao status que acabamos de ler (optimistic locking).
     * Entre o SELECT e o UPDATE outro request pode ter mudado o status; sem a
     * condicao, a segunda escrita sobrescreveria a primeira em silencio e
     * poderia produzir justamente o `recusado -> aprovado` que a regra proibe.
     */
    const resultado = await this.prisma.contratacao.updateMany({
      where: { id, status: atual.status },
      data: { status: novoStatus },
    });

    if (resultado.count === 0) {
      this.logger.warn(
        `Conflito de concorrencia na contratacao ${id}: status mudou durante a operacao`,
      );
      throw new ConflictException(
        'A contratacao foi alterada por outra operacao enquanto esta estava em andamento. Recarregue e tente de novo.',
      );
    }

    this.logger.log(
      `Contratacao ${id}: status ${atual.status} -> ${novoStatus}`,
    );
    return this.findOne(id);
  }

  /**
   * O status e uma coluna de texto, entao o tipo que o Prisma devolve e
   * `string`. Conferir aqui e o que garante que o resto do codigo pode confiar
   * no tipo `ContratacaoStatus`.
   */
  private toContratacao(row: ContratacaoRow): Contratacao {
    if (!isContratacaoStatus(row.status)) {
      this.logger.error(
        `Contratacao ${row.id} tem status desconhecido no banco: "${row.status}"`,
      );
      throw new InternalServerErrorException(
        'Registro com status invalido no banco de dados',
      );
    }

    return {
      id: row.id,
      nomeCliente: row.nomeCliente,
      email: row.email,
      produto: row.produto,
      status: row.status,
      criadoPorId: row.criadoPorId,
      criadoEm: row.criadoEm.toISOString(),
      atualizadoEm: row.atualizadoEm.toISOString(),
    };
  }
}
