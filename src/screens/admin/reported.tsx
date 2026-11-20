import { useInfiniteQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import * as Haptics from 'expo-haptics';
import { router } from 'expo-router';
import { Ban, ExternalLink, EyeOff, Flag, WifiOff } from 'lucide-react-native';
import { useMemo, useState, type ReactNode } from 'react';
import { ActivityIndicator, FlatList, Pressable, RefreshControl, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import type { AdStatus } from '@/api/my-ads';
import {
  adminReportsApi,
  type ReportedAccount,
  type ReportedAd,
  type ReportSituation,
  type ReportSummaryPage,
} from '@/api/reports';
import { AppText } from '@/components/app-text';
import { Button } from '@/components/button';
import { showDialog } from '@/components/dialog';
import { Notice } from '@/components/notice';
import { Skeleton } from '@/components/skeleton';
import { StateView } from '@/components/state-view';
import { useTheme } from '@/hooks/use-theme';
import { radius, space } from '@/theme';
import { formatDateTime } from './format';
import { Segmented, Tag } from './ui';

const situations: { value: ReportSituation; label: string }[] = [
  { value: 'ABERTAS', label: 'Aguardando' },
  { value: 'TODAS', label: 'Todas' },
];
const adStatus: Record<AdStatus, string> = {
  PUBLICADO: 'No ar',
  RASCUNHO: 'Rascunho',
  PAUSADO: 'Pausado',
  RESERVADO: 'Reservado',
  VENDIDO: 'Vendido',
  ARQUIVADO: 'Retirado pela equipe',
};
const count = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

type Result = { ok: boolean; text: string } | null;

/**
 * Lista agrupada (Usuários ou Anúncios) com o filtro de situação, rolagem infinita e o resultado da última providência.
 * {@code switcher} é a troca de visão, no topo da lista para rolar junto.
 */
function SummaryList<T>({
  kind,
  load,
  keyOf,
  emptyTitle,
  switcher,
  result,
  renderItem,
}: {
  kind: 'contas' | 'anuncios';
  load: (params: { situacao: ReportSituation; pagina: number }, signal: AbortSignal) => Promise<ReportSummaryPage<T>>;
  keyOf: (item: T) => string;
  emptyTitle: string;
  switcher: ReactNode;
  result: Result;
  renderItem: (item: T) => ReactNode;
}) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const [situation, setSituation] = useState<ReportSituation>('ABERTAS');
  const list = useInfiniteQuery({
    queryKey: ['admin', 'reports', kind, situation],
    queryFn: ({ pageParam, signal }) => load({ situacao: situation, pagina: pageParam }, signal),
    initialPageParam: 0,
    getNextPageParam: (last) => ((last.pagina + 1) * last.tamanho < last.total ? last.pagina + 1 : undefined),
  });
  const items = useMemo(() => list.data?.pages.flatMap((page) => page.itens) ?? [], [list.data]);
  const total = list.data?.pages[0]?.total ?? 0;

  return (
    <FlatList
      style={{ backgroundColor: colors.bg }}
      contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + space.xxl }]}
      data={items}
      keyExtractor={keyOf}
      ListHeaderComponent={
        <View style={styles.header}>
          {switcher}
          <Segmented label="Situação" options={situations} value={situation} onChange={setSituation} />
          {result ? <Notice tone={result.ok ? 'success' : 'error'} message={result.text} /> : null}
          {list.data ? (
            <AppText variant="caption" color="muted">
              {total} no total
            </AppText>
          ) : null}
        </View>
      }
      refreshControl={
        <RefreshControl
          refreshing={list.isRefetching && !list.isFetchingNextPage}
          onRefresh={() => void list.refetch()}
          tintColor={colors.red}
        />
      }
      onEndReachedThreshold={0.4}
      onEndReached={() => {
        if (list.hasNextPage && !list.isFetchingNextPage) list.fetchNextPage();
      }}
      ItemSeparatorComponent={() => <View style={styles.gap} />}
      ListFooterComponent={list.isFetchingNextPage ? <ActivityIndicator color={colors.red} style={styles.footer} /> : undefined}
      ListEmptyComponent={
        list.isPending ? (
          <View style={styles.skeletons}>
            {[0, 1, 2].map((n) => (
              <Skeleton key={n} height={130} rounded={radius.lg} />
            ))}
          </View>
        ) : list.isError ? (
          <StateView
            icon={WifiOff}
            title="As denúncias não carregaram"
            message={list.error.message}
            actionLabel="Tentar de novo"
            onAction={() => list.refetch()}
            compact
          />
        ) : (
          <StateView
            icon={Flag}
            title={emptyTitle}
            message={situation === 'ABERTAS' ? 'Escolha "Todas" para ver também o que já foi analisado.' : 'Ainda não há denúncias.'}
            compact
          />
        )
      }
      renderItem={({ item }) => <>{renderItem(item)}</>}
    />
  );
}

