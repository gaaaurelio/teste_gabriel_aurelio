import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from './contexto-auth';

/**
 * Guard client-side. Vale dizer explicitamente: isso e conveniencia de
 * navegacao, nao seguranca. Quem de fato protege os dados e o S2SAuthGuard do
 * Main API -- um usuario pode remover essa checagem pelo DevTools e ainda assim
 * nao vera contratacao nenhuma, porque a API recusa o request sem token valido.
 */
export function RotaProtegida() {
  const { estaAutenticado } = useAuth();
  const localizacao = useLocation();

  if (!estaAutenticado) {
    // `state` guarda de onde a pessoa veio, para voltar ali depois do login.
    return <Navigate to="/login" replace state={{ de: localizacao.pathname }} />;
  }

  return <Outlet />;
}
