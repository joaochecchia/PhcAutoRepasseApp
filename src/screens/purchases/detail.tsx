import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import * as Haptics from 'expo-haptics';
import { router, useLocalSearchParams } from 'expo-router';
import { WifiOff } from 'lucide-react-native';
import { ActivityIndicator, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { salesApi, type VehiclePurchase } from '@/api/sales';
import { AppText } from '@/components/app-text';
import { Button } from '@/components/button';
import { showDialog } from '@/components/dialog';
import { Notice } from '@/components/notice';
import { BoletoBox } from '@/components/payment/boleto-box';
import { PixBox } from '@/components/payment/pix-box';
import { SupportWhatsApp } from '@/components/payment/support-whatsapp';
import { Skeleton } from '@/components/skeleton';
import { StateView } from '@/components/state-view';
import { formatDate, money } from '@/data/plans';
import { useTheme } from '@/hooks/use-theme';
import { radius, space } from '@/theme';
import { methodLabels, PurchaseStatus } from './status';

const formatDateTime = (value: string) =>
  new Date(value).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });

/** Pix e cartão confirmam em segundos: consulta de novo até a operadora decidir. O boleto emitido compensa em dias. */
const polls = (purchase: VehiclePurchase | undefined) =>
  Boolean(purchase && purchase.status === 'AGUARDANDO_PAGAMENTO' && !purchase.boleto);

/** Uma compra: pagamento em aberto (Pix ou boleto), situação e desistência. */
export function PurchaseDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const queryClient = useQueryClient();
  const purchase = useQuery({
    queryKey: ['purchase', id],
    queryFn: async ({ signal }) => {
      const next = await salesApi.purchase(id, signal);
      const before = queryClient.getQueryData<VehiclePurchase>(['purchase', id]);
      if (before?.status === 'AGUARDANDO_PAGAMENTO' && next.status === 'PAGO') {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        queryClient.invalidateQueries({ queryKey: ['purchases'] });
      }
      return next;
    },
    refetchInterval: (query) => (polls(query.state.data) ? 5000 : false),
  });
  const cancel = useMutation({
    mutationFn: () => salesApi.cancelPurchase(id),
    onSuccess: (next) => {
      queryClient.setQueryData(['purchase', id], next);
      queryClient.invalidateQueries({ queryKey: ['purchases'] });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    },
  });

  if (purchase.isPending)
    return (
      <View style={[styles.content, { backgroundColor: colors.bg }]}>
        <Skeleton height={96} rounded={radius.lg} />
        <Skeleton height={260} rounded={radius.lg} />
      </View>
    );
  if (purchase.isError)
    return (
      <StateView
        icon={WifiOff}
        title="A compra não carregou"
        message={purchase.error.message}
        actionLabel="Tentar de novo"
        onAction={() => purchase.refetch()}
      />
    );

  const item = purchase.data;
  const open = item.status === 'AGUARDANDO_PAGAMENTO';
  const payable = open && Boolean(item.boleto || item.pix);

  function confirmCancel() {
    cancel.reset();
    showDialog({
      title: 'Desistir da compra?',
      message: `O veículo volta para a vitrine e ${item.pix ? 'este Pix' : 'este boleto'} não deve mais ser pago.`,
      actions: [
        { label: 'Manter reserva', kind: 'cancel' },
        { label: 'Cancelar compra', kind: 'destructive', onPress: () => cancel.mutate() },
      ],
    });
  }

  return (
    <ScrollView
      style={{ backgroundColor: colors.bg }}
      contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + space.xxl }]}>
      <View style={[styles.head, { backgroundColor: colors.subtle }]}>
        <AppText variant="overline" color="muted">
          {methodLabels[item.metodo]}
        </AppText>
        <AppText variant="title">{item.titulo}</AppText>
        <AppText variant="caption" color="muted">
          Pedido em {formatDate(item.criadoEm)}
          {item.cartao?.finalNumero ? ` · cartão final ${item.cartao.finalNumero}` : ''}
          {item.parcelas > 1 ? ` · ${item.parcelas}x` : ''}
        </AppText>
        <AppText variant="price">{money(item.valorCentavos)}</AppText>
      </View>

      <View style={styles.status} accessibilityLiveRegion="polite">
        <PurchaseStatus status={item.status} />
        <AppText color="muted">{item.mensagem}</AppText>
      </View>

      {open && item.pix ? (
        <View style={styles.section}>
          <AppText variant="heading">Pague com Pix</AppText>
          <PixBox pix={item.pix} waiting="Aguardando o pagamento. Esta tela atualiza sozinha." />
          {item.reservadoAte ? (
            <AppText variant="caption" color="muted">
              Reservado para você até {formatDateTime(item.reservadoAte)}.
            </AppText>
          ) : null}
        </View>
      ) : null}

      {open && item.boleto ? (
        <View style={styles.section}>
          <AppText variant="heading">Pague o boleto</AppText>
          <BoletoBox boleto={item.boleto} />
        </View>
      ) : null}

      {open && !payable ? (
        <View style={styles.inline}>
          <ActivityIndicator color={colors.red} />
          <AppText color="muted" style={styles.flex}>
            {item.mensagem}
          </AppText>
        </View>
      ) : null}

      {cancel.isError ? <Notice tone="error" message={cancel.error.message} /> : null}
      {payable ? (
        <Button label="Desistir da compra" variant="ghost" loading={cancel.isPending} onPress={confirmCancel} />
      ) : null}
      <Button label="Ver o anúncio" variant="secondary" onPress={() => router.push(`/anuncio/${item.anuncioId}`)} />
      <SupportWhatsApp message={`Olá! Tenho uma dúvida sobre a compra do ${item.titulo}.`} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  content: { padding: space.lg, gap: space.lg },
  head: { padding: space.lg, borderRadius: radius.lg, gap: space.xs },
  status: { gap: space.sm },
  section: { gap: space.md },
  inline: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
});
