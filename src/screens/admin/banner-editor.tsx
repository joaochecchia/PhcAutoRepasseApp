import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import * as Haptics from 'expo-haptics';
import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import { router, Stack, usePreventRemove } from 'expo-router';
import { ImagePlus, Smartphone, Trash2, WifiOff } from 'lucide-react-native';
import { useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  View,
  type GestureResponderEvent,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { bannersApi, type AdminBanner, type BannerData } from '@/api/admin';
import type { UploadFile } from '@/api/announce';
import { mediaUrl } from '@/api/client';
import { AppText } from '@/components/app-text';
import { Button } from '@/components/button';
import { ChoiceRow } from '@/components/choice-row';
import { showDialog } from '@/components/dialog';
import { HeroCarousel } from '@/components/hero-carousel';
import { Notice } from '@/components/notice';
import { Skeleton } from '@/components/skeleton';
import { StateView } from '@/components/state-view';
import { TextField } from '@/components/text-field';
import { useTheme } from '@/hooks/use-theme';
import { radius, space, touch } from '@/theme';
import { preparePhoto } from '@/utils/prepare-photo';

import { AdminGate } from './admin-gate';
import { bannersKey, dataOf, MAX_ACTIVE } from './banners';
import { Segmented } from './ui';

/** Menor que isso o servidor recusa; abaixo do ideal (2400 × 800) a foto aparece inteira, com as bordas desfocadas. */
const MIN_SIDE = 600;
const IDEAL_WIDTH = 1200;
const IDEAL_RATIO = 2;
const DURATIONS = [3, 4, 5, 6, 7, 8, 10, 12, 15, 20];
// Mesma regra do servidor (DadosBanner): caminho do site ou https://.
const INTERNAL_LINK = /^\/(?!\/)[A-Za-z0-9\-._~/?=&%#+:,@!]*$/;
const EXTERNAL_LINK = /^https:\/\/[A-Za-z0-9.-]+\.[A-Za-z]{2,}(:[0-9]{1,5})?(\/[A-Za-z0-9\-._~/?=&%#+:,@!]*)?$/;

const emptyData: BannerData = {
  textoAlternativo: '',
  titulo: '',
  subtitulo: '',
  link: '',
  textoBotao: '',
  exibirTexto: true,
  exibirNumeros: true,
  focoX: 50,
  focoY: 50,
  ativo: false,
  ajuste: 'PREENCHER',
  duracaoSegundos: 7,
  focoXCelular: 50,
  focoYCelular: 50,
  exibirEm: 'TODOS',
};

type Picked = { file: UploadFile; uri: string };

/** Criar ou editar um banner (formulário do AdminBanners do site). {@code id} "novo" cria. */
export function BannerEditorScreen({ id }: { id: string }) {
  return (
    <AdminGate>
      <Loader id={id} />
    </AdminGate>
  );
}

function Loader({ id }: { id: string }) {
  const { colors } = useTheme();
  const banners = useQuery({ queryKey: bannersKey, queryFn: ({ signal }) => bannersApi.list(signal) });
  if (id === 'novo') {
    if (!banners.data) return <View style={[styles.root, { backgroundColor: colors.bg }]} />;
    const active = banners.data.filter((banner) => banner.ativo).length;
    return <Editor banner={null} activeOthers={active} />;
  }
  if (banners.isError) {
    return (
      <View style={[styles.root, { backgroundColor: colors.bg }]}>
        <StateView icon={WifiOff} title="O banner não carregou" message={banners.error.message} actionLabel="Tentar de novo" onAction={() => banners.refetch()} />
      </View>
    );
  }
  if (!banners.data) {
    return (
      <View style={[styles.root, styles.content, { backgroundColor: colors.bg }]}>
        <Skeleton height={180} rounded={radius.lg} />
        <Skeleton height={56} rounded={radius.md} />
      </View>
    );
  }
  const banner = banners.data.find((item) => item.id === id);
  if (!banner) {
    return (
      <View style={[styles.root, { backgroundColor: colors.bg }]}>
        <StateView icon={ImagePlus} title="Banner não encontrado" message="Ele pode ter sido excluído." actionLabel="Voltar" onAction={() => router.back()} />
      </View>
    );
  }
  const activeOthers = banners.data.filter((item) => item.ativo && item.id !== id).length;
  return <Editor key={banner.id} banner={banner} activeOthers={activeOthers} />;
}

function Editor({ banner, activeOthers }: { banner: AdminBanner | null; activeOthers: number }) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const cache = useQueryClient();
  const [data, setData] = useState<BannerData>(() =>
    banner ? dataOf(banner) : { ...emptyData, ativo: activeOthers < MAX_ACTIVE },
  );
  const [image, setImage] = useState<Picked | null>(null);
  const [mobile, setMobile] = useState<Picked | null>(null);
  const [removeMobile, setRemoveMobile] = useState(false);
  const [preparing, setPreparing] = useState<'main' | 'mobile' | null>(null);
  const [dirty, setDirty] = useState(false);
  const [leaving, setLeaving] = useState(false);
  const [error, setError] = useState('');
  const [imageNote, setImageNote] = useState('');

  const mainUri = image?.uri ?? mediaUrl(banner?.imagemUrl);
  const mobileUri = mobile?.uri ?? (removeMobile ? null : mediaUrl(banner?.imagemCelularUrl));

  function change(patch: Partial<BannerData>) {
    setData((current) => ({ ...current, ...patch }));
    setDirty(true);
    setError('');
  }

  const save = useMutation({
    mutationFn: async () => {
      if (banner) {
        await bannersApi.update(banner.id, data);
        if (image) await bannersApi.replaceImage(banner.id, image.file);
        if (mobile) await bannersApi.replaceMobileImage(banner.id, mobile.file);
        else if (removeMobile && banner.imagemCelularUrl) await bannersApi.removeMobileImage(banner.id);
      } else if (image) {
        await bannersApi.create(image.file, data, mobile?.file);
      }
    },
    onSuccess: () => {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      cache.invalidateQueries({ queryKey: bannersKey });
      cache.invalidateQueries({ queryKey: ['home-banners'] });
      showDialog({ title: data.ativo ? 'Banner no ar' : 'Rascunho salvo', message: data.ativo ? 'Já aparece na tela inicial do site e do app.' : 'Publique quando quiser pela lista de banners.' });
      leave();
    },
    onError: (reason) => {
      setError(reason.message);
      // Os textos podem ter sido salvos antes de a imagem falhar.
      if (banner) cache.invalidateQueries({ queryKey: bannersKey });
    },
  });

  const disablePrevention = usePreventRemove(dirty && !leaving && !save.isPending, ({ repeat }) =>
    showDialog({
      title: 'Descartar alterações?',
      message: 'As mudanças deste banner ainda não foram salvas.',
      actions: [
        { label: 'Continuar editando', kind: 'cancel' },
        {
          label: 'Descartar',
          kind: 'destructive',
          onPress: () => {
            setLeaving(true);
            repeat();
          },
        },
      ],
    }),
  );
  function leave() {
    setLeaving(true);
    disablePrevention();
    router.back();
  }

  async function pick(target: 'main' | 'mobile') {
    setError('');
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], exif: false, quality: 1 });
    if (result.canceled) return;
    const asset = result.assets[0];
    if (Math.max(asset.width, asset.height) < MIN_SIDE) {
      setError(`A imagem é muito pequena (${asset.width} × ${asset.height} px). Use pelo menos ${MIN_SIDE} px no maior lado.`);
      return;
    }
    setPreparing(target);
    try {
      const file = await preparePhoto(asset, target === 'main' ? 'banner.jpg' : 'banner-celular.jpg', 2560);
      const picked = { file, uri: file.uri };
      if (target === 'main') {
        const offFormat = asset.width < IDEAL_WIDTH || asset.width / asset.height < IDEAL_RATIO;
        setImageNote(
          offFormat
            ? `A foto (${asset.width} × ${asset.height} px) não está no formato ideal (2400 × 800). No computador ela aparece inteira, com as bordas desfocadas.`
            : '',
        );
        setImage(picked);
        change({ ajuste: offFormat ? 'INTEIRA' : 'PREENCHER', focoX: 50, focoY: 50 });
      } else {
        setMobile(picked);
        setRemoveMobile(false);
        change({ focoXCelular: 50, focoYCelular: 50 });
      }
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Não foi possível preparar a imagem.');
    } finally {
      setPreparing(null);
    }
  }

  function submit() {
    if (!banner && !image) return setError('Escolha a imagem do banner.');
    if (!data.textoAlternativo.trim()) return setError('Descreva a imagem no texto alternativo (é o que o leitor de tela lê).');
    const link = (data.link ?? '').trim();
    if (link && !INTERNAL_LINK.test(link) && !EXTERNAL_LINK.test(link)) {
      return setError('Link inválido: use um caminho do site (ex.: /planos) ou um endereço que comece com https://.');
    }
    if ((data.textoBotao ?? '').trim() && !link) return setError('O texto do botão só aparece quando há um link.');
    if (data.ativo && activeOthers >= MAX_ACTIVE) return setError(`A tela inicial mostra até ${MAX_ACTIVE} banners no ar. Salve como rascunho ou tire outro do ar.`);
    save.mutate();
  }

  // Prévia como o carrossel do app mostra (imagem de celular, se houver). Sem link para não sair do editor.
  const previewUri = mobileUri ?? mainUri;
  const usingMobile = Boolean(mobileUri);
  const clean = (value: string | null) => (value ?? '').trim() || undefined;

  return (
    <KeyboardAvoidingView style={styles.root} behavior={Platform.OS === 'ios' ? 'padding' : undefined} keyboardVerticalOffset={90}>
      <Stack.Screen options={{ title: banner ? 'Editar banner' : 'Novo banner' }} />
      <ScrollView
        style={{ backgroundColor: colors.bg }}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + space.xxxl }]}>
        {previewUri ? (
          <View style={styles.preview}>
            <AppText variant="overline" color="muted" style={styles.previewLabel}>
              Prévia no app
            </AppText>
            <HeroCarousel
              items={[
                {
                  id: banner?.id ?? 'novo',
                  image: { uri: previewUri },
                  showText: data.exibirTexto,
                  title: clean(data.titulo),
                  subtitle: clean(data.subtitulo),
                  cta: clean(data.link) ? (clean(data.textoBotao) ?? 'Saiba mais') : undefined,
                  link: null,
                  fit: data.ajuste === 'INTEIRA' ? 'contain' : 'cover',
                  focus: {
                    left: `${usingMobile ? data.focoXCelular : data.focoX}%`,
                    top: `${usingMobile ? data.focoYCelular : data.focoY}%`,
                  },
                  duration: data.duracaoSegundos,
                  accessibilityLabel: data.textoAlternativo || 'Prévia do banner',
                },
              ]}
            />
          </View>
        ) : null}

        <View style={styles.field}>
          <AppText variant="label">Imagem principal</AppText>
          <AppText variant="caption" color="muted">
            Ideal 2400 × 800 px. Toque na imagem para marcar o ponto que nunca é cortado.
          </AppText>
          {mainUri ? (
            <FocusPicker uri={mainUri} x={data.focoX} y={data.focoY} onChange={(x, y) => change({ focoX: x, focoY: y })} />
          ) : null}
          <Button
            label={mainUri ? 'Trocar imagem' : 'Escolher imagem'}
            variant="secondary"
            icon={preparing === 'main' ? <ActivityIndicator color={colors.text} /> : <ImagePlus size={16} color={colors.text} />}
            disabled={preparing !== null || save.isPending}
            onPress={() => pick('main')}
          />
          {imageNote ? <AppText variant="caption">{imageNote}</AppText> : null}
        </View>

        <View style={styles.field}>
          <AppText variant="label">Imagem para celular (opcional)</AppText>
          <AppText variant="caption" color="muted">
            Quadrada (1080 × 1080) ou vertical, com o texto grande. Sem ela, o celular usa a imagem principal.
          </AppText>
          {mobileUri ? (
            <FocusPicker
              uri={mobileUri}
              x={data.focoXCelular}
              y={data.focoYCelular}
              square
              onChange={(x, y) => change({ focoXCelular: x, focoYCelular: y })}
            />
          ) : null}
          <View style={styles.row}>
            <Button
              label={mobileUri ? 'Trocar' : 'Escolher imagem de celular'}
              variant="secondary"
              icon={preparing === 'mobile' ? <ActivityIndicator color={colors.text} /> : <Smartphone size={16} color={colors.text} />}
              disabled={preparing !== null || save.isPending}
              onPress={() => pick('mobile')}
              style={styles.flex}
            />
            {mobileUri ? (
              <Button
                label="Remover"
                variant="ghost"
                icon={<Trash2 size={16} color={colors.red} />}
                onPress={() => {
                  setMobile(null);
                  setRemoveMobile(true);
                  setDirty(true);
                }}
              />
            ) : null}
          </View>
        </View>

        <TextField
          label="Texto alternativo"
          value={data.textoAlternativo}
          onChangeText={(text) => change({ textoAlternativo: text })}
          placeholder="Descreva a imagem para quem usa leitor de tela"
          maxLength={200}
        />

        <ToggleRow
          label="Mostrar textos por cima"
          hint="Desligue quando a imagem já é uma arte pronta, com o texto nela."
          value={data.exibirTexto}
          onChange={(value) => change({ exibirTexto: value })}
        />
        {data.exibirTexto ? (
          <>
            <TextField label="Título" value={data.titulo ?? ''} onChangeText={(text) => change({ titulo: text })} maxLength={80} />
            <TextField label="Subtítulo" value={data.subtitulo ?? ''} onChangeText={(text) => change({ subtitulo: text })} maxLength={160} />
          </>
        ) : null}
        <TextField
          label="Link (opcional)"
          value={data.link ?? ''}
          onChangeText={(text) => change({ link: text.trim() })}
          placeholder="/planos ou https://…"
          autoCapitalize="none"
          autoCorrect={false}
          keyboardType="url"
        />
        <TextField
          label="Texto do botão"
          value={data.textoBotao ?? ''}
          onChangeText={(text) => change({ textoBotao: text })}
          placeholder="Saiba mais"
          maxLength={30}
          editable={Boolean((data.link ?? '').trim())}
        />
        <ToggleRow
          label="Mostrar os números da plataforma"
          hint="Veículos à venda e vendidos, no site."
          value={data.exibirNumeros}
          onChange={(value) => change({ exibirNumeros: value })}
        />

        <View style={styles.field}>
          <AppText variant="label">Ajuste da foto</AppText>
          <Segmented
            label="Ajuste da foto"
            value={data.ajuste}
            onChange={(value) => change({ ajuste: value })}
            options={[
              { value: 'PREENCHER', label: 'Preencher' },
              { value: 'INTEIRA', label: 'Foto inteira' },
            ]}
          />
        </View>
        <View style={styles.field}>
          <AppText variant="label">Tempo na tela</AppText>
          <ChoiceRow
            value={String(data.duracaoSegundos)}
            onChange={(value) => change({ duracaoSegundos: Number(value) })}
            options={DURATIONS.map((seconds) => ({ value: String(seconds), label: `${seconds} s` }))}
          />
        </View>
        <View style={styles.field}>
          <AppText variant="label">Onde aparece</AppText>
          <Segmented
            label="Onde o banner aparece"
            value={data.exibirEm}
            onChange={(value) => change({ exibirEm: value })}
            options={[
              { value: 'TODOS', label: 'Todas' },
              { value: 'COMPUTADOR', label: 'Computador' },
              { value: 'CELULAR', label: 'Celular' },
            ]}
          />
        </View>
        <ToggleRow
          label="No ar"
          hint={
            !data.ativo && activeOthers >= MAX_ACTIVE
              ? `Já há ${MAX_ACTIVE} banners no ar. Tire outro do ar para publicar este.`
              : 'Desligado, fica salvo como rascunho.'
          }
          value={data.ativo}
          disabled={!data.ativo && activeOthers >= MAX_ACTIVE}
          onChange={(value) => change({ ativo: value })}
        />

        {error ? <Notice tone="error" message={error} /> : null}
        <Button label={data.ativo ? 'Salvar e publicar' : 'Salvar rascunho'} loading={save.isPending} disabled={preparing !== null} onPress={submit} />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function ToggleRow({
  label,
  hint,
  value,
  onChange,
  disabled,
}: {
  label: string;
  hint: string;
  value: boolean;
  onChange: (value: boolean) => void;
  disabled?: boolean;
}) {
  const { colors } = useTheme();
  return (
    <View style={styles.toggle}>
      <View style={styles.flex}>
        <AppText variant="bodyStrong">{label}</AppText>
        <AppText variant="caption" color="muted">
          {hint}
        </AppText>
      </View>
      <Switch
        value={value}
        disabled={disabled}
        onValueChange={(next) => {
          Haptics.selectionAsync();
          onChange(next);
        }}
        trackColor={{ true: colors.red, false: colors.border }}
        thumbColor="#ffffff"
        accessibilityLabel={label}
      />
    </View>
  );
}

