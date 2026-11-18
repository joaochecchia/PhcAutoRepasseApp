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

export type MetodoPagamento = 'PIX' | 'CARTAO_CREDITO' | 'CARTAO_DEBITO' | 'BOLETO';

/** Boleto registrado; vencimento como data (AAAA-MM-DD). Só vem enquanto aguarda pagamento. */
export type BoletoInfo = { url: string | null; linhaDigitavel: string; codigoBarras: string | null; vencimento: string | null };
export type PixInfo = { copiaECola: string; qrCodeBase64: string | null; expiraEm?: string | null };

export type PaymentCharge = {
  id: string;
  assinaturaId: string;
  status: 'INICIADA' | 'PENDENTE' | 'CONFIRMADA' | 'RECUSADA' | 'FALHOU' | 'CANCELADA' | 'ESTORNADA';
  metodo: MetodoPagamento;
  valorCentavos: number;
  /** Mensagem pronta para a pessoa, definida pelo backend. */
  mensagem: string;
  codigoRetorno: string | null;
  pix: PixInfo | null;
  cartao: { bandeira: string | null; finalNumero: string | null } | null;
  criadoEm: string;
  atualizadoEm: string;
  confirmadoEm: string | null;
  /** Só o crédito parcela (plano anual, até 12x sem juros). */
  parcelas: number;
  /** CHECKOUT: paga pela pessoa. RENOVACAO: cobrada pela renovação automática. */
  tipo: 'CHECKOUT' | 'RENOVACAO';
  reembolsoSolicitadoEm: string | null;
  boleto: BoletoInfo | null;
};

export type AutoRenewal = {
  /** AGUARDANDO_CLIENTE: o banco não aprovou sem a pessoa; ela precisa confirmar o pagamento. */
  status: 'ATIVA' | 'AGUARDANDO_CLIENTE';
  planoCodigo: string;
  periodicidade: Periodicidade;
  parcelas: number;
  valorCentavos: number;
  proximaCobrancaEm: string | null;
  cartao: { bandeira: string | null; finalNumero: string | null };
  motivo: string | null;
  mensagem: string;
};

export type RefundOffer = { assinaturaId: string; valorCentavos: number; ate: string };

export type SubscriptionStatus = {
  atual: SubscriptionSummary | null;
  agendadas: SubscriptionSummary[];
  cobrancaPendente: PaymentCharge | null;
  acessoTotal: boolean;
  consultasFipeUsadasMes: number;
  recorrencia: AutoRenewal | null;
  reembolso: RefundOffer | null;
};

/** Só o token da Cielo: número, validade e CVV vão do aparelho direto para a Cielo. */
export type CardToken = { paymentToken: string; bandeira: string; finalNumero: string };
export type Authentication3ds = { cavv: string | null; xid: string | null; eci: number; versao: string; referenceId: string | null };

export type CheckoutPayload = {
  plano: string;
  periodicidade: Periodicidade;
  metodo: MetodoPagamento;
  cartao?: CardToken;
  autenticacao3ds?: Authentication3ds;
  /** Crédito no plano anual: 1 a 12, sem juros. */
  parcelas?: number;
  /** Crédito no plano mensal ou anual: salva o cartão na Cielo e renova sozinho. */
  renovacaoAutomatica?: boolean;
};
export type CheckoutResult = { cobranca: PaymentCharge; assinatura: SubscriptionSummary };

/** Credenciais temporárias da Cielo emitidas pelo backend para este pagamento. */
export type CardSession = {
  tokenizacao: { accessToken: string; url: string; expiraEm: string };
  autenticacao3ds: {
    accessToken: string;
    ambiente: 'SDB' | 'PRD';
    scriptUrl: string;
    pedido: string;
    ip: string | null;
    /** URL pública da loja; o firewall do MPI recusa localhost. */
    urlLoja: string | null;
    comprador: {
      nome: string | null;
      email: string | null;
      telefone: string | null;
      documento: string | null;
      rua: string | null;
      cidade: string | null;
      uf: string | null;
      cep: string | null;
    };
  } | null;
};

const one = (id: string) => encodeURIComponent(id);

export const plansApi = {
  list: (signal?: AbortSignal) => getJson<PublicPlan[]>('/planos', undefined, { signal }),
  mine: (signal?: AbortSignal) => request<SubscriptionStatus>('/assinaturas/minha', { auth: true, signal }),
  /** Planos de teste, só para contas liberadas no backend; para as demais, lista vazia. */
  internal: (signal?: AbortSignal) => request<PublicPlan[]>('/assinaturas/planos-internos', { auth: true, signal }),
  paymentMethods: (signal?: AbortSignal) =>
    request<MetodoPagamento[]>('/assinaturas/metodos-pagamento', { auth: true, signal }),
  // A autorização do cartão ou o registro do boleto pode levar até 40 s na operadora.
  checkout: (payload: CheckoutPayload) =>
    request<CheckoutResult>('/assinaturas/checkout', { method: 'POST', body: payload, auth: true, timeoutMs: 60_000 }),
  cardSession: (metodo: MetodoPagamento) =>
    request<CardSession>('/assinaturas/checkout/sessao-cartao', { method: 'POST', body: { metodo }, auth: true }),
  charge: (id: string, signal?: AbortSignal) =>
    request<PaymentCharge>(`/assinaturas/cobrancas/${one(id)}`, { auth: true, signal }),
  cancelAutoRenewal: () =>
    request<AutoRenewal>('/assinaturas/renovacao-automatica/cancelamento', { method: 'POST', auth: true }),
  refund: (assinaturaId: string) =>
    request<PaymentCharge>(`/assinaturas/${one(assinaturaId)}/reembolso`, { method: 'POST', auth: true, timeoutMs: 60_000 }),
};
