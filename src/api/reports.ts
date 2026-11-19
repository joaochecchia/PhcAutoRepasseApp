import { request } from './client';

/** Denúncia de anúncio ou de mensagem do chat (mesmo backend do site). alvoId: id do anúncio ou da mensagem. */
export type ReportType = 'ANUNCIO' | 'MENSAGEM';
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

export const reportsApi = {
  /** Repetir enquanto a denúncia está aberta devolve a mesma (não cria outra). */
  create: (body: { tipo: ReportType; alvoId: string; motivo: ReportReason; detalhe?: string }) =>
    request<{ id: string; mensagem: string }>('/denuncias', { method: 'POST', body, auth: true }),
};

export const adminReportsApi = {
  list: (params: { status?: ReportStatus; pagina: number; tamanho?: number }, signal?: AbortSignal) =>
    request<AdminReportsPage>('/admin/denuncias', { auth: true, params: { tamanho: 20, ...params }, signal }),
  summary: (signal?: AbortSignal) => request<{ abertas: number }>('/admin/denuncias/resumo', { auth: true, signal }),
  decide: (id: string, decisao: Exclude<ReportStatus, 'ABERTA'>, nota?: string) =>
    request<void>(`/admin/denuncias/${encodeURIComponent(id)}/decisao`, {
      method: 'POST',
      body: { decisao, nota: nota || undefined },
      auth: true,
    }),
};
