import { getJson, request } from './client';
import type { Authentication3ds, BoletoInfo, CardToken, MetodoPagamento, PixInfo } from './plans';
import { sessionStore } from './session-store';

/** O backend decide se o anúncio pode ser comprado e quais meios a conta usa (Pix para todos). */
export type PurchaseAvailability = {
  disponivel: boolean;
  valorCentavos: number | null;
  metodos: MetodoPagamento[];
  parcelasMaximas: number;
  vencimentoBoletoDias: number;
};

export type PurchasePayload = {
  metodo: MetodoPagamento;
  parcelas?: number;
  cartao?: CardToken;
  autenticacao3ds?: Authentication3ds;
};

export type VehiclePurchase = {
  id: string;
  anuncioId: string;
  titulo: string;
  valorCentavos: number;
  status: 'AGUARDANDO_PAGAMENTO' | 'PAGO' | 'CANCELADO' | 'EXPIRADO' | 'REEMBOLSADO';
  statusPagamento: 'PENDENTE' | 'CONFIRMADO' | 'FALHOU' | 'CANCELADO' | 'EXPIRADO' | 'ESTORNADO';
  /** Mensagem pronta para a pessoa, definida pelo backend. */
  mensagem: string;
  metodo: MetodoPagamento;
  /** Só o crédito parcela (juros do emissor). */
  parcelas: number;
  boleto: BoletoInfo | null;
  pix: PixInfo | null;
  cartao: { bandeira: string | null; finalNumero: string | null } | null;
  /** Até quando o veículo fica reservado esperando o pagamento. */
  reservadoAte: string | null;
  criadoEm: string;
  pagoEm: string | null;
};

const one = (id: string) => encodeURIComponent(id);

export const salesApi = {
  /** WhatsApp do atendimento da PHC (só dígitos, com DDI); nulo quando não está cadastrado. Público. */
  supportWhatsapp: async (signal?: AbortSignal) =>
    (await getJson<{ whatsapp: string | null }>('/vendas/atendimento', undefined, { signal })).whatsapp,
  /** Público; com sessão, os meios de pagamento são os liberados para a conta. */
  purchaseAvailability: (anuncioId: string, signal?: AbortSignal) =>
    request<PurchaseAvailability>(`/vendas/anuncios/${one(anuncioId)}/compra`, {
      auth: sessionStore.getState().status === 'authenticated',
      signal,
    }),
  // A autorização do cartão ou o registro do boleto pode levar até 40 s na operadora.
  buyVehicle: (anuncioId: string, payload: PurchasePayload) =>
    request<VehiclePurchase>(`/vendas/anuncios/${one(anuncioId)}/compra`, {
      method: 'POST',
      body: payload,
      auth: true,
      timeoutMs: 60_000,
    }),
  purchases: (signal?: AbortSignal) => request<VehiclePurchase[]>('/vendas/compras', { auth: true, signal }),
  purchase: (id: string, signal?: AbortSignal) => request<VehiclePurchase>(`/vendas/compras/${one(id)}`, { auth: true, signal }),
  cancelPurchase: (id: string) =>
    request<VehiclePurchase>(`/vendas/compras/${one(id)}/cancelamento`, { method: 'POST', auth: true }),
};
