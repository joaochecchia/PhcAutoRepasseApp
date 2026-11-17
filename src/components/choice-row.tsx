import { Pressable, StyleSheet, View } from 'react-native';

import { AppText } from '@/components/app-text';
import { useTheme } from '@/hooks/use-theme';
import { radius, space, touch } from '@/theme';

export type ChoiceOption = { value: string; label: string };

/** Opções em pílulas (uma escolha): Sim/Não, tipo de pessoa, condição, alcance. */
export function ChoiceRow({
  value,
  options,
  onChange,
  disabled,
}: {
  value: string | undefined;
  options: ChoiceOption[];
  onChange: (value: string) => void;
  disabled?: boolean;
}) {
  const { colors } = useTheme();
  return (
    <View style={styles.choices} accessibilityRole="radiogroup">
      {options.map((item) => {
        const selected = value === item.value;
        return (
          <Pressable
            key={item.value}
            accessibilityRole="radio"
            accessibilityState={{ selected, disabled }}
            accessibilityLabel={item.label}
            disabled={disabled}
            onPress={() => onChange(item.value)}
            style={[
              styles.chip,
              {
                borderColor: selected ? colors.red : colors.border,
                backgroundColor: selected ? colors.redTint : colors.surface,
                opacity: disabled ? 0.5 : 1,
              },
            ]}>
            <AppText variant="label" color={selected ? 'red' : 'text'}>
              {item.label}
            </AppText>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  choices: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  chip: { minHeight: touch, borderWidth: 1, paddingHorizontal: space.md, justifyContent: 'center', borderRadius: radius.pill },
});
