import type { ReportReason, ReportType } from '@/api/reports';

/** Motivos na ordem em que aparecem (os mesmos do site); cada tipo mostra só os que fazem sentido para ele. */
export const reportReasons: { value: ReportReason; label: string; hint: string; for: ReportType[] }[] = [
  { value: 'GOLPE_OU_FRAUDE', label: 'Golpe ou fraude', hint: 'Pede pagamento adiantado, sinal fora do app, dados bancários.', for: ['ANUNCIO', 'MENSAGEM', 'ANUNCIANTE'] },
  { value: 'ANUNCIO_FALSO', label: 'Anúncio falso', hint: 'Veículo que não existe, fotos de outro carro, preço enganoso.', for: ['ANUNCIO'] },
  { value: 'ASSEDIO', label: 'Assédio ou ameaça', hint: 'Insistência, intimidação, mensagens de cunho sexual.', for: ['MENSAGEM', 'ANUNCIANTE'] },
  { value: 'CONTEUDO_OFENSIVO', label: 'Conteúdo ofensivo', hint: 'Palavrões, discriminação, imagens impróprias.', for: ['ANUNCIO', 'MENSAGEM', 'ANUNCIANTE'] },
  { value: 'SPAM', label: 'Spam', hint: 'Propaganda, links ou mensagens repetidas.', for: ['ANUNCIO', 'MENSAGEM', 'ANUNCIANTE'] },
  { value: 'OUTRO', label: 'Outro motivo', hint: 'Conte o que aconteceu.', for: ['ANUNCIO', 'MENSAGEM', 'ANUNCIANTE'] },
];

export const reportReasonLabel = Object.fromEntries(reportReasons.map((r) => [r.value, r.label])) as Record<ReportReason, string>;
