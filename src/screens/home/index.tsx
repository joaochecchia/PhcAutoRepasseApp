import { useQuery } from '@tanstack/react-query';
import { Image } from 'expo-image';
import { MessagesSquare, Search, WifiOff } from 'lucide-react-native';
import { useState } from 'react';
import { Alert, FlatList, RefreshControl, ScrollView, StyleSheet, useWindowDimensions, View } from 'react-native';
import Animated, { interpolate, useAnimatedStyle } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { fetchHome, fetchPlatformNumbers, searchAds } from '@/api/ads';
import { apiOrigin } from '@/api/client';
import type { SearchAd } from '@/api/contracts';
import { AppText } from '@/components/app-text';
import { Chip } from '@/components/chip';
import { HeroCarousel } from '@/components/hero-carousel';
import { PressableScale } from '@/components/pressable-scale';
import { SectionHeader } from '@/components/section-header';
import { ShowcaseTabs } from '@/components/showcase-tabs';
import { Skeleton } from '@/components/skeleton';
import { StateView } from '@/components/state-view';
import { VehicleCard, VehicleCardSkeleton } from '@/components/vehicle-card';
import { banners } from '@/data/banners';
import { priceRanges, showcaseTabs, SOLD_TAB, vehicleTypes } from '@/data/catalog';
import { useIntroProgress } from '@/hooks/use-intro';
import { useTheme } from '@/hooks/use-theme';
import { formatCount } from '@/utils/format';
import { openSearch } from '@/utils/navigation';
import { radius, space } from '@/theme';

