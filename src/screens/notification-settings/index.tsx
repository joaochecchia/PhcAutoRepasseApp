import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import * as Haptics from 'expo-haptics';
import { router } from 'expo-router';
import { BellOff, BellRing } from 'lucide-react-native';
import { useEffect } from 'react';
import { AppState, Linking, ScrollView, StyleSheet, Switch, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { pushKinds, pushStatus, savePushPrefs, syncPush, type PushKind, type PushStatus, type PushSupport } from '@/api/push';
import { AppText } from '@/components/app-text';
import { Button } from '@/components/button';
import { Notice } from '@/components/notice';
import { Skeleton } from '@/components/skeleton';
import { StateView } from '@/components/state-view';
import { useSession } from '@/hooks/use-session';
import { useTheme } from '@/hooks/use-theme';
import { radius, space, touch } from '@/theme';

const unsupported: Record<Exclude<PushSupport, 'ok'>, string> = {
  web: 'Notificações só no app instalado no celular.',
  'expo-go-android': 'No Expo Go do Android não há notificações push. Elas funcionam no app instalado (build de desenvolvimento ou da loja).',
  simulator: 'O simulador do iPhone não recebe notificações push. Use um iPhone de verdade.',
  'no-project': 'Este build ainda não está ligado ao projeto da Expo (EAS), que emite o endereço de notificação do aparelho.',
};

const statusKey = ['push-status'] as const;

/** Menu › Notificações: permissão do sistema e quais avisos da conta chegam por push neste aparelho. */
export function NotificationSettingsScreen() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const session = useSession();
  const queryClient = useQueryClient();
  const status = useQuery({ queryKey: statusKey, queryFn: pushStatus, staleTime: 0 });

  // Voltando dos ajustes do aparelho, a permissão pode ter mudado.
  useEffect(() => {
    const subscription = AppState.addEventListener('change', (next) => {
      if (next === 'active') queryClient.invalidateQueries({ queryKey: statusKey });
    });
    return () => subscription.remove();
  }, [queryClient]);

  const enable = useMutation({
    mutationFn: () => syncPush({ ask: true }),
    onSuccess: (next) => {
      queryClient.setQueryData<PushStatus>(statusKey, next);
      if (next.permission === 'granted') Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    },
  });
  const save = useMutation({
    mutationFn: (prefs: PushStatus['prefs']) => savePushPrefs(prefs),
    onMutate: (prefs) => {
      const previous = queryClient.getQueryData<PushStatus>(statusKey);
      if (previous) queryClient.setQueryData<PushStatus>(statusKey, { ...previous, prefs });
      return { previous };
    },
    onError: (_, __, context) => {
      if (context?.previous) queryClient.setQueryData(statusKey, context.previous);
    },
    onSuccess: (next) => queryClient.setQueryData<PushStatus>(statusKey, next),
  });

  if (session.status !== 'authenticated')
    return (
      <View style={[styles.root, { backgroundColor: colors.bg }]}>
        <StateView
          icon={BellRing}
          title="Entre na sua conta"
          message="As notificações avisam de mensagens e da fila de espera da sua conta."
          actionLabel="Entrar"
          onAction={() => router.push('/entrar')}
        />
      </View>
    );

  const data = status.data;
  return (
    <ScrollView
      style={{ backgroundColor: colors.bg }}
      contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + space.xxl }]}>
      <AppText color="muted">
        Os avisos também ficam em Avisos, no Menu. Aqui você escolhe quais chegam como notificação neste aparelho.
      </AppText>

      {status.isPending ? (
        <Skeleton height={120} rounded={radius.lg} />
      ) : status.isError || !data ? (
        <Notice
          tone="error"
          message="Não foi possível conferir as notificações deste aparelho."
          actionLabel="Tentar de novo"
          actionLoading={status.isFetching}
          onAction={() => status.refetch()}
        />
      ) : data.support !== 'ok' ? (
        <Notice title="Notificações indisponíveis aqui" message={unsupported[data.support]} />
      ) : data.permission !== 'granted' ? (
        <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <BellOff size={24} color={colors.muted} />
          <AppText variant="heading">Notificações desligadas</AppText>
          <AppText color="muted">
            {data.canAsk
              ? 'Ative para saber na hora quando responderem suas mensagens ou chegar um veículo da sua fila de espera.'
              : 'Você recusou as notificações. Para receber, ative nos ajustes do aparelho.'}
          </AppText>
          {data.canAsk ? (
            <Button label="Ativar notificações" onPress={() => enable.mutate()} loading={enable.isPending} />
          ) : (
            <Button label="Abrir ajustes do aparelho" variant="secondary" onPress={() => Linking.openSettings()} />
          )}
          {enable.isError ? <Notice tone="error" message={enable.error.message} /> : null}
        </View>
      ) : (
        <View style={[styles.list, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          {pushKinds.map((item, index) => (
            <View
              key={item.kind}
              style={[styles.row, index > 0 && { borderTopColor: colors.border, borderTopWidth: StyleSheet.hairlineWidth }]}>
              <View style={styles.flex}>
                <AppText variant="bodyStrong">{item.label}</AppText>
                <AppText variant="caption" color="muted">
                  {item.hint}
                </AppText>
              </View>
              <Switch
                value={data.prefs[item.kind]}
                disabled={save.isPending}
                onValueChange={(value) => {
                  Haptics.selectionAsync();
                  save.mutate({ ...data.prefs, [item.kind as PushKind]: value });
                }}
                trackColor={{ true: colors.red, false: colors.border }}
                thumbColor="#ffffff"
                accessibilityLabel={`Notificações de ${item.label.toLowerCase()}`}
              />
            </View>
          ))}
        </View>
      )}

      {save.isError ? (
        <Notice
          tone="error"
          message={`Não salvamos a escolha: ${save.error.message}`}
          actionLabel="Tentar de novo"
          onAction={() => save.variables && save.mutate(save.variables)}
        />
      ) : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  content: { padding: space.lg, gap: space.lg },
  flex: { flex: 1, gap: 2 },
  card: { borderRadius: radius.lg, borderWidth: StyleSheet.hairlineWidth, padding: space.lg, gap: space.md },
  list: { borderRadius: radius.lg, borderWidth: StyleSheet.hairlineWidth, overflow: 'hidden' },
  row: { flexDirection: 'row', alignItems: 'center', gap: space.md, paddingHorizontal: space.lg, paddingVertical: space.md, minHeight: touch + space.md },
});
