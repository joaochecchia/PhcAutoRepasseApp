import { request } from './client';
import type { SearchResponse } from './contracts';

/** Favoritos da conta (favoritesApi do site). Sem login, ficam só no aparelho, nesta visita. */
export const favoritesApi = {
  async ids() {
    return (await request<{ anuncioIds: string[] }>('/anuncios/favoritos/ids', { auth: true })).anuncioIds;
  },
  cards(signal?: AbortSignal) {
    return request<SearchResponse>('/anuncios/favoritos', { auth: true, signal, params: { pagina: 0, tamanho: 52 } });
  },
  /** Ao entrar, os favoritos feitos como visitante vão para a conta. Devolve a lista completa. */
  async merge(anuncioIds: string[]) {
    return (await request<{ anuncioIds: string[] }>('/anuncios/favoritos/mesclar', {
      method: 'POST',
      auth: true,
      body: { anuncioIds },
    })).anuncioIds;
  },
  add: (anuncioId: string) =>
    request<void>(`/anuncios/${encodeURIComponent(anuncioId)}/favorito`, { method: 'PUT', auth: true }),
  remove: (anuncioId: string) =>
    request<void>(`/anuncios/${encodeURIComponent(anuncioId)}/favorito`, { method: 'DELETE', auth: true }),
};
