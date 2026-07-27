import { useCallback, useState } from 'react';
import {
  useMutation,
  useQuery,
  useQueryClient,
  type QueryKey,
} from '@tanstack/react-query';
import { ApiError } from '../api/http';
import {
  atualizarStatus,
  criarContratacao,
  excluirContratacao,
  listarContratacoes,
} from '../api/contratacoes-api';
import { useTokenObrigatorio } from '../auth/contexto-auth';
import {
  STATUSES,
  type Contratacao,
  type FiltroStatus,
  type NovaContratacao,
  type Status,
} from './tipos';

const RAIZ_CONTRATACOES = 'contratacoes';
const CHAVE_MUTACAO_STATUS = ['contratacao', 'status'] as const;

function chaveLista(filtro: FiltroStatus): QueryKey {
  return [RAIZ_CONTRATACOES, { status: filtro }];
}

/**
 * Le de volta o filtro que estava embutido na chave do cache. Necessario porque
 * a atualizacao otimista precisa saber, para cada lista em cache, se o item
 * continua pertencendo aquela lista depois da mudanca de status.
 */
function lerFiltroDaChave(chave: QueryKey): FiltroStatus {
  const segundo = chave[1];

  if (typeof segundo !== 'object' || segundo === null) {
    return null;
  }

  const { status } = segundo as { status?: unknown };

  return typeof status === 'string' &&
    (STATUSES as readonly string[]).includes(status)
    ? (status as Status)
    : null;
}

export function useContratacoes(filtro: FiltroStatus) {
  const token = useTokenObrigatorio();

  return useQuery({
    queryKey: chaveLista(filtro),
    // O `signal` vem do React Query. Se o filtro muda antes da resposta chegar,
    // ele aborta a requisicao anterior -- e o que evita que uma resposta antiga
    // e lenta sobrescreva a lista do filtro novo.
    queryFn: ({ signal }) => listarContratacoes(token, filtro, signal),
    // Nao insistir em erro de autenticacao: repetir com o mesmo token expirado
    // so atrasaria o redirecionamento para o login.
    retry: (tentativas, erro) =>
      !(erro instanceof ApiError && erro.ehNaoAutorizado) && tentativas < 2,
    staleTime: 10_000,
  });
}

interface VariaveisStatus {
  id: string;
  status: Status;
}

/** Listas em cache salvas antes da mudanca otimista, para poder desfazer. */
interface ContextoRollback {
  snapshot: ReadonlyArray<readonly [QueryKey, Contratacao[] | undefined]>;
}

interface OpcoesAtualizarStatus {
  onErro: (mensagem: string) => void;
}

/**
 * Atualizacao otimista da mudanca de status.
 *
 * O endpoint tem 1,5s de atraso artificial. Sem otimismo, a interface ficaria
 * um segundo e meio sem reagir ao clique. A ideia e escrever o novo estado no
 * cache imediatamente e tratar a resposta do servidor como confirmacao -- ou,
 * se der erro, como ordem de desfazer.
 */
