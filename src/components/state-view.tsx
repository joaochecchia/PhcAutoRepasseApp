import type { LucideIcon } from 'lucide-react-native';
import { StyleSheet, View } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';

import { AppText } from '@/components/app-text';
import { Button } from '@/components/button';
import { useTheme } from '@/hooks/use-theme';
import { space } from '@/theme';

type Props = {
  icon: LucideIcon;
  title: string;
  message?: string;
  actionLabel?: string;
  onAction?: () => void;
  compact?: boolean;
};

/** Estado vazio ou de erro: diz o que houve e oferece a próxima ação. */
export function StateView({ icon: Icon, title, message, actionLabel, onAction, compact }: Props) {
  const { colors } = useTheme();
  return (
    <Animated.View entering={FadeIn.duration(220)} style={[styles.root, compact && styles.compact]}>
      <View style={[styles.badge, { backgroundColor: colors.subtle }]}>
        <Icon size={26} color={colors.muted} strokeWidth={1.8} />
      </View>
      <AppText variant="heading" style={styles.center}>
        {title}
      </AppText>
      {message ? (
        <AppText color="muted" style={styles.center}>
          {message}
        </AppText>
      ) : null}
      {actionLabel && onAction ? (
        <Button label={actionLabel} onPress={onAction} variant="secondary" style={styles.action} />
      ) : null}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  root: { alignItems: 'center', paddingHorizontal: space.xxxl, paddingVertical: 56, gap: space.sm },
  compact: { paddingVertical: space.xxl },
  badge: { width: 56, height: 56, borderRadius: 28, alignItems: 'center', justifyContent: 'center', marginBottom: space.xs },
  center: { textAlign: 'center' },
  action: { marginTop: space.md, alignSelf: 'center' },
});
