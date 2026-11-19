import { Image } from 'expo-image';

import { useTheme } from '@/hooks/use-theme';

const dark = require('@/assets/images/logo-dark.png');
const light = require('@/assets/images/logo-light.png');
/** Proporção da marca recortada (largura / altura), a mesma das duas versões. */
export const BRAND_RATIO = 1123 / 588;

/**
 * Marca PHC Auto: branco→vermelho no tema escuro e preto→vermelho no claro, como as duas artes da marca. Recebe só
 * a altura; a largura segue a proporção. `variant` força uma versão (ex.: a abertura, sempre em fundo escuro).
 */
export function BrandLogo({ height, variant }: { height: number; variant?: 'dark' | 'light' }) {
  const { scheme } = useTheme();
  const version = variant ?? (scheme === 'dark' ? 'dark' : 'light');
  return (
    <Image
      source={version === 'dark' ? dark : light}
      style={{ height, width: Math.round(height * BRAND_RATIO) }}
      contentFit="contain"
      accessibilityRole="image"
      accessibilityLabel="PHC Auto"
    />
  );
}
