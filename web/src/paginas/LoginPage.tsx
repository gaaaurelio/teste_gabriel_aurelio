import { useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { useAuth } from '../auth/contexto-auth';

export function LoginPage() {
  const { entrar, estaAutenticado } = useAuth();
  const navegar = useNavigate();

  const [email, setEmail] = useState('admin@ramper.com');
  const [senha, setSenha] = useState('ramper123');
  const [erro, setErro] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  if (estaAutenticado) {
    return <Navigate to="/contratacoes" replace />;
  }

  async function aoEnviar(evento: React.FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    setErro(null);
    setEnviando(true);

    try {
      await entrar(email, senha);
      navegar('/contratacoes', { replace: true });
    } catch (falha) {
      setErro(
        falha instanceof Error
          ? falha.message
          : 'Não foi possível entrar. Tente novamente.',
      );
    } finally {
      setEnviando(false);
    }
  }

  return (
    <div className="login">
      <form className="login__form" onSubmit={aoEnviar}>
        <div className="login__logo">
          <span className="login__logo-icon">R</span>
          <span className="login__logo-text">Ramper</span>
        </div>

        <header className="login__cabecalho">
          <h1>Bem-vindo de volta</h1>
          <p>Entre para acompanhar e movimentar as contratações.</p>
        </header>

        <label className="campo">
          <span>E-mail</span>
          <input
            type="email"
            value={email}
            onChange={(evento) => setEmail(evento.target.value)}
            autoComplete="username"
            placeholder="seu@email.com"
            required
          />
        </label>

        <label className="campo">
          <span>Senha</span>
          <input
            type="password"
            value={senha}
            onChange={(evento) => setSenha(evento.target.value)}
            autoComplete="current-password"
            placeholder="••••••••"
            required
          />
        </label>

        {erro !== null && (
          <p className="mensagem-erro" role="alert">
            {erro}
          </p>
        )}

        <button type="submit" className="botao botao--primario" disabled={enviando}>
          {enviando ? 'Entrando...' : 'Entrar'}
        </button>

        <p className="login__dica">
          Usuários do seed: <code>admin@ramper.com</code> e{' '}
          <code>analista@ramper.com</code>, senha <code>ramper123</code>.
        </p>
      </form>
    </div>
  );
}
