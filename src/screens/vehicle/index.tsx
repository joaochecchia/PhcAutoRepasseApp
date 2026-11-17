import { useMutation, useQuery } from '@tanstack/react-query';
import * as Haptics from 'expo-haptics';
import { Image } from 'expo-image';
import { router, type Href } from 'expo-router';
import {
  BadgeCheck,
  BarChart3,
  Calendar,
  ChevronRight,
  ChevronLeft,
  Clock3,
  Fuel,
  FileText,
  Gauge,
  Gavel,
  Layers,
  Lock,
  Megaphone,
  MapPin,
  MessagesSquare,
  PencilLine,
  Phone,
  Ruler,
  Settings2,
  Share2,
  ShieldCheck,
  TrendingDown,
  TrendingUp,
  TriangleAlert,
  UserRound,
  Users,
  WifiOff,
  Wrench,
  Zap,
} from 'lucide-react-native';
import * as WebBrowser from 'expo-web-browser';
import { useEffect, useState } from 'react';
import { Linking, Pressable, Share, StyleSheet, useWindowDimensions, View } from 'react-native';
import Animated, {
  interpolate,
  useAnimatedScrollHandler,
  useAnimatedStyle,
  useSharedValue,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import {
  fetchAd,
  fetchAdMedia,
  fetchAdPhotos,
  fetchContactChannels,
  fetchPublicProfile,
  recordAdView,
  requestWhatsappContact,
  revealAdFipe,
} from '@/api/ads';
import { announceApi } from '@/api/announce';
import { chatApi } from '@/api/chat';
import { mediaUrl } from '@/api/client';
import type { AdDetail, AdFipe, AdPhoto, MediaFile, SearchAd } from '@/api/contracts';
import { AppText } from '@/components/app-text';
import { Button } from '@/components/button';
import { showDialog } from '@/components/dialog';
import { FavoriteButton } from '@/components/favorite-button';
import { Notice } from '@/components/notice';
import { VehiclePromotions } from '@/components/promotions';
import { Skeleton } from '@/components/skeleton';
import { StateView } from '@/components/state-view';
import { MediaGallery } from '@/components/media-gallery';
import { useSession } from '@/hooks/use-session';
import { useTheme } from '@/hooks/use-theme';
import { conditionLabels, formatCents, formatCount, formatKm, formatLocation, formatPrice, formatYears, humanize } from '@/utils/format';
import { radius, space, touch } from '@/theme';

/** Ficha técnica por tipo, como no site. Número de série e registro marítimo identificam o bem e ficam fora. */
const technicalFields: [key: string, label: string, suffix?: string][] = [
  ['quilometragem', 'Quilometragem', ' km'], ['carroceria', 'Carroceria'], ['tipoCabine', 'Cabine'],
  ['cambio', 'Câmbio'], ['combustivel', 'Combustível'], ['motorizacao', 'Motorização'],
  ['cilindradas', 'Cilindradas', ' cc'], ['categoria', 'Categoria'],
  ['partida', 'Partida'], ['refrigeracao', 'Refrigeração'], ['configuracao', 'Configuração'],
  ['tracao', 'Tração'], ['tipoDirecao', 'Direção'], ['numeroEixos', 'Eixos'], ['numeroPortas', 'Portas'],
  ['numeroLugares', 'Lugares'], ['capacidadeCargaKg', 'Capacidade de carga', ' kg'],
  ['pesoBrutoTotalKg', 'Peso bruto total', ' kg'], ['implemento', 'Implemento'], ['tamanhoPes', 'Tamanho', ' pés'],
  ['estilo', 'Estilo'], ['materialCasco', 'Material do casco'], ['capacidadePessoas', 'Capacidade', ' pessoas'],
  ['numeroCabines', 'Cabines'], ['horasUso', 'Horas de uso', ' h'], ['tipoMaquina', 'Tipo de máquina'],
  ['horimetro', 'Horímetro', ' h'], ['pesoOperacionalKg', 'Peso operacional', ' kg'], ['potenciaHp', 'Potência', ' cv'],
  ['tipoEsteiraOuPneu', 'Rodagem'], ['capacidadeCacambaM3', 'Caçamba', ' m³'],
];
const additionalFields: [key: string, label: string][] = [
  ['unicoDono', 'Único dono'], ['ipvaPago', 'IPVA pago'], ['licenciado', 'Licenciado'], ['blindado', 'Blindado'],
];
/** Zero km não tem placa, quilometragem nem histórico de dono (mesma lista do site). */
const zeroKmHiddenFields = ['quilometragem', 'placa', 'exibirPlacaCompleta', 'ipvaPago', 'licenciado', 'unicoDono'];

/** Valor da ficha como o site mostra: número com milhar, booleano em Sim/Não, enum legível. */
function shown(value: unknown, suffix = ''): string | null {
  if (value == null || value === '') return null;
  if (typeof value === 'boolean') return value ? 'Sim' : 'Não';
  if (typeof value === 'number') return `${formatCount(value)}${suffix}`;
  return `${humanize(String(value)) ?? String(value)}${suffix}`;
}

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
  // Vídeo e laudo são extras: sem eles (ou com falha), a página segue só com as fotos.
  const media = useQuery({ queryKey: ['ad-media-public', id], queryFn: ({ signal }) => fetchAdMedia(id, signal) });
  const session = useSession();
  const signedIn = session.status === 'authenticated';
  const ownAd = session.status === 'authenticated' && ad.data?.anuncianteId === session.user.usuarioId;
  const loaded = Boolean(ad.data);
  // Conta a visita para as estatísticas do anunciante (o backend ignora repetições e o próprio dono).
  useEffect(() => {
    if (loaded && session.status !== 'loading') recordAdView(id, session.status === 'authenticated');
  }, [id, loaded, session.status]);
  const video = media.data?.video?.status === 'PRONTO' && media.data.video.url ? media.data.video : null;
  const report = media.data?.laudo?.url ? media.data.laudo : null;
  const openStore = seller.data?.slug
    ? () => router.push({ pathname: '/loja/[slug]', params: { slug: seller.data!.slug! } })
    : undefined;

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
            <MediaGallery
              photos={photos.data}
              video={video}
              title={detail ? `${detail.fabricante} ${detail.modelo}` : 'veículo'}
              loading={photos.isPending}
              width={width}
              height={galleryHeight}
            />
          </Animated.View>

          <View style={[styles.sheet, { backgroundColor: colors.bg }]}>
            {!detail ? (
              <DetailSkeleton />
            ) : (
              <>
                {detail.loteId ? (
                  <Pressable
                    onPress={() => router.push({ pathname: '/lote/[id]', params: { id: detail.loteId! } })}
                    accessibilityRole="button"
                    accessibilityLabel="Este carro faz parte de um lote. Ver o lote"
                    style={({ pressed }) => [
                      styles.lotBanner,
                      { backgroundColor: pressed ? colors.subtle : colors.surface, borderColor: colors.border },
                    ]}>
                    <Layers size={20} color={colors.red} />
                    <View style={styles.flex}>
                      <AppText variant="bodyStrong">Este carro faz parte de um lote</AppText>
                      <AppText variant="caption" color="muted">
                        Veja os outros carros do mesmo modelo, versão e ano.
                      </AppText>
                    </View>
                    <ChevronRight size={20} color={colors.muted} />
                  </Pressable>
                ) : null}
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

                <VehiclePromotions
                  sellerId={detail.anuncianteId}
                  anuncioId={detail.id}
                  loteId={detail.loteId}
                  onOpenStore={openStore}
                />
                <QuickFacts detail={detail} />
                <FipeBlock detail={detail} signedIn={signedIn} />

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

                <History detail={detail} hasReport={Boolean(report)} />

                {report ? <ReportCard report={report} /> : null}

                {detail.descricao ? (
                  <View style={styles.block}>
                    <AppText variant="title">Sobre o veículo</AppText>
                    <AppText>{detail.descricao}</AppText>
                  </View>
                ) : null}

                <Pressable
                  disabled={!openStore}
                  onPress={openStore}
                  accessibilityRole={openStore ? 'button' : undefined}
                  accessibilityHint={openStore ? 'Abre a página da loja' : undefined}
                  style={[styles.seller, { backgroundColor: colors.subtle }]}>
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
                  {openStore ? <ChevronRight size={20} color={colors.muted} /> : null}
                </Pressable>

                {ownAd ? null : (
                  <Pressable
                    onPress={() => router.push('/anunciar')}
                    accessibilityRole="button"
                    accessibilityLabel="Também quer anunciar? Prepare seu anúncio"
                    style={({ pressed }) => [
                      styles.announce,
                      { borderColor: colors.border, backgroundColor: pressed ? colors.subtle : colors.surface },
                    ]}>
                    <Megaphone size={22} color={colors.red} />
                    <View style={styles.flex}>
                      <AppText variant="bodyStrong">Também quer anunciar?</AppText>
                      <AppText variant="caption" color="muted">
                        Prepare seu anúncio
                      </AppText>
                    </View>
                    <ChevronRight size={20} color={colors.muted} />
                  </Pressable>
                )}
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
        ownAd ? (
          <OwnerBar adId={detail.id} title={detail.titulo} bottomInset={insets.bottom} />
        ) : (
          <ContactBar adId={detail.id} bottomInset={insets.bottom} />
        )
      ) : null}
    </View>
  );
}

