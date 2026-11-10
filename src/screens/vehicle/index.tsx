import { useQuery } from '@tanstack/react-query';
import * as Haptics from 'expo-haptics';
import { Image } from 'expo-image';
import { router } from 'expo-router';
import {
  BadgeCheck,
  Calendar,
  CarFront,
  ChevronLeft,
  Fuel,
  Gauge,
  Lock,
  MapPin,
  MessagesSquare,
  Phone,
  Settings2,
  Share2,
  ShieldCheck,
  TrendingDown,
  TrendingUp,
  UserRound,
  WifiOff,
} from 'lucide-react-native';
import { useState } from 'react';
import { Alert, FlatList, Pressable, Share, StyleSheet, useWindowDimensions, View } from 'react-native';
import Animated, {
  interpolate,
  useAnimatedScrollHandler,
  useAnimatedStyle,
  useSharedValue,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { fetchAd, fetchAdPhotos, fetchPublicProfile } from '@/api/ads';
import { mediaUrl } from '@/api/client';
import type { AdDetail, AdPhoto, SearchAd } from '@/api/contracts';
import { AppText } from '@/components/app-text';
import { Button } from '@/components/button';
import { FavoriteButton } from '@/components/favorite-button';
import { Skeleton } from '@/components/skeleton';
import { StateView } from '@/components/state-view';
import { useTheme } from '@/hooks/use-theme';
import { conditionLabels, formatCents, formatKm, formatLocation, formatPrice, formatYears, humanize } from '@/utils/format';
import { radius, space } from '@/theme';

const specLabels: [key: string, label: string][] = [
  ['carroceria', 'Carroceria'],
  ['motorizacao', 'Motorização'],
  ['tracao', 'Tração'],
  ['tipoDirecao', 'Direção'],
  ['numeroPortas', 'Portas'],
  ['numeroLugares', 'Lugares'],
  ['cilindradas', 'Cilindrada (cc)'],
  ['unicoDono', 'Único dono'],
  ['ipvaPago', 'IPVA pago'],
  ['licenciado', 'Licenciado'],
  ['blindado', 'Blindado'],
];

export function VehicleDetail({ id }: { id: string }) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const galleryHeight = Math.round(width * 0.78);
  const scrollY = useSharedValue(0);

  const ad = useQuery({ queryKey: ['ad', id], queryFn: ({ signal }) => fetchAd(id, signal) });
  const photos = useQuery({ queryKey: ['ad-photos', id], queryFn: ({ signal }) => fetchAdPhotos(id, signal) });
  const seller = useQuery({
    queryKey: ['profile', ad.data?.anuncianteId],
    queryFn: ({ signal }) => fetchPublicProfile(ad.data!.anuncianteId, signal),
    enabled: Boolean(ad.data?.anuncianteId),
  });

  const onScroll = useAnimatedScrollHandler((event) => {
    scrollY.set(event.contentOffset.y);
  });

  // Puxar para baixo amplia a foto; rolar para cima dá um leve parallax.
  const galleryStyle = useAnimatedStyle(() => {
    const y = scrollY.get();
    return {
      transform: [
        { translateY: y < 0 ? y / 2 : y * 0.4 },
        { scale: y < 0 ? 1 + -y / galleryHeight : 1 },
      ],
    };
  });
  // Cabeçalho sólido com o título aparece quando a foto sai da tela.
  const headerStyle = useAnimatedStyle(() => ({
    opacity: interpolate(scrollY.get(), [galleryHeight - 140, galleryHeight - 70], [0, 1], 'clamp'),
  }));

  const detail = ad.data;
  const favoriteShape = detail ? toSearchAd(detail, photos.data?.[0]) : null;

  return (
    <View style={[styles.root, { backgroundColor: colors.bg }]}>
      {ad.isError ? (
        <View style={[styles.root, { paddingTop: insets.top + 64 }]}>
          <StateView
            icon={WifiOff}
            title={ad.error.message.includes('encontr') ? 'Anúncio indisponível' : 'Não foi possível abrir o anúncio'}
            message={ad.error.message}
            actionLabel="Tentar de novo"
            onAction={() => ad.refetch()}
          />
        </View>
      ) : (
        <Animated.ScrollView onScroll={onScroll} scrollEventThrottle={16} contentContainerStyle={{ paddingBottom: 120 + insets.bottom }}>
          <Animated.View style={[{ height: galleryHeight }, galleryStyle]}>
            <Gallery photos={photos.data} loading={photos.isPending} width={width} height={galleryHeight} />
          </Animated.View>

          <View style={[styles.sheet, { backgroundColor: colors.bg }]}>
            {!detail ? (
              <DetailSkeleton />
            ) : (
              <>
                <View style={styles.block}>
                  <View style={styles.tags}>
                    {detail.condicao ? <Tag text={conditionLabels[detail.condicao] ?? humanize(detail.condicao) ?? ''} /> : null}
                    {detail.selo === 'PHC' || detail.selo === 'VERIFICADO' ? (
                      <Tag text={detail.selo === 'PHC' ? 'Selo PHC' : 'Verificado'} icon={<BadgeCheck size={13} color={colors.deal} />} deal />
                    ) : null}
                  </View>
                  <AppText variant="overline" color="muted">
                    {detail.fabricante}
                  </AppText>
                  <AppText variant="display" accessibilityRole="header">
                    {detail.modelo}
                  </AppText>
                  {detail.titulo && detail.titulo !== detail.modelo ? (
                    <AppText color="muted">{detail.titulo}</AppText>
                  ) : null}
                  <AppText variant="display" color="red" style={styles.price}>
                    {formatPrice(detail.tipoPreco, detail.precoCentavos)}
                  </AppText>
                  {detail.aceitaTroca ? <AppText variant="caption" color="muted">Aceita troca</AppText> : null}
                </View>

                <QuickFacts detail={detail} />
                <FipeBlock detail={detail} />

                <View style={styles.block}>
                  <AppText variant="title">Ficha técnica</AppText>
                  <View style={[styles.specs, { borderColor: colors.border }]}>
                    {specRows(detail).map(([label, value], index) => (
                      <View
                        key={label}
                        style={[styles.specRow, index > 0 && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border }]}>
                        <AppText color="muted">{label}</AppText>
                        <AppText variant="bodyStrong" style={styles.specValue}>
                          {value}
                        </AppText>
                      </View>
                    ))}
                  </View>
                </View>

                {detail.historicoLeilao === false && detail.historicoSinistro === false ? (
                  <View style={[styles.trust, { backgroundColor: colors.dealTint, borderColor: colors.dealBorder }]}>
                    <ShieldCheck size={22} color={colors.deal} />
                    <AppText color="deal" variant="bodyStrong" style={styles.flex}>
                      Sem histórico de leilão ou sinistro informado
                    </AppText>
                  </View>
                ) : null}

                {detail.descricao ? (
                  <View style={styles.block}>
                    <AppText variant="title">Sobre o veículo</AppText>
                    <AppText>{detail.descricao}</AppText>
                  </View>
                ) : null}

                <View style={[styles.seller, { backgroundColor: colors.subtle }]}>
                  <View style={[styles.avatar, { backgroundColor: colors.surface }]}>
                    {seller.data?.fotoUrl ? (
                      <Image source={{ uri: mediaUrl(seller.data.fotoUrl)! }} style={styles.avatarImage} />
                    ) : (
                      <UserRound size={22} color={colors.muted} />
                    )}
                  </View>
                  <View style={styles.flex}>
                    <AppText variant="caption" color="muted">
                      {seller.data?.tipoPessoa === 'PJ' ? 'Loja' : 'Anunciante'}
                    </AppText>
                    {seller.isPending ? <Skeleton width="60%" height={16} /> : <AppText variant="bodyStrong">{seller.data?.nome ?? 'Anunciante'}</AppText>}
                    <View style={styles.inline}>
                      <MapPin size={13} color={colors.muted} />
                      <AppText variant="caption" color="muted">
                        {formatLocation(seller.data?.cidade ?? detail.cidade, seller.data?.uf)}
                      </AppText>
                    </View>
                  </View>
                </View>
              </>
            )}
          </View>
        </Animated.ScrollView>
      )}

      {/* Cabeçalho flutuante: botões sempre visíveis; fundo sólido e título surgem ao rolar. */}
      <View style={[styles.topBar, { paddingTop: insets.top + space.xs }]} pointerEvents="box-none">
        <Animated.View style={[StyleSheet.absoluteFill, { backgroundColor: colors.surface, borderBottomColor: colors.border, borderBottomWidth: StyleSheet.hairlineWidth }, headerStyle]} />
        <RoundButton label="Voltar" onPress={() => (router.canGoBack() ? router.back() : router.replace('/'))}>
          <ChevronLeft size={24} color="#fff" />
        </RoundButton>
        <Animated.View style={[styles.title, headerStyle]}>
          <AppText variant="heading" numberOfLines={1} style={styles.center}>
            {detail ? `${detail.fabricante} ${detail.modelo}` : ''}
          </AppText>
        </Animated.View>
        <RoundButton
          label="Compartilhar"
          onPress={() => {
            if (!detail) return;
            Haptics.selectionAsync();
            Share.share({ message: `${detail.fabricante} ${detail.modelo} na PHC Auto: https://phcauto.com/anuncio/${detail.id}` });
          }}>
          <Share2 size={20} color="#fff" />
        </RoundButton>
        {favoriteShape ? <FavoriteButton ad={favoriteShape} size={40} onImage /> : <View style={styles.placeholder} />}
      </View>

      {detail ? (
        <View style={[styles.cta, { paddingBottom: insets.bottom + space.md, backgroundColor: colors.surface, borderTopColor: colors.border }]}>
          <Button
            label="Conversar"
            variant="secondary"
            icon={<MessagesSquare size={18} color={colors.text} />}
            onPress={needsLogin}
            style={styles.flex}
          />
          <Button label="WhatsApp" icon={<Phone size={18} color={colors.onRed} />} onPress={needsLogin} style={styles.flex} />
        </View>
      ) : null}
    </View>
  );
}

