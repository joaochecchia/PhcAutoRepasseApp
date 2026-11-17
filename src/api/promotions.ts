import type { PromotionCondition, PromotionConditionType, PromotionScope } from './contracts';
import { request } from './client';
import type { AdStatus } from './my-ads';

/** NO_AR aparece no site; SEM_PLANO: o plano atual não inclui promoções, então nada aparece. */
export type PromotionStatus = 'NO_AR' | 'AGENDADA' | 'ENCERRADA' | 'PAUSADA' | 'SEM_PLANO';
export type Promotion = {
  id: string;
  anuncianteId: string;
  nomeAnunciante: string | null;
  titulo: string;
  descricao: string | null;
  abrangencia: PromotionScope;
  condicoes: PromotionCondition[];
  anuncioIds: string[];
  loteIds: string[];
  /** yyyy-mm-dd no fuso de Brasília; o último dia conta. */
  inicio: string;
  fim: string | null;
  ativa: boolean;
  situacao: PromotionStatus;
  atualizadoEm: string;
};
export type PromotionsPanel = { planoInclui: boolean; limite: number; promocoes: Promotion[] };
/** Anúncio avulso não vendido ou lote que pode entrar numa promoção. */
export type PromotionOption = {
  id: string;
  tipo: 'ANUNCIO' | 'LOTE';
  titulo: string;
  status: AdStatus | null;
  tipoPreco: 'FIXO' | 'SOB_CONSULTA';
  precoCentavos: number | null;
  disponiveis: number | null;
};
export type PromotionInput = {
  titulo: string;
  descricao: string | null;
  abrangencia: PromotionScope;
  condicoes: {
    tipo: PromotionConditionType;
    quantidade?: number | null;
    percentual?: number | null;
    valorCentavos?: number | null;
    observacao?: string | null;
  }[];
  anuncioIds: string[];
  loteIds: string[];
  inicio: string | null;
  fim: string | null;
  ativa: boolean;
};

const one = (id: string) => `/promocoes/${encodeURIComponent(id)}`;

export const promotionsApi = {
  mine: (signal?: AbortSignal) => request<PromotionsPanel>('/promocoes/minhas', { auth: true, signal }),
  options: (signal?: AbortSignal) => request<PromotionOption[]>('/promocoes/opcoes', { auth: true, signal }),
  create: (input: PromotionInput) => request<Promotion>('/promocoes', { method: 'POST', body: input, auth: true }),
  update: (id: string, input: PromotionInput) => request<Promotion>(one(id), { method: 'PUT', body: input, auth: true }),
  setActive: (id: string, ativa: boolean) =>
    request<Promotion>(`${one(id)}/situacao`, { method: 'PUT', body: { ativa }, auth: true }),
  remove: (id: string) => request<void>(one(id), { method: 'DELETE', auth: true }),
};
