import { Eye, EyeOff } from 'lucide-react-native';
import { useState, type Ref } from 'react';
import { Pressable, StyleSheet, TextInput, View, type TextInputInstance, type TextInputProps } from 'react-native';

import { AppText } from '@/components/app-text';
import { useTheme } from '@/hooks/use-theme';
import { fonts, radius, space } from '@/theme';

type Props = TextInputProps & {
  label: string;
  error?: string | null;
  secure?: boolean;
  ref?: Ref<TextInputInstance>;
};

/** Campo com rótulo visível. Senha com botão de mostrar/ocultar. */
export function TextField({ label, error, secure, style, ref, ...rest }: Props) {
  const { colors } = useTheme();
  const [focused, setFocused] = useState(false);
  const [hidden, setHidden] = useState(true);
  return (
    <View style={styles.root}>
      <AppText variant="label">{label}</AppText>
      <View
        style={[
          styles.box,
          {
            backgroundColor: colors.surface,
            borderColor: error ? colors.red : focused ? colors.text : colors.border,
          },
        ]}>
        <TextInput
          ref={ref}
          {...rest}
          accessibilityLabel={label}
          secureTextEntry={secure && hidden}
          placeholderTextColor={colors.muted}
          onFocus={(event) => {
            setFocused(true);
            rest.onFocus?.(event);
          }}
          onBlur={(event) => {
            setFocused(false);
            rest.onBlur?.(event);
          }}
          style={[styles.input, { color: colors.text }, style]}
        />
        {secure ? (
          <Pressable
            onPress={() => setHidden((value) => !value)}
            hitSlop={12}
            accessibilityRole="button"
            accessibilityLabel={hidden ? 'Mostrar senha' : 'Ocultar senha'}>
            {hidden ? <Eye size={20} color={colors.muted} /> : <EyeOff size={20} color={colors.muted} />}
          </Pressable>
        ) : null}
      </View>
      {error ? (
        <AppText variant="caption" color="red" accessibilityLiveRegion="polite">
          {error}
        </AppText>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { gap: space.xs + 2 },
  box: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    minHeight: 52,
    paddingHorizontal: space.lg,
    borderRadius: radius.md,
    borderWidth: 1,
  },
  input: { flex: 1, fontFamily: fonts.body, fontSize: 16, paddingVertical: space.md },
});
