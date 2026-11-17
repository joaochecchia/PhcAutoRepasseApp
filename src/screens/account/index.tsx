import { useMutation, useQueryClient } from '@tanstack/react-query';
import * as Haptics from 'expo-haptics';
import { router, type Href } from 'expo-router';
import * as Sharing from 'expo-sharing';
import { ChevronRight, Download, KeyRound, ShieldCheck, Trash2, UserRound, WifiOff, type LucideIcon } from 'lucide-react-native';
import { useRef, useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, View, type ScrollViewInstance } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { accountApi, draftFromProfile, type AccountDraft } from '@/api/account';
import { apiOrigin } from '@/api/client';
import { AddressFields, PersonFields, validateAccount } from '@/components/account-fields';
import { AppText } from '@/components/app-text';
import { Button } from '@/components/button';
import { Notice } from '@/components/notice';
import { ProfilePhotoPicker } from '@/components/profile-photo';
import { Skeleton } from '@/components/skeleton';
import { StateView } from '@/components/state-view';
import { accountQueryKey, useAccount } from '@/hooks/use-account';
import { useTheme } from '@/hooks/use-theme';
import { radius, space } from '@/theme';

/**
 * Minha conta (ProfilePage do site, modo conta): dados, foto, senha e os direitos do titular (LGPD).
 * `fromAnnounce`: aberta pelo Anunciar para corrigir os dados do anunciante; ao salvar, volta para o anúncio.
 */
