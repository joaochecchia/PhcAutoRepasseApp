/**
 * Passagens entre telas que não podem ir na rota (rota é endereço; segredo não vai em endereço).
 * Ficam só na memória e são lidas uma vez.
 */
type SocialSignup = { ticket: string; verifier: string };
type PendingCode = { challengeId: string; email: string | null };

let social: SocialSignup | null = null;
let pendingCode: PendingCode | null = null;

export const authHandoff = {
  /** Google confirmou uma conta que ainda não existe: o cadastro continua com este ticket. */
  setSocial(value: SocialSignup) {
    social = value;
  },
  peekSocial: () => social,
  clearSocial() {
    social = null;
  },
  /** Conta criada e o login pediu o código por e-mail: a tela de login abre direto no código. */
  setPendingCode(value: PendingCode) {
    pendingCode = value;
  },
  takePendingCode() {
    const value = pendingCode;
    pendingCode = null;
    return value;
  },
};
