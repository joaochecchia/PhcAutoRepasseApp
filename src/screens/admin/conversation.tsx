import { useInfiniteQuery, useQuery } from '@tanstack/react-query';
import { router, Stack } from 'expo-router';
import { ArrowUpRight, Eye, Lock, WifiOff } from 'lucide-react-native';
import { useMemo } from 'react';
import { ActivityIndicator, FlatList, Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { moderationApi } from '@/api/admin';
import type { ChatMessage } from '@/api/chat';
import { AppText } from '@/components/app-text';
import { Skeleton } from '@/components/skeleton';
import { StateView } from '@/components/state-view';
import { useTheme } from '@/hooks/use-theme';
import { closedReasons } from '@/screens/messages/conversation';
import { radius, space } from '@/theme';

import { AdminGate } from './admin-gate';

const time = new Intl.DateTimeFormat('pt-BR', { hour: '2-digit', minute: '2-digit' });
const day = new Intl.DateTimeFormat('pt-BR', { weekday: 'long', day: '2-digit', month: 'long' });
const GROUP_GAP_MS = 5 * 60_000;
const ms = (iso: string) => new Date(iso).getTime();
const sameDay = (a?: ChatMessage, b?: ChatMessage) =>
  Boolean(a && b) && new Date(a!.enviadaEm).toDateString() === new Date(b!.enviadaEm).toDateString();

/** Conversa na moderação (ModerationThread do site): o anunciante à direita, o interessado à esquerda. */
export function ModerationThreadScreen({ id }: { id: string }) {
  return (
    <AdminGate>
      <Thread id={id} />
    </AdminGate>
  );
}

function Thread({ id }: { id: string }) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const info = useQuery({ queryKey: ['admin', 'moderation-one', id], queryFn: ({ signal }) => moderationApi.open(id, signal), staleTime: Infinity });
  const pages = useInfiniteQuery({
    queryKey: ['admin', 'moderation-messages', id],
    queryFn: ({ pageParam, signal }) => moderationApi.messages(id, pageParam, signal),
    initialPageParam: undefined as string | undefined,
    // A página vem da mais nova para a mais antiga; a próxima começa antes da última recebida.
    getNextPageParam: (last) => (last.temMais ? last.mensagens[last.mensagens.length - 1]?.id : undefined),
  });
  // Lista invertida: o índice 0 é a mensagem mais nova, embaixo.
  const messages = useMemo(() => pages.data?.pages.flatMap((page) => page.mensagens) ?? [], [pages.data]);
  const conversation = info.data;
  const nameOf = (autorId: string) =>
    autorId === conversation?.anuncianteId ? conversation.anuncianteNome : (conversation?.interessadoNome ?? '');

  const title = conversation ? `${conversation.interessadoNome} e ${conversation.anuncianteNome}` : 'Conversa';
  const error = info.error ?? pages.error;

  return (
    <View style={[styles.root, { backgroundColor: colors.bg }]}>
      <Stack.Screen options={{ title }} />
      {conversation ? (
        conversation.motivoEncerramento === 'ANUNCIO_EXCLUIDO' ? (
          <View style={[styles.deal, { borderColor: colors.border, backgroundColor: colors.surface }]}>
            <View style={styles.flex}>
              <AppText variant="bodyStrong" numberOfLines={1}>
                {conversation.tituloAnuncio}
              </AppText>
              <AppText variant="caption" color="muted">
                Anúncio removido
              </AppText>
            </View>
          </View>
        ) : (
          <Pressable
            onPress={() => router.push({ pathname: '/anuncio/[id]', params: { id: conversation.anuncioId } })}
            accessibilityRole="link"
            accessibilityLabel={`Ver anúncio ${conversation.tituloAnuncio}`}
            style={({ pressed }) => [styles.deal, { borderColor: colors.border, backgroundColor: pressed ? colors.subtle : colors.surface }]}>
            <View style={styles.flex}>
              <AppText variant="bodyStrong" numberOfLines={1}>
                {conversation.tituloAnuncio}
              </AppText>
              <AppText variant="caption" color="muted">
                {conversation.totalMensagens} mensagens · iniciada em {new Date(conversation.criadaEm).toLocaleDateString('pt-BR')}
                {conversation.encerradaEm && conversation.motivoEncerramento
                  ? ` · ${closedReasons[conversation.motivoEncerramento] ?? 'encerrada'}`
                  : ''}
              </AppText>
            </View>
            <ArrowUpRight size={18} color={colors.red} />
          </Pressable>
        )
      ) : null}

      {error && !messages.length ? (
        <StateView
          icon={WifiOff}
          title="A conversa não abriu"
          message={error.message}
          actionLabel="Tentar de novo"
          onAction={() => {
            info.refetch();
            pages.refetch();
          }}
        />
      ) : pages.isPending || info.isPending ? (
        <View style={styles.skeletons}>
          <Skeleton height={44} width="60%" rounded={radius.lg} />
          <Skeleton height={44} width="55%" rounded={radius.lg} style={styles.mine} />
          <Skeleton height={64} width="70%" rounded={radius.lg} />
        </View>
      ) : (
        <FlatList
          inverted
          data={messages}
          keyExtractor={(message) => message.id}
          contentContainerStyle={styles.list}
          onEndReachedThreshold={0.3}
          onEndReached={() => {
            if (pages.hasNextPage && !pages.isFetchingNextPage) pages.fetchNextPage();
          }}
          ListFooterComponent={pages.isFetchingNextPage ? <ActivityIndicator color={colors.red} style={styles.older} /> : undefined}
          ListEmptyComponent={<StateView icon={Lock} title="Sem mensagens" message="Esta conversa ainda não tem mensagens." compact />}
          renderItem={({ item, index }) => {
            // Invertida: "anterior" no tempo é o índice seguinte.
            const previous = messages[index + 1];
            const next = messages[index - 1];
            const seller = item.autorId === conversation?.anuncianteId;
            const groupStart =
              !previous || previous.autorId !== item.autorId || !sameDay(previous, item) || ms(item.enviadaEm) - ms(previous.enviadaEm) >= GROUP_GAP_MS;
            const groupEnd =
              !next || next.autorId !== item.autorId || !sameDay(item, next) || ms(next.enviadaEm) - ms(item.enviadaEm) >= GROUP_GAP_MS;
            return (
              <View style={groupEnd ? styles.groupEnd : styles.inGroup}>
                {!sameDay(previous, item) ? (
                  <AppText variant="caption" color="muted" style={styles.day}>
                    {day.format(new Date(item.enviadaEm))}
                  </AppText>
                ) : null}
                {groupStart ? (
                  <AppText variant="label" color="muted" style={[styles.author, seller && styles.authorMine]}>
                    {nameOf(item.autorId)}
                  </AppText>
                ) : null}
                <View
                  style={[
                    styles.bubble,
                    seller
                      ? [styles.bubbleMine, { backgroundColor: colors.redTint, borderColor: colors.redBorder }]
                      : { backgroundColor: colors.surface, borderColor: colors.border },
                  ]}
                  accessible
                  accessibilityLabel={`${nameOf(item.autorId)}, ${time.format(new Date(item.enviadaEm))}: ${item.texto}`}>
                  <AppText selectable>{item.texto}</AppText>
                  <AppText variant="caption" color="muted" style={styles.time}>
                    {time.format(new Date(item.enviadaEm))}
                  </AppText>
                </View>
              </View>
            );
          }}
        />
      )}

      <View style={[styles.notice, { borderTopColor: colors.border, paddingBottom: insets.bottom + space.sm }]}>
        <Eye size={14} color={colors.muted} />
        <AppText variant="caption" color="muted">
          Somente leitura. Este acesso foi registrado.
        </AppText>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  flex: { flex: 1, gap: 2 },
  deal: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    marginHorizontal: space.lg,
    marginTop: space.md,
    padding: space.md,
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth,
  },
  skeletons: { flex: 1, padding: space.lg, gap: space.md, justifyContent: 'flex-end' },
  mine: { alignSelf: 'flex-end' },
  list: { padding: space.lg },
  older: { marginVertical: space.md },
  groupEnd: { marginTop: space.md },
  inGroup: { marginTop: 3 },
  day: { textAlign: 'center', marginVertical: space.md, textTransform: 'capitalize' },
  author: { marginBottom: 4, marginLeft: space.xs },
  authorMine: { alignSelf: 'flex-end', marginRight: space.xs },
  bubble: {
    alignSelf: 'flex-start',
    maxWidth: '82%',
    paddingHorizontal: space.md,
    paddingVertical: space.sm,
    borderRadius: radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    gap: 2,
  },
  bubbleMine: { alignSelf: 'flex-end' },
  time: { alignSelf: 'flex-end', fontSize: 11 },
  notice: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: space.xs,
    paddingTop: space.sm,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
});
