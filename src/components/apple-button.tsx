import * as AppleAuthentication from 'expo-apple-authentication';
import { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';

import { appleSignInAvailable } from '@/api/apple';
import { useTheme } from '@/hooks/use-theme';
import { radius, touch } from '@/theme';

/**
 * Botão oficial "Continuar com a Apple" (a Apple exige o dela, sem redesenho), só no iPhone. Preto no tema claro,
 * branco no escuro, com a altura e o canto do botão do Google ao lado.
 */
export function AppleButton({ onPress, loading, disabled }: { onPress: () => void; loading?: boolean; disabled?: boolean }) {
  const { scheme } = useTheme();
  const [available, setAvailable] = useState(false);

  useEffect(() => {
    let alive = true;
    appleSignInAvailable().then((value) => {
      if (alive) setAvailable(value);
    });
    return () => {
      alive = false;
    };
  }, []);

  if (!available) return null;
  const inactive = Boolean(disabled || loading);
  return (
    <View
      style={[styles.wrap, inactive && styles.inactive]}
      pointerEvents={inactive ? 'none' : 'auto'}
      accessibilityState={{ disabled: inactive, busy: loading }}>
      {/* O estilo do botão nativo não muda depois de montado: a chave o recria ao trocar o tema. */}
      <AppleAuthentication.AppleAuthenticationButton
        key={scheme}
        buttonType={AppleAuthentication.AppleAuthenticationButtonType.CONTINUE}
        buttonStyle={
          scheme === 'dark'
            ? AppleAuthentication.AppleAuthenticationButtonStyle.WHITE
            : AppleAuthentication.AppleAuthenticationButtonStyle.BLACK
        }
        cornerRadius={radius.md}
        style={styles.button}
        onPress={onPress}
      />
      {loading ? (
        <View style={[StyleSheet.absoluteFill, styles.center, { backgroundColor: scheme === 'dark' ? '#fff' : '#000', borderRadius: radius.md }]}>
          <ActivityIndicator color={scheme === 'dark' ? '#000' : '#fff'} accessibilityLabel="Entrando com Apple" />
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { width: '100%' },
  inactive: { opacity: 0.5 },
  button: { width: '100%', height: touch + 6 },
  center: { alignItems: 'center', justifyContent: 'center' },
});
