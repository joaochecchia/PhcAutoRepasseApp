import type { UploadFile } from './announce';
import { request, upload } from './client';
import type { AdPhoto, MediaFile } from './contracts';

export type AdStatus = 'RASCUNHO' | 'PUBLICADO' | 'PAUSADO' | 'RESERVADO' | 'VENDIDO' | 'ARQUIVADO';
/** MeuAnuncioResponse do backend. */
export type MyAd = {
  id: string;
  tipoVeiculo?: string;
  fabricante: string;
  modelo: string;
  versao?: string | null;
  anoFabricacao?: number | null;
  anoModelo?: number | null;
  titulo: string;
  tipoPreco?: string;
  precoCentavos: number | null;
  status: AdStatus;
  cidade: string;
  uf: string;
  quantidadeFotos?: number;
  fotoPrincipalUrl: string | null;
  criadoEm?: string;
  atualizadoEm?: string;
  publicadoEm?: string | null;
  loteId?: string | null;
};
export type MyAdsPage = {
  anuncios: MyAd[];
  total: number;
  pagina: number;
  tamanho: number;
  temMais?: boolean;
  temProximaPagina?: boolean;
  totalPorStatus?: Partial<Record<AdStatus, number>>;
};
export type AdQuota = { planoNome: string | null; limite: number | null; publicados: number; podePublicar: boolean };

/** Filtros da lista (mesmos do site). Preço em centavos; datas em AAAA-MM-DD. */
export type MyAdsFilters = {
  status?: AdStatus;
  marca?: string;
  modelo?: string;
  precoMinimoCentavos?: number;
  precoMaximoCentavos?: number;
  publicadoDesde?: string;
  publicadoAte?: string;
  condicao?: 'ZERO_KM' | 'USADO' | 'REPASSE';
};

/** Motivos do questionário ao tirar da vitrine; os dois primeiros marcam como vendido. */
export type RetireReason =
  | 'VENDIDO_PHC'
  | 'VENDIDO_FORA'
  | 'DESISTI_DE_VENDER'
  | 'AJUSTAR_ANUNCIO'
  | 'POUCOS_CONTATOS'
  | 'PAUSA_TEMPORARIA'
  | 'OUTRO';
export const isSale = (reason: RetireReason) => reason === 'VENDIDO_PHC' || reason === 'VENDIDO_FORA';
/** Prazo do backend até apagar o anúncio vendido (app.anuncios.retencao-vendidos). */
export const SOLD_RETENTION_DAYS = 30;

/** "Voltar ao topo" do mês no plano. limite 0 = o plano não inclui. */
export type RenewalQuota = {
  limite: number | null;
  usadas: number;
  restantes: number | null;
  ilimitado: boolean;
  intervaloMinimoHoras: number;
};
export type AdRenewal = { anuncioId: string; renovados: string[]; topoEm: string; cota: RenewalQuota };

export type MyLot = {
  id: string;
  titulo: string;
  precoCentavos: number;
  disponiveis: number;
  vendidos: number;
  total: number;
  fotoUrl: string | null;
};

export type AdAddress = {
  cep: string;
  cidade: string;
  bairro: string;
  rua: string;
  numero?: string | null;
  complemento?: string | null;
  uf: string;
};
export type AdFipeSnapshot = {
  referenciaId: string;
  codigo: string;
  valorCentavos: number;
  mesReferencia: string;
  modelo: string;
  fonte: string;
};
/** GET /anuncios/{id}/edicao */
export type AdForEdit = {
  id: string;
  anuncianteId: string;
  tipoVeiculo: string;
  status: AdStatus;
  fabricante: string;
  modelo: string;
  versao: string | null;
  anoFabricacao: number | null;
  anoModelo: number | null;
  cor: string | null;
  identificadorPublico: string | null;
  condicao: string | null;
  tipoFreio: string | null;
  historicoLeilao: boolean | null;
  historicoSinistro: boolean | null;
  titulo: string;
  descricao: string | null;
  tipoPreco: 'FIXO' | 'SOB_CONSULTA';
  precoCentavos: number | null;
  aceitaTroca: boolean | null;
  endereco: AdAddress;
  detalhes: Record<string, unknown> | null;
  contato: { whatsapp: boolean; ligacao: boolean };
  fipe: AdFipeSnapshot | null;
  loteId?: string | null;
  criadoEm: string;
  publicadoEm: string | null;
};
/** Foto vista pelo dono: todas, com a situação da moderação. */
export type OwnPhoto = AdPhoto;
export type AdMedia = MediaFile;
export type AdMediaSet = { video: AdMedia | null; laudo: AdMedia | null };

export type AdStatsPerson = {
  nome: string;
  cidade: string | null;
  uf: string | null;
  em: string;
  vezes: number;
  anuncioId: string;
  anuncioTitulo: string;
};
/** disponivel=false quando o plano não inclui estatísticas (planos Pro). */
export type AdStats = {
  disponivel: boolean;
  dias: number;
  totais: {
    visualizacoes: number;
    visitantes: number;
    favoritosAtuais: number;
    novosFavoritos: number;
    cliquesWhatsapp: number;
    pessoasWhatsapp: number;
  } | null;
  porDia: { dia: string; visualizacoes: number; visitantes: number; favoritos: number; cliquesWhatsapp: number }[];
  favoritaram: AdStatsPerson[];
  contataramWhatsapp: AdStatsPerson[];
  anuncios: { id: string; titulo: string; status: string }[];
  porAnuncio: {
    anuncioId: string;
    titulo: string;
    status: string;
    visualizacoes: number;
    visitantes: number;
    favoritosAtuais: number;
    cliquesWhatsapp: number;
  }[];
};

