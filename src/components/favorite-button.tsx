import * as Haptics from 'expo-haptics';
import { Heart } from 'lucide-react-native';
import { Pressable, StyleSheet } from 'react-native';
import Animated, {
  ReduceMotion,
  useAnimatedStyle,
  useSharedValue,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';

import type { SearchAd } from '@/api/contracts';
import { useFavorites } from '@/hooks/use-favorites';
import { useTheme } from '@/hooks/use-theme';
import { motion } from '@/theme';

type Props = { ad: SearchAd; size?: number; onImage?: boolean };

/** Coração: o pequeno momento de prazer do app. Pulso com mola ao favoritar, háptico no mesmo quadro. */
export function FavoriteButton({ ad, size = 36, onImage }: Props) {
  const { colors } = useTheme();
  const { isFavorite, toggle } = useFavorites();
  const active = isFavorite(ad.anuncioId);
  const scale = useSharedValue(1);
  const animated = useAnimatedStyle(() => ({ transform: [{ scale: scale.get() }] }));

  function onPress() {
    if (!active) {
      scale.set(
        withSequence(
          withTiming(0.8, { duration: 90, easing: motion.easeOut, reduceMotion: ReduceMotion.System }),
          withSpring(1, { ...motion.pop, reduceMotion: ReduceMotion.System }),
        ),
      );
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    } else {
      Haptics.selectionAsync();
    }
    toggle(ad);
  }

  return (
    <Pressable
      onPress={onPress}
      hitSlop={8}
      accessibilityRole="button"
      accessibilityLabel={active ? 'Remover dos favoritos' : 'Salvar nos favoritos'}
      accessibilityState={{ selected: active }}
      style={[
        styles.button,
        {
          width: size,
          height: size,
          borderRadius: size / 2,
          backgroundColor: onImage ? 'rgba(18,19,21,0.45)' : colors.subtle,
        },
      ]}>
      <Animated.View style={animated}>
        <Heart
          size={size * 0.5}
          color={active ? colors.red : onImage ? '#ffffff' : colors.text}
          fill={active ? colors.red : 'transparent'}
          strokeWidth={2}
        />
      </Animated.View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: { alignItems: 'center', justifyContent: 'center' },
});
