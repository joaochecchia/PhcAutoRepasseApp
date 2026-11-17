import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import * as Haptics from 'expo-haptics';
import { router } from 'expo-router';
import { BellRing, CalendarDays, CarFront, Check, ChevronDown, ChevronUp, Mail, MapPin, RotateCw, Search, Trash2 } from 'lucide-react-native';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  View,
  type ScrollViewInstance,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { announceApi, type FipeOption } from '@/api/announce';
import type { SearchAd, WaitlistFipeType, WaitlistOrder, WaitlistReach, WaitlistRequest } from '@/api/contracts';
import { waitlistApi } from '@/api/waitlist';
import { AppText } from '@/components/app-text';
import { Button } from '@/components/button';
import { ChoiceRow } from '@/components/choice-row';
import { showDialog } from '@/components/dialog';
import { Notice } from '@/components/notice';
import { Skeleton } from '@/components/skeleton';
import { StateView } from '@/components/state-view';
import { TextField } from '@/components/text-field';
import { VehicleCard } from '@/components/vehicle-card';
import { useAccount } from '@/hooks/use-account';
import { useTheme } from '@/hooks/use-theme';
import { radius, space, touch } from '@/theme';

const TYPES: { value: WaitlistFipeType; label: string }[] = [
  { value: 'cars', label: 'Carros e caminhonetes' },
  { value: 'motorcycles', label: 'Motos' },
  { value: 'trucks', label: 'Caminhões' },
];
const REACHES: { value: WaitlistReach; label: string }[] = [
  { value: '100', label: 'Até 100 km' },
  { value: '200', label: 'Até 200 km' },
  { value: 'BRASIL', label: 'Todo o Brasil' },
];
/** Atalhos por tipo; só aparecem os que existem na edição da FIPE carregada (mesma lista do site). */
const POPULAR: Record<WaitlistFipeType, string[]> = {
  cars: ['GM - Chevrolet', 'VW - VolksWagen', 'Fiat', 'Toyota', 'Hyundai', 'Honda', 'Jeep', 'Renault'],
  motorcycles: ['Honda', 'Yamaha', 'Suzuki', 'BMW', 'Kawasaki', 'Harley-Davidson', 'Royal Enfield', 'Triumph'],
  trucks: ['Mercedes-Benz', 'Volvo', 'Scania', 'VW - VolksWagen', 'Iveco', 'DAF', 'Ford'],
};
const THIS_YEAR = new Date().getFullYear();
/** A FIPE usa 32000 para zero km; o anúncio zero km grava o ano real do modelo (este ano ou o próximo). */
const ZERO_KM = 32000;
// O backend carrega no catálogo, em segundo plano, um nível da FIPE ainda ausente: tenta de novo por ~1 minuto.
const PENDING_RETRY_MS = 6000;
const PENDING_TRIES = 10;
const VISIBLE_VERSIONS = 8;

const normalize = (text: string) => text.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();
const daysLeft = (iso: string) => Math.max(0, Math.ceil((new Date(iso).getTime() - Date.now()) / 864e5));
const shortDate = (iso: string) => new Date(iso).toLocaleDateString('pt-BR');
const describeReach = (raioKm: number | null, cidade: string | null, uf: string | null) =>
  raioKm === null ? 'Todo o Brasil' : `${cidade}/${uf} e até ${raioKm} km`;
const yearsLabel = (min: number | string, max: number | string) => (String(min) === String(max) ? String(min) : `${min} a ${max}`);

function yearsFromFipe(options: FipeOption[]) {
  const years = new Set<number>();
  for (const option of options) {
    const year = Number.parseInt(option.codigo, 10);
    if (year === ZERO_KM) {
      years.add(THIS_YEAR);
      years.add(THIS_YEAR + 1);
    } else if (Number.isFinite(year)) years.add(year);
  }
  return years;
}

/** Tenta de novo enquanto o catálogo da FIPE estiver sendo carregado no servidor. */
const retryWhilePending = (pending: boolean | undefined, updates: number) => (pending && updates < PENDING_TRIES ? PENDING_RETRY_MS : false);

function useDebounced<T>(value: T, delay: number) {
  const [current, setCurrent] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setCurrent(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);
  return current;
}

/**
 * Fila de espera (WaitlistPage do site): a pessoa diz qual veículo procura (marca, versões e anos da FIPE, cidade e
 * alcance), vê o que já está à venda e entra na fila para ser avisada dos próximos. Pedido vale 90 dias, renovável.
 */
