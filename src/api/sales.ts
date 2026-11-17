import { getJson } from './client';

export const salesApi = {
  /** WhatsApp do atendimento da PHC (só dígitos, com DDI); nulo quando não está cadastrado. Público. */
  supportWhatsapp: async (signal?: AbortSignal) =>
    (await getJson<{ whatsapp: string | null }>('/vendas/atendimento', undefined, { signal })).whatsapp,
};
