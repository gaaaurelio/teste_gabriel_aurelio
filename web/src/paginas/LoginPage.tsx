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
          : 'Nao foi possivel entrar. Tente novamente.',
      );
    } finally {
      setEnviando(false);
    }
  }

  return (
    <div className="login">
      <form className="cartao login__form" onSubmit={aoEnviar}>
        <header className="login__cabecalho">
          <span className="marca">Ramper</span>
          <h1>Contratacao de produtos</h1>
          <p className="texto-secundario">
            Entre para acompanhar e movimentar as contratacoes.
          </p>
        </header>

        <label className="campo">
          <span>E-mail</span>
          <input
            type="email"
            value={email}
            onChange={(evento) => setEmail(evento.target.value)}
            autoComplete="username"
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

        <p className="login__dica texto-secundario">
          Usuarios criados pelo seed: <code>admin@ramper.com</code> e{' '}
          <code>analista@ramper.com</code>, senha <code>ramper123</code>.
        </p>
      </form>
    </div>
  );
}
