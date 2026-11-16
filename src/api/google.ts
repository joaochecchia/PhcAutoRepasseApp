import * as Linking from 'expo-linking';
import * as WebBrowser from 'expo-web-browser';

import { authApi } from './auth';
import { apiOrigin } from './client';
import { createPkcePair } from '@/utils/pkce';

export type GoogleOutcome =
  | { kind: 'authenticated' }
  | { kind: 'new-account'; ticket: string }
  | { kind: 'cancelled' }
  | { kind: 'error'; message: string };

const errors: Record<string, string> = {
  conta_existente:
    'Já existe uma conta com este e-mail. Entre com e-mail e senha; depois você pode vincular o Google pelo site.',
  autenticacao_cancelada: 'O login com Google foi cancelado.',
  dados_indisponiveis: 'Não foi possível confirmar sua conta Google. Tente novamente.',
};

/**
 * Login com Google, como no site, mas voltando ao app:
 * 1. abre o Google no navegador do sistema (o app nunca vê a senha do Google);
 * 2. o backend volta para o app com um código de uso único (60 s) ou, se a conta é nova, com o ticket de cadastro;
 * 3. o app troca o código pela sessão provando o PKCE.
 *
 * O endereço de volta é o do app: phcauto://auth no app instalado e exp://.../--/auth no Expo Go. O backend só
 * aceita endereços da lista OAUTH2_APP_REDIRECTS.
 */
export async function signInWithGoogle(): Promise<GoogleOutcome> {
  const { verifier, challenge } = await createPkcePair();
  const redirect = Linking.createURL('auth');
  const url =
    `${apiOrigin}/oauth2/authorization/google?app=1` +
    `&retorno=${encodeURIComponent(redirect)}&desafio=${encodeURIComponent(challenge)}`;

  const result = await WebBrowser.openAuthSessionAsync(url, redirect);
  if (result.type !== 'success') return { kind: 'cancelled' };

  const { queryParams } = Linking.parse(result.url);
  const value = (key: string) => {
    const raw = queryParams?.[key];
    return typeof raw === 'string' ? raw : null;
  };
  const erro = value('erro');
  if (erro) return { kind: 'error', message: errors[erro] ?? 'Não foi possível entrar com Google.' };
  const ticket = value('social_token');
  if (ticket) return { kind: 'new-account', ticket };
  const codigo = value('codigo');
  if (!codigo) return { kind: 'error', message: 'O Google não devolveu a confirmação. Tente novamente.' };
  await authApi.exchangeGoogleCode(codigo, verifier);
  return { kind: 'authenticated' };
}