/**
 * Contato com o anunciante. Sem login, leva para entrar. Com login, o WhatsApp abre o link que o backend devolve
 * (o número nunca chega ao app antes disso). O chat em tempo real é a próxima etapa.
 */
function ContactBar({ adId, bottomInset }: { adId: string; bottomInset: number }) {
  const { colors } = useTheme();
  const session = useSession();
  const channels = useQuery({ queryKey: ['contact-channels', adId], queryFn: ({ signal }) => fetchContactChannels(adId, signal) });
  const whatsapp = useMutation({
    mutationFn: () => requestWhatsappContact(adId),
    onSuccess: ({ url }) => {
      Linking.openURL(url).catch(() => showDialog({ title: 'WhatsApp', message: 'Não foi possível abrir o WhatsApp neste aparelho.' }));
    },
    onError: (error) => showDialog({ title: 'WhatsApp', message: error instanceof Error ? error.message : 'Tente de novo.' }),
  });
  const startChat = useMutation({
    mutationFn: () => chatApi.start(adId),
    onSuccess: (conversation) => router.push(`/mensagens/${conversation.id}` as Href),
    onError: (error) => showDialog({ title: 'Conversa', message: error.message }),
  });
  const signedIn = session.status === 'authenticated';
  const whatsappOff = channels.data ? !channels.data.whatsapp : false;
  const chatOff = channels.data ? !channels.data.chat : false;

  return (
    <View style={[styles.cta, { paddingBottom: bottomInset + space.md, backgroundColor: colors.surface, borderTopColor: colors.border }]}>
      {chatOff ? null : (
      <Button
        label="Conversar"
        variant="secondary"
        icon={<MessagesSquare size={18} color={colors.text} />}
        onPress={() => signedIn ? startChat.mutate() : router.push('/entrar')}
        loading={startChat.isPending}
        style={styles.flex}
      />
      )}
      <Button
        label={whatsappOff ? 'Sem WhatsApp' : 'WhatsApp'}
        icon={<Phone size={18} color={colors.onRed} />}
        loading={whatsapp.isPending}
        disabled={whatsappOff}
        accessibilityHint={signedIn ? 'Abre a conversa com o anunciante no WhatsApp' : 'Entre na sua conta para falar com o anunciante'}
        onPress={() => (signedIn ? whatsapp.mutate() : router.push('/entrar'))}
        style={styles.flex}
      />
    </View>
  );
}

