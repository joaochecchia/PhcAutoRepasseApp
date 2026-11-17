import { useQuery } from '@tanstack/react-query';
import {
  ArrowLeftRight,
  CreditCard,
  FileCheck2,
  Fuel,
  Landmark,
  Percent,
  ScrollText,
  ShieldCheck,
  Tag,
  TicketPercent,
  TrendingDown,
  type LucideIcon,
} from 'lucide-react-native';
import { Pressable, StyleSheet, View } from 'react-native';

import { fetchStorePromotions } from '@/api/ads';
import type { PromotionCondition, PromotionConditionType, PublicPromotion } from '@/api/contracts';
import { AppText } from '@/components/app-text';
import { useTheme } from '@/hooks/use-theme';
import { radius, space } from '@/theme';

export const conditionIcons: Record<PromotionConditionType, LucideIcon> = {
  FINANCIAMENTO: Landmark,
  PARCELAMENTO: CreditCard,
  DESCONTO: Percent,
  ABAIXO_FIPE: TrendingDown,
  IPVA_PAGO: FileCheck2,
  DOCUMENTACAO_GRATIS: ScrollText,
  BONUS_TROCA: ArrowLeftRight,
  GARANTIA: ShieldCheck,
  TANQUE_CHEIO: Fuel,
  OUTRO: Tag,
};

const shortDate = new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: '2-digit', timeZone: 'UTC' });
/** "Válida até 30/11" (o último dia conta). Sem data final, nada. */
export function promotionValidity(fim: string | null) {
  return fim ? `Válida até ${shortDate.format(new Date(`${fim}T00:00:00Z`))}` : '';
}

export function ConditionList({ conditions }: { conditions: PromotionCondition[] }) {
  const { colors } = useTheme();
  return (
    <View style={styles.conditions}>
      {conditions.map((condition) => {
        const Icon = conditionIcons[condition.tipo];
        return (
          <View key={condition.tipo} style={styles.condition}>
            <Icon size={16} color={colors.red} />
            <View style={styles.flex}>
              <AppText variant="bodyStrong">{condition.resumo}</AppText>
              {condition.observacao && condition.tipo !== 'OUTRO' ? (
                <AppText variant="caption" color="muted">
                  {condition.observacao}
                </AppText>
              ) : null}
            </View>
          </View>
        );
      })}
    </View>
  );
}

export function PromotionBadge() {
  const { colors } = useTheme();
  return (
    <View style={[styles.badge, { backgroundColor: colors.redTint }]}>
      <TicketPercent size={14} color={colors.red} />
      <AppText variant="label" color="red">
        Promoção
      </AppText>
    </View>
  );
}

export function PromotionCard({ promotion, scopeNote }: { promotion: PublicPromotion; scopeNote?: boolean }) {
  const { colors } = useTheme();
  return (
    <View
      accessibilityLabel={`Promoção: ${promotion.titulo}`}
      style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.redBorder }]}>
      <View style={styles.head}>
        <PromotionBadge />
        {promotion.fim ? (
          <AppText variant="caption" color="muted">
            {promotionValidity(promotion.fim)}
          </AppText>
        ) : null}
      </View>
      <AppText variant="heading">{promotion.titulo}</AppText>
      {scopeNote ? (
        <AppText variant="caption" color="muted">
          {promotion.abrangencia === 'TODOS' ? 'Vale para todos os veículos' : 'Vale para os veículos com a etiqueta'}
        </AppText>
      ) : null}
      <ConditionList conditions={promotion.condicoes} />
      {promotion.descricao ? <AppText color="muted">{promotion.descricao}</AppText> : null}
    </View>
  );
}

/**
 * Bloco do anúncio ou do lote. A promoção que vale para o veículo aparece com as condições; se a loja só tem
 * promoção em outros veículos, um aviso leva à página da loja. Sem promoção ou com falha, nada aparece.
 */
export function VehiclePromotions({
  sellerId,
  anuncioId,
  loteId,
  onOpenStore,
}: {
  sellerId?: string | null;
  anuncioId?: string | null;
  loteId?: string | null;
  onOpenStore?: () => void;
}) {
  const { colors } = useTheme();
  const promotions = useQuery({
    queryKey: ['store-promotions', sellerId, anuncioId ?? null, loteId ?? null],
    queryFn: ({ signal }) => fetchStorePromotions(sellerId!, { anuncioId, loteId }, signal),
    enabled: Boolean(sellerId),
  });
  const list = promotions.data ?? [];
  if (!list.length) return null;
  const applies = list.filter((promotion) => promotion.valeParaEsteVeiculo);
  const elsewhere = list.filter((promotion) => !promotion.valeParaEsteVeiculo);
  if (applies.length)
    return (
      <View style={styles.stack}>
        {applies.map((promotion) => (
          <PromotionCard key={promotion.id} promotion={promotion} />
        ))}
      </View>
    );
  const first = elsewhere[0];
  return (
    <Pressable
      disabled={!onOpenStore}
      onPress={onOpenStore}
      accessibilityRole={onOpenStore ? 'button' : undefined}
      style={[styles.note, { backgroundColor: colors.redTint, borderColor: colors.redBorder }]}>
      <TicketPercent size={18} color={colors.red} />
      <View style={styles.flex}>
        <AppText variant="bodyStrong">{onOpenStore ? 'Esta loja está com promoção' : 'Este anunciante está com promoção'}</AppText>
        <AppText color="muted">
          {first.titulo}: {first.condicoes.map((condition) => condition.resumo).join(', ')}
          {elsewhere.length > 1 ? ` e mais ${elsewhere.length - 1}` : ''}.
        </AppText>
        {onOpenStore ? (
          <AppText variant="label" color="red">
            Ver veículos em promoção
          </AppText>
        ) : null}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  stack: { gap: space.md },
  conditions: { gap: space.sm },
  condition: { flexDirection: 'row', gap: space.sm, alignItems: 'flex-start' },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: space.sm,
    paddingVertical: 3,
    borderRadius: radius.pill,
    alignSelf: 'flex-start',
  },
  card: { padding: space.lg, borderRadius: radius.lg, borderWidth: 1, gap: space.sm },
  head: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: space.sm },
  note: { flexDirection: 'row', gap: space.md, padding: space.lg, borderRadius: radius.lg, borderWidth: 1 },
});