export function WaitlistScreen() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const queryClient = useQueryClient();
  const account = useAccount();
  const usuarioId = account.usuarioId;
  const scroll = useRef<ScrollViewInstance>(null);
  const resultY = useRef(0);

  const [tipo, setTipo] = useState<WaitlistFipeType>('cars');
  const [marca, setMarca] = useState<FipeOption | null>(null);
  const [marcaTermo, setMarcaTermo] = useState('');
  const [versaoTermo, setVersaoTermo] = useState('');
  // A lista de versões começa curta para o ano e o lugar não ficarem longe; a pessoa abre o resto se quiser.
  const [allVersions, setAllVersions] = useState(false);
  const termo = useDebounced(versaoTermo.trim(), 250);
  const [escolhidas, setEscolhidas] = useState<Map<string, string>>(new Map());
  const [anoMinimo, setAnoMinimo] = useState('');
  const [anoMaximo, setAnoMaximo] = useState('');
  const [cidade, setCidade] = useState('');
  const [uf, setUf] = useState('');
  const [alcance, setAlcance] = useState<WaitlistReach>('100');
  const [email, setEmail] = useState(false);
  const [formError, setFormError] = useState('');
  const todoBrasil = alcance === 'BRASIL';

  // Cidade do cadastro como ponto de partida.
  const placeFilled = useRef(false);
  useEffect(() => {
    const endereco = account.data?.endereco;
    if (!endereco || placeFilled.current) return;
    placeFilled.current = true;
    setCidade((current) => current || endereco.cidade);
    setUf((current) => current || endereco.uf);
  }, [account.data]);

  const edition = useQuery({
    queryKey: ['fipe-edition', tipo],
    queryFn: ({ signal }) => announceApi.fipeEdition(tipo, signal),
    enabled: Boolean(usuarioId),
  });
  const referencia = edition.data ? Number(edition.data.codigo) : null;

  // Todas as marcas da edição (2 a 3 páginas), uma vez por tipo; o filtro do campo é feito aqui.
  const marcas = useQuery({
    queryKey: ['waitlist-brands', tipo, referencia],
    queryFn: async ({ signal }) => {
      const opcoes: FipeOption[] = [];
      let pendente = false;
      for (let pagina = 0; pagina < 6; pagina++) {
        const page = await announceApi.fipePage({ tipo, referencia: referencia!, pagina }, signal);
        opcoes.push(...page.opcoes);
        pendente ||= page.catalogoPendente;
        if (!page.temProximaPagina) break;
      }
      return { opcoes, pendente };
    },
    enabled: referencia !== null,
    refetchInterval: (query) => retryWhilePending(query.state.data?.pendente, query.state.dataUpdateCount),
  });

  const versoes = useInfiniteQuery({
    queryKey: ['waitlist-versions', tipo, referencia, marca?.codigo, termo],
    queryFn: ({ pageParam, signal }) =>
      announceApi.fipePage({ tipo, referencia: referencia!, marcaId: marca!.codigo, termo: termo || undefined, pagina: pageParam }, signal),
    initialPageParam: 0,
    getNextPageParam: (last, pages) => (last.temProximaPagina ? pages.length : undefined),
    enabled: referencia !== null && Boolean(marca),
    refetchInterval: (query) => retryWhilePending(query.state.data?.pages.at(-1)?.catalogoPendente, query.state.dataUpdateCount),
  });
  const versionList = useMemo(() => versoes.data?.pages.flatMap((page) => page.opcoes) ?? [], [versoes.data]);
  const versionsPending = versoes.data?.pages.at(-1)?.catalogoPendente ?? false;

  // Anos-modelo que a FIPE tem para as versões escolhidas; cada versão é buscada uma vez.
  const yearsByVersion = useRef(new Map<string, Set<number>>());
  const chosenIds = useMemo(() => [...escolhidas.keys()].sort(), [escolhidas]);
  const anos = useQuery({
    queryKey: ['waitlist-years', tipo, referencia, marca?.codigo, chosenIds],
    queryFn: async ({ signal }) => {
      const cache = yearsByVersion.current;
      const key = (modeloId: string) => `${tipo}:${referencia}:${marca!.codigo}:${modeloId}`;
      let pendente = false;
      const missing = chosenIds.filter((id) => !cache.has(key(id)));
      for (let i = 0; i < missing.length; i += 4) {
        await Promise.all(
          missing.slice(i, i + 4).map(async (modeloId) => {
            const opcoes: FipeOption[] = [];
            let page;
            for (let pagina = 0; pagina < 3; pagina++) {
              page = await announceApi.fipePage({ tipo, referencia: referencia!, marcaId: marca!.codigo, modeloId, pagina }, signal);
              opcoes.push(...page.opcoes);
              if (!page.temProximaPagina) break;
            }
            if (page?.catalogoPendente) pendente = true;
            else cache.set(key(modeloId), yearsFromFipe(opcoes));
          }),
        );
      }
      const all = new Set<number>();
      for (const id of chosenIds) cache.get(key(id))?.forEach((year) => all.add(year));
      return { lista: [...all].sort((a, b) => b - a), pendente };
    },
    enabled: referencia !== null && Boolean(marca) && chosenIds.length > 0,
    refetchInterval: (query) => retryWhilePending(query.state.data?.pendente, query.state.dataUpdateCount),
  });
  const yearList = useMemo(() => (chosenIds.length ? (anos.data?.lista ?? []) : []), [anos.data, chosenIds.length]);

  // A faixa fica dentro dos anos da FIPE: sem escolha, a faixa inteira; ano que sumiu vira o mais próximo.
  const nearest = (value: string, fallback: number | undefined) => {
    if (!yearList.length || fallback === undefined) return '';
    if (!value) return String(fallback);
    const year = Number(value);
    return String(yearList.includes(year) ? year : yearList.reduce((a, b) => (Math.abs(b - year) < Math.abs(a - year) ? b : a)));
  };
  const minYear = nearest(anoMinimo, yearList.at(-1));
  const maxYear = nearest(anoMaximo, yearList[0]);

  // Prévia e erro valem para os critérios em que foram feitos; mudou algo, somem.
  const criteria = JSON.stringify([tipo, marca?.codigo, chosenIds, minYear, maxYear, cidade.trim(), uf, alcance]);
  const preview = useMutation({ mutationFn: (body: WaitlistRequest) => waitlistApi.preview(body) });
  const [previewFor, setPreviewFor] = useState('');
  const [errorFor, setErrorFor] = useState('');
  const showPreview = previewFor === criteria;
  const formErrorShown = errorFor === criteria ? formError : '';

  const orders = useQuery({
    queryKey: ['waitlist', usuarioId],
    queryFn: ({ signal }) => waitlistApi.list(signal),
    enabled: Boolean(usuarioId),
  });
  const create = useMutation({
    mutationFn: (body: WaitlistRequest) => waitlistApi.create(body),
    onSuccess: (created) => {
      queryClient.setQueryData<WaitlistOrder[]>(['waitlist', usuarioId], (current) => [created, ...(current ?? [])]);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      showDialog({
        title: 'Você entrou na fila',
        message: email
          ? 'Avisamos em Avisos, no Menu, e por e-mail quando chegar um veículo assim.'
          : 'Avisamos em Avisos, no Menu, quando chegar um veículo assim.',
      });
      clearBrand();
      scroll.current?.scrollTo({ y: 0, animated: true });
    },
    onError: (reason) => {
      setFormError(reason.message);
      setErrorFor(criteria);
    },
  });

  function chooseType(next: string) {
    if (next === tipo) return;
    setTipo(next as WaitlistFipeType);
    clearBrand();
  }
  function chooseBrand(option: FipeOption) {
    setMarca(option);
    setMarcaTermo('');
    setVersaoTermo('');
    setEscolhidas(new Map());
  }
  function clearBrand() {
    setAnoMinimo('');
    setAnoMaximo('');
    setMarca(null);
    setMarcaTermo('');
    setVersaoTermo('');
    setEscolhidas(new Map());
  }
  function toggleVersion(option: FipeOption) {
    Haptics.selectionAsync();
    setEscolhidas((current) => {
      const next = new Map(current);
      if (next.has(option.codigo)) next.delete(option.codigo);
      else next.set(option.codigo, option.nome);
      return next;
    });
  }
  const allListedChosen = versionList.length > 0 && versionList.every((v) => escolhidas.has(v.codigo));
  function toggleAllListed() {
    setEscolhidas((current) => {
      const next = new Map(current);
      if (allListedChosen) versionList.forEach((v) => next.delete(v.codigo));
      else versionList.forEach((v) => next.set(v.codigo, v.nome));
      return next;
    });
  }

  function request(): WaitlistRequest | null {
    const stop = (message: string) => {
      setFormError(message);
      setErrorFor(criteria);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      return null;
    };
    if (!marca) return stop('Escolha a marca na lista da FIPE.');
    if (!escolhidas.size) return stop('Escolha ao menos uma versão.');
    if (!yearList.length || !minYear || !maxYear)
      return stop(anos.isFetching ? 'Aguarde: os anos das versões ainda estão carregando da FIPE.' : 'Não há anos na FIPE para essas versões.');
    if (Number(minYear) > Number(maxYear)) return stop('O ano inicial deve ser menor ou igual ao final.');
    if (!todoBrasil && !cidade.trim()) return stop('Informe a cidade.');
    if (!todoBrasil && !/^[A-Z]{2}$/.test(uf)) return stop('Informe a sigla do estado, ex.: SP.');
    return {
      tipoFipe: tipo,
      marcaCodigo: marca.codigo,
      marcaNome: marca.nome,
      versoes: [...escolhidas].map(([codigo, nome]) => ({ codigo, nome })),
      anoMinimo: Number(minYear),
      anoMaximo: Number(maxYear),
      cidade: todoBrasil ? null : cidade.trim(),
      uf: todoBrasil ? null : uf,
      alcance,
      avisarPorEmail: email,
    };
  }

  function runPreview() {
    const body = request();
    if (!body) return;
    setPreviewFor(criteria);
    preview.mutate(body, {
      onSettled: () => setTimeout(() => scroll.current?.scrollTo({ y: resultY.current, animated: true }), 50),
    });
  }

  const brandMatches = useMemo(() => {
    const all = marcas.data?.opcoes ?? [];
    const q = normalize(marcaTermo);
    return q ? all.filter((m) => normalize(m.nome).includes(q)) : all;
  }, [marcas.data, marcaTermo]);
  const popular = useMemo(
    () =>
      POPULAR[tipo]
        .map((nome) => marcas.data?.opcoes.find((m) => normalize(m.nome) === normalize(nome)))
        .filter((m): m is FipeOption => Boolean(m)),
    [marcas.data, tipo],
  );
  const chosenNames = [...escolhidas.values()];
  const catalogError = edition.error ?? marcas.error ?? versoes.error;

  if (!usuarioId)
    return (
      <View style={[styles.root, { backgroundColor: colors.bg }]}>
        <StateView
          icon={BellRing}
          title="Entre na sua conta"
          message="Para entrar na fila de espera e ser avisado quando chegar o veículo que você procura."
          actionLabel="Entrar"
          onAction={() => router.push('/entrar')}
        />
      </View>
    );

  return (
    <KeyboardAvoidingView style={[styles.root, { backgroundColor: colors.bg }]} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView ref={scroll} keyboardShouldPersistTaps="handled" contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + space.xxxl }]}>
        <AppText color="muted">
          Diga qual veículo você procura. Mostramos o que já está à venda e avisamos quando chegar um novo, perto de você ou em todo o
          Brasil.
        </AppText>

        <Step icon={CarFront} title="O veículo">
          <ChoiceRow value={tipo} options={TYPES} onChange={chooseType} />
          {catalogError ? (
            <Notice
              tone="error"
              message={catalogError.message || 'O catálogo FIPE está indisponível agora.'}
              actionLabel="Tentar de novo"
              onAction={() => {
                void edition.refetch();
                void marcas.refetch();
                void versoes.refetch();
              }}
            />
          ) : null}

          {marca ? (
            <View style={[styles.chosen, { backgroundColor: colors.subtle }]}>
              <View style={styles.flex}>
                <AppText variant="caption" color="muted">
                  Marca
                </AppText>
                <AppText variant="heading">{marca.nome}</AppText>
              </View>
              <Button label="Trocar" variant="ghost" onPress={clearBrand} />
            </View>
          ) : (
            <View style={styles.field}>
              <TextField
                label="Marca"
                value={marcaTermo}
                onChangeText={setMarcaTermo}
                placeholder={referencia === null ? 'Carregando o catálogo FIPE…' : 'Buscar marca'}
                editable={referencia !== null}
                autoCorrect={false}
              />
              {popular.length && !marcaTermo ? (
                <View style={styles.wrap}>
                  {popular.map((option) => (
                    <Pill key={option.codigo} label={option.nome} onPress={() => chooseBrand(option)} />
                  ))}
                </View>
              ) : null}
              {marcas.isPending && referencia !== null ? <Skeleton height={44} /> : null}
              {marcas.data?.pendente ? <Loading text="Buscando as marcas na FIPE…" /> : null}
              {marcaTermo ? (
                brandMatches.length ? (
                  <View style={[styles.options, { borderColor: colors.border, backgroundColor: colors.surface }]}>
                    {brandMatches.slice(0, 12).map((option, index) => (
                      <OptionRow key={option.codigo} label={option.nome} first={index === 0} onPress={() => chooseBrand(option)} />
                    ))}
                  </View>
                ) : marcas.data && !marcas.data.pendente ? (
                  <AppText variant="caption" color="muted">
                    Nenhuma marca com esse nome na FIPE.
                  </AppText>
                ) : null
              ) : null}
            </View>
          )}

          {marca ? (
            <View style={styles.field}>
              <TextField
                label="Modelo e versões"
                value={versaoTermo}
                onChangeText={(text) => {
                  setVersaoTermo(text);
                  setAllVersions(false);
                }} placeholder="Digite o modelo, ex.: Corolla" autoCorrect={false} />
              {versionsPending ? <Loading text="Buscando as versões na FIPE…" /> : null}
              {versoes.isPending ? <Skeleton height={44} /> : null}
              {versionList.length ? (
                <View style={[styles.options, { borderColor: colors.border, backgroundColor: colors.surface }]}>
                  <CheckRow
                    label={termo ? `Todas as versões de "${termo}"` : 'Todas as versões listadas'}
                    note={`${versionList.length}${versoes.hasNextPage ? '+' : ''}`}
                    checked={allListedChosen}
                    onPress={toggleAllListed}
                    first
                    strong
                  />
                  {(allVersions ? versionList : versionList.slice(0, VISIBLE_VERSIONS)).map((option) => (
                    <CheckRow key={option.codigo} label={option.nome} checked={escolhidas.has(option.codigo)} onPress={() => toggleVersion(option)} />
                  ))}
                </View>
              ) : versoes.data && !versionsPending ? (
                <AppText variant="caption" color="muted">
                  Nenhuma versão com esse nome.
                </AppText>
              ) : null}
              {!allVersions && versionList.length > VISIBLE_VERSIONS ? (
                <Button label={`Mostrar todas as ${versionList.length} versões`} variant="ghost" onPress={() => setAllVersions(true)} />
              ) : null}
              {allVersions && versoes.hasNextPage ? (
                <Button
                  label="Carregar mais versões"
                  variant="ghost"
                  loading={versoes.isFetchingNextPage}
                  onPress={() => void versoes.fetchNextPage()}
                />
              ) : null}
            </View>
          ) : null}
        </Step>

        <Step icon={CalendarDays} title="Ano do modelo">
          {!chosenIds.length ? (
            <AppText variant="caption" color="muted">
              Escolha a versão para ver os anos.
            </AppText>
          ) : anos.isPending || anos.data?.pendente ? (
            <Loading text="Carregando os anos na FIPE…" />
          ) : anos.isError ? (
            <Notice tone="error" message={anos.error.message} actionLabel="Tentar de novo" onAction={() => anos.refetch()} />
          ) : !yearList.length ? (
            <AppText variant="caption" color="muted">
              Não há anos na FIPE para essas versões.
            </AppText>
          ) : (
            <>
              <YearPicker label="De" years={yearList} value={minYear} onChange={setAnoMinimo} />
              <YearPicker label="Até" years={yearList} value={maxYear} onChange={setAnoMaximo} startAtEnd />
            </>
          )}
        </Step>

        <Step icon={MapPin} title="Onde">
          <ChoiceRow value={alcance} options={REACHES} onChange={(v) => setAlcance(v as WaitlistReach)} />
          {todoBrasil ? null : (
            <View style={styles.row}>
              <View style={styles.flex}>
                <TextField label="Cidade" value={cidade} onChangeText={setCidade} placeholder="Ex.: Campinas" maxLength={120} autoCapitalize="words" />
              </View>
              <View style={styles.uf}>
                <TextField
                  label="UF"
                  value={uf}
                  onChangeText={(v) => setUf(v.toUpperCase().replace(/[^A-Z]/g, '').slice(0, 2))}
                  autoCapitalize="characters"
                  autoCorrect={false}
                  maxLength={2}
                />
              </View>
            </View>
          )}
        </Step>

        <View style={[styles.ticket, { backgroundColor: colors.subtle }]}>
          <AppText variant="overline" color="red">
            Seu pedido
          </AppText>
          <AppText variant="title" color={marca ? 'text' : 'muted'}>
            {marca?.nome ?? 'Escolha a marca'}
          </AppText>
          <Fact label="Versões" value={chosenNames.length === 0 ? 'Nenhuma ainda' : chosenNames.length === 1 ? chosenNames[0] : `${chosenNames.length} versões`} />
          <Fact label="Ano" value={minYear && maxYear ? yearsLabel(minYear, maxYear) : '—'} />
          <Fact
            label="Onde"
            value={todoBrasil ? 'Todo o Brasil' : cidade.trim() && uf ? describeReach(Number(alcance), cidade.trim(), uf) : 'Informe a cidade e o estado'}
          />
          <Fact label="Validade" value="90 dias, renovável" />
          <View style={styles.emailRow}>
            <View style={styles.flex}>
              <AppText variant="bodyStrong">Também me avisar por e-mail</AppText>
              <AppText variant="caption" color="muted">
                Sem marcar, o aviso aparece só em Avisos, no Menu.
              </AppText>
            </View>
            <Switch
              value={email}
              onValueChange={setEmail}
              trackColor={{ true: colors.red, false: colors.border }}
              thumbColor="#ffffff"
              accessibilityLabel="Também me avisar por e-mail"
            />
          </View>
          {formErrorShown ? <Notice tone="error" message={formErrorShown} /> : null}
          <Button label="Ver veículos à venda" icon={<Search size={17} color={colors.onRed} />} onPress={runPreview} loading={preview.isPending} />
          <AppText variant="caption" color="muted" style={styles.center}>
            Primeiro mostramos o que já existe. Depois você entra na fila.
          </AppText>
        </View>

        <View onLayout={(event) => (resultY.current = event.nativeEvent.layout.y)}>
          {showPreview && preview.isError ? <Notice tone="error" title="Não foi possível pesquisar" message={preview.error.message} /> : null}
          {showPreview && preview.data ? (
            <PreviewResult
              cars={preview.data.carros}
              where={todoBrasil ? 'em qualquer lugar do Brasil' : `até ${alcance} km de ${cidade.trim()}/${uf}`}
              creating={create.isPending}
              onCreate={() => {
                const body = request();
                if (body) create.mutate(body);
              }}
            />
          ) : null}
        </View>

        <Orders query={orders} />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function PreviewResult({ cars, where, creating, onCreate }: { cars: SearchAd[]; where: string; creating: boolean; onCreate: () => void }) {
  const { colors } = useTheme();
  const join = <Button label="Entrar na fila de espera" icon={<BellRing size={17} color={colors.onRed} />} onPress={onCreate} loading={creating} />;
  if (!cars.length)
    return (
      <View style={[styles.none, { borderColor: colors.border }]}>
        <BellRing size={26} color={colors.red} />
        <AppText variant="heading">Nenhum veículo assim à venda agora</AppText>
        <AppText color="muted">Entre na fila e avisamos quando um for anunciado {where}.</AppText>
        {join}
      </View>
    );
  return (
    <View style={styles.section}>
      <AppText variant="title">{cars.length === 1 ? '1 veículo à venda agora' : `${cars.length} veículos à venda agora`}</AppText>
      <AppText color="muted">Na fila, você é avisado também dos próximos que forem anunciados.</AppText>
      {join}
      {cars.map((ad) => (
        <VehicleCard key={ad.anuncioId} ad={ad} layout="row" />
      ))}
    </View>
  );
}

