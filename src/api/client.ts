import Constants from 'expo-constants';
import * as Device from 'expo-device';
import { Platform } from 'react-native';

import { sessionStore, type AppTokens } from './session-store';

/**
 * Origem do backend (sem /api/v1).
 * 1. EXPO_PUBLIC_API_URL, quando definido (ex.: https://phcauto.com).
 * 2. Em desenvolvimento, a mesma máquina que serve o Metro, na porta 8080. O celular com Expo Go só alcança esse
 *    endereço se o backend escutar na rede (BACKEND_BIND=0.0.0.0); veja AGENTS.md.
 */
function resolveOrigin(): string {
  const explicit = process.env.EXPO_PUBLIC_API_URL?.trim();
  if (explicit) return explicit.replace(/\/+$/, '');
  if (Platform.OS === 'web' && typeof window !== 'undefined') {
    return `${window.location.protocol}//${window.location.hostname}:8080`;
  }
  const host = Constants.expoConfig?.hostUri?.split(':')[0];
  if (host) return `http://${host}:8080`;
  return Platform.OS === 'android' ? 'http://10.0.2.2:8080' : 'http://127.0.0.1:8080';
}

export const apiOrigin = resolveOrigin();
const apiBase = `${apiOrigin}/api/v1`;

/**
 * Todo pedido se identifica como app (backend: ClienteApp): tokens no corpo, sem cookies, sem CSRF.
 * O User-Agent precisa ser o mesmo do login à confirmação do código (o backend confere) e dá nome ao aparelho
 * na lista de dispositivos confiáveis.
 */
const appHeaders: Record<string, string> = {
  Accept: 'application/json',
  'X-PHC-Cliente': 'app',
  ...(Platform.OS === 'web'
    ? {}
    : {
        'User-Agent': `PHC Auto App (${Platform.OS === 'ios' ? 'iOS' : 'Android'}; ${Device.modelName ?? 'celular'})`,
      }),
};

/** Fotos e mídias chegam como caminhos relativos (/api/v1/...). */
export function mediaUrl(path: string | null | undefined): string | null {
  if (!path) return null;
  if (/^https?:\/\//.test(path)) return path;
  return `${apiOrigin}${path.startsWith('/') ? '' : '/'}${path}`;
}

export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number | null,
    readonly body: unknown = null,
  ) {
    super(message);
  }
}

type Query = Record<string, string | number | boolean | null | undefined>;
type RequestOptions = {
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  params?: Query;
  body?: unknown;
  /** Envia o token de acesso e renova a sessão uma vez em caso de 401. */
  auth?: boolean;
  signal?: AbortSignal;
  timeoutMs?: number;
};

