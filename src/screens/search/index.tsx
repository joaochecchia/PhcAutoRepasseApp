import { useInfiniteQuery } from '@tanstack/react-query';
import { useLocalSearchParams } from 'expo-router';
import { ArrowUpDown, Search as SearchIcon, SearchX, SlidersHorizontal, WifiOff, X } from 'lucide-react-native';
import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, RefreshControl, StyleSheet, TextInput, View, type TextInputInstance } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { searchAds, type SearchFilters } from '@/api/ads';
import { AppText } from '@/components/app-text';
import { Chip } from '@/components/chip';
import { StateView } from '@/components/state-view';
import { VehicleCard, VehicleCardSkeleton } from '@/components/vehicle-card';
import { conditions, priceRanges, sortOptions, vehicleTypes } from '@/data/catalog';
import { useTheme } from '@/hooks/use-theme';
import { formatCount } from '@/utils/format';
import { fonts, radius, space } from '@/theme';
import { FilterSheet } from './filter-sheet';

const PAGE_SIZE = 20;

type Params = {
  termo?: string;
  tipoVeiculo?: string;
  condicao?: string;
  precoMinimo?: string;
  precoMaximo?: string;
  ordenacao?: string;
  focus?: string;
  t?: string;
};

function filtersFrom(params: Params): SearchFilters {
  return {
    termo: params.termo,
    tipoVeiculo: params.tipoVeiculo,
    condicao: params.condicao,
    ordenacao: params.ordenacao,
    precoMinimo: params.precoMinimo ? Number(params.precoMinimo) : undefined,
    precoMaximo: params.precoMaximo ? Number(params.precoMaximo) : undefined,
  };
}

export function Search() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<Params>();
  const [filters, setFilters] = useState<SearchFilters>(() => filtersFrom(params));
  const [text, setText] = useState(params.termo ?? '');
  const [sheet, setSheet] = useState(false);
  const inputRef = useRef<TextInputInstance>(null);

  // Atalhos da tela inicial chegam como parâmetros; "t" muda a cada atalho e reaplica os filtros.
  const [appliedStamp, setAppliedStamp] = useState(params.t);
  if (params.t && params.t !== appliedStamp) {
    setAppliedStamp(params.t);
    setFilters(filtersFrom(params));
    setText(params.termo ?? '');
  }

  // "Busque por marca ou modelo" na tela inicial já abre o teclado.
  const focus = params.focus;
  useEffect(() => {
    if (!focus) return;
    const timer = setTimeout(() => inputRef.current?.focus(), 350);
    return () => clearTimeout(timer);
  }, [focus, params.t]);

  // Digitação: busca 400 ms depois da última tecla.
  useEffect(() => {
    const timer = setTimeout(() => setFilters((current) => (current.termo === text ? current : { ...current, termo: text })), 400);
    return () => clearTimeout(timer);
  }, [text]);

  const query = useInfiniteQuery({
    queryKey: ['search', filters],
    queryFn: ({ pageParam, signal }) => searchAds(filters, pageParam, PAGE_SIZE, signal),
    initialPageParam: 0,
    getNextPageParam: (last) => (last.temProximaPagina ? last.pagina + 1 : undefined),
  });

  const items = query.data?.pages.flatMap((page) => page.carros) ?? [];
  const total = query.data?.pages[0]?.total;
  const active = activeChips(filters);

  function clearAll() {
    setText('');
    setFilters({});
  }

  return (
    <View style={[styles.root, { backgroundColor: colors.bg, paddingTop: insets.top + space.sm }]}>
      <View style={styles.top}>
        <AppText variant="display" accessibilityRole="header" style={styles.title}>
          Comprar veículos
        </AppText>
        <View style={styles.searchRow}>
          <View style={[styles.input, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <SearchIcon size={20} color={colors.muted} />
            <TextInput
              ref={inputRef}
              value={text}
              onChangeText={setText}
              placeholder="Marca, modelo ou versão"
              placeholderTextColor={colors.muted}
              returnKeyType="search"
              autoCorrect={false}
              onSubmitEditing={() => setFilters((current) => ({ ...current, termo: text }))}
              accessibilityLabel="Buscar por marca, modelo ou versão"
              style={[styles.textInput, { color: colors.text }]}
            />
            {text ? (
              <Pressable onPress={() => setText('')} hitSlop={12} accessibilityRole="button" accessibilityLabel="Limpar texto">
                <X size={18} color={colors.muted} />
              </Pressable>
            ) : null}
          </View>
          <Pressable
            onPress={() => setSheet(true)}
            accessibilityRole="button"
            accessibilityLabel={`Filtros e ordenação${active.length ? `, ${active.length} ativos` : ''}`}
            style={[styles.filterButton, { backgroundColor: active.length ? colors.redTint : colors.subtle }]}>
            <SlidersHorizontal size={22} color={active.length ? colors.red : colors.text} />
            {active.length ? (
              <View style={[styles.dot, { backgroundColor: colors.red, borderColor: colors.bg }]}>
                <AppText style={styles.dotText}>{active.length}</AppText>
              </View>
            ) : null}
          </Pressable>
        </View>
        {active.length ? (
          <FlatList
            horizontal
            data={active}
            keyExtractor={(chip) => chip.key}
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.chips}
            renderItem={({ item }) => (
              <Chip
                label={item.label}
                selected
                accessibilityLabel={`Remover filtro ${item.label}`}
                trailing={<X size={14} color={colors.red} />}
                onPress={() => setFilters((current) => item.remove(current))}
              />
            )}
          />
        ) : null}
      </View>

      <FlatList
        data={items}
        keyExtractor={(ad) => ad.anuncioId}
        contentContainerStyle={styles.list}
        keyboardDismissMode="on-drag"
        keyboardShouldPersistTaps="handled"
        onEndReachedThreshold={0.6}
        onEndReached={() => {
          if (query.hasNextPage && !query.isFetchingNextPage) query.fetchNextPage();
        }}
        refreshControl={
          <RefreshControl
            refreshing={query.isRefetching && !query.isFetchingNextPage}
            onRefresh={() => void query.refetch()}
            tintColor={colors.red}
            colors={[colors.red]}
          />
        }
        ListHeaderComponent={
          total != null ? (
            <View style={styles.resultsHeader}>
              <AppText variant="label" color="muted">
                {total === 1 ? '1 veículo encontrado' : `${formatCount(total)} veículos encontrados`}
              </AppText>
              <Pressable onPress={() => setSheet(true)} hitSlop={10} style={styles.sort} accessibilityRole="button">
                <ArrowUpDown size={14} color={colors.red} />
                <AppText variant="label" color="red">
                  {sortOptions.find((option) => option.key === (filters.ordenacao ?? ''))?.label}
                </AppText>
              </Pressable>
            </View>
          ) : undefined
        }
        ListEmptyComponent={
          query.isPending ? (
            <View style={styles.skeletons}>
              <VehicleCardSkeleton />
              <VehicleCardSkeleton />
            </View>
          ) : query.isError ? (
            <StateView icon={WifiOff} title="Não foi possível buscar" message={query.error.message} actionLabel="Tentar de novo" onAction={() => query.refetch()} />
          ) : (
            <StateView
              icon={SearchX}
              title="Nenhum veículo com esses filtros"
              message="Tente outra marca ou retire alguns filtros."
              actionLabel={active.length || text ? 'Limpar filtros' : undefined}
              onAction={clearAll}
            />
          )
        }
        ListFooterComponent={
          query.isFetchingNextPage ? <ActivityIndicator color={colors.red} style={styles.footer} /> : undefined
        }
        renderItem={({ item }) => <VehicleCard ad={item} />}
        ItemSeparatorComponent={() => <View style={{ height: space.lg }} />}
      />

      <FilterSheet
        visible={sheet}
        initial={filters}
        onClose={() => setSheet(false)}
        onApply={(next) => {
          setFilters({ ...next, termo: filters.termo });
          setSheet(false);
        }}
      />
    </View>
  );
}

