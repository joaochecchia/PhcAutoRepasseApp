import * as Crypto from 'expo-crypto';

/** base64 → base64url sem padding (RFC 4648 §5). */
function toBase64Url(base64: string) {
  return base64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function bytesToBase64(bytes: Uint8Array) {
  let binary = '';
  bytes.forEach((byte) => {
    binary += String.fromCharCode(byte);
  });
  return globalThis.btoa(binary);
}

/** Valor aleatório seguro em base64url, sem padding (ex.: o nonce do "Entrar com Apple"). */
export function randomUrlSafe(bytes: number) {
  return toBase64Url(bytesToBase64(Crypto.getRandomBytes(bytes)));
}

/**
 * Par PKCE S256 (RFC 7636) para o login com Google: o desafio vai na ida, o verificador só na troca do código.
 * Assim, um código interceptado por outro app não serve para nada.
 */
export async function createPkcePair() {
  const verifier = toBase64Url(bytesToBase64(Crypto.getRandomBytes(32)));
  const digest = await Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, verifier, {
    encoding: Crypto.CryptoEncoding.BASE64,
  });
  return { verifier, challenge: toBase64Url(digest) };
}
