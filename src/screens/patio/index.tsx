import { ShieldCheck, Warehouse } from 'lucide-react-native';
import { StyleSheet, View } from 'react-native';

import { AppText } from '@/components/app-text';
import { FilteredAdList } from '@/components/filtered-ad-list';
import { useTheme } from '@/hooks/use-theme';
import { radius, space } from '@/theme';

/** Pátio PHC: estoque próprio, negociado direto com a equipe (o servidor seleciona as contas da PHC). */
export function PatioScreen() {
  const { colors } = useTheme();
  return (
    <FilteredAdList
      base={{ patioPhc: true }}
      queryKey={['patio']}
      withTypes
      placeholder="Marca ou modelo no pátio"
      countLabel={(total, filtering) =>
        `${total} ${total === 1 ? 'veículo no pátio' : 'veículos no pátio'}${filtering ? ' com os filtros aplicados' : ''}`
      }
      empty={{
        icon: Warehouse,
        title: 'O pátio está vazio no momento',
        message: 'Novos veículos entram com frequência. Volte em breve.',
      }}
      header={
        <View style={styles.intro}>
          <AppText variant="overline" color="red">
            Estoque próprio
          </AppText>
          <AppText color="muted">Veículos que estão no pátio da PHC, negociados direto com a nossa equipe.</AppText>
          <View style={[styles.trust, { backgroundColor: colors.dealTint, borderColor: colors.dealBorder }]}>
            <ShieldCheck size={16} color={colors.deal} />
            <AppText variant="label" color="deal">
              Anunciado pela PHC Auto
            </AppText>
          </View>
        </View>
      }
    />
  );
}

const styles = StyleSheet.create({
  intro: { gap: space.sm },
  trust: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.xs,
    paddingHorizontal: space.sm + 2,
    paddingVertical: 4,
    borderRadius: radius.pill,
    borderWidth: 1,
  },
});
