import { File, Paths } from "expo-file-system";
import { Platform } from "react-native";
import { request, upload, type UploadProgress } from "./client";

export type Catalog = {
  fabricantes: { valor: string; aliases: string[] }[];
  modelosPorFabricante: Record<string, string[]>;
  cores: string[];
  carrocerias: string[];
  cambios: string[];
  combustiveis: string[];
  motorizacoes: string[];
  tiposFreio: string[];
  tracoes: string[];
  direcoes: string[];
  fabricantesMotos: { valor: string; aliases: string[] }[];
  modelosMotosPorFabricante: Record<string, string[]>;
  categoriasMotos: string[];
  partidasMotos: string[];
  refrigeracoesMotos: string[];
  cambiosMotos: string[];
  tiposFreioMotos: string[];
  fabricantesCaminhoes: { valor: string; aliases: string[] }[];
  modelosCaminhoesPorFabricante: Record<string, string[]>;
  configuracoesCaminhao: string[];
  carroceriasCaminhao: string[];
  cambiosCaminhao: string[];
  tracoesCaminhao: string[];
  direcoesCaminhao: string[];
  tiposFreioCaminhao: string[];
  implementosCaminhao: string[];
};
export type FipeOption = {
  codigo: string;
  nome: string;
  mesReferencia: string | null;
  anoId?: string | null;
};
export type FipePage = {
  opcoes: FipeOption[];
  temProximaPagina: boolean;
  catalogoPendente: boolean;
};
export type FipeReference = {
  id: string;
  marca: string;
  modelo: string;
  anoModelo: number;
  zeroKm: boolean;
  combustivel: string;
  valorCentavos: number;
  mesReferencia: string;
};
export type UploadFile = { uri: string; name: string; type: string };
export type FipeQuota = {
  ilimitado: boolean;
  limite: number | null;
  usadas: number;
  restantes: number | null;
};
export type MediaRules = {
  liberado: boolean;
  duracaoMaximaVideoSegundos: number;
  tamanhoMaximoVideoBytes: number;
  tamanhoMaximoEnvioVideoBytes: number;
  tamanhoMaximoLaudoBytes: number;
  formatosLaudo: string[];
};

async function submitMultipart<T>(
  path: string,
  part: "anuncio" | "lote",
  payload: Record<string, unknown>,
  photos: { file: UploadFile; alt: string }[],
  onProgress?: UploadProgress,
): Promise<T> {
  const form = new FormData();
  const stamp = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  const announcement =
    Platform.OS === "web"
      ? null
      : new File(Paths.cache, `${part}-${stamp}.json`);
  const descriptions =
    Platform.OS === "web"
      ? null
      : new File(Paths.cache, `descricoes-${stamp}.json`);
  try {
    if (announcement && descriptions) {
      await Promise.all([
        announcement.write(JSON.stringify(payload)),
        descriptions.write(JSON.stringify(photos.map(({ alt }) => alt.trim()))),
      ]);
      form.append(part, {
        uri: announcement.uri,
        name: `${part}.json`,
        type: "application/json",
      } as unknown as Blob);
      form.append("descricoesFotos", {
        uri: descriptions.uri,
        name: "descricoes.json",
        type: "application/json",
      } as unknown as Blob);
    } else {
      form.append(
        part,
        new Blob([JSON.stringify(payload)], { type: "application/json" }),
      );
      form.append(
        "descricoesFotos",
        new Blob([JSON.stringify(photos.map(({ alt }) => alt.trim()))], {
          type: "application/json",
        }),
      );
    }
    photos.forEach(({ file }) => form.append("fotos", file as unknown as Blob));
    return await upload<T>(path, form, { timeoutMs: 180_000, onProgress });
  } finally {
    announcement?.delete();
    descriptions?.delete();
  }
}

export const announceApi = {
  catalog: (signal?: AbortSignal) =>
    request<Catalog>("/anuncios/opcoes-cadastro", { signal }),
  fipePage: (
    params: Record<string, string | number | boolean | undefined>,
    signal?: AbortSignal,
  ) =>
    request<FipePage>("/fipe/catalogo/opcoes", {
      params: { ...params, tamanho: 50 },
      signal,
      auth: true,
    }),
  fipeReference: (input: {
    tipo: "cars" | "motorcycles" | "trucks";
    marcaId: string;
    modeloId: string;
    anoId: string;
    referencia: number;
    mesReferencia: string;
  }) =>
    request<FipeReference>("/fipe/consultas", {
      method: "POST",
      body: input,
      auth: true,
    }),
  fipeEdition: (
    tipo: "cars" | "motorcycles" | "trucks",
    signal?: AbortSignal,
  ) =>
    request<FipeOption>("/fipe/catalogo/edicao-ativa", {
      params: { tipo },
      signal,
      auth: true,
    }),
  fipeQuota: () => request<FipeQuota>("/fipe/cota", { auth: true }),
  mediaRules: (signal?: AbortSignal) =>
    request<MediaRules>("/anuncios/midias/regras", { signal, auth: true }),
  create: (
    payload: Record<string, unknown>,
    photos: { file: UploadFile; alt: string }[],
    onProgress?: UploadProgress,
  ) =>
    submitMultipart<{ id: string }>(
      "/anuncios",
      "anuncio",
      payload,
      photos,
      onProgress,
    ),
  createLot: (
    payload: Record<string, unknown>,
    photos: { file: UploadFile; alt: string }[],
    onProgress?: UploadProgress,
  ) =>
    submitMultipart<{
      loteId: string;
      anunciosCriados: string[];
      anunciosIncluidos: string[];
    }>("/lotes", "lote", payload, photos, onProgress),
  uploadLotVideo: (id: string, file: UploadFile) => {
    const form = new FormData();
    form.append("arquivo", file as unknown as Blob);
    return upload<unknown>(`/lotes/${encodeURIComponent(id)}/midias/video`, form, {
      method: "PUT",
      timeoutMs: 240_000,
    });
  },
  uploadVideo: (id: string, file: UploadFile) => {
    const form = new FormData();
    form.append("arquivo", file as unknown as Blob);
    return upload<unknown>(
      `/anuncios/${encodeURIComponent(id)}/midias/video`,
      form,
      { method: "PUT", timeoutMs: 240_000 },
    );
  },
  uploadReport: (id: string, file: UploadFile) => {
    const form = new FormData();
    form.append("arquivo", file as unknown as Blob);
    return upload<unknown>(
      `/anuncios/${encodeURIComponent(id)}/midias/laudo`,
      form,
      { method: "PUT", timeoutMs: 120_000 },
    );
  },
};
