import { useQuery } from '@tanstack/react-query';
import { router } from 'expo-router';
import {
  BellRing,
  CircleCheck,
  Clock3,
  Database,
  PlugZap,
  RefreshCw,
  Siren,
  TriangleAlert,
  WifiOff,
} from 'lucide-react-native';
import { Fragment } from 'react';
import { RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { adminApi, type ClaudeSpend, type ObservabilityCount, type ObservabilityPanel } from '@/api/admin';
import { AppText } from '@/components/app-text';
import { Notice } from '@/components/notice';
import { Skeleton } from '@/components/skeleton';
import { StateView } from '@/components/state-view';
import { useTheme } from '@/hooks/use-theme';
import { radius, space } from '@/theme';

import { AdminGate } from './admin-gate';
import { ago, duration, formatClock, formatDate, formatDateTime, formatInteger } from './format';
import { AdminRow, AdminSection, Divider, Tag } from './ui';

export const observabilityKey = ['admin', 'observability'] as const;

const providerNames: Record<string, string> = {
  BREVO: 'Brevo (e-mails)',
  PARALLELUM: 'Parallelum (FIPE)',
  CIELO: 'Cielo (pagamentos)',
  EXPO: 'Expo (push do app)',
};
const resultLabels: Record<string, string> = { ok: 'sucesso', sem_resposta: 'sem resposta', erro_servidor: 'erro do fornecedor' };

/** Observabilidade (AdminObservability do site), com os alertas do monitor. Atualiza sozinha a cada 30 s. */
export function ObservabilityScreen() {
  return (
    <AdminGate>
      <Observability />
    </AdminGate>
  );
}

function Observability() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const panel = useQuery({
    queryKey: observabilityKey,
    queryFn: ({ signal }) => adminApi.observability(signal),
    refetchInterval: 30_000,
    staleTime: 0,
  });
  const data = panel.data;

  if (!data) {
    return panel.isError ? (
      <View style={[styles.root, { backgroundColor: colors.bg }]}>
        <StateView
          icon={WifiOff}
          title="Observabilidade indisponível"
          message={panel.error.message}
          actionLabel="Tentar de novo"
          onAction={() => panel.refetch()}
        />
      </View>
    ) : (
      <View style={[styles.root, styles.content, { backgroundColor: colors.bg }]} accessibilityLabel="Carregando observabilidade">
        <Skeleton height={88} rounded={radius.lg} />
        <Skeleton height={180} rounded={radius.lg} />
        <Skeleton height={140} rounded={radius.lg} />
      </View>
    );
  }

  const backlogLate = data.projecaoMaisAntigaSegundos > 300;
  return (
    <ScrollView
      style={{ backgroundColor: colors.bg }}
      contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + space.xxl }]}
      refreshControl={<RefreshControl refreshing={panel.isRefetching} onRefresh={() => void panel.refetch()} tintColor={colors.red} />}>
      <AppText variant="caption" color="muted">
        Atualizado às {formatClock(data.geradoEm)}
        {data.ambiente ? ` · ambiente ${data.ambiente}` : ''}
        {data.versao ? ` · versão ${data.versao}` : ''}
      </AppText>
      {panel.isError ? (
        <Notice tone="error" message={`${panel.error.message} Mostrando a última leitura.`} actionLabel="Tentar de novo" onAction={() => panel.refetch()} />
      ) : null}

      <Alerts data={data} />

      <AdminSection title="Serviços">
        {data.servicos.map((service, index) => (
          <Fragment key={service.nome}>
            {index > 0 ? <Divider /> : null}
            <AdminRow
              icon={Database}
              iconColor={service.status === 'UP' ? 'text' : 'red'}
              title={service.nome}
              detail={service.detalhe}
              trailing={<Tag label={service.status === 'UP' ? `${service.latenciaMs ?? 0} ms` : 'Fora do ar'} tone={service.status === 'UP' ? 'good' : 'bad'} />}
            />
          </Fragment>
        ))}
        <Divider />
        <AdminRow
          icon={RefreshCw}
          iconColor={backlogLate ? 'red' : 'text'}
          title="Sincronização do banco de leitura"
          detail={
            data.projecaoPendentes === 0
              ? 'Sem eventos pendentes'
              : `${formatInteger(data.projecaoPendentes)} pendentes · mais antigo há ${duration(data.projecaoMaisAntigaSegundos)}`
          }
          trailing={<Tag label={backlogLate ? 'Atrasada' : 'Em dia'} tone={backlogLate ? 'bad' : 'good'} />}
        />
      </AdminSection>

      <Numbers numbers={data.numeros} />

      <AdminSection title="Integrações externas" note="Requisições do backend, inclusive retentativas.">
        {data.integracoes.map((item, index) => (
          <Fragment key={item.provedor}>
            {index > 0 ? <Divider inset={false} /> : null}
            <Integration item={item} />
          </Fragment>
        ))}
      </AdminSection>
      <AppText variant="caption" color="muted" style={styles.note}>
        Contagens guardadas por 45 dias. ViaCEP e a tokenização do cartão vão direto do aparelho ou do navegador, por
        isso não aparecem aqui.
      </AppText>

      {data.claude ? <ClaudeSpendSection spend={data.claude} /> : null}

      <Checklist checklist={data.checklist} />
    </ScrollView>
  );
}

