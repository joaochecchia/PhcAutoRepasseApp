/**
 * Regras da tela de exclusão de conta, sem React, para os testes (node --test). O servidor decide e revoga; aqui só
 * se escolhe o que mostrar e quando o botão pode ser usado.
 */

import type { AppleRevocation } from '@/api/contracts';

/** Estado da consulta do perfil (GET /usuarios/{id}) no formato do TanStack Query. */
export type ProfileQuery = {
  status: 'pending' | 'error' | 'success';
  data?: { contaApple?: boolean; appleRevogavel?: boolean };
};

export type DeletionGate =
  | { kind: 'loading' }
  | { kind: 'error' }
  /**
   * appleRevocable: o servidor já guarda o token e revoga sozinho. appleConfirmation: no iPhone, numa conta Apple sem
   * token guardado, a Apple confirma antes de excluir.
   */
  | { kind: 'ready'; appleAccount: boolean; appleRevocable: boolean; appleConfirmation: boolean };

/**
 * Sem o perfil não se sabe se a conta usa "Entrar com Apple": a exclusão só fica disponível com o perfil carregado,
 * para nunca excluir sem o tratamento da revogação por falta de informação.
 */
export function deletionGate(platform: string, profile: ProfileQuery): DeletionGate {
  if (profile.status === 'pending') return { kind: 'loading' };
  if (profile.status === 'error' || !profile.data) return { kind: 'error' };
  const appleAccount = profile.data.contaApple === true;
  const appleRevocable = appleAccount && profile.data.appleRevogavel === true;
  return {
    kind: 'ready',
    appleAccount,
    appleRevocable,
    appleConfirmation: platform === 'ios' && appleAccount && !appleRevocable,
  };
}

/** Recusa na etapa da Apple (folha cancelada, erro da Apple ou do backend ao conferir): dá para excluir sem ela. */
export class AppleStepError extends Error {}

/** Erros do backend na conferência da Apple vêm com título próprio (ProblemDetail). */
export function isAppleStepError(error: unknown): boolean {
  if (error instanceof AppleStepError) return true;
  const body = (error as { body?: unknown } | null)?.body;
  const title = body && typeof body === 'object' ? (body as { title?: unknown }).title : undefined;
  return typeof title === 'string' && title.includes('Apple');
}

/** Página oficial da Apple para remover um app da conta Apple ("Iniciar sessão com a Apple"). */
export const APPLE_MANAGE_URL = 'https://support.apple.com/pt-br/102571';

export type DeletionOutcome = { title: string; message: string; appleHelp: boolean };

/** Mensagem final, sem prometer revogação que a Apple não confirmou. */
export function deletionOutcome(revocation: AppleRevocation | undefined): DeletionOutcome {
  const base = 'Seus dados e anúncios foram apagados.';
  if (revocation === 'PENDENTE')
    return {
      title: 'Conta excluída',
      message: `${base} A Apple não respondeu agora: vamos encerrar o acesso do PHC Auto na sua conta Apple automaticamente nas próximas horas.`,
      appleHelp: false,
    };
  if (revocation === 'SEM_TOKEN')
    return {
      title: 'Conta excluída',
      message: `${base} Falta encerrar o acesso do PHC Auto na sua conta Apple: no iPhone, abra Ajustes, toque no seu nome e em "Iniciar sessão com a Apple", escolha PHC Auto e pare de usar.`,
      appleHelp: true,
    };
  return { title: 'Conta excluída', message: base, appleHelp: false };
}
