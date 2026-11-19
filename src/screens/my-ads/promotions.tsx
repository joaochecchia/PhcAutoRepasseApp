import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import * as Haptics from 'expo-haptics';
import { router } from 'expo-router';
import { CalendarClock, Pause, PencilLine, Play, Plus, TicketPercent, Trash2, WifiOff } from 'lucide-react-native';
import { useState, type ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';

import { promotionsApi, type Promotion, type PromotionStatus } from '@/api/promotions';
import { AppText } from '@/components/app-text';
import { Button } from '@/components/button';
import { showDialog } from '@/components/dialog';
import { Notice } from '@/components/notice';
import { Skeleton } from '@/components/skeleton';
import { StateView } from '@/components/state-view';
import { useTheme } from '@/hooks/use-theme';
import type { Colors } from '@/theme';
import { radius, space } from '@/theme';
import { PromotionEditor } from './promotion-editor';

const statusLabels: Record<PromotionStatus, string> = {
  NO_AR: 'No ar',
  AGENDADA: 'Agendada',
  PAUSADA: 'Pausada',
  ENCERRADA: 'Encerrada',
  SEM_PLANO: 'Fora do plano',
};
const statusTone: Record<PromotionStatus, { bg: keyof Colors; text: keyof Colors }> = {
  NO_AR: { bg: 'dealTint', text: 'deal' },
  AGENDADA: { bg: 'subtle', text: 'text' },
  PAUSADA: { bg: 'subtle', text: 'muted' },
  ENCERRADA: { bg: 'subtle', text: 'muted' },
  SEM_PLANO: { bg: 'redTint', text: 'red' },
};
const dayMonth = new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: 'short', timeZone: 'UTC' });
const fmt = (date: string) => dayMonth.format(new Date(`${date}T00:00:00Z`)).replace('.', '');
const period = (p: Promotion) => (p.fim ? `${fmt(p.inicio)} a ${fmt(p.fim)}` : `Desde ${fmt(p.inicio)}, sem data final`);
function scopeText(p: Promotion) {
  if (p.abrangencia === 'TODOS') return 'Todos os veículos';
  const ads = p.anuncioIds.length;
  const lots = p.loteIds.length;
  return (
    [ads && `${ads} ${ads === 1 ? 'anúncio' : 'anúncios'}`, lots && `${lots} ${lots === 1 ? 'lote' : 'lotes'}`]
      .filter(Boolean)
      .join(' e ') || 'Nenhum veículo à venda'
  );
}

/** Aba Promoções de Meus anúncios (PromotionsManager do site, sem o modo do dono). */
export function PromotionsPanel({ header }: { header: ReactNode }) {
  const { colors } = useTheme();
  const cache = useQueryClient();
  const panel = useQuery({ queryKey: ['my-promotions'], queryFn: ({ signal }) => promotionsApi.mine(signal) });
  // undefined: fechado; null: nova promoção.
  const [editing, setEditing] = useState<Promotion | null | undefined>(undefined);
  const [flash, setFlash] = useState('');

  const refresh = () => {
    cache.invalidateQueries({ queryKey: ['my-promotions'] });
    cache.invalidateQueries({ queryKey: ['store-promotions'] });
    cache.invalidateQueries({ queryKey: ['my-ads'] });
  };
  const toggle = useMutation({
    mutationFn: (promotion: Promotion) => promotionsApi.setActive(promotion.id, !promotion.ativa),
    onSuccess: (saved) => {
      Haptics.selectionAsync();
      setFlash(saved.ativa ? 'Promoção retomada.' : 'Promoção pausada.');
      refresh();
    },
    onError: (error) => showDialog({ title: 'Não foi possível alterar a promoção', message: error.message }),
  });
  const remove = useMutation({
    mutationFn: (promotion: Promotion) => promotionsApi.remove(promotion.id),
    onSuccess: () => {
      setFlash('Promoção excluída.');
      refresh();
    },
    onError: (error) => showDialog({ title: 'Não foi possível excluir a promoção', message: error.message }),
  });

  const data = panel.data;
  const planIncludes = data?.planoInclui ?? true;
  const reachedLimit = Boolean(data && data.promocoes.length >= data.limite);

  return (
    <View style={styles.root}>
      {header}
      <View style={styles.intro}>
        <AppText color="muted">
          Parcelamento, financiamento, IPVA pago ou desconto. Os veículos da promoção ganham uma etiqueta na foto, e a
          página da loja mostra que você está com promoção.
        </AppText>
        <Button
          label="Nova promoção"
          icon={<Plus size={17} color={colors.onRed} />}
          disabled={!data || !planIncludes || reachedLimit}
          onPress={() => setEditing(null)}
        />
      </View>
      {data && !planIncludes ? (
        <Notice
          title="Promoções não incluídas no seu plano"
          message={
            data.promocoes.length
              ? 'Suas promoções estão guardadas, mas não aparecem para os compradores porque o seu plano atual não inclui promoções.'
              : 'O seu plano atual não inclui promoções com etiqueta nos anúncios.'
          }
          actionLabel="Ver meu plano"
          onAction={() => router.push('/planos')}
        />
      ) : null}
      {data && planIncludes && reachedLimit ? (
        <Notice message={`Você chegou ao limite de ${data.limite} promoções. Exclua uma encerrada para criar outra.`} />
      ) : null}
      {flash ? <Notice tone="success" message={flash} /> : null}

      {panel.isError ? (
        <StateView
          icon={WifiOff}
          title="As promoções não carregaram"
          message={panel.error.message}
          actionLabel="Tentar de novo"
          onAction={() => panel.refetch()}
          compact
        />
      ) : !data ? (
        <View style={styles.list}>
          <Skeleton height={150} rounded={radius.lg} />
          <Skeleton height={150} rounded={radius.lg} />
        </View>
      ) : data.promocoes.length === 0 ? (
        planIncludes ? (
          <StateView
            icon={TicketPercent}
            title="Nenhuma promoção criada"
            message="Monte uma oferta, escolha se vale para todos os veículos ou só para alguns, e defina até quando fica no ar."
            actionLabel="Criar primeira promoção"
            onAction={() => setEditing(null)}
            compact
          />
        ) : null
      ) : (
        <View style={styles.list}>
          {data.promocoes.map((promotion) => (
            <PromotionCard
              key={promotion.id}
              promotion={promotion}
              canEdit={planIncludes}
              toggling={toggle.isPending && toggle.variables?.id === promotion.id}
              busy={(toggle.isPending && toggle.variables?.id === promotion.id) || (remove.isPending && remove.variables?.id === promotion.id)}
              onEdit={() => setEditing(promotion)}
              onToggle={() => toggle.mutate(promotion)}
              onDelete={() => remove.mutate(promotion)}
            />
          ))}
        </View>
      )}
      <PromotionEditor
        promotion={editing}
        onClose={() => setEditing(undefined)}
        onSaved={(_, created) => {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          setFlash(created ? 'Promoção criada.' : 'Promoção salva.');
          setEditing(undefined);
          refresh();
        }}
      />
    </View>
  );
}

