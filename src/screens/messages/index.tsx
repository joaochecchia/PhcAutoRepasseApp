import { useQuery } from '@tanstack/react-query';
import { router, type Href } from 'expo-router';
import { WifiOff } from 'lucide-react-native';
import { FlatList, Pressable, View } from 'react-native';
import { chatApi } from '@/api/chat';
import { AppText } from '@/components/app-text';
import { Button } from '@/components/button';
import { StateView } from '@/components/state-view';
import { useSession } from '@/hooks/use-session';
import { useTheme } from '@/hooks/use-theme';
import { space } from '@/theme';

export function MessagesScreen() {
  const { colors } = useTheme();
  const signedIn = useSession().status === 'authenticated';
  const query = useQuery({ queryKey: ['conversations'], queryFn: ({ signal }) => chatApi.conversations(signal), enabled: signedIn });
  if (!signedIn) return <View style={{ flex: 1, padding: space.lg, backgroundColor: colors.bg }}><AppText variant="title">Entre para ver suas mensagens</AppText><Button label="Entrar" onPress={() => router.push('/entrar')} /></View>;
  if (query.isError) return <StateView icon={WifiOff} title="Não carregamos as mensagens" message={query.error.message} actionLabel="Tentar de novo" onAction={() => query.refetch()} />;
  return <FlatList style={{ backgroundColor: colors.bg }} contentContainerStyle={{ padding: space.lg, gap: space.md }}
    data={query.data ?? []} keyExtractor={(item) => item.id} refreshing={query.isRefetching} onRefresh={() => query.refetch()}
    ListHeaderComponent={<AppText variant="display">Mensagens</AppText>}
    ListEmptyComponent={<AppText color="muted">{query.isPending ? 'Carregando conversas…' : 'Você ainda não tem conversas.'}</AppText>}
    renderItem={({ item }) => <Pressable accessibilityRole="button" accessibilityLabel={`Conversa com ${item.outroNome}`} onPress={() => router.push(`/mensagens/${item.id}` as Href)}
      style={{ minHeight: 72, padding: space.lg, borderRadius: 16, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border }}>
      <AppText variant="bodyStrong">{item.outroNome}{item.naoLidas ? ` · ${item.naoLidas} novas` : ''}</AppText>
      <AppText color="muted" numberOfLines={1}>{item.tituloAnuncio}</AppText>
      <AppText color="muted" numberOfLines={1}>{item.ultimaMensagem ?? 'Conversa iniciada'}</AppText>
    </Pressable>} />;
}
