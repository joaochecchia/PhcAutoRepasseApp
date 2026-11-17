import { useQuery } from '@tanstack/react-query';

import { authApi } from '@/api/auth';
import { useSession } from '@/hooks/use-session';

/** Chave do cache da conta logada (perfil completo). Não confundir com o perfil público de um vendedor. */
export const accountQueryKey = (usuarioId: string | null) => ['account', usuarioId] as const;

/** Perfil da pessoa logada (GET /usuarios/{id}); sem sessão, fica parado. */
export function useAccount() {
  const session = useSession();
  const usuarioId = session.status === 'authenticated' ? session.user.usuarioId : null;
  const query = useQuery({
    queryKey: accountQueryKey(usuarioId),
    queryFn: ({ signal }) => authApi.profile(usuarioId!, signal),
    enabled: Boolean(usuarioId),
  });
  return { ...query, usuarioId };
}
