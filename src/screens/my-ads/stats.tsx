import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { router, useLocalSearchParams } from 'expo-router';
import { BarChart3, Eye, Heart, MessageCircle, Users, WifiOff, type LucideIcon } from 'lucide-react-native';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { myAdsApi, type AdStats, type AdStatsPerson } from '@/api/my-ads';
import { AppText } from '@/components/app-text';
import { Button } from '@/components/button';
import { Chip } from '@/components/chip';
import { Skeleton } from '@/components/skeleton';
import { StateView } from '@/components/state-view';
import { useTheme } from '@/hooks/use-theme';
import { radius, space } from '@/theme';
import { formatCount } from '@/utils/format';

const PERIODS = [7, 30, 90] as const;
const shortDay = new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: '2-digit', timeZone: 'UTC' });
const when = new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
const statusLabels: Record<string, string> = {
  PUBLICADO: 'Publicado',
  PAUSADO: 'Pausado',
  RASCUNHO: 'Rascunho',
  RESERVADO: 'Reservado',
  VENDIDO: 'Vendido',
  ARQUIVADO: 'Arquivado',
};

/**
 * Estatísticas: de um anúncio (parâmetro anuncioId) ou da conta inteira, com filtro por anúncio e ranking.
 * Mesmo conteúdo do AdStatsDialog e do AccountStatsPanel do site.
 */
