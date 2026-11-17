import { useQuery } from '@tanstack/react-query';
import * as WebBrowser from 'expo-web-browser';
import { router } from 'expo-router';
import { Check, Clock3, Minus, ShieldCheck, Sparkles, WifiOff } from 'lucide-react-native';
import { useMemo, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { plansApi, type Periodicidade, type PublicPlan } from '@/api/plans';
import { AppText } from '@/components/app-text';
import { Button } from '@/components/button';
import { Chip } from '@/components/chip';
import { Notice } from '@/components/notice';
import { Skeleton } from '@/components/skeleton';
import { StateView } from '@/components/state-view';
import {
  audienceLabel,
  benefitLines,
  FEATURED_PLAN,
  formatDate,
  money,
  periodicidades,
  periodLabel,
  periodUnit,
  planPitch,
  priceOf,
} from '@/data/plans';
import { useAccount } from '@/hooks/use-account';
import { useSession } from '@/hooks/use-session';
import { useTheme } from '@/hooks/use-theme';
import { radius, space } from '@/theme';

type Audience = 'PF' | 'PJ';

/**
 * Planos e preços, com o plano atual de quem está logado (PlansPage do site). A contratação ainda acontece no site:
 * o pagamento no app depende das decisões sobre cartão e regras das lojas (AGENTS.md, pontos em aberto 2 e 3).
 */
export function PlansScreen() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const session = useSession();
  const signedIn = session.status === 'authenticated';
  const [chosenAudience, setAudience] = useState<Audience | null>(null);
  const [periodicidade, setPeriodicidade] = useState<Periodicidade>('MENSAL');

  const plans = useQuery({ queryKey: ['plans'], queryFn: ({ signal }) => plansApi.list(signal) });
  const mine = useQuery({ queryKey: ['subscription'], queryFn: ({ signal }) => plansApi.mine(signal), enabled: signedIn });
  const profile = useAccount();
  const tipoPessoa = profile.data?.tipoPessoa ?? null;
  // Começa no tipo da conta; sem sessão, pessoa física.
  const audience: Audience = chosenAudience ?? tipoPessoa ?? 'PF';
  const visible = useMemo(
    () => (plans.data ?? []).filter((plan) => plan.publico === 'TODOS' || plan.publico === audience),
    [plans.data, audience],
  );
  const offered = useMemo(
    () => new Set(visible.flatMap((plan) => plan.precos.map((preco) => preco.periodicidade))),
    [visible],
  );
  const current = mine.data?.atual ?? null;

  const subscribe = () => WebBrowser.openBrowserAsync('https://phcauto.com/planos');

  return (
    <ScrollView
      style={{ backgroundColor: colors.bg }}
      contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + space.xl }]}>
      <View style={styles.intro}>
        <AppText variant="overline" color="red">
          Planos para anunciar
        </AppText>
        <AppText variant="title">Anuncie com FIPE inclusa e pague só pelo tempo que precisar.</AppText>
        <AppText color="muted">
          Comece grátis com até 2 veículos. No anual você paga 10 meses, leva 12 e parcela em até 12x sem juros.
        </AppText>
      </View>

      {signedIn ? (
        <View style={[styles.mine, { backgroundColor: colors.subtle }]} accessibilityLiveRegion="polite">
          <AppText variant="overline" color="muted">
            Seu plano
          </AppText>
          {mine.isPending ? (
            <>
              <Skeleton width="50%" height={18} />
              <Skeleton width="80%" height={12} />
            </>
          ) : mine.isError ? (
            <Notice
              tone="error"
              message="Não carregamos o seu plano."
              actionLabel="Tentar de novo"
              actionLoading={mine.isFetching}
              onAction={() => mine.refetch()}
            />
          ) : mine.data?.acessoTotal ? (
            <>
              <AppText variant="heading">Conta do dono</AppText>
              <AppText color="muted">Todos os benefícios liberados, sem limite de anúncios ou consultas.</AppText>
            </>
          ) : current ? (
            <>
              <AppText variant="heading">{current.planoNome}</AppText>
              <AppText color="muted">
                {current.status === 'GRATUITO'
                  ? 'Plano gratuito, sem validade.'
                  : `${periodLabel(current.periodicidade)} · válido até ${formatDate(current.fimEm)}`}
              </AppText>
              {current.beneficios.limiteConsultasFipeMes != null ? (
                <AppText variant="caption" color="muted">
                  {mine.data?.consultasFipeUsadasMes ?? 0} de {current.beneficios.limiteConsultasFipeMes} consultas FIPE
                  usadas este mês
                </AppText>
              ) : null}
              {mine.data?.agendadas.map((next) => (
                <View key={next.id ?? next.planoCodigo} style={styles.inline}>
                  <Clock3 size={14} color={colors.muted} />
                  <AppText variant="caption" color="muted" style={styles.flex}>
                    {next.planoNome} {periodLabel(next.periodicidade).toLowerCase()} de {formatDate(next.inicioEm)} a{' '}
                    {formatDate(next.fimEm)}
                  </AppText>
                </View>
              ))}
              {mine.data?.recorrencia?.status === 'ATIVA' ? (
                <AppText variant="caption" color="muted">
                  Renova em {formatDate(mine.data.recorrencia.proximaCobrancaEm)} no cartão final{' '}
                  {mine.data.recorrencia.cartao.finalNumero ?? '—'}.
                </AppText>
              ) : null}
            </>
          ) : (
            <AppText color="muted">Nenhum plano encontrado.</AppText>
          )}
        </View>
      ) : null}

      <View style={styles.group}>
        <View style={styles.chips}>
          {(['PF', 'PJ'] as Audience[]).map((value) => (
            <Chip
              key={value}
              label={value === 'PF' ? 'Pessoa física' : 'Lojista (CNPJ)'}
              selected={audience === value}
              onPress={() => setAudience(value)}
            />
          ))}
        </View>
        <View style={styles.chips}>
          {periodicidades
            .filter(({ value }) => offered.size === 0 || offered.has(value))
            .map(({ value, label }) => (
              <Chip
                key={value}
                label={value === 'ANUAL' ? `${label} · 2 meses grátis` : label}
                selected={periodicidade === value}
                onPress={() => setPeriodicidade(value)}
              />
            ))}
        </View>
      </View>

      {plans.isPending ? (
        [0, 1, 2].map((key) => <Skeleton key={key} height={260} rounded={radius.lg} />)
      ) : plans.isError ? (
        <StateView
          icon={WifiOff}
          title="Planos indisponíveis"
          message={plans.error.message}
          actionLabel="Tentar de novo"
          onAction={() => plans.refetch()}
          compact
        />
      ) : visible.length === 0 ? (
        <StateView
          icon={Sparkles}
          title="Nenhum plano disponível"
          message="Ainda não há planos ativos para este tipo de anunciante."
          compact
        />
      ) : (
        visible.map((plan) => (
          <PlanCard
            key={plan.codigo}
            plan={plan}
            periodicidade={periodicidade}
            isCurrent={current?.planoCodigo === plan.codigo}
            wrongAudience={Boolean(tipoPessoa) && plan.publico !== 'TODOS' && plan.publico !== tipoPessoa}
            signedIn={signedIn}
            onMonthly={() => setPeriodicidade('MENSAL')}
            onSubscribe={subscribe}
          />
        ))
      )}

      <View style={styles.inline}>
        <ShieldCheck size={16} color={colors.muted} />
        <AppText variant="caption" color="muted" style={styles.flex}>
          Pagamento por Pix, cartão de crédito, débito ou boleto, processado pela Cielo. Desistiu? Peça o reembolso
          integral em até 7 dias da contratação. Itens “em breve” passam a valer para quem já tem o plano, sem custo
          extra.
        </AppText>
      </View>
    </ScrollView>
  );
}

