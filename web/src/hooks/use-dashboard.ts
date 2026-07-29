import { useMemo } from 'react';
import { useContratacoes } from '../contratacoes/use-contratacoes';
import { STATUSES, PRODUTOS, type Status } from '../contratacoes/tipos';

export interface FiltroDataDashboard {
  de: string;
  ate: string;
}

export interface DadosDashboard {
  total: number;
  porStatus: Record<Status, number>;
  percentuais: Record<Status, number>;
  porProduto: Array<{ produto: string; count: number; percentual: number }>;
  aprovados: number;
}

export function useDashboard(filtroData: FiltroDataDashboard): {
  dados: DadosDashboard | undefined;
  isPending: boolean;
  isError: boolean;
} {
  const query = useContratacoes(null);

  const dados = useMemo<DadosDashboard | undefined>(() => {
    if (!query.data) return undefined;

    let lista = query.data;

    if (filtroData.de) {
      const limite = new Date(filtroData.de + 'T00:00:00');
      lista = lista.filter((c) => new Date(c.criadoEm) >= limite);
    }
    if (filtroData.ate) {
      const limite = new Date(filtroData.ate + 'T23:59:59');
      lista = lista.filter((c) => new Date(c.criadoEm) <= limite);
    }

    const total = lista.length;

    const porStatus = STATUSES.reduce<Record<Status, number>>(
      (acc, status) => {
        acc[status] = lista.filter((c) => c.status === status).length;
        return acc;
      },
      {} as Record<Status, number>,
    );

    const percentuais = STATUSES.reduce<Record<Status, number>>(
      (acc, status) => {
        acc[status] = total > 0 ? Math.round((porStatus[status] / total) * 100) : 0;
        return acc;
      },
      {} as Record<Status, number>,
    );

    const contsProduto: Record<string, number> = {};
    for (const c of lista) {
      const prev = contsProduto[c.produto];
      contsProduto[c.produto] = (prev ?? 0) + 1;
    }

    const porProduto = PRODUTOS.map((produto) => {
      const count = contsProduto[produto] ?? 0;
      return {
        produto,
        count,
        percentual: total > 0 ? Math.round((count / total) * 100) : 0,
      };
    });

    return {
      total,
      porStatus,
      percentuais,
      porProduto,
      aprovados: porStatus['aprovado'],
    };
  }, [query.data, filtroData.de, filtroData.ate]);

  return {
    dados,
    isPending: query.isPending,
    isError: query.isError,
  };
}