function Alerts({ data }: { data: ObservabilityPanel }) {
  const { colors } = useTheme();
  if (!data.alertas) {
    return (
      <Notice message="Este servidor ainda não tem o monitor de alertas. Atualize o backend para receber os alertas no celular." />
    );
  }
  const { ativos, recentes } = data.alertas;
  return (
    <AdminSection title="Alertas" note="O servidor confere tudo a cada minuto e avisa no celular de quem ligou os alertas.">
      {ativos.length === 0 ? (
        <AdminRow icon={CircleCheck} iconColor="deal" title="Tudo normal" detail="Nenhum serviço fora do ar ou fora do padrão agora." />
      ) : (
        ativos.map((alert, index) => (
          <Fragment key={alert.chave}>
            {index > 0 ? <Divider /> : null}
            <View style={[styles.alert, { backgroundColor: colors.redTint }]}>
              <Siren size={20} color={colors.red} />
              <View style={styles.flex}>
                <AppText variant="bodyStrong">{alert.nome}</AppText>
                <AppText variant="caption">{alert.detalhe}</AppText>
                <AppText variant="caption" color="muted">
                  Desde {ago(alert.desde)}
                </AppText>
              </View>
            </View>
          </Fragment>
        ))
      )}
      {recentes.length > 0 ? (
        <>
          <Divider inset={false} />
          <View style={styles.recentHeader}>
            <AppText variant="label" color="muted">
              Últimos avisos enviados
            </AppText>
          </View>
          {recentes.slice(0, 8).map((alert) => (
            <View key={`${alert.chave}-${alert.em}`} style={styles.recent}>
              {alert.resolvido ? (
                <CircleCheck size={16} color={colors.deal} />
              ) : (
                <TriangleAlert size={16} color={colors.red} />
              )}
              <View style={styles.flex}>
                <AppText variant="label">{alert.titulo}</AppText>
                <AppText variant="caption" color="muted">
                  {ago(alert.em)} · {alert.texto}
                </AppText>
              </View>
            </View>
          ))}
        </>
      ) : null}
      <Divider inset={false} />
      <AdminRow
        icon={BellRing}
        title="Receber neste aparelho"
        detail="Ligue Alertas do sistema e envie um teste"
        onPress={() => router.push('/notificacoes')}
      />
    </AdminSection>
  );
}

function Numbers({ numbers }: { numbers: ObservabilityPanel['numeros'] }) {
  const { colors } = useTheme();
  const items: [string, number][] = [
    ['Usuários', numbers.usuarios],
    ['Contas ativas', numbers.usuariosAtivos],
    ['Planos vigentes', numbers.assinaturasVigentes],
    ['Cobranças aguardando', numbers.cobrancasAguardando],
    ['Pagamentos (30 dias)', numbers.cobrancasConfirmadas30Dias],
    ['Anúncios publicados', numbers.anunciosPublicados],
  ];
  return (
    <View style={styles.section}>
      <AppText variant="overline" color="muted" style={styles.sectionTitle} accessibilityRole="header">
        Números
      </AppText>
      <View style={styles.grid}>
        {items.map(([label, value]) => (
          <View
            key={label}
            style={[styles.number, { backgroundColor: colors.surface, borderColor: colors.border }]}
            accessible
            accessibilityLabel={`${label}: ${value < 0 ? 'indisponível' : formatInteger(value)}`}>
            <AppText variant="title">{value < 0 ? '—' : formatInteger(value)}</AppText>
            <AppText variant="caption" color="muted">
              {label}
            </AppText>
          </View>
        ))}
      </View>
    </View>
  );
}

