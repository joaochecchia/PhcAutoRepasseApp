import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Image } from 'expo-image';
import * as Haptics from 'expo-haptics';
import * as ImagePicker from 'expo-image-picker';
import { Camera, ImagePlus, X } from 'lucide-react-native';
import { useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';

import { mediaUrl } from '@/api/client';
import type { UploadFile } from '@/api/announce';
import { myAdsApi, type OwnPhoto } from '@/api/my-ads';
import { AppText } from '@/components/app-text';
import { showDialog } from '@/components/dialog';
import { Notice } from '@/components/notice';
import { Skeleton } from '@/components/skeleton';
import { useTheme } from '@/hooks/use-theme';
import { radius, space } from '@/theme';
import { preparePhoto } from '@/utils/prepare-photo';

const MAX_PHOTOS = 8;

/** Fotos do anúncio: cada foto é enviada ou removida na hora, sem precisar salvar o formulário. */
export function EditPhotos({ anuncioId }: { anuncioId: string }) {
  const cache = useQueryClient();
  const photos = useQuery({
    queryKey: ['ad-own-photos', anuncioId],
    queryFn: ({ signal }) => myAdsApi.photos(anuncioId, signal),
  });
  return (
    <PhotoManager
      photos={photos.data}
      loading={photos.isPending}
      failed={photos.isError}
      retrying={photos.isFetching}
      onRetry={() => photos.refetch()}
      upload={(file, posicao) => myAdsApi.addPhoto(anuncioId, file, posicao)}
      remove={(fotoId) => myAdsApi.removePhoto(anuncioId, fotoId)}
      onChanged={() => {
        cache.invalidateQueries({ queryKey: ['ad-own-photos', anuncioId] });
        cache.invalidateQueries({ queryKey: ['ad-photos', anuncioId] });
        cache.invalidateQueries({ queryKey: ['my-ads'] });
      }}
      noun="anúncio"
    />
  );
}

type ManagerProps = {
  photos: OwnPhoto[] | undefined;
  loading: boolean;
  failed: boolean;
  retrying: boolean;
  onRetry: () => void;
  upload: (file: UploadFile, posicao: number) => Promise<unknown>;
  remove: (fotoId: string) => Promise<unknown>;
  onChanged: () => void;
  noun: 'anúncio' | 'lote';
  /** O lote precisa de ao menos uma foto. */
  keepOne?: boolean;
};

/** Grade de fotos enviadas e removidas na hora (anúncio ou lote). */
export function PhotoManager({ photos: source, loading, failed, retrying, onRetry, upload, remove, onChanged, noun, keepOne }: ManagerProps) {
  const { colors } = useTheme();
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const list = [...(source ?? [])].sort((left, right) => left.posicao - right.posicao);
  const free = Array.from({ length: MAX_PHOTOS }, (_, position) => position).filter(
    (position) => !list.some((photo) => photo.posicao === position),
  );

  const refresh = onChanged;

  async function send(assets: ImagePicker.ImagePickerAsset[]) {
    const selected = assets.slice(0, free.length);
    setBusy('upload');
    setError('');
    setNotice('');
    let sent = 0;
    let failure = assets.length > free.length ? `Cada ${noun} aceita no máximo ${MAX_PHOTOS} fotos.` : '';
    for (const [index, asset] of selected.entries()) {
      try {
        const file = await preparePhoto(asset, `veiculo-${free[index] + 1}.jpg`);
        await upload(file, free[index]);
        sent++;
      } catch (reason) {
        failure = reason instanceof Error ? reason.message : 'Não foi possível enviar uma das fotos.';
      }
    }
    setBusy(null);
    setError(failure);
    if (sent) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setNotice(sent === 1 ? `Foto enviada e salva no ${noun}.` : `${sent} fotos enviadas e salvas no ${noun}.`);
      refresh();
    }
  }

  async function fromLibrary() {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsMultipleSelection: true,
      selectionLimit: free.length,
      exif: false,
      quality: 1,
    });
    if (!result.canceled) await send(result.assets);
  }

  async function fromCamera() {
    const permission = await ImagePicker.requestCameraPermissionsAsync();
    if (!permission.granted) {
      setError('Permita o uso da câmera para fotografar o veículo.');
      return;
    }
    const result = await ImagePicker.launchCameraAsync({ mediaTypes: ['images'], exif: false, quality: 1 });
    if (!result.canceled) await send(result.assets);
  }

  function confirmRemove(photo: OwnPhoto, index: number) {
    if (keepOne && list.length === 1) {
      setError(`O ${noun} precisa de ao menos uma foto. Envie outra antes de remover esta.`);
      return;
    }
    showDialog({
      title: 'Remover esta foto?',
      message: `A foto sai do ${noun} na hora.${index === 0 && list.length > 1 ? ' A próxima foto vira a capa.' : ''}`,
      actions: [
        { label: 'Manter', kind: 'cancel' },
        {
          label: 'Remover',
          kind: 'destructive',
          onPress: async () => {
            setBusy(photo.id);
            setError('');
            setNotice('');
            try {
              await remove(photo.id);
              setNotice(`Foto removida do ${noun}.`);
              refresh();
            } catch (reason) {
              setError(reason instanceof Error ? reason.message : 'Não foi possível remover a foto.');
            } finally {
              setBusy(null);
            }
          },
        },
      ],
    });
  }

  if (failed)
    return (
      <Notice
        tone="error"
        message={`Não carregamos as fotos do ${noun}.`}
        actionLabel="Tentar de novo"
        actionLoading={retrying}
        onAction={onRetry}
      />
    );

  return (
    <View style={styles.root}>
      <AppText variant="caption" color="muted">
        Fotos são enviadas e removidas na hora, sem precisar salvar. A primeira é a capa.
        {noun === 'lote' ? ' Elas aparecem em todos os carros do lote.' : ''}
      </AppText>
      <View style={styles.grid}>
        {loading
          ? [0, 1, 2].map((key) => <Skeleton key={key} rounded={radius.md} style={styles.cell} />)
          : list.map((photo, index) => (
              <View key={photo.id} style={styles.cell}>
                <Image
                  source={{ uri: mediaUrl(photo.url) ?? undefined }}
                  style={[styles.image, { backgroundColor: colors.subtle }]}
                  contentFit="cover"
                  accessibilityLabel={photo.textoAlternativo || `Foto ${index + 1} do veículo`}
                />
                {index === 0 ? (
                  <View style={styles.cover}>
                    <AppText variant="label" style={styles.coverText}>
                      Capa
                    </AppText>
                  </View>
                ) : null}
                <Pressable
                  onPress={() => confirmRemove(photo, index)}
                  disabled={Boolean(busy)}
                  hitSlop={8}
                  accessibilityRole="button"
                  accessibilityLabel={`Remover foto ${index + 1}`}
                  style={styles.remove}>
                  {busy === photo.id ? <ActivityIndicator size="small" color="#fff" /> : <X size={16} color="#fff" />}
                </Pressable>
              </View>
            ))}
        {!loading && free.length ? (
          <View style={[styles.cell, styles.add, { borderColor: colors.border, backgroundColor: colors.subtle }]}>
            {busy === 'upload' ? (
              <>
                <ActivityIndicator color={colors.red} />
                <AppText variant="caption" color="muted">
                  Enviando…
                </AppText>
              </>
            ) : (
              <>
                <Pressable
                  onPress={fromLibrary}
                  disabled={Boolean(busy)}
                  accessibilityRole="button"
                  accessibilityLabel={`Escolher fotos. Restam ${free.length}`}
                  style={styles.addButton}>
                  <ImagePlus size={22} color={colors.text} />
                  <AppText variant="caption">Galeria</AppText>
                </Pressable>
                <Pressable
                  onPress={fromCamera}
                  disabled={Boolean(busy)}
                  accessibilityRole="button"
                  accessibilityLabel="Tirar foto"
                  style={styles.addButton}>
                  <Camera size={22} color={colors.text} />
                  <AppText variant="caption">Câmera</AppText>
                </Pressable>
              </>
            )}
          </View>
        ) : null}
      </View>
      <AppText variant="caption" color="muted">
        {list.length} de {MAX_PHOTOS} fotos
      </AppText>
      {notice ? <Notice tone="success" message={notice} /> : null}
      {error ? <Notice tone="error" message={error} /> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { gap: space.md },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  cell: { width: '31.5%', aspectRatio: 1, borderRadius: radius.md, overflow: 'hidden' },
  image: { width: '100%', height: '100%' },
  cover: {
    position: 'absolute',
    left: space.xs,
    bottom: space.xs,
    backgroundColor: 'rgba(18,19,21,0.65)',
    borderRadius: radius.pill,
    paddingHorizontal: space.sm,
    paddingVertical: 2,
  },
  coverText: { color: '#fff', fontSize: 11 },
  remove: {
    position: 'absolute',
    top: space.xs,
    right: space.xs,
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(18,19,21,0.65)',
  },
  add: { borderWidth: 1, borderStyle: 'dashed', alignItems: 'center', justifyContent: 'center', gap: space.xs },
  addButton: { minHeight: 44, minWidth: 64, alignItems: 'center', justifyContent: 'center', gap: 2 },
});
