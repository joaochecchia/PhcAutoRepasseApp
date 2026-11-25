/** Resultado da validação de formato de uma etapa do anúncio. */
export type StageCheck = {
  /** Mensagem de cada campo com erro, pela chave do campo, na ordem em que aparecem na tela. */
  fields: Record<string, string>;
  /** Campos cujo erro é só estar vazio: aparecem depois que a etapa fica para trás. */
  missing: Set<string>;
  /** Nome curto de cada campo com erro, para o resumo do rodapé. */
  names: Record<string, string>;
  /** Erros que não pertencem a um campo: fotos, meio de contato, quantidade de carros do lote. */
  general: string[];
};

export const emptyCheck = (): StageCheck => ({
  fields: {},
  missing: new Set(),
  names: {},
  general: [],
});

export const errorCount = (check: StageCheck) =>
  Object.keys(check.fields).length + check.general.length;

/** "Quilometragem (km)" → "quilometragem"; "IPVA pago?" → "IPVA pago". */
export function shortName(label: string) {
  const name = label
    .replace(/\s*\(.*?\)/g, "")
    .replace(/[?*]/g, "")
    .trim();
  return /^\p{Lu}\p{Lu}/u.test(name)
    ? name
    : name.charAt(0).toLocaleLowerCase("pt-BR") + name.slice(1);
}

/** "a, b e c"; com mais de quatro, "a, b, c e mais 2". */
export function joinNames(names: string[]) {
  const shown =
    names.length > 4
      ? [...names.slice(0, 3), `mais ${names.length - 3}`]
      : names;
  return shown.length > 1
    ? `${shown.slice(0, -1).join(", ")} e ${shown[shown.length - 1]}`
    : (shown[0] ?? "");
}

/** Resumo curto para o rodapé: "Falta preencher: cor e quilometragem." */
export function summarize(check: StageCheck) {
  const keys = Object.keys(check.fields);
  if (!keys.length) return check.general[0] ?? "";
  const missing = keys.filter((key) => check.missing.has(key));
  const wrong = keys.filter((key) => !check.missing.has(key));
  return [
    missing.length
      ? `Falta preencher: ${joinNames(missing.map((key) => check.names[key]))}.`
      : "",
    wrong.length
      ? `Corrija: ${joinNames(wrong.map((key) => check.names[key]))}.`
      : "",
  ]
    .filter(Boolean)
    .join(" ");
}
