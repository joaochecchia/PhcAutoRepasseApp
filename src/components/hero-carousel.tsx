import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { ArrowRight } from 'lucide-react-native';
import { useEffect, useRef } from 'react';
import { StyleSheet, useWindowDimensions, View, type FlatList } from 'react-native';
import Animated, {
  interpolate,
  useAnimatedRef,
  useAnimatedScrollHandler,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  type SharedValue,
} from 'react-native-reanimated';

import { AppText } from '@/components/app-text';
import { PressableScale } from '@/components/pressable-scale';
import type { Banner } from '@/data/banners';
import { openSiteLink } from '@/utils/site-link';
import { radius, space } from '@/theme';

const GAP = space.md;

/**
 * Carrossel de banners com foto. Com um item só, não mostra indicador nem gira.
 * Cada banner fica o tempo definido no painel; para enquanto a pessoa arrasta e com "reduzir movimento".
 */
export function HeroCarousel({ items }: { items: Banner[] }) {
  const { width: screen } = useWindowDimensions();
  const width = screen - space.lg * 2;
  const height = Math.round(width * 0.56);
  const snap = width + GAP;
  const scrollX = useSharedValue(0);
  const listRef = useAnimatedRef<FlatList<Banner>>();
  const reduced = useReducedMotion();
  const index = useRef(0);
  const dragging = useRef(false);

  const onScroll = useAnimatedScrollHandler((event) => {
    scrollX.set(event.contentOffset.x);
  });

  useEffect(() => {
    if (items.length < 2 || reduced) return;
    let elapsed = 0;
    const timer = setInterval(() => {
      if (dragging.current) {
        elapsed = 0;
        return;
      }
      elapsed += 1;
      if (elapsed < (items[index.current % items.length]?.duration ?? 5)) return;
      elapsed = 0;
      index.current = (index.current + 1) % items.length;
      listRef.current?.scrollToOffset({ offset: index.current * snap, animated: true });
    }, 1000);
    return () => clearInterval(timer);
  }, [items, reduced, snap, listRef]);

  return (
    <View>
      <Animated.FlatList
        ref={listRef}
        data={items}
        keyExtractor={(item) => item.id}
        horizontal
        showsHorizontalScrollIndicator={false}
        snapToInterval={snap}
        decelerationRate="fast"
        disableIntervalMomentum
        contentContainerStyle={styles.content}
        onScroll={onScroll}
        scrollEventThrottle={16}
        onScrollBeginDrag={() => {
          dragging.current = true;
        }}
        onMomentumScrollEnd={(event) => {
          dragging.current = false;
          index.current = Math.round(event.nativeEvent.contentOffset.x / snap);
        }}
        renderItem={({ item }) => (
          <PressableScale
            scaleTo={item.link ? 0.985 : 1}
            disabled={!item.link}
            onPress={() => item.link && openSiteLink(item.link)}
            accessibilityRole={item.link ? 'button' : 'image'}
            accessibilityLabel={item.accessibilityLabel}
            style={[styles.slide, { width, height }]}>
            {item.fit === 'contain' ? (
              <>
                {/* Imagem inteira: o fundo é a própria foto desfocada, como no site. */}
                <Image source={item.image} style={StyleSheet.absoluteFill} contentFit="cover" blurRadius={24} />
                <Image source={item.image} style={StyleSheet.absoluteFill} contentFit="contain" accessibilityIgnoresInvertColors />
              </>
            ) : (
              <Image
                source={item.image}
                style={StyleSheet.absoluteFill}
                contentFit="cover"
                contentPosition={item.focus}
                transition={200}
                accessibilityIgnoresInvertColors
              />
            )}
            {item.showText ? (
              <>
                {/* Escurece o canto do texto (embaixo à esquerda) para o título ter contraste sobre qualquer foto. */}
                <LinearGradient
                  colors={['rgba(18,19,21,0.92)', 'rgba(18,19,21,0.55)', 'rgba(18,19,21,0)']}
                  locations={[0, 0.5, 1]}
                  start={{ x: 0, y: 1 }}
                  end={{ x: 0.85, y: 0.1 }}
                  style={styles.shade}
                />
                <View style={styles.copy}>
                  {item.eyebrow ? (
                    <AppText variant="overline" style={styles.eyebrow}>
                      {item.eyebrow}
                    </AppText>
                  ) : null}
                  {item.title ? (
                    <AppText variant="title" style={styles.title} numberOfLines={2}>
                      {item.title}
                    </AppText>
                  ) : null}
                  {item.subtitle ? (
                    <AppText variant="caption" style={styles.title} numberOfLines={2}>
                      {item.subtitle}
                    </AppText>
                  ) : null}
                  {item.cta && item.link ? (
                    <View style={styles.cta}>
                      <AppText variant="label" style={styles.ctaText}>
                        {item.cta}
                      </AppText>
                      <ArrowRight size={16} color="#fff" />
                    </View>
                  ) : null}
                </View>
              </>
            ) : null}
          </PressableScale>
        )}
      />
      {items.length > 1 ? (
        <View style={styles.dots} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
          {items.map((item, i) => (
            <Dot key={item.id} index={i} snap={snap} scrollX={scrollX} />
          ))}
        </View>
      ) : null}
    </View>
  );
}

function Dot({ index, snap, scrollX }: { index: number; snap: number; scrollX: SharedValue<number> }) {
  const style = useAnimatedStyle(() => {
    const position = scrollX.get() / snap;
    const t = interpolate(Math.abs(position - index), [0, 1], [1, 0], 'clamp');
    return { opacity: 0.35 + t * 0.65, transform: [{ scaleX: 0.4 + t * 0.6 }] };
  });
  return <Animated.View style={[styles.dot, style]} />;
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: space.lg, gap: GAP },
  slide: { borderRadius: radius.xl, overflow: 'hidden', backgroundColor: '#121315' },
  shade: { ...StyleSheet.absoluteFill },
  copy: { flex: 1, justifyContent: 'flex-end', padding: space.xl, gap: space.xs, maxWidth: '78%' },
  eyebrow: { color: '#ff8a90' },
  title: { color: '#fff' },
  cta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.xs,
    alignSelf: 'flex-start',
    marginTop: space.sm,
    backgroundColor: '#cd1923',
    paddingHorizontal: space.md + 2,
    paddingVertical: space.sm,
    borderRadius: radius.pill,
  },
  ctaText: { color: '#fff' },
  dots: { flexDirection: 'row', justifyContent: 'center', gap: 4, marginTop: space.md },
  dot: { width: 18, height: 5, borderRadius: 3, backgroundColor: '#cd1923' },
});