function needsLogin() {
  Alert.alert(
    'Entre para falar com o vendedor',
    'O contato pelo chat e pelo WhatsApp exige login. O login chega na próxima etapa do app.',
  );
}

function RoundButton({ label, onPress, children }: { label: string; onPress: () => void; children: React.ReactNode }) {
  return (
    <Pressable onPress={onPress} hitSlop={8} accessibilityRole="button" accessibilityLabel={label} style={styles.round}>
      {children}
    </Pressable>
  );
}

function Gallery({ photos, loading, width, height }: { photos?: AdPhoto[]; loading: boolean; width: number; height: number }) {
  const { colors } = useTheme();
  const [index, setIndex] = useState(0);
  if (loading) return <Skeleton width={width} height={height} rounded={0} />;
  if (!photos?.length) {
    return (
      <View style={[styles.noPhoto, { width, height, backgroundColor: colors.subtle }]}>
        <CarFront size={48} color={colors.muted} strokeWidth={1.4} />
        <AppText color="muted">Sem fotos</AppText>
      </View>
    );
  }
  return (
    <View>
      <FlatList
        data={photos}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        keyExtractor={(photo) => photo.id}
        onMomentumScrollEnd={(event) => setIndex(Math.round(event.nativeEvent.contentOffset.x / width))}
        renderItem={({ item, index: i }) => (
          <Image
            source={{ uri: mediaUrl(item.url)! }}
            style={{ width, height, backgroundColor: colors.subtle }}
            contentFit="cover"
            transition={200}
            accessibilityLabel={item.textoAlternativo ?? `Foto ${i + 1} de ${photos.length}`}
          />
        )}
      />
      {photos.length > 1 ? (
        <View style={styles.counter}>
          <AppText variant="label" style={styles.counterText}>
            {index + 1}/{photos.length}
          </AppText>
        </View>
      ) : null}
    </View>
  );
}