function queryString(params?: Query) {
  if (!params) return '';
  const pairs = Object.entries(params)
    .filter(([, value]) => value !== undefined && value !== null && value !== '')
    .map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(String(value))}`);
  return pairs.length ? `?${pairs.join('&')}` : '';
}

/** Mensagem legível a partir do corpo de erro do backend (mesma ideia do apiErrorMessage do site). */
function messageFrom(body: unknown, status: number): string {
  if (body && typeof body === 'object') {
    const record = body as Record<string, unknown>;
    for (const key of ['mensagem', 'detail', 'message', 'erro']) {
      if (typeof record[key] === 'string' && record[key]) return record[key] as string;
    }
  }
  if (status === 401) return 'Sua sessão terminou. Entre novamente.';
  if (status === 403) return 'Você não tem permissão para isso.';
  if (status === 404) return 'Não encontramos o que você procurava.';
  if (status === 429) return 'Muitas tentativas seguidas. Aguarde um pouco e tente de novo.';
  if (status >= 500) return 'O servidor teve um problema. Tente de novo em instantes.';
  return 'Não foi possível concluir. Tente de novo.';
}

function safeJson(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

async function send<T>(path: string, options: RequestOptions, accessToken: string | null): Promise<T> {
  const controller = new AbortController();
  let timedOut = false;
  const timeout = setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, options.timeoutMs ?? 15_000);
  options.signal?.addEventListener('abort', () => controller.abort());
  const headers: Record<string, string> = { ...appHeaders };
  if (options.body !== undefined && !(options.body instanceof FormData)) headers['Content-Type'] = 'application/json';
  if (accessToken) headers.Authorization = `Bearer ${accessToken}`;
  let response: Response;
  try {
    response = await fetch(`${apiBase}${path}${queryString(options.params)}`, {
      method: options.method ?? 'GET',
      headers,
      body: options.body === undefined ? undefined : options.body instanceof FormData ? options.body : JSON.stringify(options.body),
      credentials: 'omit',
      signal: controller.signal,
    });
  } catch {
    if (options.signal?.aborted) throw new ApiError('Cancelado', null);
    if (timedOut) throw new ApiError('O servidor demorou para responder. Tente de novo.', null, { reason: 'timeout' });
    throw new ApiError('Sem conexão com o servidor. Confira a internet e tente de novo.', null);
  } finally {
    clearTimeout(timeout);
  }
  const text = await response.text();
  const body = text ? safeJson(text) : null;
  if (!response.ok) throw new ApiError(messageFrom(body, response.status), response.status, body);
  return body as T;
}

type RefreshResponse = { autenticado: boolean; usuarioId: string; papel: string; tokens: AppTokens };
let refreshing: Promise<boolean> | null = null;

/**
 * Renova a sessão com o refresh guardado no aparelho. Pedidos simultâneos compartilham a mesma renovação (o refresh
 * é de uso único: duas renovações paralelas com o mesmo token derrubariam a sessão).
 * true: renovou. false: o servidor encerrou a sessão (a pessoa precisa entrar de novo).
 * Erro de rede: lança ApiError e a sessão continua guardada para tentar depois.
 */
export function renewSession(): Promise<boolean> {
  refreshing ??= (async () => {
    const refreshToken = await sessionStore.refreshToken();
    if (!refreshToken) {
      await sessionStore.clear();
      return false;
    }
    try {
      const result = await send<RefreshResponse>('/usuarios/refresh', { method: 'POST', body: { refreshToken } }, null);
      await sessionStore.save(result.tokens, { usuarioId: result.usuarioId, papel: result.papel });
      return true;
    } catch (error) {
      if (error instanceof ApiError && (error.status === 401 || error.status === 403)) {
        await sessionStore.clear();
        return false;
      }
      throw error;
    }
  })().finally(() => {
    refreshing = null;
  });
  return refreshing;
}

export async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  if (!options.auth) return send<T>(path, options, null);
  let token = sessionStore.accessToken();
  if (!token && (await renewSession())) token = sessionStore.accessToken();
  if (!token) throw new ApiError('Entre na sua conta para continuar.', 401);
  try {
    return await send<T>(path, options, token);
  } catch (error) {
    if (!(error instanceof ApiError) || error.status !== 401) throw error;
    if (!(await renewSession())) throw new ApiError('Sua sessão terminou. Entre novamente.', 401);
    return send<T>(path, options, sessionStore.accessToken());
  }
}

export type UploadProgress = (fraction: number) => void;

/** Motivo nativo da falha, só em desenvolvimento: o fetch do React Native troca tudo por "Network request failed". */
function devDetail(detail: string) {
  return __DEV__ && detail ? ` (${detail})` : '';
}

/**
 * Envio multipart por XMLHttpRequest: dá o progresso do upload e, diferente do fetch, preserva a mensagem nativa
 * do erro (arquivo ilegível, conexão encerrada, tempo esgotado), o que permite dizer o que aconteceu.
 */
function sendUpload<T>(
  path: string,
  method: 'POST' | 'PUT',
  body: FormData,
  accessToken: string | null,
  timeoutMs: number,
  onProgress?: UploadProgress,
): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open(method, `${apiBase}${path}`);
    xhr.timeout = timeoutMs;
    Object.entries(appHeaders).forEach(([key, value]) => xhr.setRequestHeader(key, value));
    if (accessToken) xhr.setRequestHeader('Authorization', `Bearer ${accessToken}`);
    if (onProgress && xhr.upload) {
      xhr.upload.onprogress = (event) => {
        if (event.lengthComputable && event.total > 0) onProgress(Math.min(1, event.loaded / event.total));
      };
    }
    xhr.onload = () => {
      const parsed = xhr.responseText ? safeJson(xhr.responseText) : null;
      if (xhr.status >= 200 && xhr.status < 300) resolve(parsed as T);
      else reject(new ApiError(messageFrom(parsed, xhr.status), xhr.status, parsed));
    };
    xhr.ontimeout = () =>
      reject(new ApiError('O envio demorou demais. Confira a internet e tente de novo.', null, { reason: 'timeout' }));
    xhr.onerror = () =>
      reject(
        new ApiError(
          `O envio foi interrompido. Confira a internet e tente de novo.${devDetail(String(xhr.responseText || ''))}`,
          null,
          { reason: 'network' },
        ),
      );
    xhr.send(body);
  });
}

/** Falha de rede no envio, quando o servidor pode não ter recebido nada (não vale para tempo esgotado). */
export function isUploadInterrupted(error: unknown) {
  return (
    error instanceof ApiError &&
    error.status === null &&
    (error.body as { reason?: string } | null)?.reason === 'network'
  );
}

/** Upload autenticado com renovação de sessão em caso de 401, como o request. */
export async function upload<T>(
  path: string,
  body: FormData,
  options: { method?: 'POST' | 'PUT'; timeoutMs?: number; onProgress?: UploadProgress } = {},
): Promise<T> {
  const method = options.method ?? 'POST';
  const timeoutMs = options.timeoutMs ?? 120_000;
  let token = sessionStore.accessToken();
  if (!token && (await renewSession())) token = sessionStore.accessToken();
  if (!token) throw new ApiError('Entre na sua conta para continuar.', 401);
  try {
    return await sendUpload<T>(path, method, body, token, timeoutMs, options.onProgress);
  } catch (error) {
    if (!(error instanceof ApiError) || error.status !== 401) throw error;
    if (!(await renewSession())) throw new ApiError('Sua sessão terminou. Entre novamente.', 401);
    return sendUpload<T>(path, method, body, sessionStore.accessToken(), timeoutMs, options.onProgress);
  }
}

/** Atalho para leituras públicas. */
export function getJson<T>(path: string, params?: Query, init?: { signal?: AbortSignal; timeoutMs?: number }) {
  return request<T>(path, { params, signal: init?.signal, timeoutMs: init?.timeoutMs });
}
