import { CircleAlert, CircleCheck, Info, type LucideIcon } from 'lucide-react-native';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { AppText } from '@/components/app-text';
import { Button } from '@/components/button';
import { useTheme } from '@/hooks/use-theme';
import type { Colors } from '@/theme';
import { radius, space } from '@/theme';

type Tone = 'info' | 'error' | 'success';

type Props = {
  tone?: Tone;
  title?: string;
  message: string;
  actionLabel?: string;
  onAction?: () => void;
  actionLoading?: boolean;
  style?: StyleProp<ViewStyle>;
};

const tones: Record<Tone, { icon: LucideIcon; bg: keyof Colors; border: keyof Colors; accent: keyof Colors }> = {
  info: { icon: Info, bg: 'subtle', border: 'border', accent: 'muted' },
  error: { icon: CircleAlert, bg: 'redTint', border: 'redBorder', accent: 'red' },
  success: { icon: CircleCheck, bg: 'dealTint', border: 'dealBorder', accent: 'deal' },
};

/** Caixa de aviso dentro da tela: informação, erro (com "tentar de novo") ou confirmação. Segue o tema do app. */
export function Notice({ tone = 'info', title, message, actionLabel, onAction, actionLoading, style }: Props) {
  const { colors } = useTheme();
  const { icon: Icon, bg, border, accent } = tones[tone];
  return (
    <View
      accessibilityRole={tone === 'error' ? 'alert' : undefined}
      accessibilityLiveRegion={tone === 'error' ? 'polite' : 'none'}
      style={[styles.root, { backgroundColor: colors[bg], borderColor: colors[border] }, style]}>
      <View style={styles.row}>
        <Icon size={20} color={colors[accent]} strokeWidth={2} style={styles.icon} />
        <View style={styles.text}>
          {title ? (
            <AppText variant="bodyStrong" color={tone === 'info' ? 'text' : accent}>
              {title}
            </AppText>
          ) : null}
          <AppText color={title ? 'muted' : 'text'}>{message}</AppText>
        </View>
      </View>
      {actionLabel && onAction ? (
        <Button label={actionLabel} variant="secondary" loading={actionLoading} onPress={onAction}
          style={[styles.action, { backgroundColor: colors.surface }]}
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { borderWidth: 1, borderRadius: radius.md, padding: space.md, gap: space.md },
  row: { flexDirection: 'row', gap: space.md },
  icon: { marginTop: 1 },
  text: { flex: 1, gap: space.xs },
  action: { alignSelf: 'flex-start', minHeight: 44 },
});