/** Imagem com o ponto de foco: tocar marca a parte que nunca é cortada. */
function FocusPicker({
  uri,
  x,
  y,
  square,
  onChange,
}: {
  uri: string;
  x: number;
  y: number;
  square?: boolean;
  onChange: (x: number, y: number) => void;
}) {
  const { colors } = useTheme();
  const [size, setSize] = useState({ width: 0, height: 0 });
  // A caixa toma a proporção da própria imagem, para o toque cair no ponto certo da foto.
  const [aspect, setAspect] = useState(square ? 1 : 2);
  const clamp = (value: number) => Math.min(100, Math.max(0, Math.round(value)));
  function pick(event: GestureResponderEvent) {
    if (!size.width || !size.height) return;
    Haptics.selectionAsync();
    onChange(clamp((event.nativeEvent.locationX / size.width) * 100), clamp((event.nativeEvent.locationY / size.height) * 100));
  }
  return (
    <Pressable
      onPress={pick}
      onLayout={(event) => setSize(event.nativeEvent.layout)}
      accessibilityRole="adjustable"
      accessibilityLabel={`Ponto de foco: ${x}% da esquerda, ${y}% do topo`}
      accessibilityHint="Toque na imagem para mudar"
      accessibilityActions={[
        { name: 'increment', label: 'Mover para a direita' },
        { name: 'decrement', label: 'Mover para a esquerda' },
      ]}
      onAccessibilityAction={(event) => onChange(clamp(x + (event.nativeEvent.actionName === 'increment' ? 10 : -10)), y)}
      style={[styles.focus, { aspectRatio: aspect, width: aspect < 1.2 ? '70%' : '100%', borderColor: colors.border }]}>
      <Image
        source={{ uri }}
        style={StyleSheet.absoluteFill}
        contentFit="fill"
        onLoad={(event) => {
          const { width, height } = event.source;
          if (width && height) setAspect(Math.min(4, Math.max(0.5, width / height)));
        }}
        accessibilityIgnoresInvertColors
      />
      <View
        pointerEvents="none"
        style={[styles.marker, { left: `${x}%`, top: `${y}%`, borderColor: '#ffffff', backgroundColor: colors.red }]}
      />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  flex: { flex: 1 },
  content: { padding: space.lg, gap: space.lg },
  preview: { marginHorizontal: -space.lg, gap: space.sm },
  previewLabel: { paddingHorizontal: space.lg + space.xs },
  field: { gap: space.sm },
  row: { flexDirection: 'row', gap: space.sm },
  toggle: { flexDirection: 'row', alignItems: 'center', gap: space.md, minHeight: touch },
  focus: { alignSelf: 'center', borderRadius: radius.md, borderWidth: StyleSheet.hairlineWidth, overflow: 'hidden', backgroundColor: '#121315' },
  marker: { position: 'absolute', width: 22, height: 22, marginLeft: -11, marginTop: -11, borderRadius: 11, borderWidth: 3 },
});
