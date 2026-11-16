import type { AdForEdit } from "@/api/my-ads";
import type { VehicleType } from "@/screens/announce/fields";
import { adPayload, type Draft } from "@/screens/announce/payload";

export type Motors = Record<string, string>[];

const flag = (value: boolean | null | undefined) =>
  value == null ? "" : String(value);

/** Anúncio salvo → valores do formulário (mesmo formato da criação: preço em reais, só dígitos). */
export function adToDraft(ad: AdForEdit): { draft: Draft; motors: Motors } {
  const tipo = ad.tipoVeiculo as VehicleType;
  const draft: Draft = {
    tipoVeiculo: tipo,
    fabricante: ad.fabricante || "",
    modelo: ad.modelo || "",
    versao: ad.versao || "",
    anoFabricacao: ad.anoFabricacao == null ? "" : String(ad.anoFabricacao),
    anoModelo: ad.anoModelo == null ? "" : String(ad.anoModelo),
    cor: ad.cor || "",
    identificadorPublico: ad.identificadorPublico || "",
    condicao: ad.condicao || "USADO",
    tipoFreio: ad.tipoFreio || "",
    historicoLeilao: flag(ad.historicoLeilao),
    historicoSinistro: flag(ad.historicoSinistro),
    titulo: ad.titulo || "",
    descricao: ad.descricao || "",
    tipoPreco: ad.tipoPreco,
    precoReais:
      ad.precoCentavos == null ? "" : String(Math.round(ad.precoCentavos / 100)),
    aceitaTroca: flag(ad.aceitaTroca),
    publicarAgora: String(ad.status === "PUBLICADO"),
    contatoWhatsapp: String(ad.contato.whatsapp),
    contatoLigacao: String(ad.contato.ligacao),
    contatoNaoDivulgar: String(!ad.contato.whatsapp && !ad.contato.ligacao),
    "endereco.cep": (ad.endereco.cep || "").replace(/\D/g, ""),
    "endereco.cidade": ad.endereco.cidade || "",
    "endereco.bairro": ad.endereco.bairro || "",
    "endereco.rua": ad.endereco.rua || "",
    "endereco.numero": ad.endereco.numero || "",
    "endereco.complemento": ad.endereco.complemento || "",
    "endereco.uf": ad.endereco.uf || "",
  };
  let motors: Motors = [];
  for (const [key, value] of Object.entries(ad.detalhes || {})) {
    if (key === "motores" && Array.isArray(value)) {
      motors = value.map((motor: Record<string, unknown>) =>
        Object.fromEntries(
          Object.entries(motor)
            .filter(([, item]) => item != null)
            .map(([name, item]) => [name, String(item)]),
        ),
      );
      continue;
    }
    if (value == null) continue;
    // A resposta usa o nome público do campo; o formulário usa o do contrato de escrita.
    const field = key === "placaCompletaVisivel" ? "exibirPlacaCompleta" : key;
    draft[`${tipo}.${field}`] = String(value);
  }
  // Turbo é guardado junto da motorização ("2.0 Turbo") e aparece como campo separado.
  const motorizacao = draft[`${tipo}.motorizacao`];
  if (motorizacao) {
    draft[`${tipo}.turbo`] = /\s*turbo$/i.test(motorizacao) ? "true" : "false";
    draft[`${tipo}.motorizacao`] = motorizacao.replace(/\s*turbo$/i, "");
  }
  return { draft, motors };
}

const patchFields = [
  "fabricante",
  "modelo",
  "versao",
  "anoFabricacao",
  "anoModelo",
  "cor",
  "identificadorPublico",
  "condicao",
  "tipoFreio",
  "historicoLeilao",
  "historicoSinistro",
  "titulo",
  "descricao",
  "tipoPreco",
  "precoCentavos",
  "aceitaTroca",
] as const;
const detailBlocks: Record<string, string> = {
  CARRO: "carro",
  MOTO: "moto",
  CAMINHAO: "caminhao",
  CAMINHONETE: "caminhonete",
  BARCO: "barco",
  LINHA_AMARELA: "linhaAmarela",
};
const same = (left: unknown, right: unknown) =>
  JSON.stringify(left ?? null) === JSON.stringify(right ?? null);

/**
 * Só o que mudou, no formato do PATCH do backend (merge patch), como o adPatchFromDrafts do site.
 * Campo da ficha esvaziado vai como null para ser apagado.
 */
export function adPatch(
  initial: { draft: Draft; motors: Motors },
  current: { draft: Draft; motors: Motors },
  usuarioId: string,
  fipe: { fipeReferenciaId?: string; removerFipe?: boolean },
): Record<string, unknown> {
  const before = adPayload(initial.draft, initial.motors, usuarioId, null) as Record<string, unknown>;
  const after = adPayload(current.draft, current.motors, usuarioId, null) as Record<string, unknown>;
  const patch: Record<string, unknown> = {};
  for (const key of patchFields) {
    if (!same(before[key], after[key])) patch[key] = after[key] ?? null;
  }
  if (!same(before.endereco, after.endereco)) patch.endereco = after.endereco;
  const block = detailBlocks[current.draft.tipoVeiculo];
  const oldDetails = (before[block] || {}) as Record<string, unknown>;
  const newDetails = (after[block] || {}) as Record<string, unknown>;
  const changed: Record<string, unknown> = Object.fromEntries(
    Object.entries(newDetails).filter(([key, value]) => !same(oldDetails[key], value)),
  );
  for (const key of Object.keys(oldDetails)) {
    if (!(key in newDetails) && oldDetails[key] != null) changed[key] = null;
  }
  // Lista de motores vazia significa "manter" no servidor; remover todos exige null.
  if (Array.isArray(changed.motores) && !changed.motores.length) changed.motores = null;
  if (Object.keys(changed).length) patch[block] = changed;
  if (!same(before.contato, after.contato)) patch.contato = after.contato;
  if (before.publicarAgora !== after.publicarAgora) patch.publicarAgora = after.publicarAgora;
  if (fipe.fipeReferenciaId) patch.fipeReferenciaId = fipe.fipeReferenciaId;
  else if (fipe.removerFipe) patch.removerFipe = true;
  return patch;
}
