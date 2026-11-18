import { Image } from 'expo-image';
import { ActivityIndicator, StyleSheet, View } from 'react-native';

import type { PixInfo } from '@/api/plans';
import { AppText } from '@/components/app-text';
import { useTheme } from '@/hooks/use-theme';
import { radius, space } from '@/theme';
import { CopyField } from './copy-field';

/** QR Code e copia e cola do Pix, com o aviso de que a tela atualiza sozinha. */
export function PixBox({ pix, waiting }: { pix: PixInfo; waiting: string }) {
  const { colors } = useTheme();
  return (
    <View style={styles.root}>
      {pix.qrCodeBase64 ? (
        <View style={styles.qrWrap}>
          <Image
            source={{ uri: `data:image/png;base64,${pix.qrCodeBase64}` }}
            style={styles.qr}
            contentFit="contain"
            accessibilityLabel="QR Code do Pix"
          />
        </View>
      ) : null}
      <AppText color="muted">Abra o app do seu banco, escolha pagar com Pix e leia o QR Code ou cole o código.</AppText>
      <CopyField label="Pix copia e cola" value={pix.copiaECola} />
      <View style={styles.waiting} accessibilityLiveRegion="polite">
        <ActivityIndicator color={colors.red} />
        <AppText variant="caption" color="muted" style={styles.flex}>
          {waiting}
        </AppText>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { gap: space.md },
  // O QR Code fica sempre em fundo branco, para o leitor do banco funcionar também no tema escuro.
  qrWrap: { alignSelf: 'center', padding: space.md, borderRadius: radius.lg, backgroundColor: '#ffffff' },
  qr: { width: 220, height: 220 },
  waiting: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  flex: { flex: 1 },
});
