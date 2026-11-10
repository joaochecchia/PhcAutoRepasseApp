import {
  Bike,
  Car,
  CarFront,
  CircleCheck,
  Handshake,
  Ship,
  Sparkles,
  Tractor,
  Truck,
  Zap,
  BadgeCheck,
  type LucideIcon,
} from 'lucide-react-native';

/** Mesmos valores do site (frontend/src/data/catalog.ts e filters.ts). */
export const vehicleTypes: { key: string; label: string; icon: LucideIcon }[] = [
  { key: 'CARRO', label: 'Carros', icon: CarFront },
  { key: 'MOTO', label: 'Motos', icon: Bike },
  { key: 'CAMINHONETE', label: 'Caminhonetes', icon: Car },
  { key: 'CAMINHAO', label: 'Caminhões', icon: Truck },
  { key: 'BARCO', label: 'Barcos', icon: Ship },
  { key: 'LINHA_AMARELA', label: 'Linha amarela', icon: Tractor },
];

export const conditions: { key: string; label: string }[] = [
  { key: 'ZERO_KM', label: 'Zero km' },
  { key: 'USADO', label: 'Seminovo' },
  { key: 'REPASSE', label: 'Repasse' },
];

export const sortOptions: { key: string; label: string }[] = [
  { key: '', label: 'Mais relevantes' },
  { key: 'MAIS_RECENTES', label: 'Mais recentes' },
  { key: 'MENOR_PRECO', label: 'Menor preço' },
  { key: 'MAIOR_PRECO', label: 'Maior preço' },
  { key: 'MENOR_KM', label: 'Menor quilometragem' },
  { key: 'MAIS_NOVOS', label: 'Mais novos' },
];

/** Faixas de preço em reais. */
export const priceRanges: { key: string; label: string; min?: number; max?: number }[] = [
  { key: 'ate-30', label: 'Até R$ 30 mil', max: 30_000 },
  { key: '30-60', label: 'R$ 30 a 60 mil', min: 30_000, max: 60_000 },
  { key: '60-100', label: 'R$ 60 a 100 mil', min: 60_000, max: 100_000 },
  { key: '100-200', label: 'R$ 100 a 200 mil', min: 100_000, max: 200_000 },
  { key: 'acima-200', label: 'Acima de R$ 200 mil', min: 200_000 },
];

export const SOLD_TAB = 'VENDIDOS';

/** Abas da vitrine: vazio = Vitrine PHC (pagina-inicial); as demais buscam a condição. */
export const showcaseTabs = [
  { key: '', label: 'Vitrine PHC', icon: Zap },
  { key: 'ZERO_KM', label: 'Zero km', icon: Sparkles },
  { key: 'USADO', label: 'Seminovo', icon: CircleCheck },
  { key: 'REPASSE', label: 'Repasse', icon: Handshake },
  { key: SOLD_TAB, label: 'Vendidos', icon: BadgeCheck },
];
