import * as WebBrowser from 'expo-web-browser';
import { ExternalLink } from 'lucide-react-native';
import { StyleSheet, View } from 'react-native';

import type { BoletoInfo } from '@/api/plans';
import { AppText } from '@/components/app-text';
import { Button } from '@/components/button';
import { useTheme } from '@/hooks/use-theme';
import { space } from '@/theme';
import { CopyField } from './copy-field';

/** Data do boleto (AAAA-MM-DD) sem conversão de fuso, que mudaria o dia. */
export function formatDay(value: string | null) {
  if (!value) return '';
  const [year, month, day] = value.slice(0, 10).split('-');
  return `${day}/${month}/${year}`;
}

/** Vencimento, linha digitável para copiar e o PDF do boleto registrado. */
export function BoletoBox({ boleto }: { boleto: BoletoInfo }) {
  const { colors } = useTheme();
  return (
    <View style={styles.root}>
      {boleto.vencimento ? (
        <AppText>
          Vencimento <AppText variant="bodyStrong">{formatDay(boleto.vencimento)}</AppText>
        </AppText>
      ) : null}
      <CopyField
        label="Linha digitável"
        value={boleto.linhaDigitavel}
        copyValue={boleto.linhaDigitavel.replace(/\D/g, '')}
      />
      {boleto.url ? (
        <Button
          label="Abrir boleto (PDF)"
          variant="secondary"
          icon={<ExternalLink size={16} color={colors.text} />}
          onPress={() => WebBrowser.openBrowserAsync(boleto.url!)}
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { gap: space.md },
});