const ad = (id: string) => `/anuncios/${encodeURIComponent(id)}`;

export const myAdsApi = {
  quota: (signal?: AbortSignal) => request<AdQuota>('/anuncios/meus/cota', { auth: true, signal }),
  list: (pagina: number, signal?: AbortSignal, filters?: MyAdsFilters) =>
    request<MyAdsPage>('/anuncios/meus', { auth: true, params: { pagina, tamanho: 20, ...filters }, signal }),
  setPublished: (id: string, publicarAgora: boolean) =>
    request<void>(ad(id), { method: 'PATCH', body: { publicarAgora }, auth: true }),
  forEdit: (id: string, signal?: AbortSignal) => request<AdForEdit>(`${ad(id)}/edicao`, { auth: true, signal }),
  /** PATCH parcial: campos ausentes ficam como estão no servidor. */
  update: (id: string, changes: Record<string, unknown>) =>
    request<void>(ad(id), { method: 'PATCH', body: changes, auth: true, timeoutMs: 30_000 }),
  remove: (id: string) => request<void>(ad(id), { method: 'DELETE', auth: true }),
  /** Tira da vitrine com o motivo do questionário; motivos de venda marcam como vendido. */
  retire: (id: string, motivo: RetireReason) =>
    request<{ anuncioId: string; motivo: RetireReason; status: AdStatus }>(`${ad(id)}/retirada`, {
      method: 'POST',
      body: { motivo },
      auth: true,
    }),
  renewals: (signal?: AbortSignal) => request<RenewalQuota>('/anuncios/meus/renovacoes', { auth: true, signal }),
  /** Volta ao topo da busca; carro de lote renova o lote inteiro. */
  renew: (id: string) => request<AdRenewal>(`${ad(id)}/renovacao`, { method: 'POST', auth: true }),
  lots: (signal?: AbortSignal) => request<MyLot[]>('/lotes/meus', { auth: true, signal }),

  photos: (id: string, signal?: AbortSignal) => request<OwnPhoto[]>(`${ad(id)}/fotos`, { auth: true, signal }),
  addPhoto: (id: string, file: UploadFile, posicao: number) => {
    const form = new FormData();
    form.append('arquivo', file as unknown as Blob);
    form.append('posicao', String(posicao));
    return upload<OwnPhoto>(`${ad(id)}/fotos`, form, { timeoutMs: 60_000 });
  },
  removePhoto: (id: string, fotoId: string) =>
    request<void>(`${ad(id)}/fotos/${encodeURIComponent(fotoId)}`, { method: 'DELETE', auth: true }),
  media: (id: string, signal?: AbortSignal) => request<AdMediaSet>(`${ad(id)}/midias`, { auth: true, signal }),
  removeMedia: (id: string, tipo: 'video' | 'laudo') =>
    request<void>(`${ad(id)}/midias/${tipo}`, { method: 'DELETE', auth: true }),

  /** Estatísticas de um anúncio. */
  stats: (id: string, dias: number, signal?: AbortSignal) =>
    request<AdStats>(`${ad(id)}/estatisticas`, { auth: true, params: { dias }, signal }),
  /** Soma de todos os anúncios da conta ou, com anuncioId, só daquele anúncio. */
  accountStats: (anuncioId: string | null, dias: number, signal?: AbortSignal) =>
    request<AdStats>('/anuncios/meus/estatisticas', {
      auth: true,
      params: anuncioId ? { dias, anuncioId } : { dias },
      signal,
    }),
};

const lot = (id: string) => `/lotes/${encodeURIComponent(id)}`;

/** Edição do lote pelo dono (LotEditPage do site). Fotos, vídeo e carros são salvos na hora. */
export const lotsApi = {
  /** Dados comuns (merge patch no formato do anúncio), aplicados a todos os carros à venda. */
  update: (id: string, changes: Record<string, unknown>) =>
    request<void>(lot(id), { method: 'PATCH', body: changes, auth: true, timeoutMs: 30_000 }),
  addPhoto: (id: string, file: UploadFile, posicao: number) => {
    const form = new FormData();
    form.append('arquivo', file as unknown as Blob);
    form.append('posicao', String(posicao));
    return upload<OwnPhoto>(`${lot(id)}/fotos`, form, { timeoutMs: 60_000 });
  },
  removePhoto: (id: string, fotoId: string) =>
    request<void>(`${lot(id)}/fotos/${encodeURIComponent(fotoId)}`, { method: 'DELETE', auth: true }),
  removeVideo: (id: string) => request<void>(`${lot(id)}/midias/video`, { method: 'DELETE', auth: true }),
  /** Tira o carro do lote; ele vira anúncio avulso. */
  removeCar: (id: string, anuncioId: string) =>
    request<void>(`${lot(id)}/carros/${encodeURIComponent(anuncioId)}`, { method: 'DELETE', auth: true }),
  addCars: (
    id: string,
    payload: {
      anuncio: unknown | null;
      unidades: { cor: string; placa: string | null; quilometragem: number | null }[];
      anunciosExistentes: string[];
      publicar: boolean;
    },
  ) =>
    request<{ loteId: string; anunciosCriados: string[]; anunciosIncluidos: string[] }>(`${lot(id)}/carros`, {
      method: 'POST',
      body: payload,
      auth: true,
      timeoutMs: 60_000,
    }),
  /** Exclui o lote; os carros viram anúncios avulsos. */
  remove: (id: string) => request<void>(lot(id), { method: 'DELETE', auth: true }),
};