function QuickFacts({ detail }: { detail: AdDetail }) {
  const { colors } = useTheme();
  const d = detail.detalhes ?? {};
  const facts = [
    { icon: Calendar, label: 'Ano', value: formatYears(detail.anoFabricacao, detail.anoModelo) },
    { icon: Gauge, label: 'KM', value: formatKm(typeof d.quilometragem === 'number' ? d.quilometragem : null) },
    { icon: Settings2, label: 'Câmbio', value: humanize(d.cambio as string) },
    { icon: Fuel, label: 'Combustível', value: humanize(d.combustivel as string) },
    { icon: MapPin, label: 'Cidade', value: detail.cidade },
  ].filter((fact) => fact.value);
  return (
    <View style={styles.facts}>
      {facts.map(({ icon: Icon, label, value }) => (
        <View key={label} style={[styles.fact, { backgroundColor: colors.subtle }]} accessible accessibilityLabel={`${label}: ${value}`}>
          <Icon size={18} color={colors.red} />
          <AppText variant="caption" color="muted">
            {label}
          </AppText>
          <AppText variant="bodyStrong" numberOfLines={1}>
            {value}
          </AppText>
        </View>
      ))}
    </View>
  );
}

function FipeBlock({ detail }: { detail: AdDetail }) {
  const { colors } = useTheme();
  if (detail.fipeBloqueada) {
    return (
      <View style={[styles.fipe, { backgroundColor: colors.subtle, borderColor: colors.border }]}>
        <Lock size={20} color={colors.muted} />
        <View style={styles.flex}>
          <AppText variant="bodyStrong">Comparação com a FIPE</AppText>
          <AppText variant="caption" color="muted">
            Disponível para quem entra na conta. Chega com o login no app.
          </AppText>
        </View>
      </View>
    );
  }
  if (!detail.fipe) return null;
  const diff = detail.fipe.diferencaCentavos;
  const below = (diff ?? 0) < 0;
  const Icon = below ? TrendingDown : TrendingUp;
  return (
    <View
      style={[
        styles.fipe,
        { backgroundColor: below ? colors.dealTint : colors.subtle, borderColor: below ? colors.dealBorder : colors.border },
      ]}>
      <Icon size={22} color={below ? colors.deal : colors.muted} />
      <View style={styles.flex}>
        <AppText variant="bodyStrong" color={below ? 'deal' : 'text'}>
          {diff == null ? 'Tabela FIPE' : below ? `${formatCents(-diff)} abaixo da FIPE` : `${formatCents(diff)} acima da FIPE`}
        </AppText>
        <AppText variant="caption" color="muted">
          FIPE {detail.fipe.mesReferencia}: {formatCents(detail.fipe.valorCentavos)}
        </AppText>
      </View>
    </View>
  );
}

