import * as Haptics from "expo-haptics";
import { Image } from "expo-image";
import * as ImagePicker from "expo-image-picker";
import * as DocumentPicker from "expo-document-picker";
import { router } from "expo-router";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import {
  AccessibilityInfo,
  ActivityIndicator,
  AppState,
  KeyboardAvoidingView,
  Keyboard,
  Platform,
  Pressable,
  type ScrollViewInstance,
  type StyleProp,
  StyleSheet,
  useWindowDimensions,
  View,
  type ViewInstance,
  type ViewStyle,
} from "react-native";
import { Check, ChevronsLeftRight } from "lucide-react-native";
import {
  GestureDetector,
  ScrollView,
  usePanGesture,
} from "react-native-gesture-handler";
import Animated, {
  cancelAnimation,
  ReduceMotion,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withSequence,
  withSpring,
  withTiming,
} from "react-native-reanimated";
import { scheduleOnRN } from "react-native-worklets";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { findAddressByCep } from "@/api/viacep";
import {
  announceApi,
  type FipeReference,
  type UploadFile,
} from "@/api/announce";
import { isUploadInterrupted } from "@/api/client";
import { secureStorage } from "@/api/secure-storage";
import { myAdsApi } from "@/api/my-ads";
import { AdQualityTips } from "@/components/ad-quality-tips";
import { AppText } from "@/components/app-text";
import { Button } from "@/components/button";
import { Notice } from "@/components/notice";
import { showDialog } from "@/components/dialog";
import { TextField } from "@/components/text-field";
import { useAccount } from "@/hooks/use-account";
import { useSession } from "@/hooks/use-session";
import { useFipeConditionSync } from "@/hooks/use-fipe-condition-sync";
import type { PlateSuggestion } from "@/api/plates";
import { PlateField } from "@/components/plate-field";
import { PlatePrefillCard, plateSuggestionValues, plateVehicleTypes } from "./plate-prefill";
import { cleanMasked, displayMasked, maskInput } from "@/utils/masks";
import { useTheme } from "@/hooks/use-theme";
import { motion, radius, space, touch } from "@/theme";
import { adPayload, type Draft } from "./payload";
import { ChoiceRow } from "@/components/choice-row";
import { ensureCameraPermission } from "@/utils/permission";
import {
  discardDraft,
  draftEpoch,
  draftVehicleName,
  loadDraft,
  removeDraft,
  saveDraft,
  savedAtLabel,
  type AnnounceDraft,
  type SaveResult,
} from "@/utils/announce-draft";
import { preparePhoto } from "@/utils/prepare-photo";
import {
  plateVideoWarning,
  videoSentMessage,
  videoTrimNotice,
} from "@/utils/video-notice";
import { AdField, suggestionsFor } from "./ad-fields";
import { AdvertiserReview } from "./advertiser-review";
import { FipeSelector } from "./fipe-selector";
import {
  addressFields,
  fieldsByType,
  fipeTypes,
  motorFields,
  vehicleTypes,
  type Field,
} from "./fields";
import {
  emptyCheck,
  errorCount,
  shortName,
  summarize,
  type StageCheck,
} from "./stage-check";
import { ProgressSegment, resist, StagePage } from "./stage-pager";

const stages = [
  "Tipo de anúncio",
  "Escolha o veículo",
  "Dados principais",
  "Documentação",
  "Localização",
  "Fotos",
  "Anúncio",
  "Dados opcionais",
  "Conferência",
];
const lastStage = stages.length - 1;
/** Marca neste aparelho que a pessoa já trocou de etapa arrastando: a dica de deslizar some. */
const swipeLearnedKey = "anuncio.deslize-aprendido";
/** Tipo e veículo definem o resto do formulário: só elas travam o avanço. */
const lockedStages = 2;
const brandField: Field = {
  key: "fabricante",
  label: "Marca / fabricante",
  required: true,
  maxLength: 100,
};
const modelField: Field = {
  key: "modelo",
  label: "Modelo",
  required: true,
  maxLength: 250,
};
const modelYearField: Field = {
  key: "anoModelo",
  label: "Ano do modelo",
  required: true,
  kind: "number",
};
const fabricationYearField: Field = {
  key: "anoFabricacao",
  label: "Ano de fabricação",
  required: true,
  kind: "number",
};
const colorField: Field = {
  key: "cor",
  label: "Cor",
  required: true,
  maxLength: 60,
};
const auctionField: Field = {
  key: "historicoLeilao",
  label: "Passou por leilão?",
  kind: "boolean",
  required: true,
};
const accidentField: Field = {
  key: "historicoSinistro",
  label: "Teve sinistro?",
  kind: "boolean",
  required: true,
};
const titleField: Field = {
  key: "titulo",
  label: "Título do anúncio",
  required: true,
  maxLength: 180,
};
const priceField: Field = {
  key: "precoReais",
  label: "Preço (R$)",
  required: true,
  mask: "money",
};
const descriptionField: Field = {
  key: "descricao",
  label: "Descrição",
  maxLength: 10000,
  multiline: true,
};
const platePattern = /^[A-Z]{3}[0-9][A-Z0-9][0-9]{2}$/i;
const initial: Draft = {
  tipoVeiculo: "CARRO",
  condicao: "USADO",
  tipoPreco: "FIXO",
  contatoWhatsapp: "false",
  contatoLigacao: "false",
  contatoNaoDivulgar: "true",
  historicoLeilao: "",
  historicoSinistro: "",
  publicarAgora: "true",
};
type Photo = { file: UploadFile; alt: string };
type LotUnit = {
  key: string;
  cor: string;
  placa: string;
  quilometragem: string;
  laudo: UploadFile | null;
};
const newLotUnit = (): LotUnit => ({
  key: Math.random().toString(36).slice(2),
  cor: "",
  placa: "",
  quilometragem: "",
  laudo: null,
});
function message(error: unknown) {
  return error instanceof Error
    ? error.message
    : "Não foi possível concluir. Tente de novo.";
}

/**
 * Confere se há um anúncio em preenchimento salvo no aparelho (o app pode ter fechado, o sistema pode tê-lo encerrado
 * ou a conexão pode ter caído). A pergunta "usar os dados ou começar do zero" aparece ao tocar em "Continuar" na
 * conferência dos dados do anunciante, como no site; o formulário então remonta já com a escolha.
 */
export function Announce() {
  const { colors } = useTheme();
  const session = useSession();
  const usuarioId =
    session.status === "authenticated" ? session.user.usuarioId : null;
  const [ready, setReady] = useState<{
    usuarioId: string;
    saved: AnnounceDraft | null;
    choice: "pending" | "keep" | "fresh";
  } | null>(null);
  useEffect(() => {
    if (!usuarioId) return;
    let active = true;
    loadDraft(usuarioId).then((saved) => {
      if (active) setReady({ usuarioId, saved, choice: "pending" });
    });
    return () => {
      active = false;
    };
  }, [usuarioId]);
  // Sem conta, o formulário mostra o convite para entrar; não há rascunho.
  if (session.status === "anonymous")
    return <AnnounceForm key="visitante" draft={null} />;
  if (!ready || ready.usuarioId !== usuarioId)
    return (
      <View
        style={[styles.root, styles.loading, { backgroundColor: colors.bg }]}
        accessibilityLabel="Conferindo anúncio em andamento"
      >
        <ActivityIndicator color={colors.red} />
      </View>
    );
  const { saved } = ready;
  function ask() {
    if (!saved) return;
    const step = Math.min(saved.stage, lastStage);
    const photoCount = saved.photos.length;
    showDialog({
      title: "Você tem um anúncio em andamento",
      message:
        `Os dados do ${draftVehicleName(saved.values)} estavam no cadastro, salvos neste aparelho ` +
        `${savedAtLabel(saved.savedAt)}: etapa ${step + 1} de ${stages.length} (${stages[step]})` +
        `${photoCount ? `, com ${photoCount} ${photoCount === 1 ? "foto" : "fotos"}` : ""}. ` +
        "Quer continuar de onde parou? Por segurança, placa e rua, número e complemento não ficam salvos e precisam ser preenchidos de novo. Começar do zero apaga esses dados.",
      actions: [
        {
          label: "Começar do zero",
          onPress: () => {
            discardDraft(ready!.usuarioId);
            setReady({ ...ready!, saved: null, choice: "fresh" });
          },
        },
        {
          label: "Usar os dados salvos",
          onPress: () =>
            setReady({ ...ready!, saved: { ...saved!, stage: step }, choice: "keep" }),
        },
      ],
    });
  }
  return (
    <AnnounceForm
      key={`${ready.usuarioId}-${ready.choice}`}
      draft={ready.choice === "keep" ? saved : null}
      startReviewed={ready.choice !== "pending"}
      onReviewContinue={ready.choice === "pending" && saved ? ask : undefined}
    />
  );
}

