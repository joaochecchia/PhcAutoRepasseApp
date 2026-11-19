import { useQuery, useQueryClient } from '@tanstack/react-query';
import * as DocumentPicker from 'expo-document-picker';
import * as ImagePicker from 'expo-image-picker';
import { FileText, Video } from 'lucide-react-native';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { announceApi } from '@/api/announce';
import { myAdsApi, type AdMedia } from '@/api/my-ads';
import { AppText } from '@/components/app-text';
import { Button } from '@/components/button';
import { showDialog } from '@/components/dialog';
import { Notice } from '@/components/notice';
import { Skeleton } from '@/components/skeleton';
import { useTheme } from '@/hooks/use-theme';
import { radius, space } from '@/theme';

type Kind = 'video' | 'laudo';
const labels: Record<Kind, string> = { video: 'Vídeo', laudo: 'Laudo cautelar' };
const megabytes = (bytes: number) => `${Math.max(1, Math.round(bytes / 1024 / 1024))} MB`;

/** Vídeo e laudo do anúncio: enviados e removidos na hora, como no site. Dependem do plano (regra do backend). */
export function EditMedia({ anuncioId }: { anuncioId: string }) {
  const cache = useQueryClient();
  const rules = useQuery({ queryKey: ['ad-media-rules'], queryFn: ({ signal }) => announceApi.mediaRules(signal) });
  const media = useQuery({
    queryKey: ['ad-media', anuncioId],
    queryFn: ({ signal }) => myAdsApi.media(anuncioId, signal),
    // O vídeo é comprimido no servidor depois do envio; acompanha até ficar pronto.
    refetchInterval: (query) =>
      query.state.data?.video?.status === 'PROCESSANDO' || query.state.data?.laudo?.status === 'PROCESSANDO'
        ? 5000
        : false,
  });
  const [busy, setBusy] = useState<Kind | null>(null);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const refresh = () => {
    cache.invalidateQueries({ queryKey: ['ad-media', anuncioId] });
    cache.invalidateQueries({ queryKey: ['ad', anuncioId] });
  };

  async function run(kind: Kind, task: () => Promise<unknown>, success: string) {
    setBusy(kind);
    setError('');
    setNotice('');
    try {
      await task();
      setNotice(success);
      refresh();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Não foi possível concluir. Tente de novo.');
    } finally {
      setBusy(null);
    }
  }

  async function pickVideo() {
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['videos'], quality: 1 });
    if (result.canceled) return;
    const asset = result.assets[0];
    const limits = rules.data;
    if (limits && asset.duration != null && asset.duration / 1000 > limits.duracaoMaximaVideoSegundos) {
      setError(`O vídeo deve ter até ${limits.duracaoMaximaVideoSegundos} segundos.`);
      return;
    }
    if (limits && asset.fileSize != null && asset.fileSize > limits.tamanhoMaximoEnvioVideoBytes) {
      setError(`O vídeo passa de ${megabytes(limits.tamanhoMaximoEnvioVideoBytes)}.`);
      return;
    }
    await run(
      'video',
      () =>
        announceApi.uploadVideo(anuncioId, {
          uri: asset.uri,
          name: asset.fileName || 'veiculo.mp4',
          type: asset.mimeType || 'video/mp4',
        }),
      'Vídeo enviado. Ele é preparado no servidor e aparece no anúncio em instantes.',
    );
  }

  async function pickReport() {
    const result = await DocumentPicker.getDocumentAsync({
      type: [
        'application/pdf',
        'application/msword',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'image/jpeg',
        'image/png',
        'video/mp4',
      ],
      copyToCacheDirectory: true,
    });
    if (result.canceled) return;
    const asset = result.assets[0];
    const limits = rules.data;
    if (limits && asset.size && asset.size > limits.tamanhoMaximoLaudoBytes) {
      setError(`O laudo passa de ${megabytes(limits.tamanhoMaximoLaudoBytes)}.`);
      return;
    }
    const extension = asset.name.slice(asset.name.lastIndexOf('.') + 1).toUpperCase();
    if (limits && !limits.formatosLaudo.includes(extension === 'JPEG' ? 'JPG' : extension)) {
      setError(`Formato não aceito. Envie ${limits.formatosLaudo.join(', ')}.`);
      return;
    }
    await run(
      'laudo',
      () =>
        announceApi.uploadReport(anuncioId, {
          uri: asset.uri,
          name: asset.name,
          type: asset.mimeType || 'application/pdf',
        }),
      'Laudo enviado e salvo no anúncio.',
    );
  }

  function confirmRemove(kind: Kind) {
    showDialog({
      title: `Remover ${kind === 'video' ? 'o vídeo' : 'o laudo'}?`,
      message: 'Sai do anúncio na hora.',
      actions: [
        { label: 'Manter', kind: 'cancel' },
        {
          label: 'Remover',
          kind: 'destructive',
          onPress: () =>
            run(kind, () => myAdsApi.removeMedia(anuncioId, kind), `${labels[kind]} removido do anúncio.`),
        },
      ],
    });
  }

  if (rules.isPending || media.isPending) return <Skeleton height={120} rounded={radius.md} />;
  if (rules.isError || media.isError)
    return (
      <Notice
        tone="error"
        message="Não carregamos vídeo e laudo do anúncio."
        actionLabel="Tentar de novo"
        onAction={() => {
          rules.refetch();
          media.refetch();
        }}
      />
    );
  const current = media.data;
  if (!rules.data.liberado && !current.video && !current.laudo)
    return <Notice message="O seu plano atual não inclui vídeo e laudo." />;

  return (
    <View style={styles.root}>
      <MediaRow
        kind="video"
        media={current.video}
        busy={busy === 'video'}
        allowed={rules.data.liberado}
        disabled={Boolean(busy)}
        onPick={pickVideo}
        onRemove={() => confirmRemove('video')}
      />
      <MediaRow
        kind="laudo"
        media={current.laudo}
        busy={busy === 'laudo'}
        allowed={rules.data.liberado}
        disabled={Boolean(busy)}
        onPick={pickReport}
        onRemove={() => confirmRemove('laudo')}
      />
      {notice ? <Notice tone="success" message={notice} /> : null}
      {error ? <Notice tone="error" message={error} /> : null}
    </View>
  );
}

