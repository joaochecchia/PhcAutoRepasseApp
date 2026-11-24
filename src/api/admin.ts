import type { AccountDraft, TermsVersions } from './account';
import { registrationPayload } from './account';
import type { HomeBanner } from './ads';
import type { UploadFile } from './announce';
import type { ChatMessagesPage } from './chat';
import { request, upload } from './client';
import type { Periodicidade } from './plans';
import type { Promotion } from './promotions';

/** Papéis que o DONO pode dar (o servidor ainda conhece ANUNCIANTE e OPERADOR, de contas antigas). */
export type PapelAdministravel = 'CLIENTE' | 'ADMIN' | 'DONO';

export type AdminUser = {
  id: string;
  nome: string;
  email: string;
  telefone: string | null;
  tipoPessoa: 'PF' | 'PJ';
  papel: string;
  ativo: boolean;
  documento: string | null;
  cidade: string | null;
  uf: string | null;
  criadoEm: string;
};
export type AdminUsersPage = { usuarios: AdminUser[]; total: number; pagina: number; tamanho: number; temProximaPagina: boolean };
export type AdminUserFilters = { busca?: string; papel?: string; tipoPessoa?: string; ativo?: string; pagina: number };

export type AdminSubscription = {
  id: string;
  usuarioId: string;
  planoCodigo: string;
  planoNome: string;
  periodicidade: Periodicidade | null;
  status: 'PENDENTE' | 'ATIVA' | 'SUSPENSA' | 'CANCELADA' | 'EXPIRADA';
  origem: 'COMPRA' | 'CONCESSAO';
  valorCentavos: number;
  inicioEm: string | null;
  fimEm: string | null;
  vigente: boolean;
  concedidoPor: string | null;
  observacao: string | null;
  criadoEm: string;
};

export type ObservabilityCount = { total: number; falhas: number };
export type ObservabilityAlert = { chave: string; titulo: string; texto: string; resolvido: boolean; em: string };
export type ObservabilityPanel = {
  geradoEm: string;
  versao: string;
  ambiente: string;
  servicos: { nome: string; status: 'UP' | 'DOWN'; latenciaMs: number | null; detalhe: string }[];
  projecaoPendentes: number;
  projecaoMaisAntigaSegundos: number;
  numeros: {
    usuarios: number;
    usuariosAtivos: number;
    assinaturasVigentes: number;
    cobrancasAguardando: number;
    cobrancasConfirmadas30Dias: number;
    anunciosPublicados: number;
  };
  checklist: { grupo: string; item: string; estado: 'OK' | 'ATENCAO' | 'PENDENTE'; detalhe: string }[];
  /** Contagens nulas: o Redis estava indisponível na leitura. */
  integracoes: {
    provedor: string;
    descricao: string;
    hoje: ObservabilityCount | null;
    seteDias: ObservabilityCount | null;
    trintaDias: ObservabilityCount | null;
    operacoesTrintaDias: Record<string, number>;
    ultima: { em: string; operacao: string; resultado: string } | null;
    cota: { usado: number; limite: number; janela: string } | null;
  }[];
  /** Gasto com o Claude na moderação de fotos; ausente em backend anterior a 24/11/2026. */
  claude?: ClaudeSpend;
  /** Monitor de alertas (MonitorOperacional); ausente em backend anterior a 17/11/2026. */
  alertas?: {
    ativos: { chave: string; nome: string; detalhe: string; desde: string }[];
    recentes: ObservabilityAlert[];
  };
};

/** Valores em dólares; {@code dolares} nulo quando o Redis não respondeu. */
export type ClaudeSpendPeriod = { chamadas: number; tokensEntrada: number; tokensSaida: number; dolares: number | null };

export type ClaudeSpend = {
  modelo: string;
  precoEntradaPorMilhao: number;
  precoSaidaPorMilhao: number;
  hoje: ClaudeSpendPeriod;
  mes: ClaudeSpendPeriod;
  trintaDias: ClaudeSpendPeriod;
  /** Saldo informado no servidor menos o gasto estimado desde a data; nulo se não configurado. */
  saldo: { informado: number; em: string; gastoDesde: number | null; estimado: number | null; completo: boolean } | null;
  /** Custo oficial do mês (UTC) pela API da Anthropic, com atraso de horas. */
  oficial: {
    configurado: boolean;
    mesDolares: number | null;
    mesDesde: string | null;
    atualizadoAte: string | null;
    consultadoEm: string | null;
    erro: string | null;
  };
};

