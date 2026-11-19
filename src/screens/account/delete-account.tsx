import { useMutation, useQueryClient } from '@tanstack/react-query';
import * as Haptics from 'expo-haptics';
import { router } from 'expo-router';
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
import { TextField } from '@/components/text-field';
import { useAccount } from '@/hooks/use-account';
import { useSession } from '@/hooks/use-session';
import { useTheme } from '@/hooks/use-theme';
import { radius, space } from '@/theme';

const CONFIRMATION = 'EXCLUIR';

/** Exclusão definitiva da conta (AccountPrivacy do site): o que some agora, o que a lei obriga a guardar e a confirmação. */
export function DeleteAccount({ hasPassword }: { hasPassword: boolean }) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const session = useSession();
  const queryClient = useQueryClient();
  const [senha, setSenha] = useState('');
  const [typed, setTyped] = useState('');
  const profile = useAccount();
  // Conta com "Entrar com Apple": no iPhone, a Apple confirma antes, para o backend revogar o acesso do app.
  const ios = Platform.OS === 'ios';
  const needsApple = ios && profile.data?.contaApple === true;
  const ready =
    typed.trim().toUpperCase() === CONFIRMATION && (!hasPassword || senha.length > 0) && !(ios && profile.isPending);

  const remove = useMutation({
    mutationFn: async () => {
      if (session.status !== 'authenticated') throw new Error('Entre na sua conta para continuar.');
      let appleCodigo: string | undefined;
      if (needsApple) {
        const code = await appleDeletionCode();
        if (!code) throw new Error('Confirme com a Apple para excluir. Sua conta não foi excluída.');
        appleCodigo = code;
      }
      return accountApi.deleteAccount(session.user.usuarioId, hasPassword ? senha : undefined, appleCodigo);
    },
    onSuccess: async () => {
      // O servidor já encerrou a sessão; aqui só limpa o aparelho.
      await sessionStore.clear();
      queryClient.clear();
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      router.dismissAll();
      showDialog({ title: 'Conta excluída', message: 'Seus dados e anúncios foram apagados.' });
    },
    onError: () => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error),
  });

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
            'Logins e acessos (data, hora, IP e porta): 6 meses, pelo Marco Civil',
            'Logs técnicos e cópias de segurança: 14 dias',
          ]}
        />
        <Notice tone="info" message="Um plano pago em vigor é encerrado na hora, sem reembolso do período restante." />
        {needsApple ? (
          <Notice
            tone="info"
            message="Sua conta usa Entrar com Apple. Ao excluir, a Apple pede sua confirmação para encerrar o acesso do PHC Auto."
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
        <View style={styles.actions}>
          <Button label="Manter minha conta" variant="secondary" onPress={() => router.back()} disabled={remove.isPending} />
          <Button
            label="Excluir minha conta"
            onPress={() => remove.mutate()}
            loading={remove.isPending}
            disabled={!ready}
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
});
