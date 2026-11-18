import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import * as Haptics from 'expo-haptics';
import { Rocket, Trash2 } from 'lucide-react-native';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { boostsApi } from '@/api/admin';
import { AppText } from '@/components/app-text';
import { Button } from '@/components/button';
import { ChoiceRow } from '@/components/choice-row';
import { Notice } from '@/components/notice';
import { useTheme } from '@/hooks/use-theme';
import { radius, space } from '@/theme';

import { boostPriorityLabels, boostsKey } from './boosts';
import { formatDateTime } from './format';

const periods: { value: string; label: string }[] = [
  { value: '7', label: '7 dias' },
  { value: '15', label: '15 dias' },
  { value: '30', label: '30 dias' },
  { value: '', label: 'Sem prazo' },
];

/**
 * Impulso manual do anúncio (AdBoostPanel do site), só para ADMIN e DONO: prioridade acima de qualquer plano, com
 * prazo opcional. As regras (só publicado, lote inteiro) são do servidor.
 */
export function AdBoostPanel({ anuncioId }: { anuncioId: string }) {
  const { colors } = useTheme();
  const cache = useQueryClient();
  const boosts = useQuery({ queryKey: boostsKey, queryFn: ({ signal }) => boostsApi.list(signal) });
  const current = boosts.data?.find((item) => item.anuncioId === anuncioId) ?? null;
  const [priority, setPriority] = useState<string | undefined>(undefined);
  const [days, setDays] = useState('15');
  const chosenPriority = (Number(priority ?? current?.prioridade ?? 2) || 2) as 1 | 2 | 3;

  const save = useMutation({
    mutationFn: () => boostsApi.boost(anuncioId, chosenPriority, days ? Number(days) : null),
    onSuccess: () => {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      cache.invalidateQueries({ queryKey: boostsKey });
    },
  });
  const remove = useMutation({
    mutationFn: () => boostsApi.remove(anuncioId),
    onSuccess: () => cache.invalidateQueries({ queryKey: boostsKey }),
  });
  const busy = save.isPending || remove.isPending;
  const error = save.error ?? remove.error ?? boosts.error;

  return (
    <View style={[styles.root, { backgroundColor: colors.surface, borderColor: colors.border }]}>
      <View style={styles.title}>
        <Rocket size={18} color={colors.red} />
        <AppText variant="heading" accessibilityRole="header">
          Impulsionar anúncio
        </AppText>
      </View>
      <AppText variant="caption" color="muted">
        {boosts.isPending
          ? 'Consultando o impulso…'
          : current
            ? `${current.vigente ? 'Impulsionado' : 'Impulso sem efeito'} · prioridade ${boostPriorityLabels[current.prioridade].toLowerCase()}${
                current.ate ? ` até ${formatDateTime(current.ate)}` : ' sem prazo'
              }`
            : 'Fica nas vagas de destaque, acima dos planos, em todo o Brasil. Visível só para a administração.'}
      </AppText>
      <View style={styles.field}>
        <AppText variant="label">Prioridade</AppText>
        <ChoiceRow
          value={String(chosenPriority)}
          onChange={setPriority}
          disabled={busy}
          options={([3, 2, 1] as const).map((value) => ({ value: String(value), label: boostPriorityLabels[value] }))}
        />
      </View>
      <View style={styles.field}>
        <AppText variant="label">Prazo</AppText>
        <ChoiceRow value={days} onChange={setDays} disabled={busy} options={periods} />
      </View>
      {error ? <Notice tone="error" message={error.message} /> : null}
      <View style={styles.actions}>
        <Button
          label={current ? 'Atualizar impulso' : 'Impulsionar'}
          icon={<Rocket size={16} color={colors.onRed} />}
          loading={save.isPending}
          disabled={busy || boosts.isPending}
          onPress={() => save.mutate()}
          style={styles.flex}
        />
        {current ? (
          <Button
            label="Remover"
            variant="secondary"
            icon={<Trash2 size={16} color={colors.text} />}
            loading={remove.isPending}
            disabled={busy}
            onPress={() => remove.mutate()}
          />
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { borderRadius: radius.lg, borderWidth: StyleSheet.hairlineWidth, padding: space.lg, gap: space.md },
  title: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  field: { gap: space.sm },
  actions: { flexDirection: 'row', gap: space.sm },
  flex: { flex: 1 },
});
