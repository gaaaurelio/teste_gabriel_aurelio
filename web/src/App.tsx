import { Navigate, Route, Routes } from 'react-router-dom';
import { RotaProtegida } from './auth/RotaProtegida';
import { Layout } from './components/Layout';
import { ContratacoesPage } from './contratacoes/ContratacoesPage';
import { LoginPage } from './paginas/LoginPage';
import { DashboardPage } from './paginas/DashboardPage';

export function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />

      <Route element={<RotaProtegida />}>
        <Route element={<Layout />}>
          <Route path="/contratacoes" element={<ContratacoesPage />} />
          <Route path="/dashboard" element={<DashboardPage />} />
        </Route>
      </Route>

      <Route path="*" element={<Navigate to="/contratacoes" replace />} />
    </Routes>
  );
}