/** Cartão de uma promoção: situação, condições, período e ações. {@code showStore}: painel do DONO. */
export function PromotionCard({
  promotion,
  canEdit,
  busy,
  toggling,
  showStore,
  onEdit,
  onToggle,
  onDelete,
}: {
  promotion: Promotion;
  canEdit: boolean;
  busy: boolean;
  toggling: boolean;
  showStore?: boolean;
  onEdit: () => void;
  onToggle: () => void;
  onDelete: () => void;
}) {
  const { colors } = useTheme();
  const tone = statusTone[promotion.situacao];
  const canResume = promotion.situacao !== 'SEM_PLANO' && promotion.situacao !== 'ENCERRADA';
  return (
    <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
      <View style={[styles.status, { backgroundColor: colors[tone.bg] }]}>
        <AppText variant="label" color={tone.text} style={styles.statusText}>
          {statusLabels[promotion.situacao]}
        </AppText>
      </View>
      {showStore && promotion.nomeAnunciante ? (
        <AppText variant="caption" color="muted">
          {promotion.nomeAnunciante}
        </AppText>
      ) : null}
      <AppText variant="heading">{promotion.titulo}</AppText>
      <View style={styles.conditions}>
        {promotion.condicoes.map((condition, index) => (
          <AppText key={condition.tipo} variant={index === 0 ? 'bodyStrong' : 'body'} color={index === 0 ? 'red' : 'text'}>
            {condition.resumo}
          </AppText>
        ))}
      </View>
      <View style={styles.meta}>
        <CalendarClock size={14} color={colors.muted} />
        <AppText variant="caption" color="muted" style={styles.flex}>
          {period(promotion)} · {scopeText(promotion)}
        </AppText>
      </View>
      <View style={styles.actions}>
        <Button
          label="Editar"
          variant="secondary"
          icon={<PencilLine size={15} color={colors.text} />}
          disabled={busy || !canEdit}
          onPress={onEdit}
          style={styles.flex}
        />
        {promotion.ativa ? (
          <Button
            label="Pausar"
            variant="secondary"
            icon={<Pause size={15} color={colors.text} />}
            loading={toggling}
            disabled={busy}
            onPress={onToggle}
            style={styles.flex}
          />
        ) : (
          <Button
            label="Retomar"
            variant="secondary"
            icon={<Play size={15} color={colors.text} />}
            loading={toggling}
            disabled={busy || !canResume}
            accessibilityHint={
              canResume ? undefined : promotion.situacao === 'ENCERRADA' ? 'Edite a data final para retomar' : 'O plano atual não inclui promoções'
            }
            onPress={onToggle}
            style={styles.flex}
          />
        )}
        <Button
          label="Excluir"
          variant="ghost"
          icon={<Trash2 size={15} color={colors.red} />}
          disabled={busy}
          onPress={() =>
            showDialog({
              title: 'Excluir promoção?',
              message: `${promotion.titulo} sai do app, do site e das etiquetas dos veículos. Para tirar do ar só por um tempo, use "Pausar".`,
              actions: [
                { label: 'Manter', kind: 'cancel' },
                { label: 'Excluir', kind: 'destructive', onPress: onDelete },
              ],
            })
          }
        />
      </View>
      {!canResume && !promotion.ativa ? (
        <AppText variant="caption" color="muted">
          {promotion.situacao === 'ENCERRADA' ? 'Edite a data final para retomar.' : 'O plano atual não inclui promoções.'}
        </AppText>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { gap: space.lg },
  flex: { flex: 1 },
  intro: { gap: space.md },
  list: { gap: space.md },
  card: { padding: space.lg, borderRadius: radius.lg, borderWidth: StyleSheet.hairlineWidth, gap: space.sm },
  status: { alignSelf: 'flex-start', paddingHorizontal: space.sm, paddingVertical: 3, borderRadius: radius.pill },
  statusText: { fontSize: 11 },
  conditions: { gap: 2 },
  meta: { flexDirection: 'row', alignItems: 'center', gap: space.xs },
  actions: { flexDirection: 'row', gap: space.sm, marginTop: space.xs },
});
