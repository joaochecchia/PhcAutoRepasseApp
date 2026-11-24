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
  /** Selo da promoção no ar que cobre o anúncio (ou o lote dele). */
  promocao?: PromotionSeal | null;
};

export type PromotionSeal = { titulo: string; destaque: string };
export type PromotionConditionType =
  | 'FINANCIAMENTO'
  | 'PARCELAMENTO'
  | 'DESCONTO'
  | 'ABAIXO_FIPE'
  | 'IPVA_PAGO'
  | 'DOCUMENTACAO_GRATIS'
  | 'BONUS_TROCA'
  | 'GARANTIA'
  | 'TANQUE_CHEIO'
  | 'OUTRO';
/** resumo vem pronto do backend ("Em até 12x", "IPVA pago"). */
export type PromotionCondition = {
  tipo: PromotionConditionType;
  resumo: string;
  quantidade: number | null;
  percentual: number | null;
  valorCentavos: number | null;
  observacao: string | null;
};
export type PromotionScope = 'TODOS' | 'SELECIONADOS';
/** Promoção no ar vista pelo comprador; valeParaEsteVeiculo só quando a consulta informou o anúncio/lote. */
export type PublicPromotion = {
  id: string;
  titulo: string;
  descricao: string | null;
  abrangencia: PromotionScope;
  condicoes: PromotionCondition[];
  fim: string | null;
  valeParaEsteVeiculo: boolean | null;
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

/**
 * Moderação automática da foto. O público só recebe APROVADA; o anunciante e a equipe veem também PENDENTE e REVISAO
 * ("Em análise") e REJEITADA ("Recusada", com o motivo).
 */
export type PhotoModerationStatus = 'PENDENTE' | 'APROVADA' | 'REJEITADA' | 'REVISAO';

export type AdPhoto = {
  id: string;
  /** Nulo nas fotos do lote. */
  anuncioId: string | null;
  posicao: number;
  textoAlternativo?: string | null;
  /** Nula quando a foto recusada por conteúdo impróprio teve o arquivo apagado. */
  url: string | null;
  /** Ausente em backend anterior à moderação (24/11/2026): trate como aprovada. */
  statusModeracao?: PhotoModerationStatus;
  /** Só na recusa: o motivo em linguagem simples para o anunciante. */
  motivoModeracao?: string | null;
};

/**
 * Resultado da exclusão de conta para o "Entrar com Apple": REVOGADA (a Apple confirmou), PENDENTE (o servidor tenta
 * de novo), SEM_TOKEN (sem como revogar: a pessoa remove o app na conta Apple) ou NAO_SE_APLICA.
 */
export type AppleRevocation = 'NAO_SE_APLICA' | 'REVOGADA' | 'PENDENTE' | 'SEM_TOKEN';

export type UserProfile = {
  id: string;
  tipoPessoa: 'PF' | 'PJ';
  nome: string;
  email: string;
  telefone: string;
  possuiSenhaLocal: boolean;
  /** "Entrar com Apple" ligado à conta. */
  contaApple?: boolean;
  /**
   * O servidor já guarda o token para revogar o acesso na Apple ao excluir a conta. Falso numa conta Apple antiga:
   * no iPhone, a exclusão pede uma nova confirmação da Apple.
   */
  appleRevogavel?: boolean;
  razaoSocial?: string | null;
  cpf?: string | null;
  dataNascimento?: string | null;
  cnpj?: string | null;
  /** Ausente em contas de dono e admin criadas só com nome, e-mail e senha. */
  endereco?: Address | null;
};

export type AdContactChannels = { whatsapp: boolean; chat: boolean };

export type PublicProfile = {
  id: string;
  nome: string;
  tipoPessoa: 'PF' | 'PJ';
  cidade: string | null;
  uf: string | null;
  fotoUrl: string | null;
  slug: string | null;
};

export type MediaFile = {
  id: string;
  tipo: 'VIDEO' | 'LAUDO';
  status: 'PROCESSANDO' | 'PRONTO' | 'FALHOU';
  nomeArquivo: string;
  contentType: string;
  tamanhoBytes: number;
  duracaoSegundos: number | null;
  mensagemErro: string | null;
  url: string | null;
  /** O vídeo enviado tinha mais de 30 s e só os primeiros 30 s foram guardados. */
  cortado?: boolean;
};
export type MediaSet = { video: MediaFile | null; laudo: MediaFile | null };

/** GET /lotes/{id}: fotos e vídeo compartilhados, preço único e os carros à venda. */
export type Lot = {
  id: string;
  anuncianteId: string;
  titulo: string;
  descricao: string | null;
  fabricante: string;
  modelo: string;
  versao: string | null;
  anoModelo: number;
  precoCentavos: number;
  disponiveis: number;
  fotos: AdPhoto[];
  video: MediaFile | null;
  anuncios: SearchAd[];
  /** Só para o dono do lote. */
  carros:
    | { anuncioId: string; cor: string | null; placa: string | null; quilometragem: number | null; status: string; laudo: MediaFile | null }[]
    | null;
};

export type StoresResponse = {
  lojistas: PublicProfile[];
  total: number;
  pagina: number;
  tamanho: number;
  raioKmAplicado: number | null;
  temProximaPagina: boolean;
};

/** Endereço do cadastro (mesmo do site). */
export type Address = {
  cep: string;
  cidade: string;
  bairro: string;
  rua: string;
  numero?: string | null;
  complemento?: string | null;
  uf: string;
};

/** Versão do catálogo FIPE escolhida na fila de espera. */
export type WaitlistVersion = { codigo: string; nome: string };
export type WaitlistFipeType = 'cars' | 'motorcycles' | 'trucks';
/** Até 100 ou 200 km da cidade, ou todo o Brasil (sem cidade). */
export type WaitlistReach = '100' | '200' | 'BRASIL';
export type WaitlistRequest = {
  tipoFipe: WaitlistFipeType;
  marcaCodigo: string;
  marcaNome: string;
  versoes: WaitlistVersion[];
  anoMinimo: number;
  anoMaximo: number;
  /** Nulos em todo o Brasil. */
  cidade: string | null;
  uf: string | null;
  alcance: WaitlistReach;
  /** E-mail só com essa autorização; sem ela, o aviso fica só na conta. */
  avisarPorEmail: boolean;
};
export type WaitlistOrder = Omit<WaitlistRequest, 'cidade' | 'uf' | 'alcance'> & {
  id: string;
  cidade: string | null;
  uf: string | null;
  /** Nulo = todo o Brasil. */
  raioKm: number | null;
  criadoEm: string;
  expiraEm: string;
  vencido: boolean;
  carrosEncontrados: number;
};

export type AccountNotice = {
  id: string;
  /** DENUNCIA: denúncia nova, só para ADMIN e DONO. MODERACAO: foto do anúncio ou do lote recusada. */
  tipo: 'FILA_ESPERA' | 'CHAT' | 'DENUNCIA' | 'MODERACAO';
  titulo: string;
  detalhe: string | null;
  /** Caminho interno do site (/anuncio/<id>, /lote/<id>, /meus-anuncios/editar/<id>...); `noticeRoute` traduz para o app. */
  link: string;
  criadoEm: string;
  lidoEm: string | null;
};
export type AccountNoticesSummary = { naoLidos: number; recentes: AccountNotice[] };
export type AccountNoticesPage = { avisos: AccountNotice[]; pagina: number; temProximaPagina: boolean };
