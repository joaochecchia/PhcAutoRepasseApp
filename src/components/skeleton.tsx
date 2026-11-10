import { useEffect } from 'react';
import type { DimensionValue, StyleProp, ViewStyle } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';

import { useTheme } from '@/hooks/use-theme';
import { motion, radius } from '@/theme';

type Props = { width?: DimensionValue; height?: DimensionValue; rounded?: number; style?: StyleProp<ViewStyle> };

/** Bloco de carregamento com o formato do conteúdo. Pulsa só a opacidade; parado com "reduzir movimento". */
export function Skeleton({ width = '100%', height, rounded = radius.sm, style }: Props) {
  const { colors } = useTheme();
  const reduced = useReducedMotion();
  const opacity = useSharedValue(1);
  useEffect(() => {
    if (reduced) return;
    opacity.set(withRepeat(withTiming(0.45, { duration: 800, easing: motion.easeInOut }), -1, true));
  }, [opacity, reduced]);
  const animated = useAnimatedStyle(() => ({ opacity: opacity.get() }));
  return (
    <Animated.View
      accessible={false}
      style={[{ width, height, borderRadius: rounded, backgroundColor: colors.skeleton }, animated, style]}
    />
  );
}
