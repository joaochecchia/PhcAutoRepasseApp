import { getJson } from './client';
import type {
  AdDetail,
  AdPhoto,
  HomeAdsResponse,
  PlatformNumbers,
  PublicProfile,
  SearchResponse,
} from './contracts';

/** Filtros da busca, com os nomes do BuscarAnunciosRequest do backend. Preços em reais (viram centavos aqui). */
export type SearchFilters = {
  termo?: string;
  tipoVeiculo?: string;
  condicao?: string;
  precoMinimo?: number;
  precoMaximo?: number;
  ordenacao?: string;
  marca?: string;
};

export function fetchHome(signal?: AbortSignal) {
  return getJson<HomeAdsResponse>('/anuncios/pagina-inicial', undefined, { signal });
}

export function fetchPlatformNumbers(signal?: AbortSignal) {
  return getJson<PlatformNumbers>('/anuncios/numeros', undefined, { signal });
}

export function searchAds(filters: SearchFilters, pagina: number, tamanho: number, signal?: AbortSignal) {
  return getJson<SearchResponse>(
    '/anuncios',
    {
      pagina,
      tamanho,
      termo: filters.termo?.trim() || undefined,
      tipoVeiculo: filters.tipoVeiculo,
      condicao: filters.condicao,
      marca: filters.marca,
      ordenacao: filters.ordenacao,
      precoMinimoCentavos: filters.precoMinimo != null ? Math.round(filters.precoMinimo * 100) : undefined,
      precoMaximoCentavos: filters.precoMaximo != null ? Math.round(filters.precoMaximo * 100) : undefined,
    },
    { signal },
  );
}

export function fetchAd(id: string, signal?: AbortSignal) {
  return getJson<AdDetail>(`/anuncios/${encodeURIComponent(id)}`, undefined, { signal });
}

export function fetchAdPhotos(id: string, signal?: AbortSignal) {
  return getJson<AdPhoto[]>(`/anuncios/${encodeURIComponent(id)}/fotos`, undefined, { signal });
}

export function fetchPublicProfile(id: string, signal?: AbortSignal) {
  return getJson<PublicProfile>(`/perfis/${encodeURIComponent(id)}`, undefined, { signal });
}

export function fetchStatus(signal?: AbortSignal) {
  return getJson<{ status: string }>('/status', undefined, { signal, timeoutMs: 5_000 });
}
