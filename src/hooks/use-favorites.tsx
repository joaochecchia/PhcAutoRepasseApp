import { createContext, use, useState, type ReactNode } from 'react';

import type { SearchAd } from '@/api/contracts';

type FavoritesValue = {
  items: SearchAd[];
  isFavorite: (id: string) => boolean;
  toggle: (ad: SearchAd) => void;
};

const FavoritesContext = createContext<FavoritesValue | null>(null);

/**
 * Favoritos de visitante, só na memória (como no site sem login). Com a sessão, passam a vir de
 * /anuncios/favoritos e os locais são mesclados em /anuncios/favoritos/mesclar.
 */
export function FavoritesProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<SearchAd[]>([]);
  const value: FavoritesValue = {
    items,
    isFavorite: (id) => items.some((item) => item.anuncioId === id),
    toggle: (ad) =>
      setItems((current) =>
        current.some((item) => item.anuncioId === ad.anuncioId)
          ? current.filter((item) => item.anuncioId !== ad.anuncioId)
          : [ad, ...current],
      ),
  };
  return <FavoritesContext value={value}>{children}</FavoritesContext>;
}

export function useFavorites() {
  const value = use(FavoritesContext);
  if (!value) throw new Error('useFavorites fora do FavoritesProvider');
  return value;
}