export function StatsScreen() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ anuncioId?: string; titulo?: string }>();
  const single = params.anuncioId ?? null;
  const [days, setDays] = useState<number>(30);
  const [filter, setFilter] = useState<string | null>(null);
  const stats = useQuery({
    queryKey: ['ad-stats', single, filter, days],
    queryFn: ({ signal }) =>
      single ? myAdsApi.stats(single, days, signal) : myAdsApi.accountStats(filter, days, signal),
    placeholderData: keepPreviousData,
  });

  const content = () => {
    if (stats.isError && !stats.data)
      return (
        <StateView
          icon={WifiOff}
          title="Não carregamos as estatísticas"
          message={stats.error.message}
          actionLabel="Tentar de novo"
          onAction={() => stats.refetch()}
          compact
        />
      );
    if (!stats.data) return <StatsSkeleton />;
    const data = stats.data;
    if (!data.disponivel || !data.totais)
      return (
        <View style={[styles.upsell, { backgroundColor: colors.subtle, borderColor: colors.border }]}>
          <BarChart3 size={28} color={colors.muted} />
          <AppText variant="heading">Veja quem se interessou pelos seus veículos</AppText>
          <AppText color="muted">
            Visualizações por dia, quem favoritou e quem chamou no WhatsApp fazem parte dos planos Pro PF e Pro PJ.
          </AppText>
          <Button
            label="Conhecer os planos"
            onPress={() => router.push('/planos')}
          />
        </View>
      );
    if (!single && data.anuncios.length === 0)
      return (
        <StateView
          icon={BarChart3}
          title="Ainda não há estatísticas"
          message="Publique um anúncio para acompanhar visualizações, favoritos e contatos pelo WhatsApp."
          compact
        />
      );
    const totals = data.totais;
    return (
      <View style={styles.sections}>
        <View style={styles.tiles}>
          <Tile icon={Eye} label="Visualizações" value={totals.visualizacoes} />
          <Tile icon={Users} label="Visitantes" value={totals.visitantes} hint="únicos de cada dia, somados" />
          <Tile
            icon={Heart}
            label="Favoritos agora"
            value={totals.favoritosAtuais}
            hint={`${formatCount(totals.novosFavoritos)} no período`}
          />
          <Tile
            icon={MessageCircle}
            label="Cliques no WhatsApp"
            value={totals.cliquesWhatsapp}
            hint={`${formatCount(totals.pessoasWhatsapp)} ${totals.pessoasWhatsapp === 1 ? 'pessoa' : 'pessoas'}`}
          />
        </View>
        {data.porDia.length ? <DailyViews days={data.porDia} /> : null}
        {!single && !filter && data.porAnuncio.length ? <Ranking stats={data} onPick={setFilter} /> : null}
        <People title="Quem favoritou" empty="Ninguém favoritou ainda." people={data.favoritaram} showAd={!single && !filter} />
        <People
          title="Quem chamou no WhatsApp"
          empty="Ninguém chamou no período."
          people={data.contataramWhatsapp}
          showCount
          showAd={!single && !filter}
        />
        <AppText variant="caption" color="muted">
          Suas próprias visitas não contam. A mesma pessoa só conta uma nova visualização depois de 30 minutos. Por
          privacidade, mostramos só o primeiro nome, a inicial do sobrenome e a cidade de quem está logado.
        </AppText>
      </View>
    );
  };

  return (
    <ScrollView
      style={{ backgroundColor: colors.bg }}
      contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + space.xl }]}>
      {params.titulo ? (
        <AppText variant="heading" numberOfLines={2}>
          {params.titulo}
        </AppText>
      ) : null}
      {!single && stats.data?.anuncios.length ? (
        <View style={styles.group}>
          <AppText variant="label" color="muted">
            Anúncio
          </AppText>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
            <Chip
              label={`Todos (${stats.data.anuncios.length})`}
              selected={!filter}
              onPress={() => setFilter(null)}
            />
            {stats.data.anuncios.map((ad) => (
              <Chip
                key={ad.id}
                label={ad.titulo + (ad.status !== 'PUBLICADO' ? ` · ${statusLabels[ad.status] ?? ad.status}` : '')}
                selected={filter === ad.id}
                onPress={() => setFilter(ad.id)}
              />
            ))}
          </ScrollView>
        </View>
      ) : null}
      <View style={[styles.periods, { backgroundColor: colors.subtle }]} accessibilityRole="tablist">
        {PERIODS.map((value) => {
          const selected = days === value;
          return (
            <Pressable
              key={value}
              onPress={() => setDays(value)}
              accessibilityRole="tab"
              accessibilityState={{ selected }}
              accessibilityLabel={`Últimos ${value} dias`}
              style={[styles.period, selected && { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <AppText variant="label" color={selected ? 'text' : 'muted'}>
                {value} dias
              </AppText>
            </Pressable>
          );
        })}
      </View>
      {content()}
    </ScrollView>
  );
}

function Tile({ icon: Icon, label, value, hint }: { icon: LucideIcon; label: string; value: number; hint?: string }) {
  const { colors } = useTheme();
  return (
    <View
      accessible
      accessibilityLabel={`${label}: ${formatCount(value)}${hint ? `, ${hint}` : ''}`}
      style={[styles.tile, { backgroundColor: colors.surface, borderColor: colors.border }]}>
      <View style={styles.tileLabel}>
        <Icon size={15} color={colors.muted} />
        <AppText variant="caption" color="muted" numberOfLines={1} style={styles.flex}>
          {label}
        </AppText>
      </View>
      <AppText variant="title">{formatCount(value)}</AppText>
      {hint ? (
        <AppText variant="caption" color="muted" numberOfLines={1}>
          {hint}
        </AppText>
      ) : null}
    </View>
  );
}

const CHART_HEIGHT = 120;

/** Barras de visualizações por dia. Tocar numa barra mostra os números do dia acima do gráfico. */
function DailyViews({ days }: { days: AdStats['porDia'] }) {
  const { colors } = useTheme();
  const [active, setActive] = useState<number | null>(null);
  const max = Math.max(1, ...days.map((day) => day.visualizacoes));
  const describe = (day: AdStats['porDia'][number]) =>
    `${shortDay.format(new Date(day.dia))}: ${formatCount(day.visualizacoes)} visualizações, ` +
    `${formatCount(day.visitantes)} visitantes, ${formatCount(day.favoritos)} favoritos, ` +
    `${formatCount(day.cliquesWhatsapp)} cliques no WhatsApp`;
  const current = active == null ? null : days[active];
  const gap = days.length > 45 ? 1 : 2;
  return (
    <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
      <AppText variant="heading">Visualizações por dia</AppText>
      <AppText variant="caption" color="muted" accessibilityLiveRegion="polite" style={styles.readout}>
        {current ? describe(current) : 'Toque numa barra para ver o dia.'}
      </AppText>
      <View style={[styles.bars, { gap, borderBottomColor: colors.border }]}>
        {days.map((day, index) => {
          const height = day.visualizacoes ? Math.max(3, (day.visualizacoes / max) * CHART_HEIGHT) : 0;
          const selected = active === index;
          return (
            <Pressable
              key={day.dia}
              onPress={() => setActive(selected ? null : index)}
              accessibilityRole="button"
              accessibilityLabel={describe(day)}
              style={styles.barSlot}>
              <View
                style={[
                  styles.bar,
                  {
                    height,
                    backgroundColor: colors.red,
                    opacity: active == null || selected ? 1 : 0.35,
                  },
                ]}
              />
            </Pressable>
          );
        })}
      </View>
      <View style={styles.axis} importantForAccessibility="no-hide-descendants">
        <AppText variant="caption" color="muted">
          {shortDay.format(new Date(days[0].dia))}
        </AppText>
        <AppText variant="caption" color="muted">
          máx. {formatCount(max)}
        </AppText>
        <AppText variant="caption" color="muted">
          {shortDay.format(new Date(days[days.length - 1].dia))}
        </AppText>
      </View>
    </View>
  );
}

function Ranking({ stats, onPick }: { stats: AdStats; onPick: (id: string) => void }) {
  const { colors } = useTheme();
  return (
    <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
      <AppText variant="heading">Por anúncio</AppText>
      {stats.porAnuncio.map((ad, index) => (
        <Pressable
          key={ad.anuncioId}
          onPress={() => onPick(ad.anuncioId)}
          accessibilityRole="button"
          accessibilityLabel={`${ad.titulo}: ${formatCount(ad.visualizacoes)} visualizações, ${formatCount(ad.favoritosAtuais)} favoritos, ${formatCount(ad.cliquesWhatsapp)} cliques no WhatsApp`}
          accessibilityHint="Mostra só as estatísticas deste anúncio"
          style={({ pressed }) => [
            styles.rankRow,
            index > 0 && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border },
            pressed && { backgroundColor: colors.subtle },
          ]}>
          <AppText variant="bodyStrong" numberOfLines={1}>
            {ad.titulo}
            {ad.status !== 'PUBLICADO' ? (
              <AppText variant="caption" color="muted">
                {' '}
                · {statusLabels[ad.status] ?? ad.status}
              </AppText>
            ) : null}
          </AppText>
          <View style={styles.rankNumbers}>
            <Metric icon={Eye} value={ad.visualizacoes} />
            <Metric icon={Heart} value={ad.favoritosAtuais} />
            <Metric icon={MessageCircle} value={ad.cliquesWhatsapp} />
          </View>
        </Pressable>
      ))}
    </View>
  );
}