export function useAtualizarStatus({ onErro }: OpcoesAtualizarStatus) {
  const token = useTokenObrigatorio();
  const queryClient = useQueryClient();

  /**
   * Ids com mutacao em andamento. Alimenta a trava de interface: a linha inteira
   * fica desabilitada enquanto o servidor nao confirma.
   */
  const [idsEmAndamento, setIdsEmAndamento] = useState<ReadonlySet<string>>(
    () => new Set<string>(),
  );

  const mutacao = useMutation<
    Contratacao,
    Error,
    VariaveisStatus,
    ContextoRollback
  >({
    mutationKey: CHAVE_MUTACAO_STATUS,
    mutationFn: ({ id, status }) => atualizarStatus(token, id, status),

    onMutate: async ({ id, status }) => {
      setIdsEmAndamento((atual) => new Set(atual).add(id));

      /**
       * Passo que a maioria das implementacoes esquece. Se existe um refetch da
       * lista em voo, ele vai chegar depois com dados anteriores a esta mudanca
       * e apagar o valor otimista que acabamos de escrever. Cancelar primeiro
       * elimina essa corrida.
       */
      await queryClient.cancelQueries({ queryKey: [RAIZ_CONTRATACOES] });

      const snapshot = queryClient.getQueriesData<Contratacao[]>({
        queryKey: [RAIZ_CONTRATACOES],
      });

      for (const [chave, lista] of snapshot) {
        if (lista === undefined) {
          continue;
        }

        const filtro = lerFiltroDaChave(chave);

        const atualizada = lista
          .map((item) => (item.id === id ? { ...item, status } : item))
          // Se a lista esta filtrada e o item deixou de casar com o filtro, ele
          // sai da tela na hora, sem esperar o refetch.
          .filter((item) => filtro === null || item.status === filtro);

        queryClient.setQueryData<Contratacao[]>(chave, atualizada);
      }

      return { snapshot };
    },

    onError: (erro, _variaveis, contexto) => {
      // Rollback: devolve cada lista exatamente como estava antes do clique.
      if (contexto !== undefined) {
        for (const [chave, lista] of contexto.snapshot) {
          queryClient.setQueryData(chave, lista);
        }
      }

      onErro(mensagemDeErro(erro));
    },

    onSettled: (_dados, _erro, { id }) => {
      setIdsEmAndamento((atual) => {
        const proximo = new Set(atual);
        proximo.delete(id);
        return proximo;
      });

      /**
       * Revalida contra o servidor -- mas so quando esta e a ultima mutacao em
       * andamento. Invalidar durante outra mutacao dispararia um refetch que
       * traria o estado antigo do item ainda nao confirmado.
       */
      if (queryClient.isMutating({ mutationKey: CHAVE_MUTACAO_STATUS }) <= 1) {
        void queryClient.invalidateQueries({ queryKey: [RAIZ_CONTRATACOES] });
      }
    },
  });

  const atualizar = useCallback(
    (contratacao: Contratacao, novoStatus: Status) => {
      /**
       * Segunda camada de protecao contra clique duplo. A primeira e visual (a
       * linha fica desabilitada), mas ela depende do React ter re-renderizado.
       * Dois cliques em milissegundos podem passar antes disso, e aqui o segundo
       * e simplesmente descartado.
       */
      if (idsEmAndamento.has(contratacao.id)) {
        return;
      }

      if (contratacao.status === novoStatus) {
        return;
      }

      mutacao.mutate({ id: contratacao.id, status: novoStatus });
    },
    [idsEmAndamento, mutacao],
  );

  return { atualizar, idsEmAndamento };
}

interface OpcoesCriar {
  onSucesso: () => void;
  onErro: (mensagem: string) => void;
}

export function useCriarContratacao({ onSucesso, onErro }: OpcoesCriar) {
  const token = useTokenObrigatorio();
  const queryClient = useQueryClient();

  return useMutation<Contratacao, Error, NovaContratacao>({
    mutationFn: (dados) => criarContratacao(token, dados),
    onSuccess: () => {
      // Criacao nao e otimista: o id e a data de criacao sao decididos pelo
      // servidor, e inventar valores provisorios so para desfazer em seguida
      // traria complexidade sem ganho perceptivel de resposta.
      void queryClient.invalidateQueries({ queryKey: [RAIZ_CONTRATACOES] });
      onSucesso();
    },
    onError: (erro) => onErro(mensagemDeErro(erro)),
  });
}

interface OpcoesExcluir {
  onErro: (mensagem: string) => void;
}

export function useExcluirContratacao({ onErro }: OpcoesExcluir) {
  const token = useTokenObrigatorio();
  const queryClient = useQueryClient();

  return useMutation<void, Error, string>({
    mutationFn: (id) => excluirContratacao(token, id),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: [RAIZ_CONTRATACOES] });
    },
    onError: (erro) => onErro(mensagemDeErro(erro)),
  });
}

function mensagemDeErro(erro: Error): string {
  if (erro instanceof ApiError && erro.ehServicoIndisponivel) {
    return `${erro.message} (o servico de autenticacao pode estar fora do ar)`;
  }

  return erro.message;
}
