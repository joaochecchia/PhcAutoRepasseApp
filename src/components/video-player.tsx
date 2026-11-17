import { useVideoPlayer, VideoView } from 'expo-video';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { mediaUrl } from '@/api/client';

/**
 * Vídeo do anúncio ou do lote com o player nativo (controles, tela cheia e picture-in-picture do sistema).
 * Não toca sozinho: quem abre a galeria escolhe quando assistir.
 */
export function VideoPlayer({ path, label, style }: { path: string; label: string; style?: StyleProp<ViewStyle> }) {
  const player = useVideoPlayer(mediaUrl(path), (instance) => {
    instance.loop = false;
  });
  return (
    <View style={[styles.frame, { backgroundColor: '#000' }, style]} accessibilityLabel={label}>
      <VideoView
        player={player}
        style={StyleSheet.absoluteFill}
        nativeControls
        contentFit="contain"
        allowsPictureInPicture
      />
    </View>
  );
}

const styles = StyleSheet.create({
  frame: { overflow: 'hidden' },
});
