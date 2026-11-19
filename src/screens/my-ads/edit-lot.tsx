import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import * as DocumentPicker from 'expo-document-picker';
import * as Haptics from 'expo-haptics';
import * as ImagePicker from 'expo-image-picker';
import { router, useLocalSearchParams, usePreventRemove } from 'expo-router';
import { Check, FileText, Film, Layers, Plus, Trash2, WifiOff } from 'lucide-react-native';
import { useMemo, useState, type ReactNode } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { fetchLot } from '@/api/ads';
import { announceApi, type MediaRules } from '@/api/announce';
import type { Lot } from '@/api/contracts';
import { lotsApi, myAdsApi, type AdForEdit, type AdStatus } from '@/api/my-ads';
import { findAddressByCep } from '@/api/viacep';
import { AppText } from '@/components/app-text';
import { Button } from '@/components/button';
import { showDialog } from '@/components/dialog';
import { Notice } from '@/components/notice';
import { Skeleton } from '@/components/skeleton';
import { StateView } from '@/components/state-view';
import { TextField } from '@/components/text-field';
import { useSession } from '@/hooks/use-session';
import { useTheme } from '@/hooks/use-theme';
import { radius, space } from '@/theme';
import { formatCents } from '@/utils/format';
import { cleanMasked, displayMasked, maskInput } from '@/utils/masks';
import { ChoiceRow } from '@/components/choice-row';
import { AdField, suggestionsFor } from '@/screens/announce/ad-fields';
import { addressFields, fieldsByType, type Field } from '@/screens/announce/fields';
import { adPayload, type Draft } from '@/screens/announce/payload';
import { adPatch, adToDraft, type Motors } from './edit-draft';
import { PhotoManager } from './edit-photos';
import { StatusPill } from './my-ad-card';

const MAX_LOT_CARS = 50;
/** Cor, placa e km são de cada carro (editados na lista); o resto da ficha é comum. */
const CAR_FIELDS = ['placa', 'quilometragem'];

type CarDraft = { cor: string; placa: string; quilometragem: string };
type LotCar = NonNullable<Lot['carros']>[number];
const carDraft = (car: LotCar): CarDraft => ({
  cor: car.cor || '',
  placa: car.placa || '',
  quilometragem: car.quilometragem == null ? '' : String(car.quilometragem),
});

/** Rota /meus-anuncios/lote/[id]: carrega o lote e o anúncio-modelo (um carro ainda à venda). */
export function EditLotScreen() {
  const { colors } = useTheme();
  const { id } = useLocalSearchParams<{ id: string }>();
  const data = useQuery({
    queryKey: ['lot-edit', id],
    staleTime: Infinity,
    refetchOnMount: 'always',
    queryFn: async ({ signal }) => {
      const lot = await fetchLot(id, signal, true);
      if (!lot.carros) throw new Error('Só o anunciante pode editar este lote.');
      const base = lot.carros.find((car) => car.status !== 'VENDIDO') ?? lot.carros[0];
      const template = base ? await myAdsApi.forEdit(base.anuncioId, signal) : null;
      return { lot, template };
    },
  });
  if (data.isError)
    return (
      <View style={[styles.flex, { backgroundColor: colors.bg }]}>
        <StateView
          icon={WifiOff}
          title="Não deu para abrir este lote"
          message={data.error.message}
          actionLabel="Tentar de novo"
          onAction={() => data.refetch()}
        />
      </View>
    );
  if (!data.data || data.isFetching)
    return (
      <View style={[styles.flex, styles.content, { backgroundColor: colors.bg }]}>
        <Skeleton width="40%" height={12} />
        <Skeleton width="80%" height={24} />
        <Skeleton height={52} rounded={radius.md} />
        <Skeleton height={160} rounded={radius.md} />
      </View>
    );
  return <LotForm key={data.data.lot.id} initialLot={data.data.lot} template={data.data.template} />;
}

