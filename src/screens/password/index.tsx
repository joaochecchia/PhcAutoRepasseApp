import * as Haptics from 'expo-haptics';
import { router } from 'expo-router';
import { CheckCircle2, KeyRound, MailCheck } from 'lucide-react-native';
import { useEffect, useRef, useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import Animated, { FadeIn, ReduceMotion, SlideInRight } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { accountApi } from '@/api/account';
import { authApi } from '@/api/auth';
import { passwordCriteria, PasswordCriteria } from '@/components/account-fields';
import { AppText } from '@/components/app-text';
import { Button } from '@/components/button';
import { Notice } from '@/components/notice';
import { TextField } from '@/components/text-field';
import { useTheme } from '@/hooks/use-theme';
import { fonts, radius, space } from '@/theme';

type Step = 'identify' | 'code' | 'password' | 'done';

/**
 * Nova senha, como no site (ResetPasswordPage): o código por e-mail confirma a identidade, depois a senha nova.
 * `change`: troca de quem está logado (o código vai para o e-mail da conta). Trocar a senha encerra as sessões,
 * então no fim a pessoa entra de novo.
 */
export function PasswordScreen({ change }: { change: boolean }) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const [step, setStep] = useState<Step>(change ? 'code' : 'identify');
  const [email, setEmail] = useState('');
  const [challengeId, setChallengeId] = useState('');
  const [masked, setMasked] = useState('');
  const [codigo, setCodigo] = useState('');
  const [token, setToken] = useState('');
  const [senha, setSenha] = useState('');
  const [confirmacao, setConfirmacao] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const started = useRef(false);

  function fail(message: string) {
    setError(message);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
  }

  async function sendCode() {
    if (!change && !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email.trim())) return fail('Informe o e-mail da sua conta.');
    setBusy(true);
    setError('');
    try {
      const response = change ? await accountApi.requestChange() : await accountApi.requestReset(email);
      if (!response.challengeId) throw new Error('Não foi possível enviar o código. Tente de novo.');
      setChallengeId(response.challengeId);
      setMasked(response.emailMascarado || 'seu e-mail');
      setCodigo('');
      setStep('code');
    } catch (reason) {
      if (!change) setStep('identify');
      fail(reason instanceof Error ? reason.message : 'Não foi possível enviar o código.');
    } finally {
      setBusy(false);
    }
  }

  // Na troca, o e-mail é o da conta: o código sai assim que a tela abre.
  useEffect(() => {
    if (!change || started.current) return;
    started.current = true;
    void sendCode();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [change]);

  async function checkCode(value = codigo) {
    if (value.length !== 6 || busy) return;
    setBusy(true);
    setError('');
    try {
      const response = change ? await accountApi.authorizeChange(challengeId, value) : await accountApi.authorizeReset(challengeId, value);
      if (!response.token) throw new Error('Código inválido ou expirado.');
      setToken(response.token);
      setCodigo('');
      setStep('password');
    } catch (reason) {
      setCodigo('');
      fail(reason instanceof Error ? reason.message : 'Código inválido ou expirado.');
    } finally {
      setBusy(false);
    }
  }

  async function savePassword() {
    if (!passwordCriteria.every(([, test]) => test(senha))) return fail('A senha não atende a todos os critérios.');
    if (senha !== confirmacao) return fail('As senhas não coincidem.');
    setBusy(true);
    setError('');
    try {
      await accountApi.confirmPassword(token, senha, confirmacao);
      setToken('');
      setSenha('');
      setConfirmacao('');
      // A troca encerra as sessões no servidor; aqui também.
      if (change) await authApi.logout().catch(() => undefined);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setStep('done');
    } catch (reason) {
      fail(reason instanceof Error ? reason.message : 'A autorização expirou. Peça um novo código.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <KeyboardAvoidingView style={[styles.root, { backgroundColor: colors.bg }]} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + space.xxl }]}>
        {step === 'identify' ? (
          <Animated.View key="identify" entering={FadeIn.duration(200)} style={styles.step}>
            <Icon icon={KeyRound} />
            <Heading title="Esqueceu a senha?" text="Informe o e-mail da conta. Enviamos um código para confirmar que é você." />
            <TextField
              label="E-mail"
              value={email}
              onChangeText={(v) => {
                setEmail(v);
                setError('');
              }}
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
              autoComplete="email"
              textContentType="username"
              returnKeyType="send"
              onSubmitEditing={sendCode}
            />
            <Button label="Enviar código" onPress={sendCode} loading={busy} />
          </Animated.View>
        ) : null}

        {step === 'code' ? (
          <Animated.View key="code" entering={SlideInRight.duration(260).reduceMotion(ReduceMotion.System)} style={styles.step}>
            <Icon icon={MailCheck} />
            <Heading
              title="Confira seu e-mail"
              text={masked ? `Digite o código de 6 dígitos enviado para ${masked}.` : 'Enviando o código para o e-mail da conta…'}
            />
            <TextInput
              value={codigo}
              onChangeText={(text) => {
                const digits = text.replace(/\D/g, '').slice(0, 6);
                setCodigo(digits);
                setError('');
                if (digits.length === 6) checkCode(digits);
              }}
              autoFocus={!change}
              keyboardType="number-pad"
              textContentType="oneTimeCode"
              autoComplete="one-time-code"
              maxLength={6}
              placeholder="000000"
              placeholderTextColor={colors.border}
              accessibilityLabel="Código de verificação de 6 dígitos"
              editable={!busy && Boolean(challengeId)}
              style={[styles.code, { color: colors.text, borderColor: error ? colors.red : colors.border, backgroundColor: colors.surface }]}
            />
            <Button label="Confirmar código" onPress={() => checkCode()} loading={busy} disabled={codigo.length !== 6} />
            <Button label="Enviar outro código" variant="ghost" onPress={sendCode} disabled={busy} />
            {change ? null : (
              <Button
                label="Usar outro e-mail"
                variant="ghost"
                onPress={() => {
                  setStep('identify');
                  setError('');
                }}
              />
            )}
          </Animated.View>
        ) : null}

        {step === 'password' ? (
          <Animated.View key="password" entering={SlideInRight.duration(260).reduceMotion(ReduceMotion.System)} style={styles.step}>
            <Icon icon={KeyRound} />
            <Heading title="Crie a nova senha" text="Use uma senha só para a PHC Auto." />
            <TextField
              label="Nova senha"
              value={senha}
              onChangeText={(v) => {
                setSenha(v);
                setError('');
              }}
              secure
              autoComplete="new-password"
              textContentType="newPassword"
            />
            <PasswordCriteria value={senha} />
            <TextField
              label="Confirme a nova senha"
              value={confirmacao}
              onChangeText={(v) => {
                setConfirmacao(v);
                setError('');
              }}
              secure
              autoComplete="new-password"
              textContentType="newPassword"
              returnKeyType="done"
              onSubmitEditing={savePassword}
            />
            <Button label="Salvar nova senha" onPress={savePassword} loading={busy} />
          </Animated.View>
        ) : null}

        {step === 'done' ? (
          <Animated.View key="done" entering={FadeIn.duration(220)} style={styles.step}>
            <View style={[styles.icon, { backgroundColor: colors.dealTint }]}>
              <CheckCircle2 size={28} color={colors.deal} />
            </View>
            <Heading title="Senha alterada" text="Entre de novo com a nova senha. Por segurança, as outras sessões da conta foram encerradas." />
            <Button label="Entrar" onPress={() => (change ? router.replace('/entrar') : router.back())} />
          </Animated.View>
        ) : null}

        {error ? <Notice tone="error" message={error} /> : null}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function Icon({ icon: Glyph }: { icon: typeof KeyRound }) {
  const { colors } = useTheme();
  return (
    <View style={[styles.icon, { backgroundColor: colors.redTint }]}>
      <Glyph size={26} color={colors.red} />
    </View>
  );
}

function Heading({ title, text }: { title: string; text: string }) {
  return (
    <View style={styles.heading}>
      <AppText variant="display" accessibilityRole="header">
        {title}
      </AppText>
      <AppText color="muted">{text}</AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  content: { padding: space.lg, gap: space.xl },
  step: { gap: space.lg },
  heading: { gap: space.xs },
  icon: { width: 56, height: 56, borderRadius: 28, alignItems: 'center', justifyContent: 'center' },
  code: {
    fontFamily: fonts.heading,
    fontSize: 32,
    letterSpacing: 14,
    textAlign: 'center',
    borderWidth: 1,
    borderRadius: radius.md,
    paddingVertical: space.lg,
  },
});
