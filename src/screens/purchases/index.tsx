import { useQuery } from '@tanstack/react-query';
import { router } from 'expo-router';
import { ChevronRight, LockKeyhole, ShoppingBag, WifiOff } from 'lucide-react-native';
import { FlatList, Pressable, RefreshControl, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { salesApi } from '@/api/sales';
import { AppText } from '@/components/app-text';
import { SupportWhatsApp } from '@/components/payment/support-whatsapp';
import { Skeleton } from '@/components/skeleton';
import { StateView } from '@/components/state-view';
import { formatDate, money } from '@/data/plans';
import { useSession } from '@/hooks/use-session';
import { useTheme } from '@/hooks/use-theme';
import { radius, space, touch } from '@/theme';
import { PurchaseStatus } from './status';

/** Veículos do Pátio PHC comprados ou reservados pela conta (PurchasesPage do site). */
export function PurchasesScreen() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const session = useSession();
  const signedIn = session.status === 'authenticated';
  const list = useQuery({
    queryKey: ['purchases'],
    queryFn: ({ signal }) => salesApi.purchases(signal),
    enabled: signedIn,
  });

  if (!signedIn)
    return (
      <StateView
        icon={LockKeyhole}
        title="Entre na sua conta"
        message="Suas compras de veículos ficam aqui."
        actionLabel="Entrar"
        onAction={() => router.push('/entrar')}
      />
    );
  if (list.isPending)
    return (
      <View style={[styles.content, { backgroundColor: colors.bg }]}>
        {[0, 1, 2].map((key) => (
          <Skeleton key={key} height={76} rounded={radius.lg} />
        ))}
      </View>
    );
  if (list.isError)
    return (
      <StateView
        icon={WifiOff}
        title="Suas compras não carregaram"
        message={list.error.message}
        actionLabel="Tentar de novo"
        onAction={() => list.refetch()}
      />
    );

  return (
    <FlatList
      style={{ backgroundColor: colors.bg }}
      contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + space.xl }]}
      data={list.data}
      keyExtractor={(item) => item.id}
      refreshControl={<RefreshControl refreshing={list.isRefetching} onRefresh={() => void list.refetch()} tintColor={colors.red} />}
      ListEmptyComponent={
        <StateView
          icon={ShoppingBag}
          title="Nenhuma compra por aqui"
          message="Os veículos do Pátio PHC Auto com preço anunciado podem ser comprados na página do anúncio."
          actionLabel="Ver o Pátio PHC"
          onAction={() => router.push('/patio')}
          compact
        />
      }
      renderItem={({ item }) => (
        <Pressable
          onPress={() => router.push({ pathname: '/minhas-compras/[id]', params: { id: item.id } })}
          accessibilityRole="button"
          accessibilityLabel={`${item.titulo}, ${money(item.valorCentavos)}`}
          style={({ pressed }) => [
            styles.row,
            { backgroundColor: pressed ? colors.subtle : colors.surface, borderColor: colors.border },
          ]}>
          <View style={styles.flex}>
            <AppText variant="bodyStrong" numberOfLines={2}>
              {item.titulo}
            </AppText>
            <AppText variant="caption" color="muted">
              Pedido em {formatDate(item.criadoEm)} · {money(item.valorCentavos)}
            </AppText>
            <PurchaseStatus status={item.status} />
          </View>
          <ChevronRight size={18} color={colors.muted} />
        </Pressable>
      )}
      ListFooterComponent={<SupportWhatsApp message="Olá! Tenho uma dúvida sobre a compra de um veículo pelo app." />}
    />
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, gap: space.xs },
  content: { padding: space.lg, gap: space.md, flexGrow: 1 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    padding: space.lg,
    minHeight: touch,
    borderRadius: radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
  },
});