function Counts({ total, open, last }: { total: number; open: number; last: string | null }) {
  return (
    <View style={styles.counts}>
      <AppText variant="bodyStrong">{count(total, 'denúncia', 'denúncias')}</AppText>
      {open > 0 ? <Tag label={`${open} aguardando`} tone="bad" /> : null}
      {last ? (
        <AppText variant="caption" color="muted">
          Última em {formatDateTime(last)}
        </AppText>
      ) : null}
    </View>
  );
}

/** Uma providência por vez em toda a lista; ao terminar, recarrega as denúncias e o contador do painel. */
function useAction<T>(run: (item: T) => Promise<{ resolvidas: number }>, done: (item: T, resolved: number) => string) {
  const queryClient = useQueryClient();
  const [result, setResult] = useState<Result>(null);
  const action = useMutation({
    mutationFn: run,
    onMutate: () => setResult(null),
    onSuccess: ({ resolvidas }, item) => {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setResult({ ok: true, text: done(item, resolvidas) });
      // A fila, as listas agrupadas, o contador e a conta no painel de usuários.
      queryClient.invalidateQueries({ queryKey: ['admin'] });
    },
    onError: (error) => setResult({ ok: false, text: error.message }),
  });
  return { action, result };
}

/** Usuários: cada pessoa denunciada, com o total de denúncias contra ela e o botão de desativar a conta. */
export function ReportedAccounts({ switcher }: { switcher: ReactNode }) {
  const { colors } = useTheme();
  const { action, result } = useAction<ReportedAccount>(
    (account) => adminReportsApi.deactivateReportedAccount(account.usuarioId),
    (account, resolved) =>
      `Conta de ${account.nome ?? 'cliente'} desativada. ${count(resolved, 'denúncia resolvida', 'denúncias resolvidas')}.`,
  );

  function confirm(account: ReportedAccount) {
    showDialog({
      title: `Desativar a conta de ${account.nome ?? 'quem foi denunciado'}?`,
      message: 'A pessoa sai de todas as sessões e os anúncios dela somem da vitrine. Só o DONO reativa, em Usuários.',
      actions: [
        { label: 'Voltar', kind: 'cancel' },
        { label: 'Desativar conta', kind: 'destructive', onPress: () => action.mutate(account) },
      ],
    });
  }

  return (
    <SummaryList<ReportedAccount>
      kind="contas"
      load={(params, signal) => adminReportsApi.accounts(params, signal)}
      keyOf={(account) => account.usuarioId}
      emptyTitle="Nenhuma pessoa com denúncia aguardando"
      switcher={switcher}
      result={result}
      renderItem={(account) => {
        const team = account.papel === 'ADMIN' || account.papel === 'DONO';
        return (
          <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <View style={styles.row}>
              <AppText variant="bodyStrong" style={styles.flex}>
                {account.nome ?? 'Conta excluída'}
              </AppText>
              <Tag label={account.ativa ? 'Conta ativa' : 'Conta desativada'} tone={account.ativa ? 'good' : 'neutral'} />
            </View>
            {account.email ? (
              <AppText variant="caption" color="muted" selectable>
                {account.email}
                {team ? ` · ${account.papel === 'DONO' ? 'Dono' : 'Admin'}` : ''}
              </AppText>
            ) : null}
            <Counts total={account.denuncias} open={account.abertas} last={account.ultimaEm} />
            {team ? (
              <AppText variant="caption" color="muted">
                Conta da equipe: não é desativada pela denúncia. Fale com o DONO.
              </AppText>
            ) : account.ativa ? (
              <Button
                label="Desativar conta"
                variant="ghost"
                icon={<Ban size={16} color={colors.red} />}
                onPress={() => confirm(account)}
                loading={action.isPending && action.variables?.usuarioId === account.usuarioId}
                disabled={action.isPending}
                accessibilityHint="Desativa a conta e resolve as denúncias abertas contra ela"
              />
            ) : null}
          </View>
        );
      }}
    />
  );
}