export function AccountScreen({ fromAnnounce }: { fromAnnounce: boolean }) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const queryClient = useQueryClient();
  const account = useAccount();
  const usuarioId = account.usuarioId;
  // O formulário nasce do perfil; depois da primeira edição, recarregar o perfil não apaga o que está sendo digitado.
  const [edited, setEdited] = useState<AccountDraft | null>(null);
  const values = edited ?? (account.data ? draftFromProfile(account.data) : null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saved, setSaved] = useState(false);
  const [photoRevision, setPhotoRevision] = useState(() => Date.now());
  const scroll = useRef<ScrollViewInstance>(null);

  const save = useMutation({
    mutationFn: (draft: AccountDraft) => accountApi.updateProfile(usuarioId!, draft),
    onSuccess: (profile) => {
      queryClient.setQueryData(accountQueryKey(usuarioId), profile);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      if (fromAnnounce) return router.back();
      setSaved(true);
    },
    onError: () => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error),
  });
  const photo = useMutation({
    mutationFn: (file: Parameters<typeof accountApi.uploadPhoto>[1]) => accountApi.uploadPhoto(usuarioId!, file),
    onSuccess: () => {
      setPhotoRevision(Date.now());
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    },
  });
  const download = useMutation({
    mutationFn: async () => {
      const uri = await accountApi.downloadMyData(usuarioId!);
      if (!(await Sharing.isAvailableAsync())) throw new Error('Este aparelho não permite salvar ou compartilhar o arquivo.');
      await Sharing.shareAsync(uri, { mimeType: 'application/json', dialogTitle: 'Meus dados na PHC Auto', UTI: 'public.json' });
    },
  });

  function change(key: string, value: string) {
    setEdited((current) => ({ ...(current ?? values ?? {}), [key]: value }));
    if (errors[key]) setErrors(({ [key]: _fixed, ...rest }) => rest);
    setSaved(false);
    save.reset();
  }

  function submit() {
    if (!values) return;
    const found = validateAccount(values, { address: true, password: false });
    setErrors(found);
    if (Object.keys(found).length) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      scroll.current?.scrollTo({ y: 0, animated: true });
      return;
    }
    save.mutate(values);
  }

  if (!usuarioId)
    return (
      <View style={[styles.root, { backgroundColor: colors.bg }]}>
        <StateView icon={UserRound} title="Entre na sua conta" message="Para ver e editar seus dados." actionLabel="Entrar" onAction={() => router.push('/entrar')} />
      </View>
    );
  if (account.isError && !account.data)
    return (
      <View style={[styles.root, { backgroundColor: colors.bg }]}>
        <StateView
          icon={WifiOff}
          title="Não carregamos seus dados"
          message={account.error.message}
          actionLabel="Tentar de novo"
          onAction={() => account.refetch()}
        />
      </View>
    );
  if (!values || !account.data)
    return (
      <View style={[styles.root, styles.content, { backgroundColor: colors.bg }]}>
        <Skeleton width={72} height={72} rounded={36} />
        {[0, 1, 2, 3, 4].map((key) => (
          <Skeleton key={key} height={52} />
        ))}
      </View>
    );

  const hasPassword = account.data.possuiSenhaLocal;
  const missingAddress = !account.data.endereco;
  const errorCount = Object.keys(errors).length;

  return (
    <KeyboardAvoidingView style={[styles.root, { backgroundColor: colors.bg }]} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView ref={scroll} keyboardShouldPersistTaps="handled" contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + space.xxxl }]}>
        <AppText color="muted">
          {fromAnnounce
            ? 'Confira os dados do anunciante. Eles ficam no cadastro; o anúncio público mostra só a cidade do veículo.'
            : hasPassword
              ? 'Consulte e atualize seus dados, sua foto e sua senha.'
              : 'Consulte e atualize os dados e a foto da sua conta Google.'}
        </AppText>

        <ProfilePhotoPicker
          file={null}
          currentUri={`${apiOrigin}/api/v1/perfis/${usuarioId}/foto?v=${photoRevision}`}
          onChange={(file) => file && photo.mutate(file)}
          hint={photo.isPending ? 'Enviando a foto…' : 'Ela aparece nos seus anúncios e conversas.'}
        />
        {photo.isError ? <Notice tone="error" message={photo.error.message} /> : null}
        {photo.isSuccess ? <Notice tone="success" message="Foto atualizada." /> : null}

        {missingAddress ? <Notice tone="info" message="Sua conta ainda não tem endereço. Ele é obrigatório para anunciar." /> : null}
        {errorCount ? (
          <Notice tone="error" message={errorCount === 1 ? 'Confira o campo destacado.' : `Confira os ${errorCount} campos destacados.`} />
        ) : null}

        <SectionTitle title="Dados pessoais" />
        <PersonFields values={values} errors={errors} onChange={change} lockType />
        <SectionTitle title="Endereço" note="Faz parte do cadastro e não aparece nos anúncios." />
        <AddressFields values={values} errors={errors} onChange={change} />

        {save.isError ? <Notice tone="error" message={save.error.message} /> : null}
        {saved ? <Notice tone="success" message="Dados atualizados." /> : null}
        <Button label={fromAnnounce ? 'Salvar e voltar ao anúncio' : 'Salvar alterações'} onPress={submit} loading={save.isPending} />

        {fromAnnounce ? null : (
          <>
            <SectionTitle title="Segurança" />
            <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              {hasPassword ? (
                <Row
                  icon={KeyRound}
                  label="Alterar senha"
                  note="Enviamos um código para o seu e-mail antes."
                  onPress={() => router.push({ pathname: '/redefinir-senha', params: { origem: 'perfil' } })}
                />
              ) : (
                <Row icon={KeyRound} label="Conta Google" note="Você entra com o Google; esta conta não tem senha." />
              )}
            </View>

            <SectionTitle title="Privacidade e seus dados" />
            <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <Row
                icon={Download}
                label={download.isPending ? 'Gerando o arquivo…' : 'Baixar meus dados'}
                note="Arquivo com tudo o que guardamos: conta, anúncios, planos, pagamentos e acessos."
                onPress={download.isPending ? undefined : () => download.mutate()}
              />
              <Divider />
              <Row icon={ShieldCheck} label="Como tratamos seus dados" onPress={() => router.push('/privacidade' as Href)} />
              <Divider />
              <Row
                icon={Trash2}
                label="Excluir minha conta"
                note="Apaga seu perfil e todos os seus anúncios."
                danger
                onPress={() => router.push({ pathname: '/minha-conta/excluir', params: { senha: hasPassword ? '1' : '0' } })}
              />
            </View>
            {download.isError ? <Notice tone="error" message={download.error.message} /> : null}
          </>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function SectionTitle({ title, note }: { title: string; note?: string }) {
  return (
    <View style={styles.sectionTitle}>
      <AppText variant="title" accessibilityRole="header">
        {title}
      </AppText>
      {note ? (
        <AppText variant="caption" color="muted">
          {note}
        </AppText>
      ) : null}
    </View>
  );
}

function Row({
  icon: Icon,
  label,
  note,
  onPress,
  danger,
}: {
  icon: LucideIcon;
  label: string;
  note?: string;
  onPress?: () => void;
  danger?: boolean;
}) {
  const { colors } = useTheme();
  return (
    <Pressable
      onPress={onPress}
      disabled={!onPress}
      accessibilityRole={onPress ? 'button' : 'text'}
      accessibilityLabel={note ? `${label}. ${note}` : label}
      style={({ pressed }) => [styles.row, pressed && { backgroundColor: colors.subtle }]}>
      <Icon size={20} color={danger ? colors.red : colors.text} />
      <View style={styles.flex}>
        <AppText variant="bodyStrong" color={danger ? 'red' : 'text'}>
          {label}
        </AppText>
        {note ? (
          <AppText variant="caption" color="muted">
            {note}
          </AppText>
        ) : null}
      </View>
      {onPress ? <ChevronRight size={18} color={colors.muted} /> : null}
    </Pressable>
  );
}

function Divider() {
  const { colors } = useTheme();
  return <View style={[styles.divider, { backgroundColor: colors.border }]} />;
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  flex: { flex: 1 },
  content: { padding: space.lg, gap: space.lg },
  sectionTitle: { gap: space.xs, marginTop: space.md },
  card: { borderRadius: radius.lg, borderWidth: StyleSheet.hairlineWidth, overflow: 'hidden' },
  row: { flexDirection: 'row', alignItems: 'center', gap: space.md, paddingHorizontal: space.lg, minHeight: 56, paddingVertical: space.md },
  divider: { height: StyleSheet.hairlineWidth, marginLeft: space.lg + 20 + space.md },
});