/** Foto que a moderação automática mandou para a equipe (ADMIN e DONO). */
export type PhotoInReview = {
  origem: 'ANUNCIO' | 'LOTE';
  id: string;
  anuncioId: string | null;
  loteId: string | null;
  titulo: string;
  anuncianteId: string;
  anunciante: string | null;
  /** Classificação do modelo; nula quando não houve (recusa do modelo ou erro). */
  categoria: string | null;
  /** Explicação para a equipe, não para o anunciante. */
  motivo: string | null;
  enviadaParaRevisaoEm: string | null;
  url: string;
};
export type PhotosInReviewPage = { fotos: PhotoInReview[]; total: number; pagina: number; tamanho: number };

/** Impulso manual da PHC: prioridade 1 (menor) a 3 (maior); ate nulo = sem prazo. */
export type AdBoost = {
  anuncioId: string;
  titulo: string;
  loteId: string | null;
  status: string;
  cidade: string;
  uf: string;
  anunciante: string;
  prioridade: 1 | 2 | 3;
  ate: string | null;
  impulsionadoPor: string | null;
  impulsionadoEm: string;
  vigente: boolean;
};

export type AdLimitRelease = { ativa: boolean; alteradaEm: string | null; alteradaPor: string | null; preservados: number };

/** Banner no painel: além do público, traz rascunhos e os campos de edição. */
export type AdminBanner = HomeBanner & { ativo: boolean; exibirNumeros: boolean; atualizadoEm: string };
export type BannerData = Pick<
  AdminBanner,
  | 'textoAlternativo'
  | 'titulo'
  | 'subtitulo'
  | 'link'
  | 'textoBotao'
  | 'exibirTexto'
  | 'focoX'
  | 'focoY'
  | 'ativo'
  | 'ajuste'
  | 'duracaoSegundos'
  | 'exibirNumeros'
  | 'focoXCelular'
  | 'focoYCelular'
  | 'exibirEm'
>;
export type BannerSet = { id: string; nome: string; bannerIds: string[]; atualizadoEm: string };

export type ModerationStatus = 'ABERTAS' | 'ENCERRADAS';
export type ModerationConversation = {
  id: string;
  anuncioId: string;
  tituloAnuncio: string;
  anuncianteId: string;
  anuncianteNome: string;
  interessadoId: string;
  interessadoNome: string;
  totalMensagens: number;
  ultimaMensagem: string | null;
  ultimaMensagemEm: string | null;
  criadaEm: string;
  encerradaEm: string | null;
  motivoEncerramento: string | null;
};
export type ModerationPage = { conversas: ModerationConversation[]; pagina: number; temProxima: boolean };

const enc = encodeURIComponent;

/** Fotos em revisão manual (adminPhotoReviewApi do site): aprovar borra as placas e publica; recusar avisa o anunciante. */
export const adminPhotoReviewApi = {
  list: (pagina: number, signal?: AbortSignal) =>
    request<PhotosInReviewPage>('/admin/anuncios/fotos-em-revisao', { auth: true, signal, params: { pagina, tamanho: 20 } }),
  summary: (signal?: AbortSignal) =>
    request<{ emRevisao: number }>('/admin/anuncios/fotos-em-revisao/resumo', { auth: true, signal }).then((data) => data.emRevisao),
  /** O borrão da placa roda na aprovação: espera mais que o normal. */
  approve: (photo: Pick<PhotoInReview, 'origem' | 'id'>) =>
    request<void>(`/admin/anuncios/fotos-em-revisao/${photo.origem}/${enc(photo.id)}/aprovacao`, {
      method: 'POST',
      auth: true,
      timeoutMs: 60_000,
    }),
  reject: (photo: Pick<PhotoInReview, 'origem' | 'id'>, motivo: string, apagarArquivo: boolean) =>
    request<void>(`/admin/anuncios/fotos-em-revisao/${photo.origem}/${enc(photo.id)}/recusa`, {
      method: 'POST',
      body: { motivo, apagarArquivo },
      auth: true,
    }),
};

