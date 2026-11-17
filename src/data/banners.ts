import type { ImageContentPosition } from 'expo-image';

/**
 * Slide do carrossel da tela inicial. Vem dos banners cadastrados no painel (/site/banners); os locais abaixo só
 * aparecem se a lista do servidor vier vazia ou falhar.
 */
export type Banner = {
  id: string;
  image: number | { uri: string };
  /** false: arte pronta, sem texto do app por cima (como no site). */
  showText: boolean;
  eyebrow?: string;
  title?: string;
  subtitle?: string;
  cta?: string;
  /** Rota do app ou link do site; nulo, o banner não é tocável. */
  link: string | null;
  /** cover corta o que sobra; contain mostra a imagem inteira sobre um fundo desfocado. */
  fit: 'cover' | 'contain';
  focus?: ImageContentPosition;
  /** Tempo na tela, em segundos. */
  duration: number;
  accessibilityLabel: string;
};

export const fallbackBanners: Banner[] = [
  {
    id: 'vitrine',
    image: require('@/assets/images/hero.jpg'),
    showText: true,
    eyebrow: 'PHC Auto',
    title: 'Seu próximo caminho começa aqui',
    cta: 'Ver veículos',
    link: '/buscar',
    fit: 'cover',
    duration: 5,
    accessibilityLabel: 'Ver todos os veículos à venda',
  },
  {
    id: 'anunciar',
    image: require('@/assets/images/hero.jpg'),
    showText: true,
    eyebrow: 'Para quem vende',
    title: 'Anuncie seu veículo em poucos minutos',
    cta: 'Anunciar agora',
    link: '/anunciar',
    fit: 'cover',
    duration: 5,
    accessibilityLabel: 'Anunciar meu veículo',
  },
];
