import { booleanKeys, numericKeys, type VehicleType } from "./fields";

export type Draft = Record<string, string> & { tipoVeiculo: VehicleType };
export function adPayload(
  values: Draft,
  motors: Record<string, string>[],
  usuarioId: string,
  fipeReferenciaId: string | null,
) {
  const tipo = values.tipoVeiculo;
  const detail: Record<string, unknown> = {};
  for (const [key, raw] of Object.entries(values)) {
    if (!key.startsWith(`${tipo}.`) || !raw.trim()) continue;
    const name = key.slice(tipo.length + 1);
    detail[name] = numericKeys.has(name)
      ? Number(raw.replace(",", "."))
      : booleanKeys.has(name)
        ? raw === "true"
        : raw.trim();
  }
  if (typeof detail.motorizacao === "string")
    detail.motorizacao =
      detail.motorizacao.replace(",", ".") +
      (values[`${tipo}.turbo`] === "true" ? " Turbo" : "");
  delete detail.turbo;
  if (
    (tipo === "CARRO" || tipo === "CAMINHONETE") &&
    (values[`${tipo}.combustivel`] || "").toLowerCase() === "elétrico"
  )
    detail.motorizacao = "Elétrico";
  if (values.condicao === "ZERO_KM") {
    for (const name of [
      "placa",
      "exibirPlacaCompleta",
      "ipvaPago",
      "licenciado",
      "unicoDono",
    ])
      delete detail[name];
    if ("quilometragem" in detail) detail.quilometragem = 0;
  }
  if (tipo === "BARCO")
    detail.motores = motors.map((motor) =>
      Object.fromEntries(
        Object.entries(motor)
          .filter(([, value]) => value.trim())
          .map(([key, value]) => [
            key,
            numericKeys.has(key)
              ? Number(value.replace(",", "."))
              : value.trim(),
          ]),
      ),
    );
  const text = (key: string) => values[key]?.trim() || null;
  const optionalBoolean = (key: string) =>
    values[key] === undefined || values[key] === ""
      ? null
      : values[key] === "true";
  const price = Number(
    (values.precoReais || "").replace(/\./g, "").replace(",", "."),
  );
  return {
    anuncianteId: usuarioId,
    tipoVeiculo: tipo,
    fabricante: text("fabricante"),
    modelo: text("modelo"),
    versao: text("versao"),
    anoFabricacao: Number(values.anoFabricacao),
    anoModelo: Number(values.anoModelo),
    cor: text("cor"),
    identificadorPublico: text("identificadorPublico"),
    condicao: values.condicao,
    tipoFreio: text("tipoFreio"),
    historicoLeilao: optionalBoolean("historicoLeilao"),
    historicoSinistro: optionalBoolean("historicoSinistro"),
    titulo: text("titulo"),
    descricao: text("descricao"),
    tipoPreco: values.tipoPreco,
    precoCentavos: values.tipoPreco === "FIXO" ? Math.round(price * 100) : null,
    aceitaTroca: optionalBoolean("aceitaTroca"),
    publicarAgora: values.publicarAgora === "true",
    fipeReferenciaId,
    contato: {
      whatsapp: values.contatoWhatsapp === "true",
      ligacao: values.contatoLigacao === "true",
      naoDivulgar: values.contatoNaoDivulgar === "true",
      versaoTexto: values.contatoNaoDivulgar === "true" ? null : "1.0",
    },
    endereco: {
      cep: (values["endereco.cep"] || "").replace(/\D/g, ""),
      cidade: text("endereco.cidade"),
      bairro: text("endereco.bairro"),
      rua: text("endereco.rua"),
      numero: text("endereco.numero"),
      complemento: text("endereco.complemento"),
      uf: text("endereco.uf"),
    },
    carro: tipo === "CARRO" ? detail : null,
    moto: tipo === "MOTO" ? detail : null,
    caminhao: tipo === "CAMINHAO" ? detail : null,
    caminhonete: tipo === "CAMINHONETE" ? detail : null,
    barco: tipo === "BARCO" ? detail : null,
    linhaAmarela: tipo === "LINHA_AMARELA" ? detail : null,
  };
}
