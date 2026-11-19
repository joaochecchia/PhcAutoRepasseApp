import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import * as Haptics from 'expo-haptics';
import { Ban } from 'lucide-react-native';
import { Pressable, StyleSheet } from 'react-native';

import { chatApi } from '@/api/chat';
import { AppText } from '@/components/app-text';
import { showDialog } from '@/components/dialog';
import { useTheme } from '@/hooks/use-theme';
import { space, touch } from '@/theme';

/**
 * Bloquear o anunciante direto pelo anúncio, antes de qualquer conversa (App Store 1.2 e Google Play, conteúdo
 * gerado por usuários). Bloqueado, nenhum dos dois manda mensagem ao outro; o desbloqueio fica aqui mesmo.
 * Só para quem entrou e não é o dono do anúncio.
 */
export function BlockSellerLink({ sellerId, sellerName }: { sellerId: string; sellerName: string }) {
  const { colors } = useTheme();
  const cache = useQueryClient();
  const blocks = useQuery({ queryKey: ['chat-blocks'], queryFn: ({ signal }) => chatApi.blocks(signal) });
  const blocked = Boolean(blocks.data?.some((item) => item.usuarioId === sellerId));
  const toggle = useMutation({
    mutationFn: (next: boolean) => (next ? chatApi.block(sellerId) : chatApi.unblock(sellerId)),
    onSuccess: (_, next) => {
      Haptics.notificationAsync(next ? Haptics.NotificationFeedbackType.Warning : Haptics.NotificationFeedbackType.Success);
      cache.invalidateQueries({ queryKey: ['chat-blocks'] });
    },
    onError: (error) => showDialog({ title: 'Não deu certo', message: error.message }),
  });

  // Sem a lista de bloqueios não dá para saber o estado; sem ela, o link não aparece (o chat continua protegido).
  if (!blocks.data) return null;
  const busy = toggle.isPending;

  function onPress() {
    if (blocked) {
      toggle.mutate(false);
      return;
    }
    showDialog({
      title: `Bloquear ${sellerName}?`,
      message: 'Nenhum dos dois manda mensagem ao outro. Dá para desbloquear depois, aqui ou na conversa.',
      actions: [
        { label: 'Cancelar', kind: 'cancel' },
        { label: 'Bloquear', kind: 'destructive', onPress: () => toggle.mutate(true) },
      ],
    });
  }

  return (
    <Pressable
      onPress={onPress}
      disabled={busy}
      hitSlop={8}
      accessibilityRole="button"
      accessibilityLabel={blocked ? `Desbloquear ${sellerName}` : `Bloquear ${sellerName}`}
      accessibilityHint={blocked ? 'Volta a permitir mensagens com este anunciante' : 'Impede mensagens entre vocês dois'}
      accessibilityState={{ disabled: busy, busy }}
      style={({ pressed }) => [styles.link, { opacity: pressed || busy ? 0.5 : 1 }]}>
      <Ban size={14} color={colors.muted} />
      <AppText variant="caption" color="muted">
        {blocked ? 'Anunciante bloqueado · Desbloquear' : 'Bloquear anunciante'}
      </AppText>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  link: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: space.xs, minHeight: touch },
});
