import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { router } from 'expo-router';
import { Check, Clock3, Crown, RefreshCw, Undo2, WifiOff } from 'lucide-react-native';
import { Platform, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { myAdsApi } from '@/api/my-ads';
import { plansApi, type SubscriptionStatus, type SubscriptionSummary } from '@/api/plans';
import { AppText } from '@/components/app-text';
import { Button } from '@/components/button';
import { showDialog } from '@/components/dialog';
import { Notice } from '@/components/notice';
import { Skeleton } from '@/components/skeleton';
import { StateView } from '@/components/state-view';
import { benefitLines, formatDate, money, periodLabel } from '@/data/plans';
import { useSession } from '@/hooks/use-session';
import { useTheme } from '@/hooks/use-theme';
import { radius, space } from '@/theme';

const statusLabel: Record<SubscriptionSummary['status'], string> = {
  ATIVA: 'Ativo',
  GRATUITO: 'Gratuito',
  PENDENTE: 'Aguardando pagamento',
  SUSPENSA: 'Suspenso',
  CANCELADA: 'Cancelado',
  EXPIRADA: 'Vencido',
};

/**
 * Meu plano: o app só mostra e gerencia o plano da conta; não vende plano nem leva à compra (as lojas exigem a
 * cobrança delas para serviço digital comprado no app). A contratação é no site, pela Cielo, e a assinatura é da
 * conta: entrou com a mesma conta, o plano vale aqui. Desligar a renovação e pedir o reembolso são gestão da conta.
 *
 * Só no Android há uma frase, sem link, dizendo que a contratação é no site: a Google Play permite isso em app de
 * consumo. Na App Store (fora dos EUA) não pode haver nenhuma chamada para comprar fora do app.
 */
export function PlansScreen() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const signedIn = useSession().status === 'authenticated';
  const queryClient = useQueryClient();
  const mine = useQuery({ queryKey: ['subscription'], queryFn: ({ signal }) => plansApi.mine(signal), enabled: signedIn });
  const quota = useQuery({ queryKey: ['ad-quota'], queryFn: ({ signal }) => myAdsApi.quota(signal), enabled: signedIn });
  const action = useMutation({
    mutationFn: async (kind: 'desligar' | 'reembolso') => {
      if (kind === 'desligar') {
        await plansApi.cancelAutoRenewal();
        return 'Renovação automática desligada. O plano vale até o fim do período pago.';
      }
      const refund = mine.data?.reembolso;
      if (!refund) throw new Error('O prazo de reembolso deste plano terminou.');
      return (await plansApi.refund(refund.assinaturaId)).mensagem;
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: ['subscription'] }),
  });

  if (!signedIn)
    return (
      <View style={[styles.flex, { backgroundColor: colors.bg }]}>
        <StateView
          icon={Crown}
          title="Entre para ver seu plano"
          message="O plano, a validade e os limites de anúncios ficam na sua conta."
          actionLabel="Entrar"
          onAction={() => router.push('/entrar')}
        />
      </View>
    );
  if (mine.isError)
    return (
      <View style={[styles.flex, { backgroundColor: colors.bg }]}>
        <StateView
          icon={WifiOff}
          title="Não carregamos o seu plano"
          message={mine.error.message}
          actionLabel="Tentar de novo"
          onAction={() => mine.refetch()}
        />
      </View>
    );

  const data = mine.data;
  const current = data?.atual ?? null;

  function confirmAction(kind: 'desligar' | 'reembolso') {
    action.reset();
    const refund = data?.reembolso;
    showDialog({
      title: kind === 'desligar' ? 'Desligar a renovação automática?' : 'Cancelar com reembolso?',
      message:
        kind === 'desligar'
          ? 'O plano continua até o fim do período pago.'
          : `O plano acaba agora e ${money(refund?.valorCentavos ?? 0)} voltam pelo mesmo meio de pagamento.`,
      actions: [
        { label: 'Voltar', kind: 'cancel' },
        { label: kind === 'desligar' ? 'Desligar' : 'Cancelar e reembolsar', kind: 'destructive', onPress: () => action.mutate(kind) },
      ],
    });
  }

  return (
    <ScrollView
      style={{ backgroundColor: colors.bg }}
      contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + space.xl }]}
      accessibilityLiveRegion="polite">
      {mine.isPending || !data ? (
        <>
          <Skeleton height={150} rounded={radius.lg} />
          <Skeleton height={120} rounded={radius.lg} />
        </>
      ) : data.acessoTotal ? (
        <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <AppText variant="overline" color="muted">
            Seu plano
          </AppText>
          <AppText variant="title">Conta do dono</AppText>
          <AppText color="muted">Todos os benefícios liberados, sem limite de anúncios ou consultas.</AppText>
        </View>
      ) : !current ? (
        <StateView icon={Crown} title="Nenhum plano encontrado" message="Sua conta ainda não tem plano registrado." compact />
      ) : (
        <>
          <PlanCard current={current} data={data} />
          <Warnings current={current} data={data} />
          <Usage current={current} data={data} quota={quota.data ?? null} quotaLoading={quota.isPending} />
          <Benefits current={current} />

          {data.recorrencia || data.reembolso ? (
            <View style={styles.actions}>
              {data.recorrencia ? (
                <Button
                  label="Desligar renovação automática"
                  variant="ghost"
                  icon={<RefreshCw size={16} color={colors.red} />}
                  loading={action.isPending && action.variables === 'desligar'}
                  disabled={action.isPending}
                  onPress={() => confirmAction('desligar')}
                />
              ) : null}
              {data.reembolso ? (
                <Button
                  label={`Cancelar com reembolso (até ${formatDate(data.reembolso.ate)})`}
                  variant="ghost"
                  icon={<Undo2 size={16} color={colors.red} />}
                  loading={action.isPending && action.variables === 'reembolso'}
                  disabled={action.isPending}
                  onPress={() => confirmAction('reembolso')}
                />
              ) : null}
              {action.isSuccess ? <Notice tone="success" message={action.data} /> : null}
              {action.isError ? (
                <Notice
                  tone="error"
                  message={action.error.message}
                  actionLabel="Tentar de novo"
                  onAction={() => action.variables && action.mutate(action.variables)}
                />
              ) : null}
            </View>
          ) : null}

          {Platform.OS === 'android' ? (
            <AppText variant="caption" color="muted">
              A contratação e a troca de plano são feitas no site phcauto.com. O plano é da sua conta e vale no site e
              no app.
            </AppText>
          ) : (
            <AppText variant="caption" color="muted">
              O plano é da sua conta e vale no site e no app.
            </AppText>
          )}
        </>
      )}
    </ScrollView>
  );
}