function Orders({ query }: { query: ReturnType<typeof useQuery<WaitlistOrder[]>> }) {
  return (
    <View style={styles.section}>
      <View style={styles.rowCenter}>
        <AppText variant="title" style={styles.flex} accessibilityRole="header">
          Seus pedidos
        </AppText>
        {query.data?.length ? (
          <AppText variant="caption" color="muted">
            {query.data.length === 1 ? '1 pedido' : `${query.data.length} pedidos`}
          </AppText>
        ) : null}
      </View>
      {query.isError && !query.data ? (
        <Notice tone="error" message={query.error.message} actionLabel="Tentar de novo" onAction={() => query.refetch()} />
      ) : query.isPending ? (
        <Skeleton height={140} rounded={radius.lg} />
      ) : !query.data?.length ? (
        <AppText color="muted">Você ainda não tem pedidos. Monte um acima: escolha o veículo, o ano e a cidade.</AppText>
      ) : (
        query.data.map((order) => <OrderCard key={order.id} order={order} />)
      )}
    </View>
  );
}

function OrderCard({ order }: { order: WaitlistOrder }) {
  const { colors } = useTheme();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [showVersions, setShowVersions] = useState(false);
  const days = daysLeft(order.expiraEm);
  const listKey = ['waitlist'];
  const replace = (updated: WaitlistOrder) =>
    queryClient.setQueriesData<WaitlistOrder[]>({ queryKey: listKey }, (current) => current?.map((o) => (o.id === updated.id ? updated : o)));
  const renew = useMutation({
    mutationFn: () => waitlistApi.renew(order.id),
    onSuccess: (updated) => {
      replace(updated);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    },
  });
  const setEmail = useMutation({ mutationFn: (value: boolean) => waitlistApi.setEmail(order.id, value), onSuccess: replace });
  const remove = useMutation({
    mutationFn: () => waitlistApi.remove(order.id),
    onSuccess: () => queryClient.setQueriesData<WaitlistOrder[]>({ queryKey: listKey }, (current) => current?.filter((o) => o.id !== order.id)),
  });
  const cars = useQuery({ queryKey: ['waitlist-cars', order.id], queryFn: ({ signal }) => waitlistApi.cars(order.id, signal), enabled: open });
  const failure = renew.error ?? setEmail.error ?? remove.error;

  function confirmRemove() {
    showDialog({
      title: 'Excluir este pedido?',
      message: `Você deixa de ser avisado sobre ${order.marcaNome}.`,
      actions: [
        { label: 'Manter', kind: 'cancel' },
        { label: 'Excluir', kind: 'destructive', onPress: () => remove.mutate() },
      ],
    });
  }

  return (
    <View style={[styles.order, { borderColor: order.vencido ? colors.redBorder : colors.border, backgroundColor: colors.surface }]}>
      <View style={styles.rowCenter}>
        <View style={[styles.stub, { backgroundColor: order.vencido ? colors.redTint : colors.subtle }]}>
          <AppText variant="title" color={order.vencido ? 'red' : 'text'}>
            {order.vencido ? '!' : days}
          </AppText>
          <AppText variant="caption" color="muted" style={styles.center}>
            {order.vencido ? `Venceu ${shortDate(order.expiraEm)}` : days === 1 ? 'dia' : 'dias'}
          </AppText>
        </View>
        <View style={styles.flex}>
          <AppText variant="heading">{order.marcaNome}</AppText>
          <AppText variant="caption" color="muted" numberOfLines={2}>
            {order.versoes.length === 1 ? order.versoes[0].nome : `${order.versoes[0]?.nome} e mais ${order.versoes.length - 1}`}
          </AppText>
        </View>
      </View>
      <Fact label="Ano" value={yearsLabel(order.anoMinimo, order.anoMaximo)} />
      <Fact label="Onde" value={describeReach(order.raioKm, order.cidade, order.uf)} />
      <Fact label="Encontrados" value={String(order.carrosEncontrados)} />
      {order.versoes.length > 1 ? (
        <Pressable onPress={() => setShowVersions((v) => !v)} accessibilityRole="button" accessibilityState={{ expanded: showVersions }} style={styles.link}>
          <AppText variant="label" color="red">
            {showVersions ? 'Esconder as versões' : `Ver as ${order.versoes.length} versões`}
          </AppText>
          {showVersions ? <ChevronUp size={16} color={colors.red} /> : <ChevronDown size={16} color={colors.red} />}
        </Pressable>
      ) : null}
      {showVersions ? (
        <View style={styles.versionList}>
          {order.versoes.map((v) => (
            <AppText key={v.codigo} variant="caption" color="muted">
              • {v.nome}
            </AppText>
          ))}
        </View>
      ) : null}
      <View style={styles.emailRow}>
        <Mail size={16} color={colors.muted} />
        <AppText style={styles.flex}>Avisar também por e-mail</AppText>
        <Switch
          value={setEmail.isPending ? Boolean(setEmail.variables) : order.avisarPorEmail}
          onValueChange={(value) => setEmail.mutate(value)}
          disabled={setEmail.isPending}
          trackColor={{ true: colors.red, false: colors.border }}
          thumbColor="#ffffff"
          accessibilityLabel={`Avisar também por e-mail sobre ${order.marcaNome}`}
        />
      </View>
      {failure ? <Notice tone="error" message={failure.message} /> : null}
      <View style={styles.actions}>
        {order.carrosEncontrados > 0 ? (
          <Button
            label={open ? 'Esconder veículos' : order.carrosEncontrados === 1 ? 'Ver o veículo encontrado' : 'Ver os veículos encontrados'}
            variant="secondary"
            onPress={() => setOpen((v) => !v)}
          />
        ) : null}
        <Button
          label="Renovar por 90 dias"
          variant={order.vencido ? 'primary' : 'secondary'}
          icon={<RotateCw size={15} color={order.vencido ? colors.onRed : colors.text} />}
          onPress={() => renew.mutate()}
          loading={renew.isPending}
        />
        <Button label="Excluir" variant="ghost" icon={<Trash2 size={15} color={colors.red} />} onPress={confirmRemove} loading={remove.isPending} />
      </View>
      {open ? (
        cars.isPending ? (
          <Loading text="Carregando os veículos…" />
        ) : cars.isError ? (
          <Notice tone="error" message={cars.error.message} actionLabel="Tentar de novo" onAction={() => cars.refetch()} />
        ) : cars.data?.carros.length ? (
          cars.data.carros.map((ad) => <VehicleCard key={ad.anuncioId} ad={ad} layout="row" />)
        ) : (
          <AppText variant="caption" color="muted">
            Os veículos encontrados já saíram do ar.
          </AppText>
        )
      ) : null}
    </View>
  );
}

