import { request } from './client';
import type { AdStatus } from './my-ads';

/**
 * Denúncia de anúncio, de mensagem do chat ou de quem anuncia (mesmo backend do site). alvoId: id do anúncio, da
 * mensagem ou da conta (ANUNCIANTE).
 */
export type ReportType = 'ANUNCIO' | 'MENSAGEM' | 'ANUNCIANTE';
export type ReportReason = 'GOLPE_OU_FRAUDE' | 'ANUNCIO_FALSO' | 'CONTEUDO_OFENSIVO' | 'ASSEDIO' | 'SPAM' | 'OUTRO';
export type ReportStatus = 'ABERTA' | 'RESOLVIDA' | 'DESCARTADA';

/** Denúncia na fila da equipe (ADMIN e DONO). Nome e e-mail nulos: a conta já foi excluída. */
export type AdminReport = {
  id: string;
  tipo: ReportType;
  alvoId: string;
  anuncioId: string | null;
  conversaId: string | null;
  motivo: ReportReason;
  detalhe: string | null;
  trecho: string;
  status: ReportStatus;
  criadaEm: string;
  denunciante: { id: string; nome: string | null; email: string | null };
  denunciado: { id: string; nome: string | null; email: string | null };
  denunciasContraDenunciado: number;
  decididaEm: string | null;
  decididaPor: string | null;
  nota: string | null;
};
export type AdminReportsPage = { itens: AdminReport[]; total: number; pagina: number; tamanho: number };

/** Pessoa denunciada (todas as denúncias contra ela). Só conta CLIENTE é desativada pela denúncia. */
export type ReportedAccount = {
  usuarioId: string;
  nome: string | null;
  email: string | null;
  papel: string | null;
  ativa: boolean;
  denuncias: number;
  abertas: number;
  ultimaEm: string | null;
};
/** Anúncio denunciado (denúncias de anúncio). status nulo: o anúncio foi excluído. */
export type ReportedAd = {
  anuncioId: string;
  titulo: string;
  status: AdStatus | null;
  anuncianteId: string | null;
  anuncianteNome: string | null;
  anuncianteAtivo: boolean;
  denuncias: number;
  abertas: number;
  ultimaEm: string | null;
};
export type ReportSummaryPage<T> = { itens: T[]; total: number; pagina: number; tamanho: number };
/** ABERTAS: só o que tem denúncia aguardando análise; TODAS: também o que já foi analisado. */
export type ReportSituation = 'ABERTAS' | 'TODAS';

export const reportsApi = {
  /** Repetir enquanto a denúncia está aberta devolve a mesma (não cria outra). */
  create: (body: { tipo: ReportType; alvoId: string; motivo: ReportReason; detalhe?: string }) =>
    request<{ id: string; mensagem: string }>('/denuncias', { method: 'POST', body, auth: true }),
};

export const adminReportsApi = {
  list: (params: { status?: ReportStatus; pagina: number; tamanho?: number }, signal?: AbortSignal) =>
    request<AdminReportsPage>('/admin/denuncias', { auth: true, params: { tamanho: 20, ...params }, signal }),
  summary: (signal?: AbortSignal) => request<{ abertas: number }>('/admin/denuncias/resumo', { auth: true, signal }),
  accounts: (params: { situacao: ReportSituation; pagina: number }, signal?: AbortSignal) =>
    request<ReportSummaryPage<ReportedAccount>>('/admin/denuncias/contas', { auth: true, params: { tamanho: 20, ...params }, signal }),
  ads: (params: { situacao: ReportSituation; pagina: number }, signal?: AbortSignal) =>
    request<ReportSummaryPage<ReportedAd>>('/admin/denuncias/anuncios', { auth: true, params: { tamanho: 20, ...params }, signal }),
  /** Desativa a conta de cliente denunciada e resolve as denúncias abertas contra ela; devolve quantas. */
  deactivateReportedAccount: (usuarioId: string, nota?: string) =>
    request<{ resolvidas: number }>(`/admin/denuncias/contas/${encodeURIComponent(usuarioId)}/desativacao`, {
      method: 'POST',
      body: { nota: nota || undefined },
      auth: true,
    }),
  /** Tira da vitrine o anúncio denunciado e resolve as denúncias abertas contra ele; devolve quantas. */
  retireReportedAd: (anuncioId: string, nota?: string) =>
    request<{ resolvidas: number }>(`/admin/denuncias/anuncios/${encodeURIComponent(anuncioId)}/retirada`, {
      method: 'POST',
      body: { nota: nota || undefined },
      auth: true,
    }),
  decide: (id: string, decisao: Exclude<ReportStatus, 'ABERTA'>, nota?: string) =>
    request<void>(`/admin/denuncias/${encodeURIComponent(id)}/decisao`, {
      method: 'POST',
      body: { decisao, nota: nota || undefined },
      auth: true,
    }),
  /** Só denúncia de anúncio: o anúncio sai da vitrine e o anunciante não edita nem republica. Resolve a denúncia. */
  retireAd: (id: string, nota?: string) =>
    request<void>(`/admin/denuncias/${encodeURIComponent(id)}/retirar-anuncio`, {
      method: 'POST',
      body: { nota: nota || undefined },
      auth: true,
    }),
  /** Só conta de cliente: perde as sessões e os anúncios saem da vitrine; o DONO reativa em Usuários. Resolve a denúncia. */
  deactivateAccount: (id: string, nota?: string) =>
    request<void>(`/admin/denuncias/${encodeURIComponent(id)}/desativar-conta`, {
      method: 'POST',
      body: { nota: nota || undefined },
      auth: true,
    }),
};
