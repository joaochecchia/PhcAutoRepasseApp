// Portado de ../PhcAutoRepasse/frontend/src/lib/fieldLabels.ts; mantenha as duas listas iguais.
// Nome de cada campo como aparece nos formulários, para as mensagens de erro do servidor dizerem o que corrigir.
// A lista do anúncio acompanha backend RotulosCamposAnuncio; chaves desconhecidas viram palavras ("numeroSerie" → "numero serie").

const labels: Record<string, string> = {
  fabricante: "Marca / fabricante",
  modelo: "Modelo",
  versao: "Versão",
  anoFabricacao: "Ano de fabricação",
  anoModelo: "Ano do modelo",
  cor: "Cor",
  identificadorPublico: "Referência pública do veículo",
  condicao: "Condição",
  tipoFreio: "Tipo de freio",
  historicoLeilao: "Possui histórico de leilão?",
  historicoSinistro: "Possui histórico de sinistro?",
  titulo: "Título do anúncio",
  descricao: "Descrição",
  tipoPreco: "Tipo de preço",
  precoCentavos: "Preço",
  cep: "CEP",
  cidade: "Cidade",
  bairro: "Bairro",
  rua: "Rua",
  numero: "Número",
  complemento: "Complemento",
  uf: "Estado (UF)",
  quilometragem: "Quilometragem (km)",
  carroceria: "Carroceria",
  cambio: "Câmbio",
  combustivel: "Combustível",
  tracao: "Tração",
  motorizacao: "Motorização",
  tipoDirecao: "Tipo de direção",
  cilindradaLitros: "Cilindrada (litros)",
  numeroPortas: "Número de portas",
  numeroLugares: "Número de lugares",
  placa: "Placa completa",
  exibirPlacaCompleta: "Exibir placa completa no anúncio?",
  unicoDono: "Único dono?",
  ipvaPago: "IPVA pago?",
  licenciado: "Veículo licenciado?",
  blindado: "Blindado?",
  cilindradas: "Cilindrada (cc)",
  categoria: "Categoria",
  partida: "Tipo de partida",
  refrigeracao: "Refrigeração",
  configuracao: "Configuração",
  numeroEixos: "Número de eixos",
  capacidadeCargaKg: "Capacidade de carga (kg)",
  pesoBrutoTotalKg: "Peso bruto total (kg)",
  implemento: "Implemento",
  tipoCabine: "Tipo de cabine",
  tamanhoPes: "Comprimento (pés)",
  estilo: "Estilo",
  materialCasco: "Material do casco",
  capacidadePessoas: "Capacidade de pessoas",
  numeroCabines: "Número de cabines",
  horasUso: "Horas de uso",
  registroMaritimo: "Registro marítimo",
  tipoMaquina: "Tipo de máquina",
  horimetro: "Horímetro (horas)",
  pesoOperacionalKg: "Peso operacional (kg)",
  potenciaHp: "Potência (hp)",
  tipoEsteiraOuPneu: "Esteira ou pneu",
  capacidadeCacambaM3: "Capacidade da caçamba (m³)",
  numeroSerie: "Número de série",
  posicao: "Posição do motor",
  ano: "Ano do motor",
  horasDesdeRevisao: "Horas desde a revisão",
  unidades: "Carros do lote",
  anunciosExistentes: "Anúncios incluídos no lote",
  // Cadastro e perfil.
  nome: "Nome",
  email: "E-mail",
  telefone: "Celular / telefone",
  cpf: "CPF",
  cnpj: "CNPJ",
  razaoSocial: "Razão social",
  nomeFantasia: "Nome fantasia",
  dataNascimento: "Data de nascimento",
  senha: "Senha",
  confirmacaoSenha: "Confirmação da senha",
};

const motorLabels: Record<string, string> = {
  fabricante: "Fabricante do motor",
  modelo: "Modelo do motor",
  combustivel: "Combustível do motor",
  potenciaHp: "Potência do motor (hp)",
  horasUso: "Horas de uso do motor",
};

/** "carro.cambio" → "Câmbio"; "barco.motores[1].ano" → "Ano do motor 2"; "unidades[0].placa" → "Placa completa (carro 1)". */
export function fieldLabel(path: string) {
  const last = (path.split(".").pop() || path).replace(/\[\d+\]/g, "");
  const motor = /motores\[(\d+)\]/.exec(path);
  if (motor && last !== "motores") return `${motorLabels[last] || labels[last] || words(last)} ${Number(motor[1]) + 1}`;
  const label = labels[last] || words(last);
  const unit = /unidades\[(\d+)\]/.exec(path);
  return unit && last !== "unidades" ? `${label} (carro ${Number(unit[1]) + 1})` : label;
}

/** Se a chave do erro é um campo conhecido do formulário (e não uma regra geral, como "escolhaValida"). */
export function isKnownField(path: string) {
  return (path.split(".").pop() || path).replace(/\[\d+\]/g, "") in labels;
}

function words(key: string) {
  const text = key.replace(/([a-z])([A-Z])/g, "$1 $2").toLowerCase();
  return text.charAt(0).toUpperCase() + text.slice(1);
}
