import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import * as Haptics from 'expo-haptics';
import { router, type Href } from 'expo-router';
import { Rocket, Trash2, WifiOff } from 'lucide-react-native';
import { FlatList, Pressable, RefreshControl, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { boostsApi, type AdBoost } from '@/api/admin';
import { AppText } from '@/components/app-text';
import { Button } from '@/components/button';
import { showDialog } from '@/components/dialog';
import { Skeleton } from '@/components/skeleton';
import { StateView } from '@/components/state-view';
import { useTheme } from '@/hooks/use-theme';
import { radius, space } from '@/theme';

import { AdminGate } from './admin-gate';
import { formatDateTime } from './format';
import { Tag } from './ui';

export const boostsKey = ['admin', 'boosts'] as const;
export const boostPriorityLabels: Record<1 | 2 | 3, string> = { 1: 'Normal', 2: 'Alta', 3: 'Máxima' };

/**
 * Anúncios impulsionados (AdminBoosts do site). Impulsionar é feito na tela do anúncio; aqui se acompanha e remove.
 * Expirados continuam na lista até alguém remover.
 */
export function BoostsScreen() {
  return (
    <AdminGate>
      <Boosts />
    </AdminGate>
  );
}

function Boosts() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const cache = useQueryClient();
  const boosts = useQuery({ queryKey: boostsKey, queryFn: ({ signal }) => boostsApi.list(signal) });
  const remove = useMutation({
    mutationFn: (boost: AdBoost) => boostsApi.remove(boost.anuncioId),
    onSuccess: (_, boost) => {
      Haptics.selectionAsync();
      cache.setQueryData<AdBoost[]>(boostsKey, (list) => list?.filter((item) => item.anuncioId !== boost.anuncioId));
    },
    onError: (error) => showDialog({ title: 'Não foi possível remover o impulso', message: error.message }),
  });

  const intro = (
    <AppText color="muted" style={styles.intro}>
      Impulsionados ocupam as vagas de destaque (3 a cada 10 posições) na busca e na tela inicial, acima dos planos.
      Para impulsionar, abra o anúncio e use Impulsionar.
    </AppText>
  );

  if (boosts.isError) {
    return (
      <View style={[styles.root, { backgroundColor: colors.bg }]}>
        <StateView icon={WifiOff} title="Os impulsos não carregaram" message={boosts.error.message} actionLabel="Tentar de novo" onAction={() => boosts.refetch()} />
      </View>
    );
  }

  return (
    <FlatList
      style={{ backgroundColor: colors.bg }}
      contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + space.xxl }]}
      data={boosts.data ?? []}
      keyExtractor={(item) => item.anuncioId}
      ListHeaderComponent={intro}
      refreshControl={<RefreshControl refreshing={boosts.isRefetching} onRefresh={() => void boosts.refetch()} tintColor={colors.red} />}
      ListEmptyComponent={
        boosts.isPending ? (
          <View style={styles.list}>
            <Skeleton height={120} rounded={radius.lg} />
            <Skeleton height={120} rounded={radius.lg} />
          </View>
        ) : (
          <StateView icon={Rocket} title="Nenhum anúncio impulsionado" message="Os anúncios que você impulsionar aparecem aqui, com prioridade e prazo." compact />
        )
      }
      renderItem={({ item }) => {
        const busy = remove.isPending && remove.variables?.anuncioId === item.anuncioId;
        const href = (item.loteId ? `/lote/${item.loteId}` : `/anuncio/${item.anuncioId}`) as Href;
        return (
          <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border, opacity: item.vigente ? 1 : 0.75 }]}>
            <Pressable
              onPress={() => router.push(href)}
              accessibilityRole="button"
              accessibilityHint="Abre o anúncio"
              style={styles.cardMain}>
              <Tag label={`Prioridade ${boostPriorityLabels[item.prioridade].toLowerCase()}`} tone={item.vigente ? 'good' : 'neutral'} />
              <AppText variant="heading">
                {item.titulo}
                {item.loteId ? ' · lote' : ''}
              </AppText>
              <AppText variant="caption" color="muted">
                {item.anunciante} · {item.cidade}, {item.uf}
              </AppText>
              <AppText variant="caption">
                {item.vigente
                  ? item.ate
                    ? `Até ${formatDateTime(item.ate)}`
                    : 'Sem prazo'
                  : item.status !== 'PUBLICADO'
                    ? 'Fora da vitrine: sem efeito'
                    : 'Prazo encerrado'}
                {` · por ${item.impulsionadoPor ?? 'conta removida'} em ${formatDateTime(item.impulsionadoEm)}`}
              </AppText>
            </Pressable>
            <Button
              label="Remover impulso"
              variant="secondary"
              icon={<Trash2 size={16} color={colors.text} />}
              loading={busy}
              onPress={() =>
                showDialog({
                  title: 'Remover impulso?',
                  message: `${item.titulo} sai das vagas de destaque e volta à posição do plano do anunciante.`,
                  actions: [
                    { label: 'Manter', kind: 'cancel' },
                    { label: 'Remover', kind: 'destructive', onPress: () => remove.mutate(item) },
                  ],
                })
              }
            />
          </View>
        );
      }}
      ItemSeparatorComponent={() => <View style={styles.gap} />}
    />
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  content: { padding: space.lg },
  intro: { marginBottom: space.lg },
  list: { gap: space.md },
  gap: { height: space.md },
  card: { borderRadius: radius.lg, borderWidth: StyleSheet.hairlineWidth, padding: space.lg, gap: space.md },
  cardMain: { gap: space.xs },
});
