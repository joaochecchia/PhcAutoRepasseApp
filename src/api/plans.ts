import { getJson, request } from './client';

export type Periodicidade = 'DIARIO' | 'SEMANAL' | 'MENSAL' | 'ANUAL';

/** Limites nulos = ilimitado; zero = não incluso. */
export type PlanBenefits = {
  limiteAnuncios: number | null;
  limiteConsultasFipeMes: number | null;
  limiteConsultasRestricaoMes: number | null;
  destaqueBusca: 'NENHUM' | 'DESTAQUE' | 'TOPO_FIXO';
  selo: 'NENHUM' | 'PHC' | 'VERIFICADO';
  estatisticasVisualizacao: boolean;
  logoLoja: boolean;
  paginaLoja: boolean;
  apiIntegracao: boolean;
  relatoriosDesempenho: boolean;
  suportePrioritario: boolean;
  videoLaudo: boolean;
  limiteRenovacoesMes?: number | null;
  promocoes?: boolean;
};

export type PublicPlan = {
  codigo: string;
  nome: string;
  publico: 'PF' | 'PJ' | 'TODOS';
  gratuito: boolean;
  precos: { periodicidade: Periodicidade; valorCentavos: number }[];
  beneficios: PlanBenefits;
};

export type SubscriptionSummary = {
  id: string | null;
  planoCodigo: string;
  planoNome: string;
  periodicidade: Periodicidade | null;
  status: 'PENDENTE' | 'ATIVA' | 'SUSPENSA' | 'CANCELADA' | 'EXPIRADA' | 'GRATUITO';
  valorCentavos: number | null;
  inicioEm: string | null;
  fimEm: string | null;
  beneficios: PlanBenefits;
};

export type SubscriptionStatus = {
  atual: SubscriptionSummary | null;
  agendadas: SubscriptionSummary[];
  acessoTotal: boolean;
  consultasFipeUsadasMes: number;
  recorrencia: {
    status: 'ATIVA' | 'AGUARDANDO_CLIENTE';
    proximaCobrancaEm: string | null;
    parcelas: number;
    cartao: { bandeira: string | null; finalNumero: string | null };
  } | null;
};

export const plansApi = {
  list: (signal?: AbortSignal) => getJson<PublicPlan[]>('/planos', undefined, { signal }),
  mine: (signal?: AbortSignal) => request<SubscriptionStatus>('/assinaturas/minha', { auth: true, signal }),
};
