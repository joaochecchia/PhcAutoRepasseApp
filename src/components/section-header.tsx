import { ChevronRight } from 'lucide-react-native';
import { Pressable, StyleSheet, View } from 'react-native';

import { AppText } from '@/components/app-text';
import { useTheme } from '@/hooks/use-theme';
import { space } from '@/theme';

type Props = { title: string; count?: number; actionLabel?: string; onAction?: () => void };

export function SectionHeader({ title, count, actionLabel, onAction }: Props) {
  const { colors } = useTheme();
  return (
    <View style={styles.row}>
      <View style={styles.title}>
        <AppText variant="title" accessibilityRole="header">
          {title}
        </AppText>
        {count ? (
          <View style={[styles.count, { backgroundColor: colors.dealTint }]}>
            <AppText variant="label" color="deal">
              {count}
            </AppText>
          </View>
        ) : null}
      </View>
      {actionLabel && onAction ? (
        <Pressable
          onPress={onAction}
          accessibilityRole="button"
          hitSlop={12}
          style={({ pressed }) => [styles.action, { opacity: pressed ? 0.6 : 1 }]}>
          <AppText variant="label" color="red">
            {actionLabel}
          </AppText>
          <ChevronRight size={16} color={colors.red} />
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: space.lg,
    gap: space.md,
  },
  title: { flexDirection: 'row', alignItems: 'center', gap: space.sm, flexShrink: 1 },
  count: { paddingHorizontal: space.sm, paddingVertical: 2, borderRadius: 999 },
  action: { flexDirection: 'row', alignItems: 'center', gap: 2, minHeight: 44 },
});
