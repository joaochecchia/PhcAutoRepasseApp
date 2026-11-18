import * as Haptics from 'expo-haptics';
import { Barcode, CreditCard, Landmark, QrCode, type LucideIcon } from 'lucide-react-native';
import { Pressable, StyleSheet, View } from 'react-native';

import type { MetodoPagamento } from '@/api/plans';
import { AppText } from '@/components/app-text';
import { useTheme } from '@/hooks/use-theme';
import { radius, space, touch } from '@/theme';

export const paymentMethods: { value: MetodoPagamento; label: string; icon: LucideIcon }[] = [
  { value: 'PIX', label: 'Pix', icon: QrCode },
  { value: 'CARTAO_CREDITO', label: 'Crédito', icon: CreditCard },
  { value: 'CARTAO_DEBITO', label: 'Débito', icon: Landmark },
  { value: 'BOLETO', label: 'Boleto', icon: Barcode },
];

/** Formas de pagamento liberadas para a conta (quem decide é o backend), em grade de duas colunas. */
export function MethodPicker({
  allowed,
  value,
  onChange,
  hint,
  disabled,
}: {
  allowed: MetodoPagamento[];
  value: MetodoPagamento;
  onChange: (metodo: MetodoPagamento) => void;
  hint: (metodo: MetodoPagamento) => string;
  disabled?: boolean;
}) {
  const { colors } = useTheme();
  return (
    <View style={styles.grid} accessibilityRole="radiogroup" accessibilityLabel="Forma de pagamento">
      {paymentMethods
        .filter((item) => allowed.includes(item.value))
        .map(({ value: metodo, label, icon: Icon }) => {
          const selected = metodo === value;
          return (
            <Pressable
              key={metodo}
              accessibilityRole="radio"
              accessibilityState={{ selected, disabled }}
              accessibilityLabel={`${label}, ${hint(metodo)}`}
              disabled={disabled}
              onPress={() => {
                Haptics.selectionAsync();
                onChange(metodo);
              }}
              style={[
                styles.option,
                {
                  borderColor: selected ? colors.red : colors.border,
                  backgroundColor: selected ? colors.redTint : colors.surface,
                  opacity: disabled ? 0.5 : 1,
                },
              ]}>
              <Icon size={20} color={selected ? colors.red : colors.text} />
              <AppText variant="bodyStrong" color={selected ? 'red' : 'text'}>
                {label}
              </AppText>
              <AppText variant="caption" color="muted">
                {hint(metodo)}
              </AppText>
            </Pressable>
          );
        })}
    </View>
  );
}

const styles = StyleSheet.create({
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  option: {
    flexBasis: '47%',
    flexGrow: 1,
    minHeight: touch + space.xl,
    padding: space.md,
    gap: 2,
    borderRadius: radius.md,
    borderWidth: 1.5,
  },
});
