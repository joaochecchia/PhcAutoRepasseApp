import Constants from 'expo-constants';
import { Platform } from 'react-native';

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
  ) {
    super(message);
  }
}

type Query = Record<string, string | number | boolean | null | undefined>;

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
    for (const key of ['mensagem', 'message', 'detail', 'erro']) {
      if (typeof record[key] === 'string' && record[key]) return record[key] as string;
    }
  }
  if (status === 404) return 'Não encontramos o que você procurava.';
  if (status === 429) return 'Muitas tentativas seguidas. Aguarde um pouco e tente de novo.';
  if (status >= 500) return 'O servidor teve um problema. Tente de novo em instantes.';
  return 'Não foi possível concluir. Tente de novo.';
}

export async function getJson<T>(path: string, params?: Query, init?: { signal?: AbortSignal; timeoutMs?: number }) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), init?.timeoutMs ?? 15_000);
  init?.signal?.addEventListener('abort', () => controller.abort());
  let response: Response;
  try {
    response = await fetch(`${apiBase}${path}${queryString(params)}`, {
      headers: { Accept: 'application/json' },
      signal: controller.signal,
    });
  } catch {
    if (init?.signal?.aborted) throw new ApiError('Cancelado', null);
    throw new ApiError('Sem conexão com o servidor. Confira a internet e tente de novo.', null);
  } finally {
    clearTimeout(timeout);
  }
  const text = await response.text();
  const body = text ? safeJson(text) : null;
  if (!response.ok) throw new ApiError(messageFrom(body, response.status), response.status);
  return body as T;
}

function safeJson(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}
