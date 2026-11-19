import { Image } from 'expo-image';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
  interpolate,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';

import { AppText } from '@/components/app-text';
import { useIntroProgress } from '@/hooks/use-intro';
import { brandCharcoal, fonts, motion } from '@/theme';

/** Mesma imagem e largura da splash nativa (app.json › expo-splash-screen) para a passagem não pular. */
const SPLASH = require('@/assets/images/splash-icon.png');
const LOGO_WIDTH = 220;
const LOGO_HEIGHT = Math.round((LOGO_WIDTH * 566) / 1101);

/**
 * Abertura animada. A splash nativa mostra a marca parada; esta camada assume no mesmo lugar e:
 * 1. a marca "assenta" com uma mola curta;
 * 2. a frase aparece embaixo;
 * 3. tudo dissolve enquanto a tela inicial sobe (useIntroProgress).
 * Cerca de 1,1 s. Com "reduzir movimento", só esmaece.
 */
export function SplashOverlay({ ready }: { ready: boolean }) {
  const reduced = useReducedMotion();
  const intro = useIntroProgress();
  const [visible, setVisible] = useState(true);
  const [laidOut, setLaidOut] = useState(false);

  const logoScale = useSharedValue(1);
  const word = useSharedValue(0);
  const exit = useSharedValue(0);

  useEffect(() => {
    if (!ready || !laidOut) return;
    SplashScreen.hideAsync().catch(() => undefined);

    const finish = (finished?: boolean) => {
      'worklet';
      if (finished) scheduleOnRN(setVisible, false);
    };

    if (reduced) {
      intro.set(withTiming(1, { duration: 250 }));
      exit.set(withTiming(1, { duration: 250 }, finish));
      return;
    }

    logoScale.set(
      withSequence(
        withTiming(0.92, { duration: 160, easing: motion.easeOut }),
        withSpring(1.04, { duration: 420, dampingRatio: 0.55 }),
        withDelay(80, withTiming(1.25, { duration: 360, easing: motion.easeOut })),
      ),
    );
    word.set(withDelay(260, withTiming(1, { duration: 320, easing: motion.easeOut })));
    intro.set(withDelay(760, withTiming(1, { duration: 520, easing: motion.easeOut })));
    exit.set(withDelay(780, withTiming(1, { duration: 360, easing: motion.easeOut }, finish)));
  }, [ready, laidOut, reduced, intro, exit, logoScale, word]);

  const backdrop = useAnimatedStyle(() => ({ opacity: 1 - exit.get() }));
  const logo = useAnimatedStyle(() => ({
    transform: [{ scale: logoScale.get() }],
    opacity: interpolate(exit.get(), [0, 0.7], [1, 0], 'clamp'),
  }));
  const wordmark = useAnimatedStyle(() => ({
    opacity: word.get() * (1 - exit.get()),
    transform: [{ translateY: interpolate(word.get(), [0, 1], [10, 0]) }],
  }));

  if (!visible) return null;

  return (
    <Animated.View
      pointerEvents="none"
      style={[StyleSheet.absoluteFill, styles.root, backdrop]}
      onLayout={() => setLaidOut(true)}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants">
      <View style={styles.center}>
        <Animated.View style={logo}>
          <Image source={SPLASH} style={styles.logo} contentFit="contain" />
        </Animated.View>
      </View>
      <Animated.View style={[styles.word, wordmark]}>
        <AppText style={styles.wordSub}>Repasse de veículos</AppText>
      </Animated.View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  root: { backgroundColor: brandCharcoal, alignItems: 'center', justifyContent: 'center', zIndex: 1000 },
  center: { width: LOGO_WIDTH, height: LOGO_HEIGHT, alignItems: 'center', justifyContent: 'center' },
  logo: { width: LOGO_WIDTH, height: LOGO_HEIGHT },
  word: { position: 'absolute', bottom: '22%', alignItems: 'center', gap: 2 },
  wordSub: { color: '#a4a5ac', fontFamily: fonts.medium, fontSize: 13, letterSpacing: 0.4 },
});
