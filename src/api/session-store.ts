import { secureStorage } from './secure-storage';

/**
 * Sessão do app ("sempre conectado").
 *
 * - Acesso (JWT, 15 min): só na memória.
 * - Refresh: no armazenamento seguro. Cada renovação troca o refresh e empurra o prazo para 90 dias (backend,
 *   modo app), então quem abre o app ao menos a cada 90 dias nunca precisa entrar de novo.
 * - Dispositivo confiável do 2FA: no armazenamento seguro; continua depois de sair, como o cookie do site.
 *
 * O cliente HTTP lê e renova os tokens por aqui; a interface acompanha pelo SessionProvider.
 */

const KEYS = { refresh: 'phc.session.refresh', user: 'phc.session.user', device: 'phc.session.device' } as const;

export type SessionUser = { usuarioId: string; papel: string };
export type AppTokens = {
  accessToken: string;
  accessExpiresIn: number;
  refreshToken: string;
  refreshExpiresIn: number;
  dispositivo?: string | null;
};
export type SessionState =
  | { status: 'loading' }
  | { status: 'anonymous' }
  | { status: 'authenticated'; user: SessionUser };

let state: SessionState = { status: 'loading' };
let access: { token: string; expiresAt: number } | null = null;
const listeners = new Set<(state: SessionState) => void>();

function emit(next: SessionState) {
  state = next;
  listeners.forEach((listener) => listener(state));
}

export const sessionStore = {
  getState: () => state,
  subscribe(listener: (state: SessionState) => void) {
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  },
  /** Acesso ainda válido (com folga de 30 s), ou null para renovar antes de usar. */
  accessToken() {
    return access && access.expiresAt - 30_000 > Date.now() ? access.token : null;
  },
  refreshToken: () => secureStorage.get(KEYS.refresh),
  deviceToken: () => secureStorage.get(KEYS.device),
  async storedUser(): Promise<SessionUser | null> {
    const raw = await secureStorage.get(KEYS.user);
    if (!raw) return null;
    try {
      const user = JSON.parse(raw) as SessionUser;
      return user.usuarioId && user.papel ? user : null;
    } catch {
      return null;
    }
  },
  /** Login ou renovação concluídos: guarda os tokens novos e avisa a interface. */
  async save(tokens: AppTokens, user: SessionUser) {
    access = { token: tokens.accessToken, expiresAt: Date.now() + tokens.accessExpiresIn * 1000 };
    await secureStorage.set(KEYS.refresh, tokens.refreshToken);
    await secureStorage.set(KEYS.user, JSON.stringify(user));
    if (tokens.dispositivo) await secureStorage.set(KEYS.device, tokens.dispositivo);
    emit({ status: 'authenticated', user });
  },
  /** Sem rede ao abrir o app: mostra a pessoa como logada e renova quando a conexão voltar. */
  restoreOffline(user: SessionUser) {
    emit({ status: 'authenticated', user });
  },
  /** Saída ou sessão encerrada pelo servidor. O dispositivo confiável continua (como no site). */
  async clear() {
    access = null;
    await secureStorage.remove(KEYS.refresh);
    await secureStorage.remove(KEYS.user);
    emit({ status: 'anonymous' });
  },
};
