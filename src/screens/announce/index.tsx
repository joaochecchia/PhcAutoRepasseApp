import { Image } from "expo-image";
import * as ImagePicker from "expo-image-picker";
import * as DocumentPicker from "expo-document-picker";
import { router } from "expo-router";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useRef, useState } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Keyboard,
  Platform,
  Pressable,
  ScrollView,
  type ScrollViewInstance,
  StyleSheet,
  View,
} from "react-native";
import { Check } from "lucide-react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { findAddressByCep } from "@/api/viacep";
import {
  announceApi,
  type FipeReference,
  type UploadFile,
} from "@/api/announce";
import { isUploadInterrupted } from "@/api/client";
import { myAdsApi } from "@/api/my-ads";
import { AdQualityTips } from "@/components/ad-quality-tips";
import { AppText } from "@/components/app-text";
import { Button } from "@/components/button";
import { Notice } from "@/components/notice";
import { TextField } from "@/components/text-field";
import { useAccount } from "@/hooks/use-account";
import { useSession } from "@/hooks/use-session";
import { useFipeConditionSync } from "@/hooks/use-fipe-condition-sync";
import { cleanMasked, displayMasked, maskInput } from "@/utils/masks";
import { useTheme } from "@/hooks/use-theme";
import { radius, space, touch } from "@/theme";
import { adPayload, type Draft } from "./payload";
import { ChoiceRow } from "@/components/choice-row";
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

