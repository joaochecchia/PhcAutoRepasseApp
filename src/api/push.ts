import { isRunningInExpoGo } from 'expo';
import Constants from 'expo-constants';
import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

import { request } from './client';
import { secureStorage } from './secure-storage';

/**
 * Tipos de aviso que o backend manda por push (AvisosUsuario.Tipo) e SISTEMA, os alertas de serviços fora do ar.
 * O servidor só manda SISTEMA para contas ADMIN e DONO, conferindo o papel a cada envio.
 */
export type PushKind = 'CHAT' | 'FILA_ESPERA' | 'SISTEMA';
export type PushPrefs = Record<PushKind, boolean>;

export const pushKinds: { kind: PushKind; label: string; hint: string; channel: string; staffOnly?: boolean }[] = [
  { kind: 'CHAT', label: 'Mensagens', hint: 'Quando alguém responder numa conversa.', channel: 'mensagens' },
  { kind: 'FILA_ESPERA', label: 'Fila de espera', hint: 'Quando chegar um veículo do seu pedido.', channel: 'fila-espera' },
  {
    kind: 'SISTEMA',
    label: 'Alertas do sistema',
    hint: 'Serviço fora do ar (banco, Redis, Brevo, FIPE, Cielo, Google, Apple), cota da FIPE no fim e picos de erro.',
    channel: 'sistema',
    staffOnly: true,
  },
];

/**
 * Por que este aparelho não recebe push, ou "ok". No Expo Go do Android o push remoto não existe desde o SDK 53, o
 * simulador do iOS não recebe token, e sem o projeto no EAS a Expo não emite o token.
 */
export type PushSupport = 'ok' | 'web' | 'expo-go-android' | 'simulator' | 'no-project';
export type PushStatus = {
  support: PushSupport;
  permission: 'granted' | 'denied' | 'undetermined';
  /** O sistema ainda mostra o pedido de permissão (no iOS, só uma vez). */
  canAsk: boolean;
  prefs: PushPrefs;
};

const KEYS = { token: 'phc.push.token', prefs: 'phc.push.prefs' } as const;
const defaultPrefs: PushPrefs = { CHAT: true, FILA_ESPERA: true, SISTEMA: true };

export const pushApi = {
  register: (body: { token: string; plataforma: 'ios' | 'android'; tipos: PushKind[] }) =>
    request<void>('/notificacoes/aparelhos', { method: 'PUT', body, auth: true, timeoutMs: 10_000 }),
  /** Público no backend: ao sair, o aparelho deixa de receber mesmo se a sessão já tiver caído. */
  remove: (token: string) =>
    request<void>('/notificacoes/aparelhos/remocao', { method: 'POST', body: { token }, timeoutMs: 5_000 }),
};

function projectId(): string | undefined {
  const extra = Constants.expoConfig?.extra as { eas?: { projectId?: string } } | undefined;
  return extra?.eas?.projectId ?? Constants.easConfig?.projectId;
}

export function pushSupport(): PushSupport {
  if (Platform.OS === 'web') return 'web';
  if (Platform.OS === 'android' && isRunningInExpoGo()) return 'expo-go-android';
  if (!Device.isDevice && Platform.OS === 'ios') return 'simulator';
  if (!projectId()) return 'no-project';
  return 'ok';
}

export async function pushPrefs(): Promise<PushPrefs> {
  const raw = await secureStorage.get(KEYS.prefs);
  if (!raw) return defaultPrefs;
  try {
    return { ...defaultPrefs, ...(JSON.parse(raw) as Partial<PushPrefs>) };
  } catch {
    return defaultPrefs;
  }
}

export async function pushStatus(): Promise<PushStatus> {
  const support = pushSupport();
  const prefs = await pushPrefs();
  if (support === 'web') return { support, permission: 'denied', canAsk: false, prefs };
  const current = await Notifications.getPermissionsAsync();
  return { support, permission: current.status, canAsk: current.canAskAgain, prefs };
}

