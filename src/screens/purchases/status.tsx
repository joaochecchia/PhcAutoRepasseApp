import { StyleSheet, View } from 'react-native';

import type { VehiclePurchase } from '@/api/sales';
import { AppText } from '@/components/app-text';
import { useTheme } from '@/hooks/use-theme';
import { radius, space } from '@/theme';

export const statusLabels: Record<VehiclePurchase['status'], string> = {
  AGUARDANDO_PAGAMENTO: 'Aguardando pagamento',
  PAGO: 'Pago',
  CANCELADO: 'Cancelada',
  EXPIRADO: 'Boleto vencido',
  REEMBOLSADO: 'Reembolsada',
};

export const methodLabels: Record<VehiclePurchase['metodo'], string> = {
  PIX: 'Compra com Pix',
  BOLETO: 'Compra com boleto',
  CARTAO_CREDITO: 'Compra no crédito',
  CARTAO_DEBITO: 'Compra no débito',
};

/** Situação da compra: verde paga, vermelho aguardando, neutro encerrada. */
export function PurchaseStatus({ status }: { status: VehiclePurchase['status'] }) {
  const { colors } = useTheme();
  const tone =
    status === 'PAGO'
      ? { bg: colors.dealTint, fg: 'deal' as const }
      : status === 'AGUARDANDO_PAGAMENTO'
        ? { bg: colors.redTint, fg: 'red' as const }
        : { bg: colors.subtle, fg: 'muted' as const };
  return (
    <View style={[styles.pill, { backgroundColor: tone.bg }]}>
      <AppText variant="label" color={tone.fg}>
        {statusLabels[status]}
      </AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  pill: { alignSelf: 'flex-start', paddingHorizontal: space.sm, paddingVertical: 3, borderRadius: radius.pill },
});
