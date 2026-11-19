import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import * as Haptics from 'expo-haptics';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { CircleAlert, LockKeyhole, ShoppingCart } from 'lucide-react-native';
import { useEffect, useState } from 'react';
import { BackHandler, KeyboardAvoidingView, Platform, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { CardFlowError } from '@/api/cielo';
import type { MetodoPagamento } from '@/api/plans';
import { salesApi, type PurchaseAvailability } from '@/api/sales';
import { AppText } from '@/components/app-text';
import { Button } from '@/components/button';
import { ChoiceRow } from '@/components/choice-row';
import { Notice } from '@/components/notice';
import { CardForm } from '@/components/payment/card-form';
import { MethodPicker } from '@/components/payment/method-picker';
import { SupportWhatsApp } from '@/components/payment/support-whatsapp';
import { Skeleton } from '@/components/skeleton';
import { StateView } from '@/components/state-view';
import { money } from '@/data/plans';
import { useCardPayment, type PaymentStep } from '@/hooks/use-card-payment';
import { useSession } from '@/hooks/use-session';
import { useTheme } from '@/hooks/use-theme';
import { radius, space } from '@/theme';
import { cardError, clearSensitive, emptyCard, isCardMethod, updateCard, type Card } from '@/utils/card';

function methodHint(metodo: MetodoPagamento, availability: PurchaseAvailability) {
  if (metodo === 'PIX') return 'QR Code na hora';
  if (metodo === 'CARTAO_CREDITO') return `Até ${availability.parcelasMaximas}x`;
  if (metodo === 'CARTAO_DEBITO') return 'Visa, Master, Elo';
  return `Vence em ${availability.vencimentoBoletoDias} dias`;
}

function methodNote(metodo: MetodoPagamento, availability: PurchaseAvailability) {
  if (metodo === 'PIX')
    return 'Geramos um QR Code e o código copia e cola. O veículo fica reservado para você até o pagamento cair, em até 24 horas.';
  if (metodo === 'BOLETO')
    return `O boleto sai no nome, CPF/CNPJ e endereço do seu perfil e vence em ${availability.vencimentoBoletoDias} dias. O veículo fica reservado até lá; a compensação leva até 3 dias úteis.`;
  return '';
}

/**
 * Compra de veículo do Pátio PHC (VehicleCheckout do site). O backend decide se o anúncio pode ser comprado e quais
 * meios a conta usa; aqui só a escolha, o cartão e o envio. Com o pedido criado, abre a compra em Minhas compras.
 */
export function VehicleCheckoutScreen() {
  const { id, titulo } = useLocalSearchParams<{ id: string; titulo?: string }>();
  const session = useSession();
  const signedIn = session.status === 'authenticated';
  const availability = useQuery({
    queryKey: ['purchase-availability', id, signedIn],
    queryFn: ({ signal }) => salesApi.purchaseAvailability(id, signal),
  });
  const title = titulo || 'Veículo';

  if (!signedIn)
    return (
      <StateView
        icon={LockKeyhole}
        title="Entre na sua conta"
        message="A compra sai no seu nome, com os dados do seu cadastro."
        actionLabel="Entrar"
        onAction={() => router.push('/entrar')}
      />
    );
  if (availability.isPending)
    return (
      <View style={styles.loading}>
        <Skeleton height={88} rounded={radius.lg} />
        <Skeleton height={160} rounded={radius.lg} />
      </View>
    );
  if (availability.isError)
    return (
      <StateView
        icon={CircleAlert}
        title="Não carregamos a compra"
        message={availability.error.message}
        actionLabel="Tentar de novo"
        onAction={() => availability.refetch()}
      />
    );
  if (!availability.data.disponivel || availability.data.valorCentavos == null)
    return (
      <StateView
        icon={ShoppingCart}
        title="Compra indisponível"
        message="Este veículo não pode mais ser comprado pelo app. Fale com o anunciante."
        actionLabel="Voltar"
        onAction={() => router.back()}
      />
    );
  return <Checkout anuncioId={id} title={title} availability={availability.data} valor={availability.data.valorCentavos} />;
}

function Checkout({
  anuncioId,
  title,
  availability,
  valor,
}: {
  anuncioId: string;
  title: string;
  availability: PurchaseAvailability;
  valor: number;
}) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const queryClient = useQueryClient();
  const card$ = useCardPayment();
  const [metodo, setMetodo] = useState<MetodoPagamento>('PIX');
  const [parcelas, setParcelas] = useState(1);
  const [card, setCard] = useState<Card>(emptyCard);
  const [step, setStep] = useState<PaymentStep>('');
  const [error, setError] = useState('');
  const allowed = availability.metodos.length ? availability.metodos : (['PIX'] as MetodoPagamento[]);
  const chosen = allowed.includes(metodo) ? metodo : 'PIX';
  const credit = chosen === 'CARTAO_CREDITO';
  const installments = credit ? parcelas : 1;

  const buy = useMutation({
    mutationFn: async () => {
      const isCard = isCardMethod(chosen);
      const problem = isCard ? cardError(card, chosen) : '';
      if (problem) throw new CardFlowError(problem);
      const prepared = isCard ? await card$.prepare(card, chosen, valor, installments, setStep) : null;
      setStep('operadora');
      return salesApi.buyVehicle(anuncioId, {
        metodo: chosen,
        parcelas: installments > 1 ? installments : undefined,
        cartao: prepared?.cartao,
        autenticacao3ds: prepared?.autenticacao3ds,
      });
    },
    onSuccess: (purchase) => {
      setCard(clearSensitive);
      if (purchase.status === 'AGUARDANDO_PAGAMENTO' || purchase.status === 'PAGO') {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        queryClient.invalidateQueries({ queryKey: ['purchases'] });
        queryClient.invalidateQueries({ queryKey: ['purchase-availability', anuncioId] });
        router.replace({ pathname: '/minhas-compras/[id]', params: { id: purchase.id } });
        return;
      }
      setError(purchase.mensagem);
    },
    onError: (reason) => {
      setError(reason instanceof Error ? reason.message : 'Não foi possível iniciar o pagamento. Tente de novo.');
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    },
    onSettled: () => setStep(''),
  });
  const sending = buy.isPending;
  // Sair no meio do envio deixaria o pedido sem acompanhamento; no sucesso a tela é trocada pela compra.
  useEffect(() => {
    if (!sending) return;
    const subscription = BackHandler.addEventListener('hardwareBackPress', () => true);
    return () => subscription.remove();
  }, [sending]);

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
  const idleLabel =
    chosen === 'PIX'
      ? `Gerar Pix de ${money(valor)}`
      : chosen === 'BOLETO'
        ? `Gerar boleto de ${money(valor)}`
        : installments > 1
          ? `Pagar em ${installments}x`
          : `Pagar ${money(valor)}`;

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: colors.bg }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <Stack.Screen options={{ gestureEnabled: !sending, headerBackVisible: !sending }} />
      <ScrollView
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + space.xxl }]}>
        <View style={[styles.summary, { backgroundColor: colors.subtle }]}>
          <View style={styles.flex}>
            <AppText variant="overline" color="muted">
              Pátio PHC Auto
            </AppText>
            <AppText variant="heading">{title}</AppText>
            <AppText variant="caption" color="muted">
              {installments > 1 ? `${installments}x (juros do seu banco)` : 'Valor anunciado'}
            </AppText>
          </View>
          <AppText variant="price">{money(valor)}</AppText>
        </View>

        <AppText variant="heading">Forma de pagamento</AppText>
        <MethodPicker
          allowed={allowed}
          value={chosen}
          disabled={sending}
          hint={(item) => methodHint(item, availability)}
          onChange={(item) => {
            setMetodo(item);
            setError('');
          }}
        />
        {isCardMethod(chosen) ? (
          <CardForm
            card={card}
            metodo={chosen}
            disabled={sending}
            onChange={(key, value) => {
              setError('');
              setCard((current) => updateCard(current, key, value));
            }}
          />
        ) : (
          <AppText color="muted">{methodNote(chosen, availability)}</AppText>
        )}

        {credit && availability.parcelasMaximas > 1 ? (
          <View style={styles.section}>
            <AppText variant="label">Parcelas</AppText>
            <ChoiceRow
              value={String(parcelas)}
              disabled={sending}
              options={Array.from({ length: availability.parcelasMaximas }, (_, i) => ({
                value: String(i + 1),
                label: i === 0 ? 'À vista' : `${i + 1}x`,
              }))}
              onChange={(value) => setParcelas(Number(value))}
            />
            {installments > 1 ? (
              <AppText variant="caption" color="muted">
                O parcelamento tem os juros do banco emissor do seu cartão; o valor de cada parcela aparece na sua fatura.
              </AppText>
            ) : null}
          </View>
        ) : null}

        {error ? <Notice tone="error" message={error} /> : null}
        <Button
          label={sending ? sendingLabel : idleLabel}
          loading={sending}
          onPress={() => {
            setError('');
            buy.mutate();
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
        <SupportWhatsApp message={`Olá! Tenho uma dúvida sobre a compra do ${title}.`} />
      </ScrollView>
      {card$.sheet}
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  loading: { padding: space.lg, gap: space.lg },
  content: { padding: space.lg, gap: space.lg },
  summary: { flexDirection: 'row', alignItems: 'center', gap: space.md, padding: space.lg, borderRadius: radius.lg },
  section: { gap: space.sm },
  inline: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
});
