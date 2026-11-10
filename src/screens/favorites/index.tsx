import { Heart } from 'lucide-react-native';
import { FlatList, StyleSheet, View } from 'react-native';
import Animated, { FadeOut, LinearTransition } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppText } from '@/components/app-text';
import { StateView } from '@/components/state-view';
import { VehicleCard } from '@/components/vehicle-card';
import { useFavorites } from '@/hooks/use-favorites';
import { useTheme } from '@/hooks/use-theme';
import { openSearch } from '@/utils/navigation';
import { space } from '@/theme';

export function Favorites() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const { items } = useFavorites();
  return (
    <View style={[styles.root, { backgroundColor: colors.bg, paddingTop: insets.top + space.sm }]}>
      <View style={styles.header}>
        <AppText variant="display" accessibilityRole="header">
          Favoritos
        </AppText>
        <AppText color="muted">
          {items.length
            ? `${items.length} ${items.length === 1 ? 'veículo salvo' : 'veículos salvos'}`
            : 'Toque no coração de um anúncio para salvar aqui.'}
        </AppText>
      </View>
      <FlatList
        data={items}
        keyExtractor={(ad) => ad.anuncioId}
        contentContainerStyle={styles.list}
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
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  header: { paddingHorizontal: space.lg, gap: space.xs, paddingBottom: space.lg },
  list: { paddingHorizontal: space.lg, paddingBottom: space.xxxl, flexGrow: 1 },
});
