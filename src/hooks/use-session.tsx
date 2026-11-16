import { useEffect, useSyncExternalStore, type ReactNode } from 'react';
import { AppState } from 'react-native';

import { renewSession } from '@/api/client';
import { sessionStore } from '@/api/session-store';

/**
 * Restaura a sessão ao abrir o app e a renova ao voltar do segundo plano. Cada renovação empurra o prazo de 90 dias
 * no backend: abrir o app é o que mantém a pessoa conectada.
 */
export function SessionProvider({ children }: { children: ReactNode }) {
  useEffect(() => {
    let active = true;
    async function restore() {
      const user = await sessionStore.storedUser();
      if (!(await sessionStore.refreshToken()) || !user) {
        if (active) await sessionStore.clear();
        return;
      }
      try {
        await renewSession();
      } catch {
        // Sem rede: continua logado com o que está no aparelho e renova quando houver conexão.
        if (active) sessionStore.restoreOffline(user);
      }
    }
    restore();

    const subscription = AppState.addEventListener('change', (next) => {
      if (next !== 'active') return;
      if (sessionStore.getState().status !== 'authenticated' || sessionStore.accessToken()) return;
      renewSession().catch(() => undefined);
    });
    return () => {
      active = false;
      subscription.remove();
    };
  }, []);

  return children;
}

export function useSession() {
  return useSyncExternalStore(sessionStore.subscribe, sessionStore.getState, sessionStore.getState);
}

/** Papéis com acesso ao painel administrativo (a autorização de verdade é do backend). */
export function isStaff(papel: string | undefined) {
  return papel === 'ADMIN' || papel === 'DONO';
}
