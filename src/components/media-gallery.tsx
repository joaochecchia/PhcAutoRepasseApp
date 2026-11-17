import { Image } from 'expo-image';
import { CarFront, Play } from 'lucide-react-native';
import { useState } from 'react';
import { FlatList, StyleSheet, View } from 'react-native';

import { mediaUrl } from '@/api/client';
import type { AdPhoto, MediaFile } from '@/api/contracts';
import { AppText } from '@/components/app-text';
import { Skeleton } from '@/components/skeleton';
import { VideoPlayer } from '@/components/video-player';
import { useTheme } from '@/hooks/use-theme';
import { radius, space } from '@/theme';

type Slide = { kind: 'photo'; photo: AdPhoto } | { kind: 'video'; video: MediaFile };

/** Fotos e, por último, o vídeo (como no site). */
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
  const slides: Slide[] = [
    ...[...(photos ?? [])].sort((a, b) => a.posicao - b.posicao).map((photo): Slide => ({ kind: 'photo', photo })),
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
  const current = slides[index];
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
            <Image
              source={{ uri: mediaUrl(item.photo.url)! }}
              style={{ width, height, backgroundColor: colors.subtle }}
              contentFit="cover"
              transition={200}
              accessibilityLabel={item.photo.textoAlternativo ?? `Foto ${i + 1} de ${photos?.length ?? 0}`}
            />
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
              : `${index + 1}/${photos?.length ?? 0}${video ? ' · vídeo' : ''}`}
          </AppText>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  noPhoto: { alignItems: 'center', justifyContent: 'center', gap: space.sm },
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
