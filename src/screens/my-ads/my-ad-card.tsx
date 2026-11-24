import { Layers, MoreHorizontal } from 'lucide-react-native';
import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';

import type { AdStatus, MyAd } from '@/api/my-ads';
import { AppText } from '@/components/app-text';
import { PressableScale } from '@/components/pressable-scale';
import { VehiclePhoto } from '@/components/vehicle-card';
import { useTheme } from '@/hooks/use-theme';
import { radius, space, type Colors } from '@/theme';
import { formatLocation, formatPrice, formatYears, humanize } from '@/utils/format';

export const statusLabels: Record<AdStatus, string> = {
  PUBLICADO: 'Publicado',
  RASCUNHO: 'Rascunho',
  PAUSADO: 'Pausado',
  RESERVADO: 'Reservado',
  VENDIDO: 'Vendido',
  ARQUIVADO: 'Retirado pela equipe',
};

const statusTone: Record<AdStatus, { bg: keyof Colors; border: keyof Colors; text: keyof Colors }> = {
  PUBLICADO: { bg: 'dealTint', border: 'dealBorder', text: 'deal' },
  VENDIDO: { bg: 'dealTint', border: 'dealBorder', text: 'deal' },
  RASCUNHO: { bg: 'subtle', border: 'border', text: 'muted' },
  PAUSADO: { bg: 'subtle', border: 'border', text: 'muted' },
  RESERVADO: { bg: 'subtle', border: 'border', text: 'text' },
  ARQUIVADO: { bg: 'subtle', border: 'border', text: 'muted' },
};

export function StatusPill({ status }: { status: AdStatus }) {
  const { colors } = useTheme();
  const tone = statusTone[status];
  return (
    <View style={[styles.status, { backgroundColor: colors[tone.bg], borderColor: colors[tone.border] }]}>
      <AppText variant="label" color={tone.text} style={styles.statusText}>
        {statusLabels[status]}
      </AppText>
    </View>
  );
}

type Props = {
  ad: MyAd;
  busy: boolean;
  /** Toque no card: editar (carro de lote não tem edição avulsa). */
  onPress: () => void;
  onActions: () => void;
};

/** Card de Meus anúncios: o mesmo desenho do card da vitrine, com a situação e o botão de ações. */
export function MyAdCard({ ad, busy, onPress, onActions }: Props) {
  const { colors } = useTheme();
  const years = formatYears(ad.anoFabricacao, ad.anoModelo);
  const price = formatPrice(ad.tipoPreco ?? 'FIXO', ad.precoCentavos);
  const version = humanize(ad.versao) ?? ad.titulo;

  return (
    <PressableScale
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${ad.fabricante} ${ad.modelo}, ${price}, ${statusLabels[ad.status]}`}
      accessibilityHint="Abre a edição do anúncio"
      scaleTo={0.98}
      style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
      <View>
        <VehiclePhoto path={ad.fotoPrincipalUrl} recyclingKey={ad.id} style={styles.photo} owner />
        {ad.loteId ? (
          <View style={styles.lot}>
            <Layers size={12} color="#fff" />
            <AppText variant="label" style={styles.lotText}>
              Lote
            </AppText>
          </View>
        ) : null}
      </View>
      <View style={styles.body}>
        <AppText variant="overline" color="muted" numberOfLines={1}>
          {ad.fabricante}
        </AppText>
        <AppText variant="bodyStrong" numberOfLines={1}>
          {ad.modelo}
        </AppText>
        <AppText variant="caption" color="muted" numberOfLines={1}>
          {version}
        </AppText>
        <AppText variant="price" color={ad.status === 'VENDIDO' ? 'muted' : 'text'} style={styles.price} numberOfLines={1}>
          {price}
        </AppText>
        <AppText variant="caption" color="muted" numberOfLines={1}>
          {[years, formatLocation(ad.cidade, ad.uf)].filter(Boolean).join(' • ')}
        </AppText>
        <View style={styles.footer}>
          <StatusPill status={ad.status} />
          <Pressable
            onPress={onActions}
            disabled={busy}
            hitSlop={{ top: 4, bottom: 4, left: 4, right: 4 }}
            accessibilityRole="button"
            accessibilityLabel={`Ações de ${ad.titulo}`}
            accessibilityState={{ busy, disabled: busy }}
            style={({ pressed }) => [
              styles.action,
              { borderColor: colors.border, backgroundColor: pressed ? colors.subtle : colors.surface },
            ]}>
            {busy ? (
              <ActivityIndicator size="small" color={colors.red} />
            ) : (
              <>
                <MoreHorizontal size={16} color={colors.text} />
                <AppText variant="label">Ações</AppText>
              </>
            )}
          </Pressable>
        </View>
      </View>
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    gap: space.md,
    padding: space.md,
    borderRadius: radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
  },
  photo: { width: 112, height: 112, borderRadius: radius.md },
  lot: {
    position: 'absolute',
    top: space.xs + 2,
    left: space.xs + 2,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(18,19,21,0.6)',
    paddingHorizontal: space.sm,
    paddingVertical: 3,
    borderRadius: radius.pill,
  },
  lotText: { color: '#fff', fontSize: 11 },
  body: { flex: 1, minWidth: 0 },
  price: { marginTop: space.xs },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: space.sm,
    marginTop: space.sm,
  },
  status: { paddingHorizontal: space.sm, paddingVertical: 3, borderRadius: radius.pill, borderWidth: 1 },
  statusText: { fontSize: 11 },
  action: {
    flexDirection: 'row',
    gap: space.xs,
    minWidth: 84,
    minHeight: 36,
    paddingHorizontal: space.md,
    borderRadius: radius.pill,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
