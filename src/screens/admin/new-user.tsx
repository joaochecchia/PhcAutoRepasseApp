import { useMutation, useQueryClient } from '@tanstack/react-query';
import * as Haptics from 'expo-haptics';
import { router } from 'expo-router';
import { useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Check } from 'lucide-react-native';

import { accountApi, type AccountDraft } from '@/api/account';
import { adminApi, type PapelAdministravel } from '@/api/admin';
import { AddressFields, PasswordCriteria, PersonFields, passwordCriteria, validateAccount } from '@/components/account-fields';
import { AppText } from '@/components/app-text';
import { Button } from '@/components/button';
import { showDialog } from '@/components/dialog';
import { Notice } from '@/components/notice';
import { TextField } from '@/components/text-field';
import { useTheme } from '@/hooks/use-theme';
import { radius, space, touch } from '@/theme';

import { AdminGate } from './admin-gate';
import { roleLabels } from './format';
import { adminStyles, Segmented } from './ui';
import { usersKey } from './users';

const roleOptions: { value: PapelAdministravel; label: string }[] = [
  { value: 'CLIENTE', label: 'Cliente' },
  { value: 'ADMIN', label: 'Admin' },
  { value: 'DONO', label: 'Dono' },
];

/** Novo usuário (CreateUser do site, só DONO). Cliente e Admin pedem o cadastro completo e o aceite do titular. */
export function NewUserScreen() {
  return (
    <AdminGate owner>
      <NewUser />
    </AdminGate>
  );
}

function NewUser() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const cache = useQueryClient();
  const [role, setRole] = useState<PapelAdministravel>('CLIENTE');
  const [values, setValues] = useState<AccountDraft>({ tipoPessoa: 'PF' });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [terms, setTerms] = useState(false);
  const [error, setError] = useState('');

  const create = useMutation({
    mutationFn: async () => adminApi.createUser(values, role, await accountApi.termsVersions()),
    onSuccess: () => {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      cache.invalidateQueries({ queryKey: usersKey });
      showDialog({ title: 'Conta criada', message: `${values.email} entrou como ${roleLabels[role]}.` });
      router.back();
    },
    onError: (reason) => setError(reason.message),
  });

  function change(key: string, value: string) {
    setValues((current) => ({ ...current, [key]: value }));
    setErrors((current) => {
      if (!current[key]) return current;
      const next = { ...current };
      delete next[key];
      return next;
    });
  }

  function submit() {
    setError('');
    const found: Record<string, string> =
      role === 'DONO'
        ? {
            ...(!(values.nome ?? '').trim() ? { nome: 'Informe o nome.' } : {}),
            ...(!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test((values.email ?? '').trim()) ? { email: 'Informe um e-mail válido.' } : {}),
          }
        : validateAccount({ ...values, confirmacaoSenha: values.senha ?? '' }, { address: true, password: false });
    if (!passwordCriteria.every(([, test]) => test(values.senha ?? ''))) found.senha = 'A senha não atende a todos os critérios.';
    setErrors(found);
    if (Object.keys(found).length) return setError('Confira os campos destacados.');
    if (role !== 'DONO' && !terms) return setError('Confirme que o titular aceitou os Termos de Uso e a Política de Privacidade.');
    create.mutate();
  }

  return (
    <KeyboardAvoidingView style={styles.root} behavior={Platform.OS === 'ios' ? 'padding' : undefined} keyboardVerticalOffset={90}>
      <ScrollView
        style={{ backgroundColor: colors.bg }}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={[adminStyles.content, { paddingBottom: insets.bottom + space.xxxl }]}>
        <View style={styles.field}>
          <AppText variant="label">Papel</AppText>
          <Segmented label="Papel da nova conta" options={roleOptions} value={role} onChange={setRole} disabled={create.isPending} />
          <AppText variant="caption" color="muted">
            {role === 'DONO'
              ? 'Dono tem acesso total e informa só nome, e-mail e senha.'
              : role === 'ADMIN'
                ? 'Admin vê observabilidade, impulsos, banners e conversas.'
                : 'Cliente usa o app como qualquer pessoa.'}
          </AppText>
        </View>

        {role === 'DONO' ? (
          <>
            <TextField label="Nome" value={values.nome ?? ''} onChangeText={(text) => change('nome', text)} error={errors.nome} />
            <TextField
              label="E-mail"
              value={values.email ?? ''}
              onChangeText={(text) => change('email', text)}
              error={errors.email}
              autoCapitalize="none"
              keyboardType="email-address"
            />
          </>
        ) : (
          <>
            <PersonFields values={values} errors={errors} onChange={change} />
            <AddressFields values={values} errors={errors} onChange={change} />
          </>
        )}

        <TextField
          label="Senha"
          value={values.senha ?? ''}
          onChangeText={(text) => change('senha', text)}
          error={errors.senha}
          secure
          autoCapitalize="none"
          textContentType="newPassword"
        />
        <PasswordCriteria value={values.senha ?? ''} />
        <AppText variant="caption" color="muted">
          A pessoa pode trocar a senha depois em &quot;Esqueci minha senha&quot;.
        </AppText>

        {role !== 'DONO' ? (
          <Pressable
            onPress={() => setTerms((value) => !value)}
            accessibilityRole="checkbox"
            accessibilityState={{ checked: terms }}
            style={styles.check}>
            <View
              style={[
                styles.box,
                { borderColor: terms ? colors.red : colors.border, backgroundColor: terms ? colors.red : colors.surface },
              ]}>
              {terms ? <Check size={16} color={colors.onRed} /> : null}
            </View>
            <AppText style={styles.flex}>O titular aceitou os Termos de Uso e a Política de Privacidade vigentes.</AppText>
          </Pressable>
        ) : null}

        {error ? <Notice tone="error" message={error} /> : null}
        <Button label="Criar conta" loading={create.isPending} onPress={submit} />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  flex: { flex: 1 },
  field: { gap: space.sm },
  check: { flexDirection: 'row', alignItems: 'center', gap: space.md, minHeight: touch },
  box: { width: 24, height: 24, borderRadius: radius.sm - 2, borderWidth: 1.5, alignItems: 'center', justifyContent: 'center' },
});
