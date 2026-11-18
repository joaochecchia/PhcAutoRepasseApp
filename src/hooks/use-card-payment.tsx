import { X } from 'lucide-react-native';
import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Modal, Platform, Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { WebView, type WebViewMessageEvent } from 'react-native-webview';

import { CardFlowError, threeDsOutcome, threeDsPage, tokenizeCard, type ThreeDsMessage } from '@/api/cielo';
import { plansApi, type Authentication3ds, type CardToken, type MetodoPagamento } from '@/api/plans';
import { AppText } from '@/components/app-text';
import { useTheme } from '@/hooks/use-theme';
import { space, touch } from '@/theme';
import { fullExpiry, holderName, type Card } from '@/utils/card';

export type PaymentStep = '' | 'banco' | 'token' | 'operadora';

type Pending = {
  html: string;
  baseUrl: string;
  credit: boolean;
  resolve: (value: Authentication3ds | null) => void;
  reject: (error: Error) => void;
};

/** O desafio do banco depende da pessoa; 5 minutos cobrem SMS e aplicativo do banco. */
const TIMEOUT = 5 * 60_000;

/**
 * Cartão como no site: confirmação do banco (3DS, quando o backend a configura) numa WebView e tokenização direto na
 * Cielo. Devolve só o token, a bandeira e o final, que é o que o backend recebe. Renderize `sheet` na tela.
 */
export function useCardPayment() {
  const [pending, setPending] = useState<Pending | null>(null);

  async function prepare(
    card: Card,
    metodo: MetodoPagamento,
    amountCents: number,
    installments: number,
    onStep: (step: PaymentStep) => void,
  ): Promise<{ cartao: CardToken; autenticacao3ds?: Authentication3ds }> {
    const numero = card.numero.replace(/\s/g, '');
    const validade = fullExpiry(card.validade);
    const credit = metodo === 'CARTAO_CREDITO';
    const session = await plansApi.cardSession(metodo);
    let autenticacao3ds: Authentication3ds | undefined;
    const mpi = session.autenticacao3ds;
    if (mpi) {
      onStep('banco');
      const html = threeDsPage(mpi, {
        number: numero,
        month: validade.slice(0, 2),
        year: validade.slice(3),
        amountCents,
        method: credit ? 'Credit' : 'Debit',
        installments,
      });
      const result = await new Promise<Authentication3ds | null>((resolve, reject) =>
        setPending({ html, baseUrl: mpi.urlLoja || 'https://phcauto.com', credit, resolve, reject }),
      );
      autenticacao3ds = result ?? undefined;
    }
    onStep('token');
    const paymentToken = await tokenizeCard(session.tokenizacao, {
      holder: holderName(card.titular),
      number: numero,
      expiration: validade,
      cvv: card.codigoSeguranca,
      type: credit ? 'creditCard' : 'debitCard',
    });
    return { cartao: { paymentToken, bandeira: card.bandeira, finalNumero: numero.slice(-4) }, autenticacao3ds };
  }

  const sheet = pending ? (
    <ThreeDsSheet
      pending={pending}
      onDone={(action) => {
        setPending(null);
        action();
      }}
    />
  ) : null;

  return { prepare, sheet };
}

function ThreeDsSheet({ pending, onDone }: { pending: Pending; onDone: (action: () => void) => void }) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const settled = useRef(false);
  const finish = (action: () => void) => {
    if (settled.current) return;
    settled.current = true;
    onDone(action);
  };
  const fail = (message: string) => finish(() => pending.reject(new CardFlowError(message)));

  useEffect(() => {
    const timer = setTimeout(() => fail('A confirmação do banco expirou. Tente de novo.'), TIMEOUT);
    return () => clearTimeout(timer);
    // Um prazo por confirmação.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function onMessage(event: WebViewMessageEvent) {
    let message: ThreeDsMessage;
    try {
      message = JSON.parse(event.nativeEvent.data) as ThreeDsMessage;
    } catch {
      return;
    }
    try {
      const outcome = threeDsOutcome(message, pending.credit);
      finish(() => pending.resolve(outcome));
    } catch (error) {
      finish(() => pending.reject(error instanceof Error ? error : new CardFlowError('Seu banco não confirmou a compra.')));
    }
  }

  return (
    <Modal
      visible
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={() => fail('Confirmação do banco cancelada.')}>
      <View
        style={[
          styles.root,
          {
            backgroundColor: colors.bg,
            paddingTop: Platform.OS === 'ios' ? space.lg : insets.top + space.md,
            paddingBottom: insets.bottom,
          },
        ]}>
        <View style={styles.header}>
          <View style={styles.flex}>
            <AppText variant="heading">Confirmação do seu banco</AppText>
            <AppText variant="caption" color="muted">
              Se o banco pedir, confirme por SMS ou pelo aplicativo dele.
            </AppText>
          </View>
          <Pressable
            onPress={() => fail('Confirmação do banco cancelada.')}
            accessibilityRole="button"
            accessibilityLabel="Cancelar o pagamento"
            hitSlop={8}
            style={styles.close}>
            <X size={22} color={colors.text} />
          </Pressable>
        </View>
        <View style={styles.waiting}>
          <ActivityIndicator color={colors.red} />
          <AppText variant="caption" color="muted">
            Falando com o seu banco…
          </AppText>
        </View>
        <WebView
          source={{ html: pending.html, baseUrl: pending.baseUrl }}
          originWhitelist={['*']}
          onMessage={onMessage}
          onError={() => (pending.credit ? finish(() => pending.resolve(null)) : fail('Não foi possível carregar a verificação do banco. Tente de novo.'))}
          javaScriptEnabled
          domStorageEnabled
          thirdPartyCookiesEnabled
          setSupportMultipleWindows={false}
          style={styles.web}
        />
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  flex: { flex: 1, gap: 2 },
  header: { flexDirection: 'row', alignItems: 'flex-start', gap: space.md, paddingHorizontal: space.lg, paddingBottom: space.md },
  close: { width: touch, height: touch, alignItems: 'center', justifyContent: 'center' },
  waiting: { flexDirection: 'row', alignItems: 'center', gap: space.sm, paddingHorizontal: space.lg, paddingBottom: space.sm },
  web: { flex: 1, backgroundColor: 'transparent' },
});
