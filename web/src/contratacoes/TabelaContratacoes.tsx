import { STATUSES, type Contratacao, type Status } from './tipos';

interface Props {
  contratacoes: readonly Contratacao[];
  idsEmAndamento: ReadonlySet<string>;
  onMudarStatus: (contratacao: Contratacao, status: Status) => void;
  onExcluir: (contratacao: Contratacao) => void;
}

const CLASSE_POR_STATUS: Record<Status, string> = {
  solicitado: 'etiqueta--solicitado',
  'em análise': 'etiqueta--analise',
  aprovado: 'etiqueta--aprovado',
  recusado: 'etiqueta--recusado',
};

export function TabelaContratacoes({
  contratacoes,
  idsEmAndamento,
  onMudarStatus,
  onExcluir,
}: Props) {
  if (contratacoes.length === 0) {
    return (
      <p className="vazio texto-secundario">
        Nenhuma contratação para o filtro selecionado.
      </p>
    );
  }

  return (
    <div className="tabela-wrapper">
      <table className="tabela">
        <thead>
          <tr>
            <th>Cliente</th>
            <th>Produto</th>
            <th>Status</th>
            <th>Mudar para</th>
            <th aria-label="Ações" />
          </tr>
        </thead>
        <tbody>
          {contratacoes.map((contratacao) => {
            const travada = idsEmAndamento.has(contratacao.id);

            return (
              <tr
                key={contratacao.id}
                className={travada ? 'linha linha--salvando' : 'linha'}
              >
                <td>
                  <strong>{contratacao.nomeCliente}</strong>
                  <span className="texto-secundario bloco">
                    {contratacao.email}
                  </span>
                </td>

                <td>{contratacao.produto}</td>

                <td>
                  <span
                    className={`etiqueta ${CLASSE_POR_STATUS[contratacao.status]}`}
                  >
                    {contratacao.status}
                  </span>
                  {travada && (
                    <span className="salvando">salvando...</span>
                  )}
                </td>

                <td>
                  <div className="acoes-status">
                    <select
                      value={contratacao.status}
                      disabled={travada}
                      onChange={(evento) =>
                        onMudarStatus(contratacao, evento.target.value as Status)
                      }
                      aria-label={`Status de ${contratacao.nomeCliente}`}
                    >
                      {STATUSES.map((status) => (
                        <option key={status} value={status}>
                          {status}
                        </option>
                      ))}
                    </select>

                    <button
                      type="button"
                      className="botao botao--pequeno"
                      disabled={travada}
                      onClick={() => onMudarStatus(contratacao, 'aprovado')}
                    >
                      Aprovar
                    </button>
                    <button
                      type="button"
                      className="botao botao--pequeno"
                      disabled={travada}
                      onClick={() => onMudarStatus(contratacao, 'recusado')}
                    >
                      Recusar
                    </button>
                  </div>
                </td>

                <td>
                  <button
                    type="button"
                    className="botao botao--perigo botao--pequeno"
                    disabled={travada}
                    onClick={() => onExcluir(contratacao)}
                  >
                    Excluir
                  </button>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
