import { useQuery } from '@tanstack/react-query';
import { Image } from 'expo-image';
import { router, type Href } from 'expo-router';
import { ChevronLeft, ChevronRight, Layers, PencilLine, UserRound, WifiOff } from 'lucide-react-native';
import { Pressable, ScrollView, StyleSheet, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { fetchLot, fetchPublicProfile } from '@/api/ads';
import { mediaUrl } from '@/api/client';
import { AppText } from '@/components/app-text';
import { Button } from '@/components/button';
import { MediaGallery } from '@/components/media-gallery';
import { VehiclePromotions } from '@/components/promotions';
import { Skeleton } from '@/components/skeleton';
import { StateView } from '@/components/state-view';
import { VehicleCard } from '@/components/vehicle-card';
import { useSession } from '@/hooks/use-session';
import { useTheme } from '@/hooks/use-theme';
import { radius, space } from '@/theme';
import { formatCents } from '@/utils/format';

/** Lote: fotos e vídeo compartilhados, preço único e um card para cada carro à venda (LotPage do site). */
export function LotScreen({ id }: { id: string }) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const session = useSession();
  const signedIn = session.status === 'authenticated';
  const lot = useQuery({
    queryKey: ['lot', id, signedIn],
    queryFn: ({ signal }) => fetchLot(id, signal, signedIn),
    enabled: session.status !== 'loading',
  });
  const seller = useQuery({
    queryKey: ['profile', lot.data?.anuncianteId],
    queryFn: ({ signal }) => fetchPublicProfile(lot.data!.anuncianteId, signal),
    enabled: Boolean(lot.data?.anuncianteId),
  });
  const galleryHeight = Math.round(width * 0.78);
  const data = lot.data;
  const video = data?.video?.status === 'PRONTO' && data.video.url ? data.video : null;
  const openStore = seller.data?.slug
    ? () => router.push({ pathname: '/loja/[slug]', params: { slug: seller.data!.slug! } })
    : undefined;
  const owner = Boolean(data?.carros && signedIn);

  return (
    <View style={[styles.flex, { backgroundColor: colors.bg }]}>
      {lot.isError ? (
        <View style={[styles.flex, { paddingTop: insets.top + 64 }]}>
          <StateView
            icon={WifiOff}
            title="Lote indisponível"
            message={lot.error.message}
            actionLabel="Tentar de novo"
            onAction={() => lot.refetch()}
          />
        </View>
      ) : (
        <ScrollView contentContainerStyle={{ paddingBottom: insets.bottom + space.xxxl }}>
          <MediaGallery
            photos={data?.fotos}
            video={video}
            title={data ? `lote ${data.fabricante} ${data.modelo}` : 'lote'}
            loading={!data}
            width={width}
            height={galleryHeight}
          />
          <View style={[styles.sheet, { backgroundColor: colors.bg }]}>
            {!data ? (
              <View style={styles.block}>
                <Skeleton width="35%" height={12} />
                <Skeleton width="80%" height={28} />
                <Skeleton width="45%" height={28} />
                <Skeleton height={140} rounded={radius.lg} />
              </View>
            ) : (
              <>
                <View style={styles.block}>
                  <View style={styles.overline}>
                    <Layers size={14} color={colors.red} />
                    <AppText variant="overline" color="red">
                      Lote · {data.fabricante}
                    </AppText>
                  </View>
                  <AppText variant="display" accessibilityRole="header">
                    {data.titulo}
                  </AppText>
                  <AppText color="muted">{[data.versao, String(data.anoModelo)].filter(Boolean).join(' · ')}</AppText>
                  <AppText variant="display" color="red" style={styles.price}>
                    {formatCents(data.precoCentavos)}
                  </AppText>
                  <AppText variant="caption" color="muted">
                    Valor de cada carro · {data.disponiveis} {data.disponiveis === 1 ? 'disponível' : 'disponíveis'}
                  </AppText>
                </View>

                <VehiclePromotions sellerId={data.anuncianteId} loteId={data.id} onOpenStore={openStore} />

                {owner ? (
                  <View style={[styles.owner, { backgroundColor: colors.subtle }]}>
                    <AppText variant="heading">Este lote é seu</AppText>
                    <AppText color="muted">
                      {data.carros!.length} {data.carros!.length === 1 ? 'carro' : 'carros'} no lote, {data.disponiveis} à
                      venda. Edite os dados comuns, as fotos e cada carro em um só lugar.
                    </AppText>
                    <Button
                      label="Editar lote"
                      icon={<PencilLine size={16} color={colors.onRed} />}
                      onPress={() => router.push(`/meus-anuncios/lote/${data.id}` as Href)}
                    />
                  </View>
                ) : null}

                <View style={styles.block}>
                  <AppText variant="title">
                    {data.disponiveis === 0
                      ? 'Todos os carros deste lote foram vendidos'
                      : `${data.disponiveis} ${data.disponiveis === 1 ? 'carro disponível' : 'carros disponíveis'}`}
                  </AppText>
                  <AppText color="muted">
                    Mesmo modelo, versão e ano. Cada carro tem cor, placa, quilometragem e laudo próprios. Escolha um para
                    falar com a loja.
                  </AppText>
                </View>
                <View style={styles.cars}>
                  {data.anuncios.map((ad) => (
                    <VehicleCard key={ad.anuncioId} ad={ad} layout="row" openLot={false} />
                  ))}
                </View>

                {data.descricao?.trim() ? (
                  <View style={styles.block}>
                    <AppText variant="title">Sobre este lote</AppText>
                    <AppText>{data.descricao}</AppText>
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
                      Anunciante
                    </AppText>
                    <AppText variant="bodyStrong">{seller.data?.nome ?? 'Loja anunciante'}</AppText>
                    {openStore ? (
                      <AppText variant="caption" color="red">
                        Ver veículos desta loja
                      </AppText>
                    ) : null}
                  </View>
                  {openStore ? <ChevronRight size={20} color={colors.muted} /> : null}
                </Pressable>
              </>
            )}
          </View>
        </ScrollView>
      )}
      <View style={[styles.topBar, { paddingTop: insets.top + space.xs }]} pointerEvents="box-none">
        <Pressable
          onPress={() => (router.canGoBack() ? router.back() : router.replace('/'))}
          hitSlop={8}
          accessibilityRole="button"
          accessibilityLabel="Voltar"
          style={styles.round}>
          <ChevronLeft size={24} color="#fff" />
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  sheet: {
    marginTop: -radius.xl,
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    paddingTop: space.xl,
    paddingHorizontal: space.lg,
    gap: space.xxl,
  },
  block: { gap: space.xs },
  overline: { flexDirection: 'row', alignItems: 'center', gap: space.xs },
  price: { marginTop: space.sm },
  owner: { padding: space.lg, borderRadius: radius.lg, gap: space.sm },
  cars: { gap: space.md },
  seller: { flexDirection: 'row', alignItems: 'center', gap: space.md, padding: space.lg, borderRadius: radius.lg },
  avatar: { width: 48, height: 48, borderRadius: 24, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  avatarImage: { width: 48, height: 48 },
  topBar: { position: 'absolute', top: 0, left: 0, right: 0, paddingHorizontal: space.md },
  round: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(18,19,21,0.45)',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
