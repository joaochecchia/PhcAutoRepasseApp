import * as Clipboard from 'expo-clipboard';
import * as Haptics from 'expo-haptics';
import { Check, Copy } from 'lucide-react-native';
import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { AppText } from '@/components/app-text';
import { Button } from '@/components/button';
import { useTheme } from '@/hooks/use-theme';
import { radius, space } from '@/theme';

/** Código para copiar (Pix copia e cola, linha digitável), com confirmação visual e háptica. */
export function CopyField({ label, value, copyValue }: { label: string; value: string; copyValue?: string }) {
  const { colors } = useTheme();
  const [copied, setCopied] = useState(false);
  useEffect(() => {
    if (!copied) return;
    const timer = setTimeout(() => setCopied(false), 2500);
    return () => clearTimeout(timer);
  }, [copied]);
  return (
    <View style={styles.root}>
      <AppText variant="label">{label}</AppText>
      <View style={[styles.code, { backgroundColor: colors.subtle, borderColor: colors.border }]}>
        <AppText variant="caption" selectable numberOfLines={3}>
          {value}
        </AppText>
      </View>
      <Button
        label={copied ? 'Copiado' : 'Copiar'}
        variant="secondary"
        icon={copied ? <Check size={16} color={colors.deal} /> : <Copy size={16} color={colors.text} />}
        onPress={async () => {
          await Clipboard.setStringAsync(copyValue ?? value);
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          setCopied(true);
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { gap: space.sm },
  code: { padding: space.md, borderRadius: radius.md, borderWidth: StyleSheet.hairlineWidth },
});