/** Painel administrativo (adminApi do site). Usuários e limite: só DONO; o resto: ADMIN e DONO. O servidor decide. */
export const adminApi = {
  observability: (signal?: AbortSignal) => request<ObservabilityPanel>('/admin/observabilidade', { auth: true, signal }),
  /** Alerta de teste só para os aparelhos de quem pediu. */
  testAlert: () => request<{ aparelhos: number }>('/admin/observabilidade/alertas/teste', { method: 'POST', auth: true }),

  users: (filters: AdminUserFilters, signal?: AbortSignal) =>
    request<AdminUsersPage>('/admin/usuarios', { auth: true, signal, params: { ...filters, tamanho: 25 } }),
  changeAccess: (usuarioId: string, change: { papel?: PapelAdministravel; ativo?: boolean }) =>
    request<{ id: string; papel: string; ativo: boolean }>(`/admin/usuarios/${enc(usuarioId)}/acesso`, {
      method: 'PATCH',
      body: change,
      auth: true,
    }),
  currentPlans: async (usuarioIds: string[], signal?: AbortSignal) => {
    if (!usuarioIds.length) return {} as Record<string, AdminSubscription>;
    return request<Record<string, AdminSubscription>>('/admin/assinaturas/vigentes', {
      auth: true,
      signal,
      params: { usuarioIds: usuarioIds.join(',') },
    });
  },
  subscriptions: (usuarioId: string, signal?: AbortSignal) =>
    request<AdminSubscription[]>(`/admin/assinaturas/usuarios/${enc(usuarioId)}`, { auth: true, signal }),
  grantPlan: (usuarioId: string, grant: { plano: string; fimEm: string; observacao?: string }) =>
    request<AdminSubscription>(`/admin/assinaturas/usuarios/${enc(usuarioId)}/concessoes`, { method: 'POST', body: grant, auth: true }),
  endSubscription: (assinaturaId: string) =>
    request<AdminSubscription>(`/admin/assinaturas/${enc(assinaturaId)}/encerrar`, { method: 'POST', auth: true }),
  /**
   * DONO informa só nome, e-mail e senha. CLIENTE e ADMIN exigem o cadastro completo e o aceite dos termos vigentes,
   * que o DONO confirma em nome do titular.
   */
  createUser: (values: AccountDraft, papel: PapelAdministravel, versions: TermsVersions) => {
    const body =
      papel === 'DONO'
        ? { papel, nome: values.nome, email: values.email, senha: values.senha, confirmacaoSenha: values.senha }
        : { ...registrationPayload({ ...values, confirmacaoSenha: values.senha ?? '' }, versions, true), papel };
    return request<{ id: string }>('/usuarios/registrar', { method: 'POST', body, auth: true, timeoutMs: 30_000 });
  },
  updateBasic: (usuarioId: string, change: { nome: string; email: string }) =>
    request<unknown>(`/usuarios/${enc(usuarioId)}`, { method: 'PATCH', body: change, auth: true }),
  deleteUser: (usuarioId: string) => request<void>(`/usuarios/${enc(usuarioId)}`, { method: 'DELETE', auth: true }),
};

export const adLimitApi = {
  get: (signal?: AbortSignal) => request<AdLimitRelease>('/admin/anuncios/liberacao-limite', { auth: true, signal }),
  set: (ativa: boolean) => request<AdLimitRelease>('/admin/anuncios/liberacao-limite', { method: 'PUT', body: { ativa }, auth: true }),
};

export const boostsApi = {
  list: (signal?: AbortSignal) => request<AdBoost[]>('/admin/anuncios/impulsos', { auth: true, signal }),
  boost: (anuncioId: string, prioridade: 1 | 2 | 3, dias: number | null) =>
    request<void>(`/admin/anuncios/${enc(anuncioId)}/impulso`, { method: 'PUT', body: { prioridade, dias }, auth: true }),
  remove: (anuncioId: string) => request<void>(`/admin/anuncios/${enc(anuncioId)}/impulso`, { method: 'DELETE', auth: true }),
};