export function Home() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const intro = useIntroProgress();
  const [showcase, setShowcase] = useState('');

  const home = useQuery({ queryKey: ['home'], queryFn: ({ signal }) => fetchHome(signal) });
  const numbers = useQuery({ queryKey: ['numbers'], queryFn: ({ signal }) => fetchPlatformNumbers(signal) });
  const condition = showcase && showcase !== SOLD_TAB ? showcase : null;
  const byCondition = useQuery({
    queryKey: ['showcase', condition],
    queryFn: ({ signal }) => searchAds({ condicao: condition!, ordenacao: 'MAIS_RECENTES' }, 0, 20, signal),
    enabled: Boolean(condition),
  });
  const latest = useQuery({
    queryKey: ['latest'],
    queryFn: ({ signal }) => searchAds({ ordenacao: 'MAIS_RECENTES' }, 0, 6, signal),
  });

  const showcaseItems: SearchAd[] | undefined = condition
    ? byCondition.data?.carros
    : showcase === SOLD_TAB
      ? home.data?.vendidos ?? []
      : home.data?.carros;
  const showcaseLoading = condition ? byCondition.isPending : home.isPending;
  const showcaseError = condition ? byCondition.error : home.error;
  const showcaseTotal = condition ? byCondition.data?.total : showcase === SOLD_TAB ? showcaseItems?.length : numbers.data?.anunciados;

  const refreshing = home.isRefetching || numbers.isRefetching || latest.isRefetching;
  function refresh() {
    home.refetch();
    numbers.refetch();
    latest.refetch();
    if (condition) byCondition.refetch();
  }

  // A tela sobe e aparece enquanto a abertura sai (splash-overlay.tsx).
  const enter = useAnimatedStyle(() => ({
    opacity: intro.get(),
    transform: [{ translateY: interpolate(intro.get(), [0, 1], [28, 0]) }],
  }));

  const offline = home.isError && !home.data;

  return (
    <View style={[styles.root, { backgroundColor: colors.bg }]}>
      <Animated.View style={[styles.root, enter]}>
        <View style={[styles.header, { paddingTop: insets.top + space.sm, backgroundColor: colors.bg }]}>
          <View style={styles.brand}>
            <Image source={require('@/assets/images/phc-auto-logo-disc.png')} style={styles.logo} accessibilityLabel="PHC Auto" />
            <AppText variant="heading" style={styles.brandText}>
              PHC <AppText variant="heading" color="red">Auto</AppText>
            </AppText>
          </View>
          <View style={styles.searchRow}>
            <PressableScale
              scaleTo={0.985}
              onPress={() => openSearch({ focus: '1' })}
              accessibilityRole="search"
              accessibilityLabel="Buscar veículos por marca ou modelo"
              style={[styles.search, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <Search size={20} color={colors.text} />
              <AppText color="muted" numberOfLines={1} style={styles.flex}>
                Busque por marca ou modelo
              </AppText>
            </PressableScale>
            <PressableScale
              onPress={() =>
                Alert.alert('Mensagens', 'O chat com os anunciantes chega junto com o login, na próxima etapa do app.')
              }
              accessibilityRole="button"
              accessibilityLabel="Mensagens"
              style={[styles.roundButton, { backgroundColor: colors.subtle }]}>
              <MessagesSquare size={22} color={colors.text} />
            </PressableScale>
          </View>
        </View>

        <ScrollView
          contentContainerStyle={styles.scroll}
          showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={colors.red} colors={[colors.red]} />}>
          <HeroCarousel items={banners} />

          <Numbers loading={numbers.isPending} anunciados={numbers.data?.anunciados} vendidos={numbers.data?.vendidos} />

          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
            {vehicleTypes.map(({ key, label, icon: Icon }) => (
              <Chip
                key={key}
                label={label}
                icon={<Icon size={17} color={colors.text} strokeWidth={1.9} />}
                onPress={() => openSearch({ tipoVeiculo: key })}
              />
            ))}
          </ScrollView>

          {offline ? (
            <StateView
              icon={WifiOff}
              title="Não conseguimos carregar os veículos"
              message={`${home.error.message}\nServidor: ${apiOrigin}`}
              actionLabel="Tentar de novo"
              onAction={refresh}
            />
          ) : (
            <>
              <View style={styles.section}>
                <ShowcaseTabs tabs={showcaseTabs} selected={showcase} onSelect={setShowcase} />
                <SectionHeader
                  title={showcase === SOLD_TAB ? 'Vendidos pelo PHC' : 'Recomendados'}
                  count={showcaseTotal}
                  actionLabel={showcase === SOLD_TAB ? undefined : 'Ver todos'}
                  onAction={() => openSearch(condition ? { condicao: condition } : {})}
                />
                <Showcase items={showcaseItems} loading={showcaseLoading} error={showcaseError} onRetry={refresh} sold={showcase === SOLD_TAB} />
              </View>

              <View style={styles.section}>
                <SectionHeader title="Pesquise por preço" />
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
                  {priceRanges.map((range) => (
                    <PressableScale
                      key={range.key}
                      onPress={() => openSearch({ precoMinimo: range.min?.toString(), precoMaximo: range.max?.toString() })}
                      accessibilityRole="button"
                      accessibilityLabel={`Veículos ${range.label.toLocaleLowerCase('pt-BR')}`}
                      style={[styles.pricePill, { backgroundColor: colors.red }]}>
                      <AppText variant="bodyStrong" color="onRed">
                        {range.label}
                      </AppText>
                    </PressableScale>
                  ))}
                </ScrollView>
              </View>

              <View style={styles.section}>
                <SectionHeader title="Acabaram de chegar" actionLabel="Ver todos" onAction={() => openSearch({ ordenacao: 'MAIS_RECENTES' })} />
                <View style={styles.tiles}>
                  {latest.isPending
                    ? [0, 1].map((i) => <VehicleCardSkeleton key={i} />)
                    : latest.data?.carros.map((ad) => <VehicleCard key={ad.anuncioId} ad={ad} />)}
                </View>
              </View>
            </>
          )}
        </ScrollView>
      </Animated.View>
    </View>
  );
}

