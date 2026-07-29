import { useState } from 'react';
import { useDashboard, type FiltroDataDashboard } from '../hooks/use-dashboard';
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

const CORES_PRODUTO = ['#00c9a7', '#f97316', '#8b5cf6', '#3b82f6'] as const;

// ── Velocímetro SVG (sem dependência externa) ────────────────────────────────

interface GaugeProps {
  valor: number;
  meta: number;
}

function GaugeVelocimetro({ valor, meta }: GaugeProps) {
  const pct = meta > 0 ? Math.min(valor / meta, 1) : 0;
  const r = 75;
  // Comprimento de meia circunferência = π × r
  const halfCirc = Math.PI * r; // ≈ 235.6
  const filled = halfCirc * pct;

  const cor = pct >= 1 ? '#22c55e' : pct >= 0.5 ? '#eab308' : '#ef4444';
  const pctTexto = `${Math.round(pct * 100)}%`;

  return (
    <div className="gauge">
      {/*
        O truque: stroke-dasharray numa circunferência completa.
        rotate(180) reposiciona o início para as 9h, e o arco preenchido
        vai em sentido horário passando pelo topo (12h) até as 3h.
        stroke-dasharray="halfCirc totalCirc" exibe exatamente a metade superior.
      */}
      <svg
        viewBox="0 8 200 107"
        aria-label={`${valor} de ${meta} aprovações – ${pctTexto}`}
        role="img"
      >
        {/* Trilha de fundo */}
        <circle
          cx="100"
          cy="100"
          r={r}
          fill="none"
          stroke="#1e2442"
          strokeWidth="14"
          strokeDasharray={`${halfCirc} ${halfCirc * 2}`}
          strokeLinecap="round"
          transform="rotate(180 100 100)"
        />
        {/* Preenchimento proporcional à meta */}
        <circle
          cx="100"
          cy="100"
          r={r}
          fill="none"
          stroke={cor}
          strokeWidth="14"
          strokeDasharray={`${filled} ${halfCirc * 2}`}
          strokeLinecap="round"
          transform="rotate(180 100 100)"
          style={{ transition: 'stroke-dasharray 600ms ease, stroke 300ms ease' }}
        />
        {/* Valor central */}
        <text
          x="100"
          y="84"
          textAnchor="middle"
          fill="#f0f2ff"
          fontSize={34}
          fontWeight={700}
          fontFamily="Inter, system-ui, sans-serif"
        >
          {valor}
        </text>
        <text
          x="100"
          y="100"
          textAnchor="middle"
          fill="#8b92b8"
          fontSize={12}
          fontFamily="Inter, system-ui, sans-serif"
        >
          de {meta} meta
        </text>
      </svg>
      <p className="gauge__pct" style={{ color: cor }}>
        {pctTexto}
        {pct >= 1 && <span className="gauge__badge"> ✓ Meta atingida</span>}
      </p>
    </div>
  );
}

// ── Página ───────────────────────────────────────────────────────────────────

export function DashboardPage() {
  const [filtroData, setFiltroData] = useState<FiltroDataDashboard>({ de: '', ate: '' });
  const [metaMensal, setMetaMensal] = useState(10);

  const { dados, isPending, isError } = useDashboard(filtroData);

  const temFiltro = filtroData.de !== '' || filtroData.ate !== '';

  function handleMeta(e: React.ChangeEvent<HTMLInputElement>) {
    const v = parseInt(e.target.value, 10);
    if (!isNaN(v) && v > 0) setMetaMensal(v);
  }

  return (
    <div className="pagina">
      <header className="topo">
        <div>
          <span className="marca">Ramper</span>
          <h1>Dashboard</h1>
        </div>

        <div className="filtro-data">
          <label className="filtro-data__label">
            <span>De</span>
            <input
              type="date"
              value={filtroData.de}
              onChange={(e) => setFiltroData((f) => ({ ...f, de: e.target.value }))}
            />
          </label>
          <label className="filtro-data__label">
            <span>Até</span>
            <input
              type="date"
              value={filtroData.ate}
              onChange={(e) => setFiltroData((f) => ({ ...f, ate: e.target.value }))}
            />
          </label>
          {temFiltro && (
            <button
              className="botao botao--pequeno"
              onClick={() => setFiltroData({ de: '', ate: '' })}
            >
              Limpar
            </button>
          )}
        </div>
      </header>

      {isPending && <p className="texto-secundario">Carregando...</p>}
      {isError && (
        <p className="mensagem-erro" role="alert">
          Não foi possível carregar os dados.
        </p>
      )}

      {dados !== undefined && (
        <>
          {/* ── KPIs ─────────────────────────────────────────────────── */}
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

          {/* ── Velocímetro + Distribuição por Status ─────────────────── */}
          <div className="dashboard-grid-2">
            <section className="cartao">
              <div className="gauge__config">
                <h2>Meta de Aprovações</h2>
                <label className="gauge__config-meta">
                  <span>Meta mensal</span>
                  <input
                    type="number"
                    min="1"
                    max="9999"
                    value={metaMensal}
                    onChange={handleMeta}
                    className="gauge__config-input"
                  />
                </label>
              </div>
              <GaugeVelocimetro valor={dados.aprovados} meta={metaMensal} />
              {temFiltro && (
                <p className="gauge__periodo">
                  Aprovações no período selecionado
                </p>
              )}
            </section>

            <section className="cartao">
              <h2 style={{ marginBottom: '1.25rem' }}>Distribuição por Status</h2>
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
          </div>

          {/* ── Distribuição por Produto ──────────────────────────────── */}
          <section className="cartao">
            <h2 style={{ marginBottom: '1.25rem' }}>Distribuição por Produto</h2>
            <div className="distribuicao">
              {dados.porProduto.map(({ produto, count, percentual }, i) => {
                const cor = CORES_PRODUTO[i % CORES_PRODUTO.length] ?? '#00c9a7';
                return (
                  <div key={produto} className="distribuicao__item">
                    <div className="distribuicao__linha">
                      <span style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <span
                          style={{
                            display: 'inline-block',
                            width: 10,
                            height: 10,
                            borderRadius: '50%',
                            background: cor,
                            flexShrink: 0,
                          }}
                        />
                        {produto}
                      </span>
                      <span className="distribuicao__pct">
                        {count} ({percentual}%)
                      </span>
                    </div>
                    <div className="distribuicao__barra-fundo">
                      <div
                        className="distribuicao__barra-fill"
                        style={{ width: `${percentual}%`, background: cor }}
                        role="progressbar"
                        aria-valuenow={percentual}
                        aria-valuemin={0}
                        aria-valuemax={100}
                        aria-label={`${produto}: ${percentual}%`}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        </>
      )}
    </div>
  );
}
