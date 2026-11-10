import type { SearchAd } from '@/api/contracts';

const money = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 });
const integer = new Intl.NumberFormat('pt-BR');

export function formatPrice(tipoPreco: string, cents: number | null | undefined) {
  if (tipoPreco === 'SOB_CONSULTA' || cents == null) return 'Sob consulta';
  return money.format(cents / 100);
}

export function formatCents(cents: number) {
  return money.format(cents / 100);
}

export function formatKm(km: number | null | undefined) {
  return km == null ? null : `${integer.format(km)} km`;
}

export function formatCount(value: number) {
  return integer.format(value);
}

export function formatYears(fabricacao: number | null | undefined, modelo: number | null | undefined) {
  if (!fabricacao && !modelo) return null;
  if (!fabricacao || fabricacao === modelo) return String(modelo ?? fabricacao);
  return `${fabricacao}/${modelo}`;
}

export function formatLocation(cidade?: string | null, uf?: string | null) {
  if (cidade && uf) return `${cidade} (${uf})`;
  return cidade || uf || 'Local não informado';
}

/** Os textos do backend vêm em MAIÚSCULAS em alguns campos (ELÉTRICO, FLEX). */
export function humanize(value: string | null | undefined) {
  if (!value) return null;
  if (value !== value.toUpperCase()) return value;
  const lower = value.toLocaleLowerCase('pt-BR').replace(/_/g, ' ');
  return lower.charAt(0).toLocaleUpperCase('pt-BR') + lower.slice(1);
}

export const conditionLabels: Record<string, string> = {
  ZERO_KM: 'Zero km',
  USADO: 'Seminovo',
  REPASSE: 'Repasse',
};

/** Abaixo da FIPE: diferença negativa. */
export function isBelowFipe(ad: Pick<SearchAd, 'fipe'>) {
  return (ad.fipe?.diferencaCentavos ?? 0) < 0;
}
