import { useQuery } from '@tanstack/react-query';

import { adminPhotoReviewApi } from '@/api/admin';

/**
 * Fotos que a moderação automática deixou para a equipe, para o Menu e o painel (só ADMIN e DONO). A chave fica sob
 * ['admin', 'photo-review'], então cada aprovação ou recusa no painel já atualiza o número.
 */
export function usePhotosInReview(enabled: boolean) {
  return useQuery({
    queryKey: ['admin', 'photo-review', 'resumo'],
    queryFn: ({ signal }) => adminPhotoReviewApi.summary(signal),
    enabled,
    staleTime: 30_000,
  });
}
