import { router } from 'expo-router';

export type SearchParams = {
  termo?: string;
  tipoVeiculo?: string;
  condicao?: string;
  precoMinimo?: string;
  precoMaximo?: string;
  ordenacao?: string;
  focus?: string;
};

/**
 * Abre a aba Buscar com estes filtros. O carimbo "t" faz a busca reaplicar os filtros mesmo quando
 * os mesmos parâmetros são enviados de novo.
 */
export function openSearch(params: SearchParams) {
  const clean = Object.fromEntries(Object.entries(params).filter(([, value]) => value)) as Record<string, string>;
  router.navigate({ pathname: '/buscar', params: { ...clean, t: String(Date.now()) } });
}
