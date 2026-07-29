import { useDashboard } from '../hooks/use-dashboard';
import { STATUSES, type Status } from '../contratacoes/tipos';

const LABEL_STATUS: Record<Status, string> = {
  solicitado: 'Solicitadas',
  'em análise': 'Em Análise',
  aprovado: 'Aprovadas',
  recusado: 'Recusadas',
};

const CLASSE_KPI: Record<Status, string> = {
  solicitado: 'kpi--solicitado',
  'em análise': 'kpi--analise',
  aprovado: 'kpi--aprovado',
  recusado: 'kpi--recusado',
};

const CLASSE_BARRA: Record<Status, string> = {
  solicitado: 'distribuicao__barra-fill--solicitado',
  'em análise': 'distribuicao__barra-fill--analise',
  aprovado: 'distribuicao__barra-fill--aprovado',
  recusado: 'distribuicao__barra-fill--recusado',
};

export function DashboardPage() {
  const { dados, isPending, isError } = useDashboard();

  return (
    <div className="pagina">
      <header className="topo">
        <div>
          <span className="marca">Ramper</span>
          <h1>Dashboard</h1>
        </div>
        <span className="texto-secundario">Todos os períodos</span>
      </header>

      {isPending && <p className="texto-secundario">Carregando...</p>}
      {isError && (
        <p className="mensagem-erro" role="alert">
          Não foi possível carregar os dados.
        </p>
      )}

      {dados !== undefined && (
        <>
          <div className="dashboard-kpis">
            <div className="kpi kpi--total">
              <span className="kpi__numero">{dados.total}</span>
              <span className="kpi__label">Total de Contratações</span>
            </div>

            {STATUSES.map((status) => (
              <div key={status} className={`kpi ${CLASSE_KPI[status]}`}>
                <span className="kpi__numero">{dados.porStatus[status]}</span>
                <span className="kpi__label">{LABEL_STATUS[status]}</span>
              </div>
            ))}
          </div>

          <section className="cartao">
            <div style={{ marginBottom: '1.25rem' }}>
              <h2>Distribuição por Status</h2>
            </div>

            <div className="distribuicao">
              {STATUSES.map((status) => (
                <div key={status} className="distribuicao__item">
                  <div className="distribuicao__linha">
                    <span>{LABEL_STATUS[status]}</span>
                    <span className="distribuicao__pct">
                      {dados.porStatus[status]} ({dados.percentuais[status]}%)
                    </span>
                  </div>
                  <div className="distribuicao__barra-fundo">
                    <div
                      className={`distribuicao__barra-fill ${CLASSE_BARRA[status]}`}
                      style={{ width: `${dados.percentuais[status]}%` }}
                      role="progressbar"
                      aria-valuenow={dados.percentuais[status]}
                      aria-valuemin={0}
                      aria-valuemax={100}
                      aria-label={`${LABEL_STATUS[status]}: ${dados.percentuais[status]}%`}
                    />
                  </div>
                </div>
              ))}
            </div>
          </section>
        </>
      )}
    </div>
  );
}
