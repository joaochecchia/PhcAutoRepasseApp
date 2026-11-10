import { Pressable, type PressableProps, type StyleProp, type ViewStyle } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';

import { motion } from '@/theme';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

type Props = Omit<PressableProps, 'style'> & {
  style?: StyleProp<ViewStyle>;
  /** Quanto encolhe ao tocar. Linhas largas de lista usam 1 (sem escala). */
  scaleTo?: number;
};

/**
 * Resposta no toque (não na soltura): escala curta na thread de UI, como pede a skill expo-animation.
 * O estilo vai no próprio elemento tocável, então flex e largura funcionam como num Pressable comum.
 */
export function PressableScale({ style, scaleTo = 0.97, onPressIn, onPressOut, ...rest }: Props) {
  const scale = useSharedValue(1);
  const animated = useAnimatedStyle(() => ({ transform: [{ scale: scale.get() }] }));
  return (
    <AnimatedPressable
      {...rest}
      pressRetentionOffset={{ top: 12, bottom: 12, left: 12, right: 12 }}
      onPressIn={(event) => {
        scale.set(withTiming(scaleTo, { duration: motion.press, easing: motion.easeOut }));
        onPressIn?.(event);
      }}
      onPressOut={(event) => {
        scale.set(withTiming(1, { duration: motion.small, easing: motion.easeOut }));
        onPressOut?.(event);
      }}
      style={[style, animated]}
    />
  );
}
