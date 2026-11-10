import { createContext, use, useState, type ReactNode } from 'react';
import { useColorScheme } from 'react-native';

import { palette, type Colors } from '@/theme';

export type ThemePreference = 'system' | 'light' | 'dark';

type ThemeValue = {
  colors: Colors;
  scheme: 'light' | 'dark';
  preference: ThemePreference;
  setPreference: (value: ThemePreference) => void;
};

const ThemeContext = createContext<ThemeValue | null>(null);

/** Tema segue o sistema até a pessoa escolher outro no Menu. (Protótipo: a escolha vale até fechar o app.) */
export function AppThemeProvider({ children }: { children: ReactNode }) {
  const system = useColorScheme();
  const [preference, setPreference] = useState<ThemePreference>('system');
  const scheme = preference === 'system' ? (system === 'dark' ? 'dark' : 'light') : preference;
  return (
    <ThemeContext value={{ colors: palette[scheme], scheme, preference, setPreference }}>{children}</ThemeContext>
  );
}

export function useTheme() {
  const value = use(ThemeContext);
  if (!value) throw new Error('useTheme fora do AppThemeProvider');
  return value;
}
