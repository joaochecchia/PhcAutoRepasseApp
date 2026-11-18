import * as Haptics from 'expo-haptics';
import { ChevronRight, type LucideIcon } from 'lucide-react-native';
import type { ReactNode } from 'react';
import { Pressable, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { AppText } from '@/components/app-text';
import { useTheme } from '@/hooks/use-theme';
import type { Colors } from '@/theme';
import { radius, space, touch } from '@/theme';

/** Grupo do painel: título em sobrelinha e cartão com as linhas. */
export function AdminSection({
  title,
  note,
  children,
  style,
}: {
  title: string;
  note?: string;
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
}) {
  const { colors } = useTheme();
  return (
    <View style={[styles.section, style]}>
      <View style={styles.sectionTitle}>
        <AppText variant="overline" color="muted" accessibilityRole="header">
          {title}
        </AppText>
        {note ? (
          <AppText variant="caption" color="muted">
            {note}
          </AppText>
        ) : null}
      </View>
      <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>{children}</View>
    </View>
  );
}

/** Linha de lista larga: destaca o fundo ao tocar, sem escala. */
export function AdminRow({
  icon: Icon,
  iconColor,
  title,
  detail,
  trailing,
  onPress,
  accessibilityLabel,
  accessibilityHint,
}: {
  icon?: LucideIcon;
  iconColor?: keyof Colors;
  title: string;
  detail?: string | null;
  trailing?: ReactNode;
  onPress?: () => void;
  accessibilityLabel?: string;
  accessibilityHint?: string;
}) {
  const { colors } = useTheme();
  return (
    <Pressable
      onPress={onPress}
      disabled={!onPress}
      accessibilityRole={onPress ? 'button' : undefined}
      accessibilityLabel={accessibilityLabel ?? (detail ? `${title}, ${detail}` : title)}
      accessibilityHint={accessibilityHint}
      style={({ pressed }) => [styles.row, pressed && { backgroundColor: colors.subtle }]}>
      {Icon ? <Icon size={20} color={colors[iconColor ?? 'text']} style={styles.icon} /> : null}
      <View style={styles.flex}>
        <AppText variant="bodyStrong">{title}</AppText>
        {detail ? (
          <AppText variant="caption" color="muted">
            {detail}
          </AppText>
        ) : null}
      </View>
      {trailing}
      {onPress ? <ChevronRight size={18} color={colors.muted} /> : null}
    </Pressable>
  );
}

export function Divider({ inset = true }: { inset?: boolean }) {
  const { colors } = useTheme();
  return <View style={[styles.divider, inset && styles.inset, { backgroundColor: colors.border }]} />;
}

/** Etiqueta curta de situação (no ar, bloqueada, vigente...). */
export function Tag({ label, tone = 'neutral' }: { label: string; tone?: 'neutral' | 'good' | 'bad' | 'warn' }) {
  const { colors } = useTheme();
  const palette = {
    neutral: { bg: colors.subtle, text: 'muted' as const, border: colors.border },
    good: { bg: colors.dealTint, text: 'deal' as const, border: colors.dealBorder },
    bad: { bg: colors.redTint, text: 'red' as const, border: colors.redBorder },
    warn: { bg: colors.subtle, text: 'text' as const, border: colors.border },
  }[tone];
  return (
    <View style={[styles.tag, { backgroundColor: palette.bg, borderColor: palette.border }]}>
      <AppText variant="label" color={palette.text} style={styles.tagText}>
        {label}
      </AppText>
    </View>
  );
}

/** Escolha única em pílulas, para filtros e opções curtas. */
export function Segmented<T extends string>({
  options,
  value,
  onChange,
  label,
  disabled,
}: {
  options: { value: T; label: string }[];
  value: T;
  onChange: (value: T) => void;
  label: string;
  disabled?: boolean;
}) {
  const { colors } = useTheme();
  return (
    <View style={[styles.segmented, { backgroundColor: colors.subtle }]} accessibilityRole="radiogroup" accessibilityLabel={label}>
      {options.map((option) => {
        const active = option.value === value;
        return (
          <Pressable
            key={option.value}
            accessibilityRole="radio"
            accessibilityState={{ checked: active, disabled }}
            disabled={disabled}
            onPress={() => {
              if (active) return;
              Haptics.selectionAsync();
              onChange(option.value);
            }}
            style={[
              styles.segment,
              active && { backgroundColor: colors.surface, borderColor: colors.border, borderWidth: StyleSheet.hairlineWidth },
            ]}>
            <AppText variant="label" color={active ? 'text' : 'muted'} numberOfLines={1}>
              {option.label}
            </AppText>
          </Pressable>
        );
      })}
    </View>
  );
}

export const adminStyles = StyleSheet.create({
  content: { padding: space.lg, gap: space.lg },
  flex: { flex: 1 },
  card: { borderRadius: radius.lg, borderWidth: StyleSheet.hairlineWidth, padding: space.lg, gap: space.sm },
});

const styles = StyleSheet.create({
  section: { gap: space.sm },
  sectionTitle: { paddingHorizontal: space.xs, gap: 2 },
  card: { borderRadius: radius.lg, borderWidth: StyleSheet.hairlineWidth, overflow: 'hidden' },
  row: { flexDirection: 'row', alignItems: 'center', gap: space.md, paddingHorizontal: space.lg, minHeight: 52, paddingVertical: space.md },
  icon: { alignSelf: 'flex-start', marginTop: 1 },
  flex: { flex: 1, gap: 2 },
  divider: { height: StyleSheet.hairlineWidth },
  inset: { marginLeft: space.lg },
  tag: { alignSelf: 'flex-start', paddingHorizontal: space.sm, paddingVertical: 2, borderRadius: radius.pill, borderWidth: StyleSheet.hairlineWidth },
  tagText: { fontSize: 11 },
  segmented: { flexDirection: 'row', padding: 3, borderRadius: radius.md },
  segment: { flex: 1, minHeight: touch - 4, alignItems: 'center', justifyContent: 'center', borderRadius: radius.sm + 1, paddingHorizontal: space.xs },
});
