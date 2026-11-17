import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import * as Haptics from 'expo-haptics';
import { router, useLocalSearchParams, usePreventRemove, type Href } from 'expo-router';
import { Layers, Trash2, WifiOff } from 'lucide-react-native';
import { useMemo, useState, type ReactNode } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { announceApi, type FipeReference } from '@/api/announce';
import { myAdsApi, type AdForEdit } from '@/api/my-ads';
import { findAddressByCep } from '@/api/viacep';
import { AppText } from '@/components/app-text';
import { Button } from '@/components/button';
import { showDialog } from '@/components/dialog';
import { Notice } from '@/components/notice';
import { Skeleton } from '@/components/skeleton';
import { StateView } from '@/components/state-view';
import { TextField } from '@/components/text-field';
import { useFipeConditionSync } from '@/hooks/use-fipe-condition-sync';
import { useSession } from '@/hooks/use-session';
import { useTheme } from '@/hooks/use-theme';
import { radius, space } from '@/theme';
import { formatCents } from '@/utils/format';
import { ChoiceRow } from '@/components/choice-row';
import { AdField, suggestionsFor } from '@/screens/announce/ad-fields';
import { addressFields, fieldsByType, fipeTypes, motorFields, vehicleTypes, type Field } from '@/screens/announce/fields';
import { FipeSelector } from '@/screens/announce/fipe-selector';
import type { Draft } from '@/screens/announce/payload';
import { adPatch, adToDraft, type Motors } from './edit-draft';
import { EditMedia } from './edit-media';
import { EditPhotos } from './edit-photos';
import { StatusPill } from './my-ad-card';

/** Rota /meus-anuncios/[id]: carrega o anúncio para edição. */
export function EditAdScreen() {
  const { colors } = useTheme();
  const { id } = useLocalSearchParams<{ id: string }>();
  const ad = useQuery({
    queryKey: ['ad-edit', id],
    queryFn: ({ signal }) => myAdsApi.forEdit(id, signal),
    enabled: Boolean(id),
    // O formulário é montado uma vez com estes dados; não recarregar por baixo de quem está editando.
    staleTime: Infinity,
    refetchOnMount: 'always',
  });

  if (ad.isError)
    return (
      <View style={[styles.flex, { backgroundColor: colors.bg }]}>
        <StateView
          icon={WifiOff}
          title="Não deu para abrir este anúncio"
          message={`${ad.error.message} Ele pode ter sido excluído ou pertencer a outra conta.`}
          actionLabel="Tentar de novo"
          onAction={() => ad.refetch()}
        />
      </View>
    );
  if (!ad.data || ad.isFetching) return <EditSkeleton />;
  if (ad.data.loteId)
    return (
      <View style={[styles.flex, { backgroundColor: colors.bg }]}>
        <StateView
          icon={Layers}
          title="Carro de lote"
          message="Os dados comuns e a lista de carros são editados no lote."
          actionLabel="Editar lote"
          onAction={() => router.replace(`/meus-anuncios/lote/${ad.data!.loteId}` as Href)}
        />
      </View>
    );
  return <EditForm key={ad.data.id} ad={ad.data} />;
}

type FipeLink = FipeReference | null;