function specRows(detail: AdDetail): [string, string][] {
  const d = detail.detalhes ?? {};
  const rows: [string, string][] = [];
  if (detail.cor) rows.push(['Cor', detail.cor]);
  if (detail.tipoFreio) rows.push(['Freios', detail.tipoFreio]);
  for (const [key, label] of specLabels) {
    const value = d[key];
    if (value == null || value === '') continue;
    rows.push([label, typeof value === 'boolean' ? (value ? 'Sim' : 'Não') : humanize(String(value)) ?? String(value)]);
  }
  return rows;
}

/** O favorito guarda o formato do card; o detalhe tem os mesmos dados com nomes próprios. */
function toSearchAd(detail: AdDetail, photo?: AdPhoto): SearchAd {
  const d = detail.detalhes ?? {};
  return {
    anuncioId: detail.id,
    veiculoId: '',
    anuncianteId: detail.anuncianteId,
    tipoVeiculo: detail.tipoVeiculo,
    fabricante: detail.fabricante,
    modelo: detail.modelo,
    anoFabricacao: detail.anoFabricacao ?? 0,
    anoModelo: detail.anoModelo ?? 0,
    condicao: detail.condicao ?? '',
    titulo: detail.titulo,
    tipoPreco: detail.tipoPreco,
    precoCentavos: detail.precoCentavos,
    cidade: detail.cidade,
    uf: '',
    nomePerfil: '',
    motorizacao: (d.motorizacao as string) ?? detail.versao,
    quilometragem: typeof d.quilometragem === 'number' ? d.quilometragem : null,
    fotoPrincipalUrl: photo?.url ?? null,
    fipe: detail.fipe,
    selo: detail.selo,
  };
}