/** O anunciante vendo o próprio anúncio: atalhos para editar e acompanhar, no lugar do contato. */
function OwnerBar({ adId, title, bottomInset }: { adId: string; title: string; bottomInset: number }) {
  const { colors } = useTheme();
  return (
    <View style={[styles.cta, { paddingBottom: bottomInset + space.md, backgroundColor: colors.surface, borderTopColor: colors.border }]}>
      <Button
        label="Estatísticas"
        variant="secondary"
        icon={<BarChart3 size={18} color={colors.text} />}
        onPress={() => router.push({ pathname: '/meus-anuncios/estatisticas', params: { anuncioId: adId, titulo: title } })}
        style={styles.flex}
      />
      <Button
        label="Editar anúncio"
        icon={<PencilLine size={18} color={colors.onRed} />}
        onPress={() => router.push(`/meus-anuncios/${adId}` as Href)}
        style={styles.flex}
      />
    </View>
  );
}

function ReportCard({ report }: { report: MediaFile }) {
  const { colors } = useTheme();
  const size = `${Math.max(1, Math.round(report.tamanhoBytes / 1024 / 1024))} MB`;
  return (
    <View style={[styles.report, { backgroundColor: colors.surface, borderColor: colors.border }]}>
      <FileText size={22} color={colors.red} />
      <View style={styles.flex}>
        <AppText variant="bodyStrong">Laudo cautelar</AppText>
        <AppText variant="caption" color="muted">
          Enviado pelo anunciante · {size}
        </AppText>
      </View>
      <Button
        label="Abrir"
        variant="secondary"
        accessibilityHint="Abre o laudo cautelar do veículo"
        onPress={() => WebBrowser.openBrowserAsync(mediaUrl(report.url)!)}
      />
    </View>
  );
}

