import * as Haptics from 'expo-haptics';
import { useEffect, useState } from 'react';
import { Modal, Pressable, StyleSheet, View } from 'react-native';

import { AppText } from '@/components/app-text';
import { Button } from '@/components/button';
import { useTheme } from '@/hooks/use-theme';
import { radius, space } from '@/theme';

export type DialogAction = {
  label: string;
  /** cancel fecha sem agir; destructive é a ação principal, em vermelho. */
  kind?: 'default' | 'cancel' | 'destructive';
  onPress?: () => void;
};

type DialogOptions = { title: string; message?: string; actions?: DialogAction[] };

let present: ((options: DialogOptions) => void) | null = null;

/**
 * Substitui o Alert nativo, que no Android sai branco e ignora o tema escolhido no app.
 * Uso igual ao Alert: showDialog({ title, message, actions }). Sem actions, mostra só "Entendi".
 */
export function showDialog(options: DialogOptions) {
  present?.(options);
}

/** Fica uma vez na raiz, dentro do AppThemeProvider. */
export function DialogHost() {
  const { colors } = useTheme();
  const [dialog, setDialog] = useState<DialogOptions | null>(null);

  useEffect(() => {
    present = setDialog;
    return () => {
      present = null;
    };
  }, []);

  const actions: DialogAction[] = dialog?.actions?.length ? dialog.actions : [{ label: 'Entendi' }];
  const cancel = actions.find((action) => action.kind === 'cancel');
  const stacked = actions.length > 2;

  function close(action?: DialogAction) {
    setDialog(null);
    if (action?.kind === 'destructive') Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
    action?.onPress?.();
  }

  // Tocar fora ou no voltar do Android só fecha quando existe um caminho neutro (cancelar ou aviso simples).
  const dismissible = Boolean(cancel) || actions.length === 1;
  const dismiss = () => {
    if (dismissible) close(cancel ?? actions[0]);
  };

  return (
    <Modal
      visible={Boolean(dialog)}
      transparent
      animationType="fade"
      statusBarTranslucent
      navigationBarTranslucent
      onRequestClose={dismiss}>
      <View style={styles.center}>
        <Pressable
          style={[StyleSheet.absoluteFill, { backgroundColor: colors.scrim }]}
          onPress={dismiss}
          accessible={false}
          importantForAccessibility="no"
        />
        {dialog ? (
          <View
            accessibilityViewIsModal
            accessibilityRole="alert"
            style={[styles.card, { backgroundColor: colors.elevated, borderColor: colors.border }]}>
            <View style={styles.text}>
              <AppText variant="title" accessibilityRole="header">
                {dialog.title}
              </AppText>
              {dialog.message ? <AppText color="muted">{dialog.message}</AppText> : null}
            </View>
            <View style={[styles.actions, stacked && styles.stacked]}>
              {actions.map((action, index) => {
                const main = action.kind === 'destructive' || (action.kind !== 'cancel' && index === actions.length - 1);
                return (
                  <Button
                    key={action.label}
                    label={action.label}
                    variant={main ? 'primary' : 'secondary'}
                    onPress={() => close(action)}
                    style={stacked ? undefined : styles.flex}
                  />
                );
              })}
            </View>
          </View>
        ) : null}
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: space.xxl },
  card: {
    width: '100%',
    maxWidth: 400,
    borderRadius: radius.xl,
    borderWidth: StyleSheet.hairlineWidth,
    padding: space.xxl,
    gap: space.xl,
  },
  text: { gap: space.sm },
  actions: { flexDirection: 'row', gap: space.sm },
  stacked: { flexDirection: 'column-reverse' },
  flex: { flex: 1 },
});
