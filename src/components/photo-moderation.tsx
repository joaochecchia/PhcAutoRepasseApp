import { Clock3, OctagonAlert } from 'lucide-react-native';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { mediaUrl, privateImageSource } from '@/api/client';
import type { AdPhoto } from '@/api/contracts';
import { AppText } from '@/components/app-text';
import { useTheme } from '@/hooks/use-theme';
import { radius, space } from '@/theme';

/** Foto com arquivo que o comprador vê: as recusadas (e as sem arquivo) ficam de fora até da prévia do anunciante. */
export function shownToBuyers(photo: AdPhoto): photo is AdPhoto & { url: string } {
  return Boolean(photo.url) && photo.statusModeracao !== 'REJEITADA';
}

/** Em análise: ainda não aparece para o público. */
export function inReview(photo: AdPhoto) {
  return photo.statusModeracao === 'PENDENTE' || photo.statusModeracao === 'REVISAO';
}

/**
 * Intervalo do `refetchInterval` enquanto houver foto na análise automática, para o selo mudar sozinho. A revisão da
 * equipe (REVISAO) pode levar horas, então não entra.
 */
export function moderationRefetch(photos: AdPhoto[] | undefined) {
  return photos?.some((photo) => photo.statusModeracao === 'PENDENTE') ? 6000 : false;
}

/**
 * Origem da imagem para o `expo-image`. A aprovada é pública e vai para o cache comum; a que ainda não foi aprovada
 * (ou a de um anúncio que não está no ar, com `owner`) pede a sessão.
 */
export function photoImageSource(photo: AdPhoto, owner = false) {
  const approved = !photo.statusModeracao || photo.statusModeracao === 'APROVADA';
  if (approved && !owner) return photo.url ? { uri: mediaUrl(photo.url)! } : null;
  return privateImageSource(photo.url, photo.statusModeracao ?? 'APROVADA');
}

/**
 * Cache da imagem: a foto ainda não aprovada (sem a placa borrada) vem com `no-store` do servidor e fica só na memória.
 */
export function photoCachePolicy(photo: AdPhoto) {
  return !photo.statusModeracao || photo.statusModeracao === 'APROVADA' ? undefined : ('memory' as const);
}

/** Selo curto sobre a foto: "Em análise" ou "Recusada". Fotos aprovadas não levam selo. */
export function PhotoModerationBadge({ photo, style }: { photo: AdPhoto; style?: StyleProp<ViewStyle> }) {
  const { colors } = useTheme();
  const rejected = photo.statusModeracao === 'REJEITADA';
  if (!rejected && !inReview(photo)) return null;
  const Icon = rejected ? OctagonAlert : Clock3;
  return (
    <View
      style={[styles.badge, { backgroundColor: rejected ? colors.red : 'rgba(18,19,21,0.7)' }, style]}
      accessibilityLabel={rejected ? 'Foto recusada pela moderação' : 'Foto em análise: ainda não aparece no anúncio'}>
      <Icon size={12} color="#fff" />
      <AppText variant="label" style={styles.badgeText}>
        {rejected ? 'Recusada' : 'Em análise'}
      </AppText>
    </View>
  );
}

/** Abaixo da grade: quantas fotos estão em análise e o motivo de cada recusa, numerada como na grade. */
export function PhotoModerationNote({ photos, where }: { photos: AdPhoto[]; where: 'anúncio' | 'lote' }) {
  const { colors } = useTheme();
  const reviewing = photos.filter(inReview).length;
  const rejected = photos
    .map((photo, index) => ({ photo, number: index + 1 }))
    .filter(({ photo }) => photo.statusModeracao === 'REJEITADA');
  if (!reviewing && !rejected.length) return null;
  return (
    <View style={styles.note} accessibilityLiveRegion="polite">
      {reviewing ? (
        <AppText variant="caption" color="muted">
          {reviewing === 1 ? '1 foto está em análise e ainda não aparece' : `${reviewing} fotos estão em análise e ainda não aparecem`}{' '}
          {where === 'lote' ? 'nos carros' : 'no anúncio'}.
        </AppText>
      ) : null}
      {rejected.map(({ photo, number }) => (
        <View key={photo.id} style={[styles.rejected, { backgroundColor: colors.redTint, borderColor: colors.redBorder }]}>
          <OctagonAlert size={16} color={colors.red} style={styles.rejectedIcon} />
          <AppText style={styles.flex}>
            <AppText variant="bodyStrong">Foto {number} recusada. </AppText>
            {photo.motivoModeracao ?? 'Envie outra foto do veículo.'} Toque em “Trocar” para enviar outra.
          </AppText>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    alignSelf: 'flex-start',
    paddingHorizontal: space.sm,
    paddingVertical: 2,
    borderRadius: radius.pill,
  },
  badgeText: { color: '#fff', fontSize: 11 },
  note: { gap: space.sm },
  rejected: {
    flexDirection: 'row',
    gap: space.sm,
    padding: space.md,
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth,
  },
  rejectedIcon: { marginTop: 2 },
  flex: { flex: 1 },
});
