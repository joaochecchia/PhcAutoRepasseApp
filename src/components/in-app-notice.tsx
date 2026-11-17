import { GlassView, isLiquidGlassAvailable } from 'expo-glass-effect';
import { Image } from 'expo-image';
import { useCallback, useEffect, useState } from 'react';
import { AccessibilityInfo, Platform, Pressable, StyleSheet, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, { useAnimatedStyle, useReducedMotion, useSharedValue, withSpring, withTiming } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { scheduleOnRN } from 'react-native-worklets';

import { AppText } from '@/components/app-text';
import { useTheme } from '@/hooks/use-theme';
import { motion, radius, space } from '@/theme';

const logo = require('../../assets/images/phc-auto-logo-disc.png');

export type InAppNotice = {
  /** Muda a cada aviso: um aviso novo com o anterior na tela troca o conteúdo e reinicia o tempo. */
  id: string;
  title: string;
  body?: string;
  kind?: string;
  onPress?: () => void;
};

/** Tempo na tela. Com leitor de tela, mais longo: 3 s não dão para ouvir título e mensagem. */
const VISIBLE_MS = 3000;
const VISIBLE_SCREEN_READER_MS = 8000;
/** Fora da tela: acima da área segura, com folga para a sombra. */
const HIDDEN_Y = -160;
const glass = Platform.OS === 'ios' && isLiquidGlassAvailable();

let present: ((notice: InAppNotice) => void) | null = null;
/** O host é único, então o temporizador fica no módulo (um ref lido pelo gesto quebra a regra do React Compiler). */
let hideTimer: ReturnType<typeof setTimeout> | null = null;
/** Cada início ou cancelamento invalida o anterior (a consulta ao leitor de tela é assíncrona). */
let timerRound = 0;

/** Mostra o aviso no topo do app, no lugar da notificação do sistema quando o app está aberto. */
export function showInAppNotice(notice: InAppNotice) {
  present?.(notice);
}

/**
 * Aviso no estilo das notificações do sistema: cai do topo, fica 3 s e sobe. Tocar abre; arrastar para cima
 * dispensa; com o dedo em cima, não some. No iOS 26+ usa o vidro do sistema (camada flutuante sobre o conteúdo).
 */
export function InAppNoticeHost() {
  const { colors, scheme } = useTheme();
  const insets = useSafeAreaInsets();
  const reduced = useReducedMotion();
  const [notice, setNotice] = useState<InAppNotice | null>(null);
  const y = useSharedValue(HIDDEN_Y);
  const scale = useSharedValue(0.96);
  const opacity = useSharedValue(0);

  const clearTimer = useCallback(() => {
    timerRound += 1;
    if (hideTimer) clearTimeout(hideTimer);
    hideTimer = null;
  }, []);

  const unmount = useCallback(() => setNotice(null), []);

  const hide = useCallback(() => {
    clearTimer();
    const done = (finished?: boolean) => {
      'worklet';
      if (finished) scheduleOnRN(unmount);
    };
    // Sai do jeito que entrou: sobe, encolhe um pouco e esmaece. Ease-out, sem esperar no começo.
    opacity.set(withTiming(0, { duration: 240, easing: motion.easeOut }, reduced ? done : undefined));
    if (reduced) return;
    scale.set(withTiming(0.96, { duration: 240, easing: motion.easeOut }));
    y.set(withTiming(HIDDEN_Y, { duration: 260, easing: motion.easeOut }, done));
  }, [clearTimer, opacity, reduced, scale, unmount, y]);

  const startTimer = useCallback(() => {
    clearTimer();
    const round = timerRound;
    AccessibilityInfo.isScreenReaderEnabled()
      .catch(() => false)
      .then((reader) => {
        if (round === timerRound) hideTimer = setTimeout(hide, reader ? VISIBLE_SCREEN_READER_MS : VISIBLE_MS);
      });
  }, [clearTimer, hide]);

  useEffect(() => {
    present = (next) => {
      setNotice(next);
      opacity.set(withTiming(1, { duration: motion.small, easing: motion.easeOut }));
      if (reduced) {
        y.set(0);
        scale.set(1);
      } else {
        // Sem quique: ninguém jogou o aviso, ele só chega.
        y.set(withSpring(0, { duration: 350, dampingRatio: 1 }));
        scale.set(withSpring(1, { duration: 350, dampingRatio: 1 }));
      }
      startTimer();
      AccessibilityInfo.announceForAccessibility(next.body ? `${next.title}. ${next.body}` : next.title);
    };
    return () => {
      present = null;
      clearTimer();
    };
  }, [clearTimer, opacity, reduced, scale, startTimer, y]);

  // Arrastar para cima dispensa (distância ou velocidade); para baixo só cede um pouco e volta com mola. Enquanto
  // arrasta, o tempo para; um toque simples fica com o Pressable.
  const pan = Gesture.Pan()
    .activeOffsetY([-6, 6])
    .onStart(() => {
      scheduleOnRN(clearTimer);
    })
    .onUpdate((event) => {
      y.set(event.translationY < 0 ? event.translationY : event.translationY * 0.12);
    })
    .onEnd((event) => {
      if (event.translationY < -24 || event.velocityY < -400) {
        y.set(withSpring(HIDDEN_Y, { duration: 300, dampingRatio: 1, velocity: event.velocityY, overshootClamping: true }));
        opacity.set(
          withTiming(0, { duration: 200, easing: motion.easeOut }, (finished) => {
            if (finished) scheduleOnRN(unmount);
          }),
        );
      } else {
        y.set(withSpring(0, { duration: 400, dampingRatio: 0.8, velocity: event.velocityY }));
        scheduleOnRN(startTimer);
      }
    });

  const animated = useAnimatedStyle(() => ({
    opacity: opacity.get(),
    transform: [{ translateY: y.get() }, { scale: scale.get() }],
  }));

  if (!notice) return null;

  const content = (
    <Pressable
      style={({ pressed }) => [styles.content, pressed && styles.pressed]}
      onPress={() => {
        hide();
        notice.onPress?.();
      }}
      onAccessibilityEscape={hide}
      accessibilityRole="button"
      accessibilityLabel={notice.body ? `${notice.title}. ${notice.body}` : notice.title}
      accessibilityHint={notice.kind === 'CHAT' ? 'Abre a conversa' : 'Abre o aviso'}>
      <Image source={logo} style={styles.logo} contentFit="contain" accessibilityIgnoresInvertColors />
      <View style={styles.text}>
        <View style={styles.header}>
          <AppText variant="label" color="muted" numberOfLines={1} style={styles.app}>
            PHC Auto
          </AppText>
          <AppText variant="caption" color="muted">
            agora
          </AppText>
        </View>
        <AppText variant="bodyStrong" numberOfLines={1}>
          {notice.title}
        </AppText>
        {notice.body ? (
          <AppText variant="body" numberOfLines={2} style={styles.body}>
            {notice.body}
          </AppText>
        ) : null}
      </View>
    </Pressable>
  );

  return (
    <View pointerEvents="box-none" style={[styles.layer, { top: insets.top + space.xs }]}>
      <GestureDetector gesture={pan}>
        <Animated.View style={[styles.shadow, animated]} accessibilityLiveRegion="polite">
          {glass ? (
            <GlassView glassEffectStyle="regular" isInteractive colorScheme={scheme} style={styles.card}>
              {content}
            </GlassView>
          ) : (
            <View style={[styles.card, styles.solid, { backgroundColor: colors.elevated, borderColor: colors.border }]}>
              {content}
            </View>
          )}
        </Animated.View>
      </GestureDetector>
    </View>
  );
}

const CARD_RADIUS = 24;

const styles = StyleSheet.create({
  layer: { position: 'absolute', left: space.sm, right: space.sm, alignItems: 'center' },
  shadow: {
    width: '100%',
    maxWidth: 520,
    borderRadius: CARD_RADIUS,
    ...Platform.select({
      ios: { shadowColor: '#000', shadowOpacity: 0.14, shadowRadius: 20, shadowOffset: { width: 0, height: 8 } },
      default: { elevation: 10 },
    }),
  },
  card: { borderRadius: CARD_RADIUS, borderCurve: 'continuous', overflow: 'hidden' },
  solid: { borderWidth: StyleSheet.hairlineWidth },
  content: { flexDirection: 'row', alignItems: 'center', gap: space.md, paddingVertical: space.md, paddingHorizontal: space.lg },
  pressed: { opacity: 0.7 },
  logo: { width: 40, height: 40, borderRadius: radius.pill },
  text: { flex: 1, gap: 1 },
  header: { flexDirection: 'row', alignItems: 'baseline', gap: space.sm },
  app: { flex: 1, textTransform: 'uppercase', letterSpacing: 0.4 },
  body: { lineHeight: 20 },
});
