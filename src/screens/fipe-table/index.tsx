import { useQuery, useQueryClient } from '@tanstack/react-query';
import { router } from 'expo-router';
import { Table2 } from 'lucide-react-native';
import { useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { announceApi, type FipeReference } from '@/api/announce';
import { AppText } from '@/components/app-text';
import { Button } from '@/components/button';
import { Chip } from '@/components/chip';
import { Notice } from '@/components/notice';
import { StateView } from '@/components/state-view';
import { useSession } from '@/hooks/use-session';
import { useTheme } from '@/hooks/use-theme';
import { radius, space } from '@/theme';
import { formatCents } from '@/utils/format';
import { FipeSelector } from '@/screens/announce/fipe-selector';

type Kind = 'cars' | 'motorcycles' | 'trucks';
const kinds: { value: Kind; label: string }[] = [
  { value: 'cars', label: 'Carros e caminhonetes' },
  { value: 'motorcycles', label: 'Motos' },
  { value: 'trucks', label: 'Caminhões' },
];
const monthYear = new Intl.DateTimeFormat('pt-BR', { month: 'long', year: 'numeric', timeZone: 'UTC' });

/** Consulta avulsa da tabela FIPE; cada veículo novo gasta uma consulta da cota do plano (FipeTablePage do site). */
export function FipeTableScreen() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const cache = useQueryClient();
  const session = useSession();
  const signedIn = session.status === 'authenticated';
  const [kind, setKind] = useState<Kind>('cars');
  const [result, setResult] = useState<FipeReference | null>(null);
  const quota = useQuery({
    queryKey: ['fipe-quota-for-ad'],
    queryFn: announceApi.fipeQuota,
    enabled: signedIn,
    staleTime: 0,
  });

  if (!signedIn)
    return (
      <View style={[styles.flex, { backgroundColor: colors.bg }]}>
        <StateView
          icon={Table2}
          title="Entre para consultar a FIPE"
          message="Cada conta tem consultas FIPE por mês, conforme o plano."
          actionLabel="Entrar"
          onAction={() => router.push('/entrar')}
        />
      </View>
    );

  const q = quota.data;
  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={[styles.flex, { backgroundColor: colors.bg }]}>
      <ScrollView
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + space.xl }]}>
        <AppText color="muted">Preço médio de referência de carros, motos e caminhões, antes de comprar ou anunciar.</AppText>

        {quota.isError ? (
          <Notice
            tone="error"
            message="Não foi possível ver suas consultas do mês."
            actionLabel="Tentar de novo"
            actionLoading={quota.isFetching}
            onAction={() => quota.refetch()}
          />
        ) : q ? (
          <View style={[styles.quota, { backgroundColor: colors.subtle }]}>
            {q.ilimitado ? (
              <AppText variant="bodyStrong">Consultas FIPE ilimitadas no seu plano.</AppText>
            ) : (
              <>
                <AppText>
                  <AppText variant="bodyStrong">
                    {q.restantes ?? 0} de {q.limite ?? 0}
                  </AppText>{' '}
                  consultas disponíveis neste mês.
                </AppText>
                <View style={[styles.meter, { backgroundColor: colors.border }]}>
                  <View
                    style={[
                      styles.meterFill,
                      {
                        backgroundColor: (q.restantes ?? 0) === 0 ? colors.muted : colors.red,
                        width: `${q.limite ? Math.round(((q.restantes ?? 0) / q.limite) * 100) : 0}%`,
                      },
                    ]}
                  />
                </View>
                {(q.restantes ?? 0) === 0 ? (
                  <Button label="Ver meu plano" variant="ghost" onPress={() => router.push('/planos')} />
                ) : null}
              </>
            )}
          </View>
        ) : null}

        <View style={styles.kinds}>
          {kinds.map((item) => (
            <Chip
              key={item.value}
              label={item.label}
              selected={kind === item.value}
              onPress={() => {
                setKind(item.value);
                setResult(null);
              }}
            />
          ))}
        </View>
        <AppText variant="caption" color="muted">
          Para veículos novos, escolha “Zero km” no ano, quando a marca tiver.
        </AppText>

        <FipeSelector
          key={kind}
          tipo={kind}
          zeroKm={false}
          zeroKmAsYear
          hideReference
          reference={result}
          onBrand={() => setResult(null)}
          onYear={() => setResult(null)}
          onClear={() => setResult(null)}
          onResolved={(reference) => {
            setResult(reference);
            cache.invalidateQueries({ queryKey: ['fipe-quota-for-ad'] });
          }}
        />

        {result ? (
          <View
            accessibilityLiveRegion="polite"
            style={[styles.result, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <AppText variant="overline" color="muted">
              {result.marca}
            </AppText>
            <AppText variant="heading">{result.modelo}</AppText>
            <AppText color="muted">
              {result.zeroKm ? 'Zero km' : result.anoModelo}
              {result.combustivel ? ` · ${result.combustivel}` : ''}
            </AppText>
            <AppText variant="display" style={styles.price}>
              {formatCents(result.valorCentavos)}
            </AppText>
            <View style={[styles.facts, { borderTopColor: colors.border }]}>
              <View style={styles.fact}>
                <AppText variant="caption" color="muted">
                  Referência
                </AppText>
                <AppText variant="bodyStrong">{monthYear.format(new Date(`${result.mesReferencia}T00:00:00Z`))}</AppText>
              </View>
              {result.codigoFipe ? (
                <View style={styles.fact}>
                  <AppText variant="caption" color="muted">
                    Código FIPE
                  </AppText>
                  <AppText variant="bodyStrong">{result.codigoFipe}</AppText>
                </View>
              ) : null}
            </View>
          </View>
        ) : (
          <AppText variant="caption" color="muted">
            Escolha marca, ano e modelo para ver o preço de referência.
          </AppText>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  content: { padding: space.lg, gap: space.lg },
  quota: { padding: space.md, borderRadius: radius.md, gap: space.sm },
  meter: { height: 6, borderRadius: 3, overflow: 'hidden' },
  meterFill: { height: 6, borderRadius: 3 },
  kinds: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  result: { padding: space.lg, borderRadius: radius.lg, borderWidth: StyleSheet.hairlineWidth, gap: 2 },
  price: { marginTop: space.sm },
  facts: { flexDirection: 'row', gap: space.xl, marginTop: space.md, paddingTop: space.md, borderTopWidth: StyleSheet.hairlineWidth },
  fact: { gap: 2 },
});
