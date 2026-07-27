import { Navigate, Route, Routes } from 'react-router-dom';
import { RotaProtegida } from './auth/RotaProtegida';
import { ContratacoesPage } from './contratacoes/ContratacoesPage';
import { LoginPage } from './paginas/LoginPage';

export function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />

      <Route element={<RotaProtegida />}>
        <Route path="/contratacoes" element={<ContratacoesPage />} />
      </Route>

      <Route path="*" element={<Navigate to="/contratacoes" replace />} />
    </Routes>
  );
}
