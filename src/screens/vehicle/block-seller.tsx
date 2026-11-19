import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import * as Haptics from 'expo-haptics';
import { Ban, RotateCw } from 'lucide-react-native';
import { Pressable, StyleSheet, View } from 'react-native';

import { chatApi } from '@/api/chat';
import { AppText } from '@/components/app-text';
import { showDialog } from '@/components/dialog';
import { useTheme } from '@/hooks/use-theme';
import { space, touch } from '@/theme';

import { blockControl } from './block-state';

/**
 * Bloquear o anunciante direto pelo anúncio, antes de qualquer conversa (App Store 1.2 e Google Play, conteúdo
 * gerado por usuários). Bloqueado, nenhum dos dois manda mensagem ao outro; o desbloqueio fica aqui mesmo. O controle
 * fica sempre visível: carregando, sem ação; com erro, "Tentar novamente". Só para quem entrou e não é o dono.
 */
export function BlockSellerLink({ sellerId, sellerName }: { sellerId: string; sellerName: string }) {
  const { colors } = useTheme();
  const cache = useQueryClient();
  const blocks = useQuery({ queryKey: ['chat-blocks'], queryFn: ({ signal }) => chatApi.blocks(signal) });
  const toggle = useMutation({
    mutationFn: (next: boolean) => (next ? chatApi.block(sellerId) : chatApi.unblock(sellerId)),
    onSuccess: (_, next) => {
      Haptics.notificationAsync(next ? Haptics.NotificationFeedbackType.Warning : Haptics.NotificationFeedbackType.Success);
      cache.invalidateQueries({ queryKey: ['chat-blocks'] });
    },
    onError: (error) => showDialog({ title: 'Não deu certo', message: error.message }),
  });
  const control = blockControl(sellerId, blocks);
  const busy = toggle.isPending || control.kind === 'loading';

  function onPress() {
    if (control.kind === 'error') {
      blocks.refetch();
      return;
    }
    if (control.kind !== 'ready') return;
    if (!control.next) {
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

  const accessibilityLabel =
    control.kind === 'ready'
      ? control.next
        ? `Bloquear ${sellerName}`
        : `Desbloquear ${sellerName}`
      : control.kind === 'error'
        ? 'Tentar conferir o bloqueio de novo'
        : 'Conferindo se você bloqueou este anunciante';

  return (
    <View style={styles.root}>
      {control.kind === 'error' ? (
        <AppText variant="caption" color="muted" accessibilityRole="alert" style={styles.message}>
          {control.message}
        </AppText>
      ) : null}
      <Pressable
        onPress={onPress}
        disabled={busy}
        hitSlop={8}
        accessibilityRole="button"
        accessibilityLabel={accessibilityLabel}
        accessibilityState={{ disabled: busy, busy }}
        style={({ pressed }) => [styles.link, { opacity: pressed || busy ? 0.5 : 1 }]}>
        {control.kind === 'error' ? <RotateCw size={14} color={colors.muted} /> : <Ban size={14} color={colors.muted} />}
        <AppText variant="caption" color="muted">
          {control.label}
        </AppText>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { alignItems: 'center' },
  message: { textAlign: 'center' },
  link: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: space.xs, minHeight: touch },
});