function MediaRow({
  kind,
  media,
  busy,
  allowed,
  disabled,
  onPick,
  onRemove,
}: {
  kind: Kind;
  media: AdMedia | null;
  busy: boolean;
  allowed: boolean;
  disabled: boolean;
  onPick: () => void;
  onRemove: () => void;
}) {
  const { colors } = useTheme();
  const Icon = kind === 'video' ? Video : FileText;
  const status = !media
    ? 'Nenhum arquivo enviado.'
    : media.status === 'PROCESSANDO'
      ? 'Preparando no servidor…'
      : media.status === 'FALHOU'
        ? media.mensagemErro || 'Não foi possível preparar o arquivo. Envie de novo.'
        : `${media.nomeArquivo} · ${megabytes(media.tamanhoBytes)}`;
  return (
    <View style={[styles.row, { backgroundColor: colors.surface, borderColor: colors.border }]}>
      <View style={styles.rowHead}>
        <Icon size={20} color={colors.muted} />
        <View style={styles.flex}>
          <AppText variant="bodyStrong">{labels[kind]}</AppText>
          <AppText variant="caption" color={media?.status === 'FALHOU' ? 'red' : 'muted'} numberOfLines={2}>
            {status}
          </AppText>
        </View>
      </View>
      <View style={styles.buttons}>
        {allowed ? (
          <Button
            label={media ? 'Trocar' : 'Enviar'}
            variant="secondary"
            loading={busy}
            disabled={disabled}
            onPress={onPick}
            style={styles.flex}
          />
        ) : null}
        {media ? (
          <Button label="Remover" variant="ghost" disabled={disabled} onPress={onRemove} style={styles.flex} />
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { gap: space.md },
  flex: { flex: 1 },
  row: { padding: space.md, borderRadius: radius.md, borderWidth: StyleSheet.hairlineWidth, gap: space.md },
  rowHead: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  buttons: { flexDirection: 'row', gap: space.sm },
});
