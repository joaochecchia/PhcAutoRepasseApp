import * as Haptics from 'expo-haptics';
import type { LucideIcon } from 'lucide-react-native';
import { useEffect, useRef } from 'react';
import { Pressable, ScrollView, StyleSheet, View, type ScrollViewInstance } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';

import { AppText } from '@/components/app-text';
import { useTheme } from '@/hooks/use-theme';
import { fonts, motion, space } from '@/theme';

export type ShowcaseTab = { key: string; label: string; icon: LucideIcon };

type Props = { tabs: ShowcaseTab[]; selected: string; onSelect: (key: string) => void };

/**
 * Abas da vitrine (Vitrine PHC, Zero km...). O sublinhado vermelho corre até a aba escolhida:
 * é um elemento absoluto sem filhos, então animar a largura não refaz o layout de mais ninguém.
 */
export function ShowcaseTabs({ tabs, selected, onSelect }: Props) {
  const { colors } = useTheme();
  const layouts = useRef<Record<string, { x: number; width: number }>>({});
  const x = useSharedValue(0);
  const width = useSharedValue(0);
  const scrollRef = useRef<ScrollViewInstance>(null);

  function moveTo(key: string, animate: boolean) {
    const layout = layouts.current[key];
    if (!layout) return;
    const config = { duration: 240, easing: motion.easeInOut };
    x.set(animate ? withTiming(layout.x, config) : layout.x);
    width.set(animate ? withTiming(layout.width, config) : layout.width);
    scrollRef.current?.scrollTo({ x: Math.max(0, layout.x - space.xxxl), animated: animate });
  }

  useEffect(() => {
    moveTo(selected, true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selected]);

  const underline = useAnimatedStyle(() => ({ width: width.get(), transform: [{ translateX: x.get() }] }));

  return (
    <View style={[styles.wrap, { borderBottomColor: colors.border }]}>
      <ScrollView
        ref={scrollRef}
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.content}
        accessibilityRole="tablist">
        {tabs.map((tab) => {
          const active = tab.key === selected;
          const Icon = tab.icon;
          return (
            <Pressable
              key={tab.key}
              accessibilityRole="tab"
              accessibilityState={{ selected: active }}
              accessibilityLabel={tab.label}
              onLayout={(event) => {
                const { x: left, width: w } = event.nativeEvent.layout;
                layouts.current[tab.key] = { x: left, width: w };
                if (active) moveTo(tab.key, false);
              }}
              onPress={() => {
                if (active) return;
                Haptics.selectionAsync();
                onSelect(tab.key);
              }}
              style={styles.tab}>
              <Icon size={17} color={active ? colors.red : colors.muted} strokeWidth={active ? 2.3 : 1.9} />
              <AppText
                style={[styles.label, { color: active ? colors.text : colors.muted, fontFamily: active ? fonts.bold : fonts.medium }]}>
                {tab.label}
              </AppText>
            </Pressable>
          );
        })}
        <Animated.View style={[styles.underline, { backgroundColor: colors.red }, underline]} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { borderBottomWidth: StyleSheet.hairlineWidth },
  content: { paddingHorizontal: space.sm },
  tab: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: space.md, minHeight: 48 },
  label: { fontSize: 14, lineHeight: 18 },
  underline: { position: 'absolute', left: 0, bottom: 0, height: 3, borderRadius: 2 },
});
