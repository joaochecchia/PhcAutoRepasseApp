import { useMutation, useQuery } from '@tanstack/react-query';
import { router, type Href } from 'expo-router';
import { BatteryCharging, CarFront, ScanSearch, ShieldCheck } from 'lucide-react-native';
import { useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ApiError } from '@/api/client';
import { normalizePlate, platesApi, type PlateData, type PlateQuota } from '@/api/plates';
import { AppText } from '@/components/app-text';
import { Button } from '@/components/button';
import { Notice } from '@/components/notice';
import { StateView } from '@/components/state-view';
import { PlateField } from '@/components/plate-field';
import { useSession } from '@/hooks/use-session';
import { useTheme } from '@/hooks/use-theme';
import { radius, space } from '@/theme';
import { formatCents } from '@/utils/format';

const integer = new Intl.NumberFormat('pt-BR');

const money = (cents: number | null | undefined) => (cents == null ? '—' : formatCents(cents));

/** "2026-11" → "nov/2026". */
function monthLabel(value: string | null) {
  if (!value || !/^\d{4}-\d{2}$/.test(value)) return value ?? '';
  const [year, month] = value.split('-').map(Number);
  const names = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];
  return `${names[month - 1]}/${year}`;
}

/** Texto do cadastro do veículo (MAIÚSCULAS SEM ACENTO) mais legível: "SAO PAULO" → "Sao Paulo". */
function readable(value: string | null | undefined) {
  if (!value) return null;
  return value.toLowerCase().replace(/(^|[\s/-])(\p{L})/gu, (_, sep: string, letter: string) => sep + letter.toUpperCase());
}

function quotaText(quota: PlateQuota) {
  if (quota.ilimitada) return 'Consultas ilimitadas na sua assinatura.';
  return `${quota.usadas} de ${quota.limite} consultas usadas neste mês. Assinantes consultam sem limite.`;
}

/**
 * Consulta por placa (PlateLookupPage do site): dados do veículo, versão e preço FIPE com histórico, ficha técnica e
 * bateria indicada. Assinante consulta sem limite; sem assinatura, 2 placas por mês (regra do backend).
 */
export function PlateLookupScreen() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const session = useSession();
  const signedIn = session.status === 'authenticated';
  const [plate, setPlate] = useState('');
  const [inputError, setInputError] = useState<string | null>(null);
  const quota = useQuery({ queryKey: ['plate-quota'], queryFn: platesApi.quota, enabled: signedIn, staleTime: 0 });
  // A resposta já traz o uso do mês atualizado (cota).
  const lookup = useMutation({ mutationFn: platesApi.lookup });
  const result = lookup.data?.dados ?? null;
  const shownQuota = lookup.data?.cota ?? quota.data;
  const limitReached = lookup.error instanceof ApiError && lookup.error.status === 403;

  if (!signedIn)
    return (
      <View style={[styles.flex, { backgroundColor: colors.bg }]}>
        <StateView
          icon={ScanSearch}
          title="Entre para consultar placas"
          message="Sem assinatura são 2 placas por mês; assinantes consultam sem limite."
          actionLabel="Entrar"
          onAction={() => router.push('/entrar')}
        />
      </View>
    );

  function submit() {
    const normalized = normalizePlate(plate);
    if (!normalized) {
      setInputError('Digite a placa completa, no padrão ABC1D23 ou ABC-1234.');
      return;
    }
    setInputError(null);
    lookup.mutate(normalized);
  }

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={[styles.flex, { backgroundColor: colors.bg }]}>
      <ScrollView
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + space.xl }]}>
        <AppText color="muted">
          Digite a placa para ver marca, modelo, ano, cor, a versão e o preço na tabela FIPE e a ficha técnica do veículo.
        </AppText>

        <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.red }]}>
          <PlateField
            value={plate}
            onChangeText={(value) => {
              setPlate(value);
              setInputError(null);
            }}
            onSubmitEditing={submit}
            error={inputError}
          />
          <Button label="Consultar" icon={<ScanSearch size={18} color={colors.onRed} />} loading={lookup.isPending} onPress={submit} />
          <AppText variant="caption" color="muted" accessibilityLiveRegion="polite">
            {shownQuota ? quotaText(shownQuota) : quota.isError ? 'Não foi possível ver suas consultas do mês.' : 'Conferindo suas consultas do mês…'}
          </AppText>
        </View>

        {lookup.isError ? (
          <Notice
            tone="error"
            message={lookup.error.message}
            actionLabel={limitReached ? 'Ver planos' : undefined}
            onAction={limitReached ? () => router.push('/planos' as Href) : undefined}
          />
        ) : null}

        {result ? (
          <PlateResult data={result} />
        ) : !lookup.isPending && !lookup.isError ? (
          <View style={[styles.empty, { borderColor: colors.border }]}>
            <CarFront size={34} color={colors.muted} />
            <AppText color="muted" style={styles.center}>
              Os dados vêm do cadastro do veículo e da tabela FIPE. Não mostramos nada do proprietário.
            </AppText>
          </View>
        ) : null}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function Info({ label, value }: { label: string; value: string | number | null | undefined }) {
  if (value == null || value === '') return null;
  return (
    <View style={styles.info}>
      <AppText variant="caption" color="muted">
        {label}
      </AppText>
      <AppText variant="bodyStrong">{value}</AppText>
    </View>
  );
}

