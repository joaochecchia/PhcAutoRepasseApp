import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import * as Haptics from 'expo-haptics';
import { router } from 'expo-router';
import { Gift, ShieldCheck, Trash2, UserRound } from 'lucide-react-native';
import { useMemo, useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { draftFromProfile, accountApi, type AccountDraft } from '@/api/account';
import { adminApi, type AdminSubscription, type AdminUser, type PapelAdministravel } from '@/api/admin';
import { authApi } from '@/api/auth';
import { plansApi } from '@/api/plans';
import { AddressFields, PersonFields, validateAccount } from '@/components/account-fields';
import { AppText } from '@/components/app-text';
import { Button } from '@/components/button';
import { ChoiceRow } from '@/components/choice-row';
import { showDialog } from '@/components/dialog';
import { Notice } from '@/components/notice';
import { Skeleton } from '@/components/skeleton';
import { StateView } from '@/components/state-view';
import { TextField } from '@/components/text-field';
import { useSession } from '@/hooks/use-session';
import { useTheme } from '@/hooks/use-theme';
import { radius, space } from '@/theme';
import { formatCents } from '@/utils/format';
import { digitsToIsoDate, formatDateBr, onlyDigits } from '@/utils/masks';

import { AdminGate } from './admin-gate';
import { formatDate, roleLabels } from './format';
import { adminStyles, Segmented, Tag } from './ui';
import { cachedAdminUser, patchAdminUser, usersKey } from './users';

const roleOptions: { value: PapelAdministravel; label: string }[] = [
  { value: 'CLIENTE', label: 'Cliente' },
  { value: 'ADMIN', label: 'Admin' },
  { value: 'DONO', label: 'Dono' },
];
const periods = [
  { value: '7', label: '7 dias' },
  { value: '30', label: '30 dias' },
  { value: '90', label: '90 dias' },
  { value: '180', label: '6 meses' },
  { value: '365', label: '1 ano' },
  { value: 'data', label: 'Até uma data' },
];

/** Gerenciar uma conta (ManageUser do site, só DONO): acesso, plano cortesia, dados e exclusão. */
export function UserDetailScreen({ id }: { id: string }) {
  return (
    <AdminGate owner>
      <UserDetail id={id} />
    </AdminGate>
  );
}

function UserDetail({ id }: { id: string }) {
  const { colors } = useTheme();
  const cache = useQueryClient();
  const user = useQuery({
    queryKey: ['admin', 'user', id],
    queryFn: () => cachedAdminUser(cache, id),
    initialData: () => cachedAdminUser(cache, id) ?? undefined,
    staleTime: Infinity,
  });
  if (!user.data) {
    return (
      <View style={[styles.root, { backgroundColor: colors.bg }]}>
        <StateView
          icon={UserRound}
          title="Abra a conta pela lista"
          message="Os dados desta conta não estão mais carregados."
          actionLabel="Ir para Usuários"
          onAction={() => router.replace('/admin/usuarios')}
        />
      </View>
    );
  }
  return <Manage user={user.data} />;
}

function Manage({ user }: { user: AdminUser }) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const session = useSession();
  const self = session.status === 'authenticated' && session.user.usuarioId === user.id;
  return (
    <KeyboardAvoidingView style={styles.root} behavior={Platform.OS === 'ios' ? 'padding' : undefined} keyboardVerticalOffset={90}>
      <ScrollView
        style={{ backgroundColor: colors.bg }}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={[adminStyles.content, { paddingBottom: insets.bottom + space.xxxl }]}>
        <View style={styles.head}>
          <AppText variant="title">{user.nome}</AppText>
          <AppText color="muted" selectable>
            {user.email} · {user.tipoPessoa} · desde {formatDate(user.criadoEm)}
          </AppText>
          <View style={styles.tags}>
            <Tag label={roleLabels[user.papel] ?? user.papel} tone="warn" />
            <Tag label={user.ativo ? 'Ativa' : 'Bloqueada'} tone={user.ativo ? 'good' : 'bad'} />
          </View>
        </View>
        <Access user={user} self={self} />
        <Plan user={user} />
        <Profile user={user} />
        {self ? null : <Delete user={user} />}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function Block({ icon: Icon, title, children }: { icon: typeof Gift; title: string; children: React.ReactNode }) {
  const { colors } = useTheme();
  return (
    <View style={[adminStyles.card, styles.block, { backgroundColor: colors.surface, borderColor: colors.border }]}>
      <View style={styles.blockTitle}>
        <Icon size={18} color={colors.text} />
        <AppText variant="heading" accessibilityRole="header">
          {title}
        </AppText>
      </View>
      {children}
    </View>
  );
}

function Access({ user, self }: { user: AdminUser; self: boolean }) {
  const { colors } = useTheme();
  const cache = useQueryClient();
  const current: PapelAdministravel = user.papel === 'ADMIN' || user.papel === 'DONO' ? user.papel : 'CLIENTE';
  const [role, setRole] = useState<PapelAdministravel>(current);
  const [done, setDone] = useState('');
  const change = useMutation({
    mutationFn: (input: { change: { papel?: PapelAdministravel; ativo?: boolean }; message: string }) =>
      adminApi.changeAccess(user.id, input.change),
    onMutate: () => setDone(''),
    onSuccess: (result, input) => {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      patchAdminUser(cache, user.id, { papel: result.papel, ativo: result.ativo });
      cache.setQueryData(['admin', 'user', user.id], { ...user, papel: result.papel, ativo: result.ativo });
      setDone(input.message);
    },
  });

  return (
    <Block icon={ShieldCheck} title="Acesso">
      {self ? (
        <AppText color="muted">Você não pode alterar o próprio papel nem bloquear a própria conta.</AppText>
      ) : (
        <>
          <Segmented label="Papel" options={roleOptions} value={role} onChange={setRole} disabled={change.isPending} />
          <AppText variant="caption" color="muted">
            Admin: observabilidade, impulsos, banners e conversas. Dono: acesso total.
          </AppText>
          <Button
            label="Salvar papel"
            variant="secondary"
            disabled={change.isPending || role === user.papel}
            loading={change.isPending && change.variables?.change.papel !== undefined}
            onPress={() => change.mutate({ change: { papel: role }, message: `${user.nome} agora é ${roleLabels[role]}.` })}
          />
          <Button
            label={user.ativo ? 'Bloquear conta' : 'Reativar conta'}
            variant={user.ativo ? 'ghost' : 'primary'}
            icon={user.ativo ? <ShieldCheck size={16} color={colors.red} /> : undefined}
            disabled={change.isPending}
            loading={change.isPending && change.variables?.change.ativo !== undefined}
            onPress={() =>
              showDialog({
                title: user.ativo ? `Bloquear ${user.nome}?` : `Reativar ${user.nome}?`,
                message: user.ativo
                  ? 'A pessoa sai de todas as sessões e não consegue entrar até ser reativada.'
                  : 'A conta volta a entrar normalmente.',
                actions: [
                  { label: 'Cancelar', kind: 'cancel' },
                  {
                    label: user.ativo ? 'Bloquear' : 'Reativar',
                    kind: user.ativo ? 'destructive' : 'default',
                    onPress: () =>
                      change.mutate({
                        change: { ativo: !user.ativo },
                        message: user.ativo ? `Conta de ${user.nome} bloqueada.` : `Conta de ${user.nome} reativada.`,
                      }),
                  },
                ],
              })
            }
          />
        </>
      )}
      <AppText variant="caption" color="muted">
        Toda alteração de acesso encerra as sessões abertas do usuário.
      </AppText>
      {done ? <Notice tone="success" message={done} /> : null}
      {change.isError ? <Notice tone="error" message={change.error.message} /> : null}
    </Block>
  );
}

function Plan({ user }: { user: AdminUser }) {
  const cache = useQueryClient();
  const historyKey = ['admin', 'subscriptions', user.id];
  const history = useQuery({ queryKey: historyKey, queryFn: ({ signal }) => adminApi.subscriptions(user.id, signal) });
  const plans = useQuery({ queryKey: ['plans'], queryFn: ({ signal }) => plansApi.list(signal), staleTime: 10 * 60_000 });
  const eligible = useMemo(
    () => (plans.data ?? []).filter((plan) => !plan.gratuito && (plan.publico === 'TODOS' || plan.publico === user.tipoPessoa)),
    [plans.data, user.tipoPessoa],
  );
  const [picked, setPlanCode] = useState('');
  const planCode = picked || eligible[0]?.codigo || '';
  const [days, setDays] = useState('90');
  const [until, setUntil] = useState('');
  const [note, setNote] = useState('');
  const [error, setError] = useState('');
  const [done, setDone] = useState('');

  const refresh = () => {
    cache.invalidateQueries({ queryKey: historyKey });
    cache.invalidateQueries({ queryKey: ['admin', 'current-plans'] });
  };
  const grant = useMutation({
    mutationFn: (input: { plano: string; fimEm: string; observacao?: string }) => adminApi.grantPlan(user.id, input),
    onSuccess: (granted) => {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setNote('');
      setDone(`${granted.planoNome} concedido até ${formatDate(granted.fimEm)}.`);
      refresh();
    },
    onError: (reason) => setError(reason.message),
  });
  const end = useMutation({
    mutationFn: (subscription: AdminSubscription) => adminApi.endSubscription(subscription.id),
    onSuccess: (_, subscription) => {
      setDone(`${subscription.planoNome} encerrado.`);
      refresh();
    },
    onError: (reason) => showDialog({ title: 'Não foi possível encerrar o plano', message: reason.message }),
  });

  function submit() {
    setError('');
    setDone('');
    let endDate: Date | null;
    if (days === 'data') {
      const iso = digitsToIsoDate(onlyDigits(until));
      endDate = iso ? new Date(`${iso}T23:59:59`) : null;
    } else {
      endDate = new Date(Date.now() + Number(days) * 86_400_000);
    }
    if (!planCode) return setError('Escolha um plano.');
    if (!endDate || Number.isNaN(endDate.getTime()) || endDate <= new Date()) return setError('Escolha uma data futura.');
    grant.mutate({ plano: planCode, fimEm: endDate.toISOString(), observacao: note.trim() || undefined });
  }

  function confirmEnd(subscription: AdminSubscription) {
    const paid = subscription.origem === 'COMPRA' && subscription.valorCentavos > 0;
    showDialog({
      title: `Encerrar ${subscription.planoNome}?`,
      message: paid
        ? `Este período foi pago (${formatCents(subscription.valorCentavos)}) e não há estorno automático.`
        : 'O usuário volta ao plano Free agora.',
      actions: [
        { label: 'Manter', kind: 'cancel' },
        { label: 'Encerrar', kind: 'destructive', onPress: () => end.mutate(subscription) },
      ],
    });
  }

  // Vigente no momento da leitura (a lista é recarregada a cada mudança).
  const now = history.dataUpdatedAt;
  const active = history.data?.filter((s) => s.status === 'ATIVA' && s.fimEm && new Date(s.fimEm).getTime() > now) ?? [];
  return (
    <Block icon={Gift} title="Plano">
      {history.isPending ? (
        <Skeleton height={20} width="70%" />
      ) : history.isError ? (
        <Notice tone="error" message={history.error.message} actionLabel="Tentar de novo" onAction={() => history.refetch()} />
      ) : active.length === 0 ? (
        <AppText>Plano atual: Free</AppText>
      ) : (
        active.map((s) => (
          <View key={s.id} style={styles.subscription}>
            <View style={styles.flex}>
              <AppText variant="bodyStrong">
                {s.planoNome} {s.vigente ? 'vigente' : 'agendado'}
              </AppText>
              <AppText variant="caption" color="muted">
                {formatDate(s.inicioEm)} a {formatDate(s.fimEm)} ·{' '}
                {s.origem === 'CONCESSAO' ? 'concedido' : `pago ${formatCents(s.valorCentavos)}`}
              </AppText>
            </View>
            <Button label="Encerrar" variant="ghost" loading={end.isPending && end.variables?.id === s.id} onPress={() => confirmEnd(s)} />
          </View>
        ))
      )}

      <AppText variant="label">Conceder plano</AppText>
      {eligible.length === 0 && !plans.isPending ? (
        <AppText variant="caption" color="muted">
          Nenhum plano pago disponível para {user.tipoPessoa}.
        </AppText>
      ) : (
        <ChoiceRow value={planCode} onChange={setPlanCode} disabled={grant.isPending} options={eligible.map((p) => ({ value: p.codigo, label: p.nome }))} />
      )}
      <AppText variant="label">Por quanto tempo</AppText>
      <ChoiceRow value={days} onChange={setDays} disabled={grant.isPending} options={periods} />
      {days === 'data' ? (
        <TextField
          label="Válido até"
          value={formatDateBr(until)}
          onChangeText={(text) => setUntil(onlyDigits(text).slice(0, 8))}
          placeholder="DD/MM/AAAA"
          keyboardType="number-pad"
          maxLength={10}
        />
      ) : null}
      <TextField label="Observação (opcional)" value={note} onChangeText={setNote} maxLength={255} placeholder="Ex.: lançamento grupo PHC" />
      {error ? <Notice tone="error" message={error} /> : null}
      {done ? <Notice tone="success" message={done} /> : null}
      <Button label="Conceder plano" loading={grant.isPending} disabled={eligible.length === 0} onPress={submit} />
      <AppText variant="caption" color="muted">
        A concessão começa agora e substitui os períodos ativos ou agendados, inclusive os pagos (sem estorno automático).
      </AppText>

      {history.data && history.data.length > 0 ? (
        <View style={styles.history}>
          <AppText variant="label" color="muted">
            Histórico ({history.data.length})
          </AppText>
          {history.data.map((s) => (
            <AppText key={s.id} variant="caption">
              {s.planoNome} · {s.status.toLowerCase()} · {s.origem === 'CONCESSAO' ? 'concedido' : `pago ${formatCents(s.valorCentavos)}`} ·{' '}
              {s.inicioEm ? `${formatDate(s.inicioEm)} a ${formatDate(s.fimEm)}` : `criado em ${formatDate(s.criadoEm)}`}
              {s.observacao ? ` · ${s.observacao}` : ''}
            </AppText>
          ))}
        </View>
      ) : null}
    </Block>
  );
}

function Profile({ user }: { user: AdminUser }) {
  const cache = useQueryClient();
  const profile = useQuery({ queryKey: ['admin', 'profile', user.id], queryFn: ({ signal }) => authApi.profile(user.id, signal) });
  const [edited, setEdited] = useState<AccountDraft | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [done, setDone] = useState('');
  // Contas sem endereço (Dono e Admin criados só com nome, e-mail e senha) editam só nome e e-mail.
  const basicOnly = profile.data ? !profile.data.endereco : false;
  const values = edited ?? (profile.data ? draftFromProfile(profile.data) : null);

  const save = useMutation({
    mutationFn: (draft: AccountDraft) =>
      basicOnly
        ? adminApi.updateBasic(user.id, { nome: draft.nome ?? '', email: draft.email ?? '' })
        : accountApi.updateProfile(user.id, draft),
    onSuccess: (_, draft) => {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      const patch = { nome: draft.nome || user.nome, email: draft.email || user.email };
      patchAdminUser(cache, user.id, patch);
      cache.setQueryData(['admin', 'user', user.id], { ...user, ...patch });
      cache.invalidateQueries({ queryKey: ['admin', 'profile', user.id] });
      setEdited(null);
      setDone('Cadastro atualizado.');
    },
  });

  function change(key: string, value: string) {
    setDone('');
    setEdited((current) => ({ ...(current ?? values ?? {}), [key]: value }));
    setErrors((current) => {
      if (!current[key]) return current;
      const next = { ...current };
      delete next[key];
      return next;
    });
  }

  function submit() {
    if (!values) return;
    if (basicOnly) {
      if (!(values.nome ?? '').trim()) return setErrors({ nome: 'Informe o nome.' });
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test((values.email ?? '').trim())) return setErrors({ email: 'Informe um e-mail válido.' });
    } else {
      const found = validateAccount(values, { address: true, password: false });
      setErrors(found);
      if (Object.keys(found).length) return;
    }
    save.mutate(values);
  }

  return (
    <Block icon={UserRound} title="Dados cadastrais">
      {profile.isPending ? (
        <View style={styles.history}>
          <Skeleton height={48} rounded={radius.md} />
          <Skeleton height={48} rounded={radius.md} />
        </View>
      ) : profile.isError || !values ? (
        <Notice tone="error" message={profile.error?.message ?? 'Não foi possível carregar o cadastro.'} actionLabel="Tentar de novo" onAction={() => profile.refetch()} />
      ) : (
        <>
          {basicOnly ? (
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
              <PersonFields values={values} errors={errors} onChange={change} lockType />
              <AddressFields values={values} errors={errors} onChange={change} />
            </>
          )}
          {save.isError ? <Notice tone="error" message={save.error.message} /> : null}
          {done ? <Notice tone="success" message={done} /> : null}
          <Button label="Salvar cadastro" loading={save.isPending} disabled={!edited} onPress={submit} />
        </>
      )}
    </Block>
  );
}

function Delete({ user }: { user: AdminUser }) {
  const { colors } = useTheme();
  const cache = useQueryClient();
  const [typed, setTyped] = useState('');
  const remove = useMutation({
    mutationFn: () => adminApi.deleteUser(user.id),
    onSuccess: () => {
      cache.invalidateQueries({ queryKey: usersKey });
      showDialog({ title: 'Conta excluída', message: `${user.email} foi excluída.` });
      router.back();
    },
  });
  const matches = typed.trim().toLowerCase() === user.email.toLowerCase();
  return (
    <Block icon={Trash2} title="Excluir conta">
      <AppText color="muted">
        Exclusão definitiva. Contas com anúncios, planos ou pagamentos não podem ser excluídas: bloqueie-as. Digite o
        e-mail da conta para confirmar.
      </AppText>
      <TextField
        label="E-mail da conta"
        value={typed}
        onChangeText={setTyped}
        placeholder={user.email}
        autoCapitalize="none"
        autoCorrect={false}
        keyboardType="email-address"
      />
      {remove.isError ? (
        <Notice tone="error" message={`${remove.error.message} Se a conta tiver anúncios ou planos, bloqueie em vez de excluir.`} />
      ) : null}
      <Button
        label="Excluir definitivamente"
        variant="ghost"
        icon={<Trash2 size={16} color={colors.red} />}
        disabled={!matches}
        loading={remove.isPending}
        onPress={() =>
          showDialog({
            title: 'Excluir esta conta?',
            message: `${user.email} será apagada e não pode ser recuperada.`,
            actions: [
              { label: 'Cancelar', kind: 'cancel' },
              { label: 'Excluir', kind: 'destructive', onPress: () => remove.mutate() },
            ],
          })
        }
      />
    </Block>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  flex: { flex: 1 },
  head: { gap: space.xs },
  tags: { flexDirection: 'row', gap: space.sm, marginTop: space.xs },
  block: { gap: space.md },
  blockTitle: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  subscription: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  history: { gap: space.xs },
});
