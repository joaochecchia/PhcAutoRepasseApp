import { request } from './client';

export type ChatConversation = {
  id: string; anuncioId: string; tituloAnuncio: string; papel: 'ANUNCIANTE' | 'INTERESSADO';
  outroId: string; outroNome: string; ultimaMensagem: string | null; ultimaMensagemEm: string | null;
  ultimaMensagemMinha: boolean; naoLidas: number; outroRecebeuAte: string | null;
  outroLeuAte: string | null; encerradaEm: string | null; motivoEncerramento: string | null;
};
export type ChatMessage = { id: string; conversaId: string; autorId: string; texto: string; enviadaEm: string };
export type ChatMessagesPage = { mensagens: ChatMessage[]; temMais: boolean };

export const chatApi = {
  conversations: (signal?: AbortSignal) => request<ChatConversation[]>('/chat/conversas', { auth: true, signal }),
  start: (anuncioId: string) => request<ChatConversation>('/chat/conversas', { method: 'POST', body: { anuncioId }, auth: true }),
  conversation: (id: string, signal?: AbortSignal) => request<ChatConversation>(`/chat/conversas/${encodeURIComponent(id)}`, { auth: true, signal }),
  messages: (id: string, antes?: string, signal?: AbortSignal) => request<ChatMessagesPage>(`/chat/conversas/${encodeURIComponent(id)}/mensagens`, { auth: true, params: { antes, tamanho: 50 }, signal }),
  send: (id: string, texto: string) => request<ChatMessage>(`/chat/conversas/${encodeURIComponent(id)}/mensagens`, { method: 'POST', body: { texto }, auth: true }),
  markRead: (id: string) => request<void>(`/chat/conversas/${encodeURIComponent(id)}/leitura`, { method: 'POST', auth: true }),
  unread: async (signal?: AbortSignal) => (await request<{ total: number }>('/chat/nao-lidas', { auth: true, signal })).total,
};

export type ChatEvent =
  | { tipo: 'MENSAGEM'; conversaId: string; mensagem: ChatMessage; minha: boolean }
  | { tipo: 'LEITURA'; conversaId: string; lidaAte: string; porMim: boolean }
  | { tipo: 'ENCERRADA'; conversaId: string; motivoEncerramento: string }
  | { tipo: 'ENTREGA'; conversaId: string; entregueAte: string }
  | { tipo: 'DIGITANDO'; conversaId: string };