function Section({ title, icon, children }: { title: string; icon?: React.ReactNode; children: React.ReactNode }) {
  const { colors } = useTheme();
  return (
    <View style={[styles.section, { borderTopColor: colors.border }]}>
      <View style={styles.sectionTitle}>
        {icon}
        <AppText variant="heading" accessibilityRole="header">
          {title}
        </AppText>
      </View>
      {children}
    </View>
  );
}

function PlateResult({ data }: { data: PlateData }) {
  const { colors } = useTheme();
  const { veiculo, fipe, bateria } = data;
  const title = fipe?.nome || [readable(veiculo.marca), readable(veiculo.modelo), readable(veiculo.versao)].filter(Boolean).join(' ');
  const years = [veiculo.anoFabricacao, veiculo.anoModelo].filter(Boolean).join('/');
  const power = fipe?.ficha?.potenciaCv
    ? Object.entries(fipe.ficha.potenciaCv).map(([fuel, cv]) => `${cv} cv (${fuel})`).join(' · ')
    : '';
  return (
    <View
      accessibilityLabel={`Resultado da placa ${data.placa}`}
      style={[styles.result, { backgroundColor: colors.surface, borderColor: colors.border }]}>
      <View style={styles.head}>
        <View style={styles.chip} accessibilityLabel={`Placa ${data.placa}`}>
          <AppText variant="heading" style={styles.chipText}>
            {data.placa}
          </AppText>
        </View>
        <View style={styles.flex}>
          <AppText variant="heading">{title || 'Veículo'}</AppText>
          <AppText variant="caption" color="muted">
            {[years, readable(veiculo.cor), readable(veiculo.combustivel)].filter(Boolean).join(' · ')}
          </AppText>
        </View>
      </View>

      {fipe ? (
        <View style={[styles.fipe, { backgroundColor: colors.subtle }]}>
          <AppText variant="overline" color="muted">
            Preço FIPE{fipe.mesReferencia ? ` · ${monthLabel(fipe.mesReferencia)}` : ''}
          </AppText>
          <AppText variant="display">{money(fipe.precoCentavos)}</AppText>
          <AppText variant="caption" color="muted">
            {[fipe.marca, fipe.codigo ? `código ${fipe.codigo}` : null, fipe.zeroKm ? 'zero km' : fipe.anoModelo].filter(Boolean).join(' · ')}
          </AppText>
          {fipe.nivel === 'PROVAVEL' && fipe.alternativas.length > 0 ? (
            <View style={styles.list}>
              <AppText variant="bodyStrong">A placa pode ser de outra versão. Confira qual é a do seu veículo:</AppText>
              {fipe.alternativas.map((item) => (
                <View key={`${item.codigo}-${item.nome}`} style={styles.row}>
                  <AppText style={styles.flex}>{item.nome}</AppText>
                  <AppText variant="bodyStrong">{money(item.precoCentavos)}</AppText>
                </View>
              ))}
            </View>
          ) : null}
          {fipe.historico.length > 1 ? (
            <View style={styles.list}>
              <AppText variant="bodyStrong">Histórico do preço</AppText>
              {fipe.historico.map((point) => (
                <View key={point.mes} style={styles.row}>
                  <AppText color="muted">{monthLabel(point.mes)}</AppText>
                  <AppText>{money(point.precoCentavos)}</AppText>
                </View>
              ))}
            </View>
          ) : null}
        </View>
      ) : (
        <Notice message="Esta placa não tem ligação com a tabela FIPE (ex.: reboque ou veículo fora da tabela)." />
      )}

      <Section title="Dados do veículo">
        <View style={styles.grid}>
          <Info label="Marca" value={readable(veiculo.marca)} />
          <Info label="Modelo" value={readable(veiculo.modelo)} />
          <Info label="Versão" value={readable(veiculo.versao)} />
          <Info label="Ano de fabricação" value={veiculo.anoFabricacao} />
          <Info label="Ano do modelo" value={veiculo.anoModelo} />
          <Info label="Cor" value={readable(veiculo.cor)} />
          <Info label="Combustível" value={readable(veiculo.combustivel)} />
          <Info label="Tipo" value={readable(veiculo.tipo)} />
          <Info label="Espécie" value={readable(veiculo.especie)} />
          <Info label="Passageiros" value={veiculo.passageiros} />
          <Info label="Cilindradas" value={veiculo.cilindradas ? `${integer.format(veiculo.cilindradas)} cc` : null} />
          <Info label="Eixos" value={veiculo.eixos} />
          <Info label="Peso bruto total" value={veiculo.pesoBrutoKg ? `${integer.format(veiculo.pesoBrutoKg)} kg` : null} />
          <Info label="Capacidade de tração" value={veiculo.capacidadeTracaoKg ? `${integer.format(veiculo.capacidadeTracaoKg)} kg` : null} />
          <Info label="Montagem" value={readable(veiculo.montagem)} />
          <Info label="Origem" value={readable(veiculo.origem)} />
          <Info label="Registro" value={[readable(veiculo.cidade), veiculo.uf].filter(Boolean).join(' - ')} />
        </View>
      </Section>

      {fipe?.ficha ? (
        <Section title="Ficha técnica">
          <View style={styles.grid}>
            <Info label="Motor" value={fipe.ficha.motor} />
            <Info label="Combustível" value={readable(fipe.ficha.combustivel)} />
            <Info label="Potência" value={power} />
            <Info label="Câmbio" value={readable(fipe.ficha.cambio)} />
            <Info label="Carroceria" value={readable(fipe.ficha.carroceria)} />
            <Info label="Portas" value={fipe.ficha.portas} />
          </View>
        </Section>
      ) : null}

      {bateria && bateria.opcoes.length > 0 ? (
        <Section title="Bateria indicada" icon={<BatteryCharging size={18} color={colors.text} />}>
          {bateria.opcoes.map((option) => (
            <View key={`${option.fabricante}-${option.codigo}`} style={styles.battery}>
              <AppText variant="bodyStrong">
                {readable(option.fabricante)} {option.codigo}
              </AppText>
              <AppText variant="caption" color="muted">
                {[
                  option.amperesHora ? `${option.amperesHora} Ah` : null,
                  option.cca ? `${option.cca} CCA` : null,
                  option.polaridade ? `polo ${option.polaridade}` : null,
                  option.comprimentoMm && option.larguraMm && option.alturaMm
                    ? `${option.comprimentoMm}×${option.larguraMm}×${option.alturaMm} mm`
                    : null,
                ]
                  .filter(Boolean)
                  .join(' · ')}
              </AppText>
            </View>
          ))}
        </Section>
      ) : null}

      <View style={[styles.section, { borderTopColor: colors.border }]}>
        <View style={styles.sectionTitle}>
          <ShieldCheck size={16} color={colors.muted} />
          <AppText variant="caption" color="muted" style={styles.flex}>
            Dados do cadastro do veículo e da tabela FIPE, sem nada do proprietário. A base pode ter erros: confira antes
            de negociar.
          </AppText>
        </View>
        <Button label="Anunciar um veículo" variant="secondary" onPress={() => router.push('/anunciar' as Href)} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  center: { textAlign: 'center' },
  content: { padding: space.lg, gap: space.lg },
  card: { padding: space.lg, borderRadius: radius.lg, borderWidth: 2, gap: space.md },
  empty: { alignItems: 'center', gap: space.sm, padding: space.xl, borderRadius: radius.lg, borderWidth: 1, borderStyle: 'dashed' },
  result: { padding: space.lg, borderRadius: radius.lg, borderWidth: StyleSheet.hairlineWidth, gap: space.lg },
  head: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  // Lembra a placa Mercosul: faixa azul no alto.
  chip: {
    paddingHorizontal: space.sm,
    paddingTop: 4,
    paddingBottom: 2,
    borderWidth: 2,
    borderTopWidth: 7,
    borderColor: '#111',
    borderTopColor: '#1f4fa3',
    borderRadius: 6,
    backgroundColor: '#fff',
  },
  chipText: { color: '#111', letterSpacing: 1.5 },
  fipe: { padding: space.md, borderRadius: radius.md, gap: 4 },
  list: { gap: 6, marginTop: space.md },
  row: { flexDirection: 'row', justifyContent: 'space-between', gap: space.md },
  section: { gap: space.sm, paddingTop: space.md, borderTopWidth: StyleSheet.hairlineWidth },
  sectionTitle: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  grid: { flexDirection: 'row', flexWrap: 'wrap', rowGap: space.md },
  info: { width: '50%', paddingRight: space.sm, gap: 2 },
  battery: { gap: 2 },
});
