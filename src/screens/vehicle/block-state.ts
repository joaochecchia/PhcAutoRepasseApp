/**
 * Estado do controle "Bloquear anunciante", sem React, para os testes (node --test). A ação só existe quando a lista
 * de bloqueios foi carregada: com o estado desconhecido, o botão fica visível, mas sem agir.
 */

export type BlocksQuery = {
  status: 'pending' | 'error' | 'success';
  data?: { usuarioId: string }[];
  isFetching: boolean;
};

export type BlockControl =
  | { kind: 'loading'; label: string }
  | { kind: 'error'; label: string; message: string }
  | { kind: 'ready'; blocked: boolean; label: string; next: boolean };

export function blockControl(sellerId: string, query: BlocksQuery): BlockControl {
  if (query.status === 'success' && query.data) {
    const blocked = query.data.some((item) => item.usuarioId === sellerId);
    return blocked
      ? { kind: 'ready', blocked, label: 'Anunciante bloqueado · Desbloquear', next: false }
      : { kind: 'ready', blocked, label: 'Bloquear anunciante', next: true };
  }
  if (query.status === 'error' && !query.isFetching)
    return { kind: 'error', label: 'Tentar novamente', message: 'Não conseguimos conferir se você bloqueou este anunciante.' };
  return { kind: 'loading', label: 'Conferindo bloqueio…' };
}