/**
 * Canais do Android (o backend escolhe pelo tipo). Precisam existir antes do pedido de permissão do Android 13+. O de
 * alertas do sistema só aparece nos ajustes do aparelho de quem é da administração.
 */
export async function ensurePushChannels(staff = false) {
  if (Platform.OS !== 'android') return;
  await Promise.all([
    ...pushKinds.filter((item) => staff || !item.staffOnly).map((item) =>
      Notifications.setNotificationChannelAsync(item.channel, {
        name: item.label,
        description: item.hint,
        // O lint não segue o "export *" do pacote; o tipo confere (tsc).
        // eslint-disable-next-line import/namespace
        importance: Notifications.AndroidImportance.HIGH,
        lightColor: '#cd1923',
      }),
    ),
    Notifications.setNotificationChannelAsync('avisos', {
      name: 'Outros avisos',
      // eslint-disable-next-line import/namespace
      importance: Notifications.AndroidImportance.DEFAULT,
    }),
  ]);
}

/**
 * Liga este aparelho à conta com as preferências salvas. {@code ask} mostra o pedido de permissão do sistema, se
 * ainda for possível; sem ele, só registra quando a permissão já foi dada. Devolve o estado final.
 */
export async function syncPush({ ask = false, prefs }: { ask?: boolean; prefs?: PushPrefs } = {}): Promise<PushStatus> {
  let status = await pushStatus();
  if (prefs) status = { ...status, prefs };
  if (status.support !== 'ok') return status;
  if (status.permission !== 'granted' && ask && status.canAsk) {
    await ensurePushChannels();
    const answer = await Notifications.requestPermissionsAsync();
    status = { ...status, permission: answer.status, canAsk: answer.canAskAgain };
  }
  if (status.permission !== 'granted') return status;
  const { data: token } = await Notifications.getExpoPushTokenAsync({ projectId: projectId() });
  await pushApi.register({
    token,
    plataforma: Platform.OS === 'ios' ? 'ios' : 'android',
    tipos: pushKinds.map((item) => item.kind).filter((kind) => status.prefs[kind]),
  });
  await secureStorage.set(KEYS.token, token);
  return status;
}

/**
 * Pede só a permissão do sistema, sem registrar o aparelho: serve sem sessão (na primeira abertura). O registro sai
 * quando houver sessão (PushNotifications, em use-push).
 */
export async function askPushPermission(): Promise<PushStatus> {
  const status = await pushStatus();
  if (status.support !== 'ok' || status.permission === 'granted' || !status.canAsk) return status;
  await ensurePushChannels();
  const answer = await Notifications.requestPermissionsAsync();
  return { ...status, permission: answer.status, canAsk: answer.canAskAgain };
}

const INTRO_KEY = 'phc.push.convite';

/** O convite da primeira abertura já apareceu neste aparelho? */
export async function pushInviteSeen() {
  return (await secureStorage.get(INTRO_KEY)) === '1';
}

export function markPushInviteSeen() {
  return secureStorage.set(INTRO_KEY, '1').catch(() => undefined);
}

/** Salva a escolha só depois que o servidor aceitou, para o aparelho e o servidor não divergirem. */
export async function savePushPrefs(prefs: PushPrefs) {
  const status = await syncPush({ prefs });
  await secureStorage.set(KEYS.prefs, JSON.stringify(prefs));
  return status;
}

/**
 * Ao sair da conta: o aparelho deixa de receber os avisos dela. Sem rede, o token fica guardado e a remoção é
 * tentada de novo na próxima abertura sem sessão.
 */
export async function unregisterPush() {
  const token = await secureStorage.get(KEYS.token);
  if (!token) return;
  try {
    await pushApi.remove(token);
    await secureStorage.remove(KEYS.token);
  } catch {
    // Tenta de novo depois (ver PushNotifications, em use-push).
  }
}