function Numbers({ loading, anunciados, vendidos }: { loading: boolean; anunciados?: number; vendidos?: number }) {
  const { colors } = useTheme();
  return (
    <View style={[styles.numbers, { backgroundColor: colors.subtle }]}>
      <Stat loading={loading} value={anunciados} label="veículos à venda agora" />
      <View style={[styles.divider, { backgroundColor: colors.border }]} />
      <Stat loading={loading} value={vendidos} label="vendidos pelo PHC" />
    </View>
  );
}

function Stat({ loading, value, label }: { loading: boolean; value?: number; label: string }) {
  return (
    <View style={styles.stat} accessible accessibilityLabel={value == null ? label : `${value} ${label}`}>
      {loading ? <Skeleton width={48} height={26} /> : <AppText variant="display">{value == null ? '—' : formatCount(value)}</AppText>}
      <AppText variant="caption" color="muted">
        {label}
      </AppText>
    </View>
  );
}

/** Recomendados em colunas de dois cards, roláveis na horizontal (como pedido nas referências). */
function Showcase({
  items,
  loading,
  error,
  onRetry,
  sold,
}: {
  items?: SearchAd[];
  loading: boolean;
  error: Error | null;
  onRetry: () => void;
  sold: boolean;
}) {
  const { width } = useWindowDimensions();
  const cardWidth = Math.min(width * 0.84, 380);
  if (loading) {
    return (
      <View style={styles.columnsLoading}>
        <VehicleCardSkeleton layout="row" width={cardWidth} />
        <VehicleCardSkeleton layout="row" width={cardWidth} />
      </View>
    );
  }
  if (error && !items) {
    return <StateView compact icon={WifiOff} title="Não foi possível carregar" message={error.message} actionLabel="Tentar de novo" onAction={onRetry} />;
  }
  if (!items?.length) {
    return (
      <StateView
        compact
        icon={Search}
        title={sold ? 'Nenhuma venda recente' : 'Nenhum veículo nesta vitrine'}
        message={sold ? 'Os vendidos dos últimos 14 dias aparecem aqui.' : 'Veja as outras abas ou faça uma busca.'}
      />
    );
  }
  const columns: SearchAd[][] = [];
  for (let i = 0; i < items.length; i += 2) columns.push(items.slice(i, i + 2));
  return (
    <FlatList
      data={columns}
      horizontal
      keyExtractor={(column) => column[0].anuncioId}
      showsHorizontalScrollIndicator={false}
      snapToInterval={cardWidth + space.md}
      decelerationRate="fast"
      contentContainerStyle={styles.columns}
      renderItem={({ item }) => (
        <View style={styles.column}>
          {item.map((ad) => (
            <VehicleCard key={ad.anuncioId} ad={ad} layout="row" width={cardWidth} />
          ))}
        </View>
      )}
    />
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  flex: { flex: 1 },
  header: { paddingHorizontal: space.lg, paddingBottom: space.md, gap: space.md },
  brand: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: space.sm },
  logo: { width: 30, height: 30 },
  brandText: { fontSize: 19 },
  searchRow: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  search: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    minHeight: 52,
    paddingHorizontal: space.lg,
    borderRadius: radius.pill,
    borderWidth: 1,
  },
  roundButton: { width: 52, height: 52, borderRadius: 26, alignItems: 'center', justifyContent: 'center' },
  scroll: { paddingTop: space.xs, paddingBottom: space.xxxl, gap: space.xxl },
  numbers: {
    marginHorizontal: space.lg,
    borderRadius: radius.lg,
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: space.lg,
  },
  stat: { flex: 1, paddingHorizontal: space.lg, gap: 2 },
  divider: { width: 1, alignSelf: 'stretch' },
  chips: { paddingHorizontal: space.lg, gap: space.sm },
  section: { gap: space.lg },
  columns: { paddingHorizontal: space.lg, gap: space.md },
  columnsLoading: { paddingHorizontal: space.lg, gap: space.md },
  column: { gap: space.md },
  pricePill: { paddingHorizontal: space.xl, minHeight: 48, justifyContent: 'center', borderRadius: radius.md },
  tiles: { paddingHorizontal: space.lg, gap: space.lg },
});
