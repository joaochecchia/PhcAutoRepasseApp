import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import * as Haptics from 'expo-haptics';
import { Image } from 'expo-image';
import { router } from 'expo-router';
import { ArrowDown, ArrowUp, Eye, EyeOff, GalleryHorizontal, Layers, PencilLine, Plus, RotateCcw, Save, Trash2, WifiOff } from 'lucide-react-native';
import { useState } from 'react';
import { Pressable, RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { bannersApi, type AdminBanner, type BannerData, type BannerSet } from '@/api/admin';
import { mediaUrl } from '@/api/client';
import { AppText } from '@/components/app-text';
import { Button } from '@/components/button';
import { showDialog } from '@/components/dialog';
import { Notice } from '@/components/notice';
import { Skeleton } from '@/components/skeleton';
import { StateView } from '@/components/state-view';
import { TextField } from '@/components/text-field';
import { useTheme } from '@/hooks/use-theme';
import { radius, space, touch } from '@/theme';

import { AdminGate } from './admin-gate';
import { AdminSection, Divider, Tag } from './ui';

export const bannersKey = ['admin', 'banners'] as const;
const setsKey = ['admin', 'banner-sets'] as const;
/** Mesmos limites do servidor (GerenciarBannersUseCase). */
export const MAX_ACTIVE = 8;
const MAX_TOTAL = 30;
const MAX_SETS = 20;

const screenLabels: Record<AdminBanner['exibirEm'], string> = { TODOS: 'Todas as telas', COMPUTADOR: 'Só no computador', CELULAR: 'Só no celular' };

export function dataOf(banner: AdminBanner): BannerData {
  return {
    textoAlternativo: banner.textoAlternativo,
    titulo: banner.titulo ?? '',
    subtitulo: banner.subtitulo ?? '',
    link: banner.link ?? '',
    textoBotao: banner.textoBotao ?? '',
    exibirTexto: banner.exibirTexto,
    exibirNumeros: banner.exibirNumeros,
    focoX: banner.focoX,
    focoY: banner.focoY,
    ativo: banner.ativo,
    ajuste: banner.ajuste,
    duracaoSegundos: banner.duracaoSegundos,
    focoXCelular: banner.focoXCelular ?? 50,
    focoYCelular: banner.focoYCelular ?? 50,
    exibirEm: banner.exibirEm ?? 'TODOS',
  };
}

/** Banners da tela inicial do site e do app (AdminBanners do site): ordem, publicar, editar e conjuntos salvos. */
export function BannersScreen() {
  return (
    <AdminGate>
      <Banners />
    </AdminGate>
  );
}

function Banners() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const cache = useQueryClient();
  const banners = useQuery({ queryKey: bannersKey, queryFn: ({ signal }) => bannersApi.list(signal) });
  const sets = useQuery({ queryKey: setsKey, queryFn: ({ signal }) => bannersApi.listSets(signal) });
  const [flash, setFlash] = useState('');
  const [setName, setSetName] = useState('');

  const list = banners.data ?? [];
  const activeCount = list.filter((banner) => banner.ativo).length;
  const liveKey = list.filter((banner) => banner.ativo).map((banner) => banner.id).join(',');

  const publicHome = () => cache.invalidateQueries({ queryKey: ['home-banners'] });
  const row = useMutation({
    mutationFn: async (input: { id: string; run: () => Promise<AdminBanner[] | null>; message?: string }) => {
      const result = await input.run();
      return { result, message: input.message };
    },
    onMutate: () => setFlash(''),
    onSuccess: ({ result, message }) => {
      if (result) cache.setQueryData(bannersKey, result);
      else cache.invalidateQueries({ queryKey: bannersKey });
      cache.invalidateQueries({ queryKey: setsKey });
      publicHome();
      if (message) setFlash(message);
    },
    onError: (error) => showDialog({ title: 'Não foi possível alterar o banner', message: error.message }),
  });
  const setAction = useMutation({
    mutationFn: async (input: { id: string; run: () => Promise<unknown>; message: string }) => {
      await input.run();
      return input.message;
    },
    onMutate: () => setFlash(''),
    onSuccess: (message) => {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      cache.invalidateQueries({ queryKey: bannersKey });
      cache.invalidateQueries({ queryKey: setsKey });
      publicHome();
      setFlash(message);
    },
    onError: (error) => showDialog({ title: 'Não foi possível concluir', message: error.message }),
  });

  function move(index: number, delta: -1 | 1) {
    const target = index + delta;
    if (target < 0 || target >= list.length) return;
    const ids = list.map((banner) => banner.id);
    [ids[index], ids[target]] = [ids[target], ids[index]];
    Haptics.selectionAsync();
    row.mutate({ id: list[index].id, run: () => bannersApi.reorder(ids) });
  }

  function toggle(banner: AdminBanner) {
    if (!banner.ativo && activeCount >= MAX_ACTIVE) {
      showDialog({ title: 'Limite de banners no ar', message: `A tela inicial mostra até ${MAX_ACTIVE} banners. Tire outro do ar antes.` });
      return;
    }
    row.mutate({
      id: banner.id,
      run: async () => {
        const saved = await bannersApi.update(banner.id, { ...dataOf(banner), ativo: !banner.ativo });
        return list.map((item) => (item.id === saved.id ? saved : item));
      },
      message: banner.ativo ? 'Banner tirado do ar (continua salvo como rascunho).' : 'Banner publicado na tela inicial.',
    });
  }

  function remove(banner: AdminBanner) {
    showDialog({
      title: 'Excluir banner?',
      message: `"${banner.titulo || banner.textoAlternativo}" e a imagem serão apagados. Ele também sai dos conjuntos.`,
      actions: [
        { label: 'Manter', kind: 'cancel' },
        {
          label: 'Excluir',
          kind: 'destructive',
          onPress: () =>
            row.mutate({
              id: banner.id,
              run: async () => {
                await bannersApi.remove(banner.id);
                return list.filter((item) => item.id !== banner.id);
              },
              message: 'Banner excluído.',
            }),
        },
      ],
    });
  }

  function applySet(set: BannerSet | null) {
    showDialog({
      title: set ? `Colocar "${set.nome}" no ar?` : 'Voltar ao banner original?',
      message: set
        ? 'Os banners fora do conjunto saem da tela inicial e ficam como rascunho.'
        : 'Todos os banners saem do ar e ficam salvos como rascunho. A tela inicial volta à foto padrão.',
      actions: [
        { label: 'Cancelar', kind: 'cancel' },
        {
          label: 'Aplicar',
          onPress: () =>
            setAction.mutate({
              id: set?.id ?? 'original',
              run: () => (set ? bannersApi.applySet(set.id) : bannersApi.applyOriginal()),
              message: set ? `Conjunto "${set.nome}" está no ar.` : 'A tela inicial voltou ao banner original.',
            }),
        },
      ],
    });
  }

  function saveSet() {
    const nome = setName.trim();
    if (nome.length < 2 || nome.length > 60) {
      showDialog({ title: 'Nome do conjunto', message: 'Use de 2 a 60 caracteres.' });
      return;
    }
    setAction.mutate({ id: 'novo', run: () => bannersApi.createSet(nome), message: `Conjunto "${nome}" salvo com os banners no ar.` });
    setSetName('');
  }

  if (banners.isError) {
    return (
      <View style={[styles.root, { backgroundColor: colors.bg }]}>
        <StateView icon={WifiOff} title="Os banners não carregaram" message={banners.error.message} actionLabel="Tentar de novo" onAction={() => banners.refetch()} />
      </View>
    );
  }

  const busyRow = row.isPending ? row.variables?.id : null;
  return (
    <ScrollView
      style={{ backgroundColor: colors.bg }}
      contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + space.xxl }]}
      keyboardShouldPersistTaps="handled"
      refreshControl={
        <RefreshControl
          refreshing={banners.isRefetching}
          onRefresh={() => {
            banners.refetch();
            sets.refetch();
          }}
          tintColor={colors.red}
        />
      }>
      <AppText color="muted">
        O carrossel da tela inicial do site e do app. {activeCount} de {MAX_ACTIVE} no ar · {list.length} de {MAX_TOTAL} salvos.
      </AppText>
      <Button
        label="Novo banner"
        icon={<Plus size={17} color={colors.onRed} />}
        disabled={!banners.data || list.length >= MAX_TOTAL}
        onPress={() => router.push({ pathname: '/admin/banners/[id]', params: { id: 'novo' } })}
      />
      {flash ? <Notice tone="success" message={flash} /> : null}

      {!banners.data ? (
        <View style={styles.gap}>
          <Skeleton height={220} rounded={radius.lg} />
          <Skeleton height={220} rounded={radius.lg} />
        </View>
      ) : list.length === 0 ? (
        <StateView
          icon={GalleryHorizontal}
          title="Nenhum banner salvo"
          message="Sem banners no ar, a tela inicial mostra a foto padrão. Crie um para destacar uma campanha."
          compact
        />
      ) : (
        list.map((banner, index) => {
          const busy = busyRow === banner.id;
          const image = mediaUrl(banner.imagemCelularUrl ?? banner.imagemUrl);
          return (
            <View key={banner.id} style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <Pressable
                onPress={() => router.push({ pathname: '/admin/banners/[id]', params: { id: banner.id } })}
                accessibilityRole="button"
                accessibilityLabel={`Editar banner ${banner.titulo || banner.textoAlternativo}`}>
                {image ? (
                  <Image
                    source={{ uri: image }}
                    style={styles.thumb}
                    contentFit="cover"
                    contentPosition={{ left: `${banner.focoX}%`, top: `${banner.focoY}%` }}
                    accessibilityIgnoresInvertColors
                  />
                ) : null}
              </Pressable>
              <View style={styles.cardBody}>
                <View style={styles.tags}>
                  <Tag label={banner.ativo ? `No ar · ${index + 1}º` : 'Rascunho'} tone={banner.ativo ? 'good' : 'neutral'} />
                  <Tag label={screenLabels[banner.exibirEm]} />
                  {banner.imagemCelularUrl ? <Tag label="Imagem de celular" /> : null}
                </View>
                <AppText variant="bodyStrong" numberOfLines={2}>
                  {banner.titulo || banner.textoAlternativo}
                </AppText>
                <AppText variant="caption" color="muted" numberOfLines={1}>
                  {banner.duracaoSegundos} s{banner.link ? ` · ${banner.link}` : ' · sem link'}
                </AppText>
                <View style={styles.actions}>
                  <IconAction label="Subir" icon={ArrowUp} disabled={busy || index === 0} onPress={() => move(index, -1)} />
                  <IconAction label="Descer" icon={ArrowDown} disabled={busy || index === list.length - 1} onPress={() => move(index, 1)} />
                  <IconAction
                    label={banner.ativo ? 'Tirar do ar' : 'Publicar'}
                    icon={banner.ativo ? EyeOff : Eye}
                    disabled={busy}
                    onPress={() => toggle(banner)}
                  />
                  <IconAction
                    label="Editar"
                    icon={PencilLine}
                    disabled={busy}
                    onPress={() => router.push({ pathname: '/admin/banners/[id]', params: { id: banner.id } })}
                  />
                  <IconAction label="Excluir" icon={Trash2} danger disabled={busy} onPress={() => remove(banner)} />
                </View>
              </View>
            </View>
          );
        })
      )}

      <AdminSection title="Conjuntos" note="Guarde quais banners ficam no ar e em que ordem, para trocar de campanha num toque.">
        <AdminSetRow
          name="Original do site"
          detail="Tira todos do ar; a tela inicial volta à foto padrão"
          icon={RotateCcw}
          busy={setAction.isPending && setAction.variables?.id === 'original'}
          onApply={() => applySet(null)}
        />
        {sets.isError ? (
          <>
            <Divider />
            <Notice tone="error" message={sets.error.message} actionLabel="Tentar de novo" onAction={() => sets.refetch()} style={styles.inset} />
          </>
        ) : null}
        {(sets.data ?? []).map((set) => {
          const live = set.bannerIds.join(',') === liveKey && liveKey !== '';
          return (
            <View key={set.id}>
              <Divider />
              <AdminSetRow
                name={set.nome}
                detail={`${set.bannerIds.length} ${set.bannerIds.length === 1 ? 'banner' : 'banners'}${live ? ' · no ar agora' : ''}`}
                icon={Layers}
                busy={setAction.isPending && setAction.variables?.id === set.id}
                onApply={() => applySet(set)}
                onUpdate={() =>
                  showDialog({
                    title: `Atualizar "${set.nome}"?`,
                    message: 'O conjunto passa a guardar os banners que estão no ar agora, nesta ordem.',
                    actions: [
                      { label: 'Cancelar', kind: 'cancel' },
                      {
                        label: 'Atualizar',
                        onPress: () => setAction.mutate({ id: set.id, run: () => bannersApi.updateSet(set.id), message: `Conjunto "${set.nome}" atualizado.` }),
                      },
                    ],
                  })
                }
                onDelete={() =>
                  showDialog({
                    title: `Excluir "${set.nome}"?`,
                    message: 'Só o conjunto é apagado; os banners continuam salvos.',
                    actions: [
                      { label: 'Manter', kind: 'cancel' },
                      {
                        label: 'Excluir',
                        kind: 'destructive',
                        onPress: () => setAction.mutate({ id: set.id, run: () => bannersApi.removeSet(set.id), message: 'Conjunto excluído.' }),
                      },
                    ],
                  })
                }
              />
            </View>
          );
        })}
        <Divider inset={false} />
        <View style={styles.newSet}>
          <TextField
            label="Salvar o que está no ar como"
            value={setName}
            onChangeText={setSetName}
            placeholder="Ex.: Black Friday"
            maxLength={60}
            returnKeyType="done"
            onSubmitEditing={saveSet}
          />
          <Button
            label="Salvar conjunto"
            variant="secondary"
            icon={<Save size={16} color={colors.text} />}
            disabled={activeCount === 0 || (sets.data?.length ?? 0) >= MAX_SETS}
            loading={setAction.isPending && setAction.variables?.id === 'novo'}
            onPress={saveSet}
          />
          {activeCount === 0 ? (
            <AppText variant="caption" color="muted">
              Publique ao menos um banner para salvar um conjunto.
            </AppText>
          ) : null}
        </View>
      </AdminSection>
    </ScrollView>
  );
}