function EditForm({ ad }: { ad: AdForEdit }) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const cache = useQueryClient();
  const session = useSession();
  const usuarioId = session.status === 'authenticated' ? session.user.usuarioId : ad.anuncianteId;
  const loaded = useMemo(() => adToDraft(ad), [ad]);
  const [values, setValues] = useState<Draft>(loaded.draft);
  const [motors, setMotors] = useState<Motors>(loaded.motors);
  // O resumo do anúncio não diz se a cotação é zero km; a condição do anúncio vale até a referência completa chegar.
  const initialFipe: FipeLink = ad.fipe
    ? {
        id: ad.fipe.referenciaId,
        codigoFipe: ad.fipe.codigo,
        marca: ad.fabricante,
        modelo: ad.fipe.modelo,
        anoModelo: ad.anoModelo ?? 0,
        zeroKm: ad.condicao === 'ZERO_KM',
        combustivel: '',
        valorCentavos: ad.fipe.valorCentavos,
        mesReferencia: ad.fipe.mesReferencia,
      }
    : null;
  const [savedFipe, setFipe] = useState<FipeLink>(initialFipe);
  const fullFipe = useQuery({
    queryKey: ['fipe-reference', ad.fipe?.referenciaId],
    queryFn: ({ signal }) => announceApi.fipeReferenceById(ad.fipe!.referenciaId, signal),
    enabled: Boolean(ad.fipe),
    staleTime: Infinity,
    retry: 1,
  });
  const fipe = savedFipe && fullFipe.data?.id === savedFipe.id ? fullFipe.data : savedFipe;
  const [choosing, setChoosing] = useState<{ values: Draft; fipe: FipeLink } | null>(null);
  const [fipeNotice, setFipeNotice] = useState('');
  const [error, setError] = useState('');
  const [cepBusy, setCepBusy] = useState(false);
  const [leaving, setLeaving] = useState(false);

  const tipo = values.tipoVeiculo;
  const fipeType = fipeTypes[tipo];
  const zeroKm = values.condicao === 'ZERO_KM';
  const electric =
    (tipo === 'CARRO' || tipo === 'CAMINHONETE') &&
    (values[`${tipo}.combustivel`] || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase() === 'eletrico';
  const technical = fieldsByType[tipo]
    .filter(
      (item) =>
        !zeroKm ||
        !['quilometragem', 'placa', 'exibirPlacaCompleta', 'ipvaPago', 'licenciado', 'unicoDono'].includes(item.key),
    )
    .filter((item) => !electric || !['motorizacao', 'turbo'].includes(item.key));
  const required = technical.filter((item) => item.required);
  const optional = technical.filter((item) => !item.required);

  // Trocar zero km/seminovo troca a cotação FIPE pela da mesma versão, como no site.
  const syncingFipe = useFipeConditionSync({
    condicao: values.condicao || '',
    anoModelo: values.anoModelo || '',
    veiculo: `${values.fabricante || ''}|${values.modelo || ''}`,
    reference: fipe,
    onReference: setFipe,
    onNotice: setFipeNotice,
  });

  const catalog = useQuery({ queryKey: ['ad-catalog'], queryFn: ({ signal }) => announceApi.catalog(signal) });
  const suggest = (key: string) => suggestionsFor(catalog.data, tipo, values.fabricante, key);

  const fipeChange = fipe?.id === initialFipe?.id ? {} : fipe ? { fipeReferenciaId: fipe.id } : { removerFipe: true };
  const patch = adPatch(loaded, { draft: values, motors }, usuarioId, fipeChange);
  const dirty = Object.keys(patch).length > 0;

  const save = useMutation({
    mutationFn: () => myAdsApi.update(ad.id, patch),
    onSuccess: () => {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      cache.invalidateQueries({ queryKey: ['my-ads'] });
      cache.invalidateQueries({ queryKey: ['ad-quota'] });
      cache.invalidateQueries({ queryKey: ['ad', ad.id] });
      cache.removeQueries({ queryKey: ['ad-edit', ad.id] });
      leave();
    },
    onError: (reason) => setError(reason.message),
  });

  // Sair com alterações pendentes pede confirmação (fotos, vídeo e laudo já foram salvos na hora).
  const disablePrevention = usePreventRemove(dirty && !leaving, ({ repeat }) =>
    showDialog({
      title: 'Descartar alterações?',
      message: 'As mudanças nos dados do anúncio ainda não foram salvas.',
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
  /** Sai da tela sem perguntar (depois de salvar ou excluir). */
  function leave() {
    setLeaving(true);
    disablePrevention();
    router.back();
  }

  function change(key: string, value: string) {
    setError('');
    setValues((prev) => {
      if (prev[key] === value) return prev;
      const next: Draft = { ...prev, [key]: value };
      if (key === 'fabricante') Object.assign(next, { modelo: '', versao: '', anoModelo: fipeType ? '' : prev.anoModelo });
      if (key === 'anoModelo' && fipeType && choosing) Object.assign(next, { modelo: '', versao: '' });
      if (key === 'contatoNaoDivulgar' && value === 'true') Object.assign(next, { contatoWhatsapp: 'false', contatoLigacao: 'false' });
      if ((key === 'contatoWhatsapp' || key === 'contatoLigacao') && value === 'true') next.contatoNaoDivulgar = 'false';
      return next;
    });
    // Mudar a identidade do veículo desvincula a cotação FIPE (como no site). A condição é tratada por
    // useFipeConditionSync, e o ano só conta na cotação de usado (a de zero km não tem ano).
    const conflict =
      ['fabricante', 'modelo', `${tipo}.combustivel`].includes(key) ||
      (key === 'anoModelo' && fipe && !fipe.zeroKm && value !== String(fipe.anoModelo));
    if (fipe && conflict && !choosing) {
      setFipe(null);
      setFipeNotice('A referência FIPE será removida ao salvar. Escolha o modelo na FIPE para vincular outra.');
    }
  }

  function applyReference(reference: FipeReference) {
    setFipe(reference);
    setFipeNotice('');
    setValues((prev) => ({
      ...prev,
      fabricante: reference.marca,
      modelo: reference.modelo,
      versao: reference.modelo,
      anoModelo: reference.zeroKm ? prev.anoModelo : String(reference.anoModelo),
      [`${prev.tipoVeiculo}.combustivel`]: reference.combustivel,
    }));
    setChoosing(null);
  }

  async function lookupCep() {
    setCepBusy(true);
    setError('');
    try {
      const result = await findAddressByCep(values['endereco.cep'] || '');
      setValues((prev) => ({
        ...prev,
        'endereco.uf': result.uf,
        'endereco.cidade': result.localidade,
        'endereco.bairro': result.bairro,
        'endereco.rua': result.logradouro,
        'endereco.complemento': result.complemento || prev['endereco.complemento'] || '',
      }));
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Não foi possível consultar o CEP.');
    } finally {
      setCepBusy(false);
    }
  }

  function validate(): string {
    if (choosing) return 'Termine a escolha na FIPE ou toque em "Manter veículo atual".';
    if (syncingFipe) return 'Aguarde a atualização da referência FIPE.';
    const check = (item: Field, prefix = '') => {
      const raw = values[`${prefix}${item.key}`] || '';
      if (item.required && !raw.trim()) return `Preencha ${item.label.toLowerCase()}.`;
      if (raw && item.kind === 'number' && !/^\d+(?:[,.]\d+)?$/.test(raw)) return `${item.label}: informe um número válido.`;
      if (item.maxLength && raw.length > item.maxLength) return `${item.label}: use até ${item.maxLength} caracteres.`;
      return '';
    };
    const base: Field[] = [
      { key: 'fabricante', label: 'Marca', required: true },
      { key: 'modelo', label: 'Modelo', required: true },
      { key: 'anoFabricacao', label: 'Ano de fabricação', required: true, kind: 'number' },
      { key: 'anoModelo', label: 'Ano do modelo', required: true, kind: 'number' },
      { key: 'cor', label: 'Cor', required: true, maxLength: 60 },
      { key: 'titulo', label: 'Título', required: true, maxLength: 180 },
    ];
    for (const item of base) {
      const problem = check(item);
      if (problem) return problem;
    }
    const fabrication = Number(values.anoFabricacao);
    const model = Number(values.anoModelo);
    if (fabrication < 1900 || model < fabrication || model > fabrication + 1 || model > new Date().getFullYear() + 1)
      return 'Confira os anos de fabricação e modelo.';
    if (!values.historicoLeilao || !values.historicoSinistro) return 'Informe o histórico de leilão e sinistro.';
    for (const item of technical) {
      const problem = check(item, `${tipo}.`);
      if (problem) return problem;
    }
    const plate = values[`${tipo}.placa`];
    if (!zeroKm && plate && !/^[A-Z]{3}[0-9][A-Z0-9][0-9]{2}$/.test(plate)) return 'Informe a placa no padrão ABC1D23.';
    if (['CARRO', 'CAMINHONETE'].includes(tipo) && !electric && values[`${tipo}.motorizacao`] && !/^[0-9]{1,2}[.,][0-9]{1,2}$/.test(values[`${tipo}.motorizacao`]))
      return 'Motorização: use litros, como 1.0 ou 2.0.';
    for (const item of addressFields) {
      const problem = check(item, 'endereco.');
      if (problem) return problem;
    }
    if ((values['endereco.cep'] || '').replace(/\D/g, '').length !== 8) return 'Informe os 8 números do CEP.';
    if (!/^[A-Za-z]{2}$/.test(values['endereco.uf'] || '')) return 'Informe a sigla do estado com duas letras.';
    if (values.tipoPreco === 'FIXO' && !(Number(values.precoReais) > 0)) return 'Informe um preço maior que zero.';
    if (values.contatoNaoDivulgar !== 'true' && values.contatoWhatsapp !== 'true' && values.contatoLigacao !== 'true')
      return 'Escolha pelo menos um meio de contato.';
    if ((values.descricao || '').length > 10000) return 'A descrição deve ter até 10.000 caracteres.';
    return '';
  }

  function submit() {
    if (!dirty) {
      leave();
      return;
    }
    const problem = validate();
    if (problem) {
      setError(problem);
      return;
    }
    setError('');
    save.mutate();
  }

  function confirmDelete() {
    showDialog({
      title: 'Excluir anúncio?',
      message: `${ad.titulo} e as fotos serão removidos de vez. Para só tirar da vitrine, mude a situação para rascunho. Anúncios com venda registrada não podem ser excluídos.`,
      actions: [
        { label: 'Manter', kind: 'cancel' },
        {
          label: 'Excluir',
          kind: 'destructive',
          onPress: async () => {
            try {
              await myAdsApi.remove(ad.id);
              cache.invalidateQueries({ queryKey: ['my-ads'] });
              cache.invalidateQueries({ queryKey: ['ad-quota'] });
              leave();
            } catch (reason) {
              showDialog({
                title: 'Não foi possível excluir',
                message: reason instanceof Error ? reason.message : 'Tente de novo.',
              });
            }
          },
        },
      ],
    });
  }

  const field = (item: Field, prefix = '') => (
    <AdField
      key={`${prefix}${item.key}`}
      item={item}
      prefix={prefix}
      values={values}
      suggestions={suggest(item.key)}
      onChange={change}
    />
  );
  const willPublish = values.publicarAgora === 'true';
  const typeLabel = vehicleTypes.find((item) => item.value === tipo)?.label ?? 'Veículo';

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
      style={[styles.flex, { backgroundColor: colors.bg }]}>
      <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.content}>
        <View style={styles.intro}>
          <AppText variant="overline" color="red">
            Editar · {typeLabel}
          </AppText>
          <AppText variant="title">{ad.titulo}</AppText>
          <View style={styles.introRow}>
            <StatusPill status={ad.status} />
            {ad.status === 'PUBLICADO' ? (
              <Button
                label="Ver na vitrine"
                variant="ghost"
                onPress={() => router.push({ pathname: '/anuncio/[id]', params: { id: ad.id } })}
              />
            ) : null}
          </View>
        </View>

        <Section title="Situação">
          <ChoiceRow
            value={values.publicarAgora}
            options={[
              { value: 'true', label: 'Publicado' },
              { value: 'false', label: 'Rascunho' },
            ]}
            onChange={(value) => change('publicarAgora', value)}
          />
          <AppText variant="caption" color="muted">
            {willPublish === (ad.status === 'PUBLICADO')
              ? 'Sem mudança ao salvar.'
              : willPublish
                ? 'Será publicado ao salvar.'
                : 'Sairá da vitrine ao salvar.'}
          </AppText>
        </Section>

        <Section title="Veículo" note="O tipo do veículo não muda depois de criado. Para trocar, crie um novo anúncio.">
          {fipeType ? (
            choosing ? (
              <>
                <FipeSelector
                  tipo={fipeType}
                  zeroKm={zeroKm}
                  reference={null}
                  onBrand={(name) => change('fabricante', name)}
                  onYear={(year) => change('anoModelo', year)}
                  onClear={() => undefined}
                  onResolved={applyReference}
                />
                <Button
                  label="Manter veículo atual"
                  variant="secondary"
                  onPress={() => {
                    setValues(choosing.values);
                    setFipe(choosing.fipe);
                    setChoosing(null);
                  }}
                />
              </>
            ) : (
              <>
                <View style={[styles.vehicle, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                  <AppText variant="overline" color="muted">
                    {values.fabricante}
                  </AppText>
                  <AppText variant="bodyStrong">{values.modelo || 'Modelo não informado'}</AppText>
                  <AppText variant="caption" color="muted">
                    Ano do modelo {values.anoModelo || '—'}
                  </AppText>
                  {fipe ? (
                    <View style={[styles.fipe, { backgroundColor: colors.dealTint, borderColor: colors.dealBorder }]}>
                      <AppText variant="label" color="deal">
                        FIPE {fipe.mesReferencia}: {formatCents(fipe.valorCentavos)}
                      </AppText>
                    </View>
                  ) : null}
                </View>
                <Button
                  label="Trocar modelo pela FIPE"
                  variant="secondary"
                  onPress={() => {
                    setChoosing({ values, fipe });
                    setFipeNotice('');
                  }}
                />
                {fipe ? (
                  <Button
                    label="Remover referência FIPE"
                    variant="ghost"
                    onPress={() => {
                      setFipe(null);
                      setFipeNotice('A referência FIPE será removida ao salvar.');
                    }}
                  />
                ) : null}
              </>
            )
          ) : (
            <>
              {field({ key: 'fabricante', label: 'Marca / fabricante', required: true, maxLength: 100 })}
              {field({ key: 'modelo', label: 'Modelo', required: true, maxLength: 250 })}
            </>
          )}
          {syncingFipe ? (
            <Notice message="Buscando a cotação FIPE para a condição escolhida…" />
          ) : fipeNotice ? (
            <Notice message={fipeNotice} />
          ) : null}
          <AppText variant="label">Condição *</AppText>
          <ChoiceRow
            value={values.condicao}
            options={[
              { value: 'ZERO_KM', label: 'Zero km' },
              { value: 'USADO', label: 'Seminovo' },
              { value: 'REPASSE', label: 'Repasse' },
            ]}
            onChange={(value) => change('condicao', value)}
          />
          {zeroKm && fieldsByType[tipo].some((item) => item.key === 'quilometragem') ? (
            <AppText variant="caption" color="muted">
              Zero km: a quilometragem vai como 0 e placa, IPVA, licenciamento e único dono não se aplicam.
            </AppText>
          ) : null}
          {field({ key: 'anoFabricacao', label: 'Ano de fabricação', required: true, kind: 'number' })}
          {!fipeType || zeroKm ? field({ key: 'anoModelo', label: 'Ano do modelo', required: true, kind: 'number' }) : null}
          {field({ key: 'cor', label: 'Cor', required: true, maxLength: 60 })}
          {required.map((item) => field(item, `${tipo}.`))}
          {field({ key: 'historicoLeilao', label: 'Passou por leilão?', kind: 'boolean', required: true })}
          {field({ key: 'historicoSinistro', label: 'Teve sinistro?', kind: 'boolean', required: true })}
        </Section>

        <Section title="Anúncio">
          {field({ key: 'titulo', label: 'Título do anúncio', required: true, maxLength: 180 })}
          <AppText variant="label">Preço *</AppText>
          <ChoiceRow
            value={values.tipoPreco}
            options={[
              { value: 'FIXO', label: 'Preço definido' },
              { value: 'SOB_CONSULTA', label: 'Sob consulta' },
            ]}
            onChange={(value) => change('tipoPreco', value)}
          />
          {values.tipoPreco === 'FIXO' ? field({ key: 'precoReais', label: 'Preço (R$)', required: true, mask: 'money' }) : null}
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
              <AppText variant="caption" color="muted">
                Com o WhatsApp ativo, seu número pode ser visto por quem tiver interesse no anúncio.
              </AppText>
            </>
          ) : null}
        </Section>

        <Section title="Fotos">
          <EditPhotos anuncioId={ad.id} />
        </Section>

        <Section title="Localização" note="Na vitrine aparece só a cidade; rua e número ficam privados.">
          {field(addressFields[0], 'endereco.')}
          <Button label="Buscar endereço pelo CEP" variant="secondary" loading={cepBusy} onPress={lookupCep} />
          {addressFields.slice(1).map((item) => field(item, 'endereco.'))}
        </Section>

        <Section title="Dados opcionais" note="Deixam o anúncio mais completo e evitam perguntas repetidas.">
          {field({ key: 'versao', label: 'Versão', maxLength: 250 })}
          {field({ key: 'identificadorPublico', label: 'Referência pública', maxLength: 80 })}
          {field({ key: 'tipoFreio', label: 'Tipo de freio', maxLength: 60 })}
          {optional.map((item) => field(item, `${tipo}.`))}
          {tipo === 'BARCO' ? (
            <View style={styles.group}>
              <AppText variant="heading">Motores</AppText>
              {motors.map((motor, index) => (
                <View key={index} style={[styles.motor, { borderColor: colors.border }]}>
                  <AppText variant="label">Motor {index + 1}</AppText>
                  {motorFields.map((item) => (
                    <TextField
                      key={item.key}
                      label={item.label}
                      value={motor[item.key] || ''}
                      keyboardType={item.kind === 'number' ? 'decimal-pad' : 'default'}
                      onChangeText={(value) =>
                        setMotors((current) => current.map((row, n) => (n === index ? { ...row, [item.key]: value } : row)))
                      }
                    />
                  ))}
                  <Button
                    label={`Remover motor ${index + 1}`}
                    variant="ghost"
                    onPress={() => setMotors((current) => current.filter((_, n) => n !== index))}
                  />
                </View>
              ))}
              <Button label="Adicionar motor" variant="secondary" onPress={() => setMotors((current) => [...current, {}])} />
            </View>
          ) : null}
        </Section>

        <Section title="Vídeo e laudo cautelar" note="Também são enviados e removidos na hora, sem precisar salvar.">
          <EditMedia anuncioId={ad.id} />
        </Section>

        <Section title="Excluir anúncio" note="Remove anúncio e fotos de vez.">
          <Button
            label="Excluir anúncio"
            variant="secondary"
            icon={<Trash2 size={16} color={colors.red} />}
            onPress={confirmDelete}
          />
        </Section>
      </ScrollView>

      <View
        style={[
          styles.footer,
          { borderTopColor: colors.border, backgroundColor: colors.bg, paddingBottom: insets.bottom + space.md },
        ]}>
        {error ? <Notice tone="error" message={error} /> : null}
        <Button
          label={dirty ? 'Salvar alterações' : 'Tudo salvo'}
          variant={dirty ? 'primary' : 'secondary'}
          loading={save.isPending}
          onPress={submit}
          accessibilityHint={dirty ? undefined : 'Fotos, vídeo e laudo já foram salvos. Volta para Meus anúncios.'}
        />
      </View>
    </KeyboardAvoidingView>
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

function EditSkeleton() {
  const { colors } = useTheme();
  return (
    <View style={[styles.flex, styles.content, { backgroundColor: colors.bg }]}>
      <Skeleton width="40%" height={12} />
      <Skeleton width="80%" height={24} />
      <Skeleton height={52} rounded={radius.md} />
      <Skeleton height={52} rounded={radius.md} />
      <Skeleton height={52} rounded={radius.md} />
      <Skeleton height={160} rounded={radius.md} />
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  content: { padding: space.lg, gap: space.lg, paddingBottom: space.xxxl },
  intro: { gap: space.xs },
  introRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: space.md },
  section: { gap: space.md, paddingTop: space.lg, borderTopWidth: StyleSheet.hairlineWidth },
  sectionHead: { gap: 2 },
  group: { gap: space.md },
  vehicle: { padding: space.md, borderRadius: radius.md, borderWidth: StyleSheet.hairlineWidth, gap: 2 },
  fipe: {
    alignSelf: 'flex-start',
    marginTop: space.sm,
    paddingHorizontal: space.sm,
    paddingVertical: 3,
    borderRadius: radius.pill,
    borderWidth: 1,
  },
  motor: { borderWidth: 1, borderRadius: radius.md, padding: space.md, gap: space.md },
  footer: { paddingHorizontal: space.lg, paddingTop: space.md, borderTopWidth: StyleSheet.hairlineWidth, gap: space.sm },
});
