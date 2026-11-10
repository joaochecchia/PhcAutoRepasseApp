/**
 * Banners da tela inicial. Hoje usam a foto de capa do site; o espaço será vendido a anunciantes,
 * então a lista deve passar a vir do backend sem mudar o componente.
 */
export type Banner = {
  id: string;
  /** Imagem local (require). Banners de anunciantes virão como URL. */
  image: number | { uri: string };
  eyebrow: string;
  title: string;
  cta: string;
  /** Rota interna do app. */
  href: '/buscar' | '/anunciar';
  accessibilityLabel: string;
};

export const banners: Banner[] = [
  {
    id: 'vitrine',
    image: require('@/assets/images/hero.jpg'),
    eyebrow: 'PHC Auto',
    title: 'Seu próximo caminho começa aqui',
    cta: 'Ver veículos',
    href: '/buscar',
    accessibilityLabel: 'Ver todos os veículos à venda',
  },
  {
    id: 'anunciar',
    image: require('@/assets/images/hero.jpg'),
    eyebrow: 'Para quem vende',
    title: 'Anuncie seu veículo em poucos minutos',
    cta: 'Anunciar agora',
    href: '/anunciar',
    accessibilityLabel: 'Anunciar meu veículo',
  },
];
