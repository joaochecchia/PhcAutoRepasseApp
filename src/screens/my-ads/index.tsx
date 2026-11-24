import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import * as Haptics from 'expo-haptics';
import { router, type Href } from 'expo-router';
import {
  ArrowUpToLine,
  BadgeCheck,
  BarChart3,
  CarFront,
  ExternalLink,
  EyeOff,
  Layers,
  PencilLine,
  Send,
  SlidersHorizontal,
  TicketPercent,
  Trash2,
  WifiOff,
} from 'lucide-react-native';
import { useEffect, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import {
  isSale,
  myAdsApi,
  SOLD_RETENTION_DAYS,
  type AdStatus,
  type MyAd,
  type MyAdsFilters,
  type MyLot,
  type RetireReason,
} from '@/api/my-ads';
import { AppText } from '@/components/app-text';
import { Button } from '@/components/button';
import { Chip } from '@/components/chip';
import { showDialog } from '@/components/dialog';
import { Notice } from '@/components/notice';
import { StateView } from '@/components/state-view';
import { VehicleCardSkeleton, VehiclePhoto } from '@/components/vehicle-card';
import { useTheme } from '@/hooks/use-theme';
import { radius, space } from '@/theme';
import { formatCents } from '@/utils/format';
import { MyAdCard, StatusPill, statusLabels } from './my-ad-card';
import { PromotionsPanel } from './promotions';
import { ActionsSheet, FiltersSheet, hasListFilters, RetireSheet, type ListFilters, type SheetAction } from './sheets';

type Tab = AdStatus | 'TODOS' | 'LOTES' | 'PROMOCOES';
const extraStatuses: AdStatus[] = ['PAUSADO', 'RESERVADO', 'VENDIDO', 'ARQUIVADO'];

function toApiFilters(tab: Tab, filters: ListFilters): MyAdsFilters {
  const since = filters.periodo
    ? new Date(Date.now() - filters.periodo * 86_400_000).toISOString().slice(0, 10)
    : undefined;
  return {
    status: tab === 'TODOS' || tab === 'LOTES' || tab === 'PROMOCOES' ? undefined : tab,
    marca: filters.marca?.trim() || undefined,
    modelo: filters.modelo?.trim() || undefined,
    precoMinimoCentavos: filters.precoMinimo ? Number(filters.precoMinimo) * 100 : undefined,
    precoMaximoCentavos: filters.precoMaximo ? Number(filters.precoMaximo) * 100 : undefined,
    condicao: filters.condicao,
    publicadoDesde: since,
  };
}

export function MyAdsScreen() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const cache = useQueryClient();
  const [tab, setTab] = useState<Tab>('TODOS');
  const [filters, setFilters] = useState<ListFilters>({});
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [menuFor, setMenuFor] = useState<MyAd | null>(null);
  const [retiring, setRetiring] = useState<{ ad: MyAd; mode: 'retire' | 'sold' } | null>(null);
  const [flash, setFlash] = useState('');
  const filtering = hasListFilters(filters);

  useEffect(() => {
    if (!flash) return;
    const timer = setTimeout(() => setFlash(''), 4000);
    return () => clearTimeout(timer);
  }, [flash]);

  const apiFilters = toApiFilters(tab, filters);
  const ads = useInfiniteQuery({
    queryKey: ['my-ads', apiFilters],
    initialPageParam: 0,
    queryFn: ({ pageParam, signal }) => myAdsApi.list(pageParam, signal, apiFilters),
    getNextPageParam: (page) => (page.temProximaPagina || page.temMais ? page.pagina + 1 : undefined),
    enabled: tab !== 'LOTES' && tab !== 'PROMOCOES',
  });
  const quota = useQuery({ queryKey: ['ad-quota'], queryFn: ({ signal }) => myAdsApi.quota(signal) });
  const renewals = useQuery({ queryKey: ['ad-renewals'], queryFn: ({ signal }) => myAdsApi.renewals(signal) });
  const lots = useQuery({ queryKey: ['my-lots'], queryFn: ({ signal }) => myAdsApi.lots(signal) });

  const refreshAll = () => {
    cache.invalidateQueries({ queryKey: ['my-ads'] });
    cache.invalidateQueries({ queryKey: ['ad-quota'] });
    cache.invalidateQueries({ queryKey: ['my-lots'] });
  };
  const done = (message: string) => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setFlash(message);
    refreshAll();
  };

  const publish = useMutation({
    mutationFn: (ad: MyAd) => myAdsApi.setPublished(ad.id, true),
    onSuccess: () => done('Anúncio publicado na vitrine.'),
    onError: (error) => showDialog({ title: 'Não foi possível publicar', message: error.message }),
  });
  const renew = useMutation({
    mutationFn: (ad: MyAd) => myAdsApi.renew(ad.id),
    onSuccess: (result) => {
      cache.setQueryData(['ad-renewals'], result.cota);
      done(
        result.renovados.length > 1
          ? 'Lote de volta ao topo da busca.'
          : 'Anúncio de volta ao topo da busca, como se tivesse acabado de ser publicado.',
      );
    },
    onError: (error) => showDialog({ title: 'Não foi possível voltar ao topo', message: error.message }),
  });
  const retire = useMutation({
    mutationFn: ({ ad, reason }: { ad: MyAd; reason: RetireReason }) => myAdsApi.retire(ad.id, reason),
    onSuccess: (_, { reason }) => {
      setRetiring(null);
      done(isSale(reason) ? 'Anúncio marcado como vendido.' : 'Anúncio retirado da vitrine e salvo como rascunho.');
    },
  });
  const remove = useMutation({
    mutationFn: (ad: MyAd) => myAdsApi.remove(ad.id),
    onSuccess: () => done('Anúncio excluído.'),
    onError: (error) => showDialog({ title: 'Não foi possível excluir', message: error.message }),
  });
  const busyId =
    (publish.isPending && publish.variables?.id) ||
    (renew.isPending && renew.variables?.id) ||
    (remove.isPending && remove.variables?.id) ||
    null;

  function confirmDelete(ad: MyAd) {
    showDialog({
      title: 'Excluir anúncio?',
      message: `${ad.titulo} e ${ad.quantidadeFotos === 1 ? 'a foto' : `as ${ad.quantidadeFotos ?? 0} fotos`} serão removidos de vez. Para tirar só da vitrine, use "Retirar da vitrine".`,
      actions: [
        { label: 'Manter', kind: 'cancel' },
        { label: 'Excluir', kind: 'destructive', onPress: () => remove.mutate(ad) },
      ],
    });
  }

  function openEdit(ad: MyAd) {
    // Carro de lote: os dados comuns e a lista de carros são editados no lote.
    router.push((ad.loteId ? `/meus-anuncios/lote/${ad.loteId}` : `/meus-anuncios/${ad.id}`) as Href);
  }

  function actionsFor(ad: MyAd): SheetAction[] {
    const published = ad.status === 'PUBLICADO';
    const quotaRenew = renewals.data;
    const list: SheetAction[] = [];
    list.push({
      key: 'edit',
      label: ad.loteId ? 'Editar lote' : 'Editar',
      icon: PencilLine,
      onPress: () => openEdit(ad),
    });
    if (published)
      list.push({
        key: 'view',
        label: 'Ver na vitrine',
        icon: ExternalLink,
        onPress: () => router.push({ pathname: '/anuncio/[id]', params: { id: ad.id } }),
      });
    if (published && quotaRenew && quotaRenew.limite !== 0)
      list.push({
        key: 'renew',
        label: 'Voltar ao topo',
        icon: ArrowUpToLine,
        disabled: quotaRenew.restantes === 0,
        hint: quotaRenew.ilimitado
          ? 'Renovações ilimitadas no seu plano'
          : quotaRenew.restantes === 0
            ? 'Renovações do mês esgotadas'
            : `${quotaRenew.restantes} de ${quotaRenew.limite} disponíveis neste mês`,
        onPress: () => renew.mutate(ad),
      });
    if (ad.status !== 'RASCUNHO')
      list.push({
        key: 'stats',
        label: 'Estatísticas',
        icon: BarChart3,
        onPress: () =>
          router.push({ pathname: '/meus-anuncios/estatisticas', params: { anuncioId: ad.id, titulo: ad.titulo } }),
      });
    if (ad.status !== 'VENDIDO' && ad.status !== 'ARQUIVADO')
      list.push({
        key: 'sold',
        label: 'Marcar como vendido',
        icon: BadgeCheck,
        onPress: () => {
          retire.reset();
          setRetiring({ ad, mode: 'sold' });
        },
      });
    list.push(
      published
        ? {
            key: 'retire',
            label: 'Retirar da vitrine',
            icon: EyeOff,
            onPress: () => {
              retire.reset();
              setRetiring({ ad, mode: 'retire' });
            },
          }
        : { key: 'publish', label: 'Publicar', icon: Send, onPress: () => publish.mutate(ad) },
    );
    list.push({ key: 'delete', label: 'Excluir', icon: Trash2, destructive: true, onPress: () => confirmDelete(ad) });
    return list;
  }

  const firstPage = ads.data?.pages[0];
  const counts = firstPage?.totalPorStatus ?? {};
  const all = Object.values(counts).reduce((sum, value) => sum + (value ?? 0), 0);
  const tabs: [Tab, string, number | undefined][] = [
    ['TODOS', 'Todos', firstPage ? all : undefined],
    ['PUBLICADO', 'Publicados', counts.PUBLICADO ?? (firstPage ? 0 : undefined)],
    ['RASCUNHO', 'Rascunhos', counts.RASCUNHO ?? (firstPage ? 0 : undefined)],
    ...extraStatuses
      .filter((status) => (counts[status] ?? 0) > 0 || tab === status)
      .map((status): [Tab, string, number | undefined] => [status, statusLabels[status], counts[status] ?? 0]),
    ['LOTES', 'Lotes', lots.data?.length],
    ['PROMOCOES', 'Promoções', undefined],
  ];
  const items = ads.data?.pages.flatMap((page) => page.anuncios) ?? [];
  const activeFilters = Object.values(filters).filter((value) => value !== undefined && value !== '').length;

  const header = (
    <View style={styles.header}>
      {quota.data ? (
        <AppText color="muted">
          {`${quota.data.publicados} publicado${quota.data.publicados === 1 ? '' : 's'}`}
          {quota.data.limite == null ? '' : ` de ${quota.data.limite} no seu plano`}
          {quota.data.planoNome ? ` · ${quota.data.planoNome}` : ''}
        </AppText>
      ) : null}
      {renewals.data ? (
        <View style={styles.renewals}>
          <ArrowUpToLine size={14} color={colors.muted} />
          <AppText variant="caption" color="muted" style={styles.flex}>
            {renewals.data.ilimitado
              ? 'Voltar ao topo: renovações ilimitadas.'
              : renewals.data.limite === 0
                ? 'Seu plano não inclui "voltar ao topo".'
                : `Voltar ao topo: ${renewals.data.restantes} de ${renewals.data.limite} neste mês.`}
          </AppText>
        </View>
      ) : null}
      {quota.isError ? (
        <Notice
          tone="error"
          message="Não foi possível conferir as vagas do seu plano."
          actionLabel="Tentar de novo"
          actionLoading={quota.isFetching}
          onAction={() => quota.refetch()}
        />
      ) : null}
      {quota.data && !quota.data.podePublicar ? (
        <Notice
          title="Todas as vagas estão em uso"
          message="Retire um anúncio da vitrine para publicar outro."
        />
      ) : null}
      <Button label="Anunciar veículo" onPress={() => router.push('/anunciar')} />
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.tabs}>
        {tabs.map(([value, label, count]) => (
          <Chip
            key={value}
            label={count === undefined ? label : `${label} · ${count}`}
            selected={tab === value}
            icon={
              value === 'LOTES' ? (
                <Layers size={14} color={tab === value ? colors.red : colors.text} />
              ) : value === 'PROMOCOES' ? (
                <TicketPercent size={14} color={tab === value ? colors.red : colors.text} />
              ) : undefined
            }
            onPress={() => setTab(value)}
          />
        ))}
        <Chip
          label="Estatísticas"
          icon={<BarChart3 size={14} color={colors.text} />}
          onPress={() => router.push('/meus-anuncios/estatisticas')}
          accessibilityLabel="Estatísticas de todos os anúncios"
        />
      </ScrollView>
      {tab !== 'LOTES' && tab !== 'PROMOCOES' ? (
        <View style={styles.filterRow}>
          <Pressable
            onPress={() => setFiltersOpen(true)}
            accessibilityRole="button"
            accessibilityLabel={activeFilters ? `Filtros, ${activeFilters} ativos` : 'Filtros'}
            style={({ pressed }) => [
              styles.filterButton,
              {
                borderColor: filtering ? colors.red : colors.border,
                backgroundColor: pressed ? colors.subtle : colors.surface,
              },
            ]}>
            <SlidersHorizontal size={16} color={filtering ? colors.red : colors.text} />
            <AppText variant="label" color={filtering ? 'red' : 'text'}>
              {activeFilters ? `Filtros · ${activeFilters}` : 'Filtros'}
            </AppText>
          </Pressable>
          {filtering ? (
            <Pressable
              onPress={() => setFilters({})}
              hitSlop={8}
              accessibilityRole="button"
              accessibilityLabel="Limpar filtros"
              style={styles.clear}>
              <AppText variant="label" color="red">
                Limpar
              </AppText>
            </Pressable>
          ) : null}
        </View>
      ) : null}
      {tab === 'VENDIDO' ? (
        <Notice
          message={`Anúncios vendidos são apagados de vez ${SOLD_RETENTION_DAYS} dias depois da venda, com fotos, placa e endereço.`}
        />
      ) : null}
      {flash ? <Notice tone="success" message={flash} /> : null}
    </View>
  );

  const sheets = (
    <>
      <ActionsSheet
        title={menuFor?.titulo ?? null}
        subtitle={menuFor ? `${menuFor.fabricante} ${menuFor.modelo} · ${statusLabels[menuFor.status]}` : undefined}
        actions={menuFor ? actionsFor(menuFor) : []}
        onClose={() => setMenuFor(null)}
      />
      <RetireSheet
        target={retiring ? { title: retiring.ad.titulo, mode: retiring.mode } : null}
        busy={retire.isPending}
        error={retire.error?.message ?? ''}
        onSubmit={(reason) => retiring && retire.mutate({ ad: retiring.ad, reason })}
        onClose={() => setRetiring(null)}
      />
      <FiltersSheet
        visible={filtersOpen}
        initial={filters}
        onApply={(next) => {
          setFilters(next);
          setFiltersOpen(false);
        }}
        onClose={() => setFiltersOpen(false)}
      />
    </>
  );

  if (tab === 'PROMOCOES')
    return (
      <>
        <ScrollView
          style={{ backgroundColor: colors.bg }}
          contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + space.xl }]}
          refreshControl={
            <RefreshControl
              refreshing={false}
              tintColor={colors.red}
              colors={[colors.red]}
              onRefresh={() => cache.invalidateQueries({ queryKey: ['my-promotions'] })}
            />
          }>
          <PromotionsPanel header={header} />
        </ScrollView>
        {sheets}
      </>
    );

  if (tab === 'LOTES')
    return (
      <>
        <FlatList
          style={{ backgroundColor: colors.bg }}
          contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + space.xl }]}
          data={lots.data ?? []}
          keyExtractor={(item) => item.id}
          refreshing={lots.isRefetching}
          onRefresh={() => lots.refetch()}
          ListHeaderComponent={header}
          ItemSeparatorComponent={Separator}
          ListEmptyComponent={
            lots.isPending ? (
              <View style={styles.list}>
                {[0, 1].map((key) => (
                  <VehicleCardSkeleton key={key} layout="row" />
                ))}
              </View>
            ) : lots.isError ? (
              <StateView
                icon={WifiOff}
                title="Não carregamos seus lotes"
                message={lots.error.message}
                actionLabel="Tentar de novo"
                onAction={() => lots.refetch()}
                compact
              />
            ) : (
              <StateView
                icon={Layers}
                title="Você ainda não tem lotes"
                message="Em Anunciar, escolha Carro e “Lote de carros” para publicar vários carros do mesmo modelo numa página só."
                compact
              />
            )
          }
          renderItem={({ item }) => <LotRow lot={item} />}
        />
        {sheets}
      </>
    );

  if (ads.isError && !ads.data)
    return (
      <View style={[styles.flex, { backgroundColor: colors.bg }]}>
        <StateView
          icon={WifiOff}
          title="Não carregamos seus anúncios"
          message={ads.error.message}
          actionLabel="Tentar de novo"
          onAction={() => ads.refetch()}
        />
      </View>
    );

  return (
    <>
      <FlatList
        style={{ backgroundColor: colors.bg }}
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + space.xl }]}
        data={items}
        keyExtractor={(item) => item.id}
        refreshing={ads.isRefetching && !ads.isFetchingNextPage}
        onRefresh={() => {
          ads.refetch();
          quota.refetch();
          renewals.refetch();
          lots.refetch();
        }}
        onEndReached={() => {
          if (ads.hasNextPage && !ads.isFetchingNextPage) ads.fetchNextPage();
        }}
        onEndReachedThreshold={0.4}
        ListHeaderComponent={header}
        ListEmptyComponent={
          ads.isPending ? (
            <View style={styles.list}>
              {[0, 1, 2, 3].map((key) => (
                <VehicleCardSkeleton key={key} layout="row" />
              ))}
            </View>
          ) : filtering ? (
            <StateView
              icon={SlidersHorizontal}
              title="Nenhum anúncio com esses filtros"
              message="Confira marca, modelo, faixa de preço e período de publicação."
              actionLabel="Limpar filtros"
              onAction={() => setFilters({})}
              compact
            />
          ) : tab !== 'TODOS' ? (
            <StateView
              icon={CarFront}
              title={`Nenhum anúncio ${statusLabels[tab as AdStatus].toLowerCase()}`}
              message="Veja os outros anúncios da sua conta ou crie um novo."
              actionLabel="Ver todos"
              onAction={() => setTab('TODOS')}
              compact
            />
          ) : (
            <StateView
              icon={CarFront}
              title="Nenhum anúncio ainda"
              message="Cadastre o veículo, as fotos e o preço. Você pode salvar como rascunho e publicar depois."
              compact
            />
          )
        }
        ItemSeparatorComponent={Separator}
        renderItem={({ item }) => (
          <MyAdCard
            ad={item}
            busy={busyId === item.id}
            onPress={() => openEdit(item)}
            onActions={() => setMenuFor(item)}
          />
        )}
        ListFooterComponent={
          ads.isFetchingNextPage ? (
            <ActivityIndicator color={colors.red} style={styles.more} />
          ) : ads.isError && ads.data ? (
            <Notice
              tone="error"
              message="Não carregamos o restante dos anúncios."
              actionLabel="Tentar de novo"
              onAction={() => ads.fetchNextPage()}
              style={styles.more}
            />
          ) : undefined
        }
      />
      {sheets}
    </>
  );
}

