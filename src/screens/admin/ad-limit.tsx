import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import * as Haptics from 'expo-haptics';
import { WifiOff } from 'lucide-react-native';
import { useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { adLimitApi, type AdLimitRelease } from '@/api/admin';
import { plansApi } from '@/api/plans';
import { AppText } from '@/components/app-text';
import { showDialog } from '@/components/dialog';
import { Notice } from '@/components/notice';
import { Skeleton } from '@/components/skeleton';
import { StateView } from '@/components/state-view';
import { useTheme } from '@/hooks/use-theme';
import { radius, space } from '@/theme';

import { AdminGate } from './admin-gate';
import { formatDateTime } from './format';
import { adminStyles, Segmented } from './ui';

const key = ['admin', 'ad-limit'] as const;

/** Liberação do limite de anúncios (AdminAdLimit do site, só DONO). A regra fica no servidor. */
export function AdLimitScreen() {
  return (
    <AdminGate owner>
      <AdLimit />
    </AdminGate>
  );
}

function AdLimit() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const cache = useQueryClient();
  const release = useQuery({ queryKey: key, queryFn: ({ signal }) => adLimitApi.get(signal) });
  const plans = useQuery({ queryKey: ['plans'], queryFn: ({ signal }) => plansApi.list(signal), staleTime: 10 * 60_000 });
  const freeLimit = plans.data?.find((plan) => plan.gratuito)?.beneficios.limiteAnuncios;
  const [saved, setSaved] = useState('');

  const change = useMutation({
    mutationFn: (ativa: boolean) => adLimitApi.set(ativa),
    onMutate: () => setSaved(''),
    onSuccess: (value: AdLimitRelease) => {
      cache.setQueryData(key, value);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setSaved(
        value.ativa
          ? 'Anúncios liberados: qualquer anunciante já pode publicar sem limite.'
          : value.preservados > 0
            ? `Limite do plano de volta. ${value.preservados} ${value.preservados === 1 ? 'anúncio acima do limite continua' : 'anúncios acima do limite continuam'} no ar.`
            : 'Limite do plano de volta. Nenhum anúncio saiu do ar.',
      );
    },
  });

  function choose(ativa: boolean) {
    const current = release.data;
    if (!current || current.ativa === ativa) return;
    showDialog({
      title: ativa ? 'Liberar anúncios ilimitados?' : 'Voltar ao limite do plano?',
      message: ativa
        ? 'Qualquer anunciante, inclusive sem plano, passa a publicar sem limite de quantidade.'
        : 'Nenhum anúncio sai do ar. Quem estiver acima do limite só publica outro quando ficar abaixo dele.',
      actions: [
        { label: 'Cancelar', kind: 'cancel' },
        { label: ativa ? 'Liberar' : 'Voltar ao limite', onPress: () => change.mutate(ativa) },
      ],
    });
  }

  if (release.isError) {
    return (
      <View style={[styles.root, { backgroundColor: colors.bg }]}>
        <StateView icon={WifiOff} title="O limite não carregou" message={release.error.message} actionLabel="Tentar de novo" onAction={() => release.refetch()} />
      </View>
    );
  }

  const data = release.data;
  const planLabel = freeLimit != null ? `Limite do plano (Free: ${freeLimit})` : 'Limite do plano';
  return (
    <ScrollView style={{ backgroundColor: colors.bg }} contentContainerStyle={[adminStyles.content, { paddingBottom: insets.bottom + space.xxl }]}>
      <AppText color="muted">
        Libere anúncios ilimitados para todos, inclusive quem não tem plano. Vale só para a quantidade de anúncios
        publicados: renovações, destaque, selo, consultas FIPE e os outros benefícios continuam dos assinantes.
      </AppText>
      {!data ? (
        <Skeleton height={140} rounded={radius.lg} />
      ) : (
        <View style={[adminStyles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <Segmented
            label="Limite de anúncios publicados"
            value={data.ativa ? 'livre' : 'plano'}
            disabled={change.isPending}
            onChange={(value) => choose(value === 'livre')}
            options={[
              { value: 'plano', label: planLabel },
              { value: 'livre', label: 'Ilimitados para todos' },
            ]}
          />
          <AppText variant="bodyStrong">
            {data.ativa ? 'Liberado: ninguém tem limite de anúncios publicados.' : 'Cada anunciante segue o limite do próprio plano.'}
          </AppText>
          {data.alteradaEm ? (
            <AppText variant="caption" color="muted">
              Alterado em {formatDateTime(data.alteradaEm)}
              {data.alteradaPor ? ` por ${data.alteradaPor}` : ''}.
            </AppText>
          ) : null}
          {!data.ativa && data.preservados > 0 ? (
            <AppText variant="caption">
              {data.preservados} {data.preservados === 1 ? 'anúncio publicado continua' : 'anúncios publicados continuam'} no ar
              acima do limite, da época da liberação.
            </AppText>
          ) : null}
        </View>
      )}
      {saved ? <Notice tone="success" message={saved} /> : null}
      {change.isError ? <Notice tone="error" message={change.error.message} /> : null}
      <AppText variant="caption" color="muted">
        Ao voltar para o limite do plano, nenhum anúncio é pausado ou excluído: quem passou do limite mantém os anúncios
        no ar, mas não publica novos até ficar abaixo dele.
      </AppText>
    </ScrollView>
  );
}

const styles = StyleSheet.create({ root: { flex: 1 } });
