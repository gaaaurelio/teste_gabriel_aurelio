import type { UsuarioLogado } from '../api/auth-api';

/**
 * ONDE O TOKEN FICA E POR QUE (a justificativa completa esta no README).
 *
 * Escolha: localStorage.
 *
 * O motivo pratico e que o frontend e servido em localhost:8080 e os servicos
 * em outras portas. Um cookie httpOnly -- que seria a opcao mais segura --
 * exigiria que o cookie fosse enviado cross-origin, o que obriga
 * `SameSite=None; Secure` (ou seja, HTTPS) e `credentials: 'include'` com CORS
 * configurado para origem especifica. Nada disso e viavel num ambiente local em
 * HTTP, e o enunciado dispensa refresh token, que e o mecanismo que tornaria o
 * cookie realmente vantajoso.
 *
 * O custo assumido: localStorage e legivel por qualquer JavaScript da pagina,
 * entao um XSS consegue roubar o token. Em producao eu trocaria por cookie
 * httpOnly + SameSite com os servicos atras do mesmo dominio.
 */
const CHAVE_TOKEN = 'ramper.token';
const CHAVE_USUARIO = 'ramper.usuario';

export interface SessaoArmazenada {
  token: string;
  usuario: UsuarioLogado;
}

export function lerSessao(): SessaoArmazenada | null {
  const token = localStorage.getItem(CHAVE_TOKEN);
  const usuarioBruto = localStorage.getItem(CHAVE_USUARIO);

  if (token === null || usuarioBruto === null) {
    return null;
  }

  try {
    const usuario: unknown = JSON.parse(usuarioBruto);
    if (!ehUsuarioLogado(usuario)) {
      // Dado corrompido no storage nao pode derrubar a aplicacao no boot.
      limparSessao();
      return null;
    }
    return { token, usuario };
  } catch {
    limparSessao();
    return null;
  }
}

export function salvarSessao(sessao: SessaoArmazenada): void {
  localStorage.setItem(CHAVE_TOKEN, sessao.token);
  localStorage.setItem(CHAVE_USUARIO, JSON.stringify(sessao.usuario));
}

export function limparSessao(): void {
  localStorage.removeItem(CHAVE_TOKEN);
  localStorage.removeItem(CHAVE_USUARIO);
}

function ehUsuarioLogado(valor: unknown): valor is UsuarioLogado {
  if (typeof valor !== 'object' || valor === null) {
    return false;
  }
  const { id, email, name } = valor as Record<string, unknown>;
  return (
    typeof id === 'string' && typeof email === 'string' && typeof name === 'string'
  );
}
