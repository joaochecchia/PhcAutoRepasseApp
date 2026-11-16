/**
 * Máscaras de digitação. A tela guarda o valor limpo (só dígitos, ou placa em maiúsculas) e mostra o formatado,
 * então validação e envio à API não precisam desfazer pontos e traços.
 */

export type Mask = 'thousands' | 'money' | 'cep' | 'plate' | 'cpf' | 'cnpj' | 'cpfCnpj' | 'phone';

export const onlyDigits = (value: string) => value.replace(/\D/g, '');

/** 50000 → 50.000 */
export function formatThousands(value: string) {
  const digits = onlyDigits(value).replace(/^0+(?=\d)/, '');
  return digits.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
}

/** Aplica um molde em que # é dígito: pattern('12345678', '#####-###') → 12345-678 */
function pattern(value: string, mold: string) {
  const digits = onlyDigits(value);
  let out = '';
  let index = 0;
  for (const char of mold) {
    if (index >= digits.length) break;
    if (char === '#') out += digits[index++];
    else out += char;
  }
  return out;
}

export const formatCep = (value: string) => pattern(value, '#####-###');
export const formatCpf = (value: string) => pattern(value, '###.###.###-##');
export const formatCnpj = (value: string) => pattern(value, '##.###.###/####-##');
/** CPF até 11 dígitos; a partir do 12º vira CNPJ. */
export const formatCpfCnpj = (value: string) =>
  onlyDigits(value).length > 11 ? formatCnpj(value) : formatCpf(value);
/** Fixo (10 dígitos) ou celular (11). */
export const formatPhone = (value: string) =>
  onlyDigits(value).length > 10 ? pattern(value, '(##) #####-####') : pattern(value, '(##) ####-####');
/** Placa antiga (ABC1234) ou Mercosul (ABC1D23): letras e números, maiúsculas, até 7. */
export const formatPlate = (value: string) => value.replace(/[^a-z0-9]/gi, '').toUpperCase().slice(0, 7);

const maxDigits: Partial<Record<Mask, number>> = { cep: 8, cpf: 11, cnpj: 14, cpfCnpj: 14, phone: 11, money: 12, thousands: 9 };

/** Valor guardado a partir do que foi digitado. */
export function cleanMasked(mask: Mask, typed: string) {
  if (mask === 'plate') return formatPlate(typed);
  const limit = maxDigits[mask];
  const digits = onlyDigits(typed).replace(/^0+(?=\d)/, '');
  return limit ? digits.slice(0, limit) : digits;
}

/** Texto mostrado no campo para um valor guardado. */
export function displayMasked(mask: Mask, stored: string) {
  switch (mask) {
    case 'thousands':
    case 'money':
      return formatThousands(stored);
    case 'cep':
      return formatCep(stored);
    case 'cpf':
      return formatCpf(stored);
    case 'cnpj':
      return formatCnpj(stored);
    case 'cpfCnpj':
      return formatCpfCnpj(stored);
    case 'phone':
      return formatPhone(stored);
    case 'plate':
      return formatPlate(stored);
  }
}

/** Teclado e tamanho máximo do texto formatado para cada máscara. */
export const maskInput: Record<Mask, { keyboardType: 'number-pad' | 'default' | 'phone-pad'; maxLength?: number }> = {
  thousands: { keyboardType: 'number-pad', maxLength: 11 },
  money: { keyboardType: 'number-pad', maxLength: 15 },
  cep: { keyboardType: 'number-pad', maxLength: 9 },
  cpf: { keyboardType: 'number-pad', maxLength: 14 },
  cnpj: { keyboardType: 'number-pad', maxLength: 18 },
  cpfCnpj: { keyboardType: 'number-pad', maxLength: 18 },
  phone: { keyboardType: 'phone-pad', maxLength: 15 },
  plate: { keyboardType: 'default', maxLength: 7 },
};
