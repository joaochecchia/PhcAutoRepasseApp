import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useRef } from 'react';

import { useChatUnread } from '@/api/chat-socket';
import { noticesApi } from '@/api/notices';
import { useSession } from '@/hooks/use-session';

export const noticesSummaryKey = (usuarioId: string | null) => ['notices-summary', usuarioId] as const;

/**
 * Contador de avisos da conta, como no site (useAccountNotices): a cada 2 min, o ritmo da varredura da fila de
 * espera. Mensagem nova também cria aviso, então o contador acompanha o do chat na hora.
 */
export function useNoticesSummary() {
  const session = useSession();
  const usuarioId = session.status === 'authenticated' ? session.user.usuarioId : null;
  const queryClient = useQueryClient();
  const chatUnread = useChatUnread();
  const previous = useRef(chatUnread);
  useEffect(() => {
    if (previous.current === chatUnread) return;
    previous.current = chatUnread;
    queryClient.invalidateQueries({ queryKey: noticesSummaryKey(usuarioId) });
  }, [chatUnread, usuarioId, queryClient]);
  return useQuery({
    queryKey: noticesSummaryKey(usuarioId),
    queryFn: ({ signal }) => noticesApi.summary(signal),
    enabled: Boolean(usuarioId),
    refetchInterval: 120_000,
  });
}
