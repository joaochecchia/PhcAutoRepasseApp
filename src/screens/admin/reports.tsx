import { useInfiniteQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import * as Haptics from 'expo-haptics';
import { router } from 'expo-router';
import { ExternalLink, Flag, MessagesSquare, WifiOff } from 'lucide-react-native';
import { useMemo, useState, type ReactNode } from 'react';
import { ActivityIndicator, FlatList, Pressable, RefreshControl, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { adminReportsApi, type AdminReport, type ReportStatus } from '@/api/reports';
import { AppText } from '@/components/app-text';
import { Button } from '@/components/button';
import { Notice } from '@/components/notice';
import { Skeleton } from '@/components/skeleton';
import { StateView } from '@/components/state-view';
import { TextField } from '@/components/text-field';
import { reportReasonLabel } from '@/data/reports';
import { useTheme } from '@/hooks/use-theme';
import { radius, space } from '@/theme';
import { AdminGate } from './admin-gate';
import { formatDateTime } from './format';
import { Segmented, Tag } from './ui';

type Filter = 'TODAS' | ReportStatus;
const filters: { value: Filter; label: string }[] = [
  { value: 'ABERTA', label: 'Aguardando' },
  { value: 'RESOLVIDA', label: 'Resolvidas' },
  { value: 'DESCARTADA', label: 'Descartadas' },
  { value: 'TODAS', label: 'Todas' },
];
const statusLabel: Record<ReportStatus, string> = { ABERTA: 'Aguardando', RESOLVIDA: 'Resolvida', DESCARTADA: 'Descartada' };

/**
 * Fila de denúncias (AdminReports do site), para ADMIN e DONO. A providência usa as outras áreas (abrir a conversa,
 * retirar o anúncio, bloquear a conta); aqui fica o registro de quem analisou, quando e o que decidiu.
 */
export function ReportsScreen() {
  return (
    <AdminGate>
      <Reports />
    </AdminGate>
  );
}

function Reports() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const [status, setStatus] = useState<Filter>('ABERTA');
  const list = useInfiniteQuery({
    queryKey: ['admin', 'reports', status],
    queryFn: ({ pageParam, signal }) =>
      adminReportsApi.list({ status: status === 'TODAS' ? undefined : status, pagina: pageParam }, signal),
    initialPageParam: 0,
    getNextPageParam: (last) => ((last.pagina + 1) * last.tamanho < last.total ? last.pagina + 1 : undefined),
  });
  const items = useMemo(() => list.data?.pages.flatMap((page) => page.itens) ?? [], [list.data]);
  const total = list.data?.pages[0]?.total ?? 0;

  return (
    <FlatList
      style={{ backgroundColor: colors.bg }}
      contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + space.xxl }]}
      data={items}
      keyExtractor={(item) => item.id}
      keyboardShouldPersistTaps="handled"
      ListHeaderComponent={
        <View style={styles.header}>
          <Segmented label="Situação" options={filters} value={status} onChange={setStatus} />
          {list.data ? (
            <AppText variant="caption" color="muted">
              {total} denúncia(s)
            </AppText>
          ) : null}
        </View>
      }
      refreshControl={
        <RefreshControl refreshing={list.isRefetching && !list.isFetchingNextPage} onRefresh={() => void list.refetch()} tintColor={colors.red} />
      }
      onEndReachedThreshold={0.4}
      onEndReached={() => {
        if (list.hasNextPage && !list.isFetchingNextPage) list.fetchNextPage();
      }}
      ItemSeparatorComponent={() => <View style={styles.gap} />}
      ListFooterComponent={list.isFetchingNextPage ? <ActivityIndicator color={colors.red} style={styles.footer} /> : undefined}
      ListEmptyComponent={
        list.isPending ? (
          <View style={styles.skeletons}>
            {[0, 1, 2].map((n) => (
              <Skeleton key={n} height={160} rounded={radius.lg} />
            ))}
          </View>
        ) : list.isError ? (
          <StateView icon={WifiOff} title="As denúncias não carregaram" message={list.error.message} actionLabel="Tentar de novo" onAction={() => list.refetch()} compact />
        ) : (
          <StateView
            icon={Flag}
            title={status === 'ABERTA' ? 'Nenhuma denúncia aguardando' : 'Nenhuma denúncia aqui'}
            message="Denúncias de anúncios e de mensagens feitas no site e no app aparecem nesta fila."
            compact
          />
        )
      }
      renderItem={({ item }) => <ReportCard report={item} />}
    />
  );
}

const person = (p: AdminReport['denunciante']) => (p.nome ? `${p.nome}${p.email ? ` · ${p.email}` : ''}` : 'Conta excluída');

