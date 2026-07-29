import { useEffect, useMemo, useState } from 'react';
import { ApiError } from '../api/http';
import { useAuth } from '../auth/contexto-auth';
import { Modal } from '../components/Modal';
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
  const { sair } = useAuth();
  const { avisos, erro, sucesso, fechar } = useAvisos();

  const [filtro, setFiltro] = useState<FiltroStatus>(null);
  const [busca, setBusca] = useState('');
  const [modalAberto, setModalAberto] = useState(false);

  const lista = useContratacoes(filtro);
  const { atualizar, idsEmAndamento } = useAtualizarStatus({ onErro: erro });
  const criar = useCriarContratacao({
    onSucesso: () => {
      sucesso('Contratação criada.');
      setModalAberto(false);
    },
    onErro: erro,
  });
  const excluir = useExcluirContratacao({ onErro: erro });

  useEffect(() => {
    if (lista.error instanceof ApiError && lista.error.ehNaoAutorizado) {
      sair();
    }
  }, [lista.error, sair]);

  function aoExcluir(contratacao: Contratacao) {
    const confirmado = window.confirm(
      `Excluir a contratação de ${contratacao.nomeCliente}?`,
    );

    if (confirmado) {
      excluir.mutate(contratacao.id);
    }
  }

  const contratacoesFiltradas = useMemo(() => {
    if (!lista.data) return [];
    const termo = busca.trim().toLowerCase();
    if (!termo) return lista.data;

    return lista.data.filter(
      (c) =>
        c.nomeCliente.toLowerCase().includes(termo) ||
        c.email.toLowerCase().includes(termo) ||
        c.produto.toLowerCase().includes(termo),
    );
  }, [lista.data, busca]);

  return (
    <div className="pagina">
      <header className="topo">
        <div>
          <span className="marca">Ramper</span>
          <h1>Contratações</h1>
        </div>

        <div className="topo__acoes">
          <button
            type="button"
            className="botao botao--primario"
            onClick={() => setModalAberto(true)}
          >
            + Nova Contratação
          </button>
        </div>
      </header>

      <section className="cartao">
        <div className="lista__cabecalho">
          <div className="lista__busca">
            <svg
              className="lista__busca-icon"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth={2}
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <circle cx="11" cy="11" r="8" />
              <line x1="21" y1="21" x2="16.65" y2="16.65" />
            </svg>
            <input
              type="search"
              placeholder="Buscar por cliente, e-mail ou produto…"
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              aria-label="Buscar contratações"
            />
          </div>

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

        {lista.isError &&
          !(lista.error instanceof ApiError && lista.error.ehNaoAutorizado) && (
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
            contratacoes={contratacoesFiltradas}
            idsEmAndamento={idsEmAndamento}
            onMudarStatus={atualizar}
            onExcluir={aoExcluir}
          />
        )}
      </section>

      <Modal
        isOpen={modalAberto}
        onClose={() => setModalAberto(false)}
        title="Nova Contratação"
      >
        <FormNovaContratacao
          onEnviar={(dados) => criar.mutate(dados)}
          enviando={criar.isPending}
        />
      </Modal>

      <ListaAvisos avisos={avisos} onFechar={fechar} />
    </div>
  );
}
