import {
  ServiceUnavailableException,
  UnauthorizedException,
  type ExecutionContext,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import {
  AuthClientService,
  INTERNAL_API_KEY_HEADER,
} from './auth-client.service';
import { S2SAuthGuard } from './s2s-auth.guard';
import type { AuthenticatedUser } from './auth.types';

/**
 * Teste bonus pedido no enunciado: o guard que autentica via S2S.
 *
 * O `fetch` global e substituido por um dublê. O ponto do teste nao e verificar
 * se o Auth Service funciona (isso e responsabilidade dele), e sim se o Main
 * API reage corretamente a cada resposta possivel -- incluindo a resposta que
 * nunca chega.
 */

const AUTH_URL = 'http://auth-service:3001';
const API_KEY = 'chave-interna-de-teste';
const TOKEN = 'jwt.de.teste';

const CONFIG_DE_TESTE: Record<string, string | number> = {
  AUTH_SERVICE_URL: AUTH_URL,
  INTERNAL_API_KEY: API_KEY,
  AUTH_VALIDATE_TIMEOUT_MS: 50,
};

interface RequestFalso {
  headers: { authorization?: string };
  usuario?: AuthenticatedUser;
}

function criarContexto(authorization?: string): {
  contexto: ExecutionContext;
  request: RequestFalso;
} {
  const request: RequestFalso = { headers: { authorization } };

  const contexto = {
    switchToHttp: () => ({ getRequest: () => request }),
  } as unknown as ExecutionContext;

  return { contexto, request };
}

function respostaValida(): Response {
  return new Response(
    JSON.stringify({
      valid: true,
      payload: {
        sub: 'usuario-42',
        email: 'admin@ramper.com',
        name: 'Admin Ramper',
        iat: 1_700_000_000,
        exp: 1_700_003_600,
      },
      expiresAt: '2026-07-27T11:00:00.000Z',
    }),
    { status: 200, headers: { 'content-type': 'application/json' } },
  );
}

describe('S2SAuthGuard', () => {
  let guard: S2SAuthGuard;
  let fetchMock: jest.Mock;

  beforeEach(async () => {
    fetchMock = jest.fn();
    global.fetch = fetchMock as unknown as typeof fetch;

    const moduleRef = await Test.createTestingModule({
      providers: [
        S2SAuthGuard,
        AuthClientService,
        {
          provide: ConfigService,
          useValue: {
            getOrThrow: (chave: string) => CONFIG_DE_TESTE[chave],
          },
        },
      ],
    }).compile();

    guard = moduleRef.get(S2SAuthGuard);
  });

  describe('extracao do token', () => {
    it('recusa request sem header Authorization sem chamar o Auth Service', async () => {
      const { contexto } = criarContexto(undefined);

      await expect(guard.canActivate(contexto)).rejects.toBeInstanceOf(
        UnauthorizedException,
      );
      expect(fetchMock).not.toHaveBeenCalled();
    });

    it('recusa header que nao usa o esquema Bearer', async () => {
      const { contexto } = criarContexto(`Token ${TOKEN}`);

      await expect(guard.canActivate(contexto)).rejects.toBeInstanceOf(
        UnauthorizedException,
      );
      expect(fetchMock).not.toHaveBeenCalled();
    });
  });

  describe('token valido', () => {
    it('libera o request e anexa o usuario', async () => {
      fetchMock.mockResolvedValue(respostaValida());
      const { contexto, request } = criarContexto(`Bearer ${TOKEN}`);

      await expect(guard.canActivate(contexto)).resolves.toBe(true);
      expect(request.usuario).toEqual({
        id: 'usuario-42',
        email: 'admin@ramper.com',
        name: 'Admin Ramper',
      });
    });

    it('chama /auth/validate enviando a credencial de servico e o token no corpo', async () => {
      fetchMock.mockResolvedValue(respostaValida());
      const { contexto } = criarContexto(`Bearer ${TOKEN}`);

      await guard.canActivate(contexto);

      expect(fetchMock).toHaveBeenCalledTimes(1);
      const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];

      expect(url).toBe(`${AUTH_URL}/auth/validate`);
      expect(init.method).toBe('POST');
      expect(
        (init.headers as Record<string, string>)[INTERNAL_API_KEY_HEADER],
      ).toBe(API_KEY);
      expect(init.body).toBe(JSON.stringify({ token: TOKEN }));
      // A presenca do signal e o que garante que o request nao fica pendurado.
      expect(init.signal).toBeInstanceOf(AbortSignal);
    });
  });

  describe('token invalido', () => {
    it('propaga 401 do Auth Service como 401, preservando a mensagem', async () => {
      fetchMock.mockResolvedValue(
        new Response(JSON.stringify({ message: 'Token expirado' }), {
          status: 401,
          headers: { 'content-type': 'application/json' },
        }),
      );
      const { contexto } = criarContexto(`Bearer ${TOKEN}`);

      const promessa = guard.canActivate(contexto);

      await expect(promessa).rejects.toBeInstanceOf(UnauthorizedException);
      await expect(promessa).rejects.toThrow('Token expirado');
    });
  });

  describe('resiliencia quando o Auth Service falha', () => {
    it('devolve 503 quando a conexao e recusada (servico fora do ar)', async () => {
      fetchMock.mockRejectedValue(
        Object.assign(new Error('fetch failed'), { name: 'TypeError' }),
      );
      const { contexto } = criarContexto(`Bearer ${TOKEN}`);

      await expect(guard.canActivate(contexto)).rejects.toBeInstanceOf(
        ServiceUnavailableException,
      );
    });

    it('devolve 503 quando o Auth Service nao responde dentro do timeout', async () => {
      fetchMock.mockRejectedValue(
        Object.assign(new Error('The operation was aborted due to timeout'), {
          name: 'TimeoutError',
        }),
      );
      const { contexto } = criarContexto(`Bearer ${TOKEN}`);

      const promessa = guard.canActivate(contexto);

      await expect(promessa).rejects.toBeInstanceOf(
        ServiceUnavailableException,
      );
      await expect(promessa).rejects.toThrow(/indisponivel/);
    });

    it('devolve 503 quando o Auth Service responde 500', async () => {
      fetchMock.mockResolvedValue(new Response('erro interno', { status: 500 }));
      const { contexto } = criarContexto(`Bearer ${TOKEN}`);

      await expect(guard.canActivate(contexto)).rejects.toBeInstanceOf(
        ServiceUnavailableException,
      );
    });

    it('devolve 503 quando o corpo do 200 nao tem o formato esperado', async () => {
      fetchMock.mockResolvedValue(
        new Response(JSON.stringify({ valid: true }), {
          status: 200,
          headers: { 'content-type': 'application/json' },
        }),
      );
      const { contexto } = criarContexto(`Bearer ${TOKEN}`);

      await expect(guard.canActivate(contexto)).rejects.toBeInstanceOf(
        ServiceUnavailableException,
      );
    });
  });
});
