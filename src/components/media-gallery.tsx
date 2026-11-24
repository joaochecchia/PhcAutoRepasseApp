import { Image } from 'expo-image';
import { CarFront, Play } from 'lucide-react-native';
import { useState } from 'react';
import { FlatList, StyleSheet, View } from 'react-native';

import type { AdPhoto, MediaFile } from '@/api/contracts';
import { AppText } from '@/components/app-text';
import {
  PhotoModerationBadge,
  photoCachePolicy,
  photoImageSource,
  shownToBuyers,
} from '@/components/photo-moderation';
import { Skeleton } from '@/components/skeleton';
import { VideoPlayer } from '@/components/video-player';
import { useTheme } from '@/hooks/use-theme';
import { radius, space } from '@/theme';

type Slide = { kind: 'photo'; photo: AdPhoto } | { kind: 'video'; video: MediaFile };

/**
 * Fotos e, por último, o vídeo (como no site). O dono recebe também as fotos em análise e as recusadas: a galeria mostra
 * o que o comprador vai ver (sem as recusadas), com o selo "Em análise" nas que ainda esperam a moderação.
 */
export function MediaGallery({
  photos,
  video,
  title,
  loading,
  width,
  height,
}: {
  photos?: AdPhoto[];
  video: MediaFile | null;
  title: string;
  loading: boolean;
  width: number;
  height: number;
}) {
  const { colors } = useTheme();
  const [index, setIndex] = useState(0);
  if (loading) return <Skeleton width={width} height={height} rounded={0} />;
  const shown = (photos ?? []).filter(shownToBuyers).sort((a, b) => a.posicao - b.posicao);
  const slides: Slide[] = [
    ...shown.map((photo): Slide => ({ kind: 'photo', photo })),
    ...(video ? [{ kind: 'video', video } as Slide] : []),
  ];
  if (!slides.length) {
    return (
      <View style={[styles.noPhoto, { width, height, backgroundColor: colors.subtle }]}>
        <CarFront size={48} color={colors.muted} strokeWidth={1.4} />
        <AppText color="muted">Sem fotos</AppText>
      </View>
    );
  }
  // Uma foto recusada sai da galeria: a posição atual não pode passar do último item.
  const current = slides[Math.min(index, slides.length - 1)];
  return (
    <View>
      <FlatList
        data={slides}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        keyExtractor={(slide) => (slide.kind === 'photo' ? slide.photo.id : `video-${slide.video.id}`)}
        onMomentumScrollEnd={(event) => setIndex(Math.round(event.nativeEvent.contentOffset.x / width))}
        renderItem={({ item, index: i }) =>
          item.kind === 'photo' ? (
            <View>
              <Image
                source={photoImageSource(item.photo)}
                cachePolicy={photoCachePolicy(item.photo)}
                style={{ width, height, backgroundColor: colors.subtle }}
                contentFit="cover"
                transition={200}
                accessibilityLabel={item.photo.textoAlternativo ?? `Foto ${i + 1} de ${shown.length}`}
              />
              <PhotoModerationBadge photo={item.photo} style={styles.badge} />
            </View>
          ) : (
            <VideoPlayer path={item.video.url!} label={`Vídeo do ${title}`} style={{ width, height }} />
          )
        }
      />
      {slides.length > 1 ? (
        <View style={styles.counter} pointerEvents="none">
          {current?.kind === 'video' ? <Play size={12} color="#fff" fill="#fff" /> : null}
          <AppText variant="label" style={styles.counterText}>
            {current?.kind === 'video'
              ? `Vídeo${current.video.duracaoSegundos ? ` · ${current.video.duracaoSegundos}s` : ''}`
              : `${Math.min(index, slides.length - 1) + 1}/${shown.length}${video ? ' · vídeo' : ''}`}
          </AppText>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  noPhoto: { alignItems: 'center', justifyContent: 'center', gap: space.sm },
  badge: { position: 'absolute', left: space.lg, bottom: space.xxxl },
  counter: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    position: 'absolute',
    right: space.lg,
    bottom: space.xxxl,
    backgroundColor: 'rgba(18,19,21,0.6)',
    paddingHorizontal: space.sm + 2,
    paddingVertical: 4,
    borderRadius: radius.pill,
  },
  counterText: { color: '#fff' },
});