function Step({ icon: Icon, title, children }: { icon: typeof CarFront; title: string; children: React.ReactNode }) {
  const { colors } = useTheme();
  return (
    <View style={styles.section}>
      <View style={styles.rowCenter}>
        <View style={[styles.stepIcon, { backgroundColor: colors.redTint }]}>
          <Icon size={17} color={colors.red} />
        </View>
        <AppText variant="title" accessibilityRole="header">
          {title}
        </AppText>
      </View>
      {children}
    </View>
  );
}

function YearPicker({
  label,
  years,
  value,
  onChange,
  startAtEnd,
}: {
  label: string;
  years: number[];
  value: string;
  onChange: (v: string) => void;
  /** "Até" começa no ano mais novo, que fica no fim da fileira. */
  startAtEnd?: boolean;
}) {
  const ascending = [...years].sort((a, b) => a - b);
  const row = useRef<ScrollViewInstance>(null);
  return (
    <View style={styles.field}>
      <AppText variant="label">{label}</AppText>
      <ScrollView
        ref={row}
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.yearRow}
        onContentSizeChange={() => {
          if (startAtEnd) row.current?.scrollToEnd({ animated: false });
        }}>
        {ascending.map((year) => (
          <Pill key={year} label={String(year)} selected={value === String(year)} onPress={() => onChange(String(year))} a11y={`${label} ${year}`} />
        ))}
      </ScrollView>
    </View>
  );
}

