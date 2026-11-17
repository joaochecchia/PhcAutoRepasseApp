import { useInfiniteQuery, useMutation, useQueryClient, type InfiniteData } from '@tanstack/react-query';
import * as Haptics from 'expo-haptics';
import { router } from 'expo-router';
import { Bell, BellRing, MessagesSquare, WifiOff } from 'lucide-react-native';
import { ActivityIndicator, FlatList, Pressable, RefreshControl, StyleSheet, View } from 'react-native';

import type { AccountNotice, AccountNoticesPage } from '@/api/contracts';
import { noticeRoute, noticesApi } from '@/api/notices';
import { AppText } from '@/components/app-text';
import { Button } from '@/components/button';
import { Skeleton } from '@/components/skeleton';
import { StateView } from '@/components/state-view';
import { noticesSummaryKey } from '@/hooks/use-notices';
import { useSession } from '@/hooks/use-session';
import { useTheme } from '@/hooks/use-theme';
import { radius, space } from '@/theme';

const when = (iso: string) =>
  new Date(iso).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });

/** Avisos da conta: carro novo da fila de espera e mensagens. Tocar marca como lido e abre o anúncio ou o lote. */
export function NoticesScreen() {
  const { colors } = useTheme();
  const queryClient = useQueryClient();
  const session = useSession();
  const usuarioId = session.status === 'authenticated' ? session.user.usuarioId : null;
  const key = ['notices', usuarioId] as const;
  const list = useInfiniteQuery({
    queryKey: key,
    queryFn: ({ pageParam, signal }) => noticesApi.list(pageParam, signal),
    initialPageParam: 0,
    getNextPageParam: (last) => (last.temProximaPagina ? last.pagina + 1 : undefined),
    enabled: Boolean(usuarioId),
  });
  const notices = list.data?.pages.flatMap((page) => page.avisos) ?? [];
  const unread = notices.filter((notice) => !notice.lidoEm).length;

  function refreshCounts() {
    queryClient.invalidateQueries({ queryKey: noticesSummaryKey(usuarioId) });
  }
  /** Marca na lista na hora; o servidor confirma em seguida. Sem ids, marca todos. */
  function markLocally(ids: string[] | null) {
    const now = new Date().toISOString();
    queryClient.setQueryData<InfiniteData<AccountNoticesPage>>(key, (data) =>
      data
        ? {
            ...data,
            pages: data.pages.map((page) => ({
              ...page,
              avisos: page.avisos.map((n) => (n.lidoEm || (ids && !ids.includes(n.id)) ? n : { ...n, lidoEm: now })),
            })),
          }
        : data,
    );
  }
  const markAll = useMutation({
    mutationFn: () => noticesApi.markRead(),
    onSuccess: () => {
      markLocally(null);
      refreshCounts();
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    },
  });

  function open(notice: AccountNotice) {
    if (!notice.lidoEm) {
      markLocally([notice.id]);
      noticesApi.markRead([notice.id]).then(refreshCounts).catch(() => undefined);
    }
    const route = noticeRoute(notice.link);
    if (route) router.push(route);
    else if (notice.tipo === 'CHAT') router.push('/mensagens');
  }

  if (!usuarioId)
    return (
      <View style={[styles.root, { backgroundColor: colors.bg }]}>
        <StateView
          icon={Bell}
          title="Entre na sua conta"
          message="Os avisos da fila de espera e das mensagens ficam aqui."
          actionLabel="Entrar"
          onAction={() => router.push('/entrar')}
        />
      </View>
    );
  if (list.isError && !list.data)
    return (
      <View style={[styles.root, { backgroundColor: colors.bg }]}>
        <StateView icon={WifiOff} title="Não carregamos seus avisos" message={list.error.message} actionLabel="Tentar de novo" onAction={() => list.refetch()} />
      </View>
    );
  if (list.isPending)
    return (
      <View style={[styles.root, styles.list, { backgroundColor: colors.bg }]}>
        {[0, 1, 2, 3].map((k) => (
          <Skeleton key={k} height={72} rounded={radius.lg} style={{ marginBottom: space.md }} />
        ))}
      </View>
    );

  return (
    <FlatList
      style={{ backgroundColor: colors.bg }}
      contentContainerStyle={[styles.list, { flexGrow: 1 }]}
      data={notices}
      keyExtractor={(notice) => notice.id}
      refreshControl={<RefreshControl refreshing={list.isRefetching} onRefresh={() => void list.refetch()} tintColor={colors.red} />}
      ListHeaderComponent={
        unread > 0 ? (
          <View style={styles.header}>
            <AppText color="muted" style={styles.flex}>
              {unread === 1 ? '1 aviso não lido' : `${unread} avisos não lidos`}
            </AppText>
            <Button label="Marcar todos como lidos" variant="ghost" onPress={() => markAll.mutate()} loading={markAll.isPending} />
          </View>
        ) : undefined
      }
      ItemSeparatorComponent={() => <View style={{ height: space.sm }} />}
      renderItem={({ item }) => {
        const Icon = item.tipo === 'CHAT' ? MessagesSquare : BellRing;
        const fresh = !item.lidoEm;
        return (
          <Pressable
            onPress={() => open(item)}
            accessibilityRole="button"
            accessibilityLabel={`${fresh ? 'Não lido. ' : ''}${item.titulo}. ${item.detalhe ?? ''} ${when(item.criadoEm)}`}
            style={({ pressed }) => [
              styles.item,
              { backgroundColor: fresh ? colors.redTint : colors.surface, borderColor: fresh ? colors.redBorder : colors.border },
              pressed && { opacity: 0.7 },
            ]}>
            <View style={[styles.icon, { backgroundColor: colors.subtle }]}>
              <Icon size={18} color={fresh ? colors.red : colors.muted} />
            </View>
            <View style={styles.flex}>
              <AppText variant="bodyStrong">{item.titulo}</AppText>
              {item.detalhe ? (
                <AppText variant="caption" color="muted" numberOfLines={2}>
                  {item.detalhe}
                </AppText>
              ) : null}
              <AppText variant="caption" color="muted">
                {when(item.criadoEm)}
              </AppText>
            </View>
            {fresh ? <View style={[styles.dot, { backgroundColor: colors.red }]} /> : null}
          </Pressable>
        );
      }}
      onEndReached={() => {
        if (list.hasNextPage && !list.isFetchingNextPage) void list.fetchNextPage();
      }}
      ListFooterComponent={list.isFetchingNextPage ? <ActivityIndicator color={colors.red} style={{ margin: space.lg }} /> : undefined}
      ListEmptyComponent={
        <StateView
          icon={Bell}
          title="Nenhum aviso por enquanto"
          message="Quando chegar um carro da sua fila de espera ou uma mensagem, ele aparece aqui."
          actionLabel="Ir para a fila de espera"
          onAction={() => router.push('/fila-espera')}
        />
      }
    />
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  flex: { flex: 1 },
  list: { padding: space.lg, paddingBottom: space.xxxl },
  header: { flexDirection: 'row', alignItems: 'center', gap: space.sm, marginBottom: space.md },
  item: { flexDirection: 'row', alignItems: 'center', gap: space.md, padding: space.md, borderRadius: radius.lg, borderWidth: 1, minHeight: 64 },
  icon: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  dot: { width: 8, height: 8, borderRadius: 4 },
});
