import type { MetodoPagamento } from '@/api/plans';

/** Dados digitados do cartão; só saem do aparelho para a Cielo (tokenização e confirmação do banco). */
export type Card = { numero: string; titular: string; validade: string; codigoSeguranca: string; bandeira: string };
export const emptyCard: Card = { numero: '', titular: '', validade: '', codigoSeguranca: '', bandeira: '' };

export const isCardMethod = (metodo: MetodoPagamento) => metodo === 'CARTAO_CREDITO' || metodo === 'CARTAO_DEBITO';

export const creditBrands = ['Visa', 'Master', 'Elo', 'Amex', 'Diners', 'Discover', 'JCB', 'Aura'];
export const debitBrands = ['Visa', 'Master', 'Elo'];
export const brandLabel = (brand: string) => (brand === 'Master' ? 'Mastercard' : brand);

/** Sugestão de bandeira pelo início do número; a pessoa pode corrigir e o backend valida. */
function detectBrand(digits: string) {
  if (/^(4011|4312|4389|4514|4576|5041|5066|5067|509|6277|6362|6363|650|6516|6550)/.test(digits)) return 'Elo';
  if (/^3[47]/.test(digits)) return 'Amex';
  if (/^3(0[0-5]|[68])/.test(digits)) return 'Diners';
  if (/^35/.test(digits)) return 'JCB';
  if (/^(6011|65)/.test(digits)) return 'Discover';
  if (/^50/.test(digits)) return 'Aura';
  if (/^(5[1-5]|2[2-7])/.test(digits)) return 'Master';
  if (/^4/.test(digits)) return 'Visa';
  return '';
}

const formatNumber = (value: string) => value.replace(/\D/g, '').slice(0, 19).replace(/(\d{4})(?=\d)/g, '$1 ');
/** Aceita MM/AA (como vem impresso) ou MM/AAAA; a Cielo recebe sempre MM/AAAA. */
export const fullExpiry = (value: string) => (/^\d{2}\/\d{2}$/.test(value) ? `${value.slice(0, 3)}20${value.slice(3)}` : value);
function formatExpiry(value: string) {
  const digits = value.replace(/\D/g, '').slice(0, 6);
  return digits.length > 2 ? `${digits.slice(0, 2)}/${digits.slice(2)}` : digits;
}

/** A Cielo só tokeniza números que passam no dígito verificador (Luhn). */
function luhn(digits: string) {
  let sum = 0;
  for (let i = 0; i < digits.length; i++) {
    let n = Number(digits[digits.length - 1 - i]);
    if (i % 2 === 1) n = n * 2 > 9 ? n * 2 - 9 : n * 2;
    sum += n;
  }
  return sum % 10 === 0;
}

/** O titular aceita só letras sem acento e espaços. */
export const holderName = (value: string) =>
  value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^A-Za-z ]/g, ' ').replace(/\s+/g, ' ').trim();

/** Primeiro problema do cartão, com o texto do site; vazio quando está tudo certo. */
export function cardError(card: Card, metodo: MetodoPagamento) {
  const digits = card.numero.replace(/\s/g, '');
  if (!/^\d{13,19}$/.test(digits) || !luhn(digits)) return 'Confira o número do cartão.';
  if (holderName(card.titular).length < 2) return 'Informe o nome como está impresso no cartão.';
  if (!/^(0[1-9]|1[0-2])\/(\d{2}|\d{4})$/.test(card.validade)) return 'Informe a validade como está no cartão, por exemplo 06/29.';
  if (!/^\d{3,4}$/.test(card.codigoSeguranca)) return 'Informe o código de segurança (CVV).';
  if (!card.bandeira) return 'Escolha a bandeira do cartão.';
  if (metodo === 'CARTAO_DEBITO' && !debitBrands.includes(card.bandeira)) return 'No débito aceitamos Visa, Mastercard e Elo.';
  return '';
}

/** Aplica a máscara de cada campo e sugere a bandeira pelo número. */
export function updateCard(current: Card, key: keyof Card, value: string): Card {
  if (key === 'numero') {
    const numero = formatNumber(value);
    const detected = detectBrand(numero.replace(/\s/g, ''));
    return { ...current, numero, bandeira: detected || current.bandeira };
  }
  if (key === 'validade') return { ...current, validade: formatExpiry(value) };
  if (key === 'codigoSeguranca') return { ...current, codigoSeguranca: value.replace(/\D/g, '').slice(0, 4) };
  if (key === 'titular') return { ...current, titular: value.toUpperCase().slice(0, 25) };
  return { ...current, [key]: value };
}

/** Depois do envio, número e CVV não ficam na tela. */
export const clearSensitive = (card: Card): Card => ({ ...card, numero: '', codigoSeguranca: '' });
