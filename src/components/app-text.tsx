import { Text, type TextProps } from 'react-native';

import { useTheme } from '@/hooks/use-theme';
import { fonts, type Colors } from '@/theme';

const variants = {
  display: { fontFamily: fonts.heading, fontSize: 28, lineHeight: 32, letterSpacing: -0.8 },
  title: { fontFamily: fonts.heading, fontSize: 22, lineHeight: 27, letterSpacing: -0.5 },
  heading: { fontFamily: fonts.headingBold, fontSize: 17, lineHeight: 22, letterSpacing: -0.3 },
  price: { fontFamily: fonts.heading, fontSize: 18, lineHeight: 22, letterSpacing: -0.3 },
  body: { fontFamily: fonts.body, fontSize: 15, lineHeight: 21 },
  bodyStrong: { fontFamily: fonts.semibold, fontSize: 15, lineHeight: 21 },
  label: { fontFamily: fonts.semibold, fontSize: 13, lineHeight: 17 },
  caption: { fontFamily: fonts.body, fontSize: 13, lineHeight: 17 },
  overline: { fontFamily: fonts.bold, fontSize: 11, lineHeight: 14, letterSpacing: 0.8, textTransform: 'uppercase' },
} as const;

export type TextVariant = keyof typeof variants;

type Props = TextProps & { variant?: TextVariant; color?: keyof Colors };

export function AppText({ variant = 'body', color = 'text', style, ...rest }: Props) {
  const { colors } = useTheme();
  return <Text {...rest} style={[variants[variant], { color: colors[color] }, style]} />;
}