function LotForm({ initialLot, template }: { initialLot: Lot; template: AdForEdit | null }) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const cache = useQueryClient();
  const session = useSession();
  const usuarioId = session.status === 'authenticated' ? session.user.usuarioId : (template?.anuncianteId ?? '');
  const loaded = useMemo(() => (template ? adToDraft(template) : null), [template]);
  // O lote atual (fotos, vídeo, carros) muda com as ações salvas na hora; os dados comuns, só ao salvar.
  const lotQuery = useQuery({
    queryKey: ['lot', initialLot.id, true],
    queryFn: ({ signal }) => fetchLot(initialLot.id, signal, true),
    initialData: initialLot,
  });
  const lot = lotQuery.data;
  const lotCars = lot.carros ?? [];
  const [values, setValues] = useState<Draft>(loaded?.draft ?? ({ tipoVeiculo: 'CARRO' } as Draft));
  const [cars, setCars] = useState<Record<string, CarDraft>>(() =>
    Object.fromEntries((initialLot.carros ?? []).map((car) => [car.anuncioId, carDraft(car)])),
  );
  const [error, setError] = useState('');
  const [busy, setBusy] = useState('');
  const [carNotice, setCarNotice] = useState<{ tone: 'success' | 'error'; text: string } | null>(null);
  const [adding, setAdding] = useState(false);
  const [leaving, setLeaving] = useState(false);
  const [cepBusy, setCepBusy] = useState(false);

  const catalog = useQuery({ queryKey: ['ad-catalog'], queryFn: ({ signal }) => announceApi.catalog(signal) });
  const rules = useQuery({ queryKey: ['ad-media-rules'], queryFn: ({ signal }) => announceApi.mediaRules(signal) });
  const tipo = values.tipoVeiculo;
  const zeroKm = values.condicao === 'ZERO_KM';
  const electric =
    (tipo === 'CARRO' || tipo === 'CAMINHONETE') &&
    (values[`${tipo}.combustivel`] || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase() === 'eletrico';
  const technical = (fieldsByType[tipo] ?? [])
    .filter((item) => !CAR_FIELDS.includes(item.key))
    .filter((item) => !zeroKm || !['exibirPlacaCompleta', 'ipvaPago', 'licenciado', 'unicoDono'].includes(item.key))
    .filter((item) => !electric || !['motorizacao', 'turbo'].includes(item.key));

  const sharedPatch = (() => {
    if (!loaded) return {};
    const patch = adPatch(loaded, { draft: values, motors: loaded.motors as Motors }, usuarioId, {});
    delete patch.publicarAgora;
    return patch;
  })();
  const carPatches = lotCars.flatMap((car) => {
    const before = carDraft(car);
    const after = cars[car.anuncioId];
    if (!after) return [];
    const patch: Record<string, unknown> = {};
    if (after.cor.trim() !== before.cor) patch.cor = after.cor.trim();
    const carro: Record<string, unknown> = {};
    if (!zeroKm && after.placa !== before.placa) carro.placa = after.placa;
    if (!zeroKm && after.quilometragem !== before.quilometragem) carro.quilometragem = Number(after.quilometragem);
    if (Object.keys(carro).length) patch.carro = carro;
    return Object.keys(patch).length ? [{ id: car.anuncioId, patch }] : [];
  });
  const dirty = Object.keys(sharedPatch).length > 0 || carPatches.length > 0;

  const disablePrevention = usePreventRemove(dirty && !leaving, ({ repeat }) =>
    showDialog({
      title: 'Descartar alterações?',
      message: 'As mudanças nos dados do lote e dos carros ainda não foram salvas.',
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
  const refreshAll = () => {
    cache.invalidateQueries({ queryKey: ['lot', lot.id] });
    cache.invalidateQueries({ queryKey: ['my-lots'] });
    cache.invalidateQueries({ queryKey: ['my-ads'] });
  };

  function change(key: string, value: string) {
    setError('');
    setValues((prev) => {
      if (prev[key] === value) return prev;
      const next: Draft = { ...prev, [key]: value };
      if (key === 'contatoNaoDivulgar' && value === 'true') Object.assign(next, { contatoWhatsapp: 'false', contatoLigacao: 'false' });
      if ((key === 'contatoWhatsapp' || key === 'contatoLigacao') && value === 'true') next.contatoNaoDivulgar = 'false';
      return next;
    });
  }
  const changeCar = (carId: string, patch: Partial<CarDraft>) => {
    setError('');
    setCars((prev) => ({ ...prev, [carId]: { ...(prev[carId] ?? { cor: '', placa: '', quilometragem: '' }), ...patch } }));
  };

  /** Ações salvas na hora (fotos, vídeo, laudo, situação do carro): mostra o resultado perto dos carros. */
  async function now(key: string, action: () => Promise<unknown>, success: string) {
    setBusy(key);
    setCarNotice(null);
    try {
      await action();
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setCarNotice({ tone: 'success', text: success });
      await lotQuery.refetch();
      refreshAll();
    } catch (reason) {
      setCarNotice({ tone: 'error', text: reason instanceof Error ? reason.message : 'Não foi possível concluir a ação.' });
    } finally {
      setBusy('');
    }
  }

  function problem(): string {
    if (template) {
      for (const item of [
        { key: 'titulo', label: 'Título do lote', required: true } as Field,
        { key: 'anoFabricacao', label: 'Ano de fabricação', required: true } as Field,
      ])
        if (!(values[item.key] || '').trim()) return `Preencha ${item.label.toLowerCase()}.`;
      if (!(Number(values.precoReais) > 0)) return 'Informe o preço de cada carro.';
      for (const item of technical)
        if (item.required && !(values[`${tipo}.${item.key}`] || '').trim()) return `Preencha ${item.label.toLowerCase()}.`;
      for (const item of addressFields)
        if (item.required && !(values[`endereco.${item.key}`] || '').trim()) return `Preencha ${item.label.toLowerCase()}.`;
      if ((values['endereco.cep'] || '').length !== 8) return 'Informe os 8 números do CEP.';
      if (values.contatoNaoDivulgar !== 'true' && values.contatoWhatsapp !== 'true' && values.contatoLigacao !== 'true')
        return 'Escolha pelo menos um meio de contato.';
    }
    const plates = new Set<string>();
    for (const [index, car] of lotCars.entries()) {
      const draft = cars[car.anuncioId];
      if (!draft || car.status === 'VENDIDO') continue;
      const label = `Carro ${index + 1}`;
      if (!draft.cor.trim()) return `${label}: informe a cor.`;
      if (zeroKm) continue;
      if (!/^[A-Z]{3}[0-9][A-Z0-9][0-9]{2}$/.test(draft.placa)) return `${label}: informe a placa no padrão ABC1D23.`;
      if (plates.has(draft.placa)) return `${label}: a placa ${draft.placa} já está em outro carro do lote.`;
      plates.add(draft.placa);
      if (draft.quilometragem === '') return `${label}: informe a quilometragem.`;
    }
    return '';
  }

  const save = useMutation({
    mutationFn: async () => {
      if (Object.keys(sharedPatch).length) await lotsApi.update(lot.id, sharedPatch);
      for (const { id, patch } of carPatches) await myAdsApi.update(id, patch);
    },
    onSuccess: () => {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      refreshAll();
      cache.removeQueries({ queryKey: ['lot-edit', lot.id] });
      leave();
    },
    onError: (reason) => setError(reason.message),
  });

  function submit() {
    if (!dirty) return leave();
    const found = problem();
    if (found) return setError(found);
    setError('');
    save.mutate();
  }

  async function lookupCep() {
    setCepBusy(true);
    try {
      const result = await findAddressByCep(values['endereco.cep'] || '');
      setValues((prev) => ({
        ...prev,
        'endereco.uf': result.uf,
        'endereco.cidade': result.localidade,
        'endereco.bairro': result.bairro,
        'endereco.rua': result.logradouro,
      }));
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Não foi possível consultar o CEP.');
    } finally {
      setCepBusy(false);
    }
  }

  async function pickVideo() {
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['videos'], quality: 1 });
    if (result.canceled) return;
    const asset = result.assets[0];
    const limits = rules.data;
    if (limits && asset.duration != null && asset.duration / 1000 > limits.duracaoMaximaVideoSegundos)
      return setCarNotice({ tone: 'error', text: `O vídeo deve ter até ${limits.duracaoMaximaVideoSegundos} segundos.` });
    if (limits && asset.fileSize != null && asset.fileSize > limits.tamanhoMaximoEnvioVideoBytes)
      return setCarNotice({ tone: 'error', text: 'O vídeo é maior que o limite de envio.' });
    await now(
      'video',
      () =>
        announceApi.uploadLotVideo(lot.id, {
          uri: asset.uri,
          name: asset.fileName || 'video-do-lote.mp4',
          type: asset.mimeType || 'video/mp4',
        }),
      'Vídeo recebido e salvo. Ele aparece no lote depois da compressão.',
    );
  }

  async function pickReport(car: LotCar, index: number) {
    const result = await DocumentPicker.getDocumentAsync({
      type: ['application/pdf', 'image/jpeg', 'image/png', 'video/mp4', 'application/msword',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document'],
      copyToCacheDirectory: true,
    });
    if (result.canceled) return;
    const asset = result.assets[0];
    const problemText = reportProblem(asset, rules.data);
    if (problemText) return setCarNotice({ tone: 'error', text: problemText });
    await now(
      `laudo-${car.anuncioId}`,
      () => announceApi.uploadReport(car.anuncioId, { uri: asset.uri, name: asset.name, type: asset.mimeType || 'application/pdf' }),
      `Laudo do carro ${index + 1} enviado e salvo.`,
    );
  }

  const field = (item: Field, prefix = '') => (
    <AdField
      key={`${prefix}${item.key}`}
      item={item}
      prefix={prefix}
      values={values}
      suggestions={suggestionsFor(catalog.data, tipo, values.fabricante, item.key)}
      onChange={change}
    />
  );

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
      style={[styles.flex, { backgroundColor: colors.bg }]}>
      <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.content}>
        <View style={styles.intro}>
          <View style={styles.inline}>
            <Layers size={14} color={colors.red} />
            <AppText variant="overline" color="red">
              Editar lote
            </AppText>
          </View>
          <AppText variant="title">{lot.titulo}</AppText>
          <AppText color="muted">
            {lot.fabricante} {lot.modelo} · {lot.anoModelo} · {formatCents(lot.precoCentavos)} cada · {lot.disponiveis} de{' '}
            {lotCars.length} à venda
          </AppText>
          <Button
            label="Ver lote"
            variant="ghost"
            onPress={() => router.push({ pathname: '/lote/[id]', params: { id: lot.id } })}
            style={styles.left}
          />
        </View>

        {template ? (
          <>
            <Section title="Dados comuns" note="Valem para todos os carros à venda. Vendidos e reservados não mudam.">
              <View style={[styles.model, { backgroundColor: colors.subtle }]}>
                <AppText variant="bodyStrong">
                  {lot.fabricante} {lot.modelo}
                </AppText>
                <AppText variant="caption" color="muted">
                  {[lot.versao !== lot.modelo ? lot.versao : null, String(lot.anoModelo), values.condicao === 'REPASSE' ? 'Repasse' : zeroKm ? 'Zero km' : 'Seminovo']
                    .filter(Boolean)
                    .join(' · ')}
                  . O modelo do lote não muda; para outro modelo, crie outro lote.
                </AppText>
              </View>
              {field({ key: 'anoFabricacao', label: 'Ano de fabricação', required: true, kind: 'number' })}
              {field({ key: 'historicoLeilao', label: 'Passou por leilão?', kind: 'boolean', required: true })}
              {field({ key: 'historicoSinistro', label: 'Teve sinistro?', kind: 'boolean', required: true })}
              {field({ key: 'identificadorPublico', label: 'Referência pública', maxLength: 80 })}
              {field({ key: 'tipoFreio', label: 'Tipo de freio', maxLength: 60 })}
            </Section>
            <Section title="Ficha técnica">{technical.map((item) => field(item, `${tipo}.`))}</Section>
            <Section title="Anúncio">
              {field({ key: 'titulo', label: 'Título do lote', required: true, maxLength: 180 })}
              {field({ key: 'precoReais', label: 'Preço de cada carro (R$)', required: true, mask: 'money' })}
              {field({ key: 'descricao', label: 'Descrição', maxLength: 10000, multiline: true })}
              {field({ key: 'aceitaTroca', label: 'Aceita troca?', kind: 'boolean' })}
              <AppText variant="label">Como compradores podem falar com você?</AppText>
              <ChoiceRow
                value={values.contatoNaoDivulgar}
                options={[
                  { value: 'true', label: 'Não divulgar contatos' },
                  { value: 'false', label: 'Divulgar contatos' },
                ]}
                onChange={(value) => change('contatoNaoDivulgar', value)}
              />
              {values.contatoNaoDivulgar === 'false' ? (
                <>
                  {field({ key: 'contatoWhatsapp', label: 'Permitir WhatsApp?', kind: 'boolean' })}
                  {field({ key: 'contatoLigacao', label: 'Permitir ligação?', kind: 'boolean' })}
                </>
              ) : null}
            </Section>
            <Section title="Localização" note="Na vitrine aparece só a cidade; rua e número ficam privados.">
              {field(addressFields[0], 'endereco.')}
              <Button label="Buscar endereço pelo CEP" variant="secondary" loading={cepBusy} onPress={lookupCep} />
              {addressFields.slice(1).map((item) => field(item, 'endereco.'))}
            </Section>
          </>
        ) : (
          <Notice message="O lote está vazio. Adicione carros para editar os dados comuns." />
        )}

        <Section title={`Carros do lote (${lotCars.length})`} note="Cor, placa e km são salvos no botão abaixo. Laudo e situação, na hora.">
          {lotCars.map((car, index) => (
            <CarRow
              key={car.anuncioId}
              car={car}
              index={index}
              draft={cars[car.anuncioId] ?? carDraft(car)}
              zeroKm={zeroKm}
              rules={rules.data}
              busy={busy}
              onChange={(patch) => changeCar(car.anuncioId, patch)}
              onReport={() => pickReport(car, index)}
              onRemoveReport={() =>
                now(`laudo-${car.anuncioId}`, () => myAdsApi.removeMedia(car.anuncioId, 'laudo'), `Laudo do carro ${index + 1} removido.`)
              }
              onToggle={() =>
                now(
                  `status-${car.anuncioId}`,
                  () => myAdsApi.setPublished(car.anuncioId, car.status !== 'PUBLICADO'),
                  car.status === 'PUBLICADO' ? `Carro ${index + 1} saiu da vitrine.` : `Carro ${index + 1} publicado.`,
                )
              }
              onLeave={() =>
                showDialog({
                  title: `Tirar o carro ${index + 1} do lote?`,
                  message: 'Ele vira um anúncio avulso; sem fotos próprias, volta a rascunho.',
                  actions: [
                    { label: 'Manter no lote', kind: 'cancel' },
                    {
                      label: 'Tirar do lote',
                      kind: 'destructive',
                      onPress: () =>
                        now(`sair-${car.anuncioId}`, () => lotsApi.removeCar(lot.id, car.anuncioId), `Carro ${index + 1} retirado do lote.`).then(() =>
                          setCars((prev) => {
                            const next = { ...prev };
                            delete next[car.anuncioId];
                            return next;
                          }),
                        ),
                    },
                  ],
                })
              }
            />
          ))}
          {carNotice ? <Notice tone={carNotice.tone} message={carNotice.text} /> : null}
          {adding ? (
            <AddCars
              lot={lot}
              usuarioId={usuarioId}
              onCancel={() => setAdding(false)}
              onDone={(message) => {
                setAdding(false);
                setCarNotice({ tone: 'success', text: message });
                lotQuery.refetch().then((fresh) => {
                  if (fresh.data?.carros)
                    setCars((prev) => ({
                      ...Object.fromEntries(fresh.data.carros!.map((car) => [car.anuncioId, carDraft(car)])),
                      ...prev,
                    }));
                });
                refreshAll();
              }}
            />
          ) : (
            <Button
              label="Adicionar carros"
              variant="secondary"
              icon={<Plus size={16} color={colors.text} />}
              disabled={lotCars.length >= MAX_LOT_CARS}
              onPress={() => setAdding(true)}
            />
          )}
        </Section>

        <Section title="Fotos do lote">
          <PhotoManager
            photos={lot.fotos}
            loading={false}
            failed={false}
            retrying={false}
            onRetry={() => lotQuery.refetch()}
            upload={(file, posicao) => lotsApi.addPhoto(lot.id, file, posicao)}
            remove={(fotoId) => lotsApi.removePhoto(lot.id, fotoId)}
            onChanged={() => {
              lotQuery.refetch();
              refreshAll();
            }}
            noun="lote"
            keepOne
          />
        </Section>

        <Section title="Vídeo do lote" note="Aparece em todos os carros, junto das fotos. Salvo na hora.">
          <View style={[styles.media, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <View style={styles.inline}>
              <Film size={20} color={colors.muted} />
              <View style={styles.flex}>
                <AppText variant="bodyStrong">{lot.video ? 'Vídeo enviado' : 'Nenhum vídeo enviado'}</AppText>
                <AppText variant="caption" color={lot.video?.status === 'FALHOU' ? 'red' : 'muted'}>
                  {!lot.video
                    ? 'Envie um vídeo de até 30 s mostrando os carros.'
                    : lot.video.status === 'PROCESSANDO'
                      ? 'Comprimindo o vídeo… aparece no lote em alguns minutos.'
                      : lot.video.status === 'FALHOU'
                        ? lot.video.mensagemErro || 'Não foi possível processar o vídeo.'
                        : `${lot.video.duracaoSegundos ?? ''}s · ${Math.max(1, Math.round(lot.video.tamanhoBytes / 1024 / 1024))} MB`}
                </AppText>
              </View>
            </View>
            {rules.data?.liberado ? (
              <View style={styles.row}>
                <Button
                  label={lot.video ? 'Trocar vídeo' : 'Enviar vídeo'}
                  variant="secondary"
                  loading={busy === 'video'}
                  disabled={Boolean(busy)}
                  onPress={pickVideo}
                  style={styles.flex}
                />
                {lot.video ? (
                  <Button
                    label="Remover"
                    variant="ghost"
                    disabled={Boolean(busy)}
                    onPress={() =>
                      showDialog({
                        title: 'Remover o vídeo do lote?',
                        actions: [
                          { label: 'Manter', kind: 'cancel' },
                          { label: 'Remover', kind: 'destructive', onPress: () => now('video', () => lotsApi.removeVideo(lot.id), 'Vídeo removido do lote.') },
                        ],
                      })
                    }
                    style={styles.flex}
                  />
                ) : null}
              </View>
            ) : rules.data ? (
              <AppText variant="caption" color="muted">
                O seu plano atual não inclui vídeo e laudo.
              </AppText>
            ) : null}
          </View>
        </Section>

        <Section title="Excluir lote" note="Os carros viram anúncios avulsos; os que não têm fotos próprias voltam a rascunho.">
          <Button
            label="Excluir lote"
            variant="secondary"
            icon={<Trash2 size={16} color={colors.red} />}
            disabled={Boolean(busy)}
            onPress={() =>
              showDialog({
                title: 'Excluir o lote?',
                message: 'Os carros continuam em Meus anúncios, como anúncios avulsos.',
                actions: [
                  { label: 'Manter', kind: 'cancel' },
                  {
                    label: 'Excluir',
                    kind: 'destructive',
                    onPress: async () => {
                      try {
                        await lotsApi.remove(lot.id);
                        refreshAll();
                        leave();
                      } catch (reason) {
                        showDialog({ title: 'Não foi possível excluir', message: reason instanceof Error ? reason.message : 'Tente de novo.' });
                      }
                    },
                  },
                ],
              })
            }
          />
        </Section>
      </ScrollView>
      <View style={[styles.footer, { borderTopColor: colors.border, backgroundColor: colors.bg, paddingBottom: insets.bottom + space.md }]}>
        {error ? <Notice tone="error" message={error} /> : null}
        <Button
          label={dirty ? 'Salvar alterações' : 'Tudo salvo'}
          variant={dirty ? 'primary' : 'secondary'}
          loading={save.isPending}
          onPress={submit}
          accessibilityHint={dirty ? undefined : 'Fotos, vídeo e laudos já foram salvos. Volta para Meus anúncios.'}
        />
      </View>
    </KeyboardAvoidingView>
  );
}

function reportProblem(asset: { name: string; size?: number | null }, rules: MediaRules | undefined) {
  if (!rules) return '';
  if (asset.size && asset.size > rules.tamanhoMaximoLaudoBytes) return 'O laudo é maior que o limite de envio.';
  const extension = asset.name.slice(asset.name.lastIndexOf('.') + 1).toUpperCase();
  if (!rules.formatosLaudo.includes(extension === 'JPEG' ? 'JPG' : extension))
    return `Formato não aceito. Envie ${rules.formatosLaudo.join(', ')}.`;
  return '';
}

function CarRow({
  car,
  index,
  draft,
  zeroKm,
  rules,
  busy,
  onChange,
  onReport,
  onRemoveReport,
  onToggle,
  onLeave,
}: {
  car: LotCar;
  index: number;
  draft: CarDraft;
  zeroKm: boolean;
  rules: MediaRules | undefined;
  busy: string;
  onChange: (patch: Partial<CarDraft>) => void;
  onReport: () => void;
  onRemoveReport: () => void;
  onToggle: () => void;
  onLeave: () => void;
}) {
  const { colors } = useTheme();
  const locked = car.status === 'VENDIDO' || car.status === 'RESERVADO';
  const status = car.status as AdStatus;
  return (
    <View style={[styles.car, { backgroundColor: colors.surface, borderColor: colors.border }]}>
      <View style={styles.carHead}>
        <AppText variant="bodyStrong" style={styles.flex}>
          Carro {index + 1}
        </AppText>
        <StatusPill status={status} />
      </View>
      <TextField label="Cor" value={draft.cor} editable={!locked} maxLength={60} onChangeText={(cor) => onChange({ cor })} />
      {!zeroKm ? (
        <View style={styles.row}>
          <View style={styles.flex}>
            <TextField
              label="Placa"
              value={draft.placa}
              editable={!locked}
              autoCapitalize="characters"
              autoCorrect={false}
              maxLength={7}
              onChangeText={(placa) => onChange({ placa: cleanMasked('plate', placa) })}
            />
          </View>
          <View style={styles.flex}>
            <TextField
              label="Km"
              value={displayMasked('thousands', draft.quilometragem)}
              editable={!locked}
              keyboardType="number-pad"
              maxLength={maskInput.thousands.maxLength}
              onChangeText={(km) => onChange({ quilometragem: cleanMasked('thousands', km) })}
            />
          </View>
        </View>
      ) : null}
      <View style={styles.inline}>
        <FileText size={16} color={colors.muted} />
        {car.laudo ? (
          <>
            <AppText variant="caption" style={styles.flex}>
              Laudo enviado · {Math.max(1, Math.round(car.laudo.tamanhoBytes / 1024 / 1024))} MB
            </AppText>
            {!locked ? (
              <Pressable onPress={onRemoveReport} disabled={Boolean(busy)} hitSlop={8} accessibilityRole="button" accessibilityLabel={`Remover laudo do carro ${index + 1}`} style={styles.link}>
                <AppText variant="label" color="red">
                  Remover
                </AppText>
              </Pressable>
            ) : null}
          </>
        ) : rules?.liberado && !locked ? (
          <Pressable onPress={onReport} disabled={Boolean(busy)} hitSlop={8} accessibilityRole="button" accessibilityLabel={`Enviar laudo do carro ${index + 1}`} style={styles.link}>
            <AppText variant="label" color="red">
              {busy === `laudo-${car.anuncioId}` ? 'Enviando…' : 'Enviar laudo'}
            </AppText>
          </Pressable>
        ) : (
          <AppText variant="caption" color="muted">
            Sem laudo
          </AppText>
        )}
      </View>
      {!locked ? (
        <View style={styles.row}>
          {car.status === 'PUBLICADO' || car.status === 'RASCUNHO' || car.status === 'PAUSADO' ? (
            <Button
              label={car.status === 'PUBLICADO' ? 'Tirar da vitrine' : 'Publicar'}
              variant="secondary"
              loading={busy === `status-${car.anuncioId}`}
              disabled={Boolean(busy)}
              onPress={onToggle}
              style={styles.flex}
            />
          ) : null}
          <Button label="Tirar do lote" variant="ghost" disabled={Boolean(busy)} onPress={onLeave} style={styles.flex} />
        </View>
      ) : null}
    </View>
  );
}

type UnitDraft = { key: string; cor: string; placa: string; quilometragem: string };
const newUnit = (): UnitDraft => ({ key: Math.random().toString(36).slice(2), cor: '', placa: '', quilometragem: '' });

/** Carros novos usam o primeiro carro do lote como modelo; também dá para trazer anúncios avulsos do mesmo modelo. */
function AddCars({ lot, usuarioId, onCancel, onDone }: { lot: Lot; usuarioId: string; onCancel: () => void; onDone: (message: string) => void }) {
  const { colors } = useTheme();
  const [units, setUnits] = useState<UnitDraft[]>([newUnit()]);
  const [existing, setExisting] = useState<string[]>([]);
  const [publish, setPublish] = useState(true);
  const [error, setError] = useState('');
  const template = lot.carros?.[0]?.anuncioId;
  const zeroKm = (lot.carros ?? []).every((car) => !car.placa);
  const quota = useQuery({ queryKey: ['ad-quota'], queryFn: ({ signal }) => myAdsApi.quota(signal) });
  const free = quota.data && quota.data.limite != null ? Math.max(0, quota.data.limite - quota.data.publicados) : null;
  const candidates = useQuery({
    queryKey: ['lot-candidates', lot.id],
    queryFn: async ({ signal }) => {
      const page = await myAdsApi.list(0, signal, { marca: lot.fabricante, modelo: lot.modelo });
      return page.anuncios.filter(
        (ad) =>
          !ad.loteId &&
          ad.tipoVeiculo === 'CARRO' &&
          !['VENDIDO', 'RESERVADO'].includes(ad.status) &&
          String(ad.anoModelo ?? '') === String(lot.anoModelo),
      );
    },
  });
  const room = MAX_LOT_CARS - (lot.carros?.length ?? 0);
  const total = (template ? units.length : 0) + existing.length;

  const send = useMutation({
    mutationFn: async () => {
      let anuncio: unknown = null;
      const filled = template ? units : [];
      if (filled.length && template) {
        const ad = await myAdsApi.forEdit(template);
        const { draft, motors } = adToDraft(ad);
        anuncio = adPayload(draft, motors, usuarioId, ad.fipe?.referenciaId ?? null);
      }
      return lotsApi.addCars(lot.id, {
        anuncio,
        unidades: filled.map((unit) => ({
          cor: unit.cor.trim(),
          placa: zeroKm ? null : unit.placa,
          quilometragem: zeroKm ? 0 : Number(unit.quilometragem),
        })),
        anunciosExistentes: existing,
        publicar: publish,
      });
    },
    onSuccess: (result) => {
      const count = result.anunciosCriados.length + result.anunciosIncluidos.length;
      onDone(`${count} ${count === 1 ? 'carro adicionado' : 'carros adicionados'} ao lote.`);
    },
    onError: (reason) => setError(reason.message),
  });

  function submit() {
    setError('');
    if (!total) return setError('Inclua ao menos um carro.');
    if (total > room) return setError(`O lote aceita no máximo ${MAX_LOT_CARS} carros.`);
    if (publish && free != null && total > free)
      return setError(`Seu plano tem ${free} ${free === 1 ? 'vaga livre' : 'vagas livres'} para publicar agora. Adicione como rascunho ou menos carros.`);
    const plates = new Set<string>((lot.carros ?? []).map((car) => car.placa ?? '').filter(Boolean));
    for (const [index, unit] of (template ? units : []).entries()) {
      const label = `Carro novo ${index + 1}`;
      if (!unit.cor.trim()) return setError(`${label}: informe a cor.`);
      if (zeroKm) continue;
      if (!/^[A-Z]{3}[0-9][A-Z0-9][0-9]{2}$/.test(unit.placa)) return setError(`${label}: informe a placa no padrão ABC1D23.`);
      if (plates.has(unit.placa)) return setError(`${label}: a placa ${unit.placa} já está no lote.`);
      plates.add(unit.placa);
      if (!unit.quilometragem) return setError(`${label}: informe a quilometragem.`);
    }
    send.mutate();
  }

  return (
    <View style={[styles.add, { borderColor: colors.border, backgroundColor: colors.subtle }]}>
      <AppText variant="heading">Adicionar carros ao lote</AppText>
      {template ? (
        <>
          {units.map((unit, index) => (
            <View key={unit.key} style={[styles.car, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <View style={styles.carHead}>
                <AppText variant="bodyStrong" style={styles.flex}>
                  Carro novo {index + 1}
                </AppText>
                <Pressable
                  onPress={() => setUnits((current) => current.filter((item) => item.key !== unit.key))}
                  hitSlop={8}
                  accessibilityRole="button"
                  accessibilityLabel={`Remover carro novo ${index + 1}`}
                  style={styles.link}>
                  <AppText variant="label" color="red">
                    Remover
                  </AppText>
                </Pressable>
              </View>
              <TextField
                label="Cor"
                value={unit.cor}
                maxLength={60}
                onChangeText={(cor) => setUnits((current) => current.map((item) => (item.key === unit.key ? { ...item, cor } : item)))}
              />
              {!zeroKm ? (
                <View style={styles.row}>
                  <View style={styles.flex}>
                    <TextField
                      label="Placa"
                      value={unit.placa}
                      autoCapitalize="characters"
                      autoCorrect={false}
                      maxLength={7}
                      onChangeText={(placa) =>
                        setUnits((current) => current.map((item) => (item.key === unit.key ? { ...item, placa: cleanMasked('plate', placa) } : item)))
                      }
                    />
                  </View>
                  <View style={styles.flex}>
                    <TextField
                      label="Km"
                      value={displayMasked('thousands', unit.quilometragem)}
                      keyboardType="number-pad"
                      maxLength={maskInput.thousands.maxLength}
                      onChangeText={(km) =>
                        setUnits((current) =>
                          current.map((item) => (item.key === unit.key ? { ...item, quilometragem: cleanMasked('thousands', km) } : item)),
                        )
                      }
                    />
                  </View>
                </View>
              ) : null}
            </View>
          ))}
          <Button
            label="Mais um carro"
            variant="secondary"
            icon={<Plus size={16} color={colors.text} />}
            disabled={total >= room}
            onPress={() => setUnits((current) => [...current, newUnit()])}
          />
        </>
      ) : (
        <AppText color="muted">O lote está vazio: inclua anúncios que você já tem do mesmo modelo.</AppText>
      )}

      <AppText variant="label">Incluir carros que você já anunciou</AppText>
      {candidates.isPending ? (
        <Skeleton height={56} rounded={radius.md} />
      ) : candidates.isError ? (
        <Notice tone="error" message="Não carregamos seus anúncios." actionLabel="Tentar de novo" onAction={() => candidates.refetch()} />
      ) : !candidates.data?.length ? (
        <AppText variant="caption" color="muted">
          Nenhum anúncio avulso do mesmo modelo e ano.
        </AppText>
      ) : (
        candidates.data.map((ad) => {
          const checked = existing.includes(ad.id);
          return (
            <Pressable
              key={ad.id}
              onPress={() => setExisting((current) => (checked ? current.filter((id) => id !== ad.id) : [...current, ad.id]))}
              accessibilityRole="checkbox"
              accessibilityState={{ checked }}
              accessibilityLabel={`Incluir ${ad.titulo}`}
              style={[styles.option, { borderColor: colors.border, backgroundColor: colors.surface }]}>
              <View style={[styles.checkbox, checked ? { backgroundColor: colors.red, borderColor: colors.red } : { borderColor: colors.border }]}>
                {checked ? <Check size={14} color={colors.onRed} strokeWidth={3} /> : null}
              </View>
              <AppText style={styles.flex} numberOfLines={2}>
                {ad.titulo}
              </AppText>
            </Pressable>
          );
        })
      )}

      <AppText variant="label">Os carros adicionados devem</AppText>
      <ChoiceRow
        value={String(publish)}
        options={[
          { value: 'true', label: 'Ir para a vitrine' },
          { value: 'false', label: 'Ficar como rascunho' },
        ]}
        onChange={(value) => setPublish(value === 'true')}
      />
      {publish && free != null ? (
        <AppText variant="caption" color="muted">
          Seu plano tem {free} {free === 1 ? 'vaga livre' : 'vagas livres'} para publicar agora.
        </AppText>
      ) : null}
      {error ? <Notice tone="error" message={error} /> : null}
      <View style={styles.row}>
        <Button label="Cancelar" variant="secondary" disabled={send.isPending} onPress={onCancel} style={styles.flex} />
        <Button
          label={total ? `Adicionar ${total} ${total === 1 ? 'carro' : 'carros'}` : 'Adicionar'}
          loading={send.isPending}
          disabled={!total}
          onPress={submit}
          style={styles.flex}
        />
      </View>
    </View>
  );
}

function Section({ title, note, children }: { title: string; note?: string; children: ReactNode }) {
  const { colors } = useTheme();
  return (
    <View style={[styles.section, { borderTopColor: colors.border }]}>
      <View style={styles.sectionHead}>
        <AppText variant="heading" accessibilityRole="header">
          {title}
        </AppText>
        {note ? (
          <AppText variant="caption" color="muted">
            {note}
          </AppText>
        ) : null}
      </View>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  left: { alignSelf: 'flex-start', paddingHorizontal: 0 },
  content: { padding: space.lg, gap: space.lg, paddingBottom: space.xxxl },
  intro: { gap: space.xs },
  inline: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  row: { flexDirection: 'row', gap: space.sm },
  section: { gap: space.md, paddingTop: space.lg, borderTopWidth: StyleSheet.hairlineWidth },
  sectionHead: { gap: 2 },
  model: { padding: space.md, borderRadius: radius.md, gap: 2 },
  car: { padding: space.md, borderRadius: radius.md, borderWidth: StyleSheet.hairlineWidth, gap: space.md },
  carHead: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  link: { minHeight: 36, justifyContent: 'center' },
  media: { padding: space.md, borderRadius: radius.md, borderWidth: StyleSheet.hairlineWidth, gap: space.md },
  add: { padding: space.md, borderRadius: radius.lg, borderWidth: 1, gap: space.md },
  option: {
    minHeight: 52,
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    paddingHorizontal: space.md,
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth,
  },
  checkbox: { width: 22, height: 22, borderRadius: 6, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
  footer: { paddingHorizontal: space.lg, paddingTop: space.md, borderTopWidth: StyleSheet.hairlineWidth, gap: space.sm },
});
