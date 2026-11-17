import type { Periodicidade, PlanBenefits, PublicPlan } from '@/api/plans';

// Só apresentação, como no site (frontend/src/data/plans.ts): preços, limites e elegibilidade vêm do backend.

export const periodicidades: { value: Periodicidade; label: string; unit: string }[] = [
  { value: 'DIARIO', label: 'Diário', unit: '/dia' },
  { value: 'SEMANAL', label: 'Semanal', unit: '/semana' },
  { value: 'MENSAL', label: 'Mensal', unit: '/mês' },
  { value: 'ANUAL', label: 'Anual', unit: '/ano' },
];

export const periodLabel = (p: Periodicidade | null) => periodicidades.find((item) => item.value === p)?.label ?? '';
export const periodUnit = (p: Periodicidade) => periodicidades.find((item) => item.value === p)?.unit ?? '';

export const FEATURED_PLAN = 'PRO_PJ';

export const planPitch: Record<string, string> = {
  FREE: 'Para colocar até 2 veículos na vitrine sem pagar nada.',
  BASICO_PF: 'Para vender um carro sem compromisso, a partir de R$ 3 por dia.',
  ESSENCIAL_PF: 'Para quem vende com frequência e precisa de mais anúncios.',
  PRO_PF: 'Para quem quer anunciar sem limite de veículos.',
  STARTER_PJ: 'Para a loja que está começando a vender online.',
  PRO_PJ: 'Para revendas com estoque grande, sem limite de anúncios.',
  TESTE_INTERNO: 'Plano de teste de pagamento, visível só para contas autorizadas. Benefícios do Básico.',
};

export const audienceLabel: Record<PublicPlan['publico'], string> = {
  TODOS: 'Pessoa física e lojista',
  PF: 'Pessoa física',
  PJ: 'Lojista (CNPJ)',
};

const currency = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });
const wholeCurrency = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 });

/** R$ 29 para valores inteiros, R$ 24,17 quando há centavos. */
export function money(centavos: number) {
  return centavos % 100 === 0 ? wholeCurrency.format(centavos / 100) : currency.format(centavos / 100);
}

export function priceOf(plan: PublicPlan, periodicidade: Periodicidade) {
  return plan.precos.find((preco) => preco.periodicidade === periodicidade)?.valorCentavos ?? null;
}

export function formatDate(value: string | null) {
  return value ? new Date(value).toLocaleDateString('pt-BR') : '';
}

/** soon: recurso contratado que ainda não existe; é liberado sem custo extra quando entrar no ar. */
export type BenefitLine = { text: string; included: boolean; soon?: boolean };

/** Benefícios na ordem do material comercial; negativos só aparecem no plano gratuito. */
export function benefitLines(b: PlanBenefits, gratuito: boolean): BenefitLine[] {
  const lines: BenefitLine[] = [
    { text: b.limiteAnuncios == null ? 'Anúncios ilimitados' : `${b.limiteAnuncios} anúncios ativos`, included: true },
    {
      text: b.limiteConsultasFipeMes == null ? 'Consulta FIPE ilimitada' : `${b.limiteConsultasFipeMes} consultas FIPE por mês`,
      included: b.limiteConsultasFipeMes !== 0,
    },
  ];
  if (b.destaqueBusca === 'TOPO_FIXO') lines.push({ text: 'Destaque prioritário na busca e na página inicial', included: true });
  else if (b.destaqueBusca === 'DESTAQUE') lines.push({ text: 'Destaque na busca e na página inicial', included: true });
  else if (gratuito) lines.push({ text: 'Sem destaque na busca', included: false });
  if (b.limiteRenovacoesMes === null) lines.push({ text: 'Voltar ao topo ilimitado', included: true });
  else if (b.limiteRenovacoesMes)
    lines.push({
      text: `Voltar ao topo ${b.limiteRenovacoesMes} ${b.limiteRenovacoesMes === 1 ? 'vez' : 'vezes'} por mês`,
      included: true,
    });
  else if (gratuito) lines.push({ text: 'Sem voltar ao topo', included: false });
  if (b.selo === 'VERIFICADO') lines.push({ text: 'Selo VERIFICADO PHC', included: true });
  else if (b.selo === 'PHC') lines.push({ text: 'Selo PHC no anúncio', included: true });
  else if (gratuito) lines.push({ text: 'Sem selo de verificado', included: false });
  if (b.logoLoja) lines.push({ text: 'Logo da loja no anúncio', included: true });
  if (b.paginaLoja) lines.push({ text: 'Página da loja no site', included: true });
  if (b.estatisticasVisualizacao)
    lines.push({ text: 'Estatísticas: visualizações, favoritos e cliques no WhatsApp', included: true });
  if (b.relatoriosDesempenho) lines.push({ text: 'Relatórios de desempenho dos anúncios', included: true, soon: true });
  if (b.apiIntegracao) lines.push({ text: 'API para integrar seu sistema', included: true, soon: true });
  if (b.videoLaudo) lines.push({ text: 'Vídeo de até 30 s e laudo cautelar no anúncio', included: true });
  if (b.promocoes) lines.push({ text: 'Promoções com selo nos anúncios: parcelamento, IPVA pago, desconto', included: true });
  else if (gratuito) lines.push({ text: 'Sem promoções nos anúncios', included: false });
  if (b.suportePrioritario) lines.push({ text: 'Suporte PHC prioritário pelo WhatsApp', included: true });
  lines.push({ text: 'Botão de WhatsApp no anúncio', included: true });
  return lines;
}
