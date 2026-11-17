import { request } from './client';
import type { UserProfile } from './contracts';
import { sessionStore, type AppTokens } from './session-store';

/** Mesmo contrato do site (contracts.ts › StrongAuthResponse), com os tokens que o backend devolve ao app. */
export type LoginResponse = {
  status: 'AUTENTICADO' | 'SEGUNDO_FATOR_NECESSARIO';
  usuarioId: string | null;
  papel: string | null;
  expiresIn: number;
  challengeId: string | null;
  challengeExpiresIn: number;
  emailMascarado: string | null;
  tokens?: AppTokens;
};

export type LoginOutcome =
  | { kind: 'authenticated' }
  | { kind: 'second-factor'; challengeId: string; email: string | null; expiresIn: number };

async function finish(response: LoginResponse): Promise<LoginOutcome> {
  if (response.status === 'SEGUNDO_FATOR_NECESSARIO' && response.challengeId) {
    return {
      kind: 'second-factor',
      challengeId: response.challengeId,
      email: response.emailMascarado,
      expiresIn: response.challengeExpiresIn,
    };
  }
  if (!response.tokens || !response.usuarioId || !response.papel) {
    throw new Error('Resposta de login sem sessão');
  }
  await sessionStore.save(response.tokens, { usuarioId: response.usuarioId, papel: response.papel });
  return { kind: 'authenticated' };
}

export const authApi = {
  /** E-mail e senha. Com o aparelho já confiável, o backend dispensa o código. */
  async login(email: string, senha: string) {
    const dispositivo = await sessionStore.deviceToken();
    const response = await request<LoginResponse>('/autenticacao/login', {
      method: 'POST',
      // No app a sessão é sempre "continuar conectado"; o backend usa a sessão deslizante de 90 dias.
      body: { email: email.trim(), senha, manterConectado: true, dispositivo },
    });
    return finish(response);
  },

  /** Código de 6 dígitos enviado por e-mail. confiar: não pedir o código neste aparelho por 30 dias. */
  async verifySecondFactor(challengeId: string, codigo: string, confiar: boolean) {
    const response = await request<LoginResponse>('/autenticacao/2fa/verificar', {
      method: 'POST',
      body: { challengeId, codigo, confiarNesteDispositivo: confiar },
    });
    return finish(response);
  },

  async resendSecondFactor(challengeId: string) {
    const response = await request<LoginResponse>('/autenticacao/2fa/reenviar', {
      method: 'POST',
      body: { challengeId },
    });
    if (!response.challengeId) throw new Error('Desafio inválido');
    return { challengeId: response.challengeId, email: response.emailMascarado };
  },

  /** Volta do Google: troca o código de uso único (com o verificador PKCE) pela sessão. */
  async exchangeGoogleCode(codigo: string, verificador: string) {
    const response = await request<LoginResponse>('/autenticacao/social/troca', {
      method: 'POST',
      body: { codigo, verificador },
    });
    return finish({ ...response, challengeId: null });
  },

  /** Dados que o Google confirmou para o cadastro de uma conta nova. */
  socialRegistrationInfo: (ticket: string, signal?: AbortSignal) =>
    request<{ provedor: string; nome: string; email: string; manterConectado: boolean }>(
      `/autenticacao/social/cadastro/${encodeURIComponent(ticket)}`,
      { signal },
    ),

  /** Cadastro de conta nova vinda do Google: sem senha, com o verificador PKCE do login. Já volta logado. */
  async socialRegister(ticket: string, verifier: string, cadastro: Record<string, unknown>) {
    const response = await request<LoginResponse>('/autenticacao/social/cadastro', {
      method: 'POST',
      body: { token: ticket, cadastro, manterConectado: true, verificador: verifier },
      timeoutMs: 30_000,
    });
    return finish({ ...response, challengeId: null });
  },

  /** Sai do app: revoga o refresh no servidor e apaga a sessão do aparelho (mesmo sem rede). */
  async logout() {
    const refreshToken = await sessionStore.refreshToken();
    try {
      if (refreshToken) await request('/usuarios/logout', { method: 'POST', body: { refreshToken }, timeoutMs: 5_000 });
    } finally {
      await sessionStore.clear();
    }
  },

  profile(usuarioId: string, signal?: AbortSignal) {
    return request<UserProfile>(`/usuarios/${encodeURIComponent(usuarioId)}`, { auth: true, signal });
  },
};
