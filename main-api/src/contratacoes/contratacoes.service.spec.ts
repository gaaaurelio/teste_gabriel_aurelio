import { ConflictException, NotFoundException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { PrismaService } from '../prisma/prisma.service';
import { ContratacoesService } from './contratacoes.service';
import type { ContratacaoStatus } from './contratacao-status';

/**
 * O service e testado com o Prisma substituido por um dublê. A regra de
 * transicao e logica de dominio: nao precisa de banco para ser verificada, e
 * um teste que precisasse de Postgres no ar seria lento e frageil no CI.
 */
interface PrismaMock {
  contratacao: {
    findUnique: jest.Mock;
    updateMany: jest.Mock;
  };
}

const ID = '3f4b1c4e-9a2d-4c7b-8f1e-2d5a6b7c8d9e';

function linha(status: ContratacaoStatus) {
  return {
    id: ID,
    nomeCliente: 'Cliente Exemplo',
    email: 'cliente@exemplo.com',
    produto: 'Plano Pro',
    status,
    criadoPorId: 'usuario-1',
    criadoEm: new Date('2026-07-27T10:00:00.000Z'),
    atualizadoEm: new Date('2026-07-27T10:00:00.000Z'),
  };
}

describe('ContratacoesService.updateStatus', () => {
  let service: ContratacoesService;
  let prisma: PrismaMock;

  beforeEach(async () => {
    prisma = {
      contratacao: {
        findUnique: jest.fn(),
        updateMany: jest.fn(),
      },
    };

    const moduleRef = await Test.createTestingModule({
      providers: [
        ContratacoesService,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();

    service = moduleRef.get(ContratacoesService);
  });

  describe('regra de negocio: recusado nao pode ir direto para aprovado', () => {
    it('recusa a transicao com 409 e mensagem explicando o motivo', async () => {
      prisma.contratacao.findUnique.mockResolvedValue(linha('recusado'));

      const promessa = service.updateStatus(ID, 'aprovado');

      await expect(promessa).rejects.toBeInstanceOf(ConflictException);
      await expect(promessa).rejects.toThrow(
        /nao pode ir direto para "aprovado"/,
      );
    });

    it('nao escreve no banco quando a transicao e bloqueada', async () => {
      prisma.contratacao.findUnique.mockResolvedValue(linha('recusado'));

      await expect(service.updateStatus(ID, 'aprovado')).rejects.toThrow();

      expect(prisma.contratacao.updateMany).not.toHaveBeenCalled();
    });

    it('permite recusado -> em análise, porque o bloqueio e so para aprovado', async () => {
      prisma.contratacao.findUnique
        .mockResolvedValueOnce(linha('recusado'))
        .mockResolvedValueOnce(linha('em análise'));
      prisma.contratacao.updateMany.mockResolvedValue({ count: 1 });

      const resultado = await service.updateStatus(ID, 'em análise');

      expect(resultado.status).toBe('em análise');
    });

    it('permite aprovar quando o status atual nao e recusado', async () => {
      prisma.contratacao.findUnique
        .mockResolvedValueOnce(linha('em análise'))
        .mockResolvedValueOnce(linha('aprovado'));
      prisma.contratacao.updateMany.mockResolvedValue({ count: 1 });

      const resultado = await service.updateStatus(ID, 'aprovado');

      expect(resultado.status).toBe('aprovado');
      expect(prisma.contratacao.updateMany).toHaveBeenCalledWith({
        where: { id: ID, status: 'em análise' },
        data: { status: 'aprovado' },
      });
    });
  });

  describe('protecao contra requests concorrentes', () => {
    it('trata repeticao do mesmo status como sucesso sem escrita', async () => {
      prisma.contratacao.findUnique.mockResolvedValue(linha('aprovado'));

      const resultado = await service.updateStatus(ID, 'aprovado');

      expect(resultado.status).toBe('aprovado');
      expect(prisma.contratacao.updateMany).not.toHaveBeenCalled();
    });

    it('devolve 409 quando outro request mudou o status no meio do caminho', async () => {
      prisma.contratacao.findUnique.mockResolvedValue(linha('solicitado'));
      // O update condicionado ao status lido nao encontrou a linha: alguem
      // alterou o registro entre o SELECT e o UPDATE.
      prisma.contratacao.updateMany.mockResolvedValue({ count: 0 });

      const promessa = service.updateStatus(ID, 'aprovado');

      await expect(promessa).rejects.toBeInstanceOf(ConflictException);
      await expect(promessa).rejects.toThrow(/alterada por outra operacao/);
    });
  });

  it('devolve 404 quando a contratacao nao existe', async () => {
    prisma.contratacao.findUnique.mockResolvedValue(null);

    await expect(service.updateStatus(ID, 'aprovado')).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });
});