/** Lote na lista: cada lote aparece uma vez, com quantos carros ainda estão à venda. */
function LotRow({ lot }: { lot: MyLot }) {
  const { colors } = useTheme();
  const status: AdStatus =
    lot.disponiveis > 0 ? 'PUBLICADO' : lot.total > 0 && lot.vendidos === lot.total ? 'VENDIDO' : 'RASCUNHO';
  return (
    <Pressable
      onPress={() => router.push(`/meus-anuncios/lote/${lot.id}` as Href)}
      accessibilityRole="button"
      accessibilityLabel={`Lote ${lot.titulo}, ${lot.disponiveis} de ${lot.total} carros à venda, ${formatCents(lot.precoCentavos)} cada`}
      accessibilityHint="Abre a edição do lote"
      style={({ pressed }) => [styles.lot, { backgroundColor: pressed ? colors.subtle : colors.surface, borderColor: colors.border }]}>
      <VehiclePhoto path={lot.fotoUrl} recyclingKey={lot.id} style={styles.lotPhoto} owner />
      <View style={styles.flex}>
        <AppText variant="bodyStrong" numberOfLines={2}>
          {lot.titulo}
        </AppText>
        <AppText variant="price" style={styles.lotPrice}>
          {formatCents(lot.precoCentavos)}{' '}
          <AppText variant="caption" color="muted">
            cada
          </AppText>
        </AppText>
        <AppText variant="caption" color="muted">
          {lot.disponiveis} de {lot.total} {lot.total === 1 ? 'carro' : 'carros'} à venda
        </AppText>
        <View style={styles.lotFooter}>
          <StatusPill status={status} />
        </View>
      </View>
    </Pressable>
  );
}

function Separator() {
  return <View style={styles.separator} />;
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  content: { padding: space.lg },
  header: { gap: space.md, marginBottom: space.lg },
  renewals: { flexDirection: 'row', alignItems: 'center', gap: space.xs },
  tabs: { gap: space.sm, paddingRight: space.lg },
  filterRow: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  filterButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.xs + 2,
    minHeight: 40,
    paddingHorizontal: space.md + 2,
    borderRadius: radius.pill,
    borderWidth: 1,
  },
  clear: { minHeight: 40, justifyContent: 'center' },
  list: { gap: space.md },
  separator: { height: space.md },
  more: { marginTop: space.lg },
  lot: {
    flexDirection: 'row',
    gap: space.md,
    padding: space.md,
    borderRadius: radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
  },
  lotPhoto: { width: 112, height: 112, borderRadius: radius.md },
  lotPrice: { marginTop: space.xs },
  lotFooter: { flexDirection: 'row', marginTop: space.sm },
});
