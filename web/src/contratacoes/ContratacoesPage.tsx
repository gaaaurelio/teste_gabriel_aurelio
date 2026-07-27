import { useEffect, useState } from 'react';
import { ApiError } from '../api/http';
import { useAuth } from '../auth/contexto-auth';
import { ListaAvisos, useAvisos } from '../ui/avisos';
import { FormNovaContratacao } from './FormNovaContratacao';
import { TabelaContratacoes } from './TabelaContratacoes';
import {
  useAtualizarStatus,
  useContratacoes,
  useCriarContratacao,
  useExcluirContratacao,
} from './use-contratacoes';
import { STATUSES, type Contratacao, type FiltroStatus } from './tipos';

export function ContratacoesPage() {
  const { usuario, sair } = useAuth();
  const { avisos, erro, sucesso, fechar } = useAvisos();

  const [filtro, setFiltro] = useState<FiltroStatus>(null);

  const lista = useContratacoes(filtro);
  const { atualizar, idsEmAndamento } = useAtualizarStatus({ onErro: erro });
  const criar = useCriarContratacao({
    onSucesso: () => sucesso('Contratacao criada.'),
    onErro: erro,
  });
  const excluir = useExcluirContratacao({ onErro: erro });

  /**
   * Token expirado ou invalido derruba a sessao. Sem isso a tela ficaria
   * mostrando erro de 401 para sempre, sem caminho de volta ao login.
   */
  useEffect(() => {
    if (lista.error instanceof ApiError && lista.error.ehNaoAutorizado) {
      sair();
    }
  }, [lista.error, sair]);

  function aoExcluir(contratacao: Contratacao) {
    const confirmado = window.confirm(
      `Excluir a contratacao de ${contratacao.nomeCliente}?`,
    );

    if (confirmado) {
      excluir.mutate(contratacao.id);
    }
  }

  return (
    <div className="pagina">
      <header className="topo">
        <div>
          <span className="marca">Ramper</span>
          <h1>Contratacoes</h1>
        </div>

        <div className="topo__usuario">
          <span className="texto-secundario">{usuario?.name}</span>
          <button type="button" className="botao" onClick={sair}>
            Sair
          </button>
        </div>
      </header>

      <FormNovaContratacao
        onEnviar={(dados) => criar.mutate(dados)}
        enviando={criar.isPending}
      />

      <section className="cartao">
        <div className="lista__cabecalho">
          <h2>Lista de contratacoes</h2>

          <div className="filtros" role="group" aria-label="Filtrar por status">
            <button
              type="button"
              className={filtro === null ? 'chip chip--ativo' : 'chip'}
              onClick={() => setFiltro(null)}
            >
              todos
            </button>
            {STATUSES.map((status) => (
              <button
                key={status}
                type="button"
                className={filtro === status ? 'chip chip--ativo' : 'chip'}
                onClick={() => setFiltro(status)}
              >
                {status}
              </button>
            ))}
          </div>
        </div>

        {lista.isPending && <p className="texto-secundario">Carregando...</p>}

        {lista.isError && !(lista.error instanceof ApiError && lista.error.ehNaoAutorizado) && (
          <div className="mensagem-erro" role="alert">
            <p>{lista.error.message}</p>
            <button
              type="button"
              className="botao botao--pequeno"
              onClick={() => void lista.refetch()}
            >
              Tentar de novo
            </button>
          </div>
        )}

        {lista.data !== undefined && (
          <TabelaContratacoes
            contratacoes={lista.data}
            idsEmAndamento={idsEmAndamento}
            onMudarStatus={atualizar}
            onExcluir={aoExcluir}
          />
        )}
      </section>

      <ListaAvisos avisos={avisos} onFechar={fechar} />
    </div>
  );
}
