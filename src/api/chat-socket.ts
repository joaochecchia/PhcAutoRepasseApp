import { Client, type IMessage } from '@stomp/stompjs';
import { useEffect, useSyncExternalStore } from 'react';

import { chatApi, type ChatEvent, type ChatMessage } from './chat';
import { apiOrigin, renewSession } from './client';
import { sessionStore } from './session-store';

/**
 * Chat em tempo real: STOMP sobre WebSocket em /api/v1/chat/ws, como no site (lib/chatSocket.ts).
 * O site usa o cookie no handshake; o app manda o token de acesso no cabeçalho Authorization (o backend aceita os
 * dois). O servidor fecha a conexão quando o acesso vence; antes de reconectar, a sessão é renovada.
 * Sem conexão, envio e leitura caem na API REST.
 */
type Confirmation = { idCliente: string | null; ok: boolean; mensagem: ChatMessage | null; erro: string | null };
type Pending = { resolve: (message: ChatMessage) => void; reject: (error: Error) => void; timer: ReturnType<typeof setTimeout> };

const eventListeners = new Set<(event: ChatEvent) => void>();
const statusListeners = new Set<() => void>();
const unreadListeners = new Set<() => void>();
const pending = new Map<string, Pending>();
let client: Client | null = null;
let unread = 0;

const brokerUrl = `${apiOrigin.replace(/^http/, 'ws')}/api/v1/chat/ws`;

/** O WebSocket do React Native aceita cabeçalhos no 3º argumento (o tipo global segue o do navegador, que não aceita). */
const NativeWebSocket = WebSocket as unknown as new (
  url: string,
  protocols: string[],
  options: { headers: Record<string, string> },
) => WebSocket;

function setUnread(total: number) {
  unread = Math.max(0, total);
  unreadListeners.forEach((listener) => listener());
}
function notifyStatus() {
  statusListeners.forEach((listener) => listener());
}

/** Recalcula as não lidas pela API (e garante um acesso válido antes do handshake). */
export function refreshChatUnread() {
  return chatApi.unread().then(setUnread);
}

/** Liga o chat para a pessoa logada; idempotente. */
export function startChat() {
  if (client) return;
  const stomp = new Client({
    brokerURL: brokerUrl,
    reconnectDelay: 4000,
    heartbeatIncoming: 20000,
    heartbeatOutgoing: 20000,
    // O WebSocket do React Native perde o caractere NULL dos quadros; estas opções são as indicadas pelo stompjs.
    forceBinaryWSFrames: true,
    appendMissingNULLonIncoming: true,
    webSocketFactory: () =>
      new NativeWebSocket(brokerUrl, ['v12.stomp', 'v11.stomp', 'v10.stomp'], {
        headers: { Authorization: `Bearer ${sessionStore.accessToken() ?? ''}`, 'X-PHC-Cliente': 'app' },
      }),
    beforeConnect: async () => {
      try {
        if (!sessionStore.accessToken() && !(await renewSession())) {
          stopChat();
          return;
        }
        await refreshChatUnread();
      } catch {
        // Sem rede: o stompjs tenta de novo em alguns segundos.
      }
    },
    onConnect: () => {
      stomp.subscribe('/user/queue/chat', handleEvent);
      stomp.subscribe('/user/queue/confirmacoes', handleConfirmation);
      stomp.subscribe('/user/queue/erros', handleConfirmation);
      notifyStatus();
    },
    onWebSocketClose: () => notifyStatus(),
    onStompError: () => notifyStatus(),
  });
  client = stomp;
  stomp.activate();
}

export function stopChat() {
  const current = client;
  client = null;
  pending.forEach((item) => {
    clearTimeout(item.timer);
    item.reject(new Error('Chat desconectado'));
  });
  pending.clear();
  setUnread(0);
  if (current) void current.deactivate();
  notifyStatus();
}

function handleEvent(frame: IMessage) {
  let event: ChatEvent;
  try {
    event = JSON.parse(frame.body) as ChatEvent;
  } catch {
    return;
  }
  if (event.tipo === 'MENSAGEM' && !event.minha) {
    setUnread(unread + 1);
    // Chegou ao aparelho: confirma a entrega (✓✓ cinza para quem enviou).
    client?.publish({ destination: '/app/chat/entrega', body: JSON.stringify({ conversaId: event.conversaId }) });
  }
  if (event.tipo === 'LEITURA' && event.porMim) void refreshChatUnread().catch(() => undefined);
  eventListeners.forEach((listener) => listener(event));
}

function handleConfirmation(frame: IMessage) {
  let confirmation: Confirmation;
  try {
    confirmation = JSON.parse(frame.body) as Confirmation;
  } catch {
    return;
  }
  if (!confirmation.idCliente) return;
  const item = pending.get(confirmation.idCliente);
  if (!item) return;
  pending.delete(confirmation.idCliente);
  clearTimeout(item.timer);
  if (confirmation.ok && confirmation.mensagem) item.resolve(confirmation.mensagem);
  else item.reject(new Error(confirmation.erro || 'Não foi possível enviar a mensagem.'));
}

const clientId = () => `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;

/** Envia pelo WebSocket quando conectado; senão, pela API. */
export function sendChatMessage(conversaId: string, texto: string): Promise<ChatMessage> {
  const stomp = client;
  if (!stomp?.connected) return chatApi.send(conversaId, texto);
  const idCliente = clientId();
  return new Promise<ChatMessage>((resolve, reject) => {
    const timer = setTimeout(() => {
      pending.delete(idCliente);
      reject(new Error('A mensagem demorou para ser confirmada. Confira a conversa antes de reenviar.'));
    }, 12_000);
    pending.set(idCliente, { resolve, reject, timer });
    stomp.publish({ destination: '/app/chat/mensagens', body: JSON.stringify({ conversaId, texto, idCliente }) });
  });
}

const lastTyping = new Map<string, number>();

/** "Digitando…" para o outro lado, no máximo a cada 3 s por conversa. Sem conexão, não envia nada. */
export function signalTyping(conversaId: string) {
  const stomp = client;
  if (!stomp?.connected) return;
  const now = Date.now();
  if (now - (lastTyping.get(conversaId) ?? 0) < 3000) return;
  lastTyping.set(conversaId, now);
  stomp.publish({ destination: '/app/chat/digitando', body: JSON.stringify({ conversaId }) });
}

export function resetTyping(conversaId: string) {
  lastTyping.delete(conversaId);
}

export function markChatRead(conversaId: string) {
  const stomp = client;
  if (stomp?.connected) {
    stomp.publish({ destination: '/app/chat/leitura', body: JSON.stringify({ conversaId }) });
    return Promise.resolve();
  }
  return chatApi.markRead(conversaId).then(() => refreshChatUnread());
}

export function useChatEvents(listener: (event: ChatEvent) => void) {
  useEffect(() => {
    eventListeners.add(listener);
    return () => {
      eventListeners.delete(listener);
    };
  }, [listener]);
}

const subscribeStatus = (listener: () => void) => {
  statusListeners.add(listener);
  return () => {
    statusListeners.delete(listener);
  };
};
const subscribeUnread = (listener: () => void) => {
  unreadListeners.add(listener);
  return () => {
    unreadListeners.delete(listener);
  };
};

export function useChatConnected() {
  return useSyncExternalStore(subscribeStatus, () => Boolean(client?.connected));
}

export function useChatUnread() {
  return useSyncExternalStore(subscribeUnread, () => unread);
}