type ActiveChip = { key: string; label: string; remove: (filters: SearchFilters) => SearchFilters };

function activeChips(filters: SearchFilters): ActiveChip[] {
  const chips: ActiveChip[] = [];
  const type = vehicleTypes.find((item) => item.key === filters.tipoVeiculo);
  if (type) chips.push({ key: 'tipo', label: type.label, remove: (f) => ({ ...f, tipoVeiculo: undefined }) });
  const condition = conditions.find((item) => item.key === filters.condicao);
  if (condition) chips.push({ key: 'condicao', label: condition.label, remove: (f) => ({ ...f, condicao: undefined }) });
  if (filters.precoMinimo != null || filters.precoMaximo != null) {
    const range = priceRanges.find((item) => item.min === filters.precoMinimo && item.max === filters.precoMaximo);
    chips.push({
      key: 'preco',
      label: range?.label ?? 'Faixa de preço',
      remove: (f) => ({ ...f, precoMinimo: undefined, precoMaximo: undefined }),
    });
  }
  if (filters.ordenacao) {
    const sort = sortOptions.find((item) => item.key === filters.ordenacao);
    if (sort) chips.push({ key: 'ordem', label: sort.label, remove: (f) => ({ ...f, ordenacao: undefined }) });
  }
  return chips;
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  top: { gap: space.md, paddingBottom: space.md },
  title: { paddingHorizontal: space.lg },
  searchRow: { flexDirection: 'row', alignItems: 'center', gap: space.md, paddingHorizontal: space.lg },
  input: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    minHeight: 50,
    paddingHorizontal: space.lg,
    borderRadius: radius.pill,
    borderWidth: 1,
  },
  textInput: { flex: 1, fontFamily: fonts.body, fontSize: 16, paddingVertical: space.sm },
  filterButton: { width: 50, height: 50, borderRadius: 25, alignItems: 'center', justifyContent: 'center' },
  dot: {
    position: 'absolute',
    top: 4,
    right: 4,
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dotText: { color: '#fff', fontSize: 10, lineHeight: 12, fontFamily: fonts.bold },
  chips: { paddingHorizontal: space.lg, gap: space.sm },
  list: { paddingHorizontal: space.lg, paddingBottom: space.xxxl, flexGrow: 1 },
  resultsHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: space.sm, marginBottom: space.sm },
  sort: { flexDirection: 'row', alignItems: 'center', gap: 4, minHeight: 36 },
  skeletons: { gap: space.lg },
  footer: { marginVertical: space.xl },
});
