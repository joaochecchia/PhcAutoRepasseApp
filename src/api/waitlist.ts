import { request } from './client';
import type { SearchResponse, WaitlistOrder, WaitlistRequest } from './contracts';

const one = (id: string) => `/fila-espera/${encodeURIComponent(id)}`;

/** Fila de espera (waitlistApi do site). */
export const waitlistApi = {
  list: (signal?: AbortSignal) => request<WaitlistOrder[]>('/fila-espera', { auth: true, signal }),
  /** Carros já à venda com os mesmos critérios, antes de entrar na fila (não grava nada). */
  preview: (body: WaitlistRequest) =>
    request<SearchResponse>('/fila-espera/previa', { method: 'POST', body, auth: true, timeoutMs: 30_000 }),
  create: (body: WaitlistRequest) => request<WaitlistOrder>('/fila-espera', { method: 'POST', body, auth: true }),
  renew: (id: string) => request<WaitlistOrder>(`${one(id)}/renovacao`, { method: 'POST', auth: true }),
  setEmail: (id: string, avisarPorEmail: boolean) =>
    request<WaitlistOrder>(one(id), { method: 'PATCH', body: { avisarPorEmail }, auth: true }),
  remove: (id: string) => request<void>(one(id), { method: 'DELETE', auth: true }),
  cars: (id: string, signal?: AbortSignal) => request<SearchResponse>(`${one(id)}/carros`, { auth: true, signal }),
};
