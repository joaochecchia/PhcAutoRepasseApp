import type { FipeReference } from './announce';
import { request } from './client';

/** Uso do mês na página "Consulta por placa": assinante sem limite; os demais, poucas placas por mês. */
export type PlateQuota = { ilimitada: boolean; limite: number; usadas: number; restantes: number | null };

/** Dados do veículo pela placa (Simples API, pelo backend). Sem dado do proprietário. Valores em centavos. */
export type PlateData = {
  placa: string;
  veiculo: {
    marca: string | null; modelo: string | null; versao: string | null;
    anoFabricacao: number | null; anoModelo: number | null; cor: string | null; combustivel: string | null;
    tipo: string | null; especie: string | null; passageiros: number | null; cilindradas: number | null;
    capacidadeTracaoKg: number | null; eixos: number | null; montagem: string | null; pesoBrutoKg: number | null;
    cidade: string | null; uf: string | null; origem: string | null;
  };
  fipe: {
    /** EXATO: a placa é desta versão. PROVAVEL: pode ser uma das alternativas. */
    nivel: "EXATO" | "PROVAVEL";
    codigo: string | null; marca: string | null; nome: string | null; anoModelo: number | null;
    zeroKm: boolean | null; combustivel: string | null; precoCentavos: number | null; mesReferencia: string | null;
    ficha: {
      motor: string | null; combustivel: string | null; potenciaCv: Record<string, number>;
      cambio: string | null; carroceria: string | null; portas: number | null;
    } | null;
    historico: { mes: string; precoCentavos: number | null }[];
    alternativas: { codigo: string | null; nome: string | null; anoModelo: number | null; zeroKm: boolean | null;
      combustivel: string | null; precoCentavos: number | null; mesReferencia: string | null }[];
  } | null;
  bateria: { opcoes: {
    fabricante: string | null; codigo: string | null; codigoAlternativo: string | null; nivel: string | null;
    amperesHora: number | null; cca: number | null; polaridade: string | null; tecnologia: string | null;
    comprimentoMm: number | null; larguraMm: number | null; alturaMm: number | null; pesoKg: number | null;
  }[] } | null;
};

export type PlateLookup = { dados: PlateData; cota: PlateQuota };

/**
 * Dados do cadastro do anúncio inferidos pela placa, já no vocabulário do formulário; nulo = não deu para inferir.
 * O anunciante confere e pode mudar tudo. `fipe`: referência já vinculada (sem valor).
 */
export type PlateSuggestion = {
  placa: string;
  tipoVeiculo: "CARRO" | "MOTO" | "CAMINHAO" | "CAMINHONETE" | null;
  fabricante: string | null; modelo: string | null; versao: string | null;
  anoFabricacao: number | null; anoModelo: number | null; cor: string | null; combustivel: string | null;
  cambio: string | null; carroceria: string | null; motorizacao: string | null; turbo: boolean | null;
  numeroPortas: number | null; numeroLugares: number | null; cilindradas: number | null;
  numeroEixos: number | null; pesoBrutoTotalKg: number | null;
  fipe: FipeReference | null;
  fipeProvavel: boolean;
  versoesPossiveis: string[];
};

/** Consulta por placa: tela (com limite do mês para quem não assina) e preenchimento do cadastro (sem limite mensal). */
export const platesApi = {
  lookup: (placa: string) =>
    request<PlateLookup>('/placas/consultas', { method: 'POST', body: { placa }, auth: true, timeoutMs: 30_000 }),
  quota: () => request<PlateQuota>('/placas/cota', { auth: true }),
  suggestion: (placa: string) =>
    request<PlateSuggestion>('/anuncios/sugestao-por-placa', { method: 'POST', body: { placa }, auth: true, timeoutMs: 30_000 }),
};

/** "abc-1d23" → "ABC1D23"; vazio se não for placa no padrão antigo ou Mercosul. */
export function normalizePlate(value: string) {
  const plate = value.replace(/[^A-Za-z0-9]/g, '').toUpperCase();
  return /^[A-Z]{3}[0-9][A-Z0-9][0-9]{2}$/.test(plate) ? plate : '';
}