function Pill({ label, selected, onPress, a11y }: { label: string; selected?: boolean; onPress: () => void; a11y?: string }) {
  const { colors } = useTheme();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole={selected === undefined ? 'button' : 'radio'}
      accessibilityState={selected === undefined ? undefined : { selected }}
      accessibilityLabel={a11y ?? label}
      style={[
        styles.pill,
        { borderColor: selected ? colors.red : colors.border, backgroundColor: selected ? colors.redTint : colors.surface },
      ]}>
      <AppText variant="label" color={selected ? 'red' : 'text'}>
        {label}
      </AppText>
    </Pressable>
  );
}

function OptionRow({ label, first, onPress }: { label: string; first?: boolean; onPress: () => void }) {
  const { colors } = useTheme();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      style={({ pressed }) => [
        styles.option,
        !first && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border },
        pressed && { backgroundColor: colors.subtle },
      ]}>
      <AppText>{label}</AppText>
    </Pressable>
  );
}

function CheckRow({
  label,
  note,
  checked,
  onPress,
  first,
  strong,
}: {
  label: string;
  note?: string;
  checked: boolean;
  onPress: () => void;
  first?: boolean;
  strong?: boolean;
}) {
  const { colors } = useTheme();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="checkbox"
      accessibilityState={{ checked }}
      accessibilityLabel={label}
      style={({ pressed }) => [
        styles.option,
        styles.rowCenter,
        !first && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border },
        checked && { backgroundColor: colors.redTint },
        pressed && { opacity: 0.7 },
      ]}>
      <View style={[styles.box, { borderColor: checked ? colors.red : colors.border, backgroundColor: checked ? colors.red : 'transparent' }]}>
        {checked ? <Check size={14} color={colors.onRed} /> : null}
      </View>
      <AppText variant={strong ? 'bodyStrong' : 'body'} style={styles.flex}>
        {label}
      </AppText>
      {note ? (
        <AppText variant="caption" color="muted">
          {note}
        </AppText>
      ) : null}
    </Pressable>
  );
}

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.fact}>
      <AppText variant="caption" color="muted" style={styles.factLabel}>
        {label}
      </AppText>
      <AppText variant="bodyStrong" style={styles.flex}>
        {value}
      </AppText>
    </View>
  );
}

