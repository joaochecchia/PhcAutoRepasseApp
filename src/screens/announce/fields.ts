import type { Mask } from "@/utils/masks";

export type VehicleType =
  "CARRO" | "MOTO" | "CAMINHAO" | "CAMINHONETE" | "BARCO" | "LINHA_AMARELA";
export type Field = {
  key: string;
  label: string;
  required?: boolean;
  kind?: "number" | "boolean";
  maxLength?: number;
  choices?: string[];
  mask?: Mask;
  multiline?: boolean;
};
const text = (
  key: string,
  label: string,
  required = false,
  maxLength?: number,
): Field => ({ key, label, required, maxLength });
/** Números que passam de mil ganham ponto de milhar ao digitar. Anos e contagens pequenas, não. */
const thousandsKeys = new Set([
  "quilometragem",
  "cilindradas",
  "capacidadeCargaKg",
  "pesoBrutoTotalKg",
  "pesoOperacionalKg",
  "horasUso",
  "horimetro",
  "horasDesdeRevisao",
]);
const number = (key: string, label: string, required = false): Field => ({
  key,
  label,
  required,
  kind: "number",
  ...(thousandsKeys.has(key) ? { mask: "thousands" as const } : {}),
});
const yesNo = (key: string, label: string, required = false): Field => ({
  key,
  label,
  required,
  kind: "boolean",
});
const road: Field[] = [
  { key: "placa", label: "Placa completa", required: true, mask: "plate" },
  yesNo("exibirPlacaCompleta", "Exibir placa completa?", true),
  yesNo("ipvaPago", "IPVA pago?", true),
  yesNo("licenciado", "Licenciado?"),
];
export const vehicleTypes: { value: VehicleType; label: string }[] = [
  { value: "CARRO", label: "Carro" },
  { value: "MOTO", label: "Moto" },
  { value: "CAMINHAO", label: "Caminhão" },
  { value: "CAMINHONETE", label: "Caminhonete" },
  { value: "BARCO", label: "Barco" },
  { value: "LINHA_AMARELA", label: "Linha amarela" },
];
export const fieldsByType: Record<VehicleType, Field[]> = {
  CARRO: [
    number("quilometragem", "Quilometragem (km)", true),
    text("carroceria", "Carroceria", true, 60),
    text("cambio", "Câmbio", true, 60),
    text("combustivel", "Combustível", true, 60),
    text("motorizacao", "Motorização", true, 100),
    yesNo("turbo", "Turbo?"),
    number("numeroPortas", "Número de portas"),
    number("numeroLugares", "Número de lugares"),
    text("tracao", "Tração"),
    text("tipoDirecao", "Tipo de direção"),
    ...road,
    yesNo("unicoDono", "Único dono?", true),
    yesNo("blindado", "Blindado?"),
  ],
  MOTO: [
    number("quilometragem", "Quilometragem (km)", true),
    number("cilindradas", "Cilindrada (cc)"),
    text("categoria", "Categoria", true),
    text("cambio", "Câmbio", true),
    text("combustivel", "Combustível", true),
    text("partida", "Tipo de partida"),
    text("refrigeracao", "Refrigeração"),
    ...road,
  ],
  CAMINHAO: [
    number("quilometragem", "Quilometragem (km)", true),
    text("configuracao", "Configuração", true),
    text("carroceria", "Carroceria", true),
    text("cambio", "Câmbio", true),
    text("combustivel", "Combustível", true),
    number("numeroEixos", "Número de eixos", true),
    text("tracao", "Tração"),
    text("tipoDirecao", "Tipo de direção"),
    number("capacidadeCargaKg", "Capacidade de carga (kg)"),
    number("pesoBrutoTotalKg", "Peso bruto total (kg)"),
    text("implemento", "Implemento"),
    ...road,
  ],
  CAMINHONETE: [
    number("quilometragem", "Quilometragem (km)", true),
    text("tipoCabine", "Tipo de cabine", true),
    text("carroceria", "Carroceria", true),
    text("cambio", "Câmbio", true),
    text("combustivel", "Combustível", true),
    text("motorizacao", "Motorização", true),
    yesNo("turbo", "Turbo?"),
    number("numeroPortas", "Número de portas"),
    text("tracao", "Tração"),
    text("tipoDirecao", "Tipo de direção"),
    number("capacidadeCargaKg", "Capacidade de carga (kg)"),
    ...road,
    yesNo("unicoDono", "Único dono?", true),
    yesNo("blindado", "Blindado?"),
  ],
  BARCO: [
    number("tamanhoPes", "Comprimento (pés)"),
    text("estilo", "Estilo"),
    text("materialCasco", "Material do casco"),
    number("capacidadePessoas", "Capacidade de pessoas"),
    number("numeroCabines", "Número de cabines"),
    number("horasUso", "Horas de uso"),
    text("registroMaritimo", "Registro marítimo"),
  ],
  LINHA_AMARELA: [
    text("tipoMaquina", "Tipo de máquina"),
    number("horimetro", "Horímetro (horas)"),
    number("pesoOperacionalKg", "Peso operacional (kg)"),
    number("potenciaHp", "Potência (hp)"),
    text("tipoEsteiraOuPneu", "Esteira ou pneu"),
    number("capacidadeCacambaM3", "Capacidade da caçamba (m³)"),
    text("numeroSerie", "Número de série"),
  ],
};
export const motorFields: Field[] = [
  number("posicao", "Posição do motor"),
  text("fabricante", "Fabricante do motor"),
  text("modelo", "Modelo do motor"),
  number("potenciaHp", "Potência (hp)"),
  number("ano", "Ano do motor"),
  number("horasUso", "Horas de uso do motor"),
  number("horasDesdeRevisao", "Horas desde a revisão"),
  text("combustivel", "Combustível do motor"),
];
export const addressFields: Field[] = [
  { key: "cep", label: "CEP", required: true, mask: "cep" },
  text("uf", "Estado", true),
  text("cidade", "Cidade", true, 120),
  text("bairro", "Bairro", true, 120),
  text("rua", "Rua / avenida", true, 200),
  text("numero", "Número", false, 20),
  text("complemento", "Complemento", false, 200),
];
export const numericKeys = new Set([
  "quilometragem",
  "cilindradaLitros",
  "cilindradas",
  "numeroPortas",
  "numeroLugares",
  "numeroEixos",
  "capacidadeCargaKg",
  "pesoBrutoTotalKg",
  "tamanhoPes",
  "capacidadePessoas",
  "numeroCabines",
  "horasUso",
  "horimetro",
  "pesoOperacionalKg",
  "potenciaHp",
  "capacidadeCacambaM3",
  "posicao",
  "ano",
  "horasDesdeRevisao",
]);
export const booleanKeys = new Set([
  "exibirPlacaCompleta",
  "ipvaPago",
  "licenciado",
  "unicoDono",
  "blindado",
]);
export const fipeTypes: Partial<
  Record<VehicleType, "cars" | "motorcycles" | "trucks">
> = {
  CARRO: "cars",
  CAMINHONETE: "cars",
  MOTO: "motorcycles",
  CAMINHAO: "trucks",
};
