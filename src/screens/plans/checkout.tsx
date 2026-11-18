import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import * as Haptics from 'expo-haptics';
import { router, Stack, useLocalSearchParams, usePreventRemove } from 'expo-router';
import { ArrowRight, CircleAlert, CircleCheck, LockKeyhole, RefreshCw } from 'lucide-react-native';
import { useState } from 'react';
import { ActivityIndicator, KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Switch, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { CardFlowError } from '@/api/cielo';
import {
  plansApi,
  type MetodoPagamento,
  type PaymentCharge,
  type Periodicidade,
  type SubscriptionSummary,
} from '@/api/plans';
import { AppText } from '@/components/app-text';
import { Button } from '@/components/button';
import { ChoiceRow } from '@/components/choice-row';
import { Notice } from '@/components/notice';
import { BoletoBox } from '@/components/payment/boleto-box';
import { CardForm } from '@/components/payment/card-form';
import { MethodPicker } from '@/components/payment/method-picker';
import { PixBox } from '@/components/payment/pix-box';
import { SupportWhatsApp } from '@/components/payment/support-whatsapp';
import { Skeleton } from '@/components/skeleton';
import { StateView } from '@/components/state-view';
import { showDialog } from '@/components/dialog';
import { formatDate, money, periodLabel, priceOf } from '@/data/plans';
import { useCardPayment, type PaymentStep } from '@/hooks/use-card-payment';
import { useSession } from '@/hooks/use-session';
import { useTheme } from '@/hooks/use-theme';
import { radius, space, touch } from '@/theme';
import { cardError, clearSensitive, emptyCard, isCardMethod, updateCard, type Card } from '@/utils/card';

type Target = {
  codigo: string;
  nome: string;
  periodicidade: Periodicidade;
  valorCentavos: number;
  renovacao: boolean;
  /** Renovação automática que o banco não aprovou: a pessoa confirma com as condições contratadas. */
  confirmacao?: { parcelas: number };
};

const MAX_INSTALLMENTS = 12;
const renewable = (p: Periodicidade) => p === 'MENSAL' || p === 'ANUAL';
const waiting = (status: PaymentCharge['status']) => status === 'INICIADA' || status === 'PENDENTE';
/** Boleto emitido: a compensação leva dias, então a tela não fica consultando a operadora. */
const openBoleto = (charge: PaymentCharge) => charge.metodo === 'BOLETO' && waiting(charge.status) && Boolean(charge.boleto);
/** Valor aproximado de cada parcela; a operadora faz a divisão exata. */
const installmentLabel = (total: number, n: number) =>
  n === 1 ? `À vista, ${money(total)}` : `${n}x de ${money(Math.round(total / n))} sem juros`;

function methodHint(metodo: MetodoPagamento, periodicidade: Periodicidade | undefined) {
  if (metodo === 'PIX') return 'QR Code na hora';
  if (metodo === 'BOLETO') return 'Até 3 dias úteis';
  if (metodo === 'CARTAO_DEBITO') return 'Visa, Master, Elo';
  return periodicidade === 'ANUAL' ? 'Até 12x sem juros' : periodicidade && renewable(periodicidade) ? 'Renovação automática' : 'À vista';
}

/**
 * Pagamento de plano (PlanCheckout do site). Preço, meios de pagamento e cobrança vêm do backend; o cartão vai do
 * aparelho direto para a Cielo. `modo`: nova assinatura, "confirmar" a renovação recusada ou "retomar" o Pix ou
 * boleto em aberto de Seu plano.
 */
export function PlanCheckoutScreen() {
  const params = useLocalSearchParams<{ plano?: string; periodicidade?: Periodicidade; modo?: 'confirmar' | 'retomar' }>();
  const session = useSession();
  const signedIn = session.status === 'authenticated';
  const plans = useQuery({ queryKey: ['plans'], queryFn: ({ signal }) => plansApi.list(signal) });
  const internal = useQuery({
    queryKey: ['plans-internal', signedIn],
    queryFn: ({ signal }) => plansApi.internal(signal),
    enabled: signedIn,
  });
  const mine = useQuery({ queryKey: ['subscription'], queryFn: ({ signal }) => plansApi.mine(signal), enabled: signedIn });

  if (!signedIn)
    return (
      <StateView
        icon={LockKeyhole}
        title="Entre na sua conta"
        message="O plano fica na sua conta de anunciante."
        actionLabel="Entrar"
        onAction={() => router.push('/entrar')}
      />
    );
  if (plans.isPending || mine.isPending) return <Loading />;
  if (plans.isError || mine.isError)
    return (
      <StateView
        icon={CircleAlert}
        title="Não carregamos o pagamento"
        message={(plans.error ?? mine.error)?.message}
        actionLabel="Tentar de novo"
        onAction={() => {
          plans.refetch();
          mine.refetch();
        }}
      />
    );

  const all = [...plans.data, ...(internal.data ?? [])];
  const current = mine.data.atual;
  let target: Target | null = null;
  if (params.modo === 'confirmar' && mine.data.recorrencia) {
    const renewal = mine.data.recorrencia;
    target = {
      codigo: renewal.planoCodigo,
      nome: all.find((plan) => plan.codigo === renewal.planoCodigo)?.nome ?? current?.planoNome ?? 'Plano',
      periodicidade: renewal.periodicidade,
      valorCentavos: renewal.valorCentavos,
      renovacao: current?.planoCodigo === renewal.planoCodigo,
      confirmacao: { parcelas: renewal.parcelas },
    };
  } else if (params.modo !== 'retomar' && params.plano && params.periodicidade) {
    const plan = all.find((item) => item.codigo === params.plano);
    const valor = plan ? priceOf(plan, params.periodicidade) : null;
    if (plan && valor != null)
      target = {
        codigo: plan.codigo,
        nome: plan.nome,
        periodicidade: params.periodicidade,
        valorCentavos: valor,
        renovacao: current?.planoCodigo === plan.codigo,
      };
  }
  const resume = params.modo === 'retomar' ? mine.data.cobrancaPendente : null;
  if (!target && !resume)
    return (
      <StateView
        icon={CircleAlert}
        title="Nada para pagar aqui"
        message="Este plano ou cobrança não está mais disponível. Escolha de novo em Planos."
        actionLabel="Ver planos"
        onAction={() => router.back()}
      />
    );
  return <Checkout target={target} resume={resume} />;
}

function Loading() {
  return (
    <View style={styles.loading}>
      <Skeleton height={88} rounded={radius.lg} />
      <Skeleton height={160} rounded={radius.lg} />
    </View>
  );
}

function Checkout({ target, resume }: { target: Target | null; resume: PaymentCharge | null }) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const queryClient = useQueryClient();
  const card$ = useCardPayment();
  const confirming = Boolean(target?.confirmacao);
  const [metodo, setMetodo] = useState<MetodoPagamento>(confirming ? 'CARTAO_CREDITO' : 'PIX');
  const [parcelas, setParcelas] = useState(target?.confirmacao?.parcelas ?? 1);
  const [autoRenew, setAutoRenew] = useState(true);
  const [card, setCard] = useState<Card>(emptyCard);
  const [step, setStep] = useState<PaymentStep>('');
  const [error, setError] = useState('');
  const [started, setStarted] = useState<PaymentCharge | null>(resume);
  const [subscription, setSubscription] = useState<SubscriptionSummary | null>(null);

  // Até a resposta chegar (ou se falhar), só o Pix, que vale para todas as contas.
  const methods = useQuery({
    queryKey: ['payment-methods'],
    queryFn: ({ signal }) => plansApi.paymentMethods(signal),
    staleTime: 5 * 60_000,
  });
  const allowed: MetodoPagamento[] = methods.data?.length ? methods.data : ['PIX'];
  const chosen = allowed.includes(metodo) ? metodo : 'PIX';

  // Pix e respostas sem conclusão são acompanhados até a operadora decidir.
  const polling = Boolean(started && waiting(started.status) && !openBoleto(started));
  const polled = useQuery({
    queryKey: ['plan-charge', started?.id],
    queryFn: async ({ signal }) => {
      const next = await plansApi.charge(started!.id, signal);
      if (next.status === 'CONFIRMADA') {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        queryClient.invalidateQueries({ queryKey: ['subscription'] });
      }
      return next;
    },
    enabled: polling,
    refetchInterval: (query) => (query.state.data && !waiting(query.state.data.status) ? false : 5000),
  });
  const charge = started && polled.data?.id === started.id ? polled.data : started;
  const status = charge?.status;

  const credit = chosen === 'CARTAO_CREDITO';
  const canInstall = credit && target?.periodicidade === 'ANUAL';
  const installments = canInstall ? parcelas : 1;
  const canRenew = credit && Boolean(target && renewable(target.periodicidade));
  const renews = canRenew && autoRenew;

  const pay = useMutation({
    mutationFn: async () => {
      if (!target) throw new Error('Escolha o plano de novo.');
      const isCard = isCardMethod(chosen);
      const problem = isCard ? cardError(card, chosen) : '';
      if (problem) throw new CardFlowError(problem);
      const prepared = isCard ? await card$.prepare(card, chosen, target.valorCentavos, installments, setStep) : null;
      setStep('operadora');
      return plansApi.checkout({
        plano: target.codigo,
        periodicidade: target.periodicidade,
        metodo: chosen,
        cartao: prepared?.cartao,
        autenticacao3ds: prepared?.autenticacao3ds,
        parcelas: installments > 1 ? installments : undefined,
        renovacaoAutomatica: renews || undefined,
      });
    },
    onSuccess: (result) => {
      setStarted(result.cobranca);
      setSubscription(result.assinatura);
      setCard(clearSensitive);
      if (result.cobranca.status === 'CONFIRMADA') Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      queryClient.invalidateQueries({ queryKey: ['subscription'] });
    },
    onError: (reason) => {
      setError(reason instanceof Error ? reason.message : 'Não foi possível iniciar o pagamento. Tente de novo.');
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    },
    onSettled: () => setStep(''),
  });
  const sending = pay.isPending;

  // Sair no meio do envio deixaria a cobrança sem acompanhamento na tela.
  usePreventRemove(sending, () =>
    showDialog({ title: 'Pagamento em andamento', message: 'Aguarde a resposta da operadora antes de sair.' }),
  );

  function retry(next?: MetodoPagamento) {
    setStarted(null);
    setSubscription(null);
    setError('');
    setCard((current) => ({ ...current, codigoSeguranca: '' }));
    if (next) setMetodo(next);
  }

  const title =
    status === 'CONFIRMADA'
      ? 'Pagamento confirmado'
      : charge?.metodo === 'PIX' && waiting(charge.status)
        ? 'Pague com Pix'
        : charge && openBoleto(charge)
          ? 'Pague o boleto'
          : charge && !waiting(charge.status)
            ? 'Pagamento não concluído'
            : charge
              ? 'Processando pagamento'
              : confirming
                ? 'Confirmar renovação'
                : `Assinar ${target?.nome ?? 'plano'}`;

  const sendingLabel =
    chosen === 'PIX'
      ? 'Gerando QR Code…'
      : chosen === 'BOLETO'
        ? 'Gerando boleto…'
        : step === 'banco'
          ? 'Aguardando confirmação do seu banco…'
          : step === 'token'
            ? 'Protegendo os dados do cartão…'
            : 'Confirmando com a operadora…';
  const payLabel = !target
    ? ''
    : chosen === 'PIX'
      ? 'Gerar Pix'
      : chosen === 'BOLETO'
        ? 'Gerar boleto'
        : installments > 1
          ? `Pagar ${installmentLabel(target.valorCentavos, installments)}`
          : `Pagar ${money(target.valorCentavos)}`;

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: colors.bg }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <Stack.Screen options={{ title, gestureEnabled: !sending }} />
      <ScrollView
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + space.xxl }]}>
        <View style={[styles.summary, { backgroundColor: colors.subtle }]}>
          <View style={styles.flex}>
            <AppText variant="overline" color="muted">
              {target
                ? confirming
                  ? 'Confirmar renovação'
                  : target.renovacao
                    ? 'Renovação'
                    : 'Plano escolhido'
                : 'Cobrança em aberto'}
            </AppText>
            <AppText variant="heading">
              {target ? target.nome : `${charge?.metodo === 'BOLETO' ? 'Boleto' : 'Pix'} gerado em ${formatDate(charge?.criadoEm ?? null)}`}
            </AppText>
            {target ? (
              <AppText variant="caption" color="muted">
                {periodLabel(target.periodicidade)}
                {target.renovacao ? ' · soma ao período atual' : ''}
                {installments > 1 ? ` · ${installmentLabel(target.valorCentavos, installments)}` : ''}
              </AppText>
            ) : null}
          </View>
          <AppText variant="price">{money(target?.valorCentavos ?? charge?.valorCentavos ?? 0)}</AppText>
        </View>

        {!charge ? (
          <>
            <AppText variant="heading">Forma de pagamento</AppText>
            <MethodPicker
              allowed={allowed}
              value={chosen}
              disabled={sending}
              hint={(item) => methodHint(item, target?.periodicidade)}
              onChange={(item) => {
                setMetodo(item);
                setError('');
              }}
            />
            {chosen === 'PIX' ? (
              <AppText color="muted">
                Geramos um QR Code e o código copia e cola. O plano é ativado assim que o banco confirmar o pagamento.
              </AppText>
            ) : chosen === 'BOLETO' ? (
              <AppText color="muted">
                O boleto sai no nome, CPF/CNPJ e endereço do seu perfil e vence em 3 dias. O plano é ativado quando o banco
                confirmar o pagamento, em até 3 dias úteis.
              </AppText>
            ) : (
              <CardForm
                card={card}
                metodo={chosen}
                disabled={sending}
                onChange={(key, value) => {
                  setError('');
                  setCard((current) => updateCard(current, key, value));
                }}
              />
            )}

            {target && credit && canInstall ? (
              <View style={styles.section}>
                <AppText variant="label">Parcelas</AppText>
                <ChoiceRow
                  value={String(parcelas)}
                  disabled={sending}
                  options={Array.from({ length: MAX_INSTALLMENTS }, (_, i) => ({
                    value: String(i + 1),
                    label: i === 0 ? 'À vista' : `${i + 1}x`,
                  }))}
                  onChange={(value) => setParcelas(Number(value))}
                />
                <AppText variant="caption" color="muted">
                  {installmentLabel(target.valorCentavos, installments)}
                </AppText>
              </View>
            ) : null}
            {target && canRenew ? (
              <View style={[styles.switchRow, { borderColor: colors.border }]}>
                <View style={styles.flex}>
                  <AppText variant="bodyStrong">
                    Renovar sozinho a cada {target.periodicidade === 'ANUAL' ? 'ano' : 'mês'} neste cartão
                  </AppText>
                  <AppText variant="caption" color="muted">
                    {target.periodicidade === 'ANUAL' && installments > 1 ? `Mesmas ${installments} parcelas. ` : ''}
                    Você desliga quando quiser em Seu plano, sem custo.
                  </AppText>
                </View>
                <Switch
                  value={autoRenew}
                  onValueChange={setAutoRenew}
                  disabled={sending}
                  trackColor={{ true: colors.red, false: colors.border }}
                  thumbColor="#ffffff"
                  accessibilityLabel="Renovar automaticamente neste cartão"
                />
              </View>
            ) : null}
            {target && !credit && renewable(target.periodicidade) ? (
              <AppText variant="caption" color="muted">
                {confirming
                  ? 'Pagando com Pix, débito ou boleto, a renovação automática fica desligada: você renova em Planos no fim do período.'
                  : allowed.includes('CARTAO_CREDITO')
                    ? 'Sem renovação automática: no fim do período, você renova em Planos. Para renovar sozinho, pague no crédito.'
                    : 'Sem renovação automática: no fim do período, você renova em Planos.'}
              </AppText>
            ) : null}

            {error ? <Notice tone="error" message={error} /> : null}
            <Button
              label={sending ? sendingLabel : payLabel}
              loading={sending}
              onPress={() => {
                setError('');
                pay.mutate();
              }}
            />
            {isCardMethod(chosen) ? (
              <View style={styles.inline}>
                <LockKeyhole size={14} color={colors.muted} />
                <AppText variant="caption" color="muted" style={styles.flex}>
                  Os dados do cartão vão do seu celular direto para a Cielo e não passam pelos servidores da PHC Auto.
                </AppText>
              </View>
            ) : null}
          </>
        ) : null}

        {charge && openBoleto(charge) ? (
          <>
            <BoletoBox boleto={charge.boleto!} />
            <AppText color="muted">{charge.mensagem}. Você pode sair desta tela: o boleto continua em Seu plano.</AppText>
          </>
        ) : null}

        {charge && charge.metodo === 'PIX' && waiting(charge.status) && charge.pix ? (
          <PixBox
            pix={charge.pix}
            waiting={polled.isError ? 'Sem conexão com o servidor. Tentando de novo…' : 'Aguardando o pagamento. Esta tela atualiza sozinha.'}
          />
        ) : null}

        {charge && waiting(charge.status) && !(charge.metodo === 'PIX' && charge.pix) && !openBoleto(charge) ? (
          <View style={styles.inline} accessibilityLiveRegion="polite">
            <ActivityIndicator color={colors.red} />
            <AppText color="muted" style={styles.flex}>
              {polled.isError ? 'Sem conexão com o servidor. Tentando de novo…' : charge.mensagem}
            </AppText>
          </View>
        ) : null}

        {status === 'CONFIRMADA' ? (
          <View style={styles.result} accessibilityLiveRegion="polite">
            <CircleCheck size={40} color={colors.deal} />
            <AppText variant="title">{subscription?.planoNome ?? target?.nome ?? 'Plano'} ativo</AppText>
            <AppText color="muted" style={styles.center}>
              {subscription?.inicioEm && new Date(subscription.inicioEm) > new Date()
                ? `Período pago de ${formatDate(subscription.inicioEm)} até ${formatDate(subscription.fimEm)}.`
                : subscription?.fimEm
                  ? `Válido até ${formatDate(subscription.fimEm)}.`
                  : 'Confira a validade em Seu plano.'}
            </AppText>
            {charge?.metodo === 'CARTAO_CREDITO' && renews ? (
              <View style={styles.inline}>
                <RefreshCw size={14} color={colors.muted} />
                <AppText variant="caption" color="muted" style={styles.flex}>
                  Renovação automática ligada. Você pode desligar ou pedir reembolso em até 7 dias em Seu plano.
                </AppText>
              </View>
            ) : null}
            <Button
              label="Anunciar veículo"
              icon={<ArrowRight size={17} color={colors.onRed} />}
              onPress={() => router.replace('/anunciar')}
              style={styles.full}
            />
            <Button label="Fechar" variant="secondary" onPress={() => router.back()} style={styles.full} />
          </View>
        ) : null}

        {charge && !waiting(charge.status) && status !== 'CONFIRMADA' ? (
          <View style={styles.result} accessibilityRole="alert">
            <CircleAlert size={40} color={colors.red} />
            <AppText variant="title">{status === 'RECUSADA' ? 'Pagamento recusado' : 'Pagamento não concluído'}</AppText>
            <AppText color="muted" style={styles.center}>
              {charge.mensagem}
            </AppText>
            {target ? (
              <>
                <Button label="Tentar de novo" onPress={() => retry()} style={styles.full} />
                {charge.metodo !== 'PIX' ? (
                  <Button label="Pagar com Pix" variant="secondary" onPress={() => retry('PIX')} style={styles.full} />
                ) : null}
              </>
            ) : null}
          </View>
        ) : null}

        <SupportWhatsApp message={`Olá! Tenho uma dúvida sobre o pagamento do plano${target ? ` ${target.nome}` : ''}.`} />
      </ScrollView>
      {card$.sheet}
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  center: { textAlign: 'center' },
  full: { alignSelf: 'stretch' },
  loading: { padding: space.lg, gap: space.lg },
  content: { padding: space.lg, gap: space.lg },
  summary: { flexDirection: 'row', alignItems: 'center', gap: space.md, padding: space.lg, borderRadius: radius.lg },
  section: { gap: space.sm },
  switchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    minHeight: touch,
    paddingVertical: space.md,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  inline: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  result: { alignItems: 'center', gap: space.md, paddingVertical: space.lg },
});
