import { useQuery } from '@tanstack/react-query';
import { MapPin, Store, WifiOff } from 'lucide-react-native';
import { StyleSheet, View } from 'react-native';

import { fetchStorePromotions, fetchStoreProfile } from '@/api/ads';
import { AppText } from '@/components/app-text';
import { FilteredAdList } from '@/components/filtered-ad-list';
import { PromotionCard } from '@/components/promotions';
import { Skeleton } from '@/components/skeleton';
import { StateView } from '@/components/state-view';
import { useTheme } from '@/hooks/use-theme';
import { space } from '@/theme';
import { StoreAvatar } from './index';

/** Página da loja: perfil, promoções no ar e os veículos publicados, com filtros (StoresPage do site, com o id). */
export function StoreScreen({ slug }: { slug: string }) {
  const { colors } = useTheme();
  const profile = useQuery({
    queryKey: ['store', slug],
    queryFn: async ({ signal }) => {
      const data = await fetchStoreProfile(slug, signal);
      if (data.tipoPessoa !== 'PJ' || !data.slug) throw new Error('Este perfil não é uma loja.');
      return data;
    },
  });
  const store = profile.data;
  const promotions = useQuery({
    queryKey: ['store-promotions', store?.id, null, null],
    queryFn: ({ signal }) => fetchStorePromotions(store!.id, undefined, signal),
    enabled: Boolean(store?.id),
  });

  if (profile.isError)
    return (
      <View style={[styles.flex, { backgroundColor: colors.bg }]}>
        <StateView
          icon={WifiOff}
          title="Loja indisponível"
          message={profile.error.message}
          actionLabel="Tentar de novo"
          onAction={() => profile.refetch()}
        />
      </View>
    );

  return (
    <FilteredAdList
      base={{ anuncianteId: store?.id }}
      enabled={Boolean(store)}
      queryKey={['store-ads', store?.id]}
      placeholder="Marca ou modelo nesta loja"
      countLabel={(total, filtering) =>
        `${total} ${filtering ? (total === 1 ? 'veículo encontrado' : 'veículos encontrados') : total === 1 ? 'veículo publicado' : 'veículos publicados'}`
      }
      empty={{ icon: Store, title: 'Esta loja ainda não tem anúncios publicados' }}
      onRefresh={() => {
        profile.refetch();
        promotions.refetch();
      }}
      header={
        <>
          {store ? (
            <View style={styles.identity}>
              <StoreAvatar store={store} size={64} />
              <View style={styles.flex}>
                <AppText variant="overline" color="red">
                  Lojista
                </AppText>
                <AppText variant="title" accessibilityRole="header">
                  {store.nome}
                </AppText>
                {store.cidade || store.uf ? (
                  <View style={styles.place}>
                    <MapPin size={14} color={colors.muted} />
                    <AppText variant="caption" color="muted">
                      {[store.cidade, store.uf].filter(Boolean).join(', ')}
                    </AppText>
                  </View>
                ) : null}
              </View>
            </View>
          ) : (
            <View style={styles.identity}>
              <Skeleton width={64} height={64} rounded={32} />
              <View style={[styles.flex, styles.skeletonText]}>
                <Skeleton width="30%" height={10} />
                <Skeleton width="70%" height={20} />
              </View>
            </View>
          )}
          {promotions.data?.map((promotion) => (
            <PromotionCard key={promotion.id} promotion={promotion} scopeNote />
          ))}
        </>
      }
    />
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  identity: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  place: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 2 },
  skeletonText: { gap: space.sm },
});
