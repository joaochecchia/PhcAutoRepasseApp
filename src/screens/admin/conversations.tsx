import { useInfiniteQuery } from '@tanstack/react-query';
import { router } from 'expo-router';
import { ArrowLeftRight, Eye, Lock, MessagesSquare, Search, WifiOff } from 'lucide-react-native';
import { useMemo, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, RefreshControl, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { moderationApi, type ModerationStatus } from '@/api/admin';
import { AppText } from '@/components/app-text';
import { Skeleton } from '@/components/skeleton';
import { StateView } from '@/components/state-view';
import { TextField } from '@/components/text-field';
import { useTheme } from '@/hooks/use-theme';
import { radius, space } from '@/theme';

import { AdminGate } from './admin-gate';
import { ago } from './format';
import { Segmented } from './ui';

type Filter = 'TODAS' | ModerationStatus;
const filters: { value: Filter; label: string }[] = [
  { value: 'TODAS', label: 'Todas' },
  { value: 'ABERTAS', label: 'Abertas' },
  { value: 'ENCERRADAS', label: 'Encerradas' },
];

/** Moderação do chat (AdminChats do site): só leitura; abrir uma conversa registra o acesso no servidor. */
export function ConversationsScreen() {
  return (
    <AdminGate>
      <Conversations />
    </AdminGate>
  );
}

function Conversations() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const [draft, setDraft] = useState('');
  const [term, setTerm] = useState('');
  const [status, setStatus] = useState<Filter>('TODAS');
  const list = useInfiniteQuery({
    queryKey: ['admin', 'moderation', term, status],
    queryFn: ({ pageParam, signal }) =>
      moderationApi.list({ termo: term || undefined, situacao: status === 'TODAS' ? undefined : status, pagina: pageParam }, signal),
    initialPageParam: 0,
    getNextPageParam: (last) => (last.temProxima ? last.pagina + 1 : undefined),
  });
  const items = useMemo(() => list.data?.pages.flatMap((page) => page.conversas) ?? [], [list.data]);

  const header = (
    <View style={styles.header}>
      <View style={[styles.readOnly, { backgroundColor: colors.subtle }]}>
        <Eye size={16} color={colors.muted} />
        <AppText variant="caption" color="muted" style={styles.flex}>
          Somente leitura. A equipe não participa da conversa, e cada abertura fica registrada com seu usuário, data e hora.
        </AppText>
      </View>
      <TextField
        label="Buscar"
        value={draft}
        onChangeText={setDraft}
        onSubmitEditing={() => setTerm(draft.trim())}
        onBlur={() => setTerm(draft.trim())}
        placeholder="Anúncio, nome ou id"
        returnKeyType="search"
        maxLength={100}
        autoCorrect={false}
      />
      <Segmented label="Situação" options={filters} value={status} onChange={setStatus} />
    </View>
  );

  return (
    <FlatList
      style={{ backgroundColor: colors.bg }}
      contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + space.xxl }]}
      data={items}
      keyExtractor={(item) => item.id}
      ListHeaderComponent={header}
      keyboardShouldPersistTaps="handled"
      keyboardDismissMode="on-drag"
      refreshControl={<RefreshControl refreshing={list.isRefetching && !list.isFetchingNextPage} onRefresh={() => void list.refetch()} tintColor={colors.red} />}
      onEndReachedThreshold={0.4}
      onEndReached={() => {
        if (list.hasNextPage && !list.isFetchingNextPage) list.fetchNextPage();
      }}
      ItemSeparatorComponent={() => <View style={[styles.separator, { backgroundColor: colors.border }]} />}
      ListFooterComponent={list.isFetchingNextPage ? <ActivityIndicator color={colors.red} style={styles.footer} /> : undefined}
      ListEmptyComponent={
        list.isPending ? (
          <View style={styles.skeletons}>
            {[0, 1, 2, 3].map((n) => (
              <Skeleton key={n} height={72} rounded={radius.md} />
            ))}
          </View>
        ) : list.isError ? (
          <StateView icon={WifiOff} title="As conversas não carregaram" message={list.error.message} actionLabel="Tentar de novo" onAction={() => list.refetch()} compact />
        ) : (
          <StateView
            icon={term ? Search : MessagesSquare}
            title={term ? 'Nada encontrado' : 'Nenhuma conversa ainda'}
            message={term ? 'Tente o título do anúncio, o nome de um dos lados ou o id da conversa.' : 'As conversas aparecem aqui depois da primeira mensagem.'}
            compact
          />
        )
      }
      renderItem={({ item }) => (
        <Pressable
          onPress={() => router.push({ pathname: '/admin/conversas/[id]', params: { id: item.id } })}
          accessibilityRole="button"
          accessibilityLabel={`${item.interessadoNome} com ${item.anuncianteNome}, ${item.tituloAnuncio}, ${item.totalMensagens} mensagens${item.encerradaEm ? ', encerrada' : ''}`}
          accessibilityHint="Abre a conversa só para leitura; o acesso fica registrado"
          style={({ pressed }) => [styles.row, pressed && { backgroundColor: colors.subtle }]}>
          <View style={styles.flex}>
            <View style={styles.rowTop}>
              <AppText variant="bodyStrong" numberOfLines={1} style={styles.flex}>
                {item.interessadoNome} <ArrowLeftRight size={12} color={colors.muted} /> {item.anuncianteNome}
              </AppText>
              <AppText variant="caption" color="muted">
                {item.ultimaMensagemEm ? ago(item.ultimaMensagemEm) : ''}
              </AppText>
            </View>
            <AppText variant="caption" color="red" numberOfLines={1}>
              {item.tituloAnuncio}
            </AppText>
            <View style={styles.rowTop}>
              <AppText variant="caption" color="muted" numberOfLines={1} style={styles.flex}>
                {item.ultimaMensagem}
              </AppText>
              {item.encerradaEm ? (
                <Lock size={13} color={colors.muted} />
              ) : (
                <View style={[styles.count, { backgroundColor: colors.subtle }]}>
                  <AppText variant="label">{item.totalMensagens}</AppText>
                </View>
              )}
            </View>
          </View>
        </Pressable>
      )}
    />
  );
}

const styles = StyleSheet.create({
  content: { paddingVertical: space.lg },
  header: { gap: space.md, paddingHorizontal: space.lg, marginBottom: space.md },
  readOnly: { flexDirection: 'row', gap: space.sm, padding: space.md, borderRadius: radius.md },
  flex: { flex: 1 },
  skeletons: { gap: space.sm, paddingHorizontal: space.lg },
  row: { paddingHorizontal: space.lg, paddingVertical: space.md, minHeight: 64 },
  rowTop: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  count: { minWidth: 24, paddingHorizontal: 6, borderRadius: radius.pill, alignItems: 'center' },
  separator: { height: StyleSheet.hairlineWidth, marginLeft: space.lg },
  footer: { marginVertical: space.lg },
});
