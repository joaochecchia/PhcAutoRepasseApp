import { useQuery } from '@tanstack/react-query';
import { Heart, WifiOff } from 'lucide-react-native';
import { FlatList, RefreshControl, StyleSheet, View } from 'react-native';
import Animated, { FadeOut, LinearTransition } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import type { SearchAd } from '@/api/contracts';
import { favoritesApi } from '@/api/favorites';
import { AppText } from '@/components/app-text';
import { Skeleton } from '@/components/skeleton';
import { StateView } from '@/components/state-view';
import { VehicleCard } from '@/components/vehicle-card';
import { favoritesQueryKey, useFavorites } from '@/hooks/use-favorites';
import { useSession } from '@/hooks/use-session';
import { useTheme } from '@/hooks/use-theme';
import { openSearch } from '@/utils/navigation';
import { radius, space } from '@/theme';

export function Favorites() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const session = useSession();
  const usuarioId = session.status === 'authenticated' ? session.user.usuarioId : null;
  const { ids, localItems } = useFavorites();
  // Com login, os cards vêm da conta (inclui o que foi salvo no site ou em outro aparelho).
  const cards = useQuery({
    queryKey: favoritesQueryKey(usuarioId ?? ''),
    queryFn: ({ signal }) => favoritesApi.cards(signal),
    enabled: Boolean(usuarioId),
  });

  let items: SearchAd[] = localItems;
  if (usuarioId && cards.data) {
    // O coração responde na hora: some o que foi desmarcado e entra o que acabou de ser salvo, antes da nova carga.
    const fromServer = cards.data.carros.filter((ad) => ids.includes(ad.anuncioId));
    const pending = localItems.filter((ad) => !fromServer.some((item) => item.anuncioId === ad.anuncioId));
    items = [...pending, ...fromServer];
  }
  const loading = Boolean(usuarioId) && cards.isPending;
  const failed = Boolean(usuarioId) && cards.isError && !cards.data;
  const count = usuarioId ? (cards.data ? items.length : ids.length) : items.length;

  return (
    <View style={[styles.root, { backgroundColor: colors.bg, paddingTop: insets.top + space.sm }]}>
      <View style={styles.header}>
        <AppText variant="display" accessibilityRole="header">
          Favoritos
        </AppText>
        <AppText color="muted">
          {count
            ? `${count} ${count === 1 ? 'veículo salvo' : 'veículos salvos'}`
            : 'Toque no coração de um anúncio para salvar aqui.'}
        </AppText>
        {usuarioId ? null : (
          <AppText variant="caption" color="muted">
            Sem login, os favoritos valem só até fechar o app. Entre para guardá-los na conta.
          </AppText>
        )}
        {usuarioId && count ? (
          <AppText variant="caption" color="muted">
            O anunciante vê seu primeiro nome e sua cidade quando você salva um anúncio.
          </AppText>
        ) : null}
      </View>
      {failed ? (
        <StateView
          icon={WifiOff}
          title="Não carregamos seus favoritos"
          message={cards.error?.message}
          actionLabel="Tentar de novo"
          onAction={() => cards.refetch()}
        />
      ) : loading ? (
        <View style={styles.list}>
          {[0, 1].map((key) => (
            <Skeleton key={key} height={260} rounded={radius.lg} style={{ marginBottom: space.lg }} />
          ))}
        </View>
      ) : (
        <FlatList
          data={items}
          keyExtractor={(ad) => ad.anuncioId}
          contentContainerStyle={styles.list}
          refreshControl={
            usuarioId ? (
              <RefreshControl refreshing={cards.isRefetching} onRefresh={() => void cards.refetch()} tintColor={colors.red} />
            ) : undefined
          }
          renderItem={({ item }) => (
            // Ao desfavoritar, o card sai esmaecendo e os de baixo sobem para o lugar.
            <Animated.View exiting={FadeOut.duration(180)} layout={LinearTransition.duration(240)}>
              <VehicleCard ad={item} />
            </Animated.View>
          )}
          ItemSeparatorComponent={() => <View style={{ height: space.lg }} />}
          ListEmptyComponent={
            <StateView
              icon={Heart}
              title="Nenhum favorito ainda"
              message="Salve os veículos que chamarem sua atenção para comparar depois."
              actionLabel="Buscar veículos"
              onAction={() => openSearch({})}
            />
          }
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  header: { paddingHorizontal: space.lg, gap: space.xs, paddingBottom: space.lg },
  list: { paddingHorizontal: space.lg, paddingBottom: space.xxxl, flexGrow: 1 },
});