function PlanCard({ current, data }: { current: SubscriptionSummary; data: SubscriptionStatus }) {
  const { colors } = useTheme();
  const free = current.status === 'GRATUITO';
  const active = current.status === 'ATIVA' || free;
  const renewal = data.recorrencia;
  return (
    <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
      <View style={styles.row}>
        <AppText variant="overline" color="muted" style={styles.flex}>
          Seu plano
        </AppText>
        <View style={[styles.badge, { backgroundColor: active ? colors.dealTint : colors.redTint }]}>
          <AppText variant="label" color={active ? 'deal' : 'red'}>
            {statusLabel[current.status]}
          </AppText>
        </View>
      </View>
      <AppText variant="title">{current.planoNome}</AppText>
      <AppText color="muted">
        {free
          ? 'Sem validade.'
          : `${periodLabel(current.periodicidade)}${current.inicioEm ? ` · de ${formatDate(current.inicioEm)}` : ''}${
              current.fimEm ? ` até ${formatDate(current.fimEm)}` : ''
            }`}
      </AppText>
      {renewal?.status === 'ATIVA' ? (
        <View style={styles.inline}>
          <RefreshCw size={14} color={colors.muted} />
          <AppText variant="caption" color="muted" style={styles.flex}>
            Renova sozinho em {formatDate(renewal.proximaCobrancaEm)} no cartão {renewal.cartao.bandeira ?? ''} final{' '}
            {renewal.cartao.finalNumero ?? '—'}.
          </AppText>
        </View>
      ) : null}
      {data.agendadas.map((next) => (
        <View key={next.id ?? next.planoCodigo} style={styles.inline}>
          <Clock3 size={14} color={colors.muted} />
          <AppText variant="caption" color="muted" style={styles.flex}>
            Depois: {next.planoNome} de {formatDate(next.inicioEm)} a {formatDate(next.fimEm)}
          </AppText>
        </View>
      ))}
    </View>
  );
}

