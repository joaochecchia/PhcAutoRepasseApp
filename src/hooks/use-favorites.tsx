import { useQueryClient } from '@tanstack/react-query';
import { createContext, use, useEffect, useRef, useState, type ReactNode } from 'react';

import type { SearchAd } from '@/api/contracts';
import { favoritesApi } from '@/api/favorites';
import { showDialog } from '@/components/dialog';
import { useSession } from '@/hooks/use-session';

type FavoritesValue = {
  /** Ids favoritados: os da conta com login, os desta visita sem login. */
  ids: string[];
  /** Cards favoritados nesta visita (sem login, é tudo o que existe; com login, a aba busca os da conta). */
  localItems: SearchAd[];
  isFavorite: (id: string) => boolean;
  toggle: (ad: SearchAd) => void;
};

const FavoritesContext = createContext<FavoritesValue | null>(null);

export const favoritesQueryKey = (usuarioId: string) => ['favorites', usuarioId] as const;

/**
 * Como no site (useFavorites): sem login, os favoritos valem só nesta visita; ao entrar, são mesclados na conta
 * (/anuncios/favoritos/mesclar) e daí em diante cada toque grava no servidor. Falhou, o coração volta e a pessoa é
 * avisada. Ao sair, a lista local é limpa.
 */
export function FavoritesProvider({ children }: { children: ReactNode }) {
  const session = useSession();
  const usuarioId = session.status === 'authenticated' ? session.user.usuarioId : null;
  const queryClient = useQueryClient();
  const [ids, setIds] = useState<string[]>([]);
  const [localItems, setLocalItems] = useState<SearchAd[]>([]);
  // Os ids de visitante a mesclar são lidos no efeito do login, sem que cada toque o rode de novo.
  const idsRef = useRef(ids);
  useEffect(() => {
    idsRef.current = ids;
  }, [ids]);
  const previousUser = useRef<string | null>(null);

  useEffect(() => {
    const before = previousUser.current;
    previousUser.current = usuarioId;
    if (!usuarioId) {
      // Saiu da conta (não a primeira carga anônima): o que era da conta não fica no aparelho.
      if (before) {
        setIds([]);
        setLocalItems([]);
      }
      return;
    }
    let active = true;
    const local = idsRef.current;
    (local.length ? favoritesApi.merge(local) : favoritesApi.ids())
      .then((serverIds) => {
        if (!active) return;
        setIds(serverIds);
        queryClient.invalidateQueries({ queryKey: favoritesQueryKey(usuarioId) });
      })
      .catch(() => undefined);
    return () => {
      active = false;
    };
  }, [usuarioId, queryClient]);

  function toggle(ad: SearchAd) {
    const id = ad.anuncioId;
    const exists = ids.includes(id);
    setIds((current) => (exists ? current.filter((v) => v !== id) : [id, ...current]));
    setLocalItems((current) => (exists ? current.filter((item) => item.anuncioId !== id) : [ad, ...current]));
    if (!usuarioId) return;
    (exists ? favoritesApi.remove(id) : favoritesApi.add(id))
      .then(() => queryClient.invalidateQueries({ queryKey: favoritesQueryKey(usuarioId) }))
      .catch((error: Error) => {
        setIds((current) => (exists ? [id, ...current] : current.filter((v) => v !== id)));
        setLocalItems((current) => (exists ? [ad, ...current] : current.filter((item) => item.anuncioId !== id)));
        showDialog({
          title: exists ? 'Não foi possível remover' : 'Não foi possível salvar',
          message: error.message,
        });
      });
  }

  const value: FavoritesValue = { ids, localItems, isFavorite: (id) => ids.includes(id), toggle };
  return <FavoritesContext value={value}>{children}</FavoritesContext>;
}

export function useFavorites() {
  const value = use(FavoritesContext);
  if (!value) throw new Error('useFavorites fora do FavoritesProvider');
  return value;
}