function ReportCard({ report }: { report: AdminReport }) {
  const { colors } = useTheme();
  const queryClient = useQueryClient();
  const [note, setNote] = useState('');
  const decide = useMutation({
    mutationFn: (decisao: 'RESOLVIDA' | 'DESCARTADA') => adminReportsApi.decide(report.id, decisao, note.trim()),
    onSuccess: () => {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      queryClient.invalidateQueries({ queryKey: ['admin', 'reports'] });
    },
  });
  const tone = report.status === 'ABERTA' ? 'bad' : report.status === 'RESOLVIDA' ? 'good' : 'neutral';

  return (
    <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
      <View style={styles.row}>
        <AppText variant="bodyStrong" style={styles.flex}>
          {report.tipo === 'ANUNCIO' ? 'Anúncio' : 'Mensagem'} · {reportReasonLabel[report.motivo]}
        </AppText>
        <Tag label={statusLabel[report.status]} tone={tone} />
      </View>
      <View style={[styles.quote, { backgroundColor: colors.subtle, borderLeftColor: colors.border }]}>
        <AppText selectable>{report.trecho}</AppText>
      </View>
      {report.detalhe ? (
        <AppText>
          <AppText variant="bodyStrong">Relato: </AppText>
          {report.detalhe}
        </AppText>
      ) : null}
      <View style={styles.people}>
        <AppText variant="caption" color="muted">
          Denunciado
        </AppText>
        <AppText selectable>
          {person(report.denunciado)}
          {report.denunciasContraDenunciado > 1 ? (
            <AppText color="red" variant="bodyStrong">
              {' '}
              · {report.denunciasContraDenunciado} denúncias no total
            </AppText>
          ) : null}
        </AppText>
        <AppText variant="caption" color="muted">
          Denunciante
        </AppText>
        <AppText selectable>{person(report.denunciante)}</AppText>
        <AppText variant="caption" color="muted">
          Recebida em {formatDateTime(report.criadaEm)}
        </AppText>
      </View>
      <View style={styles.links}>
        {report.anuncioId ? (
          <LinkButton
            label="Ver anúncio"
            icon={<ExternalLink size={14} color={colors.red} />}
            onPress={() => router.push({ pathname: '/anuncio/[id]', params: { id: report.anuncioId! } })}
          />
        ) : null}
        {report.conversaId ? (
          <LinkButton
            label="Abrir conversa"
            icon={<MessagesSquare size={14} color={colors.red} />}
            onPress={() => router.push({ pathname: '/admin/conversas/[id]', params: { id: report.conversaId! } })}
          />
        ) : null}
      </View>
      {report.status === 'ABERTA' ? (
        <View style={styles.decision}>
          <TextField
            label="Nota da equipe (opcional)"
            value={note}
            onChangeText={setNote}
            placeholder="Ex.: anúncio retirado e conta bloqueada"
            maxLength={500}
            editable={!decide.isPending}
          />
          <View style={styles.row}>
            <Button
              label="Resolvida"
              onPress={() => decide.mutate('RESOLVIDA')}
              loading={decide.isPending && decide.variables === 'RESOLVIDA'}
              disabled={decide.isPending}
              style={styles.flex}
            />
            <Button
              label="Descartar"
              variant="secondary"
              onPress={() => decide.mutate('DESCARTADA')}
              loading={decide.isPending && decide.variables === 'DESCARTADA'}
              disabled={decide.isPending}
              style={styles.flex}
            />
          </View>
          {decide.isError ? <Notice tone="error" message={decide.error.message} /> : null}
        </View>
      ) : (
        <AppText variant="caption" color="muted">
          {statusLabel[report.status]} por {report.decididaPor ?? 'conta excluída'}
          {report.decididaEm ? ` em ${formatDateTime(report.decididaEm)}` : ''}
          {report.nota ? `: ${report.nota}` : '.'}
        </AppText>
      )}
    </View>
  );
}

function LinkButton({ label, icon, onPress }: { label: string; icon: ReactNode; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} hitSlop={8} accessibilityRole="link" accessibilityLabel={label} style={styles.link}>
      {icon}
      <AppText variant="label" color="red">
        {label}
      </AppText>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  content: { padding: space.lg },
  header: { gap: space.sm, marginBottom: space.md },
  gap: { height: space.md },
  skeletons: { gap: space.md },
  footer: { marginVertical: space.lg },
  card: { padding: space.lg, borderRadius: radius.lg, borderWidth: StyleSheet.hairlineWidth, gap: space.sm },
  row: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  quote: { padding: space.md, borderLeftWidth: 2, borderRadius: radius.sm },
  people: { gap: 2 },
  links: { flexDirection: 'row', flexWrap: 'wrap', gap: space.lg },
  link: { flexDirection: 'row', alignItems: 'center', gap: space.xs, minHeight: 44 },
  decision: { gap: space.sm },
});
