import { useMutation, useQueryClient } from '@tanstack/react-query';
import * as Haptics from 'expo-haptics';
import { router } from 'expo-router';
import { useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { accountApi } from '@/api/account';
import { sessionStore } from '@/api/session-store';
import { AppText } from '@/components/app-text';
import { Button } from '@/components/button';
import { showDialog } from '@/components/dialog';
import { Notice } from '@/components/notice';
import { TextField } from '@/components/text-field';
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
  const ready = typed.trim().toUpperCase() === CONFIRMATION && (!hasPassword || senha.length > 0);

  const remove = useMutation({
    mutationFn: () => {
      if (session.status !== 'authenticated') throw new Error('Entre na sua conta para continuar.');
      return accountApi.deleteAccount(session.user.usuarioId, hasPassword ? senha : undefined);
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
        <Notice tone="info" message="Um plano pago em vigor é encerrado na hora, sem reembolso do período restante." />
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
