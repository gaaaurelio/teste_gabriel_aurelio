import { useMemo } from 'react';
import { useContratacoes } from '../contratacoes/use-contratacoes';
import { STATUSES, type Status } from '../contratacoes/tipos';

export interface DadosDashboard {
  total: number;
  porStatus: Record<Status, number>;
  percentuais: Record<Status, number>;
}

export function useDashboard(): {
  dados: DadosDashboard | undefined;
  isPending: boolean;
  isError: boolean;
} {
  const query = useContratacoes(null);

  const dados = useMemo<DadosDashboard | undefined>(() => {
    if (!query.data) return undefined;

    const contratacoes = query.data;
    const total = contratacoes.length;

    const porStatus = STATUSES.reduce<Record<Status, number>>(
      (acc, status) => {
        acc[status] = contratacoes.filter((c) => c.status === status).length;
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

    return { total, porStatus, percentuais };
  }, [query.data]);

  return {
    dados,
    isPending: query.isPending,
    isError: query.isError,
  };
}
