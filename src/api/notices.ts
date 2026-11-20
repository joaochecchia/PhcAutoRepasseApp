import { request } from './client';
import type { AccountNoticesPage, AccountNoticesSummary } from './contracts';

/** Avisos da conta (noticesApi do site): carros da fila de espera e mensagens novas. */
export const noticesApi = {
  summary: (signal?: AbortSignal) => request<AccountNoticesSummary>('/notificacoes/resumo', { auth: true, signal }),
  list: (pagina: number, signal?: AbortSignal) =>
    request<AccountNoticesPage>('/notificacoes', { auth: true, signal, params: { pagina, tamanho: 20 } }),
  /** Sem ids, marca todos como lidos. */
  markRead: (ids?: string[]) =>
    request<void>('/notificacoes/lidas', { method: 'POST', body: { ids: ids ?? [] }, auth: true }),
};

/**
 * O link do aviso é um caminho do site; no app só seguem os que existem como tela (anúncio, lote, conversa e, para a
 * equipe, a observabilidade e as denúncias).
 */
type NoticeRoute =
  | `/anuncio/${string}`
  | `/lote/${string}`
  | `/mensagens/${string}`
  | '/admin/observabilidade'
  | '/admin/denuncias';
export function noticeRoute(link: string): NoticeRoute | null {
  if (link === '/admin/observabilidade' || link === '/admin/denuncias') return link;
  const match = /^\/(anuncio|lote|mensagens)\/([A-Za-z0-9-]{1,64})$/.exec(link);
  return match ? (`/${match[1]}/${match[2]}` as NoticeRoute) : null;
}
