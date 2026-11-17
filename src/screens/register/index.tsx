import { useQuery } from '@tanstack/react-query';
import * as Haptics from 'expo-haptics';
import { router } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import { BadgeCheck, ExternalLink, FileText } from 'lucide-react-native';
import { useRef, useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Switch, View, type ScrollViewInstance } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { accountApi, registrationPayload, type AccountDraft } from '@/api/account';
import type { UploadFile } from '@/api/announce';
import { authApi } from '@/api/auth';
import { authHandoff } from '@/api/auth-handoff';
import { sessionStore } from '@/api/session-store';
import { AddressFields, PasswordCriteria, PersonFields, validateAccount } from '@/components/account-fields';
import { AppText } from '@/components/app-text';
import { Button } from '@/components/button';
import { showDialog } from '@/components/dialog';
import { Notice } from '@/components/notice';
import { ProfilePhotoPicker } from '@/components/profile-photo';
import { Skeleton } from '@/components/skeleton';
import { TextField } from '@/components/text-field';
import { useTheme } from '@/hooks/use-theme';
import { radius, space } from '@/theme';

const TERMS_URL = 'https://phcauto.com/documentos/termos-uso-politica-privacidade-v1.1.pdf';

/**
 * Criar conta, como no site: PF ou PJ, endereço com busca pelo CEP, foto opcional e aceite dos termos vigentes.
 * Vindo do Google ou da Apple (conta nova), não pede senha: o e-mail vem confirmado por eles. O nome também, salvo
 * quando a Apple não o envia (só na primeira autorização, e a pessoa pode omiti-lo): aí a pessoa digita.
 * Depois de criar, já entra; se o servidor pedir o código por e-mail, a tela de login abre direto no código.
 */