function bannerForm(field: string, image: UploadFile, data?: BannerData, mobile?: UploadFile | null) {
  const form = new FormData();
  form.append(field, image as unknown as Blob);
  if (mobile) form.append('imagemCelular', mobile as unknown as Blob);
  if (data) {
    Object.entries(data).forEach(([key, value]) => {
      if (value !== null && value !== undefined && value !== '') form.append(key, String(value));
    });
  }
  return form;
}

/** Banners da tela inicial (homeBannersAdminApi do site). */
export const bannersApi = {
  list: (signal?: AbortSignal) => request<AdminBanner[]>('/admin/site/banners', { auth: true, signal }),
  create: (image: UploadFile, data: BannerData, mobile?: UploadFile | null) =>
    upload<AdminBanner>('/admin/site/banners', bannerForm('imagem', image, data, mobile), { timeoutMs: 60_000 }),
  update: (id: string, data: BannerData) =>
    request<AdminBanner>(`/admin/site/banners/${enc(id)}`, { method: 'PATCH', body: data, auth: true }),
  replaceImage: (id: string, image: UploadFile) =>
    upload<AdminBanner>(`/admin/site/banners/${enc(id)}/imagem`, bannerForm('imagem', image), { method: 'PUT', timeoutMs: 60_000 }),
  replaceMobileImage: (id: string, image: UploadFile) =>
    upload<AdminBanner>(`/admin/site/banners/${enc(id)}/imagem-celular`, bannerForm('imagem', image), {
      method: 'PUT',
      timeoutMs: 60_000,
    }),
  /** O celular volta a usar a imagem principal. */
  removeMobileImage: (id: string) => request<AdminBanner>(`/admin/site/banners/${enc(id)}/imagem-celular`, { method: 'DELETE', auth: true }),
  reorder: (ids: string[]) => request<AdminBanner[]>('/admin/site/banners/ordem', { method: 'PUT', body: { ids }, auth: true }),
  remove: (id: string) => request<void>(`/admin/site/banners/${enc(id)}`, { method: 'DELETE', auth: true }),
  listSets: (signal?: AbortSignal) => request<BannerSet[]>('/admin/site/banners/conjuntos', { auth: true, signal }),
  /** Salva com este nome os banners que estão no ar agora. */
  createSet: (nome: string) => request<BannerSet>('/admin/site/banners/conjuntos', { method: 'POST', body: { nome }, auth: true }),
  /** Troca o conteúdo do conjunto pelos banners no ar agora. */
  updateSet: (id: string) => request<BannerSet>(`/admin/site/banners/conjuntos/${enc(id)}`, { method: 'PUT', auth: true }),
  applySet: (id: string) => request<AdminBanner[]>(`/admin/site/banners/conjuntos/${enc(id)}/aplicacao`, { method: 'POST', auth: true }),
  /** Volta ao banner original: tira todos do ar, sem apagar. */
  applyOriginal: () => request<AdminBanner[]>('/admin/site/banners/conjuntos/original/aplicacao', { method: 'POST', auth: true }),
  removeSet: (id: string) => request<void>(`/admin/site/banners/conjuntos/${enc(id)}`, { method: 'DELETE', auth: true }),
};

/** Moderação do chat: só leitura; abrir uma conversa registra o acesso no servidor. */
export const moderationApi = {
  list: (params: { termo?: string; situacao?: ModerationStatus; pagina?: number }, signal?: AbortSignal) =>
    request<ModerationPage>('/chat/moderacao/conversas', { auth: true, signal, params }),
  open: (id: string, signal?: AbortSignal) =>
    request<ModerationConversation>(`/chat/moderacao/conversas/${enc(id)}`, { auth: true, signal }),
  messages: (id: string, antes?: string, signal?: AbortSignal) =>
    request<ChatMessagesPage>(`/chat/moderacao/conversas/${enc(id)}/mensagens`, {
      auth: true,
      signal,
      params: { antes, tamanho: 50 },
    }),
};

/** Promoções de todos os anunciantes (só DONO). Editar, pausar e excluir usam o promotionsApi comum. */
export const adminPromotionsApi = {
  all: (busca: string, signal?: AbortSignal) =>
    request<Promotion[]>('/admin/promocoes', { auth: true, signal, params: { busca: busca || undefined } }),
};
