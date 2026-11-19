import * as Haptics from 'expo-haptics';
import { router } from 'expo-router';
import type { BottomTabBarProps } from 'expo-router/js-tabs';
import { Heart, House, Menu, Plus, Search, type LucideIcon } from 'lucide-react-native';
import { Fragment, useEffect } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import Animated, { interpolateColor, useAnimatedStyle, useReducedMotion, useSharedValue, withTiming } from 'react-native-reanimated';
import Svg, { Path } from 'react-native-svg';

import { AppText } from '@/components/app-text';
import { PressableScale } from '@/components/pressable-scale';
import { useFavorites } from '@/hooks/use-favorites';
import { useNoticesSummary } from '@/hooks/use-notices';
import { useTheme } from '@/hooks/use-theme';
import { fonts, motion, space } from '@/theme';

const tabs: Record<string, { label: string; icon: LucideIcon }> = {
  index: { label: 'Início', icon: House },
  buscar: { label: 'Buscar', icon: Search },
  favoritos: { label: 'Favoritos', icon: Heart },
  menu: { label: 'Menu', icon: Menu },
};

/** Botão central fica entre a 2ª e a 3ª aba. */
const CENTER_AFTER = 1;
const CENTER_SIZE = 58;

/**
 * Barra inferior própria: Início · Buscar · Anunciar · Favoritos · Menu.
 * Anunciar não é uma aba: abre o fluxo de anúncio como modal. Troca de aba não anima (skill expo-animation).
 */
export function TabBar({ state, descriptors, emitter, navigateToTab, insets }: BottomTabBarProps) {
  const { colors } = useTheme();
  const { ids } = useFavorites();
  const notices = useNoticesSummary().data?.naoLidos ?? 0;

  return (
    <View
      style={[
        styles.bar,
        { backgroundColor: colors.surface, borderTopColor: colors.border, paddingBottom: Math.max(insets.bottom, space.sm) },
      ]}
      accessibilityRole="tablist">
      {state.routes.map((route, index) => {
        const config = tabs[route.name];
        if (!config) return null;
        const focused = state.index === index;
        const Icon = config.icon;
        const options = descriptors[route.key]?.options;
        const badge =
          route.name === 'favoritos' && ids.length > 0 ? ids.length : route.name === 'menu' && notices > 0 ? notices : null;

        const onPress = () => {
          const event = emitter.emit({ type: 'tabPress', target: route.key, canPreventDefault: true });
          if (!focused && !event.defaultPrevented) {
            Haptics.selectionAsync();
            navigateToTab(route.key);
          }
        };

        return (
          <Fragment key={route.key}>
            <Pressable
              onPress={onPress}
              accessibilityRole="tab"
              accessibilityState={{ selected: focused }}
              accessibilityLabel={options?.tabBarAccessibilityLabel ?? config.label}
              style={styles.item}>
              <TabIcon name={route.name} icon={Icon} label={config.label} focused={focused} badge={badge} />
            </Pressable>
            {index === CENTER_AFTER ? <AnnounceButton /> : null}
          </Fragment>
        );
      })}
    </View>
  );
}

/**
 * Ícone e rótulo da aba. A troca de estado é um cruzamento curto (180 ms, ease-out) entre a versão
 * apagada e a ativa, que ainda cresce de 0,88 para 1. Só transform, opacidade e cor, na thread de UI.
 * Com "reduzir movimento", fica só o cruzamento, sem escala.
 */
