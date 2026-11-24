import { locationParams, type SearchLocation } from '@/utils/location';

import { getJson, request } from './client';
import type {
  AdContactChannels,
  AdDetail,
  AdPhoto,
  AdFipe,
  HomeAdsResponse,
  Lot,
  MediaSet,
  PlatformNumbers,
  PublicPromotion,
  PublicProfile,
  SearchResponse,
  StoresResponse,
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
  modelo?: string;
  local?: SearchLocation;
  /** Veículos de uma loja (página da loja). */
  anuncianteId?: string;
  /** Só o Pátio PHC. */
  patioPhc?: boolean;
};

export function fetchHome(signal?: AbortSignal) {
  return getJson<HomeAdsResponse>('/anuncios/pagina-inicial', undefined, { signal });
}

export function fetchPlatformNumbers(signal?: AbortSignal) {
  return getJson<PlatformNumbers>('/anuncios/numeros', undefined, { signal });
}

export function searchAds(filters: SearchFilters, pagina: number, tamanho: number, signal?: AbortSignal) {
  // "Perto do meu endereço" usa o cadastro: só com sessão.
  return request<SearchResponse>('/anuncios', {
    auth: filters.local?.modo === 'ENDERECO_CADASTRADO',
    signal,
    params: {
      pagina,
      tamanho,
      termo: filters.termo?.trim() || undefined,
      tipoVeiculo: filters.tipoVeiculo,
      condicao: filters.condicao,
      marca: filters.marca,
      ordenacao: filters.ordenacao,
      precoMinimoCentavos: filters.precoMinimo != null ? Math.round(filters.precoMinimo * 100) : undefined,
      precoMaximoCentavos: filters.precoMaximo != null ? Math.round(filters.precoMaximo * 100) : undefined,
      modelo: filters.modelo,
      anuncianteId: filters.anuncianteId,
      patioPhc: filters.patioPhc || undefined,
      ...locationParams(filters.local),
    },
  });
}

export function fetchAd(id: string, signal?: AbortSignal) {
  return getJson<AdDetail>(`/anuncios/${encodeURIComponent(id)}`, undefined, { signal });
}

/** Com sessão, o dono e a equipe recebem também as fotos em análise e as recusadas; o público, só as aprovadas. */
export function fetchAdPhotos(id: string, signal?: AbortSignal, signedIn = false) {
  return request<AdPhoto[]>(`/anuncios/${encodeURIComponent(id)}/fotos`, { signal, auth: signedIn });
}

export function fetchPublicProfile(id: string, signal?: AbortSignal) {
  return getJson<PublicProfile>(`/perfis/${encodeURIComponent(id)}`, undefined, { signal });
}

/** Canais que o anúncio oferece (público; não revela o número). */
export function fetchContactChannels(id: string, signal?: AbortSignal) {
  return getJson<AdContactChannels>(`/anuncios/${encodeURIComponent(id)}/contato/canais`, undefined, { signal });
}

/** Link do WhatsApp do anunciante; exige login (o backend registra o contato). */
export function requestWhatsappContact(id: string) {
  return request<{ url: string }>(`/anuncios/${encodeURIComponent(id)}/contato/whatsapp`, { method: 'POST', auth: true });
}

export function fetchStatus(signal?: AbortSignal) {
  return getJson<{ status: string }>('/status', undefined, { signal, timeoutMs: 5_000 });
}

/** Vídeo e laudo do anúncio publicado (públicos). */
export function fetchAdMedia(id: string, signal?: AbortSignal) {
  return getJson<MediaSet>(`/anuncios/${encodeURIComponent(id)}/midias`, undefined, { signal });
}

/** Conta a visita para as estatísticas do anunciante. O backend ignora repetições e o próprio anunciante. */
export function recordAdView(id: string, signedIn: boolean) {
  request<void>(`/anuncios/${encodeURIComponent(id)}/visualizacao`, { method: 'POST', auth: signedIn }).catch(
    () => undefined,
  );
}

/** Libera a comparação com a FIPE; pode gastar uma consulta da cota do plano. */
export function revealAdFipe(id: string) {
  return request<AdFipe>(`/anuncios/${encodeURIComponent(id)}/fipe/revelar`, { method: 'POST', auth: true });
}

/** Lote público; com sessão, o dono recebe também a lista de carros. */
export function fetchLot(id: string, signal?: AbortSignal, signedIn = false) {
  return request<Lot>(`/lotes/${encodeURIComponent(id)}`, { signal, auth: signedIn });
}

/** Promoções no ar da loja; com anúncio ou lote, cada uma diz se vale para ele. */
export function fetchStorePromotions(
  anuncianteId: string,
  vehicle?: { anuncioId?: string | null; loteId?: string | null },
  signal?: AbortSignal,
) {
  return getJson<PublicPromotion[]>(
    `/promocoes/loja/${encodeURIComponent(anuncianteId)}`,
    { anuncioId: vehicle?.anuncioId ?? undefined, loteId: vehicle?.loteId ?? undefined },
    { signal },
  );
}

/** Lojistas (perfis PJ) por nome e região: cidade/UF ou coordenadas do aparelho. */
export function searchStores(
  filters: { nome?: string; cidade?: string; uf?: string; latitude?: number; longitude?: number },
  pagina: number,
  signal?: AbortSignal,
) {
  return getJson<StoresResponse>('/lojistas', { ...filters, nome: filters.nome?.trim() || undefined, pagina, tamanho: 12 }, { signal });
}

/** Perfil público da loja pelo endereço curto (slug). */
export function fetchStoreProfile(slug: string, signal?: AbortSignal) {
  return getJson<PublicProfile>(`/perfis/loja/${encodeURIComponent(slug)}`, undefined, { signal });
}

/** Banner do carrossel da tela inicial (público: só os ativos). */
export type HomeBanner = {
  id: string;
  imagemUrl: string;
  textoAlternativo: string;
  titulo: string | null;
  subtitulo: string | null;
  link: string | null;
  textoBotao: string | null;
  exibirTexto: boolean;
  focoX: number;
  focoY: number;
  ajuste: 'PREENCHER' | 'INTEIRA';
  duracaoSegundos: number;
  ordem: number;
  imagemCelularUrl: string | null;
  focoXCelular: number;
  focoYCelular: number;
  exibirEm: 'TODOS' | 'COMPUTADOR' | 'CELULAR';
};

export async function fetchHomeBanners(signal?: AbortSignal) {
  return (await getJson<{ banners: HomeBanner[] }>('/site/banners', undefined, { signal })).banners;
}