/** Avisos de plano vencido ou inativo e de pagamento ainda não confirmado. Só informam: não há pagamento no app. */
function Warnings({ current, data }: { current: SubscriptionSummary; data: SubscriptionStatus }) {
  const notices: string[] = [];
  if (current.status === 'EXPIRADA') notices.push(`O plano ${current.planoNome} venceu em ${formatDate(current.fimEm)}.`);
  if (current.status === 'SUSPENSA') notices.push(`O plano ${current.planoNome} está suspenso.`);
  if (current.status === 'CANCELADA') notices.push(`O plano ${current.planoNome} foi cancelado.`);
  if (current.status === 'PENDENTE') notices.push('O pagamento do plano ainda não foi confirmado.');
  if (data.recorrencia?.status === 'AGUARDANDO_CLIENTE')
    notices.push(`O banco não aprovou a renovação automática. O plano vale até ${formatDate(current.fimEm)}.`);
  if (data.cobrancaPendente && current.status !== 'PENDENTE')
    notices.push(`Há um pagamento de ${money(data.cobrancaPendente.valorCentavos)} aguardando confirmação.`);
  if (notices.length === 0) return null;
  return (
    <View style={styles.actions}>
      {notices.map((message) => (
        <Notice key={message} tone="error" message={message} />
      ))}
    </View>
  );
}

function Usage({
  current,
  data,
  quota,
  quotaLoading,
}: {
  current: SubscriptionSummary;
  data: SubscriptionStatus;
  quota: { limite: number | null; publicados: number } | null;
  quotaLoading: boolean;
}) {
  const { colors } = useTheme();
  const fipeLimit = current.beneficios.limiteConsultasFipeMes;
  const rows: { label: string; used: number; limit: number | null }[] = [];
  if (quota) rows.push({ label: 'Anúncios publicados', used: quota.publicados, limit: quota.limite });
  if (fipeLimit !== 0) rows.push({ label: 'Consultas FIPE este mês', used: data.consultasFipeUsadasMes, limit: fipeLimit });
  return (
    <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
      <AppText variant="heading">Limites</AppText>
      {quotaLoading ? <Skeleton height={36} /> : null}
      {rows.map((row) => {
        const share = row.limit ? Math.min(1, row.used / row.limit) : 0;
        const full = row.limit != null && row.used >= row.limit;
        return (
          <View key={row.label} style={styles.meterRow} accessible accessibilityLabel={meterLabel(row)}>
            <View style={styles.row}>
              <AppText style={styles.flex}>{row.label}</AppText>
              <AppText variant="bodyStrong" color={full ? 'red' : 'text'}>
                {row.limit == null ? `${row.used} · sem limite` : `${row.used} de ${row.limit}`}
              </AppText>
            </View>
            {row.limit != null ? (
              <View style={[styles.meter, { backgroundColor: colors.border }]}>
                <View style={[styles.meterFill, { width: `${Math.round(share * 100)}%`, backgroundColor: full ? colors.red : colors.deal }]} />
              </View>
            ) : null}
          </View>
        );
      })}
    </View>
  );
}

const meterLabel = (row: { label: string; used: number; limit: number | null }) =>
  row.limit == null ? `${row.label}: ${row.used}, sem limite` : `${row.label}: ${row.used} de ${row.limit}`;

/** Só o que o plano inclui; nada do que ele não tem (sem vitrine de outros planos no app). */
function Benefits({ current }: { current: SubscriptionSummary }) {
  const { colors } = useTheme();
  const lines = benefitLines(current.beneficios, current.status === 'GRATUITO').filter((line) => line.included);
  if (lines.length === 0) return null;
  return (
    <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
      <AppText variant="heading">Incluído no seu plano</AppText>
      {lines.map((line) => (
        <View key={line.text} style={styles.inline}>
          <Check size={16} color={colors.deal} />
          <AppText style={styles.flex}>
            {line.text}
            {line.soon ? (
              <AppText variant="caption" color="muted">
                {' '}
                · em breve
              </AppText>
            ) : null}
          </AppText>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  content: { padding: space.lg, gap: space.lg },
  card: { padding: space.lg, borderRadius: radius.lg, borderWidth: StyleSheet.hairlineWidth, gap: space.sm },
  row: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  inline: { flexDirection: 'row', alignItems: 'flex-start', gap: space.sm },
  badge: { paddingHorizontal: space.sm + 2, paddingVertical: 3, borderRadius: radius.pill },
  actions: { gap: space.sm },
  meterRow: { gap: space.xs },
  meter: { height: 6, borderRadius: 3, overflow: 'hidden' },
  meterFill: { height: 6, borderRadius: 3 },
});
