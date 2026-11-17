import { BellRing, X } from 'lucide-react-native';
import { useState } from 'react';
import { Pressable, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { AppText } from '@/components/app-text';
import { Button } from '@/components/button';
import { useEnablePush, usePushStatus } from '@/hooks/use-push';
import { useTheme } from '@/hooks/use-theme';
import { radius, space, touch } from '@/theme';

/** Dispensado vale até a próxima abertura do app. */
let dismissed = false;

/**
 * Convite para ativar as notificações (na lista de mensagens). Só aparece onde o push funciona e enquanto a permissão
 * do sistema não foi dada; se a pessoa já recusou no sistema, o botão leva aos ajustes do aparelho.
 */
export function PushPrompt({ message, style }: { message: string; style?: StyleProp<ViewStyle> }) {
  const { colors } = useTheme();
  const status = usePushStatus();
  const enable = useEnablePush();
  const [hidden, setHidden] = useState(dismissed);

  const data = status.data;
  if (hidden || !data || data.support !== 'ok' || data.permission === 'granted') return null;

  return (
    <View style={[styles.root, { backgroundColor: colors.redTint, borderColor: colors.redBorder }, style]}>
      <View style={styles.row}>
        <BellRing size={20} color={colors.red} strokeWidth={2.2} style={styles.icon} />
        <View style={styles.text}>
          <AppText variant="bodyStrong">Ative as notificações</AppText>
          <AppText variant="caption" color="muted">
            {data.canAsk ? message : `${message} Elas estão desligadas nos ajustes do aparelho.`}
          </AppText>
        </View>
        <Pressable
          onPress={() => {
            dismissed = true;
            setHidden(true);
          }}
          hitSlop={8}
          style={styles.close}
          accessibilityRole="button"
          accessibilityLabel="Agora não">
          <X size={18} color={colors.muted} />
        </Pressable>
      </View>
      <Button
        label={data.canAsk ? 'Ativar notificações' : 'Abrir ajustes'}
        onPress={() => enable.mutate()}
        loading={enable.isPending}
        style={styles.button}
      />
      {enable.isError ? (
        <AppText variant="caption" color="red" accessibilityRole="alert">
          Não ativamos agora: {enable.error.message}
        </AppText>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { borderRadius: radius.lg, borderWidth: StyleSheet.hairlineWidth, padding: space.lg, gap: space.md },
  row: { flexDirection: 'row', alignItems: 'flex-start', gap: space.md },
  icon: { marginTop: 1 },
  text: { flex: 1, gap: 2 },
  close: { width: touch, height: touch, marginTop: -space.md, marginRight: -space.md, alignItems: 'center', justifyContent: 'center' },
  button: { alignSelf: 'flex-start' },
});