export function Register() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const scroll = useRef<ScrollViewInstance>(null);
  const [social] = useState(() => authHandoff.peekSocial());
  const [values, setValues] = useState<AccountDraft>({ tipoPessoa: 'PF' });
  const [photo, setPhoto] = useState<UploadFile | null>(null);
  const [accepted, setAccepted] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  // Conta já criada, mas o login seguinte falhou: não cria de novo, só leva ao login.
  const [created, setCreated] = useState(false);

  const versions = useQuery({ queryKey: ['terms-versions'], queryFn: ({ signal }) => accountApi.termsVersions(signal) });
  const socialInfo = useQuery({
    queryKey: ['social-registration', social?.ticket],
    queryFn: async ({ signal }) => {
      const info = await authApi.socialRegistrationInfo(social!.ticket, signal);
      setValues((current) => ({ ...current, nome: current.nome || info.nome, email: info.email }));
      return info;
    },
    enabled: Boolean(social),
    retry: false,
    staleTime: Infinity,
  });

  function change(key: string, value: string) {
    setValues((current) => ({ ...current, [key]: value }));
    if (errors[key]) setErrors(({ [key]: _fixed, ...rest }) => rest);
    setError('');
  }

  function fail(message: string) {
    setError(message);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
  }

  async function submit() {
    if (created) {
      router.back();
      return;
    }
    const found = validateAccount(values, { address: true, password: !social });
    setErrors(found);
    if (Object.keys(found).length) {
      fail(`Confira ${Object.keys(found).length === 1 ? 'o campo destacado' : `os ${Object.keys(found).length} campos destacados`}.`);
      scroll.current?.scrollTo({ y: 0, animated: true });
      return;
    }
    if (!accepted) return fail('Para criar a conta, aceite os Termos de Uso e a Política de Privacidade.');
    if (!versions.data) return fail('Os documentos vigentes ainda não carregaram. Tente de novo.');
    setBusy(true);
    setError('');
    try {
      if (social) {
        await authApi.socialRegister(social.ticket, social.verifier, registrationPayload(values, versions.data, false));
        authHandoff.clearSocial();
        const state = sessionStore.getState();
        if (photo && state.status === 'authenticated') {
          try {
            await accountApi.uploadPhoto(state.user.usuarioId, photo);
          } catch {
            // A conta já existe: avisa em vez de descartar a foto em silêncio.
            showDialog({ title: 'Conta criada', message: 'A foto não foi salva. Envie de novo em Menu › Minha conta.' });
          }
        }
        finish();
        return;
      }
      await accountApi.register(values, versions.data, photo);
      setCreated(true);
      const outcome = await authApi.login(values.email ?? '', values.senha ?? '');
      if (outcome.kind === 'second-factor') {
        authHandoff.setPendingCode({ challengeId: outcome.challengeId, email: outcome.email });
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        router.back();
        return;
      }
      finish();
    } catch (reason) {
      fail(
        reason instanceof Error
          ? created
            ? `Sua conta foi criada, mas não conseguimos entrar agora: ${reason.message} Toque em "Ir para o login".`
            : reason.message
          : 'Não foi possível criar sua conta.',
      );
    } finally {
      setBusy(false);
    }
  }

  /** Com a sessão aberta, a tela de login por baixo se fecha sozinha. */
  function finish() {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    router.back();
  }

  if (social && socialInfo.isError)
    return (
      <View style={[styles.root, styles.center, { backgroundColor: colors.bg }]}>
        <Notice
          tone="error"
          title="O cadastro expirou"
          message="Volte e entre de novo com Google ou Apple."
          actionLabel="Voltar"
          onAction={() => {
            authHandoff.clearSocial();
            router.back();
          }}
        />
      </View>
    );

  return (
    <KeyboardAvoidingView style={[styles.root, { backgroundColor: colors.bg }]} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView
        ref={scroll}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + space.xxl }]}>
        <View style={styles.heading}>
          <AppText variant="display" accessibilityRole="header">
            Criar sua conta
          </AppText>
          <AppText color="muted">Para comprar, conversar com vendedores e anunciar. Campos com * são obrigatórios.</AppText>
        </View>

        {social ? (
          <View style={[styles.googleBox, { backgroundColor: colors.dealTint, borderColor: colors.dealBorder }]}>
            <BadgeCheck size={20} color={colors.deal} />
            <AppText color="deal" variant="bodyStrong" style={styles.flex}>
              {socialInfo.data?.provedor === 'APPLE' ? 'Conta Apple confirmada' : 'Conta Google confirmada'}. Você não
              precisa criar senha.
            </AppText>
          </View>
        ) : null}

        <Section number="01" title="Sobre você">
          {social && socialInfo.isPending ? (
            <View style={{ gap: space.md }}>
              <Skeleton height={52} />
              <Skeleton height={52} />
            </View>
          ) : (
            <PersonFields values={values} errors={errors} onChange={change} lockEmail={Boolean(social)} />
          )}
          <ProfilePhotoPicker file={photo} onChange={setPhoto} />
        </Section>

        <Section number="02" title="Seu endereço" note="O endereço completo não aparece nos anúncios; a vitrine mostra só a cidade.">
          <AddressFields values={values} errors={errors} onChange={change} />
        </Section>

        {social ? null : (
          <Section number="03" title="Acesso à conta" note="Use uma senha só para a PHC Auto.">
            <TextField
              label="Senha *"
              value={values.senha ?? ''}
              onChangeText={(v) => change('senha', v)}
              error={errors.senha}
              secure
              autoComplete="new-password"
              textContentType="newPassword"
            />
            <PasswordCriteria value={values.senha ?? ''} />
            <TextField
              label="Confirme a senha *"
              value={values.confirmacaoSenha ?? ''}
              onChangeText={(v) => change('confirmacaoSenha', v)}
              error={errors.confirmacaoSenha}
              secure
              autoComplete="new-password"
              textContentType="newPassword"
            />
          </Section>
        )}

        <View style={[styles.terms, { backgroundColor: colors.subtle }]}>
          <View style={styles.termsHead}>
            <FileText size={20} color={colors.text} />
            <View style={styles.flex}>
              <AppText variant="bodyStrong">Termos de uso e privacidade</AppText>
              <AppText variant="caption" color="muted">
                Versão vigente: {versions.data?.versaoTermosUso ?? (versions.isError ? 'não carregou' : 'carregando…')}
              </AppText>
            </View>
          </View>
          <Pressable
            onPress={() => WebBrowser.openBrowserAsync(TERMS_URL)}
            accessibilityRole="link"
            accessibilityHint="Abre o documento em PDF"
            hitSlop={8}
            style={styles.termsLink}>
            <AppText variant="label" color="red">
              Ler os Termos e a Política de Privacidade
            </AppText>
            <ExternalLink size={14} color={colors.red} />
          </Pressable>
          <View style={styles.accept}>
            <AppText style={styles.flex}>Li o documento da versão vigente e aceito os Termos de Uso e a Política de Privacidade.</AppText>
            <Switch
              value={accepted}
              onValueChange={(next) => {
                setAccepted(next);
                setError('');
              }}
              trackColor={{ true: colors.red, false: colors.border }}
              thumbColor="#ffffff"
              accessibilityLabel="Aceito os Termos de Uso e a Política de Privacidade"
            />
          </View>
          <AppText variant="caption" color="muted">
            O momento do aceite e a versão dos documentos são registrados junto com o cadastro.
          </AppText>
          {versions.isError ? (
            <Notice tone="error" message="Não carregamos os documentos vigentes." actionLabel="Tentar de novo" onAction={() => versions.refetch()} />
          ) : null}
        </View>

        {error ? <Notice tone="error" message={error} /> : null}
        <Button
          label={created ? 'Ir para o login' : social ? 'Criar conta' : 'Criar conta e entrar'}
          onPress={submit}
          loading={busy}
          disabled={!created && (!versions.data || (Boolean(social) && !socialInfo.data))}
        />
        {social ? null : (
          <Pressable onPress={() => router.back()} accessibilityRole="button" hitSlop={8} style={styles.switch}>
            <AppText color="muted">
              Já tem conta? <AppText color="red" variant="bodyStrong">Entrar</AppText>
            </AppText>
          </Pressable>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function Section({ number, title, note, children }: { number: string; title: string; note?: string; children: React.ReactNode }) {
  const { colors } = useTheme();
  return (
    <View style={styles.section}>
      <View style={styles.sectionHead}>
        <View style={[styles.badge, { backgroundColor: colors.redTint }]}>
          <AppText variant="label" color="red">
            {number}
          </AppText>
        </View>
        <View style={styles.flex}>
          <AppText variant="title" accessibilityRole="header">
            {title}
          </AppText>
          {note ? (
            <AppText variant="caption" color="muted">
              {note}
            </AppText>
          ) : null}
        </View>
      </View>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  center: { justifyContent: 'center', padding: space.lg },
  flex: { flex: 1 },
  content: { padding: space.lg, gap: space.xxl },
  heading: { gap: space.xs },
  googleBox: { flexDirection: 'row', alignItems: 'center', gap: space.md, padding: space.lg, borderRadius: radius.lg, borderWidth: 1 },
  section: { gap: space.lg },
  sectionHead: { flexDirection: 'row', gap: space.md, alignItems: 'flex-start' },
  badge: { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center', marginTop: 2 },
  terms: { gap: space.md, padding: space.lg, borderRadius: radius.lg },
  termsHead: { flexDirection: 'row', gap: space.md, alignItems: 'center' },
  termsLink: { flexDirection: 'row', alignItems: 'center', gap: space.xs, minHeight: 32 },
  accept: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  switch: { alignSelf: 'center', minHeight: 44, justifyContent: 'center' },
});
