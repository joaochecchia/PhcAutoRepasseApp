import type { ReactNode } from "react";
import { StyleSheet, View } from "react-native";
import Animated, {
  useAnimatedStyle,
  type SharedValue,
} from "react-native-reanimated";

import { useTheme } from "@/hooks/use-theme";

/** Resistência elástica além do limite, em páginas: cede pouco e cada vez menos. */
export function resist(overflow: number) {
  "worklet";
  return 0.35 * (1 - 1 / (overflow * 1.5 + 1));
}

/**
 * Uma etapa do anúncio como página do paginador. `position` é a etapa visível em páginas, contínua
 * durante o arraste: a página só lê a distância até ela, então trocar quais etapas estão montadas
 * não move nada na tela.
 */
export function StagePage({
  index,
  position,
  width,
  current,
  children,
}: {
  index: number;
  position: SharedValue<number>;
  width: SharedValue<number>;
  current: boolean;
  children: ReactNode;
}) {
  const style = useAnimatedStyle(() => {
    const distance = index - position.get();
    const away = Math.min(Math.abs(distance), 1);
    // A vizinha chega um pouco recuada e esmaecida, e assenta ao ocupar a tela.
    return {
      opacity: 1 - away * 0.35,
      transform: [
        { translateX: distance * width.get() },
        { scale: 1 - away * 0.04 },
      ],
    };
  });
  return (
    <Animated.View
      style={[
        StyleSheet.absoluteFill,
        { pointerEvents: current ? "auto" : "none" },
        style,
      ]}
      accessibilityElementsHidden={!current}
      importantForAccessibility={current ? "auto" : "no-hide-descendants"}
    >
      {children}
    </Animated.View>
  );
}

/** Segmento da barra de etapas: o preenchimento acompanha o arraste entre as páginas. */
export function ProgressSegment({
  index,
  position,
  pending,
}: {
  index: number;
  position: SharedValue<number>;
  pending: boolean;
}) {
  const { colors } = useTheme();
  const fill = useAnimatedStyle(() => ({
    width: `${Math.min(Math.max(position.get() - index + 1, 0), 1) * 100}%`,
  }));
  return (
    <View style={styles.slot}>
      <View style={[styles.track, { backgroundColor: colors.border }]}>
        <Animated.View
          style={[styles.fill, { backgroundColor: colors.red }, fill]}
        />
      </View>
      {pending ? (
        // Ponto sobre o segmento: a pendência é marcada pela forma, não só pela cor.
        <View
          style={[
            styles.dot,
            { backgroundColor: colors.pending, borderColor: colors.bg },
          ]}
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  slot: { flex: 1, height: 10, justifyContent: "center" },
  track: { height: 4, borderRadius: 2, overflow: "hidden" },
  fill: { position: "absolute", top: 0, bottom: 0, left: 0 },
  dot: {
    position: "absolute",
    top: 0,
    left: "50%",
    marginLeft: -5,
    width: 10,
    height: 10,
    borderRadius: 5,
    borderWidth: 2,
  },
});
