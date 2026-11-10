// Contratos HTTP usados pelo app. Fonte da verdade: ../PhcAutoRepasse/frontend/src/lib/contracts.ts.
// Só entram aqui os tipos que o app já consome; acrescente copiando de lá quando uma tela nova precisar.

export type AdFipe = {
  referenciaId: string;
  codigo: string;
  valorCentavos: number;
  mesReferencia: string;
  modelo: string;
  fonte: string;
  /** preço − FIPE; negativo = abaixo da FIPE. */
  diferencaCentavos: number | null;
  diferencaPercentual: number | null;
};

export type SearchAd = {
  anuncioId: string;
  veiculoId: string;
  anuncianteId: string;
  tipoVeiculo: string;
  fabricante: string;
  modelo: string;
  anoFabricacao: number;
  anoModelo: number;
  condicao: string;
  titulo: string;
  tipoPreco: 'FIXO' | 'SOB_CONSULTA';
  precoCentavos: number | null;
  cidade: string;
  uf: string;
  nomePerfil: string;
  cambio?: string | null;
  combustivel?: string | null;
  motorizacao?: string | null;
  historicoLeilao?: boolean | null;
  historicoSinistro?: boolean | null;
  temLaudo?: boolean;
  fotoPrincipalUrl?: string | null;
  quilometragem?: number | null;
  fipe?: AdFipe | null;
  selo?: 'NENHUM' | 'PHC' | 'VERIFICADO' | null;
  loteId?: string | null;
  loteDisponiveis?: number | null;
  patrocinado?: boolean;
  vendidoEm?: string | null;
};

export type SearchResponse = {
  carros: SearchAd[];
  total: number;
  pagina: number;
  tamanho: number;
  raioKmAplicado: number | null;
  temProximaPagina: boolean;
};

export type HomeAdsResponse = {
  carros: SearchAd[];
  /** Vendidos nos últimos 14 dias, com vendidoEm. */
  vendidos?: SearchAd[];
  mensagem: string;
};

export type PlatformNumbers = { anunciados: number; vendidos: number };

export type AdDetail = {
  id: string;
  anuncianteId: string;
  tipoVeiculo: string;
  fabricante: string;
  modelo: string;
  versao: string | null;
  anoFabricacao: number | null;
  anoModelo: number | null;
  cor: string | null;
  condicao: string | null;
  tipoFreio: string | null;
  historicoLeilao: boolean | null;
  historicoSinistro: boolean | null;
  titulo: string;
  descricao: string | null;
  tipoPreco: 'FIXO' | 'SOB_CONSULTA';
  precoCentavos: number | null;
  aceitaTroca: boolean | null;
  cidade: string;
  detalhes: Record<string, unknown> | null;
  fipe: AdFipe | null;
  fipeBloqueada?: boolean;
  selo?: 'NENHUM' | 'PHC' | 'VERIFICADO' | null;
  loteId?: string | null;
};

export type AdPhoto = {
  id: string;
  anuncioId: string;
  posicao: number;
  textoAlternativo?: string | null;
  url: string;
};

export type PublicProfile = {
  id: string;
  nome: string;
  tipoPessoa: 'PF' | 'PJ';
  cidade: string | null;
  uf: string | null;
  fotoUrl: string | null;
  slug: string | null;
};
