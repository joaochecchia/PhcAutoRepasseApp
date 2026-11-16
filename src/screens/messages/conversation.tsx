import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { WifiOff } from 'lucide-react-native';
import { FlatList, KeyboardAvoidingView, Platform, View } from 'react-native';
import { chatApi } from '@/api/chat';
import { AppText } from '@/components/app-text';
import { Button } from '@/components/button';
import { StateView } from '@/components/state-view';
import { TextField } from '@/components/text-field';
import { useSession } from '@/hooks/use-session';
import { useTheme } from '@/hooks/use-theme';
import { space } from '@/theme';

export function ConversationScreen({ id }: { id: string }) {
  const { colors } = useTheme();
  const session = useSession();
  const userId = session.status === 'authenticated' ? session.user.usuarioId : '';
  const cache = useQueryClient();
  const [text, setText] = useState('');
  const conversation = useQuery({ queryKey: ['conversation', id], queryFn: ({ signal }) => chatApi.conversation(id, signal), enabled: !!id });
  const messages = useQuery({ queryKey: ['messages', id], queryFn: ({ signal }) => chatApi.messages(id, undefined, signal), enabled: !!id, refetchInterval: 5000 });
  useEffect(() => { if (messages.data?.mensagens.some((m) => m.autorId !== userId)) chatApi.markRead(id).catch(() => undefined); }, [id, messages.data, userId]);
  const send = useMutation({ mutationFn: () => chatApi.send(id, text.trim()), onSuccess: () => { setText(''); cache.invalidateQueries({ queryKey: ['messages', id] }); cache.invalidateQueries({ queryKey: ['conversations'] }); } });
  if (conversation.isError || messages.isError) return <StateView icon={WifiOff} title="Não abrimos a conversa" message={(conversation.error ?? messages.error)?.message ?? 'Tente de novo.'} actionLabel="Tentar de novo" onAction={() => { conversation.refetch(); messages.refetch(); }} />;
  return <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1, backgroundColor: colors.bg }}>
    <View style={{ padding: space.lg }}><AppText variant="title">{conversation.data?.outroNome ?? 'Conversa'}</AppText><AppText color="muted">{conversation.data?.tituloAnuncio}</AppText></View>
    <FlatList inverted data={messages.data?.mensagens ?? []} keyExtractor={(m) => m.id} contentContainerStyle={{ padding: space.lg, gap: space.sm }}
      ListEmptyComponent={<AppText color="muted">{messages.isPending ? 'Carregando mensagens…' : 'Envie a primeira mensagem.'}</AppText>}
      renderItem={({ item }) => <View style={{ alignSelf: item.autorId === userId ? 'flex-end' : 'flex-start', maxWidth: '85%', backgroundColor: item.autorId === userId ? colors.redTint : colors.surface, padding: space.md, borderRadius: 16 }}><AppText>{item.texto}</AppText></View>} />
    {conversation.data?.encerradaEm ? <AppText color="muted">Conversa encerrada.</AppText> : <View style={{ padding: space.lg, gap: space.sm }}><TextField label="Mensagem" value={text} onChangeText={setText} multiline maxLength={2000} /><Button label="Enviar" disabled={!text.trim()} loading={send.isPending} onPress={() => send.mutate()} />{send.isError ? <AppText color="red">{send.error.message}</AppText> : null}</View>}
  </KeyboardAvoidingView>;
}
