import { useQuery } from '@tanstack/react-query';

import { adminReportsApi } from '@/api/reports';

/**
 * Denúncias aguardando análise, para o Menu e o painel (só ADMIN e DONO). A chave fica sob ['admin', 'reports'], então
 * qualquer providência ou decisão no painel já atualiza o número.
 */
export function useOpenReports(enabled: boolean) {
  return useQuery({
    queryKey: ['admin', 'reports', 'resumo'],
    queryFn: ({ signal }) => adminReportsApi.summary(signal).then((data) => data.abertas),
    enabled,
    staleTime: 30_000,
  });
}
