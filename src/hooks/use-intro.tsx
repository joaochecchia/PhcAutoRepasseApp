import { createContext, use, type ReactNode } from 'react';
import { useSharedValue, type SharedValue } from 'react-native-reanimated';

/** Progresso da abertura (0 → 1). A tela inicial usa para subir o conteúdo enquanto a logo sai. */
const IntroContext = createContext<SharedValue<number> | null>(null);

export function IntroProvider({ children }: { children: ReactNode }) {
  const progress = useSharedValue(0);
  return <IntroContext value={progress}>{children}</IntroContext>;
}

export function useIntroProgress() {
  const value = use(IntroContext);
  if (!value) throw new Error('useIntroProgress fora do IntroProvider');
  return value;
}