export function Announce() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const session = useSession();
  const [stage, setStage] = useState(0);
  const [values, setValues] = useState<Draft>(initial);
  const [motors, setMotors] = useState<Record<string, string>[]>([]);
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [lotMode, setLotMode] = useState(false);
  const [lotUnits, setLotUnits] = useState<LotUnit[]>(() => [
    newLotUnit(),
    newLotUnit(),
  ]);
  const [existing, setExisting] = useState<string[]>([]);
  const [video, setVideo] = useState<UploadFile | null>(null);
  const [videoNotice, setVideoNotice] = useState("");
  const [report, setReport] = useState<UploadFile | null>(null);
  const [error, setError] = useState("");
  const [created, setCreated] = useState<string | null>(null);
  const [warning, setWarning] = useState("");
  const [createdVideoNote, setCreatedVideoNote] = useState("");
  const [reference, setReference] = useState<FipeReference | null>(null);
  const [fipeNotice, setFipeNotice] = useState("");
  const [progress, setProgress] = useState<number | null>(null);
  // Primeiro passo, como no site: conferir os dados do anunciante.
  const [reviewed, setReviewed] = useState(false);
  const scrollRef = useRef<ScrollViewInstance>(null);
  const tipo = values.tipoVeiculo;
  const fipeType = fipeTypes[tipo];
  const signedIn = session.status === "authenticated";
  const profile = useAccount();

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
  const requiredDocuments = technical.filter(
    (item) => item.required && documentKeys.has(item.key),
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
  function field(item: Field, prefix = "") {
    return (
      <AdField
        key={`${prefix}${item.key}`}
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
      />
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
    const permission = await ImagePicker.requestCameraPermissionsAsync();
    if (!permission.granted) {
      setError("Permita o uso da câmera para fotografar o veículo.");
      return;
    }
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
  function validate(current: number): string {
    const checkField = (item: Field, prefix = "") => {
      const raw = values[`${prefix}${item.key}`] || "";
      if (item.required && !raw.trim())
        return `Preencha ${item.label.toLowerCase()}.`;
      if (
        raw &&
        item.kind === "number" &&
        (!/^\d+(?:[,.]\d+)?$/.test(raw) ||
          Number(raw.replace(",", ".")) <
            (["quilometragem", "horimetro", "horasUso"].includes(item.key)
              ? 0
              : 1))
      )
        return `${item.label}: informe um número válido.`;
      if (item.maxLength && raw.length > item.maxLength)
        return `${item.label}: use até ${item.maxLength} caracteres.`;
      return "";
    };
    if (current === 1) {
      if (fipeType && edition.isPending)
        return "Aguarde a tabela FIPE carregar.";
      if (syncingFipe) return "Aguarde a atualização da referência FIPE.";
      if (!values.fabricante?.trim() || !values.modelo?.trim())
        return "Escolha a marca e o modelo.";
      if (fipeType && edition.data && !reference)
        return "Confirme a consulta FIPE para continuar.";
      if ((!fipeType || edition.isError) && !values.anoModelo?.trim())
        return "Informe o ano do modelo.";
    }
    if (current === 2) {
      for (const item of [
        {
          key: "anoFabricacao",
          label: "Ano de fabricação",
          required: true,
          kind: "number",
        } as Field,
        ...(zeroKm
          ? [
              {
                key: "anoModelo",
                label: "Ano do modelo",
                required: true,
                kind: "number",
              } as Field,
            ]
          : []),
        { key: "cor", label: "Cor", required: true } as Field,
      ]) {
        const problem = checkField(item);
        if (problem) return problem;
      }
      const fabrication = Number(values.anoFabricacao),
        model = Number(values.anoModelo);
      if (
        fabrication < 1900 ||
        model < fabrication ||
        model > fabrication + 1 ||
        model > new Date().getFullYear() + 1
      )
        return "Confira os anos de fabricação e modelo.";
      for (const item of requiredMain) {
        const problem = checkField(item, `${tipo}.`);
        if (problem) return problem;
      }
      if (
        ["CARRO", "CAMINHONETE"].includes(tipo) &&
        !electric &&
        values[`${tipo}.motorizacao`] &&
        !/^[0-9]{1,2}[.,][0-9]{1,2}$/.test(values[`${tipo}.motorizacao`])
      )
        return "Motorização: use litros, como 1.0 ou 2.0.";
    }
    if (current === 3) {
      if (!values.historicoLeilao || !values.historicoSinistro)
        return "Informe o histórico de leilão e sinistro.";
      for (const item of requiredDocuments) {
        const problem = checkField(item, `${tipo}.`);
        if (problem) return problem;
      }
      if (
        !zeroKm &&
        requiredDocuments.some((item) => item.key === "placa") &&
        !/^[A-Za-z]{3}[0-9][A-Za-z0-9][0-9]{2}$/.test(
          values[`${tipo}.placa`] || "",
        )
      )
        return "Informe a placa no padrão ABC1D23.";
    }
    if (current === 4) {
      for (const item of addressFields.filter((item) => item.required)) {
        const problem = checkField(item, "endereco.");
        if (problem) return problem;
      }
      if ((values["endereco.cep"] || "").replace(/\D/g, "").length !== 8)
        return "Informe os 8 números do CEP.";
      if (!/^[A-Za-z]{2}$/.test(values["endereco.uf"] || ""))
        return "Informe a sigla do estado com duas letras.";
    }
    if (current === 5 && photos.length === 0)
      return "Adicione pelo menos uma foto do veículo.";
    if (current === 6) {
      if (!values.titulo?.trim() || values.titulo.length > 180)
        return "Informe um título de até 180 caracteres.";
      if (
        values.tipoPreco === "FIXO" &&
        !(Number(values.precoReais?.replace(/\./g, "").replace(",", ".")) > 0)
      )
        return "Informe um preço maior que zero.";
      if (
        values.contatoNaoDivulgar !== "true" &&
        values.contatoWhatsapp !== "true" &&
        values.contatoLigacao !== "true"
      )
        return "Escolha pelo menos um meio de contato.";
      if (asLot) {
        if (lotUnits.length + existing.length > 50)
          return "O lote aceita no máximo 50 carros.";
        const plates = new Set<string>();
        for (const [index, unit] of lotUnits.entries()) {
          if (!unit.cor.trim()) return `Carro ${index + 1}: informe a cor.`;
          if (!zeroKm) {
            const plate = unit.placa.trim().toUpperCase();
            if (
              !/^[A-Z]{3}[0-9][A-Z0-9][0-9]{2}$/.test(plate) ||
              plates.has(plate)
            )
              return `Carro ${index + 1}: confira a placa.`;
            plates.add(plate);
            if (!/^\d+$/.test(unit.quilometragem))
              return `Carro ${index + 1}: informe a quilometragem.`;
          }
        }
      }
    }
    if (current === 8 && asLot && lotUnits.length + existing.length < 2)
      return "O lote precisa ter ao menos 2 carros.";
    if (current === 7) {
      for (const item of optionalTechnical) {
        const problem = checkField(item, `${tipo}.`);
        if (problem) return problem;
      }
      if (values.descricao?.length > 10000)
        return "A descrição deve ter até 10.000 caracteres.";
    }
    return "";
  }
  function advance() {
    Keyboard.dismiss();
    const problem = validate(stage);
    if (problem) {
      setError(problem);
      return;
    }
    setError("");
    if (stage < stages.length - 1) {
      setStage(stage + 1);
      scrollRef.current?.scrollTo({ y: 0, animated: false });
    } else {
      const pending = stages.map((_, index) => validate(index)).find(Boolean);
      if (pending) setError(pending);
      else create.mutate();
    }
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
        onContinue={() => setReviewed(true)}
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
      <ScrollView
        ref={scrollRef}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={[styles.content, { paddingBottom: space.xl }]}
      >
        <AppText variant="overline" color="red">
          ANUNCIAR · {stage + 1} DE {stages.length}
        </AppText>
        <AppText variant="display">{stages[stage]}</AppText>
        <View style={styles.progress}>
          {stages.map((name, i) => (
            <View
              key={name}
              style={[
                styles.progressPart,
                { backgroundColor: i <= stage ? colors.red : colors.border },
              ]}
            />
          ))}
        </View>
        {stage === 0 ? (
          <View style={styles.section}>
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
        {stage === 1 ? (
          <View style={styles.section}>
            {fipeStatus}
            {fipeType && edition.data ? (
              <FipeSelector
                key={tipo}
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
                {field({
                  key: "fabricante",
                  label: "Marca / fabricante",
                  required: true,
                  maxLength: 100,
                })}
                {field({
                  key: "modelo",
                  label: "Modelo",
                  required: true,
                  maxLength: 250,
                })}
                {field({
                  key: "anoModelo",
                  label: "Ano do modelo",
                  required: true,
                  kind: "number",
                })}
              </View>
            )}
          </View>
        ) : null}
        {stage === 2 ? (
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
            {field({
              key: "anoFabricacao",
              label: "Ano de fabricação",
              required: true,
              kind: "number",
            })}
            {fipeType && edition.data && values.condicao === "ZERO_KM"
              ? field({
                  key: "anoModelo",
                  label: "Ano do modelo",
                  required: true,
                  kind: "number",
                })
              : null}
            {field({ key: "cor", label: "Cor", required: true, maxLength: 60 })}
            {requiredMain.map((item) => field(item, `${tipo}.`))}
          </View>
        ) : null}
        {stage === 3 ? (
          <View style={styles.section}>
            <AppText color="muted">Histórico e documentos do veículo.</AppText>
            {field({
              key: "historicoLeilao",
              label: "Passou por leilão?",
              kind: "boolean",
              required: true,
            })}
            {field({
              key: "historicoSinistro",
              label: "Teve sinistro?",
              kind: "boolean",
              required: true,
            })}
            {requiredDocuments.map((item) => field(item, `${tipo}.`))}
          </View>
        ) : null}
        {stage === 4 ? (
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
            {addressFields
              .filter((item) => item.required && item.key !== "cep")
              .map((item) => field(item, "endereco."))}
          </View>
        ) : null}
        {stage === 5 ? (
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
        {stage === 6 ? (
          <View style={styles.section}>
            {field({
              key: "titulo",
              label: "Título do anúncio",
              required: true,
              maxLength: 180,
            })}
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
            {values.tipoPreco === "FIXO"
              ? field({
                  key: "precoReais",
                  label: "Preço (R$)",
                  required: true,
                  mask: "money",
                })
              : null}
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
                    <TextField
                      label="Cor"
                      value={unit.cor}
                      onChangeText={(cor) =>
                        setLotUnits((current) =>
                          current.map((row, index) =>
                            index === i ? { ...row, cor } : row,
                          ),
                        )
                      }
                    />
                    {values.condicao !== "ZERO_KM" ? (
                      <>
                        <TextField
                          label="Placa"
                          value={unit.placa}
                          maxLength={7}
                          autoCapitalize="characters"
                          autoCorrect={false}
                          onChangeText={(typed) => {
                            const placa = cleanMasked("plate", typed);
                            setLotUnits((current) =>
                              current.map((row, index) =>
                                index === i ? { ...row, placa } : row,
                              ),
                            );
                          }}
                        />
                        <TextField
                          label="Quilometragem"
                          value={displayMasked("thousands", unit.quilometragem)}
                          keyboardType="number-pad"
                          maxLength={maskInput.thousands.maxLength}
                          onChangeText={(typed) => {
                            const quilometragem = cleanMasked("thousands", typed);
                            setLotUnits((current) =>
                              current.map((row, index) =>
                                index === i ? { ...row, quilometragem } : row,
                              ),
                            );
                          }}
                        />
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
        {stage === 7 ? (
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
            {field({
              key: "descricao",
              label: "Descrição",
              maxLength: 10000,
              multiline: true,
            })}
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
                      <TextField
                        key={item.key}
                        label={item.label}
                        value={motor[item.key] || ""}
                        onChangeText={(value) =>
                          setMotors((current) =>
                            current.map((row, index) =>
                              index === i ? { ...row, [item.key]: value } : row,
                            ),
                          )
                        }
                      />
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
        {stage === 8 ? (
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
      </ScrollView>
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
                Keyboard.dismiss();
                setError("");
                setStage((current) => current - 1);
                scrollRef.current?.scrollTo({ y: 0, animated: false });
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
  content: { padding: space.lg, gap: space.lg },
  section: { gap: space.md },
  field: { gap: space.sm },
  progress: { flexDirection: "row", gap: space.xs },
  progressPart: { flex: 1, height: 4, borderRadius: 2 },
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
  unit: {
    borderWidth: 1,
    borderRadius: radius.md,
    padding: space.md,
    gap: space.md,
  },
  photo: { flexDirection: "row", alignItems: "center", gap: space.md },
  thumbnail: { width: 88, height: 88, borderRadius: radius.md },
  success: { padding: space.lg, justifyContent: "center", gap: space.lg },
});