function Loading({ text }: { text: string }) {
  const { colors } = useTheme();
  return (
    <View style={styles.rowCenter} accessibilityLiveRegion="polite">
      <ActivityIndicator size="small" color={colors.red} />
      <AppText variant="caption" color="muted">
        {text}
      </AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  flex: { flex: 1 },
  center: { textAlign: 'center' },
  content: { padding: space.lg, gap: space.xxl },
  section: { gap: space.md },
  field: { gap: space.sm },
  row: { flexDirection: 'row', gap: space.md },
  rowCenter: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  uf: { width: 84 },
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  chosen: { flexDirection: 'row', alignItems: 'center', gap: space.md, padding: space.md, paddingLeft: space.lg, borderRadius: radius.lg },
  options: { borderWidth: StyleSheet.hairlineWidth, borderRadius: radius.md, overflow: 'hidden' },
  option: { minHeight: touch + 4, paddingHorizontal: space.lg, paddingVertical: space.sm, justifyContent: 'center' },
  box: { width: 22, height: 22, borderRadius: 6, borderWidth: 1.5, alignItems: 'center', justifyContent: 'center' },
  stepIcon: { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  yearRow: { gap: space.sm, paddingRight: space.lg },
  pill: { minHeight: touch, borderWidth: 1, paddingHorizontal: space.md, justifyContent: 'center', borderRadius: radius.pill },
  ticket: { gap: space.md, padding: space.lg, borderRadius: radius.lg },
  fact: { flexDirection: 'row', gap: space.md, alignItems: 'flex-start' },
  factLabel: { width: 84, paddingTop: 2 },
  emailRow: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  none: { gap: space.md, padding: space.lg, borderRadius: radius.lg, borderWidth: 1, alignItems: 'flex-start' },
  order: { gap: space.md, padding: space.lg, borderRadius: radius.lg, borderWidth: 1 },
  stub: { width: 64, minHeight: 64, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center', padding: space.xs },
  link: { flexDirection: 'row', alignItems: 'center', gap: space.xs, minHeight: 32 },
  versionList: { gap: 2 },
  actions: { gap: space.sm },
});
