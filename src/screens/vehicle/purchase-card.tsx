import { useQuery } from '@tanstack/react-query';
import { router } from 'expo-router';
import { ShoppingCart } from 'lucide-react-native';
import { StyleSheet, View } from 'react-native';

import type { MetodoPagamento } from '@/api/plans';
import { salesApi } from '@/api/sales';
import { AppText } from '@/components/app-text';
import { Button } from '@/components/button';
import { useTheme } from '@/hooks/use-theme';
import { radius, space } from '@/theme';

const summary = (list: MetodoPagamento[], max: number) => {
  const parts = ['Pix'];
  if (list.includes('CARTAO_CREDITO')) parts.push(`crédito em até ${max}x`);
  if (list.includes('CARTAO_DEBITO')) parts.push('débito');
  if (list.includes('BOLETO')) parts.push('boleto');
  return parts.length === 1 ? 'Pague com Pix' : `Pague com ${parts.slice(0, -1).join(', ')} ou ${parts[parts.length - 1]}`;
};

/**
 * Compra pelo app nos veículos do Pátio PHC habilitados (o backend decide). Sem compra disponível, ou se a consulta
 * falhar, não aparece: o contato com o anunciante continua na barra de baixo.
 */
export function PurchaseCard({ adId, title, signedIn }: { adId: string; title: string; signedIn: boolean }) {
  const { colors } = useTheme();
  const availability = useQuery({
    queryKey: ['purchase-availability', adId, signedIn],
    queryFn: ({ signal }) => salesApi.purchaseAvailability(adId, signal),
  });
  const data = availability.data;
  if (!data?.disponivel || data.valorCentavos == null) return null;
  return (
    <View style={[styles.root, { backgroundColor: colors.surface, borderColor: colors.border }]}>
      <Button
        label="Comprar pelo app"
        icon={<ShoppingCart size={18} color={colors.onRed} />}
        onPress={() =>
          signedIn
            ? router.push({ pathname: '/comprar/[id]', params: { id: adId, titulo: title } })
            : router.push('/entrar')
        }
      />
      <AppText variant="caption" color="muted">
        {summary(data.metodos, data.parcelasMaximas)}. O veículo fica reservado para você.
      </AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { gap: space.sm, padding: space.lg, borderRadius: radius.lg, borderWidth: StyleSheet.hairlineWidth },
});
