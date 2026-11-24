import { useInfiniteQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import * as Haptics from 'expo-haptics';
import { Image } from 'expo-image';
import { router } from 'expo-router';
import { Check, ExternalLink, ImageUp, WifiOff, X } from 'lucide-react-native';
import { useMemo, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, RefreshControl, StyleSheet, Switch, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { adminPhotoReviewApi, type PhotoInReview } from '@/api/admin';
import { privateImageSource } from '@/api/client';
import { AppText } from '@/components/app-text';
import { Button } from '@/components/button';
import { Notice } from '@/components/notice';
import { Skeleton } from '@/components/skeleton';
import { StateView } from '@/components/state-view';
import { TextField } from '@/components/text-field';
import { useTheme } from '@/hooks/use-theme';
import { radius, space, touch } from '@/theme';

import { AdminGate } from './admin-gate';
import { formatDateTime } from './format';
import { Tag } from './ui';

/** Mesma raiz do contador (usePhotosInReview): cada decisão atualiza a lista e o número. */
const reviewKey = ['admin', 'photo-review'] as const;

const categoryLabel: Record<string, string> = {
  VEICULO: 'Veículo',
  FLYER: 'Propaganda (flyer)',
  SEXUAL: 'Conteúdo sexual',
  VIOLENCIA_OU_CHOCANTE: 'Violência ou chocante',
  DOCUMENTO_PESSOAL: 'Documento pessoal',
  FORA_DE_CONTEXTO: 'Fora de contexto',
};

/** Motivos prontos para a recusa (os mesmos do site); o texto aparece para o anunciante e pode ser editado. */
const reasons = [
  'A foto parece uma arte de propaganda (preço, texto ou montagem). Envie uma foto real do veículo.',
  'A foto mostra telefone, site ou rede social. Envie uma foto sem dados de contato.',
  'A foto não mostra o veículo à venda. Envie uma foto do veículo.',
  'Fotos de documentos não podem ficar públicas no anúncio. Envie uma foto do veículo.',
  'A foto tem conteúdo impróprio para o site. Envie uma foto do veículo.',
];

/**
 * Fotos em revisão (AdminPhotoReview do site), para ADMIN e DONO: as que a moderação automática não decidiu sozinha
 * (dúvida, contato na imagem, recusa do modelo ou erro), as mais antigas primeiro. Aprovar borra as placas e publica;
 * recusar mostra o motivo ao anunciante, que pode trocar a foto. Conteúdo impróprio pode ter o arquivo apagado.
 */
export function PhotoReviewScreen() {
  return (
    <AdminGate>
      <PhotoReview />
    </AdminGate>
  );
}

function PhotoReview() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const [done, setDone] = useState('');
  const list = useInfiniteQuery({
    queryKey: [...reviewKey, 'lista'],
    queryFn: ({ pageParam, signal }) => adminPhotoReviewApi.list(pageParam, signal),
    initialPageParam: 0,
    getNextPageParam: (last) => ((last.pagina + 1) * last.tamanho < last.total ? last.pagina + 1 : undefined),
  });
  const items = useMemo(() => list.data?.pages.flatMap((page) => page.fotos) ?? [], [list.data]);
  const total = list.data?.pages[0]?.total ?? 0;

  return (
    <FlatList
      style={{ backgroundColor: colors.bg }}
      contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + space.xxl }]}
      data={items}
      keyExtractor={(item) => `${item.origem}-${item.id}`}
      keyboardShouldPersistTaps="handled"
      ListHeaderComponent={
        <View style={styles.header}>
          <AppText color="muted">
            Fotos que a análise automática não aprovou nem recusou sozinha. Elas ficam fora do anúncio até a decisão.
          </AppText>
          {list.data ? (
            <AppText variant="caption" color="muted">
              {total === 1 ? '1 foto aguardando' : `${total} fotos aguardando`}
            </AppText>
          ) : null}
          {done ? <Notice tone="success" message={done} /> : null}
        </View>
      }
      refreshControl={
        <RefreshControl
          refreshing={list.isRefetching && !list.isFetchingNextPage}
          onRefresh={() => void list.refetch()}
          tintColor={colors.red}
        />
      }
      onEndReachedThreshold={0.4}
      onEndReached={() => {
        if (list.hasNextPage && !list.isFetchingNextPage) list.fetchNextPage();
      }}
      ItemSeparatorComponent={() => <View style={styles.gap} />}
      ListFooterComponent={list.isFetchingNextPage ? <ActivityIndicator color={colors.red} style={styles.footer} /> : undefined}
      ListEmptyComponent={
        list.isPending ? (
          <View style={styles.skeletons}>
            {[0, 1].map((n) => (
              <Skeleton key={n} height={360} rounded={radius.lg} />
            ))}
          </View>
        ) : list.isError ? (
          <StateView
            icon={WifiOff}
            title="As fotos em revisão não carregaram"
            message={list.error.message}
            actionLabel="Tentar de novo"
            onAction={() => list.refetch()}
            compact
          />
        ) : (
          <StateView
            icon={ImageUp}
            title="Nenhuma foto aguardando revisão"
            message="As fotos novas estão sendo decididas pela análise automática."
            compact
          />
        )
      }
      renderItem={({ item }) => <PhotoCard photo={item} onDone={setDone} />}
    />
  );
}

