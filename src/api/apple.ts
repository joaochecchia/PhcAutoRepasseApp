import * as AppleAuthentication from 'expo-apple-authentication';
import * as Crypto from 'expo-crypto';
import { Platform } from 'react-native';

import { authApi } from './auth';
import { createPkcePair, randomUrlSafe } from '@/utils/pkce';

export type AppleOutcome =
  | { kind: 'authenticated' }
  | { kind: 'new-account'; ticket: string; verifier: string }
  | { kind: 'cancelled' };

/** Só no iPhone (iOS 13+). No Android e na web o botão não aparece. */
export async function appleSignInAvailable() {
  if (Platform.OS !== 'ios') return false;
  return AppleAuthentication.isAvailableAsync().catch(() => false);
}

/**
 * "Entrar com Apple" nativo (folha do sistema, Face ID), sem navegador:
 * 1. o app gera um nonce e passa à Apple o SHA-256 dele; a Apple o devolve dentro do token assinado;
 * 2. o backend confere o token pelas chaves públicas da Apple e o nonce original, contra a reutilização do token;
 * 3. conta nova segue para o cadastro com o ticket, preso ao PKCE como no Google.
 *
 * O nome só vem na primeira autorização da Apple (e a pessoa pode omiti-lo); sem ele, o cadastro pede o nome.
 */
export async function signInWithApple(): Promise<AppleOutcome> {
  const nonce = randomUrlSafe(32);
  const hashedNonce = await Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, nonce);
  let credential: AppleAuthentication.AppleAuthenticationCredential;
  try {
    credential = await AppleAuthentication.signInAsync({
      requestedScopes: [
        AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
        AppleAuthentication.AppleAuthenticationScope.EMAIL,
      ],
      nonce: hashedNonce,
    });
  } catch (error) {
    if ((error as { code?: string }).code === 'ERR_REQUEST_CANCELED') return { kind: 'cancelled' };
    throw new Error('Não foi possível entrar com Apple. Tente de novo.');
  }
  if (!credential.identityToken) throw new Error('A Apple não devolveu a confirmação. Tente de novo.');

  const { verifier, challenge } = await createPkcePair();
  const nome = [credential.fullName?.givenName, credential.fullName?.familyName].filter(Boolean).join(' ');
  const outcome = await authApi.appleSignIn({ identityToken: credential.identityToken, nonce, nome, desafio: challenge });
  return outcome.kind === 'new-account' ? { kind: 'new-account', ticket: outcome.ticket, verifier } : outcome;
}
