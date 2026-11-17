import { useQuery, useQueryClient } from '@tanstack/react-query';
import { router, type Href } from 'expo-router';
import { Lock, MessagesSquare, UserRound, WifiOff } from 'lucide-react-native';
import { useCallback, useState } from 'react';
import { FlatList, Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { chatApi, type ChatEvent } from '@/api/chat';
import { useChatEvents } from '@/api/chat-socket';
import { AppText } from '@/components/app-text';
import { Skeleton } from '@/components/skeleton';
import { StateView } from '@/components/state-view';
import { useSession } from '@/hooks/use-session';
import { useTheme } from '@/hooks/use-theme';
import { radius, space } from '@/theme';
import { closedReasons } from './conversation';

const sameDay = (date: Date) => new Date().toDateString() === date.toDateString();
const hour = new Intl.DateTimeFormat('pt-BR', { hour: '2-digit', minute: '2-digit' });
const day = new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: '2-digit' });

export function MessagesScreen() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const cache = useQueryClient();
  const signedIn = useSession().status === 'authenticated';
  const query = useQuery({ queryKey: ['conversations'], queryFn: ({ signal }) => chatApi.conversations(signal), enabled: signedIn });
  // conversaId → até quando mostrar "digitando…".
  const [typing, setTyping] = useState<Record<string, number>>({});
  const [now, setNow] = useState(() => Date.now());

  const onEvent = useCallback(
    (event: ChatEvent) => {
      if (event.tipo === 'DIGITANDO') {
        const until = Date.now() + 6000;
        setTyping((current) => ({ ...current, [event.conversaId]: until }));
        setNow(Date.now());
        setTimeout(() => setNow(Date.now()), 6100);
        return;
      }
      if (event.tipo === 'MENSAGEM') setTyping((current) => ({ ...current, [event.conversaId]: 0 }));
      cache.invalidateQueries({ queryKey: ['conversations'] });
    },
    [cache],
  );
  useChatEvents(onEvent);

  if (!signedIn)
    return (
      <View style={[styles.flex, { backgroundColor: colors.bg }]}>
        <StateView
          icon={MessagesSquare}
          title="Entre para ver suas mensagens"
          message="As conversas com vendedores e interessados ficam aqui."
          actionLabel="Entrar"
          onAction={() => router.push('/entrar')}
        />
      </View>
    );
  if (query.isError)
    return (
      <View style={[styles.flex, { backgroundColor: colors.bg }]}>
        <StateView
          icon={WifiOff}
          title="Não carregamos as mensagens"
          message={query.error.message}
          actionLabel="Tentar de novo"
          onAction={() => query.refetch()}
        />
      </View>
    );

  return (
    <FlatList
      style={{ backgroundColor: colors.bg }}
      contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + space.xl }]}
      data={query.data ?? []}
      keyExtractor={(item) => item.id}
      refreshing={query.isRefetching}
      onRefresh={() => query.refetch()}
      ItemSeparatorComponent={() => <View style={[styles.separator, { backgroundColor: colors.border }]} />}
      ListEmptyComponent={
        query.isPending ? (
          <View style={styles.skeletons}>
            {[0, 1, 2].map((key) => (
              <Skeleton key={key} height={64} rounded={radius.md} />
            ))}
          </View>
        ) : (
          <StateView
            icon={MessagesSquare}
            title="Nenhuma conversa ainda"
            message="Toque em Conversar num anúncio para falar com o vendedor."
            actionLabel="Ver veículos"
            onAction={() => router.push('/buscar')}
            compact
          />
        )
      }
      renderItem={({ item }) => {
        const when = item.ultimaMensagemEm ? new Date(item.ultimaMensagemEm) : null;
        const isTyping = (typing[item.id] ?? 0) > now;
        const preview = isTyping
          ? 'digitando…'
          : item.ultimaMensagem
            ? `${item.ultimaMensagemMinha ? 'Você: ' : ''}${item.ultimaMensagem}`
            : item.encerradaEm
              ? (closedReasons[item.motivoEncerramento ?? ''] ?? 'Conversa encerrada')
              : 'Nenhuma mensagem ainda';
        return (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`Conversa com ${item.outroNome} sobre ${item.tituloAnuncio}. ${item.naoLidas ? `${item.naoLidas} não lidas.` : ''} ${preview}`}
            onPress={() => router.push(`/mensagens/${item.id}` as Href)}
            style={({ pressed }) => [styles.row, pressed && { backgroundColor: colors.subtle }]}>
            <View style={[styles.avatar, { backgroundColor: colors.subtle }]}>
              <UserRound size={22} color={colors.muted} />
            </View>
            <View style={styles.flex}>
              <View style={styles.line}>
                <AppText variant="bodyStrong" numberOfLines={1} style={styles.flex}>
                  {item.outroNome}
                </AppText>
                {when ? (
                  <AppText variant="caption" color={item.naoLidas ? 'red' : 'muted'}>
                    {sameDay(when) ? hour.format(when) : day.format(when)}
                  </AppText>
                ) : null}
              </View>
              <AppText variant="caption" color="muted" numberOfLines={1}>
                {item.tituloAnuncio}
              </AppText>
              <View style={styles.line}>
                <AppText
                  numberOfLines={1}
                  color={isTyping ? 'red' : item.naoLidas ? 'text' : 'muted'}
                  variant={item.naoLidas ? 'bodyStrong' : 'body'}
                  style={styles.flex}>
                  {preview}
                </AppText>
                {item.naoLidas ? (
                  <View style={[styles.badge, { backgroundColor: colors.red }]}>
                    <AppText variant="label" color="onRed" style={styles.badgeText}>
                      {item.naoLidas > 99 ? '99+' : item.naoLidas}
                    </AppText>
                  </View>
                ) : item.encerradaEm ? (
                  <Lock size={13} color={colors.muted} />
                ) : null}
              </View>
            </View>
          </Pressable>
        );
      }}
    />
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  content: { paddingVertical: space.sm },
  skeletons: { gap: space.md, padding: space.lg },
  separator: { height: StyleSheet.hairlineWidth, marginLeft: 76 },
  row: { flexDirection: 'row', alignItems: 'center', gap: space.md, paddingHorizontal: space.lg, paddingVertical: space.md, minHeight: 76 },
  avatar: { width: 48, height: 48, borderRadius: 24, alignItems: 'center', justifyContent: 'center' },
  line: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  badge: { minWidth: 22, height: 22, paddingHorizontal: 6, borderRadius: 11, alignItems: 'center', justifyContent: 'center' },
  badgeText: { fontSize: 11 },
});
