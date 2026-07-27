import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { fazerLogin, type UsuarioLogado } from '../api/auth-api';
import {
  lerSessao,
  limparSessao,
  salvarSessao,
} from './armazenamento-token';

interface ContextoAuth {
  token: string | null;
  usuario: UsuarioLogado | null;
  estaAutenticado: boolean;
  entrar: (email: string, senha: string) => Promise<void>;
  sair: () => void;
}

const Contexto = createContext<ContextoAuth | null>(null);

export function ProvedorAuth({ children }: { children: ReactNode }) {
  /**
   * O estado inicial le o localStorage uma unica vez, na primeira renderizacao.
   * Sem isso, um F5 mostraria a tela de login por um instante antes de
   * reconhecer a sessao existente.
   */
  const [sessao, setSessao] = useState(() => lerSessao());

  const entrar = useCallback(async (email: string, senha: string) => {
    const resposta = await fazerLogin(email, senha);
    const nova = { token: resposta.accessToken, usuario: resposta.user };

    salvarSessao(nova);
    setSessao(nova);
  }, []);

  const sair = useCallback(() => {
    limparSessao();
    setSessao(null);
  }, []);

  const valor = useMemo<ContextoAuth>(
    () => ({
      token: sessao?.token ?? null,
      usuario: sessao?.usuario ?? null,
      estaAutenticado: sessao !== null,
      entrar,
      sair,
    }),
    [sessao, entrar, sair],
  );

  return <Contexto.Provider value={valor}>{children}</Contexto.Provider>;
}

export function useAuth(): ContextoAuth {
  const contexto = useContext(Contexto);

  if (contexto === null) {
    throw new Error('useAuth precisa ser usado dentro de <ProvedorAuth>');
  }

  return contexto;
}

/**
 * Versao para uso em hooks de dados, onde a ausencia de token e um bug: a rota
 * e protegida, entao chegar ali sem token significa que o guard falhou.
 */
export function useTokenObrigatorio(): string {
  const { token } = useAuth();

  if (token === null) {
    throw new Error('Token ausente em uma rota protegida');
  }

  return token;
}
