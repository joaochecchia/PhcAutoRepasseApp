import { Easing } from 'react-native-reanimated';

/** Mesma paleta do site (frontend/src/styles.css), com os papéis que o app precisa. */
export const palette = {
  light: {
    bg: '#ffffff',
    surface: '#ffffff',
    subtle: '#f6f6f6',
    elevated: '#ffffff',
    text: '#252527',
    muted: '#77777c',
    border: '#e8e8eb',
    red: '#cd1923',
    redPressed: '#af111b',
    redTint: '#fff2f2',
    onRed: '#ffffff',
    deal: '#28704a',
    dealTint: '#f2f8f4',
    dealBorder: '#d8ebdf',
    skeleton: '#ececef',
    scrim: 'rgba(18,19,21,0.45)',
  },
  dark: {
    bg: '#121315',
    surface: '#1c1d20',
    subtle: '#17181b',
    elevated: '#232428',
    text: '#f1f1f2',
    muted: '#a4a5ac',
    border: '#323339',
    red: '#ed424b',
    redPressed: '#ce2b35',
    redTint: '#342025',
    onRed: '#ffffff',
    deal: '#8bd4aa',
    dealTint: '#17271e',
    dealBorder: '#294b39',
    skeleton: '#2a2b30',
    scrim: 'rgba(0,0,0,0.6)',
  },
} as const;

export type Colors = { [K in keyof typeof palette.light]: string };

/** Fundo da abertura e da splash nativa: o carvão da marca, igual nos dois temas. */
export const brandCharcoal = '#121315';

export const space = { xs: 4, sm: 8, md: 12, lg: 16, xl: 20, xxl: 24, xxxl: 32 } as const;

export const radius = { sm: 8, md: 12, lg: 16, xl: 20, pill: 999 } as const;

export const fonts = {
  heading: 'Manrope_800ExtraBold',
  headingBold: 'Manrope_700Bold',
  body: 'DMSans_400Regular',
  medium: 'DMSans_500Medium',
  semibold: 'DMSans_600SemiBold',
  bold: 'DMSans_700Bold',
} as const;

/** Curvas e durações da skill expo-animation. Nunca ease-in em UI. */
export const motion = {
  easeOut: Easing.bezier(0.23, 1, 0.32, 1),
  easeInOut: Easing.bezier(0.77, 0, 0.175, 1),
  press: 120,
  small: 180,
  settle: { duration: 400, dampingRatio: 1 },
  pop: { duration: 350, dampingRatio: 0.55 },
} as const;

/** Alvo mínimo de toque (pt). */
export const touch = 44;
