import { Image } from 'expo-image';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
  Easing,
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

/** Mesmo tamanho da splash nativa (app.json › expo-splash-screen › imageWidth) para a passagem não pular. */
const LOGO = 160;

/**
 * Abertura animada. A splash nativa mostra a logo parada; esta camada assume no mesmo lugar e:
 * 1. a logo "assenta" com uma mola curta e o aro vermelho emite uma onda;
 * 2. o nome aparece embaixo;
 * 3. tudo dissolve enquanto a tela inicial sobe (useIntroProgress).
 * Cerca de 1,1 s. Com "reduzir movimento", só esmaece.
 */
export function SplashOverlay({ ready }: { ready: boolean }) {
  const reduced = useReducedMotion();
  const intro = useIntroProgress();
  const [visible, setVisible] = useState(true);
  const [laidOut, setLaidOut] = useState(false);

  const logoScale = useSharedValue(1);
  const ring = useSharedValue(0);
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
        withDelay(80, withTiming(1.6, { duration: 360, easing: motion.easeOut })),
      ),
    );
    ring.set(withDelay(200, withTiming(1, { duration: 700, easing: Easing.out(Easing.quad) })));
    word.set(withDelay(260, withTiming(1, { duration: 320, easing: motion.easeOut })));
    intro.set(withDelay(760, withTiming(1, { duration: 520, easing: motion.easeOut })));
    exit.set(withDelay(780, withTiming(1, { duration: 360, easing: motion.easeOut }, finish)));
  }, [ready, laidOut, reduced, intro, exit, logoScale, ring, word]);

  const backdrop = useAnimatedStyle(() => ({ opacity: 1 - exit.get() }));
  const logo = useAnimatedStyle(() => ({
    transform: [{ scale: logoScale.get() }],
    opacity: interpolate(exit.get(), [0, 0.7], [1, 0], 'clamp'),
  }));
  const ripple = useAnimatedStyle(() => ({
    opacity: interpolate(ring.get(), [0, 0.15, 1], [0, 0.9, 0]),
    transform: [{ scale: interpolate(ring.get(), [0, 1], [1, 1.9]) }],
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
        <Animated.View style={[styles.ring, ripple]} />
        <Animated.View style={logo}>
          <Image
            source={require('@/assets/images/phc-auto-logo-disc.png')}
            style={styles.logo}
            contentFit="contain"
          />
        </Animated.View>
      </View>
      <Animated.View style={[styles.word, wordmark]}>
        <AppText style={styles.wordTitle}>PHC Auto</AppText>
        <AppText style={styles.wordSub}>Repasse de veículos</AppText>
      </Animated.View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  root: { backgroundColor: brandCharcoal, alignItems: 'center', justifyContent: 'center', zIndex: 1000 },
  center: { width: LOGO, height: LOGO, alignItems: 'center', justifyContent: 'center' },
  logo: { width: LOGO, height: LOGO },
  ring: {
    position: 'absolute',
    width: LOGO,
    height: LOGO,
    borderRadius: LOGO / 2,
    borderWidth: 3,
    borderColor: '#ed424b',
  },
  word: { position: 'absolute', bottom: '22%', alignItems: 'center', gap: 2 },
  wordTitle: { color: '#f1f1f2', fontFamily: fonts.heading, fontSize: 22, letterSpacing: -0.4 },
  wordSub: { color: '#a4a5ac', fontFamily: fonts.medium, fontSize: 13, letterSpacing: 0.4 },
});