function CountCell({ label, value }: { label: string; value: ObservabilityCount | null }) {
  return (
    <View style={styles.count}>
      <AppText variant="caption" color="muted">
        {label}
      </AppText>
      <AppText variant="bodyStrong">{value ? formatInteger(value.total) : '—'}</AppText>
      {value && value.falhas > 0 ? (
        <AppText variant="caption" color="red">
          {formatInteger(value.falhas)} com falha
        </AppText>
      ) : null}
    </View>
  );
}

function Integration({ item }: { item: ObservabilityPanel['integracoes'][number] }) {
  const { colors } = useTheme();
  const operations = Object.entries(item.operacoesTrintaDias);
  const quotaHigh = item.cota ? item.cota.usado >= item.cota.limite * 0.8 : false;
  return (
    <View style={styles.integration}>
      <View style={styles.integrationTitle}>
        <PlugZap size={18} color={colors.text} />
        <AppText variant="bodyStrong" style={styles.flex}>
          {providerNames[item.provedor] ?? item.provedor}
        </AppText>
      </View>
      <AppText variant="caption" color="muted">
        {item.descricao}
      </AppText>
      <View style={styles.counts}>
        <CountCell label="Hoje" value={item.hoje} />
        <CountCell label="7 dias" value={item.seteDias} />
        <CountCell label="30 dias" value={item.trintaDias} />
      </View>
      {operations.length ? (
        <AppText variant="caption" color="muted">
          {operations.map(([operation, count]) => `${operation}: ${formatInteger(count)}`).join(' · ')}
        </AppText>
      ) : null}
      <AppText variant="caption">
        {item.ultima
          ? `Última chamada ${ago(item.ultima.em)} · ${item.ultima.operacao} · ${
              resultLabels[item.ultima.resultado] ?? item.ultima.resultado.replace('erro_', 'HTTP ')
            }`
          : 'Nenhuma chamada registrada'}
      </AppText>
      {item.cota ? (
        <AppText variant="caption" color={quotaHigh ? 'red' : 'text'}>
          Cota: {formatInteger(item.cota.usado)} de {formatInteger(item.cota.limite)} nas últimas {item.cota.janela}
        </AppText>
      ) : null}
    </View>
  );
}

/** Dólares com centavos; abaixo de US$ 1, mais casas, para o gasto de poucas chamadas não virar zero. */
function usd(value: number | null | undefined) {
  if (value == null) return '—';
  const digits = Math.abs(value) < 1 && value !== 0 ? 4 : 2;
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: digits,
  }).format(value);
}