function AnnounceForm({
  draft,
  startReviewed = false,
  onReviewContinue,
}: {
  draft: AnnounceDraft | null;
  /** A conferência dos dados do anunciante já foi feita (a pessoa escolheu entre o rascunho e começar do zero). */
  startReviewed?: boolean;
  /** Há rascunho salvo: o "Continuar" da conferência pergunta antes de abrir o formulário. */
  onReviewContinue?: () => void;
}) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const session = useSession();
  const [stage, setStage] = useState(() => draft?.stage ?? 0);
  const [values, setValues] = useState<Draft>(() =>
    draft ? ({ ...initial, ...draft.values } as Draft) : initial,
  );
  const [motors, setMotors] = useState<Record<string, string>[]>(
    () => draft?.motors ?? [],
  );
  const [photos, setPhotos] = useState<Photo[]>(() => draft?.photos ?? []);
  const [lotMode, setLotMode] = useState(() => draft?.lotMode ?? false);
  const [lotUnits, setLotUnits] = useState<LotUnit[]>(() =>
    draft?.lotUnits.length ? draft.lotUnits : [newLotUnit(), newLotUnit()],
  );
  const [existing, setExisting] = useState<string[]>(
    () => draft?.existing ?? [],
  );
  const [video, setVideo] = useState<UploadFile | null>(
    () => draft?.video ?? null,
  );
  const [videoNotice, setVideoNotice] = useState(
    () => draft?.videoNotice ?? "",
  );
  const [report, setReport] = useState<UploadFile | null>(
    () => draft?.report ?? null,
  );
  const [error, setError] = useState("");
  const [created, setCreated] = useState<string | null>(null);
  const [warning, setWarning] = useState("");
  const [createdVideoNote, setCreatedVideoNote] = useState("");
  const [reference, setReference] = useState<FipeReference | null>(
    () => draft?.reference ?? null,
  );
  const [fipeNotice, setFipeNotice] = useState("");
  // Preenchimento pela placa (etapa 0): o que veio da consulta, para avisar e poder desfazer.
  const [plateApplied, setPlateApplied] = useState<PlateSuggestion | null>(null);
  const [plateFilledKeys, setPlateFilledKeys] = useState<string[]>([]);
  const [progress, setProgress] = useState<number | null>(null);
  // Primeiro passo, como no site: conferir os dados do anunciante (já feito por quem retoma um rascunho).
  const [reviewed, setReviewed] = useState(Boolean(draft) || startReviewed);
  const { width: windowWidth } = useWindowDimensions();
  /** Rolagem de cada página montada, para levar a pessoa até o campo pendente. */
  const pageScrolls = useRef(new Map<number, ScrollViewInstance>());
  /** Etapa visível em páginas, contínua durante o arraste e as transições. */
  const position = useSharedValue(draft?.stage ?? 0);
  const pageWidth = useSharedValue(windowWidth);
  const pagerFade = useSharedValue(1);
  const canForward = useSharedValue(false);
  const canBack = useSharedValue(false);
  const dragStart = useSharedValue(0);
  const dragOrigin = useSharedValue(0);
  /** Etapa de onde partiu um salto de mais de uma página (ex.: "Criar anúncio" com pendência). */
  const jumpFrom = useRef<number | undefined>(undefined);
  const pagerStyle = useAnimatedStyle(() => ({ opacity: pagerFade.get() }));
  /** null enquanto lê o aparelho; false mostra a dica e a espiada. */
  const [swipeLearned, setSwipeLearned] = useState<boolean | null>(null);
  useEffect(() => {
    let active = true;
    secureStorage.get(swipeLearnedKey).then((value) => {
      if (active) setSwipeLearned(value === "1");
    });
    return () => {
      active = false;
    };
  }, []);
  /** Etapa mais avançada já visitada: só etapas até ela ganham marca de pendência. */
  const [furthest, setFurthest] = useState(() => draft?.furthest ?? 0);
  /** Etapas deixadas para trás (ou todas, depois de tentar criar): mostram também os campos vazios. */
  const [revealed, setRevealed] = useState<ReadonlySet<number>>(
    () => new Set(draft ? stages.map((_, index) => index).filter((index) => index < draft.stage) : []),
  );
  /** Campos que já perderam o foco: mostram erro de formato mesmo na primeira visita. */
  const [touched, setTouched] = useState<ReadonlySet<string>>(
    () => new Set(),
  );
  const anchors = useRef(new Map<string, ViewInstance>());
  const scrollTarget = useRef<string | null | undefined>(undefined);
  const [scrollRequest, setScrollRequest] = useState(0);
  const reduceMotion = useReducedMotion();
  const tipo = values.tipoVeiculo;
  const fipeType = fipeTypes[tipo];
  const signedIn = session.status === "authenticated";
  const profile = useAccount();

  // Rascunho no aparelho: cada mudança é gravada logo depois (e na hora em que o app vai para segundo plano), para
  // resistir ao app fechado, encerrado pelo sistema ou sem conexão. Ao abrir "Anunciar" de novo, a pessoa escolhe.
  const usuarioId = signedIn ? session.user.usuarioId : null;
  const draftSince = useRef(draftEpoch());
  const draftTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const pendingDraft = useRef<{
    usuarioId: string;
    dirty: boolean;
    data: Parameters<typeof saveDraft>[1];
  } | null>(null);
  const formMounted = useRef(true);
  const [draftStatus, setDraftStatus] = useState<{ result: SaveResult; at: number } | null>(null);
  const flushDraft = useCallback(() => {
    clearTimeout(draftTimer.current);
    const pending = pendingDraft.current;
    pendingDraft.current = null;
    if (!pending || draftSince.current !== draftEpoch()) return;
    if (!pending.dirty) {
      removeDraft(pending.usuarioId);
      if (formMounted.current) setDraftStatus(null);
      return;
    }
    saveDraft(pending.usuarioId, pending.data, draftSince.current).then((result) => {
      if (result !== "stale" && formMounted.current)
        setDraftStatus({ result, at: Date.now() });
    });
  }, []);
  // Há algo a perder: qualquer campo preenchido, foto, motor, vídeo, laudo ou carro do lote.
  const draftDirty =
    photos.length > 0 ||
    motors.length > 0 ||
    existing.length > 0 ||
    Boolean(video || report) ||
    lotUnits.some((unit) => unit.cor || unit.placa || unit.quilometragem || unit.laudo) ||
    Object.entries(values).some(
      ([key, value]) =>
        key !== "publicarAgora" && value !== "" && value !== (initial[key] ?? ""),
    );
  useEffect(() => {
    if (!usuarioId || !reviewed || created) return;
    pendingDraft.current = {
      usuarioId,
      dirty: draftDirty,
      data: {
        stage,
        furthest,
        values,
        motors,
        photos,
        lotMode,
        lotUnits,
        existing,
        video,
        videoNotice,
        report,
        reference,
      },
    };
    clearTimeout(draftTimer.current);
    draftTimer.current = setTimeout(flushDraft, 400);
  }, [usuarioId, reviewed, created, draftDirty, stage, furthest, values, motors, photos, lotMode, lotUnits, existing, video, videoNotice, report, reference, flushDraft]);
  useEffect(() => {
    formMounted.current = true;
    const subscription = AppState.addEventListener("change", (next) => {
      if (next !== "active") flushDraft();
    });
    return () => {
      subscription.remove();
      formMounted.current = false;
      flushDraft();
    };
  }, [flushDraft]);

  // Trocar zero km/seminovo troca a cotação FIPE pela da mesma versão, como no site.
  const syncingFipe = useFipeConditionSync({
    condicao: values.condicao || "",
    anoModelo: values.anoModelo || "",
    veiculo: `${values.fabricante || ""}|${values.modelo || ""}`,
    reference,
    onReference: setReference,
    onNotice: setFipeNotice,
  });

  const asLot =
    lotMode && tipo === "CARRO" && profile.data?.tipoPessoa === "PJ";
  const [cepBusy, setCepBusy] = useState(false);
  const catalog = useQuery({
    queryKey: ["ad-catalog"],
    queryFn: ({ signal }) => announceApi.catalog(signal),
    enabled: signedIn,
  });
  const mine = useQuery({
    queryKey: [
      "lot-existing",
      session.status === "authenticated" ? session.user.usuarioId : null,
    ],
    queryFn: async ({ signal }) => {
      const all = [];
      for (let page = 0; page < 5; page++) {
        const result = await myAdsApi.list(page, signal);
        all.push(...result.anuncios);
        if (!result.temProximaPagina && !result.temMais) break;
      }
      return all;
    },
    enabled: signedIn && asLot,
  });
  const quota = useQuery({
    queryKey: ["ad-quota"],
    queryFn: ({ signal }) => myAdsApi.quota(signal),
    enabled: signedIn,
  });
  const rules = useQuery({
    queryKey: ["ad-media-rules"],
    queryFn: ({ signal }) => announceApi.mediaRules(signal),
    enabled: signedIn,
  });
  const edition = useQuery({
    queryKey: ["fipe-edition", fipeType],
    queryFn: ({ signal }) => announceApi.fipeEdition(fipeType!, signal),
    enabled: signedIn && !!fipeType,
  });
  const zeroKm = values.condicao === "ZERO_KM";
  // Sem FIPE para o tipo, ou com a FIPE fora do ar, marca, modelo e ano são digitados na etapa 1.
  const manualVehicle = !fipeType || (!edition.data && !edition.isPending);
  // Zero km com FIPE: a cotação não tem ano, então o ano do modelo é pedido nos dados principais.
  const modelYearInMain = Boolean(fipeType && edition.data && zeroKm);
  const electric =
    (tipo === "CARRO" || tipo === "CAMINHONETE") &&
    (values[`${tipo}.combustivel`] || "")
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase() === "eletrico";
  const technical = fieldsByType[tipo]
    .filter(
      (item) =>
        !zeroKm ||
        ![
          "quilometragem",
          "placa",
          "exibirPlacaCompleta",
          "ipvaPago",
          "licenciado",
          "unicoDono",
        ].includes(item.key),
    )
    .filter(
      (item) => !electric || !["motorizacao", "turbo"].includes(item.key),
    );
  const documentKeys = new Set([
    "placa",
    "exibirPlacaCompleta",
    "ipvaPago",
    "unicoDono",
  ]);
  const requiredMain = technical.filter(
    (item) => item.required && !documentKeys.has(item.key),
  );
  // A placa é pedida logo na etapa 0, junto da consulta que preenche o resto.
  const plateItem = technical.find((item) => item.key === "placa");
  const requiredDocuments = technical.filter(
    (item) => item.required && documentKeys.has(item.key) && item.key !== "placa",
  );
  const optionalTechnical = technical.filter((item) => !item.required);
  // Dicas de qualidade: contam só o que já foi preenchido; a relevância é calculada no servidor.
  const optionalKeys = [
    "versao",
    "identificadorPublico",
    "tipoFreio",
    ...optionalTechnical.map((item) => `${tipo}.${item.key}`),
  ];
  const qualityTips = (compact: boolean) => (
    <AdQualityTips
      photos={photos.length}
      optionalFilled={
        optionalKeys.filter((key) => (values[key] ?? "").trim()).length
      }
      optionalTotal={optionalKeys.length}
      priceDefined={asLot || values.tipoPreco === "FIXO"}
      fipeLinked={fipeType ? Boolean(reference) : null}
      compact={compact}
    />
  );
  const create = useMutation({
    mutationFn: async () => {
      if (session.status !== "authenticated")
        throw new Error("Entre na sua conta para anunciar.");
      const common = adPayload(
        {
          ...values,
          publicarAgora:
            quota.data?.podePublicar === false ? "false" : values.publicarAgora,
        },
        motors,
        session.user.usuarioId,
        reference?.id || null,
      );
      // Anúncios deste veículo antes do envio. Também confirma a sessão e abre a conexão antes das fotos.
      const filters = {
        marca: values.fabricante.trim(),
        modelo: values.modelo.trim(),
      };
      const before = new Set(
        (await myAdsApi.list(0, undefined, filters)).anuncios.map((ad) => ad.id),
      );
      /** Se o envio caiu, confere se o servidor criou mesmo assim; senão tenta uma vez mais. */
      async function sendOnce<T>(
        send: () => Promise<T>,
        recover: (fresh: { id: string; loteId?: string | null }[]) => T | null,
      ): Promise<T> {
        setProgress(0);
        try {
          return await send();
        } catch (reason) {
          if (!isUploadInterrupted(reason)) throw reason;
          const fresh = (
            await myAdsApi.list(0, undefined, filters)
          ).anuncios.filter(
            (ad) => !before.has(ad.id) && ad.titulo === common.titulo,
          );
          const recovered = recover(fresh);
          if (recovered) return recovered;
          setProgress(0);
          return await send();
        } finally {
          setProgress(null);
        }
      }
      if (asLot) {
        const lotPayload = {
          anuncio: common,
          unidades: lotUnits.map((unit) => ({
            cor: unit.cor.trim(),
            placa:
              values.condicao === "ZERO_KM"
                ? null
                : unit.placa.trim().toUpperCase(),
            quilometragem:
              values.condicao === "ZERO_KM" ? 0 : Number(unit.quilometragem),
          })),
          anunciosExistentes: existing,
        };
        const result = await sendOnce(
          () => announceApi.createLot(lotPayload, photos, setProgress),
          (fresh) => {
            const loteId = fresh.find((ad) => ad.loteId)?.loteId;
            // Recuperado sem a resposta: a ordem dos carros é desconhecida, então os laudos ficam de fora.
            return loteId
              ? { loteId, anunciosCriados: [], anunciosIncluidos: [] }
              : null;
          },
        );
        const warnings: string[] = [];
        if (
          !result.anunciosCriados.length &&
          lotUnits.some((unit) => unit.laudo)
        )
          warnings.push("Os laudos do lote não foram enviados.");
        let videoNote = "";
        if (video)
          try {
            const sent = await announceApi.uploadLotVideo(result.loteId, video);
            videoNote = videoSentMessage("lote", sent.cortado);
          } catch (reason) {
            warnings.push(`Vídeo: ${message(reason)}`);
          }
        for (const [index, unit] of lotUnits.entries())
          if (unit.laudo && result.anunciosCriados[index])
            try {
              await announceApi.uploadReport(
                result.anunciosCriados[index],
                unit.laudo,
              );
            } catch (reason) {
              warnings.push(`Laudo do carro ${index + 1}: ${message(reason)}`);
            }
        return {
          id: result.loteId,
          warning: warnings.join(" "),
          videoNote,
        };
      }
      const result = await sendOnce(
        () => announceApi.create(common, photos, setProgress),
        (fresh) => (fresh[0] ? { id: fresh[0].id } : null),
      );
      const warnings: string[] = [];
      let videoNote = "";
      if (video)
        try {
          const sent = await announceApi.uploadVideo(result.id, video);
          videoNote = videoSentMessage("anúncio", sent.cortado);
        } catch (reason) {
          warnings.push(`Vídeo: ${message(reason)}`);
        }
      if (report)
        try {
          await announceApi.uploadReport(result.id, report);
        } catch (reason) {
          warnings.push(`Laudo: ${message(reason)}`);
        }
      return { id: result.id, warning: warnings.join(" "), videoNote };
    },
    onSuccess: ({ id, warning: resultWarning, videoNote }) => {
      if (session.status === "authenticated") discardDraft(session.user.usuarioId);
      setCreated(id);
      setWarning(resultWarning);
      setCreatedVideoNote(videoNote);
      setError("");
    },
    onError: (reason) => setError(message(reason)),
  });

  function update(key: string, value: string) {
    setError("");
    setValues((current) => ({
      ...current,
      [key]: value,
      ...(key === "contatoNaoDivulgar" && value === "true"
        ? { contatoWhatsapp: "false", contatoLigacao: "false" }
        : {}),
      ...((key === "contatoWhatsapp" || key === "contatoLigacao") &&
      value === "true"
        ? { contatoNaoDivulgar: "false" }
        : {}),
    }));
    // A condição é tratada por useFipeConditionSync. O ano só desvincula a cotação de usado (a de zero km não tem ano).
    if (
      ["fabricante", "modelo", "tipoVeiculo"].includes(key) ||
      (key === "anoModelo" &&
        reference &&
        !reference.zeroKm &&
        value !== String(reference.anoModelo))
    ) {
      setReference(null);
      setFipeNotice("");
    }
    if (
      ["fabricante", "modelo", "versao", "anoModelo", "tipoVeiculo"].includes(
        key,
      )
    )
      setExisting([]);
    if (key === "tipoVeiculo" || key === "fabricante") {
      setValues((current) => ({
        ...current,
        [key]: value,
        fabricante: key === "tipoVeiculo" ? "" : value,
        modelo: "",
        versao: "",
        anoModelo: "",
      }));
    }
  }
  /** Preenche o formulário com o que a placa trouxe; a FIPE vinculada pelo código entra como se escolhida na lista. */
  function applyPlateSuggestion(suggestion: PlateSuggestion) {
    const nextTipo =
      suggestion.tipoVeiculo && plateVehicleTypes.includes(suggestion.tipoVeiculo)
        ? suggestion.tipoVeiculo
        : tipo;
    const filled = plateSuggestionValues(suggestion, nextTipo);
    const fipe = suggestion.fipe;
    setError("");
    setExisting([]);
    setReference(fipe);
    setFipeNotice("");
    setValues((current) => {
      const base =
        current.tipoVeiculo === nextTipo
          ? current
          : { ...current, tipoVeiculo: nextTipo, fabricante: "", modelo: "", versao: "", anoModelo: "" };
      return {
        ...base,
        ...filled,
        // Veículo com placa não é zero km.
        condicao: base.condicao && base.condicao !== "ZERO_KM" ? base.condicao : "USADO",
        ...(fipe
          ? {
              fabricante: fipe.marca,
              modelo: fipe.modelo,
              versao: fipe.modelo,
              anoModelo: String(fipe.anoModelo),
              [`${nextTipo}.combustivel`]: fipe.combustivel,
            }
          : {}),
      };
    });
    setPlateApplied(suggestion);
    setPlateFilledKeys(Object.keys(filled).filter((key) => !key.endsWith(".placa")));
  }
  /** Desfaz o preenchimento pela placa (mantém a placa) para a pessoa preencher tudo à mão. */
  function clearPlateSuggestion() {
    setValues((current) => ({
      ...current,
      ...Object.fromEntries(plateFilledKeys.map((key) => [key, ""])),
    }));
    setReference(null);
    setFipeNotice("");
    setPlateApplied(null);
    setPlateFilledKeys([]);
  }
  function choice(key: string, options: { value: string; label: string }[]) {
    return (
      <ChoiceRow
        value={values[key]}
        options={options}
        onChange={(value) => update(key, value)}
      />
    );
  }
  const fipeStatus = syncingFipe ? (
    <Notice message="Buscando a cotação FIPE para a condição escolhida…" />
  ) : fipeNotice ? (
    <Notice message={fipeNotice} />
  ) : null;
  function field(item: Field, prefix = "", style?: StyleProp<ViewStyle>) {
    const key = `${prefix}${item.key}`;
    return (
      <View key={key} ref={anchor(key)} style={style}>
        <AdField
          item={item}
          prefix={prefix}
          values={values}
          suggestions={suggestionsFor(
            catalog.data,
            tipo,
            values.fabricante,
            item.key,
          )}
          onChange={update}
          inline={item.kind === "boolean"}
          {...fieldProps(key)}
        />
      </View>
    );
  }
  function editLotUnit(index: number, patch: Partial<LotUnit>) {
    setError("");
    setLotUnits((current) =>
      current.map((row, i) => (i === index ? { ...row, ...patch } : row)),
    );
  }
  function editMotor(index: number, key: string, value: string) {
    setError("");
    setMotors((current) =>
      current.map((row, i) => (i === index ? { ...row, [key]: value } : row)),
    );
  }
  async function lookupCep() {
    setCepBusy(true);
    setError("");
    try {
      const result = await findAddressByCep(values["endereco.cep"] || "");
      setValues((current) => ({
        ...current,
        "endereco.uf": result.uf,
        "endereco.cidade": result.localidade,
        "endereco.bairro": result.bairro,
        "endereco.rua": result.logradouro,
        "endereco.complemento": result.complemento,
      }));
    } catch (reason) {
      setError(message(reason));
    } finally {
      setCepBusy(false);
    }
  }
  async function preparePhotos(assets: ImagePicker.ImagePickerAsset[]) {
    try {
      const prepared = await Promise.all(
        assets.slice(0, 8 - photos.length).map(async (asset, i) => ({
          file: await preparePhoto(asset, `veiculo-${photos.length + i + 1}.jpg`),
          alt: "",
        })),
      );
      setPhotos((current) => [...current, ...prepared].slice(0, 8));
    } catch (reason) {
      setError(`Não foi possível preparar as fotos. ${message(reason)}`);
    }
  }
  async function addPhotos() {
    setError("");
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      allowsMultipleSelection: true,
      selectionLimit: 8 - photos.length,
      exif: false,
      quality: 1,
    });
    if (!result.canceled) await preparePhotos(result.assets);
  }
  async function takePhoto() {
    setError("");
    if (!(await ensureCameraPermission("fotografar o veículo"))) return;
    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ["images"],
      exif: false,
      quality: 1,
    });
    if (!result.canceled) await preparePhotos(result.assets);
  }
  function movePhoto(index: number, direction: number) {
    setPhotos((current) => {
      const next = [...current];
      [next[index], next[index + direction]] = [
        next[index + direction],
        next[index],
      ];
      return next;
    });
  }
  async function addVideo() {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["videos"],
      quality: 1,
    });
    if (result.canceled) return;
    const asset = result.assets[0];
    if (
      asset.fileSize != null &&
      rules.data &&
      asset.fileSize > rules.data.tamanhoMaximoEnvioVideoBytes
    ) {
      setError("O vídeo é maior que o limite de envio. Grave um trecho menor.");
      return;
    }
    // Vídeo longo não é recusado: o servidor guarda só os primeiros segundos.
    setVideoNotice(
      videoTrimNotice(asset.duration, rules.data?.duracaoMaximaVideoSegundos),
    );
    setVideo({
      uri: asset.uri,
      name: asset.fileName || "veiculo.mp4",
      type: asset.mimeType || "video/mp4",
    });
    setError("");
  }
  async function addReport(unitIndex?: number) {
    const result = await DocumentPicker.getDocumentAsync({
      type: [
        "application/pdf",
        "application/msword",
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        "image/jpeg",
        "image/png",
        "video/mp4",
      ],
      copyToCacheDirectory: true,
    });
    if (result.canceled) return;
    const asset = result.assets[0];
    if (
      rules.data &&
      asset.size &&
      asset.size > rules.data.tamanhoMaximoLaudoBytes
    ) {
      setError("O laudo é maior que o limite de envio.");
      return;
    }
    const extension = asset.name
      .slice(asset.name.lastIndexOf(".") + 1)
      .toUpperCase();
    if (
      rules.data &&
      !rules.data.formatosLaudo.includes(
        extension === "JPEG" ? "JPG" : extension,
      )
    ) {
      setError(
        `Formato não aceito. Envie ${rules.data.formatosLaudo.join(", ")}.`,
      );
      return;
    }
    const file = {
      uri: asset.uri,
      name: asset.name,
      type: asset.mimeType || "application/pdf",
    };
    if (unitIndex === undefined) setReport(file);
    else
      setLotUnits((current) =>
        current.map((unit, index) =>
          index === unitIndex ? { ...unit, laudo: file } : unit,
        ),
      );
    setError("");
  }
  /** Regras de formato de uma etapa, campo a campo. As regras de negócio ficam no backend. */
  function validate(current: number): StageCheck {
    const check = emptyCheck();
    const fail = (key: string, name: string, text: string, missing = false) => {
      if (check.fields[key]) return;
      check.fields[key] = text;
      check.names[key] = name;
      if (missing) check.missing.add(key);
    };
    /** Confere obrigatório, número e tamanho. Devolve true quando o campo está preenchido e válido. */
    const checkField = (
      item: Field,
      prefix = "",
      raw = values[`${prefix}${item.key}`] || "",
      key = `${prefix}${item.key}`,
      name = shortName(item.label),
    ) => {
      if (!raw.trim()) {
        if (item.required)
          fail(
            key,
            name,
            item.kind === "boolean" ? "Escolha Sim ou Não." : "Preencha este campo.",
            true,
          );
        return false;
      }
      if (
        item.kind === "number" &&
        (!/^\d+(?:[,.]\d+)?$/.test(raw) ||
          Number(raw.replace(",", ".")) <
            (["quilometragem", "horimetro", "horasUso"].includes(item.key)
              ? 0
              : 1))
      ) {
        fail(key, name, "Informe um número válido.");
        return false;
      }
      if (item.maxLength && raw.length > item.maxLength) {
        fail(
          key,
          name,
          `Use até ${item.maxLength.toLocaleString("pt-BR")} caracteres.`,
        );
        return false;
      }
      return true;
    };
    const nextYear = new Date().getFullYear() + 1;
    if (current === 0 && plateItem) {
      if (checkField(plateItem, `${tipo}.`) && !platePattern.test(values[`${tipo}.placa`]))
        fail(`${tipo}.placa`, "placa", "Use o padrão ABC1D23.");
    }
    if (current === 1) {
      if (manualVehicle) {
        checkField(brandField);
        checkField(modelField);
        if (checkField(modelYearField)) {
          const model = Number(values.anoModelo);
          if (model < 1900 || model > nextYear)
            fail("anoModelo", "ano do modelo", `Use um ano entre 1900 e ${nextYear}.`);
        }
      } else if (edition.data) {
        if (!values.fabricante?.trim() || !values.modelo?.trim())
          check.general.push("Escolha a marca e o modelo.");
        else if (!reference)
          check.general.push("Confirme a consulta FIPE para continuar.");
      }
    }
    if (current === 2) {
      const fabricationOk = checkField(fabricationYearField);
      const modelOk = modelYearInMain
        ? checkField(modelYearField)
        : /^\d+$/.test(values.anoModelo || "");
      const fabrication = Number(values.anoFabricacao),
        model = Number(values.anoModelo);
      if (fabricationOk && fabrication < 1900)
        fail("anoFabricacao", "ano de fabricação", "Use um ano a partir de 1900.");
      if (modelOk && modelYearInMain && (model < 1900 || model > nextYear))
        fail("anoModelo", "ano do modelo", `Use um ano entre 1900 e ${nextYear}.`);
      if (fabricationOk && modelOk && (model < fabrication || model > fabrication + 1))
        fail(
          "anoFabricacao",
          "ano de fabricação",
          model >= 1900
            ? `Para modelo ${model}, use ${model - 1} ou ${model}.`
            : "Confira os anos de fabricação e modelo.",
        );
      // O ano do modelo veio da etapa 1 ou da FIPE; se estiver fora do padrão, avisa aqui como antes.
      if (fabricationOk && !modelYearInMain && (!modelOk || model > nextYear))
        fail(
          "anoFabricacao",
          "ano de fabricação",
          "Confira os anos de fabricação e modelo.",
        );
      checkField(colorField);
      for (const item of requiredMain) {
        const ok = checkField(item, `${tipo}.`);
        if (
          ok &&
          item.key === "motorizacao" &&
          ["CARRO", "CAMINHONETE"].includes(tipo) &&
          !electric &&
          !/^[0-9]{1,2}[.,][0-9]{1,2}$/.test(values[`${tipo}.motorizacao`])
        )
          fail(
            `${tipo}.motorizacao`,
            "motorização",
            "Use litros, como 1.0 ou 2.0.",
          );
      }
    }
    if (current === 3) {
      checkField(auctionField);
      checkField(accidentField);
      for (const item of requiredDocuments) {
        const ok = checkField(item, `${tipo}.`);
        if (
          ok &&
          item.key === "placa" &&
          !zeroKm &&
          !platePattern.test(values[`${tipo}.placa`])
        )
          fail(`${tipo}.placa`, "placa", "Use o padrão ABC1D23.");
      }
    }
    if (current === 4) {
      for (const item of addressFields.filter((item) => item.required)) {
        const ok = checkField(item, "endereco.");
        const raw = values[`endereco.${item.key}`] || "";
        if (ok && item.key === "cep" && raw.replace(/\D/g, "").length !== 8)
          fail("endereco.cep", "CEP", "Informe os 8 números do CEP.");
        if (ok && item.key === "uf" && !/^[A-Za-z]{2}$/.test(raw))
          fail("endereco.uf", "estado", "Use a sigla com 2 letras, como SP.");
      }
    }
    if (current === 5 && photos.length === 0)
      check.general.push("Adicione pelo menos uma foto do veículo.");
    if (current === 6) {
      checkField(titleField);
      if (
        values.tipoPreco === "FIXO" &&
        checkField(priceField) &&
        !(Number(values.precoReais.replace(/\./g, "").replace(",", ".")) > 0)
      )
        fail("precoReais", "preço", "Informe um preço maior que zero.");
      if (
        values.contatoNaoDivulgar !== "true" &&
        values.contatoWhatsapp !== "true" &&
        values.contatoLigacao !== "true"
      )
        check.general.push("Escolha pelo menos um meio de contato.");
      if (asLot) {
        if (lotUnits.length + existing.length > 50)
          check.general.push("O lote aceita no máximo 50 carros.");
        const plates = new Set<string>();
        for (const [index, unit] of lotUnits.entries()) {
          const car = `carro ${index + 1}`;
          const key = `lote.${unit.key}`;
          if (!unit.cor.trim()) fail(`${key}.cor`, `cor do ${car}`, "Preencha este campo.", true);
          if (zeroKm) continue;
          const plate = unit.placa.trim().toUpperCase();
          if (!plate) fail(`${key}.placa`, `placa do ${car}`, "Preencha este campo.", true);
          else if (!platePattern.test(plate))
            fail(`${key}.placa`, `placa do ${car}`, "Use o padrão ABC1D23.");
          else if (plates.has(plate))
            fail(`${key}.placa`, `placa do ${car}`, "Placa repetida em outro carro do lote.");
          plates.add(plate);
          if (!unit.quilometragem)
            fail(`${key}.quilometragem`, `quilometragem do ${car}`, "Preencha este campo.", true);
          else if (!/^\d+$/.test(unit.quilometragem))
            fail(`${key}.quilometragem`, `quilometragem do ${car}`, "Informe um número válido.");
        }
      }
    }
    if (current === 7) {
      for (const item of optionalTechnical) checkField(item, `${tipo}.`);
      checkField(descriptionField);
      if (tipo === "BARCO")
        for (const [index, motor] of motors.entries())
          for (const item of motorFields)
            checkField(
              item,
              "",
              motor[item.key] || "",
              `motor.${index}.${item.key}`,
              `${shortName(item.label)} do motor ${index + 1}`,
            );
    }
    if (current === 8 && asLot && lotUnits.length + existing.length < 2)
      check.general.push("O lote precisa ter ao menos 2 carros.");
    return check;
  }
  // Recalculadas a cada mudança: trocar a condição ou o tipo muda o que cada etapa exige.
  const checks = stages.map((_, index) => validate(index));
  const pendingStages = checks.map(
    (check, index) =>
      index <= furthest &&
      (revealed.has(index)
        ? errorCount(check) > 0
        : Object.keys(check.fields).some(
            (key) => !check.missing.has(key) && touched.has(key),
          )),
  );
  const pendingNames = stages.filter((_, index) => pendingStages[index]);
  /** Erro visível de um campo: vazio só numa etapa revelada; formato depois de sair do campo. */
  function shownError(key: string) {
    // As páginas vizinhas também ficam montadas, então o erro é procurado na etapa dona do campo.
    const index = checks.findIndex((check) => key in check.fields);
    if (index < 0) return undefined;
    const check = checks[index];
    if (revealed.has(index)) return check.fields[key];
    return !check.missing.has(key) && touched.has(key)
      ? check.fields[key]
      : undefined;
  }
  /** Erro, foco e saída de um campo, para AdField e TextField. */
  function fieldProps(key: string) {
    return {
      error: shownError(key),
      // Ao voltar a um campo sem erro, um novo erro só aparece quando ele perder o foco de novo.
      onFocus: () => {
        if (!checks.some((check) => key in check.fields))
          setTouched((current) => {
            if (!current.has(key)) return current;
            const next = new Set(current);
            next.delete(key);
            return next;
          });
      },
      onBlur: () =>
        setTouched((current) =>
          current.has(key) ? current : new Set(current).add(key),
        ),
    };
  }
  /** Guarda a View de cada campo para rolar até ele. */
  function anchor(key: string) {
    return (node: ViewInstance | null) => {
      if (!node) return;
      anchors.current.set(key, node);
      return () => {
        anchors.current.delete(key);
      };
    };
  }
  function scrollToField(key: string | null) {
    scrollTarget.current = key;
    setScrollRequest((current) => current + 1);
  }
  // A posição é medida depois que a etapa de destino foi montada, relativa ao conteúdo da rolagem.
  useLayoutEffect(() => {
    const key = scrollTarget.current;
    if (key === undefined) return;
    scrollTarget.current = undefined;
    const node = key ? anchors.current.get(key) : undefined;
    const scroll = pageScrolls.current.get(stage);
    const content = scroll?.getInnerViewRef();
    if (node && content)
      node.measureLayout(content, (_x, y) =>
        scroll?.scrollTo({
          y: Math.max(0, y - space.lg),
          animated: !reduceMotion,
        }),
      );
    else scroll?.scrollTo({ y: 0, animated: !reduceMotion });
    // Só um novo pedido de rolagem dispara de novo; a etapa é lida no mesmo commit.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scrollRequest, reduceMotion]);
  function reveal(indexes: number[]) {
    setRevealed((current) =>
      indexes.every((index) => current.has(index))
        ? current
        : new Set([...current, ...indexes]),
    );
  }
  /** Mostra o resumo no rodapé. O VoiceOver não lê live regions, então no iPhone o resumo é anunciado. */
  function showSummary(text: string) {
    setError(text);
    if (Platform.OS === "ios") AccessibilityInfo.announceForAccessibility(text);
  }
  function waitMessage() {
    if (fipeType && edition.isPending) return "Aguarde a tabela FIPE carregar.";
    if (syncingFipe) return "Aguarde a atualização da referência FIPE.";
    return "";
  }
  function advance() {
    Keyboard.dismiss();
    const last = stages.length - 1;
    if (stage === 1 || stage === last) {
      const wait = waitMessage();
      if (wait) {
        setError(wait);
        return;
      }
    }
    if (stage < lockedStages && errorCount(checks[stage])) {
      reveal([stage]);
      showSummary(summarize(checks[stage]));
      const first = Object.keys(checks[stage].fields)[0];
      if (first) scrollToField(first);
      return;
    }
    setError("");
    if (stage < last) {
      // Da etapa 2 em diante avança mesmo incompleta; o que falta fica marcado na barra.
      reveal([stage]);
      goTo(stage + 1);
      return;
    }
    const target = checks.findIndex((check) => errorCount(check) > 0);
    if (target < 0) {
      create.mutate();
      return;
    }
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    reveal(stages.map((_, index) => index));
    goTo(target);
    showSummary(summarize(checks[target]));
    scrollToField(Object.keys(checks[target].fields)[0] ?? null);
  }
  // Lida ao fim de cada transição, quando o commit da troca de etapa já aconteceu.
  const stageRef = useRef(stage);
  useEffect(() => {
    stageRef.current = stage;
  }, [stage]);
  /** Ao fim da transição, as páginas fora da tela voltam ao topo: a próxima etapa sempre chega pelo começo. */
  function resetHiddenPages() {
    for (const [index, scroll] of pageScrolls.current)
      if (index !== stageRef.current) scroll.scrollTo({ y: 0, animated: false });
  }
  /** Troca de etapa pelos botões: desliza para a vizinha; um salto maior entra com um esmaecer curto. */
  function goTo(target: number) {
    Keyboard.dismiss();
    if (Math.abs(target - stage) > 1) {
      // As etapas do meio não estão montadas: em vez de atravessá-las, a página nova surge no lugar.
      jumpFrom.current = stage;
      pagerFade.set(0);
    } else
      position.set(
        withTiming(
          target,
          {
            duration: 300,
            easing: motion.easeInOut,
            reduceMotion: ReduceMotion.System,
          },
          (finished) => {
            if (finished) scheduleOnRN(resetHiddenPages);
          },
        ),
      );
    setStage(target);
    setFurthest((current) => Math.max(current, target));
  }
  useLayoutEffect(() => {
    const from = jumpFrom.current;
    if (from === undefined) return;
    jumpFrom.current = undefined;
    const direction = stage > from ? 1 : -1;
    position.set(stage - direction * 0.15);
    position.set(
      withTiming(stage, {
        duration: 300,
        easing: motion.easeOut,
        reduceMotion: ReduceMotion.System,
      }),
    );
    pagerFade.set(
      withTiming(
        1,
        {
          duration: 200,
          easing: motion.easeOut,
          reduceMotion: ReduceMotion.System,
        },
        (finished) => {
          if (finished) scheduleOnRN(resetHiddenPages);
        },
      ),
    );
  }, [stage, position, pagerFade]);
  /** O arraste já levou a página até o destino; aqui só se registra a troca. */
  function onSwiped(from: number, to: number) {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    if (swipeLearned === false) {
      setSwipeLearned(true);
      secureStorage.set(swipeLearnedKey, "1").catch(() => undefined);
    }
    Keyboard.dismiss();
    setError("");
    if (to > from) reveal([from]);
    setStage(to);
    setFurthest((current) => Math.max(current, to));
  }
  // Enquanto o gesto não foi aprendido, a página espia a próxima etapa uma vez ao abrir o formulário:
  // mostra que existe outra página ao lado e volta com mola. Com "reduzir movimento", fica só a dica em texto.
  const showPeek = reviewed && !created && swipeLearned === false && !reduceMotion;
  useEffect(() => {
    if (!showPeek) return;
    const timer = setTimeout(() => {
      const from = stageRef.current;
      if (from >= lastStage) return;
      position.set(
        withSequence(
          withTiming(from + 0.14, { duration: 420, easing: motion.easeInOut }),
          withSpring(from, { duration: 500, dampingRatio: 0.7 }),
        ),
      );
    }, 900);
    return () => clearTimeout(timer);
  }, [showPeek, position]);
  // Nas etapas 0 e 1 incompletas, o arraste para frente cede e volta, e o rodapé diz o que falta.
  const forwardOpen =
    stage < lastStage &&
    !(
      stage < lockedStages &&
      (errorCount(checks[stage]) > 0 || (stage === 1 && waitMessage() !== ""))
    );
  useEffect(() => {
    canForward.set(forwardOpen);
    canBack.set(stage > 0);
  }, [forwardOpen, stage, canForward, canBack]);
  // DIAGNÓSTICO temporário.
  function swipeLog(message: string) {
    console.log(`[deslize] etapa=${stageRef.current} ${message}`);
  }
  const pan = usePanGesture({
    enabled: !create.isPending,
    // Vence o eixo que andar primeiro. Numa página que rola, o ScrollView nativo toma o toque com
    // 8 dp na vertical (touch slop do Android) e cancela este arraste; ativar com os mesmos 8 dp na
    // horizontal faz o deslize lateral, mesmo inclinado, ganhar da rolagem em qualquer ponto da página.
    activeOffsetX: [-8, 8],
    failOffsetY: [-10, 10],
    // DIAGNÓSTICO temporário do arraste em páginas que rolam.
    onBegin: (event) => {
      "worklet";
      scheduleOnRN(swipeLog, `begin x=${Math.round(event.x)} y=${Math.round(event.y)}`);
    },
    onFinalize: (event) => {
      "worklet";
      scheduleOnRN(
        swipeLog,
        `finalize canceled=${event.canceled}`,
      );
    },
    onActivate: (event) => {
      "worklet";
      scheduleOnRN(swipeLog, `activate dx=${Math.round(event.translationX)} dy=${Math.round(event.translationY)}`);
      cancelAnimation(position);
      dragStart.set(position.get());
      dragOrigin.set(event.translationX);
    },
    onUpdate: (event) => {
      "worklet";
      const width = pageWidth.get();
      if (!width) return;
      const base = Math.round(dragStart.get());
      const min = canBack.get() ? base - 1 : base;
      const max = canForward.get() ? base + 1 : base;
      const next =
        dragStart.get() - (event.translationX - dragOrigin.get()) / width;
      position.set(
        next > max
          ? max + resist(next - max)
          : next < min
            ? min - resist(min - next)
            : next,
      );
    },
    onDeactivate: (event) => {
      "worklet";
      const width = pageWidth.get();
      const base = Math.round(dragStart.get());
      const moved = position.get() - base;
      // Velocidade em páginas por segundo: um gesto rápido basta, mesmo curto.
      const velocity = width ? -event.velocityX / width : 0;
      let target = base;
      if (!event.canceled) {
        if (
          canForward.get() &&
          moved > 0 &&
          (velocity > 0.6 || (moved > 0.4 && velocity > -0.6))
        )
          target = base + 1;
        else if (
          canBack.get() &&
          moved < 0 &&
          (velocity < -0.6 || (moved < -0.4 && velocity < 0.6))
        )
          target = base - 1;
      }
      position.set(
        withSpring(
          target,
          target === base
            ? {
                duration: 400,
                dampingRatio: 0.8,
                velocity,
                reduceMotion: ReduceMotion.System,
              }
            : {
                duration: 380,
                dampingRatio: 1,
                velocity,
                reduceMotion: ReduceMotion.System,
              },
          (finished) => {
            "worklet";
            if (finished) scheduleOnRN(resetHiddenPages);
          },
        ),
      );
      if (target !== base) scheduleOnRN(onSwiped, base, target);
      else if (!canForward.get() && moved > 0.08 && base < lastStage)
        scheduleOnRN(advance);
    },
  });
  function pageScroll(index: number) {
    return (node: ScrollViewInstance | null) => {
      if (!node) return;
      pageScrolls.current.set(index, node);
      return () => {
        pageScrolls.current.delete(index);
      };
    };
  }
  /** Corpo de uma etapa. As páginas vizinhas também são montadas, então nada aqui depende de `stage`. */
  function stageBody(index: number) {
    return (
      <>
        {index === 0 ? (
          <View style={styles.section}>
            {plateItem ? (
              <PlatePrefillCard
                plateField={
                  <View ref={anchor(`${tipo}.placa`)}>
                    <PlateField
                      value={values[`${tipo}.placa`] || ""}
                      onChangeText={(value) => update(`${tipo}.placa`, value)}
                      {...fieldProps(`${tipo}.placa`)}
                    />
                  </View>
                }
                plate={values[`${tipo}.placa`] || ""}
                applied={plateApplied}
                onSuggestion={applyPlateSuggestion}
                onClear={clearPlateSuggestion}
                onManual={advance}
              />
            ) : null}
            <AppText variant="heading">O que você vai anunciar?</AppText>
            {profile.isError ? (
              <Notice
                tone="error"
                message="Não foi possível carregar os dados da sua conta."
                actionLabel="Tentar de novo"
                actionLoading={profile.isFetching}
                onAction={() => profile.refetch()}
              />
            ) : null}
            {choice("tipoVeiculo", vehicleTypes)}
            {profile.data?.tipoPessoa === "PJ" && tipo === "CARRO" ? (
              <View style={styles.section}>
                <AppText variant="heading">Quantidade</AppText>
                <View style={styles.choices}>
                  {[
                    { lot: false, label: "Um veículo" },
                    { lot: true, label: "Lote de carros" },
                  ].map((item) => {
                    const selected = lotMode === item.lot;
                    return (
                      <Pressable
                        key={item.label}
                        accessibilityRole="radio"
                        accessibilityState={{ selected }}
                        accessibilityLabel={item.label}
                        onPress={() => {
                          setLotMode(item.lot);
                          if (item.lot) update("tipoPreco", "FIXO");
                        }}
                        style={[
                          styles.chip,
                          {
                            borderColor: selected ? colors.red : colors.border,
                            backgroundColor: selected
                              ? colors.redTint
                              : colors.surface,
                          },
                        ]}
                      >
                        <AppText
                          variant="label"
                          color={selected ? "red" : "text"}
                        >
                          {item.label}
                        </AppText>
                      </Pressable>
                    );
                  })}
                </View>
              </View>
            ) : null}
            <AppText variant="heading">Condição</AppText>
            {choice("condicao", [
              { value: "ZERO_KM", label: "Zero km" },
              { value: "USADO", label: "Seminovo" },
              { value: "REPASSE", label: "Repasse" },
            ])}
            <AppText color="muted">
              Você pode voltar e mudar estas escolhas durante o preenchimento.
            </AppText>
            {fipeStatus}
          </View>
        ) : null}
        {index === 1 ? (
          <View style={styles.section}>
            {fipeStatus}
            {fipeType && edition.data ? (
              <FipeSelector
                key={tipo}
                linkOnly
                tipo={fipeType}
                zeroKm={values.condicao === "ZERO_KM"}
                reference={reference}
                onBrand={(name) => update("fabricante", name)}
                onYear={(yearValue) => {
                  // FIPE: marca → ano → modelo; trocar o ano invalida o modelo escolhido.
                  update("anoModelo", yearValue);
                  setValues((current) => ({
                    ...current,
                    modelo: "",
                    versao: "",
                  }));
                }}
                onClear={() => {
                  setReference(null);
                  setFipeNotice("");
                }}
                onResolved={(result) => {
                  setReference(result);
                  setFipeNotice("");
                  setExisting([]);
                  setValues((current) => ({
                    ...current,
                    fabricante: result.marca,
                    modelo: result.modelo,
                    versao: result.modelo,
                    anoModelo:
                      values.condicao === "ZERO_KM"
                        ? current.anoModelo
                        : String(result.anoModelo),
                    [`${tipo}.combustivel`]: result.combustivel,
                  }));
                }}
              />
            ) : fipeType && edition.isPending ? (
              <ActivityIndicator color={colors.red} />
            ) : (
              <View style={styles.section}>
                {edition.isError && fipeType ? (
                  <Notice
                    title="Tabela FIPE indisponível"
                    message="Preencha marca, modelo e ano manualmente ou tente carregar a FIPE de novo."
                    actionLabel="Tentar de novo"
                    actionLoading={edition.isFetching}
                    onAction={() => edition.refetch()}
                  />
                ) : null}
                {field(brandField)}
                {field(modelField)}
                {field(modelYearField)}
              </View>
            )}
          </View>
        ) : null}
        {index === 2 ? (
          <View style={styles.section}>
            <AppText color="muted">
              Só os dados necessários para identificar o veículo.
            </AppText>
            {catalog.isError ? (
              <Notice
                tone="error"
                message="As sugestões de cor, câmbio e combustível não carregaram. Você pode digitar os dados."
                actionLabel="Tentar de novo"
                actionLoading={catalog.isFetching}
                onAction={() => catalog.refetch()}
              />
            ) : null}
            {field(fabricationYearField)}
            {modelYearInMain ? field(modelYearField) : null}
            {field(colorField)}
            {requiredMain.map((item) => field(item, `${tipo}.`))}
          </View>
        ) : null}
        {index === 3 ? (
          <View style={styles.section}>
            <AppText color="muted">Histórico e documentos do veículo.</AppText>
            {field(auctionField)}
            {field(accidentField)}
            {requiredDocuments.map((item) => field(item, `${tipo}.`))}
          </View>
        ) : null}
        {index === 4 ? (
          <View style={styles.section}>
            <AppText color="muted">
              Informe onde o veículo está disponível.
            </AppText>
            {profile.data?.endereco ? (
              <Button
                label="Usar endereço da conta"
                variant="secondary"
                onPress={() =>
                  setValues((current) => ({
                    ...current,
                    ...Object.fromEntries(
                      Object.entries(profile.data!.endereco!).map(
                        ([key, value]) => [`endereco.${key}`, value || ""],
                      ),
                    ),
                  }))
                }
              />
            ) : null}
            {field(addressFields[0], "endereco.")}
            <Button
              label="Buscar endereço pelo CEP"
              variant="secondary"
              loading={cepBusy}
              onPress={lookupCep}
            />
            {/* Estado e cidade lado a lado, como num endereço; com fonte grande, quebram em duas linhas. */}
            <View style={styles.row}>
              {addressFields
                .filter((item) => item.key === "uf" || item.key === "cidade")
                .map((item) =>
                  field(
                    item,
                    "endereco.",
                    item.key === "uf" ? styles.stateField : styles.cityField,
                  ),
                )}
            </View>
            {addressFields
              .filter(
                (item) =>
                  item.required && !["cep", "uf", "cidade"].includes(item.key),
              )
              .map((item) => field(item, "endereco."))}
          </View>
        ) : null}
        {index === 5 ? (
          <View style={styles.section}>
            <AppText variant="heading">Fotos ({photos.length}/8)</AppText>
            <AppText color="muted">
              A primeira foto será a capa. Use imagens nítidas do veículo.
            </AppText>
            <Button
              label="Escolher fotos"
              variant="secondary"
              disabled={photos.length >= 8}
              onPress={addPhotos}
            />
            <Button
              label="Tirar foto"
              variant="secondary"
              disabled={photos.length >= 8}
              onPress={takePhoto}
            />
            {photos.map((photo, i) => (
              <View key={photo.file.uri} style={styles.photo}>
                <Image
                  source={{ uri: photo.file.uri }}
                  style={styles.thumbnail}
                />
                <View style={{ flex: 1, gap: space.sm }}>
                  <AppText variant="label">
                    Foto {i + 1}
                    {i === 0 ? " · Capa" : ""}
                  </AppText>
                  {i > 0 ? (
                    <Button
                      label={`Usar foto ${i + 1} como capa`}
                      variant="ghost"
                      onPress={() => movePhoto(i, -i)}
                    />
                  ) : null}
                  <Button
                    label={`Remover foto ${i + 1}`}
                    variant="ghost"
                    onPress={() =>
                      setPhotos((current) =>
                        current.filter((_, index) => index !== i),
                      )
                    }
                  />
                </View>
              </View>
            ))}
          </View>
        ) : null}
        {index === 6 ? (
          <View style={styles.section}>
            {field(titleField)}
            <AppText variant="label">Preço</AppText>
            {asLot ? (
              <AppText color="muted">
                O preço vale para cada carro do lote.
              </AppText>
            ) : (
              choice("tipoPreco", [
                { value: "FIXO", label: "Preço definido" },
                { value: "SOB_CONSULTA", label: "Sob consulta" },
              ])
            )}
            {values.tipoPreco === "FIXO" ? field(priceField) : null}
            <AppText variant="heading">
              Como compradores podem falar com você?
            </AppText>
            {choice("contatoNaoDivulgar", [
              { value: "true", label: "Não divulgar contatos" },
              { value: "false", label: "Divulgar contatos" },
            ])}
            {values.contatoNaoDivulgar === "false" ? (
              <>
                {field({
                  key: "contatoWhatsapp",
                  label: "Permitir WhatsApp?",
                  kind: "boolean",
                })}
                {field({
                  key: "contatoLigacao",
                  label: "Permitir ligação?",
                  kind: "boolean",
                })}
              </>
            ) : null}
            {asLot ? (
              <View style={styles.section}>
                <AppText variant="heading">Carros do lote</AppText>
                {lotUnits.map((unit, i) => (
                  <View
                    key={unit.key}
                    style={[styles.unit, { borderColor: colors.border }]}
                  >
                    <AppText variant="bodyStrong">Carro {i + 1}</AppText>
                    <View ref={anchor(`lote.${unit.key}.cor`)}>
                      <TextField
                        label="Cor"
                        value={unit.cor}
                        onChangeText={(cor) => editLotUnit(i, { cor })}
                        {...fieldProps(`lote.${unit.key}.cor`)}
                      />
                    </View>
                    {values.condicao !== "ZERO_KM" ? (
                      <>
                        <View ref={anchor(`lote.${unit.key}.placa`)}>
                          <TextField
                            label="Placa"
                            value={unit.placa}
                            maxLength={7}
                            autoCapitalize="characters"
                            autoCorrect={false}
                            onChangeText={(typed) =>
                              editLotUnit(i, {
                                placa: cleanMasked("plate", typed),
                              })
                            }
                            {...fieldProps(`lote.${unit.key}.placa`)}
                          />
                        </View>
                        <View ref={anchor(`lote.${unit.key}.quilometragem`)}>
                          <TextField
                            label="Quilometragem"
                            value={displayMasked(
                              "thousands",
                              unit.quilometragem,
                            )}
                            keyboardType="number-pad"
                            maxLength={maskInput.thousands.maxLength}
                            onChangeText={(typed) =>
                              editLotUnit(i, {
                                quilometragem: cleanMasked("thousands", typed),
                              })
                            }
                            {...fieldProps(`lote.${unit.key}.quilometragem`)}
                          />
                        </View>
                      </>
                    ) : null}
                    <Button
                      label={`Remover carro ${i + 1}`}
                      variant="ghost"
                      onPress={() =>
                        setLotUnits((current) =>
                          current.filter((_, index) => index !== i),
                        )
                      }
                    />
                  </View>
                ))}
                <Button
                  label="Adicionar carro"
                  variant="secondary"
                  disabled={lotUnits.length + existing.length >= 50}
                  onPress={() =>
                    setLotUnits((current) => [...current, newLotUnit()])
                  }
                />
              </View>
            ) : null}
          </View>
        ) : null}
        {index === 7 ? (
          <View style={styles.section}>
            <AppText color="muted">
              Estes dados ajudam a detalhar o anúncio. Você pode continuar sem
              preenchê-los.
            </AppText>
            {qualityTips(false)}
            {field({ key: "versao", label: "Versão", maxLength: 250 })}
            {field({
              key: "identificadorPublico",
              label: "Referência pública",
              maxLength: 80,
            })}
            {field({ key: "tipoFreio", label: "Tipo de freio", maxLength: 60 })}
            {optionalTechnical.map((item) => field(item, `${tipo}.`))}
            {addressFields
              .filter((item) => !item.required)
              .map((item) => field(item, "endereco."))}
            {field(descriptionField)}
            {field({
              key: "aceitaTroca",
              label: "Aceita troca?",
              kind: "boolean",
            })}
            {tipo === "BARCO" ? (
              <View style={styles.section}>
                <AppText variant="heading">Motores do barco</AppText>
                {motors.map((motor, i) => (
                  <View
                    key={i}
                    style={[styles.unit, { borderColor: colors.border }]}
                  >
                    <AppText variant="label">Motor {i + 1}</AppText>
                    {motorFields.map((item) => (
                      <View
                        key={item.key}
                        ref={anchor(`motor.${i}.${item.key}`)}
                      >
                        <TextField
                          label={item.label}
                          value={motor[item.key] || ""}
                          keyboardType={
                            item.kind === "number" ? "decimal-pad" : "default"
                          }
                          onChangeText={(value) =>
                            editMotor(i, item.key, value)
                          }
                          {...fieldProps(`motor.${i}.${item.key}`)}
                        />
                      </View>
                    ))}
                    <Button
                      label={`Remover motor ${i + 1}`}
                      variant="ghost"
                      onPress={() =>
                        setMotors((current) =>
                          current.filter((_, index) => index !== i),
                        )
                      }
                    />
                  </View>
                ))}
                <Button
                  label="Adicionar motor"
                  variant="secondary"
                  onPress={() => setMotors((current) => [...current, {}])}
                />
              </View>
            ) : null}
            <AppText variant="heading">Mídia adicional</AppText>
            {rules.isError ? (
              <Notice
                tone="error"
                message="Não foi possível conferir se seu plano libera vídeo e laudo."
                actionLabel="Tentar de novo"
                actionLoading={rules.isFetching}
                onAction={() => rules.refetch()}
              />
            ) : null}
            {rules.data?.liberado ? (
              <>
                <Button
                  label={video ? "Trocar vídeo" : "Adicionar vídeo"}
                  variant="secondary"
                  onPress={addVideo}
                />
                <AppText variant="caption" color="muted">
                  Vídeo de até {rules.data.duracaoMaximaVideoSegundos} s (os
                  mais longos são cortados), comprimido em HD. {plateVideoWarning}
                </AppText>
                {video ? (
                  <>
                    <AppText color="muted">{video.name}</AppText>
                    {videoNotice ? (
                      <AppText variant="caption" color="muted">
                        {videoNotice}
                      </AppText>
                    ) : null}
                    <Button
                      label="Remover vídeo"
                      variant="ghost"
                      onPress={() => {
                        setVideo(null);
                        setVideoNotice("");
                      }}
                    />
                  </>
                ) : null}
                {!asLot ? (
                  <Button
                    label={report ? "Trocar laudo" : "Adicionar laudo"}
                    variant="secondary"
                    onPress={() => addReport()}
                  />
                ) : null}
                {!asLot && report ? (
                  <>
                    <AppText color="muted">{report.name}</AppText>
                    <Button
                      label="Remover laudo"
                      variant="ghost"
                      onPress={() => setReport(null)}
                    />
                  </>
                ) : null}
                {asLot
                  ? lotUnits.map((unit, i) => (
                      <View key={unit.key} style={styles.field}>
                        <Button
                          label={
                            unit.laudo
                              ? `Trocar laudo do carro ${i + 1}`
                              : `Adicionar laudo do carro ${i + 1}`
                          }
                          variant="secondary"
                          onPress={() => addReport(i)}
                        />
                        {unit.laudo ? (
                          <Button
                            label={`Remover laudo do carro ${i + 1}`}
                            variant="ghost"
                            onPress={() =>
                              setLotUnits((current) =>
                                current.map((row, index) =>
                                  index === i ? { ...row, laudo: null } : row,
                                ),
                              )
                            }
                          />
                        ) : null}
                      </View>
                    ))
                  : null}
              </>
            ) : rules.data ? (
              <Notice message="O seu plano atual não inclui vídeo e laudo." />
            ) : null}
            {asLot ? (
              <View style={styles.section}>
                <AppText variant="heading">
                  Anúncios existentes do mesmo modelo
                </AppText>
                {mine.isPending ? (
                  <ActivityIndicator color={colors.red} />
                ) : null}
                {mine.isError ? (
                  <Notice
                    tone="error"
                    message="Não foi possível carregar seus anúncios."
                    actionLabel="Tentar de novo"
                    actionLoading={mine.isFetching}
                    onAction={() => mine.refetch()}
                  />
                ) : null}
                {mine.data
                  ?.filter(
                    (ad) =>
                      ad.tipoVeiculo === "CARRO" &&
                      !ad.loteId &&
                      !["VENDIDO", "RESERVADO"].includes(ad.status) &&
                      ad.fabricante.toLowerCase() ===
                        values.fabricante.toLowerCase() &&
                      ad.modelo.toLowerCase() === values.modelo.toLowerCase() &&
                      (ad.versao || "") === (values.versao || "") &&
                      String(ad.anoModelo || "") === values.anoModelo,
                  )
                  .map((ad) => (
                    <Pressable
                      key={ad.id}
                      accessibilityRole="checkbox"
                      accessibilityState={{ checked: existing.includes(ad.id) }}
                      accessibilityLabel={`Incluir ${ad.titulo}`}
                      onPress={() =>
                        setExisting((current) =>
                          current.includes(ad.id)
                            ? current.filter((id) => id !== ad.id)
                            : [...current, ad.id],
                        )
                      }
                      style={[
                        styles.option,
                        { borderBottomColor: colors.border },
                      ]}
                    >
                      <View
                        style={[
                          styles.checkbox,
                          existing.includes(ad.id)
                            ? {
                                backgroundColor: colors.red,
                                borderColor: colors.red,
                              }
                            : { borderColor: colors.border },
                        ]}
                      >
                        {existing.includes(ad.id) ? (
                          <Check size={16} color={colors.onRed} strokeWidth={3} />
                        ) : null}
                      </View>
                      <AppText style={styles.flex}>{ad.titulo}</AppText>
                    </Pressable>
                  ))}
              </View>
            ) : null}
          </View>
        ) : null}
        {index === 8 ? (
          <View style={styles.section}>
            <AppText color="muted">Confira os dados antes de salvar.</AppText>
            {qualityTips(true)}
            <View
              style={[
                styles.reviewCard,
                { borderColor: colors.border, backgroundColor: colors.surface },
              ]}
            >
              {photos[0] ? (
                <Image
                  source={{ uri: photos[0].file.uri }}
                  style={styles.reviewImage}
                />
              ) : null}
              <View style={styles.reviewBody}>
                <AppText variant="heading">
                  {values.fabricante} {values.modelo}
                </AppText>
                <AppText color="muted">
                  {values.anoFabricacao}/{values.anoModelo} ·{" "}
                  {values["endereco.cidade"]}/{values["endereco.uf"]}
                </AppText>
                <AppText variant="price">
                  {values.tipoPreco === "FIXO"
                    ? new Intl.NumberFormat("pt-BR", {
                        style: "currency",
                        currency: "BRL",
                      }).format(
                        Number(
                          (values.precoReais || "")
                            .replace(/\./g, "")
                            .replace(",", "."),
                        ),
                      )
                    : "Preço sob consulta"}
                </AppText>
                <AppText variant="caption" color="muted">
                  {asLot
                    ? `${lotUnits.length + existing.length} carros no lote`
                    : `${photos.length} foto${photos.length === 1 ? "" : "s"}`}
                </AppText>
              </View>
            </View>
            {quota.isPending ? <ActivityIndicator color={colors.red} /> : null}
            {quota.isError ? (
              <Notice
                tone="error"
                message="Não foi possível conferir as vagas do seu plano."
                actionLabel="Tentar de novo"
                actionLoading={quota.isFetching}
                onAction={() => quota.refetch()}
              />
            ) : null}
            {quota.data && !quota.data.podePublicar ? (
              <Notice
                title="Plano sem vagas livres"
                message="O anúncio será salvo como rascunho. Você publica depois em Meus anúncios."
              />
            ) : null}
            <AppText variant="label">Publicação</AppText>
            {choice(
              "publicarAgora",
              quota.data?.podePublicar === false
                ? [{ value: "false", label: "Salvar rascunho" }]
                : [
                    { value: "true", label: "Publicar agora" },
                    { value: "false", label: "Salvar rascunho" },
                  ],
            )}
          </View>
        ) : null}
      </>
    );
  }
  if (!signedIn)
    return (
      <View
        style={[styles.root, { backgroundColor: colors.bg, padding: space.lg }]}
      >
        <AppText variant="display">Anuncie seu veículo</AppText>
        <AppText color="muted">Entre na sua conta para começar.</AppText>
        <Button
          label="Entrar para anunciar"
          onPress={() => router.push("/entrar")}
        />
      </View>
    );
  if (!reviewed && !created)
    return (
      <AdvertiserReview
        profile={profile.data}
        loading={profile.isPending}
        error={profile.isError ? profile.error.message : null}
        onRetry={() => profile.refetch()}
        onContinue={onReviewContinue ?? (() => setReviewed(true))}
      />
    );
  if (created)
    return (
      <View
        style={[styles.root, styles.success, { backgroundColor: colors.bg }]}
      >
        <AppText variant="display">
          {asLot ? "Lote criado" : "Anúncio criado"}
        </AppText>
        <AppText color="muted">
          {asLot
            ? "Os carros do lote foram salvos na PHC Auto."
            : "Seu veículo foi salvo na PHC Auto."}{" "}
          As fotos passam por uma análise automática, com a placa borrada, e
          aparecem {asLot ? "nos carros" : "no anúncio"} logo depois.
        </AppText>
        {createdVideoNote ? (
          <AppText color="muted">{createdVideoNote}</AppText>
        ) : null}
        {warning ? (
          <Notice
            tone="error"
            title="Algumas mídias não foram enviadas"
            message={`${warning} O anúncio foi salvo sem elas.`}
          />
        ) : null}
        <Button
          label="Meus anúncios"
          onPress={() => router.replace("/meus-anuncios")}
        />
      </View>
    );
  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      style={[styles.root, { backgroundColor: colors.bg }]}
    >
      <View style={styles.header}>
        <View style={styles.headerRow}>
          <AppText variant="overline" color="red" style={styles.flex}>
            ANUNCIAR · {stage + 1} DE {stages.length}
          </AppText>
          {/* Fica sempre à vista: quem pulou a espiada da primeira vez ainda descobre o gesto.
              Quem usa leitor de tela troca de etapa pelos botões; a dica do gesto só confundiria. */}
          <View
            style={styles.swipeHint}
            accessibilityElementsHidden
            importantForAccessibility="no-hide-descendants"
          >
            <ChevronsLeftRight size={16} color={colors.muted} strokeWidth={2.2} />
            <AppText variant="caption" color="muted" style={styles.shrink}>
              Deslize para trocar de etapa
            </AppText>
          </View>
        </View>
        <View
          accessible
          accessibilityRole="progressbar"
          accessibilityLabel={`Etapa ${stage + 1} de ${stages.length}.${
            pendingNames.length ? ` Pendentes: ${pendingNames.join(", ")}.` : ""
          }`}
          style={styles.progressBlock}
        >
          <View style={styles.progress}>
            {stages.map((name, i) => (
              <ProgressSegment
                key={name}
                index={i}
                position={position}
                pending={pendingStages[i]}
              />
            ))}
          </View>
          {pendingNames.length ? (
            <View style={styles.pendingLegend}>
              <View
                style={[styles.legendDot, { backgroundColor: colors.pending }]}
              />
              <AppText variant="caption" color="muted" style={styles.flex}>
                Pendências: {pendingNames.join(", ")}
              </AppText>
            </View>
          ) : null}
        </View>
        {draftStatus?.result === "saved" ? (
          <View style={styles.pendingLegend}>
            <Check size={14} color={colors.muted} strokeWidth={2.4} />
            <AppText variant="caption" color="muted" style={styles.flex}>
              Salvo no aparelho às{" "}
              {new Date(draftStatus.at).toLocaleTimeString("pt-BR", {
                hour: "2-digit",
                minute: "2-digit",
              })}
            </AppText>
          </View>
        ) : draftStatus?.result === "failed" ? (
          <AppText variant="caption" color="red">
            Não foi possível guardar tudo no aparelho. Evite fechar o app até
            criar o anúncio.
          </AppText>
        ) : null}
      </View>
      <View
        style={styles.pager}
        onLayout={(event) => pageWidth.set(event.nativeEvent.layout.width)}
      >
        <GestureDetector gesture={pan}>
          <Animated.View style={[styles.pager, pagerStyle]}>
            {[stage - 1, stage, stage + 1]
              .filter((index) => index >= 0 && index <= lastStage)
              .map((index) => (
                <StagePage
                  key={index}
                  index={index}
                  position={position}
                  width={pageWidth}
                  current={index === stage}
                >
                  <ScrollView
                    ref={pageScroll(index)}
                    // A rolagem espera o arraste horizontal desistir (10 pt na vertical), senão uma
                    // página já rolada prende o toque e não deixa trocar de etapa.
                    requireToFail={pan}
                    keyboardShouldPersistTaps="handled"
                    // DIAGNÓSTICO temporário.
                    onScrollBeginDrag={() => swipeLog(`scroll-drag pagina=${index}`)}
                    onMomentumScrollEnd={() => swipeLog(`scroll-momentum-fim pagina=${index}`)}
                    contentContainerStyle={styles.page}
                  >
                    <AppText variant="display">{stages[index]}</AppText>
                    {revealed.has(index)
                      ? checks[index].general
                          // O mesmo texto já está no rodapé depois de "Continuar" ou "Criar anúncio".
                          .filter((text) => text !== error)
                          .map((text) => (
                            <Notice key={text} tone="error" message={text} />
                          ))
                      : null}
                    {stageBody(index)}
                  </ScrollView>
                </StagePage>
              ))}
          </Animated.View>
        </GestureDetector>
      </View>
      <View
        style={[
          styles.footer,
          {
            borderTopColor: colors.border,
            paddingBottom: insets.bottom + space.md,
          },
        ]}
      >
        {progress !== null ? (
          <View
            style={styles.upload}
            accessible
            accessibilityRole="progressbar"
            accessibilityLabel="Enviando fotos"
            accessibilityValue={{ min: 0, max: 100, now: Math.round(progress * 100) }}
          >
            <AppText variant="label" color="muted">
              {progress < 1
                ? `Enviando fotos · ${Math.round(progress * 100)}%`
                : "Fotos enviadas. Salvando o anúncio…"}
            </AppText>
            <View style={[styles.uploadTrack, { backgroundColor: colors.border }]}>
              <View
                style={[
                  styles.uploadBar,
                  { backgroundColor: colors.red, width: `${Math.round(progress * 100)}%` },
                ]}
              />
            </View>
          </View>
        ) : error ? (
          <Notice tone="error" message={error} />
        ) : null}
        <View style={styles.footerRow}>
          {stage > 0 ? (
            <Button
              label="Voltar"
              variant="secondary"
              disabled={create.isPending}
              style={styles.backButton}
              onPress={() => {
                setError("");
                goTo(stage - 1);
              }}
            />
          ) : null}
          <Button
            label={
              stage === stages.length - 1
                ? "Criar anúncio"
                : stage === 7
                  ? "Conferir"
                  : "Continuar"
            }
            style={styles.nextButton}
            loading={create.isPending}
            onPress={advance}
          />
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}
const styles = StyleSheet.create({
  root: { flex: 1 },
  header: {
    paddingHorizontal: space.lg,
    paddingTop: space.md,
    paddingBottom: space.xs,
    gap: space.sm,
  },
  pager: { flex: 1, overflow: "hidden" },
  headerRow: { flexDirection: "row", alignItems: "center", gap: space.sm },
  swipeHint: { flexDirection: "row", alignItems: "center", gap: space.xs, flexShrink: 1 },
  page: {
    paddingHorizontal: space.lg,
    paddingTop: space.md,
    paddingBottom: space.xl,
    gap: space.lg,
  },
  section: { gap: space.md },
  field: { gap: space.sm },
  progressBlock: { gap: space.sm },
  progress: { flexDirection: "row", gap: space.xs },
  pendingLegend: { flexDirection: "row", alignItems: "center", gap: space.sm },
  legendDot: { width: 8, height: 8, borderRadius: 4 },
  footerRow: { flexDirection: "row", gap: space.sm },
  upload: { gap: space.sm },
  uploadTrack: { height: 4, borderRadius: 2, overflow: "hidden" },
  uploadBar: { height: 4, borderRadius: 2 },
  backButton: { flex: 1 },
  nextButton: { flex: 2 },
  reviewCard: { borderWidth: 1, borderRadius: radius.lg, overflow: "hidden" },
  reviewImage: { width: "100%", aspectRatio: 16 / 9 },
  reviewBody: { padding: space.lg, gap: space.sm },
  footer: {
    paddingHorizontal: space.lg,
    paddingTop: space.md,
    borderTopWidth: StyleSheet.hairlineWidth,
    gap: space.sm,
  },
  choices: { flexDirection: "row", flexWrap: "wrap", gap: space.sm },
  chip: {
    minHeight: touch,
    borderWidth: 1,
    paddingHorizontal: space.md,
    justifyContent: "center",
    borderRadius: radius.pill,
  },
  suggestion: {
    minHeight: touch,
    borderWidth: 1,
    paddingHorizontal: space.md,
    justifyContent: "center",
    borderRadius: radius.md,
  },
  option: {
    minHeight: touch,
    flexDirection: "row",
    alignItems: "center",
    gap: space.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    paddingVertical: space.md,
  },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: radius.sm - 2,
    borderWidth: 2,
    alignItems: "center",
    justifyContent: "center",
  },
  flex: { flex: 1 },
  shrink: { flexShrink: 1 },
  row: { flexDirection: "row", flexWrap: "wrap", gap: space.md },
  stateField: { flexGrow: 1, flexBasis: 88 },
  cityField: { flexGrow: 3, flexBasis: 180 },
  unit: {
    borderWidth: 1,
    borderRadius: radius.md,
    padding: space.md,
    gap: space.md,
  },
  photo: { flexDirection: "row", alignItems: "center", gap: space.md },
  thumbnail: { width: 88, height: 88, borderRadius: radius.md },
  success: { padding: space.lg, justifyContent: "center", gap: space.lg },
  loading: { alignItems: "center", justifyContent: "center" },
});
