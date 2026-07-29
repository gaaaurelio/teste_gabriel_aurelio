import { NavLink, Outlet } from 'react-router-dom';
import { useAuth } from '../auth/contexto-auth';

function IconeContratacoes() {
  return (
    <svg
      className="sidebar__link-icon"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <polyline points="14 2 14 8 20 8" />
      <line x1="16" y1="13" x2="8" y2="13" />
      <line x1="16" y1="17" x2="8" y2="17" />
      <polyline points="10 9 9 9 8 9" />
    </svg>
  );
}

function IconeDashboard() {
  return (
    <svg
      className="sidebar__link-icon"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <rect x="3" y="13" width="4" height="8" />
      <rect x="10" y="8" width="4" height="13" />
      <rect x="17" y="3" width="4" height="18" />
    </svg>
  );
}

function IconeSair() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      style={{ width: 14, height: 14 }}
    >
      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
      <polyline points="16 17 21 12 16 7" />
      <line x1="21" y1="12" x2="9" y2="12" />
    </svg>
  );
}

export function Layout() {
  const { usuario, sair } = useAuth();

  return (
    <div className="layout">
      <aside className="sidebar">
        <a className="sidebar__logo" href="/contratacoes">
          <span className="sidebar__logo-icon">R</span>
          <span className="sidebar__logo-text">Ramper</span>
        </a>

        <nav className="sidebar__nav">
          <NavLink
            to="/contratacoes"
            className={({ isActive }) =>
              isActive ? 'sidebar__link sidebar__link--ativo' : 'sidebar__link'
            }
          >
            <IconeContratacoes />
            Contratações
          </NavLink>

          <NavLink
            to="/dashboard"
            className={({ isActive }) =>
              isActive ? 'sidebar__link sidebar__link--ativo' : 'sidebar__link'
            }
          >
            <IconeDashboard />
            Dashboard
          </NavLink>
        </nav>

        <div className="sidebar__rodape">
          <div className="sidebar__usuario">
            <span className="sidebar__usuario-nome">
              {usuario?.name ?? 'Usuário'}
            </span>
            <span className="sidebar__usuario-label">Conta ativa</span>
          </div>
          <button
            type="button"
            className="sidebar__sair"
            onClick={sair}
            title="Sair"
          >
            <IconeSair />
          </button>
        </div>
      </aside>

      <main className="layout__conteudo">
        <Outlet />
      </main>
    </div>
  );
}
