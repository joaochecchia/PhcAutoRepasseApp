import { useMutation } from '@tanstack/react-query';
import * as Haptics from 'expo-haptics';
import { router, useLocalSearchParams } from 'expo-router';
import { CircleCheck, Flag } from 'lucide-react-native';
import { useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { reportsApi, type ReportReason, type ReportType } from '@/api/reports';
import { AppText } from '@/components/app-text';
import { Button } from '@/components/button';
import { Notice } from '@/components/notice';
import { StateView } from '@/components/state-view';
import { TextField } from '@/components/text-field';
import { reportReasons } from '@/data/reports';
import { useSession } from '@/hooks/use-session';
import { useTheme } from '@/hooks/use-theme';
import { radius, space, touch } from '@/theme';

const MAX_DETAIL = 500;
const subjectLabel: Record<ReportType, string> = { ANUNCIO: 'Anúncio', MENSAGEM: 'Mensagem', ANUNCIANTE: 'Anunciante' };

/**
 * Denúncia de anúncio, de mensagem do chat ou de quem anuncia (folha modal). A equipe analisa no painel; a outra pessoa
 * não sabe quem denunciou. Parâmetros: tipo (ANUNCIO | MENSAGEM | ANUNCIANTE), alvo (id do anúncio, da mensagem ou da
 * conta) e assunto (o que a pessoa vê).
 */
export function ReportScreen() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const signedIn = useSession().status === 'authenticated';
  const params = useLocalSearchParams<{ tipo?: string; alvo?: string; assunto?: string }>();
  const tipo: ReportType | null =
    params.tipo === 'ANUNCIO' || params.tipo === 'MENSAGEM' || params.tipo === 'ANUNCIANTE' ? params.tipo : null;
  const [motivo, setMotivo] = useState<ReportReason | null>(null);
  const [detalhe, setDetalhe] = useState('');
  const send = useMutation({
    mutationFn: () =>
      reportsApi.create({ tipo: tipo!, alvoId: params.alvo!, motivo: motivo!, detalhe: detalhe.trim() || undefined }),
    onSuccess: () => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success),
  });

  if (!tipo || !params.alvo)
    return (
      <View style={[styles.flex, { backgroundColor: colors.bg }]}>
        <StateView icon={Flag} title="Nada para denunciar" message="Abra a denúncia pelo anúncio, pela loja ou pela conversa." />
      </View>
    );
  if (!signedIn)
    return (
      <View style={[styles.flex, { backgroundColor: colors.bg }]}>
        <StateView
          icon={Flag}
          title="Entre para denunciar"
          message="A denúncia fica ligada à sua conta, para a equipe poder falar com você se precisar."
          actionLabel="Entrar"
          onAction={() => router.replace('/entrar')}
        />
      </View>
    );

  if (send.isSuccess)
    return (
      <View style={[styles.flex, styles.done, { backgroundColor: colors.bg, paddingBottom: insets.bottom + space.xl }]}>
        <CircleCheck size={44} color={colors.deal} />
        <AppText variant="title" style={styles.center} accessibilityRole="header">
          Denúncia enviada
        </AppText>
        <AppText color="muted" style={styles.center}>
          {send.data.mensagem}{' '}
          {tipo === 'MENSAGEM'
            ? 'Se a pessoa continuar incomodando, bloqueie pelo menu da conversa.'
            : tipo === 'ANUNCIANTE'
              ? 'Se não quiser mais contato, toque em Bloquear no anúncio ou na página da loja.'
              : 'Enquanto isso, não faça pagamentos antecipados nem envie dados pessoais a quem anuncia.'}
        </AppText>
        <Button label="Fechar" onPress={() => router.back()} style={styles.full} />
      </View>
    );

  const options = reportReasons.filter((reason) => reason.for.includes(tipo));
  const needsDetail = motivo === 'OUTRO' && !detalhe.trim();
  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={[styles.flex, { backgroundColor: colors.bg }]}>
      <ScrollView
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + space.xl }]}
        keyboardShouldPersistTaps="handled">
        {params.assunto ? (
          <View style={[styles.subject, { backgroundColor: colors.subtle }]}>
            <AppText variant="caption" color="muted">
              {subjectLabel[tipo]}
            </AppText>
            <AppText variant="bodyStrong" numberOfLines={4}>
              {params.assunto}
            </AppText>
          </View>
        ) : null}
        <AppText variant="heading" accessibilityRole="header">
          O que aconteceu?
        </AppText>
        <View style={styles.options} accessibilityRole="radiogroup">
          {options.map((reason) => {
            const selected = motivo === reason.value;
            return (
              <Pressable
                key={reason.value}
                accessibilityRole="radio"
                accessibilityState={{ selected, disabled: send.isPending }}
                accessibilityLabel={`${reason.label}. ${reason.hint}`}
                disabled={send.isPending}
                onPress={() => {
                  Haptics.selectionAsync();
                  setMotivo(reason.value);
                }}
                style={[
                  styles.option,
                  { borderColor: selected ? colors.red : colors.border, backgroundColor: selected ? colors.redTint : colors.surface },
                ]}>
                <View style={[styles.radio, { borderColor: selected ? colors.red : colors.muted }]}>
                  {selected ? <View style={[styles.radioDot, { backgroundColor: colors.red }]} /> : null}
                </View>
                <View style={styles.flex}>
                  <AppText variant="bodyStrong">{reason.label}</AppText>
                  <AppText variant="caption" color="muted">
                    {reason.hint}
                  </AppText>
                </View>
              </Pressable>
            );
          })}
        </View>
        <TextField
          label={motivo === 'OUTRO' ? 'Detalhes (obrigatório)' : 'Detalhes (opcional)'}
          value={detalhe}
          onChangeText={setDetalhe}
          placeholder="Ex.: pediu sinal por Pix antes de mostrar o carro"
          multiline
          maxLength={MAX_DETAIL}
          editable={!send.isPending}
        />
        <AppText variant="caption" color="muted">
          A outra pessoa não fica sabendo quem denunciou. {detalhe.length}/{MAX_DETAIL}
        </AppText>
        {send.isError ? (
          <Notice tone="error" message={send.error.message} actionLabel="Tentar de novo" onAction={() => send.mutate()} />
        ) : null}
        <Button
          label="Enviar denúncia"
          onPress={() => send.mutate()}
          loading={send.isPending}
          disabled={!motivo || needsDetail}
        />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  content: { padding: space.lg, gap: space.lg },
  subject: { padding: space.md, borderRadius: radius.md, gap: 2 },
  options: { gap: space.sm },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    minHeight: touch + space.md,
    paddingHorizontal: space.md,
    paddingVertical: space.sm,
    borderRadius: radius.md,
    borderWidth: 1,
  },
  radio: { width: 20, height: 20, borderRadius: 10, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
  radioDot: { width: 10, height: 10, borderRadius: 5 },
  done: { alignItems: 'center', justifyContent: 'center', gap: space.md, padding: space.xxl },
  center: { textAlign: 'center' },
  full: { alignSelf: 'stretch' },
});
