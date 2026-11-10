import * as Haptics from 'expo-haptics';
import { router } from 'expo-router';
import type { BottomTabBarProps } from 'expo-router/js-tabs';
import { Heart, House, Menu, Plus, Search, type LucideIcon } from 'lucide-react-native';
import { Fragment } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { AppText } from '@/components/app-text';
import { PressableScale } from '@/components/pressable-scale';
import { useFavorites } from '@/hooks/use-favorites';
import { useTheme } from '@/hooks/use-theme';
import { fonts, space } from '@/theme';

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
  const { items } = useFavorites();

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
        const color = focused ? colors.red : colors.muted;
        const options = descriptors[route.key]?.options;
        const badge = route.name === 'favoritos' && items.length > 0 ? items.length : null;

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
              <View>
                <Icon size={24} color={color} strokeWidth={focused ? 2.4 : 1.9} fill={focused && route.name !== 'buscar' && route.name !== 'menu' ? color : 'transparent'} />
                {badge ? (
                  <View style={[styles.badge, { backgroundColor: colors.red, borderColor: colors.surface }]}>
                    <AppText style={styles.badgeText}>{badge > 9 ? '9+' : badge}</AppText>
                  </View>
                ) : null}
              </View>
              <AppText style={[styles.label, { color, fontFamily: focused ? fonts.bold : fonts.medium }]} numberOfLines={1}>
                {config.label}
              </AppText>
            </Pressable>
            {index === CENTER_AFTER ? <AnnounceButton /> : null}
          </Fragment>
        );
      })}
    </View>
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
