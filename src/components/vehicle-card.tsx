import { Image } from 'expo-image';
import { router } from 'expo-router';
import { BadgeCheck, CarFront, Layers, TrendingDown } from 'lucide-react-native';
import { StyleSheet, View } from 'react-native';

import { mediaUrl } from '@/api/client';
import type { SearchAd } from '@/api/contracts';
import { AppText } from '@/components/app-text';
import { FavoriteButton } from '@/components/favorite-button';
import { PressableScale } from '@/components/pressable-scale';
import { Skeleton } from '@/components/skeleton';
import { useTheme } from '@/hooks/use-theme';
import { formatKm, formatLocation, formatPrice, formatYears, humanize, isBelowFipe } from '@/utils/format';
import { radius, space } from '@/theme';

type Props = { ad: SearchAd; layout?: 'row' | 'tile'; width?: number };

function openAd(ad: SearchAd) {
  router.push({ pathname: '/anuncio/[id]', params: { id: ad.anuncioId } });
}

function Photo({ ad, style }: { ad: SearchAd; style: object }) {
  const { colors } = useTheme();
  const uri = mediaUrl(ad.fotoPrincipalUrl);
  if (!uri) {
    return (
      <View style={[style, styles.noPhoto, { backgroundColor: colors.subtle }]}>
        <CarFront size={28} color={colors.muted} strokeWidth={1.5} />
      </View>
    );
  }
  return (
    <Image
      source={{ uri }}
      style={[style, { backgroundColor: colors.subtle }]}
      contentFit="cover"
      transition={180}
      recyclingKey={ad.anuncioId}
      accessibilityIgnoresInvertColors
    />
  );
}

function SoldBadge() {
  return (
    <View style={[styles.badge, { backgroundColor: '#28704a' }]}>
      <AppText variant="overline" style={styles.badgeText}>
        Vendido
      </AppText>
    </View>
  );
}

/** Card do veículo: "row" (foto à esquerda, como na vitrine) e "tile" (foto em cima, para listas). */
export function VehicleCard({ ad, layout = 'tile', width }: Props) {
  const { colors } = useTheme();
  const years = formatYears(ad.anoFabricacao, ad.anoModelo);
  const km = formatKm(ad.quilometragem);
  const version = humanize(ad.motorizacao) ?? ad.titulo;
  const below = isBelowFipe(ad);
  const sold = Boolean(ad.vendidoEm);
  const label = `${ad.fabricante} ${ad.modelo}, ${formatPrice(ad.tipoPreco, ad.precoCentavos)}, ${years ?? ''}, ${formatLocation(ad.cidade, ad.uf)}`;

  if (layout === 'row') {
    return (
      <PressableScale
        onPress={() => openAd(ad)}
        accessibilityRole="button"
        accessibilityLabel={label}
        style={[styles.row, { width, backgroundColor: colors.surface, borderColor: colors.border }]}>
        <View>
          <Photo ad={ad} style={styles.rowPhoto} />
          {sold ? <SoldBadge /> : null}
        </View>
        <View style={styles.rowBody}>
          <AppText variant="overline" color="muted" numberOfLines={1}>
            {ad.fabricante}
          </AppText>
          <AppText variant="bodyStrong" numberOfLines={1}>
            {ad.modelo}
          </AppText>
          <AppText variant="caption" color="muted" numberOfLines={1}>
            {version}
          </AppText>
          <AppText variant="price" color={sold ? 'muted' : 'text'} style={styles.rowPrice} numberOfLines={1}>
            {formatPrice(ad.tipoPreco, ad.precoCentavos)}
          </AppText>
          <AppText variant="caption" color="muted" numberOfLines={1}>
            {[years, formatLocation(ad.cidade, ad.uf)].filter(Boolean).join(' • ')}
          </AppText>
          {!sold ? (
            <View style={styles.rowFooter}>
              {below ? <FipeTag /> : <View />}
              <FavoriteButton ad={ad} size={34} />
            </View>
          ) : null}
        </View>
      </PressableScale>
    );
  }

  return (
    <PressableScale
      onPress={() => openAd(ad)}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={[styles.tile, { width, backgroundColor: colors.surface, borderColor: colors.border }]}>
      <View>
        <Photo ad={ad} style={styles.tilePhoto} />
        <View style={styles.tileOverlay}>
          <View style={styles.tags}>
            {ad.patrocinado ? <Tag text="Destaque" /> : null}
            {ad.loteId ? <Tag text={`Lote · ${ad.loteDisponiveis ?? 0}`} icon /> : null}
          </View>
          {!sold ? <FavoriteButton ad={ad} onImage /> : null}
        </View>
        {sold ? <SoldBadge /> : null}
      </View>
      <View style={styles.tileBody}>
        <View style={styles.titleRow}>
          <AppText variant="heading" numberOfLines={1} style={styles.flex}>
            {ad.fabricante} {ad.modelo}
          </AppText>
          {ad.selo === 'PHC' || ad.selo === 'VERIFICADO' ? (
            <BadgeCheck size={18} color={colors.deal} accessibilityLabel="Anunciante verificado" />
          ) : null}
        </View>
        <AppText variant="caption" color="muted" numberOfLines={1}>
          {version}
        </AppText>
        <View style={styles.priceRow}>
          <AppText variant="price" color={sold ? 'muted' : 'text'}>
            {formatPrice(ad.tipoPreco, ad.precoCentavos)}
          </AppText>
          {below ? <FipeTag /> : null}
        </View>
        <AppText variant="caption" color="muted" numberOfLines={1}>
          {[years, km, formatLocation(ad.cidade, ad.uf)].filter(Boolean).join(' • ')}
        </AppText>
      </View>
    </PressableScale>
  );
}

