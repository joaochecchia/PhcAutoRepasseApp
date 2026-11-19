import { useInfiniteQuery, useMutation, useQuery, useQueryClient, type InfiniteData } from '@tanstack/react-query';
import * as Haptics from 'expo-haptics';
import { router, useNavigation } from 'expo-router';
import { Ban, Check, CheckCheck, Lock, SendHorizontal, WifiOff } from 'lucide-react-native';
import { useCallback, useEffect, useLayoutEffect, useMemo, useState } from 'react';
import { ActivityIndicator, FlatList, KeyboardAvoidingView, Platform, Pressable, StyleSheet, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { chatApi, type ChatConversation, type ChatEvent, type ChatMessage, type ChatMessagesPage } from '@/api/chat';
import { markChatRead, resetTyping, sendChatMessage, signalTyping, useChatConnected, useChatEvents } from '@/api/chat-socket';
import { AppText } from '@/components/app-text';
import { Button } from '@/components/button';
import { showDialog } from '@/components/dialog';
import { Notice } from '@/components/notice';
import { StateView } from '@/components/state-view';
import { askForPush } from '@/hooks/use-push';
import { useSession } from '@/hooks/use-session';
import { useTheme } from '@/hooks/use-theme';
import { fonts, radius, space } from '@/theme';

/** Sem novo sinal, o "digitando…" some depois disso. */
const TYPING_TTL_MS = 6000;
export const closedReasons: Record<string, string> = {
  ANUNCIO_VENDIDO: 'Veículo vendido',
  ANUNCIO_EXCLUIDO: 'Anúncio removido',
  CONTA_EXCLUIDA: 'Conta encerrada',
};
const time = new Intl.DateTimeFormat('pt-BR', { hour: '2-digit', minute: '2-digit' });
const ms = (value: string | null | undefined) => (value ? new Date(value).getTime() : 0);
type Delivery = 'sent' | 'delivered' | 'read';
function delivery(message: ChatMessage, conversation: ChatConversation | undefined): Delivery {
  const sentAt = ms(message.enviadaEm);
  if (ms(conversation?.outroLeuAte) >= sentAt) return 'read';
  if (ms(conversation?.outroRecebeuAte) >= sentAt) return 'delivered';
  return 'sent';
}
const deliveryLabels: Record<Delivery, string> = { sent: 'Enviada', delivered: 'Entregue', read: 'Visualizada' };

type Pages = InfiniteData<ChatMessagesPage, string | undefined>;

export function ConversationScreen({ id }: { id: string }) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();
  const session = useSession();
  const userId = session.status === 'authenticated' ? session.user.usuarioId : '';
  const cache = useQueryClient();
  const connected = useChatConnected();
  const [text, setText] = useState('');
  const [typingUntil, setTypingUntil] = useState(0);
  const [now, setNow] = useState(() => Date.now());

  const conversation = useQuery({
    queryKey: ['conversation', id],
    queryFn: ({ signal }) => chatApi.conversation(id, signal),
    enabled: Boolean(id),
    // Sem tempo real, confere de vez em quando (lido, entregue, encerrada).
    refetchInterval: connected ? false : 10_000,
  });
  // API: mais recentes primeiro; "antes" = id da mais antiga carregada.
  const messages = useInfiniteQuery({
    queryKey: ['messages', id],
    initialPageParam: undefined as string | undefined,
    queryFn: ({ pageParam, signal }) => chatApi.messages(id, pageParam, signal),
    getNextPageParam: (page) => (page.temMais ? page.mensagens[page.mensagens.length - 1]?.id : undefined),
    enabled: Boolean(id),
    refetchInterval: connected ? false : 10_000,
  });
  const list = useMemo(() => messages.data?.pages.flatMap((page) => page.mensagens) ?? [], [messages.data]);
  const other = conversation.data?.outroNome ?? 'Conversa';
  const otherId = conversation.data?.outroId ?? null;
  const typing = typingUntil > now;
  // Bloqueio feito por mim. Quem me bloqueou só aparece quando o envio é recusado (mensagem do servidor).
  const blocks = useQuery({ queryKey: ['chat-blocks'], queryFn: ({ signal }) => chatApi.blocks(signal), enabled: Boolean(otherId) });
  const blocked = Boolean(otherId && blocks.data?.some((item) => item.usuarioId === otherId));
  const toggleBlock = useMutation({
    mutationFn: (next: boolean) => (next ? chatApi.block(otherId!) : chatApi.unblock(otherId!)),
    onSuccess: (_, next) => {
      Haptics.notificationAsync(next ? Haptics.NotificationFeedbackType.Warning : Haptics.NotificationFeedbackType.Success);
      cache.invalidateQueries({ queryKey: ['chat-blocks'] });
    },
    onError: (error) => showDialog({ title: 'Não deu certo', message: error.message }),
  });

  const reportMessage = useCallback(
    (message: ChatMessage) =>
      router.push({ pathname: '/denunciar', params: { tipo: 'MENSAGEM', alvo: message.id, assunto: `“${message.texto.slice(0, 160)}”` } }),
    [],
  );

  const confirmBlock = useCallback(() => {
    showDialog({
      title: `Bloquear ${other}?`,
      message: 'Nenhum dos dois manda mensagens ao outro. Dá para desbloquear depois.',
      actions: [
        { label: 'Cancelar', kind: 'cancel' },
        { label: 'Bloquear', kind: 'destructive', onPress: () => toggleBlock.mutate(true) },
      ],
    });
  }, [other, toggleBlock]);

  // Bloqueado, o desbloquear fica no rodapé; o botão do topo só aparece depois de saber o estado.
  const canBlock = Boolean(otherId && blocks.data && !blocked);
  const blocking = toggleBlock.isPending;
  useLayoutEffect(() => {
    navigation.setOptions({
      title: other,
      headerRight: canBlock
        ? () => (
            <Pressable
              onPress={confirmBlock}
              disabled={blocking}
              hitSlop={8}
              accessibilityRole="button"
              accessibilityLabel={`Bloquear ${other}`}
              accessibilityState={{ disabled: blocking, busy: blocking }}
              style={({ pressed }) => [styles.headerButton, { opacity: pressed || blocking ? 0.5 : 1 }]}>
              <Ban size={18} color={colors.red} />
              <AppText variant="bodyStrong" color="red">
                Bloquear
              </AppText>
            </Pressable>
          )
        : undefined,
    });
  }, [navigation, other, canBlock, blocking, confirmBlock, colors.red]);

  // Relógio só enquanto o "digitando…" está na tela.
  useEffect(() => {
    if (!typing) return;
    const timer = setTimeout(() => setNow(Date.now()), Math.max(0, typingUntil - Date.now()) + 50);
    return () => clearTimeout(timer);
  }, [typing, typingUntil]);

  const markRead = useCallback(() => {
    markChatRead(id)
      .then(() => cache.invalidateQueries({ queryKey: ['conversations'] }))
      .catch(() => undefined);
  }, [id, cache]);

  // Lê ao abrir e quando chegam mensagens do outro lado com a tela em foco.
  const lastFromOther = list.find((message) => message.autorId !== userId)?.id;
  useEffect(() => {
    if (lastFromOther) markRead();
  }, [lastFromOther, markRead]);

  const addMessage = useCallback(
    (message: ChatMessage) =>
      cache.setQueryData<Pages>(['messages', id], (data) => {
        if (!data) return data;
        if (data.pages.some((page) => page.mensagens.some((item) => item.id === message.id))) return data;
        const [first, ...rest] = data.pages;
        return { ...data, pages: [{ ...first, mensagens: [message, ...first.mensagens] }, ...rest] };
      }),
    [cache, id],
  );

  const onEvent = useCallback(
    (event: ChatEvent) => {
      if (event.conversaId !== id) return;
      if (event.tipo === 'MENSAGEM') {
        addMessage(event.mensagem);
        if (!event.minha) setTypingUntil(0);
      } else if (event.tipo === 'LEITURA' && !event.porMim) {
        cache.setQueryData<ChatConversation>(['conversation', id], (current) =>
          current ? { ...current, outroLeuAte: event.lidaAte, outroRecebeuAte: event.lidaAte } : current,
        );
      } else if (event.tipo === 'ENTREGA') {
        cache.setQueryData<ChatConversation>(['conversation', id], (current) =>
          current ? { ...current, outroRecebeuAte: event.entregueAte } : current,
        );
      } else if (event.tipo === 'ENCERRADA') {
        cache.setQueryData<ChatConversation>(['conversation', id], (current) =>
          current ? { ...current, encerradaEm: new Date().toISOString(), motivoEncerramento: event.motivoEncerramento } : current,
        );
      } else if (event.tipo === 'DIGITANDO') {
        setNow(Date.now());
        setTypingUntil(Date.now() + TYPING_TTL_MS);
      }
    },
    [id, addMessage, cache],
  );
  useChatEvents(onEvent);

  const send = useMutation({
    mutationFn: (texto: string) => sendChatMessage(id, texto),
    onMutate: () => {
      resetTyping(id);
      setText('');
    },
    onSuccess: (message) => {
      Haptics.selectionAsync();
      addMessage(message);
      // Momento com contexto para pedir a permissão: a resposta chega por push.
      askForPush();
      cache.invalidateQueries({ queryKey: ['conversations'] });
    },
    onError: (_, texto) => setText((current) => current || texto),
  });

  if (conversation.isError || (messages.isError && !messages.data))
    return (
      <View style={[styles.flex, { backgroundColor: colors.bg }]}>
        <StateView
          icon={WifiOff}
          title="Não abrimos a conversa"
          message={(conversation.error ?? messages.error)?.message ?? 'Tente de novo.'}
          actionLabel="Tentar de novo"
          onAction={() => {
            conversation.refetch();
            messages.refetch();
          }}
        />
      </View>
    );

  const closed = Boolean(conversation.data?.encerradaEm);
  const lastMine = list.find((message) => message.autorId === userId);

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
      style={[styles.flex, { backgroundColor: colors.bg }]}>
      {conversation.data ? (
        <Pressable
          onPress={() => router.push({ pathname: '/anuncio/[id]', params: { id: conversation.data!.anuncioId } })}
          accessibilityRole="button"
          accessibilityLabel={`Anúncio: ${conversation.data.tituloAnuncio}. Abrir`}
          style={({ pressed }) => [styles.adBar, { borderBottomColor: colors.border, backgroundColor: pressed ? colors.subtle : colors.surface }]}>
          <AppText variant="caption" color="muted">
            {conversation.data.papel === 'ANUNCIANTE' ? 'Interessado no seu anúncio' : 'Sobre o anúncio'}
          </AppText>
          <AppText variant="bodyStrong" numberOfLines={1}>
            {conversation.data.tituloAnuncio}
          </AppText>
        </Pressable>
      ) : null}
      {!connected ? (
        <View style={[styles.offline, { backgroundColor: colors.subtle }]}>
          <AppText variant="caption" color="muted">
            Reconectando… as mensagens atualizam a cada 10 segundos.
          </AppText>
        </View>
      ) : null}
      <FlatList
        inverted
        data={list}
        keyExtractor={(message) => message.id}
        contentContainerStyle={styles.list}
        keyboardDismissMode="interactive"
        onEndReachedThreshold={0.3}
        onEndReached={() => {
          if (messages.hasNextPage && !messages.isFetchingNextPage) messages.fetchNextPage();
        }}
        ListHeaderComponent={
          typing ? (
            <View
              style={[styles.bubble, styles.theirs, { backgroundColor: colors.surface, borderColor: colors.border }]}
              accessibilityLiveRegion="polite"
              accessibilityLabel={`${other} está digitando`}>
              <AppText color="muted">digitando…</AppText>
            </View>
          ) : undefined
        }
        ListFooterComponent={
          messages.isFetchingNextPage ? <ActivityIndicator color={colors.red} style={styles.older} /> : undefined
        }
        ListEmptyComponent={
          messages.isPending ? (
            <ActivityIndicator color={colors.red} style={styles.older} />
          ) : (
            <AppText color="muted" style={styles.empty}>
              Envie a primeira mensagem.
            </AppText>
          )
        }
        renderItem={({ item }) => {
          const mine = item.autorId === userId;
          const status = mine ? delivery(item, conversation.data) : null;
          return (
            <Pressable
              accessible
              disabled={mine}
              onLongPress={
                mine
                  ? undefined
                  : () => {
                      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                      showDialog({
                        title: `Mensagem de ${other}`,
                        message: item.texto.length > 160 ? `${item.texto.slice(0, 160)}…` : item.texto,
                        actions: [
                          { label: 'Cancelar', kind: 'cancel' },
                          { label: 'Denunciar mensagem', kind: 'destructive', onPress: () => reportMessage(item) },
                        ],
                      });
                    }
              }
              accessibilityActions={mine ? undefined : [{ name: 'longpress', label: 'Denunciar mensagem' }]}
              onAccessibilityAction={mine ? undefined : (event) => event.nativeEvent.actionName === 'longpress' && reportMessage(item)}
              accessibilityLabel={`${mine ? 'Você' : other}: ${item.texto}. ${time.format(new Date(item.enviadaEm))}${status ? `. ${deliveryLabels[status]}` : ''}`}
              style={[
                styles.bubble,
                mine ? styles.mine : styles.theirs,
                mine
                  ? { backgroundColor: colors.red }
                  : { backgroundColor: colors.surface, borderColor: colors.border, borderWidth: StyleSheet.hairlineWidth },
              ]}>
              <AppText color={mine ? 'onRed' : 'text'}>{item.texto}</AppText>
              <View style={styles.meta}>
                <AppText variant="caption" color={mine ? 'onRed' : 'muted'} style={mine ? styles.mineMeta : undefined}>
                  {time.format(new Date(item.enviadaEm))}
                </AppText>
                {status ? (
                  status === 'sent' ? (
                    <Check size={14} color={colors.onRed} />
                  ) : (
                    <CheckCheck size={14} color={colors.onRed} strokeWidth={status === 'read' ? 3 : 2} />
                  )
                ) : null}
              </View>
              {mine && item.id === lastMine?.id && status ? (
                <AppText variant="caption" color="onRed" style={styles.mineMeta}>
                  {deliveryLabels[status]}
                </AppText>
              ) : null}
            </Pressable>
          );
        }}
      />
      {blocked ? (
        <View style={[styles.blocked, { borderTopColor: colors.border, paddingBottom: insets.bottom + space.md }]}>
          <View style={styles.row}>
            <Ban size={16} color={colors.muted} />
            <AppText color="muted" style={styles.flex}>
              Você bloqueou {other}. Nenhum dos dois manda mensagens ao outro enquanto o bloqueio durar.
            </AppText>
          </View>
          <Button
            label="Desbloquear"
            variant="secondary"
            loading={toggleBlock.isPending}
            onPress={() => toggleBlock.mutate(false)}
          />
        </View>
      ) : closed ? (
        <View style={[styles.closed, { borderTopColor: colors.border, paddingBottom: insets.bottom + space.md }]}>
          <Lock size={16} color={colors.muted} />
          <AppText color="muted" style={styles.flex}>
            Conversa encerrada · {closedReasons[conversation.data?.motivoEncerramento ?? ''] ?? 'Não aceita novas mensagens'}
          </AppText>
        </View>
      ) : (
        <View style={[styles.composer, { borderTopColor: colors.border, paddingBottom: insets.bottom + space.sm }]}>
          {send.isError ? <Notice tone="error" message={send.error.message} /> : null}
          <View style={styles.row}>
            <TextInput
              value={text}
              onChangeText={(value) => {
                setText(value);
                if (value.trim()) signalTyping(id);
              }}
              placeholder="Escreva uma mensagem"
              placeholderTextColor={colors.muted}
              multiline
              maxLength={2000}
              accessibilityLabel="Mensagem"
              style={[styles.input, { color: colors.text, backgroundColor: colors.surface, borderColor: colors.border }]}
            />
            <Pressable
              onPress={() => text.trim() && send.mutate(text.trim())}
              disabled={!text.trim() || send.isPending}
              accessibilityRole="button"
              accessibilityLabel="Enviar mensagem"
              accessibilityState={{ disabled: !text.trim() || send.isPending, busy: send.isPending }}
              style={[styles.send, { backgroundColor: text.trim() ? colors.red : colors.subtle }]}>
              {send.isPending ? (
                <ActivityIndicator color={colors.onRed} />
              ) : (
                <SendHorizontal size={20} color={text.trim() ? colors.onRed : colors.muted} />
              )}
            </Pressable>
          </View>
        </View>
      )}
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  adBar: { paddingHorizontal: space.lg, paddingVertical: space.sm, borderBottomWidth: StyleSheet.hairlineWidth, minHeight: 52 },
  offline: { paddingHorizontal: space.lg, paddingVertical: space.xs },
  list: { padding: space.lg, gap: space.sm, flexGrow: 1 },
  older: { marginVertical: space.lg },
  // A lista invertida já desvira o ListEmptyComponent; outro transform aqui o deixaria espelhado.
  empty: { textAlign: 'center', marginTop: space.xl },
  bubble: { maxWidth: '82%', paddingHorizontal: space.md, paddingVertical: space.sm, borderRadius: radius.lg, gap: 2 },
  mine: { alignSelf: 'flex-end', borderBottomRightRadius: radius.sm / 2 },
  theirs: { alignSelf: 'flex-start', borderBottomLeftRadius: radius.sm / 2 },
  meta: { flexDirection: 'row', alignItems: 'center', gap: 4, alignSelf: 'flex-end' },
  mineMeta: { opacity: 0.85 },
  headerButton: { minHeight: 44, minWidth: 44, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6 },
  blocked: { gap: space.sm, padding: space.lg, borderTopWidth: StyleSheet.hairlineWidth },
  closed: { flexDirection: 'row', alignItems: 'center', gap: space.sm, padding: space.lg, borderTopWidth: StyleSheet.hairlineWidth },
  composer: { paddingHorizontal: space.md, paddingTop: space.sm, borderTopWidth: StyleSheet.hairlineWidth, gap: space.sm },
  row: { flexDirection: 'row', alignItems: 'flex-end', gap: space.sm },
  input: {
    flex: 1,
    minHeight: 44,
    maxHeight: 140,
    paddingHorizontal: space.md,
    paddingTop: space.sm + 2,
    paddingBottom: space.sm + 2,
    borderRadius: radius.lg,
    borderWidth: 1,
    fontFamily: fonts.body,
    fontSize: 16,
  },
  send: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
});