function TabIcon({
  name,
  icon: Icon,
  label,
  focused,
  badge,
}: {
  name: string;
  icon: LucideIcon;
  label: string;
  focused: boolean;
  badge: number | null;
}) {
  const { colors } = useTheme();
  const reduced = useReducedMotion();
  const progress = useSharedValue(focused ? 1 : 0);

  useEffect(() => {
    progress.set(withTiming(focused ? 1 : 0, { duration: motion.small, easing: motion.easeOut }));
  }, [focused, progress]);

  const idleStyle = useAnimatedStyle(() => ({ opacity: 1 - progress.get() }));
  const activeStyle = useAnimatedStyle(() => ({
    opacity: progress.get(),
    transform: [{ scale: reduced ? 1 : 0.88 + 0.12 * progress.get() }],
  }));
  const labelStyle = useAnimatedStyle(() => ({
    color: interpolateColor(progress.get(), [0, 1], [colors.muted, colors.red]),
  }));

  return (
    <>
      <View style={styles.icon}>
        <Animated.View style={[StyleSheet.absoluteFill, idleStyle]}>
          <Icon size={24} color={colors.muted} strokeWidth={1.9} />
        </Animated.View>
        <Animated.View style={[StyleSheet.absoluteFill, activeStyle]}>
          {name === 'index' ? (
            <HouseFilled color={colors.red} door={colors.surface} />
          ) : (
            <Icon size={24} color={colors.red} strokeWidth={2.4} fill={name === 'favoritos' ? colors.red : 'transparent'} />
          )}
        </Animated.View>
        {badge ? (
          <View style={[styles.badge, { backgroundColor: colors.red, borderColor: colors.surface }]}>
            <AppText style={styles.badgeText}>{badge > 9 ? '9+' : badge}</AppText>
          </View>
        ) : null}
      </View>
      <Animated.Text
        allowFontScaling
        style={[styles.label, { fontFamily: focused ? fonts.bold : fonts.medium }, labelStyle]}
        numberOfLines={1}>
        {label}
      </Animated.Text>
    </>
  );
}

/**
 * House do Lucide preenchida, com a porta recortada na cor da barra.
 * Com fill direto no ícone, a porta some na mesma cor e a casa vira um bloco.
 */
function HouseFilled({ color, door }: { color: string; door: string }) {
  return (
    <Svg width={24} height={24} viewBox="0 0 24 24">
      <Path
        d="M3 10a2 2 0 0 1 .709-1.528l7-5.999a2 2 0 0 1 2.582 0l7 5.999A2 2 0 0 1 21 10v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"
        fill={color}
        stroke={color}
        strokeWidth={2.4}
        strokeLinejoin="round"
      />
      {/* Mesma porta do House (x 9–15, topo em 12), descendo além do traço da base para ficar aberta. */}
      <Path d="M9 23V13a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v10z" fill={door} />
    </Svg>
  );
}

function AnnounceButton() {
  const { colors } = useTheme();
  return (
    <View style={styles.item}>
      <PressableScale
        scaleTo={0.92}
        onPress={() => {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
          router.push('/anunciar');
        }}
        accessibilityRole="button"
        accessibilityLabel="Anunciar veículo"
        hitSlop={8}
        style={[styles.center, { backgroundColor: colors.red, borderColor: colors.surface, shadowColor: colors.red }]}>
        <Plus size={28} color={colors.onRed} strokeWidth={2.6} />
      </PressableScale>
      <AppText style={[styles.label, styles.centerLabel, { color: colors.red }]} numberOfLines={1}>
        Anunciar
      </AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingTop: space.sm,
  },
  item: { flex: 1, alignItems: 'center', justifyContent: 'flex-end', gap: 3, minHeight: 50 },
  icon: { width: 24, height: 24 },
  label: { fontSize: 11, lineHeight: 14 },
  center: {
    width: CENTER_SIZE,
    height: CENTER_SIZE,
    borderRadius: CENTER_SIZE / 2,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 4,
    marginTop: -CENTER_SIZE / 2 - 6,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.35,
    shadowRadius: 10,
    elevation: 8,
  },
  centerLabel: { fontFamily: fonts.bold },
  badge: {
    position: 'absolute',
    top: -4,
    right: -9,
    minWidth: 18,
    height: 18,
    paddingHorizontal: 4,
    borderRadius: 9,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeText: { color: '#fff', fontSize: 10, lineHeight: 12, fontFamily: fonts.bold },
});
