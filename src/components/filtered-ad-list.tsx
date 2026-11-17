import { useInfiniteQuery } from '@tanstack/react-query';
import { Search as SearchIcon, WifiOff, X, type LucideIcon } from 'lucide-react-native';
import { useEffect, useState, type ReactNode } from 'react';
import { ActivityIndicator, FlatList, Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { searchAds, type SearchFilters } from '@/api/ads';
import { AppText } from '@/components/app-text';
import { Chip } from '@/components/chip';
import { StateView } from '@/components/state-view';
import { VehicleCard, VehicleCardSkeleton } from '@/components/vehicle-card';
import { conditions, priceRanges, vehicleTypes } from '@/data/catalog';
import { useTheme } from '@/hooks/use-theme';
import { fonts, radius, space } from '@/theme';

type Props = {
  /** Filtros fixos da lista (loja, pátio). */
  base: SearchFilters;
  /** Espera algo carregar antes de buscar (ex.: o perfil da loja). */
  enabled?: boolean;
  queryKey: unknown[];
  header?: ReactNode;
  placeholder: string;
  /** Abas por tipo de veículo (Pátio). */
  withTypes?: boolean;
  countLabel: (total: number, filtering: boolean) => string;
  empty: { icon: LucideIcon; title: string; message?: string };
  onRefresh?: () => void;
};

/** Veículos de uma origem fixa com busca por texto, tipo, condição e faixa de preço (loja, Pátio PHC). */
export function FilteredAdList({
  base,
  enabled = true,
  queryKey,
  header,
  placeholder,
  withTypes,
  countLabel,
  empty,
  onRefresh,
}: Props) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const [text, setText] = useState('');
  const [filters, setFilters] = useState<SearchFilters>({});

  useEffect(() => {
    const timer = setTimeout(() => {
      const termo = text.trim() || undefined;
      setFilters((current) => (current.termo === termo ? current : { ...current, termo }));
    }, 400);
    return () => clearTimeout(timer);
  }, [text]);

  const ads = useInfiniteQuery({
    queryKey: [...queryKey, filters],
    initialPageParam: 0,
    enabled,
    queryFn: ({ pageParam, signal }) => searchAds({ ...filters, ...base }, pageParam, 20, signal),
    getNextPageParam: (page) => (page.temProximaPagina ? page.pagina + 1 : undefined),
  });

  const items = ads.data?.pages.flatMap((page) => page.carros) ?? [];
  const total = ads.data?.pages[0]?.total;
  const filtering = Boolean(
    filters.termo || filters.condicao || filters.tipoVeiculo || filters.precoMinimo != null || filters.precoMaximo != null,
  );
  const toggle = <K extends keyof SearchFilters>(key: K, value: SearchFilters[K]) =>
    setFilters((current) => ({ ...current, [key]: current[key] === value ? undefined : value }));

  return (
    <FlatList
      style={{ backgroundColor: colors.bg }}
      data={items}
      keyExtractor={(item) => item.anuncioId}
      contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + space.xl }]}
      keyboardDismissMode="on-drag"
      keyboardShouldPersistTaps="handled"
      onEndReachedThreshold={0.5}
      onEndReached={() => {
        if (ads.hasNextPage && !ads.isFetchingNextPage) ads.fetchNextPage();
      }}
      refreshing={ads.isRefetching && !ads.isFetchingNextPage}
      onRefresh={() => {
        onRefresh?.();
        ads.refetch();
      }}
      ListHeaderComponent={
        <View style={styles.header}>
          {header}
          {withTypes ? (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
              <Chip label="Todos" selected={!filters.tipoVeiculo} onPress={() => setFilters((c) => ({ ...c, tipoVeiculo: undefined }))} />
              {vehicleTypes.map(({ key, label, icon: Icon }) => (
                <Chip
                  key={key}
                  label={label}
                  selected={filters.tipoVeiculo === key}
                  icon={<Icon size={15} color={filters.tipoVeiculo === key ? colors.red : colors.text} />}
                  onPress={() => toggle('tipoVeiculo', key)}
                />
              ))}
            </ScrollView>
          ) : null}
          <View style={[styles.input, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <SearchIcon size={20} color={colors.muted} />
            <TextInput
              value={text}
              onChangeText={setText}
              placeholder={placeholder}
              placeholderTextColor={colors.muted}
              returnKeyType="search"
              autoCorrect={false}
              accessibilityLabel={placeholder}
              style={[styles.textInput, { color: colors.text }]}
            />
            {text ? (
              <Pressable onPress={() => setText('')} hitSlop={12} accessibilityRole="button" accessibilityLabel="Limpar texto">
                <X size={18} color={colors.muted} />
              </Pressable>
            ) : null}
          </View>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
            {conditions.map((item) => (
              <Chip key={item.key} label={item.label} selected={filters.condicao === item.key} onPress={() => toggle('condicao', item.key)} />
            ))}
            {priceRanges.map((range) => {
              const selected = filters.precoMinimo === range.min && filters.precoMaximo === range.max;
              return (
                <Chip
                  key={range.key}
                  label={range.label}
                  selected={selected}
                  onPress={() =>
                    setFilters((current) =>
                      selected
                        ? { ...current, precoMinimo: undefined, precoMaximo: undefined }
                        : { ...current, precoMinimo: range.min, precoMaximo: range.max },
                    )
                  }
                />
              );
            })}
          </ScrollView>
          {total != null ? (
            <AppText variant="label" color="muted" accessibilityLiveRegion="polite">
              {countLabel(total, filtering)}
            </AppText>
          ) : null}
        </View>
      }
      ListEmptyComponent={
        !enabled || ads.isPending ? (
          <View style={styles.list}>
            <VehicleCardSkeleton />
            <VehicleCardSkeleton />
          </View>
        ) : ads.isError ? (
          <StateView
            icon={WifiOff}
            title="Os veículos não carregaram"
            message={ads.error.message}
            actionLabel="Tentar de novo"
            onAction={() => ads.refetch()}
            compact
          />
        ) : filtering ? (
          <StateView
            icon={empty.icon}
            title="Nenhum veículo com esses filtros"
            message="Tente outra marca, outro modelo ou outra faixa de preço."
            actionLabel="Limpar filtros"
            onAction={() => {
              setText('');
              setFilters({});
            }}
            compact
          />
        ) : (
          <StateView icon={empty.icon} title={empty.title} message={empty.message} compact />
        )
      }
      ItemSeparatorComponent={Separator}
      renderItem={({ item }) => <VehicleCard ad={item} />}
      ListFooterComponent={ads.isFetchingNextPage ? <ActivityIndicator color={colors.red} style={styles.more} /> : undefined}
    />
  );
}

function Separator() {
  return <View style={styles.separator} />;
}

const styles = StyleSheet.create({
  content: { padding: space.lg },
  header: { gap: space.md, marginBottom: space.lg },
  input: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    minHeight: 50,
    paddingHorizontal: space.lg,
    borderRadius: radius.pill,
    borderWidth: 1,
  },
  textInput: { flex: 1, fontFamily: fonts.body, fontSize: 16, paddingVertical: space.sm },
  chips: { gap: space.sm, paddingRight: space.lg },
  list: { gap: space.lg },
  separator: { height: space.lg },
  more: { marginTop: space.lg },
});
