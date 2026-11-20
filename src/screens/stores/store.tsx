import { useQuery } from '@tanstack/react-query';
import { router } from 'expo-router';
import { Flag, MapPin, Store, WifiOff } from 'lucide-react-native';
import { Pressable, StyleSheet, View } from 'react-native';

import { fetchStorePromotions, fetchStoreProfile } from '@/api/ads';
import { AppText } from '@/components/app-text';
import { BlockSellerLink } from '@/components/block-seller';
import { FilteredAdList } from '@/components/filtered-ad-list';
import { PromotionCard } from '@/components/promotions';
import { Skeleton } from '@/components/skeleton';
import { StateView } from '@/components/state-view';
import { useSession } from '@/hooks/use-session';
import { useTheme } from '@/hooks/use-theme';
import { space, touch } from '@/theme';
import { StoreAvatar } from './index';

/** Página da loja: perfil, promoções no ar e os veículos publicados, com filtros (StoresPage do site, com o id). */
export function StoreScreen({ slug }: { slug: string }) {
  const { colors } = useTheme();
  const session = useSession();
  const signedIn = session.status === 'authenticated';
  const profile = useQuery({
    queryKey: ['store', slug],
    queryFn: async ({ signal }) => {
      const data = await fetchStoreProfile(slug, signal);
      if (data.tipoPessoa !== 'PJ' || !data.slug) throw new Error('Este perfil não é uma loja.');
      return data;
    },
  });
  const store = profile.data;
  const ownStore = session.status === 'authenticated' && store?.id === session.user.usuarioId;
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
          {store && !ownStore ? (
            <View style={styles.safety}>
              <Pressable
                onPress={() =>
                  router.push({ pathname: '/denunciar', params: { tipo: 'ANUNCIANTE', alvo: store.id, assunto: store.nome } })
                }
                hitSlop={8}
                accessibilityRole="button"
                accessibilityLabel="Denunciar loja"
                accessibilityHint="Avise a equipe sobre golpe, perfil falso ou assédio desta loja"
                style={styles.reportLink}>
                <Flag size={14} color={colors.muted} />
                <AppText variant="caption" color="muted">
                  Denunciar loja
                </AppText>
              </Pressable>
              {signedIn ? <BlockSellerLink sellerId={store.id} sellerName={store.nome} /> : null}
            </View>
          ) : null}
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
  safety: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', columnGap: space.lg },
  reportLink: { flexDirection: 'row', alignItems: 'center', gap: space.xs, minHeight: touch },
});
