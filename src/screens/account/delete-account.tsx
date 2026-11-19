import { useMutation, useQueryClient } from '@tanstack/react-query';
import * as Haptics from 'expo-haptics';
import { router } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import { useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { accountApi } from '@/api/account';
import { appleDeletionCode } from '@/api/apple';
import { sessionStore } from '@/api/session-store';
import { AppText } from '@/components/app-text';
import { Button } from '@/components/button';
import { showDialog } from '@/components/dialog';
import { Notice } from '@/components/notice';
import { Skeleton } from '@/components/skeleton';
import { TextField } from '@/components/text-field';
import { useAccount } from '@/hooks/use-account';
import { useSession } from '@/hooks/use-session';
import { useTheme } from '@/hooks/use-theme';
import { radius, space } from '@/theme';

import { APPLE_MANAGE_URL, AppleStepError, deletionGate, deletionOutcome, isAppleStepError } from './deletion-flow';

const CONFIRMATION = 'EXCLUIR';

/**
 * Exclusão definitiva da conta (AccountPrivacy do site): o que some agora, o que a lei obriga a guardar e a
 * confirmação. Só fica disponível com o perfil carregado: sem ele não se sabe se a conta usa "Entrar com Apple".
 */
export function DeleteAccount({ hasPassword }: { hasPassword: boolean }) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const session = useSession();
  const queryClient = useQueryClient();
  const [senha, setSenha] = useState('');
  const [typed, setTyped] = useState('');
  const profile = useAccount();
  const gate = deletionGate(Platform.OS, profile);
  const filled = typed.trim().toUpperCase() === CONFIRMATION && (!hasPassword || senha.length > 0);

  const remove = useMutation({
    mutationFn: async ({ skipApple }: { skipApple: boolean }) => {
      if (session.status !== 'authenticated') throw new Error('Entre na sua conta para continuar.');
      if (gate.kind !== 'ready') throw new Error('Confira sua conta antes de excluir.');
      let appleCodigo: string | undefined;
      if (gate.appleConfirmation && !skipApple) {
        let code: string | null;
        try {
          code = await appleDeletionCode();
        } catch (error) {
          throw new AppleStepError(error instanceof Error ? error.message : 'Não foi possível confirmar com a Apple.');
        }
        if (!code) throw new AppleStepError('Você não confirmou com a Apple. Sua conta não foi excluída.');
        appleCodigo = code;
      }
      return accountApi.deleteAccount(session.user.usuarioId, hasPassword ? senha : undefined, appleCodigo);
    },
    onSuccess: async (result) => {
      // O servidor já encerrou a sessão; aqui só limpa o aparelho.
      await sessionStore.clear();
      queryClient.clear();
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      router.dismissAll();
      const outcome = deletionOutcome(result?.revogacaoApple);
      showDialog({
        title: outcome.title,
        message: outcome.message,
        actions: outcome.appleHelp
          ? [
              { label: 'Entendi', kind: 'cancel' },
              { label: 'Ver como remover na Apple', onPress: () => WebBrowser.openBrowserAsync(APPLE_MANAGE_URL) },
            ]
          : undefined,
      });
    },
    onError: () => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error),
  });

  // Qual dos dois botões está excluindo agora (com ou sem a confirmação da Apple).
  const runningSkip = remove.isPending ? remove.variables.skipApple : null;
  const appleFailed = remove.isError && gate.kind === 'ready' && gate.appleAccount && isAppleStepError(remove.error);

  return (
    <KeyboardAvoidingView style={[styles.root, { backgroundColor: colors.bg }]} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + space.xxl }]}>
        <AppText variant="display" accessibilityRole="header">
          Excluir sua conta para sempre?
        </AppText>
        <List
          title="Apagamos agora"
          items={[
            'Perfil, endereço, telefone e foto',
            'Todos os seus anúncios, com fotos, placa e endereço do veículo',
            'Sessões, logins externos vinculados e pedidos de contato feitos por você',
          ]}
        />
        <List
          title="Guardamos por 5 anos, por obrigação legal"
          items={['Nome, CPF ou CNPJ e e-mail', 'Pagamentos de planos e o aceite dos termos']}
          note="Depois desse prazo, também são apagados."
        />
        <List
          title="Guardamos por menos tempo"
          items={[
            'Conversas do chat: 180 dias, como prova da negociação',
            'Logins e acessos (data, hora, IP e porta): 190 dias, pelo Marco Civil da Internet',
            'Logs técnicos e cópias de segurança: 14 dias',
          ]}
        />
        <Notice tone="info" message="Um plano pago em vigor é encerrado na hora, sem reembolso do período restante." />

        {gate.kind === 'loading' ? (
          <View accessibilityLabel="Conferindo sua conta" accessibilityState={{ busy: true }} style={styles.checking}>
            <Skeleton height={56} rounded={radius.md} />
          </View>
        ) : gate.kind === 'error' ? (
          <Notice
            tone="error"
            title="Não conseguimos conferir sua conta"
            message="Sem isso não dá para excluir com segurança. Confira a internet e tente de novo."
            actionLabel="Tentar novamente"
            actionLoading={profile.isFetching}
            onAction={() => profile.refetch()}
          />
        ) : gate.appleAccount ? (
          <Notice
            tone="info"
            message={
              gate.appleConfirmation
                ? 'Sua conta usa Entrar com Apple. Ao excluir, a Apple pede sua confirmação para encerrarmos o acesso do PHC Auto na sua conta Apple.'
                : gate.appleRevocable
                  ? 'Sua conta usa Entrar com Apple. Ao excluir, encerramos também o acesso do PHC Auto na sua conta Apple.'
                  : 'Sua conta usa Entrar com Apple. Neste aparelho não conseguimos encerrar o acesso na Apple; depois de excluir, mostramos como remover o PHC Auto da sua conta Apple.'
            }
          />
        ) : null}

        {hasPassword ? (
          <TextField
            label="Senha atual"
            value={senha}
            onChangeText={setSenha}
            secure
            autoComplete="current-password"
            textContentType="password"
            editable={!remove.isPending}
          />
        ) : null}
        <TextField
          label={`Digite ${CONFIRMATION} para confirmar`}
          value={typed}
          onChangeText={setTyped}
          autoCapitalize="characters"
          autoCorrect={false}
          editable={!remove.isPending}
        />
        {remove.isError ? <Notice tone="error" message={remove.error.message} /> : null}
        {appleFailed ? (
          <View style={[styles.list, { backgroundColor: colors.subtle }]}>
            <AppText>
              Você pode excluir sem a confirmação da Apple. Nesse caso, a conta é apagada aqui, e o acesso do PHC Auto na
              sua conta Apple você remove depois, pela Apple.
            </AppText>
            <Button
              label="Excluir sem confirmar com a Apple"
              variant="secondary"
              onPress={() => remove.mutate({ skipApple: true })}
              loading={runningSkip === true}
              disabled={!filled || remove.isPending}
            />
          </View>
        ) : null}
        <View style={styles.actions}>
          <Button label="Manter minha conta" variant="secondary" onPress={() => router.back()} disabled={remove.isPending} />
          <Button
            label="Excluir minha conta"
            onPress={() => remove.mutate({ skipApple: false })}
            loading={runningSkip === false}
            disabled={!filled || gate.kind !== 'ready' || remove.isPending}
            accessibilityHint="Apaga a conta e os anúncios. Não dá para desfazer."
          />
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function List({ title, items, note }: { title: string; items: string[]; note?: string }) {
  const { colors } = useTheme();
  return (
    <View style={[styles.list, { backgroundColor: colors.subtle }]}>
      <AppText variant="bodyStrong">{title}</AppText>
      {items.map((item) => (
        <View key={item} style={styles.item}>
          <AppText color="muted">•</AppText>
          <AppText style={styles.flex}>{item}</AppText>
        </View>
      ))}
      {note ? (
        <AppText variant="caption" color="muted">
          {note}
        </AppText>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  flex: { flex: 1 },
  content: { padding: space.lg, gap: space.lg },
  list: { gap: space.sm, padding: space.lg, borderRadius: radius.lg },
  item: { flexDirection: 'row', gap: space.sm },
  actions: { gap: space.md },
  checking: { gap: space.sm },
});