/** Anúncios: cada anúncio denunciado, com o total de denúncias e o botão de retirar da vitrine. */
export function ReportedAds({ switcher }: { switcher: ReactNode }) {
  const { colors } = useTheme();
  const { action, result } = useAction<ReportedAd>(
    (ad) => adminReportsApi.retireReportedAd(ad.anuncioId),
    (_, resolved) => `Anúncio retirado da vitrine. ${count(resolved, 'denúncia resolvida', 'denúncias resolvidas')}.`,
  );

  function confirm(ad: ReportedAd) {
    showDialog({
      title: 'Retirar este anúncio?',
      message: `"${ad.titulo}" sai da vitrine e o anunciante não poderá editar nem publicar de novo.`,
      actions: [
        { label: 'Voltar', kind: 'cancel' },
        { label: 'Retirar anúncio', kind: 'destructive', onPress: () => action.mutate(ad) },
      ],
    });
  }

  return (
    <SummaryList<ReportedAd>
      kind="anuncios"
      load={(params, signal) => adminReportsApi.ads(params, signal)}
      keyOf={(ad) => ad.anuncioId}
      emptyTitle="Nenhum anúncio com denúncia aguardando"
      switcher={switcher}
      result={result}
      renderItem={(ad) => (
        <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <View style={styles.row}>
            <AppText variant="bodyStrong" style={styles.flex} numberOfLines={2}>
              {ad.titulo}
            </AppText>
            <Tag label={ad.status ? adStatus[ad.status] : 'Excluído'} tone={ad.status === 'PUBLICADO' ? 'bad' : 'neutral'} />
          </View>
          <AppText variant="caption" color="muted">
            {ad.anuncianteNome ?? 'Conta excluída'}
            {ad.anuncianteNome && !ad.anuncianteAtivo ? ' · conta desativada' : ''}
          </AppText>
          <Counts total={ad.denuncias} open={ad.abertas} last={ad.ultimaEm} />
          <View style={styles.actions}>
            {ad.status === 'PUBLICADO' && ad.anuncianteAtivo ? (
              <Pressable
                onPress={() => router.push({ pathname: '/anuncio/[id]', params: { id: ad.anuncioId } })}
                hitSlop={8}
                accessibilityRole="link"
                accessibilityLabel={`Ver anúncio ${ad.titulo}`}
                style={styles.link}>
                <ExternalLink size={14} color={colors.red} />
                <AppText variant="label" color="red">
                  Ver anúncio
                </AppText>
              </Pressable>
            ) : null}
            {ad.status && ad.status !== 'ARQUIVADO' ? (
              <Button
                label="Retirar anúncio"
                variant="ghost"
                icon={<EyeOff size={16} color={colors.red} />}
                onPress={() => confirm(ad)}
                loading={action.isPending && action.variables?.anuncioId === ad.anuncioId}
                disabled={action.isPending}
                accessibilityHint="Tira o anúncio da vitrine e resolve as denúncias abertas contra ele"
              />
            ) : null}
          </View>
        </View>
      )}
    />
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  content: { padding: space.lg },
  header: { gap: space.sm, marginBottom: space.md },
  gap: { height: space.md },
  footer: { marginVertical: space.lg },
  skeletons: { gap: space.md },
  card: { padding: space.lg, borderRadius: radius.lg, borderWidth: StyleSheet.hairlineWidth, gap: space.sm },
  row: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  counts: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: space.sm },
  actions: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', columnGap: space.lg },
  link: { flexDirection: 'row', alignItems: 'center', gap: space.xs, minHeight: 44 },
});