function IconAction({
  label,
  icon: Icon,
  onPress,
  disabled,
  danger,
}: {
  label: string;
  icon: typeof Eye;
  onPress: () => void;
  disabled?: boolean;
  danger?: boolean;
}) {
  const { colors } = useTheme();
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled }}
      hitSlop={4}
      style={({ pressed }) => [
        styles.iconAction,
        { borderColor: colors.border, backgroundColor: pressed ? colors.subtle : colors.surface, opacity: disabled ? 0.4 : 1 },
      ]}>
      <Icon size={18} color={danger ? colors.red : colors.text} />
    </Pressable>
  );
}

function AdminSetRow({
  name,
  detail,
  icon: Icon,
  busy,
  onApply,
  onUpdate,
  onDelete,
}: {
  name: string;
  detail: string;
  icon: typeof Eye;
  busy: boolean;
  onApply: () => void;
  onUpdate?: () => void;
  onDelete?: () => void;
}) {
  const { colors } = useTheme();
  return (
    <View style={styles.setRow}>
      <Icon size={20} color={colors.text} />
      <View style={styles.flex}>
        <AppText variant="bodyStrong">{name}</AppText>
        <AppText variant="caption" color="muted">
          {detail}
        </AppText>
      </View>
      {onUpdate ? <IconAction label={`Atualizar ${name} com o que está no ar`} icon={Save} disabled={busy} onPress={onUpdate} /> : null}
      {onDelete ? <IconAction label={`Excluir ${name}`} icon={Trash2} danger disabled={busy} onPress={onDelete} /> : null}
      <Button label="Aplicar" variant="secondary" loading={busy} onPress={onApply} />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  flex: { flex: 1, gap: 2 },
  content: { padding: space.lg, gap: space.lg },
  gap: { gap: space.md },
  card: { borderRadius: radius.lg, borderWidth: StyleSheet.hairlineWidth, overflow: 'hidden' },
  thumb: { width: '100%', aspectRatio: 2.4 },
  cardBody: { padding: space.lg, gap: space.sm },
  tags: { flexDirection: 'row', flexWrap: 'wrap', gap: space.xs },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm, marginTop: space.xs },
  iconAction: {
    width: touch,
    height: touch,
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: 'center',
    justifyContent: 'center',
  },
  setRow: { flexDirection: 'row', alignItems: 'center', gap: space.sm, paddingHorizontal: space.lg, paddingVertical: space.md },
  newSet: { padding: space.lg, gap: space.sm },
  inset: { margin: space.lg },
});