function Tag({ text, icon, deal }: { text: string; icon?: React.ReactNode; deal?: boolean }) {
  const { colors } = useTheme();
  return (
    <View style={[styles.tag, { backgroundColor: deal ? colors.dealTint : colors.subtle }]}>
      {icon}
      <AppText variant="label" color={deal ? 'deal' : 'text'}>
        {text}
      </AppText>
    </View>
  );
}

function DetailSkeleton() {
  return (
    <View style={[styles.block, { gap: space.md }]}>
      <Skeleton width="30%" height={12} />
      <Skeleton width="80%" height={28} />
      <Skeleton width="45%" height={28} />
      <View style={styles.facts}>
        {[0, 1, 2].map((i) => (
          <Skeleton key={i} width={100} height={72} rounded={radius.md} />
        ))}
      </View>
      <Skeleton height={180} rounded={radius.md} />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  flex: { flex: 1 },
  center: { textAlign: 'center' },
  title: { flex: 1, minWidth: 0 },
  sheet: {
    marginTop: -radius.xl,
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    paddingTop: space.xl,
    paddingHorizontal: space.lg,
    gap: space.xxl,
  },
  block: { gap: space.xs },
  tags: { flexDirection: 'row', gap: space.sm, marginBottom: space.sm, flexWrap: 'wrap' },
  tag: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: space.sm + 2, paddingVertical: 4, borderRadius: radius.pill },
  price: { marginTop: space.sm },
  facts: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  fact: { minWidth: 100, flexGrow: 1, flexBasis: '30%', padding: space.md, borderRadius: radius.md, gap: 2 },
  fipe: { flexDirection: 'row', alignItems: 'center', gap: space.md, padding: space.lg, borderRadius: radius.lg, borderWidth: 1 },
  specs: { borderWidth: StyleSheet.hairlineWidth, borderRadius: radius.lg, marginTop: space.sm },
  specRow: { flexDirection: 'row', justifyContent: 'space-between', gap: space.lg, paddingHorizontal: space.lg, paddingVertical: space.md },
  specValue: { flexShrink: 1, textAlign: 'right' },
  trust: { flexDirection: 'row', alignItems: 'center', gap: space.md, padding: space.lg, borderRadius: radius.lg, borderWidth: 1 },
  seller: { flexDirection: 'row', alignItems: 'center', gap: space.md, padding: space.lg, borderRadius: radius.lg },
  avatar: { width: 48, height: 48, borderRadius: 24, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  avatarImage: { width: 48, height: 48 },
  inline: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  topBar: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    paddingHorizontal: space.md,
    paddingBottom: space.sm,
  },
  round: {
    flexShrink: 0,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(18,19,21,0.45)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  placeholder: { width: 40, flexShrink: 0 },
  noPhoto: { alignItems: 'center', justifyContent: 'center', gap: space.sm },
  counter: {
    position: 'absolute',
    right: space.lg,
    bottom: space.xxxl,
    backgroundColor: 'rgba(18,19,21,0.6)',
    paddingHorizontal: space.sm + 2,
    paddingVertical: 4,
    borderRadius: radius.pill,
  },
  counterText: { color: '#fff' },
  cta: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    flexDirection: 'row',
    gap: space.md,
    paddingHorizontal: space.lg,
    paddingTop: space.md,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
});
