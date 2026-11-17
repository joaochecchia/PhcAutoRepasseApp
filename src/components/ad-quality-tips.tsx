import { CircleCheck, CircleDashed, TrendingUp } from 'lucide-react-native';
import { StyleSheet, View } from 'react-native';

import { AppText } from '@/components/app-text';
import { useTheme } from '@/hooks/use-theme';
import { radius, space } from '@/theme';

const MAX_PHOTOS = 8;

type Props = {
  photos: number;
  /** Informações adicionais (campos opcionais) preenchidas e o total delas. */
  optionalFilled: number;
  optionalTotal: number;
  /** Preço definido (sob consulta não entra na comparação com a FIPE). */
  priceDefined: boolean;
  /** Nulo quando o tipo de veículo não tem tabela FIPE. */
  fipeLinked: boolean | null;
  /** Só a lista, sem a explicação de cada item (conferência). */
  compact?: boolean;
};

/**
 * Lembra, enquanto o anúncio é preenchido, o que o deixa mais bem colocado na busca, como no site. Mostra só o que já
 * foi feito e o que falta; a relevância é calculada pelo servidor.
 */
export function AdQualityTips({ photos, optionalFilled, optionalTotal, priceDefined, fipeLinked, compact }: Props) {
  const { colors } = useTheme();
  const items: { done: boolean; label: string; detail: string }[] = [
    {
      done: photos >= MAX_PHOTOS,
      label: `Fotos: ${Math.min(photos, MAX_PHOTOS)} de ${MAX_PHOTOS}`,
      detail: 'Mais fotos, de ângulos diferentes, contam mais na relevância.',
    },
    ...(optionalTotal > 0
      ? [
          {
            done: optionalFilled >= optionalTotal,
            label: `Informações adicionais: ${optionalFilled} de ${optionalTotal}`,
            detail: 'Ficha completa ajuda o comprador a decidir e melhora a posição.',
          },
        ]
      : []),
    {
      done: priceDefined,
      label: priceDefined ? 'Preço informado' : 'Preço sob consulta',
      detail: 'Com preço definido o anúncio entra nos filtros de preço e na comparação com a FIPE.',
    },
    ...(fipeLinked === null
      ? []
      : [
          {
            done: fipeLinked,
            label: fipeLinked ? 'Vinculado à tabela FIPE' : 'Sem vínculo com a tabela FIPE',
            detail: 'Preço abaixo da FIPE ganha destaque no card e conta pontos.',
          },
        ]),
  ];
  const pending = items.filter((item) => !item.done).length;
  const summary =
    pending === 0 ? 'Seu anúncio está completo.' : `Falta${pending > 1 ? 'm' : ''} ${pending} ${pending > 1 ? 'itens' : 'item'}.`;

  return (
    <View
      accessible
      accessibilityLabel={`Anúncios completos aparecem antes na busca. ${summary} ${items
        .map((item) => `${item.label}: ${item.done ? 'feito' : 'pendente'}`)
        .join('. ')}.`}
      style={[styles.root, { backgroundColor: colors.subtle, borderColor: colors.border }]}>
      <View style={styles.title}>
        <TrendingUp size={18} color={colors.red} strokeWidth={2} />
        <View style={styles.titleText}>
          <AppText variant="bodyStrong">Anúncios completos aparecem antes na busca.</AppText>
          <AppText variant="caption" color={pending === 0 ? 'deal' : 'muted'}>
            {summary}
          </AppText>
        </View>
      </View>
      {items.map((item) => {
        const Icon = item.done ? CircleCheck : CircleDashed;
        return (
          <View key={item.label} style={styles.item}>
            <Icon size={16} color={item.done ? colors.deal : colors.muted} strokeWidth={2} style={styles.icon} />
            <View style={styles.itemText}>
              <AppText variant="label" color={item.done ? 'deal' : 'text'}>
                {item.label}
              </AppText>
              {!compact && !item.done ? (
                <AppText variant="caption" color="muted">
                  {item.detail}
                </AppText>
              ) : null}
            </View>
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { borderWidth: StyleSheet.hairlineWidth, borderRadius: radius.md, padding: space.lg, gap: space.md },
  title: { flexDirection: 'row', gap: space.sm, alignItems: 'flex-start' },
  titleText: { flex: 1, gap: 2 },
  item: { flexDirection: 'row', gap: space.sm, alignItems: 'flex-start' },
  icon: { marginTop: 1 },
  itemText: { flex: 1, gap: 2 },
});