function FipeTag() {
  const { colors } = useTheme();
  return (
    <View style={[styles.fipe, { backgroundColor: colors.dealTint, borderColor: colors.dealBorder }]}>
      <TrendingDown size={12} color={colors.deal} />
      <AppText variant="label" color="deal" style={styles.fipeText}>
        Abaixo da FIPE
      </AppText>
    </View>
  );
}

function Tag({ text, icon }: { text: string; icon?: boolean }) {
  return (
    <View style={styles.tag}>
      {icon ? <Layers size={12} color="#fff" /> : null}
      <AppText variant="label" style={styles.tagText}>
        {text}
      </AppText>
    </View>
  );
}

export function VehicleCardSkeleton({ layout = 'tile', width }: { layout?: 'row' | 'tile'; width?: number }) {
  const { colors } = useTheme();
  if (layout === 'row') {
    return (
      <View style={[styles.row, { width, backgroundColor: colors.surface, borderColor: colors.border }]}>
        <Skeleton width={112} height={112} rounded={radius.md} />
        <View style={[styles.rowBody, { gap: space.sm }]}>
          <Skeleton width="40%" height={10} />
          <Skeleton width="80%" height={14} />
          <Skeleton width="60%" height={18} />
          <Skeleton width="70%" height={10} />
        </View>
      </View>
    );
  }
  return (
    <View style={[styles.tile, { width, backgroundColor: colors.surface, borderColor: colors.border }]}>
      <Skeleton rounded={0} style={styles.tilePhoto} />
      <View style={[styles.tileBody, { gap: space.sm }]}>
        <Skeleton width="70%" height={16} />
        <Skeleton width="45%" height={12} />
        <Skeleton width="40%" height={20} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  row: {
    flexDirection: 'row',
    gap: space.md,
    padding: space.md,
    borderRadius: radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
  },
  rowPhoto: { width: 112, height: 112, borderRadius: radius.md },
  rowBody: { flex: 1, minWidth: 0 },
  rowPrice: { marginTop: space.xs },
  rowFooter: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: space.xs },
  noPhoto: { alignItems: 'center', justifyContent: 'center' },
  tile: { borderRadius: radius.lg, borderWidth: StyleSheet.hairlineWidth, overflow: 'hidden' },
  tilePhoto: { width: '100%', aspectRatio: 4 / 3 },
  tileOverlay: {
    position: 'absolute',
    top: space.sm,
    left: space.sm,
    right: space.sm,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  tags: { flexDirection: 'row', gap: space.xs, flexShrink: 1, flexWrap: 'wrap' },
  tag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(18,19,21,0.6)',
    paddingHorizontal: space.sm,
    paddingVertical: 4,
    borderRadius: radius.pill,
  },
  tagText: { color: '#fff', fontSize: 12 },
  tileBody: { padding: space.md, gap: 2 },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: space.xs },
  priceRow: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: space.sm, marginTop: space.xs },
  fipe: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: space.sm,
    paddingVertical: 3,
    borderRadius: radius.pill,
    borderWidth: 1,
  },
  fipeText: { fontSize: 11 },
  badge: { position: 'absolute', bottom: space.sm, left: space.sm, paddingHorizontal: space.sm, paddingVertical: 4, borderRadius: 6 },
  badgeText: { color: '#fff' },
});
