import * as Haptics from 'expo-haptics';
import { Image } from 'expo-image';
import { router, useFocusEffect } from 'expo-router';
import { ArrowLeft, LockKeyhole, MailCheck } from 'lucide-react-native';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  TextInput,
  View,
  type TextInputInstance,
} from 'react-native';
import Animated, {
  FadeIn,
  FadeOut,
  ReduceMotion,
  SlideInRight,
  useAnimatedStyle,
  useSharedValue,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { authApi } from '@/api/auth';
import { authHandoff } from '@/api/auth-handoff';
import { ApiError } from '@/api/client';
import { signInWithApple } from '@/api/apple';
import { signInWithGoogle } from '@/api/google';
import { AppText } from '@/components/app-text';
import { Button } from '@/components/button';
import { AppleButton } from '@/components/apple-button';
import { GoogleButton } from '@/components/google-button';
import { TextField } from '@/components/text-field';
import { useSession } from '@/hooks/use-session';
import { useTheme } from '@/hooks/use-theme';
import { fonts, radius, space } from '@/theme';

type Challenge = { id: string; email: string | null };

function errorMessage(error: unknown, fallback: string) {
  if (error instanceof ApiError) {
    if (error.status === 401) return fallback;
    return error.message;
  }
  return fallback;
}

/**
 * Entrar: e-mail e senha com verificação em duas etapas (código por e-mail) ou Google, como no site.
 * No app a sessão é sempre mantida; "confiar neste aparelho" só dispensa o código nos próximos 30 dias.
 */
export function Login() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const [email, setEmail] = useState('');
  const [senha, setSenha] = useState('');
  const [challenge, setChallenge] = useState<Challenge | null>(null);
  const [codigo, setCodigo] = useState('');
  const [confiar, setConfiar] = useState(true);
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [appleLoading, setAppleLoading] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [resendIn, setResendIn] = useState(0);
  const senhaRef = useRef<TextInputInstance>(null);
  const shake = useSharedValue(0);
  const shakeStyle = useAnimatedStyle(() => ({ transform: [{ translateX: shake.get() }] }));
  const session = useSession();
  const closed = useRef(false);

  /** Fecha o login uma vez só, venha a sessão daqui ou do cadastro aberto por cima. */
  const close = useCallback(() => {
    if (closed.current) return;
    closed.current = true;
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    router.back();
  }, []);
  useEffect(() => {
    if (session.status === 'authenticated') close();
  }, [session.status, close]);

  // Conta recém-criada que pediu o código por e-mail: abre direto na etapa do código.
  useFocusEffect(
    useCallback(() => {
      const pending = authHandoff.takePendingCode();
      if (!pending) return;
      setChallenge({ id: pending.challengeId, email: pending.email });
      setNotice(`Conta criada. Enviamos um código de 6 dígitos para ${pending.email ?? 'seu e-mail'}.`);
      setResendIn(60);
      setError('');
    }, []),
  );

  useEffect(() => {
    if (resendIn <= 0) return;
    const timer = setInterval(() => setResendIn((seconds) => Math.max(0, seconds - 1)), 1000);
    return () => clearInterval(timer);
  }, [resendIn]);

  function done() {
    close();
  }

  function fail(message: string) {
    setError(message);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    // Balanço curto no erro: diz "não foi" sem precisar ler. Some com "reduzir movimento".
    const config = { duration: 50, reduceMotion: ReduceMotion.System };
    shake.set(withSequence(withTiming(-8, config), withTiming(8, config), withTiming(-5, config), withTiming(0, config)));
  }

  async function submitCredentials() {
    if (!email.trim() || !senha) {
      fail('Informe e-mail e senha.');
      return;
    }
    setLoading(true);
    setError('');
    try {
      const outcome = await authApi.login(email, senha);
      if (outcome.kind === 'authenticated') return done();
      setChallenge({ id: outcome.challengeId, email: outcome.email });
      setNotice(`Enviamos um código de 6 dígitos para ${outcome.email ?? 'seu e-mail'}.`);
      setResendIn(60);
    } catch (requestError) {
      fail(errorMessage(requestError, 'E-mail ou senha inválidos.'));
    } finally {
      setLoading(false);
    }
  }

  async function submitCode(value = codigo) {
    if (!challenge || value.length !== 6) return;
    setLoading(true);
    setError('');
    try {
      await authApi.verifySecondFactor(challenge.id, value, confiar);
      done();
    } catch (requestError) {
      setCodigo('');
      fail(errorMessage(requestError, 'Código inválido ou expirado.'));
    } finally {
      setLoading(false);
    }
  }

  async function resend() {
    if (!challenge) return;
    setError('');
    try {
      const next = await authApi.resendSecondFactor(challenge.id);
      setChallenge({ id: next.challengeId, email: next.email });
      setCodigo('');
      setResendIn(60);
      setNotice(`Novo código enviado para ${next.email ?? 'seu e-mail'}. O anterior deixou de valer.`);
    } catch (requestError) {
      fail(errorMessage(requestError, 'Não foi possível reenviar o código.'));
    }
  }

  async function apple() {
    setAppleLoading(true);
    setError('');
    try {
      const outcome = await signInWithApple();
      if (outcome.kind === 'authenticated') return done();
      if (outcome.kind === 'new-account') {
        authHandoff.setSocial({ ticket: outcome.ticket, verifier: outcome.verifier });
        router.push('/cadastro');
      }
    } catch (requestError) {
      fail(errorMessage(requestError, 'Não foi possível entrar com Apple.'));
    } finally {
      setAppleLoading(false);
    }
  }

  async function google() {
    setGoogleLoading(true);
    setError('');
    try {
      const outcome = await signInWithGoogle();
      if (outcome.kind === 'authenticated') return done();
      if (outcome.kind === 'error') fail(outcome.message);
      if (outcome.kind === 'new-account') {
        authHandoff.setSocial({ ticket: outcome.ticket, verifier: outcome.verifier });
        router.push('/cadastro');
      }
    } catch (requestError) {
      fail(errorMessage(requestError, 'Não foi possível entrar com Google.'));
    } finally {
      setGoogleLoading(false);
    }
  }

  return (
    <KeyboardAvoidingView style={[styles.root, { backgroundColor: colors.bg }]} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + space.xxl }]}
        keyboardShouldPersistTaps="handled">
        <View style={styles.brand}>
          <Image source={require('@/assets/images/phc-auto-logo-disc.png')} style={styles.logo} accessibilityLabel="PHC Auto" />
        </View>

        {!challenge ? (
          <Animated.View key="credentials" entering={FadeIn.duration(200)} exiting={FadeOut.duration(120)} style={styles.step}>
            <View style={styles.heading}>
              <AppText variant="display" accessibilityRole="header">
                Bom te ver por aqui
              </AppText>
              <AppText color="muted">Entre para anunciar, conversar com vendedores e acompanhar suas compras.</AppText>
            </View>
            <Animated.View style={[styles.fields, shakeStyle]}>
              <TextField
                label="E-mail"
                value={email}
                onChangeText={setEmail}
                placeholder="voce@exemplo.com"
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
                autoComplete="email"
                textContentType="username"
                returnKeyType="next"
                onSubmitEditing={() => senhaRef.current?.focus()}
              />
              <TextField
                ref={senhaRef}
                label="Senha"
                value={senha}
                onChangeText={setSenha}
                secure
                autoComplete="current-password"
                textContentType="password"
                returnKeyType="go"
                onSubmitEditing={submitCredentials}
              />
            </Animated.View>
            <Pressable
              onPress={() => router.push('/redefinir-senha')}
              hitSlop={10}
              accessibilityRole="link"
              style={styles.link}>
              <AppText variant="label" color="red">
                Esqueci minha senha
              </AppText>
            </Pressable>
            <Button label="Entrar" onPress={submitCredentials} loading={loading} disabled={googleLoading || appleLoading} />
            <View style={styles.divider}>
              <View style={[styles.line, { backgroundColor: colors.border }]} />
              <AppText variant="caption" color="muted">
                ou
              </AppText>
              <View style={[styles.line, { backgroundColor: colors.border }]} />
            </View>
            <AppleButton onPress={apple} loading={appleLoading} disabled={loading || googleLoading} />
            <GoogleButton onPress={google} loading={googleLoading} disabled={loading || appleLoading} />
          </Animated.View>
        ) : (
          <Animated.View key="code" entering={SlideInRight.duration(260).reduceMotion(ReduceMotion.System)} style={styles.step}>
            <Pressable
              onPress={() => {
                setChallenge(null);
                setCodigo('');
                setNotice('');
                setError('');
              }}
              hitSlop={10}
              accessibilityRole="button"
              accessibilityLabel="Voltar para e-mail e senha"
              style={styles.back}>
              <ArrowLeft size={20} color={colors.text} />
              <AppText variant="label">E-mail e senha</AppText>
            </Pressable>
            <View style={[styles.mailIcon, { backgroundColor: colors.redTint }]}>
              <MailCheck size={26} color={colors.red} />
            </View>
            <View style={styles.heading}>
              <AppText variant="display" accessibilityRole="header">
                Confira seu e-mail
              </AppText>
              <AppText color="muted">{notice}</AppText>
            </View>
            <Animated.View style={shakeStyle}>
              <TextInput
                value={codigo}
                onChangeText={(text) => {
                  const digits = text.replace(/\D/g, '').slice(0, 6);
                  setCodigo(digits);
                  if (digits.length === 6) submitCode(digits);
                }}
                autoFocus
                keyboardType="number-pad"
                textContentType="oneTimeCode"
                autoComplete="one-time-code"
                maxLength={6}
                placeholder="000000"
                placeholderTextColor={colors.border}
                accessibilityLabel="Código de verificação de 6 dígitos"
                editable={!loading}
                style={[
                  styles.code,
                  { color: colors.text, borderColor: error ? colors.red : colors.border, backgroundColor: colors.surface },
                ]}
              />
            </Animated.View>
            <View style={[styles.trust, { backgroundColor: colors.subtle }]}>
              <View style={styles.flex}>
                <AppText variant="bodyStrong">Confiar neste aparelho</AppText>
                <AppText variant="caption" color="muted">
                  Não pedir o código aqui pelos próximos 30 dias.
                </AppText>
              </View>
              <Switch
                value={confiar}
                onValueChange={setConfiar}
                trackColor={{ true: colors.red, false: colors.border }}
                thumbColor="#ffffff"
                accessibilityLabel="Confiar neste aparelho por 30 dias"
              />
            </View>
            <Button label="Confirmar código" onPress={() => submitCode()} loading={loading} disabled={codigo.length !== 6} />
            <Button
              label={resendIn > 0 ? `Reenviar código em ${resendIn}s` : 'Reenviar código'}
              variant="ghost"
              onPress={resend}
              disabled={resendIn > 0 || loading}
            />
          </Animated.View>
        )}

        {error ? (
          <Animated.View entering={FadeIn.duration(160)} style={[styles.alert, { backgroundColor: colors.redTint }]}>
            <AppText color="red" variant="bodyStrong" accessibilityRole="alert">
              {error}
            </AppText>
          </Animated.View>
        ) : null}
        {!challenge && notice ? (
          <View style={[styles.alert, { backgroundColor: colors.subtle }]}>
            <AppText accessibilityLiveRegion="polite">{notice}</AppText>
          </View>
        ) : null}

        {!challenge ? (
          <View style={[styles.register, { borderColor: colors.border }]}>
            <View style={styles.flex}>
              <AppText variant="bodyStrong">Ainda não tem conta?</AppText>
              <AppText variant="caption" color="muted">
                Leva 2 minutos, com CPF ou CNPJ.
              </AppText>
            </View>
            <Button label="Criar conta" variant="secondary" onPress={() => router.push('/cadastro')} />
          </View>
        ) : null}

        <View style={styles.security}>
          <LockKeyhole size={14} color={colors.muted} />
          <AppText variant="caption" color="muted" style={styles.flex}>
            Sua sessão fica guardada com criptografia neste aparelho. Você continua conectado até sair.
          </AppText>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  flex: { flex: 1 },
  content: { padding: space.lg, gap: space.xl },
  brand: { alignItems: 'center', marginTop: space.sm },
  logo: { width: 64, height: 64 },
  step: { gap: space.lg },
  heading: { gap: space.xs },
  fields: { gap: space.lg },
  link: { alignSelf: 'flex-end', minHeight: 32, justifyContent: 'center' },
  divider: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  line: { flex: 1, height: StyleSheet.hairlineWidth },
  back: { flexDirection: 'row', alignItems: 'center', gap: space.xs, alignSelf: 'flex-start', minHeight: 36 },
  mailIcon: { width: 56, height: 56, borderRadius: 28, alignItems: 'center', justifyContent: 'center' },
  code: {
    fontFamily: fonts.heading,
    fontSize: 32,
    letterSpacing: 14,
    textAlign: 'center',
    borderWidth: 1,
    borderRadius: radius.md,
    paddingVertical: space.lg,
  },
  trust: { flexDirection: 'row', alignItems: 'center', gap: space.md, padding: space.lg, borderRadius: radius.lg },
  alert: { padding: space.lg, borderRadius: radius.md },
  register: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    padding: space.lg,
    borderRadius: radius.lg,
    borderWidth: 1,
  },
  security: { flexDirection: 'row', alignItems: 'flex-start', gap: space.sm },
});