function PhotoCard({ photo, onDone }: { photo: PhotoInReview; onDone: (message: string) => void }) {
  const { colors } = useTheme();
  const queryClient = useQueryClient();
  const [rejecting, setRejecting] = useState(false);
  const [reason, setReason] = useState(reasons[0]);
  const [erase, setErase] = useState(false);
  const trimmed = reason.trim();

  const finish = (message: string) => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    onDone(message);
    void queryClient.invalidateQueries({ queryKey: reviewKey });
  };
  const approve = useMutation({
    mutationFn: () => adminPhotoReviewApi.approve(photo),
    onSuccess: () => finish(`Foto de "${photo.titulo}" aprovada: a placa foi borrada e a foto já aparece no anúncio.`),
  });
  const reject = useMutation({
    mutationFn: () => adminPhotoReviewApi.reject(photo, trimmed, erase),
    onSuccess: () => finish(`Foto de "${photo.titulo}" recusada. O anunciante foi avisado.`),
  });
  const busy = approve.isPending || reject.isPending;
  const source = privateImageSource(photo.url, 'REVISAO');
  const openAd = () =>
    photo.origem === 'LOTE' && photo.loteId
      ? router.push({ pathname: '/lote/[id]', params: { id: photo.loteId } })
      : photo.anuncioId
        ? router.push({ pathname: '/anuncio/[id]', params: { id: photo.anuncioId } })
        : undefined;

  return (
    <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
      <Image
        source={source}
        cachePolicy="memory"
        style={[styles.photo, { backgroundColor: colors.subtle }]}
        contentFit="contain"
        accessibilityLabel={`Foto em revisão de ${photo.titulo}`}
      />
      <View style={styles.body}>
        <View style={styles.row}>
          <Pressable
            onPress={openAd}
            hitSlop={8}
            accessibilityRole="link"
            accessibilityLabel={`Abrir ${photo.origem === 'LOTE' ? 'o lote' : 'o anúncio'} ${photo.titulo}`}
            style={[styles.flex, styles.title]}>
            <AppText variant="bodyStrong" style={styles.shrink}>
              {photo.titulo}
            </AppText>
            <ExternalLink size={14} color={colors.red} />
          </Pressable>
          <Tag label={photo.categoria ? (categoryLabel[photo.categoria] ?? photo.categoria) : 'Sem classificação'} tone="warn" />
        </View>
        <AppText variant="caption" color="muted">
          {photo.origem === 'LOTE' ? 'Foto do lote' : 'Foto do anúncio'} · {photo.anunciante ?? 'Conta excluída'}
          {photo.enviadaParaRevisaoEm ? ` · ${formatDateTime(photo.enviadaParaRevisaoEm)}` : ''}
        </AppText>
        {photo.motivo ? (
          <View style={[styles.quote, { backgroundColor: colors.subtle, borderLeftColor: colors.border }]}>
            <AppText selectable>{photo.motivo}</AppText>
          </View>
        ) : null}

        {rejecting ? (
          <View style={styles.reject}>
            <AppText variant="label">Motivo (o anunciante vê este texto)</AppText>
            <View accessibilityRole="radiogroup" accessibilityLabel="Motivos prontos">
              {reasons.map((item) => {
                const selected = reason === item;
                return (
                  <Pressable
                    key={item}
                    onPress={() => setReason(item)}
                    disabled={busy}
                    accessibilityRole="radio"
                    accessibilityState={{ checked: selected, disabled: busy }}
                    style={styles.reason}>
                    <View style={[styles.radio, { borderColor: selected ? colors.red : colors.border }]}>
                      {selected ? <View style={[styles.radioDot, { backgroundColor: colors.red }]} /> : null}
                    </View>
                    <AppText style={styles.flex}>{item}</AppText>
                  </Pressable>
                );
              })}
            </View>
            <TextField
              label="Texto do motivo"
              value={reason}
              onChangeText={setReason}
              multiline
              maxLength={500}
              editable={!busy}
            />
            <View style={styles.erase}>
              <AppText style={styles.flex}>Apagar o arquivo (conteúdo sexual, violento ou documento)</AppText>
              <Switch
                value={erase}
                disabled={busy}
                onValueChange={(next) => {
                  Haptics.selectionAsync();
                  setErase(next);
                }}
                trackColor={{ true: colors.red, false: colors.border }}
                thumbColor="#ffffff"
                accessibilityLabel="Apagar o arquivo da foto recusada"
              />
            </View>
            <View style={styles.row}>
              <Button
                label="Recusar foto"
                onPress={() => reject.mutate()}
                loading={reject.isPending}
                disabled={busy || !trimmed}
                style={styles.flex}
              />
              <Button
                label="Cancelar"
                variant="secondary"
                onPress={() => {
                  reject.reset();
                  setRejecting(false);
                }}
                disabled={busy}
                style={styles.flex}
              />
            </View>
          </View>
        ) : (
          <View style={styles.row}>
            <Button
              label="Aprovar"
              icon={<Check size={16} color={colors.onRed} />}
              onPress={() => approve.mutate()}
              loading={approve.isPending}
              disabled={busy}
              accessibilityHint="Borra a placa e publica a foto"
              style={styles.flex}
            />
            <Button
              label="Recusar"
              variant="secondary"
              icon={<X size={16} color={colors.red} />}
              onPress={() => {
                approve.reset();
                setRejecting(true);
              }}
              disabled={busy}
              style={styles.flex}
            />
          </View>
        )}
        {approve.isError ? (
          <Notice tone="error" message={approve.error.message} actionLabel="Tentar de novo" onAction={() => approve.mutate()} />
        ) : null}
        {reject.isError ? <Notice tone="error" message={reject.error.message} /> : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  shrink: { flexShrink: 1 },
  content: { padding: space.lg },
  header: { gap: space.sm, marginBottom: space.md },
  gap: { height: space.md },
  skeletons: { gap: space.md },
  footer: { marginVertical: space.lg },
  card: { borderRadius: radius.lg, borderWidth: StyleSheet.hairlineWidth, overflow: 'hidden' },
  photo: { width: '100%', aspectRatio: 4 / 3 },
  body: { padding: space.lg, gap: space.sm },
  row: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  title: { flexDirection: 'row', alignItems: 'center', gap: space.xs, minHeight: touch },
  quote: { padding: space.md, borderLeftWidth: 2, borderRadius: radius.sm },
  reject: { gap: space.sm },
  reason: { flexDirection: 'row', alignItems: 'center', gap: space.md, minHeight: touch, paddingVertical: space.xs },
  radio: { width: 20, height: 20, borderRadius: 10, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
  radioDot: { width: 10, height: 10, borderRadius: 5 },
  erase: { flexDirection: 'row', alignItems: 'center', gap: space.md, minHeight: touch },
});
