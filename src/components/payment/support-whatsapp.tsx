import { useQuery } from '@tanstack/react-query';
import { MessageCircle } from 'lucide-react-native';
import { Linking, Pressable, StyleSheet } from 'react-native';

import { salesApi } from '@/api/sales';
import { AppText } from '@/components/app-text';
import { useTheme } from '@/hooks/use-theme';
import { space, touch } from '@/theme';

/** Dúvidas de pagamento no WhatsApp da PHC Auto; some se o número não estiver cadastrado. */
export function SupportWhatsApp({ message, label = 'Dúvidas? Fale com a PHC Auto no WhatsApp' }: { message: string; label?: string }) {
  const { colors } = useTheme();
  const support = useQuery({
    queryKey: ['support-whatsapp'],
    queryFn: ({ signal }) => salesApi.supportWhatsapp(signal),
    staleTime: 60 * 60_000,
  });
  if (!support.data) return null;
  return (
    <Pressable
      accessibilityRole="link"
      accessibilityLabel={label}
      onPress={() => Linking.openURL(`https://wa.me/${support.data}?text=${encodeURIComponent(message)}`).catch(() => undefined)}
      style={styles.root}>
      <MessageCircle size={16} color={colors.deal} />
      <AppText variant="label" color="deal">
        {label}
      </AppText>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  root: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: space.xs, minHeight: touch },
});