function Metric({ icon: Icon, value }: { icon: LucideIcon; value: number }) {
  const { colors } = useTheme();
  return (
    <View style={styles.metric}>
      <Icon size={14} color={colors.muted} />
      <AppText variant="caption">{formatCount(value)}</AppText>
    </View>
  );
}

function People({
  title,
  empty,
  people,
  showCount = false,
  showAd = false,
}: {
  title: string;
  empty: string;
  people: AdStatsPerson[];
  showCount?: boolean;
  showAd?: boolean;
}) {
  const { colors } = useTheme();
  return (
    <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
      <AppText variant="heading">{title}</AppText>
      {!people.length ? (
        <AppText color="muted">{empty}</AppText>
      ) : (
        people.map((person, index) => (
          <View
            key={`${person.nome}-${person.em}-${index}`}
            style={[styles.person, index > 0 && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border }]}>
            <AppText variant="bodyStrong">{person.nome}</AppText>
            {showAd ? (
              <AppText variant="caption" numberOfLines={1}>
                {person.anuncioTitulo}
              </AppText>
            ) : null}
            <AppText variant="caption" color="muted">
              {person.cidade && person.uf ? `${person.cidade}/${person.uf} · ` : ''}
              {when.format(new Date(person.em))}
              {showCount && person.vezes > 1 ? ` · ${person.vezes} cliques` : ''}
            </AppText>
          </View>
        ))
      )}
    </View>
  );
}

function StatsSkeleton() {
  return (
    <View style={styles.sections}>
      <View style={styles.tiles}>
        {[0, 1, 2, 3].map((key) => (
          <Skeleton key={key} height={84} rounded={radius.md} style={styles.tileSkeleton} />
        ))}
      </View>
      <Skeleton height={200} rounded={radius.lg} />
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  content: { padding: space.lg, gap: space.lg },
  group: { gap: space.sm },
  chips: { gap: space.sm, paddingRight: space.lg },
  periods: { flexDirection: 'row', borderRadius: radius.md, padding: 3 },
  period: {
    flex: 1,
    minHeight: 40,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.md - 2,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  sections: { gap: space.lg },
  tiles: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  tile: { flexBasis: '48%', flexGrow: 1, padding: space.md, borderRadius: radius.md, borderWidth: StyleSheet.hairlineWidth, gap: 2 },
  tileSkeleton: { flexBasis: '48%', flexGrow: 1 },
  tileLabel: { flexDirection: 'row', alignItems: 'center', gap: space.xs },
  card: { padding: space.lg, borderRadius: radius.lg, borderWidth: StyleSheet.hairlineWidth, gap: space.sm },
  readout: { minHeight: 34 },
  bars: {
    height: CHART_HEIGHT,
    flexDirection: 'row',
    alignItems: 'flex-end',
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  barSlot: { flex: 1, height: '100%', justifyContent: 'flex-end' },
  bar: { borderTopLeftRadius: 4, borderTopRightRadius: 4 },
  axis: { flexDirection: 'row', justifyContent: 'space-between' },
  rankRow: { paddingVertical: space.md, gap: space.xs, minHeight: 44 },
  rankNumbers: { flexDirection: 'row', gap: space.lg },
  metric: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  person: { paddingVertical: space.sm, gap: 2 },
  upsell: { padding: space.xl, borderRadius: radius.lg, borderWidth: 1, gap: space.md, alignItems: 'flex-start' },
});