function RoundButton({ label, onPress, children }: { label: string; onPress: () => void; children: React.ReactNode }) {
  return (
    <Pressable onPress={onPress} hitSlop={8} accessibilityRole="button" accessibilityLabel={label} style={styles.round}>
      {children}
    </Pressable>
  );
}

function QuickFacts({ detail }: { detail: AdDetail }) {
  const { colors } = useTheme();
  const d = detail.detalhes ?? {};
  // Barco e linha amarela não têm quilometragem nem câmbio: o destaque segue o tipo, como no site.
  const byType =
    detail.tipoVeiculo === 'BARCO'
      ? [
          { icon: Clock3, label: 'Horas', value: shown(d.horasUso, ' h') },
          { icon: Ruler, label: 'Tamanho', value: shown(d.tamanhoPes, ' pés') },
          { icon: Users, label: 'Capacidade', value: shown(d.capacidadePessoas, ' pessoas') },
        ]
      : detail.tipoVeiculo === 'LINHA_AMARELA'
        ? [
            { icon: Clock3, label: 'Horímetro', value: shown(d.horimetro, ' h') },
            { icon: Wrench, label: 'Máquina', value: shown(d.tipoMaquina) },
            { icon: Zap, label: 'Potência', value: shown(d.potenciaHp, ' cv') },
          ]
        : [
            { icon: Gauge, label: 'KM', value: formatKm(typeof d.quilometragem === 'number' ? d.quilometragem : null) },
            { icon: Settings2, label: 'Câmbio', value: humanize(d.cambio as string) },
            { icon: Fuel, label: 'Combustível', value: humanize(d.combustivel as string) },
          ];
  const facts = [
    { icon: Calendar, label: 'Ano', value: formatYears(detail.anoFabricacao, detail.anoModelo) },
    ...byType,
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

/**
 * Leilão e sinistro são declaração do anunciante. O verde de "limpo" só vale com laudo
 * cautelar enviado, como no site; sem laudo, o "Não" aparece neutro.
 */
function History({ detail, hasReport }: { detail: AdDetail; hasReport: boolean }) {
  const { colors } = useTheme();
  const items = [
    { icon: Gavel, label: 'Passagem por leilão', value: detail.historicoLeilao },
    { icon: TriangleAlert, label: 'Registro de sinistro', value: detail.historicoSinistro },
  ];
  return (
    <View style={styles.block}>
      <AppText variant="title">Histórico</AppText>
      <View style={styles.history}>
        {items.map(({ icon: Icon, label, value }) => {
          const clear = value === false && hasReport;
          const text = value == null ? 'Não informado' : value ? 'Sim' : 'Não';
          return (
            <View
              key={label}
              accessible
              accessibilityLabel={`${label}: ${text}${clear ? ', confirmado por laudo' : ''}`}
              style={[
                styles.historyItem,
                {
                  backgroundColor: clear ? colors.dealTint : colors.subtle,
                  borderColor: clear ? colors.dealBorder : colors.border,
                },
              ]}>
              <Icon size={18} color={clear ? colors.deal : value ? colors.red : colors.muted} />
              <View style={styles.flex}>
                <AppText variant="caption" color="muted">
                  {label}
                </AppText>
                <AppText variant="bodyStrong" color={clear ? 'deal' : 'text'}>
                  {text}
                </AppText>
              </View>
              {clear ? <ShieldCheck size={18} color={colors.deal} /> : null}
            </View>
          );
        })}
      </View>
      {hasReport ? null : (
        <AppText variant="caption" color="muted">
          Informado pelo anunciante. Sem laudo cautelar anexado.
        </AppText>
      )}
    </View>
  );
}

function FipeBlock({ detail, signedIn }: { detail: AdDetail; signedIn: boolean }) {
  const { colors } = useTheme();
  // Depois de revelar, o valor fica nesta visita (como no site).
  const [revealed, setRevealed] = useState<AdFipe | null>(null);
  const reveal = useMutation({
    mutationFn: () => revealAdFipe(detail.id),
    onSuccess: (fipe) => {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setRevealed(fipe);
    },
  });
  const quota = useMutation({ mutationFn: () => announceApi.fipeQuota() });

  async function askAndReveal() {
    reveal.reset();
    try {
      const cota = await quota.mutateAsync();
      if (cota.ilimitado) return reveal.mutate();
      if ((cota.restantes ?? 0) <= 0)
        return showDialog({
          title: 'Consultas FIPE esgotadas',
          message: 'As consultas FIPE do seu plano neste mês acabaram. Elas voltam no próximo mês.',
        });
      showDialog({
        title: 'Revelar FIPE?',
        message: `Usa 1 das ${cota.restantes} consultas FIPE que restam no seu plano neste mês.`,
        actions: [
          { label: 'Cancelar', kind: 'cancel' },
          { label: 'Revelar', onPress: () => reveal.mutate() },
        ],
      });
    } catch {
      reveal.mutate();
    }
  }

  const fipe = revealed ?? detail.fipe;
  if (detail.fipeBloqueada && !revealed) {
    return (
      <View style={[styles.fipeLocked, { backgroundColor: colors.subtle, borderColor: colors.border }]}>
        <View style={styles.fipeRow}>
          <Lock size={20} color={colors.muted} />
          <View style={styles.flex}>
            <AppText variant="bodyStrong">Comparação com a FIPE</AppText>
            <AppText variant="caption" color="muted">
              Veja quanto este preço está abaixo ou acima da tabela FIPE.
            </AppText>
          </View>
        </View>
        <Button
          label={signedIn ? 'Revelar comparação FIPE' : 'Entrar para ver a FIPE'}
          variant="secondary"
          loading={reveal.isPending || quota.isPending}
          onPress={signedIn ? askAndReveal : () => router.push('/entrar')}
        />
        {reveal.isError ? <Notice tone="error" message={reveal.error.message} /> : null}
      </View>
    );
  }
  if (!fipe) return null;
  const diff = fipe.diferencaCentavos;
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
          FIPE {fipe.mesReferencia}: {formatCents(fipe.valorCentavos)} · código {fipe.codigo}
        </AppText>
      </View>
    </View>
  );
}

function specRows(detail: AdDetail): [string, string][] {
  const d = detail.detalhes ?? {};
  const zeroKm = detail.condicao === 'ZERO_KM';
  const rows: [string, string | null][] = [
    ['Cor', shown(detail.cor)],
    ['Freios', shown(detail.tipoFreio)],
    ...technicalFields
      .filter(([key]) => !(zeroKm && zeroKmHiddenFields.includes(key)))
      .map(([key, label, suffix]): [string, string | null] => [label, shown(d[key], suffix)]),
  ];
  // A placa só aparece inteira quando o anunciante liberou; senão, o final.
  if (!zeroKm && typeof d.placa === 'string' && d.placa)
    rows.push(['Placa', d.placaCompletaVisivel ? d.placa : `Final ${d.placa}`]);
  for (const [key, label] of additionalFields)
    if (!(zeroKm && zeroKmHiddenFields.includes(key))) rows.push([label, shown(d[key])]);
  rows.push(['Aceita troca', shown(detail.aceitaTroca)]);
  return rows.filter((row): row is [string, string] => row[1] != null);
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
  fipeLocked: { gap: space.md, padding: space.lg, borderRadius: radius.lg, borderWidth: 1 },
  fipeRow: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  lotBanner: { flexDirection: 'row', alignItems: 'center', gap: space.md, padding: space.lg, borderRadius: radius.lg, borderWidth: StyleSheet.hairlineWidth },
  report: { flexDirection: 'row', alignItems: 'center', gap: space.md, padding: space.lg, borderRadius: radius.lg, borderWidth: StyleSheet.hairlineWidth },
  specs: { borderWidth: StyleSheet.hairlineWidth, borderRadius: radius.lg, marginTop: space.sm },
  specRow: { flexDirection: 'row', justifyContent: 'space-between', gap: space.lg, paddingHorizontal: space.lg, paddingVertical: space.md },
  specValue: { flexShrink: 1, textAlign: 'right' },
  history: { flexDirection: 'row', gap: space.sm },
  historyItem: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: space.sm, padding: space.md, borderRadius: radius.md, borderWidth: 1, minHeight: 56 },
  seller: { flexDirection: 'row', alignItems: 'center', gap: space.md, padding: space.lg, borderRadius: radius.lg },
  announce: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    padding: space.lg,
    minHeight: touch,
    borderRadius: radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
  },
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
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
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
