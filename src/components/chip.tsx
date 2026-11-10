import type { ReactNode } from 'react';
import { StyleSheet } from 'react-native';

import { AppText } from '@/components/app-text';
import { PressableScale } from '@/components/pressable-scale';
import { useTheme } from '@/hooks/use-theme';
import { radius, space } from '@/theme';

type Props = {
  label: string;
  selected?: boolean;
  onPress: () => void;
  icon?: ReactNode;
  trailing?: ReactNode;
  accessibilityLabel?: string;
};

export function Chip({ label, selected, onPress, icon, trailing, accessibilityLabel }: Props) {
  const { colors } = useTheme();
  return (
    <PressableScale
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityState={{ selected }}
      onPress={onPress}
      hitSlop={{ top: 4, bottom: 4 }}
      style={[
        styles.chip,
        {
          backgroundColor: selected ? colors.redTint : colors.surface,
          borderColor: selected ? colors.red : colors.border,
        },
      ]}>
      {icon}
      <AppText variant="label" color={selected ? 'red' : 'text'}>
        {label}
      </AppText>
      {trailing}
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  chip: {
    minHeight: 38,
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.xs + 2,
    paddingHorizontal: space.md + 2,
    borderRadius: radius.pill,
    borderWidth: 1,
  },
});