/** Gasto com o Claude na moderação das fotos (AdminObservability do site). */
function ClaudeSpendSection({ spend }: { spend: ClaudeSpend }) {
  const { colors } = useTheme();
  const official = spend.oficial;
  const balance = spend.saldo;
  const lowBalance = balance?.estimado != null && balance.estimado < 5;
  const items: { label: string; value: string; note: string; alert?: boolean }[] = [
    { label: 'Hoje (estimado)', value: usd(spend.hoje.dolares), note: `${formatInteger(spend.hoje.chamadas)} chamadas` },
    { label: 'Este mês (estimado)', value: usd(spend.mes.dolares), note: `${formatInteger(spend.mes.chamadas)} chamadas` },
    {
      label: 'Últimos 30 dias (estimado)',
      value: usd(spend.trintaDias.dolares),
      note: `${formatInteger(spend.trintaDias.tokensEntrada)} tokens de entrada · ${formatInteger(spend.trintaDias.tokensSaida)} de saída`,
    },
    {
      label: 'Este mês (oficial)',
      value: official.configurado ? usd(official.mesDolares) : '—',
      note: !official.configurado
        ? 'Sem a chave Admin da Anthropic'
        : official.atualizadoAte
          ? `Dados até ${formatDateTime(official.atualizadoAte)}`
          : official.consultadoEm
            ? 'Sem dados da Anthropic ainda'
            : 'Primeira consulta em até 1 min',
    },
    {
      label: 'Saldo estimado',
      value: balance ? usd(balance.estimado) : '—',
      note: balance
        ? `${usd(balance.informado)} em ${formatDate(balance.em)} − ${usd(balance.gastoDesde)} gastos${balance.completo ? '' : ' (histórico incompleto)'}`
        : 'Informe o saldo do Console no servidor',
      alert: lowBalance,
    },
  ];
  return (
    <View style={styles.section}>
      <View style={styles.sectionTitle}>
        <AppText variant="overline" color="muted" accessibilityRole="header">
          Gasto com o Claude
        </AppText>
        <AppText variant="caption" color="muted">
          Moderação de fotos · {spend.modelo}
        </AppText>
      </View>
      <View style={styles.grid}>
        {items.map((item) => (
          <View
            key={item.label}
            style={[styles.number, { backgroundColor: colors.surface, borderColor: item.alert ? colors.red : colors.border }]}
            accessible
            accessibilityLabel={`${item.label}: ${item.value}. ${item.note}`}>
            <AppText variant="title" color={item.alert ? 'red' : 'text'}>
              {item.value}
            </AppText>
            <AppText variant="caption">{item.label}</AppText>
            <AppText variant="caption" color="muted">
              {item.note}
            </AppText>
          </View>
        ))}
      </View>
      {official.erro ? <Notice tone="error" message={`Custo oficial: ${official.erro}`} /> : null}
      <AppText variant="caption" color="muted" style={styles.sectionTitle}>
        Estimado: tokens de cada resposta × {usd(spend.precoEntradaPorMilhao)} (entrada) e {usd(spend.precoSaidaPorMilhao)}{' '}
        (saída) por milhão, no fuso de Brasília. Oficial: custo do mês em UTC lido da Anthropic a cada 30 min, com 4 a 24 h
        de atraso, antes dos créditos. O saldo vem de ANTHROPIC_SALDO_USD e ANTHROPIC_SALDO_EM no servidor.
      </AppText>
    </View>
  );
}

function Checklist({ checklist }: { checklist: ObservabilityPanel['checklist'] }) {
  const pending = checklist.filter((item) => item.estado !== 'OK').length;
  const groups = [...new Set(checklist.map((item) => item.grupo))];
  return (
    <AdminSection title="Preparação para produção" note={pending === 0 ? 'Tudo pronto.' : `${pending} itens pendentes.`}>
      {groups.map((group, groupIndex) => (
        <Fragment key={group}>
          {groupIndex > 0 ? <Divider inset={false} /> : null}
          <View style={styles.recentHeader}>
            <AppText variant="label" color="muted">
              {group}
            </AppText>
          </View>
          {checklist
            .filter((item) => item.grupo === group)
            .map((item) => (
              <AdminRow
                key={item.item}
                icon={item.estado === 'OK' ? CircleCheck : item.estado === 'ATENCAO' ? TriangleAlert : Clock3}
                iconColor={item.estado === 'OK' ? 'deal' : item.estado === 'ATENCAO' ? 'red' : 'muted'}
                title={item.item}
                detail={item.detalhe}
              />
            ))}
        </Fragment>
      ))}
    </AdminSection>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  content: { padding: space.lg, gap: space.xl },
  flex: { flex: 1, gap: 2 },
  note: { marginTop: -space.md, paddingHorizontal: space.xs },
  section: { gap: space.sm },
  sectionTitle: { paddingHorizontal: space.xs, gap: 2 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  number: { flexGrow: 1, flexBasis: '45%', borderRadius: radius.lg, borderWidth: StyleSheet.hairlineWidth, padding: space.md, gap: 2 },
  alert: { flexDirection: 'row', gap: space.md, padding: space.lg },
  recentHeader: { paddingHorizontal: space.lg, paddingTop: space.md, paddingBottom: space.xs },
  recent: { flexDirection: 'row', gap: space.sm, paddingHorizontal: space.lg, paddingVertical: space.sm },
  integration: { padding: space.lg, gap: space.xs },
  integrationTitle: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  counts: { flexDirection: 'row', gap: space.md, marginVertical: space.xs },
  count: { flex: 1, gap: 1 },
});