function PlanCard({
  plan,
  periodicidade,
  isCurrent,
  wrongAudience,
  signedIn,
  onMonthly,
  onSubscribe,
}: {
  plan: PublicPlan;
  periodicidade: Periodicidade;
  isCurrent: boolean;
  wrongAudience: boolean;
  signedIn: boolean;
  onMonthly: () => void;
  onSubscribe: () => void;
}) {
  const { colors } = useTheme();
  const valor = priceOf(plan, periodicidade);
  const mensal = priceOf(plan, 'MENSAL');
  const featured = plan.codigo === FEATURED_PLAN;
  const note = plan.gratuito
    ? 'Sem cartão e sem cobrança.'
    : valor == null
      ? `A partir de ${money(mensal ?? 0)} por mês.`
      : periodicidade === 'ANUAL' && mensal != null
        ? `Até 12x de ${money(Math.round(valor / 12))} sem juros · economia de ${money(mensal * 12 - valor)}`
        : periodicidade === 'MENSAL'
          ? 'Renova sozinho no cartão de crédito. Desligue quando quiser.'
          : 'Ideal para vender um veículo rapidamente.';
  return (
    <View
      style={[
        styles.card,
        {
          backgroundColor: colors.surface,
          borderColor: isCurrent || featured ? colors.red : colors.border,
          borderWidth: isCurrent || featured ? 1.5 : StyleSheet.hairlineWidth,
        },
      ]}>
      {isCurrent || featured ? (
        <View style={[styles.badge, { backgroundColor: colors.red }]}>
          <AppText variant="label" color="onRed">
            {isCurrent ? 'Seu plano' : 'Recomendado para revendas'}
          </AppText>
        </View>
      ) : null}
      <AppText variant="overline" color="muted">
        {audienceLabel[plan.publico]}
      </AppText>
      <AppText variant="title">{plan.nome}</AppText>
      {planPitch[plan.codigo] ? <AppText color="muted">{planPitch[plan.codigo]}</AppText> : null}
      <View style={styles.price}>
        {plan.gratuito ? (
          <>
            <AppText variant="display">Grátis</AppText>
            <AppText color="muted">sem prazo</AppText>
          </>
        ) : valor != null ? (
          <>
            <AppText variant="display">{money(valor)}</AppText>
            <AppText color="muted">{periodUnit(periodicidade)}</AppText>
          </>
        ) : (
          <AppText variant="heading">Só mensal ou anual</AppText>
        )}
      </View>
      <AppText variant="caption" color="muted">
        {note}
      </AppText>
      {plan.gratuito ? (
        signedIn ? (
          <Button label={isCurrent ? 'Seu plano atual' : 'Incluso na sua conta'} variant="secondary" disabled />
        ) : (
          <Button label="Entrar ou criar conta" variant="secondary" onPress={() => router.push('/entrar')} />
        )
      ) : wrongAudience ? (
        <Button label={`Exclusivo para ${plan.publico === 'PJ' ? 'lojistas' : 'pessoa física'}`} variant="secondary" disabled />
      ) : valor == null ? (
        <Button label="Ver preço mensal" variant="secondary" onPress={onMonthly} />
      ) : (
        <Button
          label={isCurrent ? 'Renovar no site' : `Assinar ${plan.nome} no site`}
          variant={featured || isCurrent ? 'primary' : 'secondary'}
          accessibilityHint="Abre a página de planos do PHC Auto para concluir o pagamento"
          onPress={onSubscribe}
        />
      )}
      <View style={styles.benefits}>
        {benefitLines(plan.beneficios, plan.gratuito).map((line) => (
          <View key={line.text} style={styles.benefit}>
            {line.included ? <Check size={16} color={colors.deal} /> : <Minus size={16} color={colors.muted} />}
            <AppText color={line.included ? 'text' : 'muted'} style={styles.flex}>
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
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  content: { padding: space.lg, gap: space.lg },
  intro: { gap: space.xs },
  mine: { padding: space.lg, borderRadius: radius.lg, gap: space.xs },
  inline: { flexDirection: 'row', alignItems: 'flex-start', gap: space.xs },
  group: { gap: space.sm },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  card: { padding: space.lg, borderRadius: radius.lg, gap: space.sm },
  badge: { alignSelf: 'flex-start', paddingHorizontal: space.sm + 2, paddingVertical: 3, borderRadius: radius.pill },
  price: { flexDirection: 'row', alignItems: 'baseline', gap: space.xs, marginTop: space.xs },
  benefits: { gap: space.sm, marginTop: space.sm },
  benefit: { flexDirection: 'row', gap: space.sm, alignItems: 'flex-start' },
});
