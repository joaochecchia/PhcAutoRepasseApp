import { DMSans_400Regular, DMSans_500Medium, DMSans_600SemiBold, DMSans_700Bold } from '@expo-google-fonts/dm-sans';
import { Manrope_700Bold, Manrope_800ExtraBold } from '@expo-google-fonts/manrope';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useFonts } from 'expo-font';
import { DarkTheme, DefaultTheme, Stack, ThemeProvider } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

import { SplashOverlay } from '@/components/splash-overlay';
import { FavoritesProvider } from '@/hooks/use-favorites';
import { IntroProvider } from '@/hooks/use-intro';
import { AppThemeProvider, useTheme } from '@/hooks/use-theme';
import { brandCharcoal } from '@/theme';

SplashScreen.preventAutoHideAsync().catch(() => undefined);

export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts({
    DMSans_400Regular,
    DMSans_500Medium,
    DMSans_600SemiBold,
    DMSans_700Bold,
    Manrope_700Bold,
    Manrope_800ExtraBold,
  });
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: { queries: { staleTime: 60_000, retry: 1, refetchOnWindowFocus: false } },
      }),
  );

  // Sem as fontes a splash nativa continua na tela; se falharem, segue com a fonte do sistema.
  if (!fontsLoaded && !fontError) return null;

  return (
    <GestureHandlerRootView style={styles.root}>
      <QueryClientProvider client={queryClient}>
        <AppThemeProvider>
          <FavoritesProvider>
            <IntroProvider>
              <Navigation />
              <SplashOverlay ready />
            </IntroProvider>
          </FavoritesProvider>
        </AppThemeProvider>
      </QueryClientProvider>
    </GestureHandlerRootView>
  );
}

function Navigation() {
  const { colors, scheme } = useTheme();
  const base = scheme === 'dark' ? DarkTheme : DefaultTheme;
  return (
    <ThemeProvider
      value={{
        ...base,
        colors: { ...base.colors, primary: colors.red, background: colors.bg, card: colors.surface, text: colors.text, border: colors.border },
      }}>
      <View style={[styles.root, { backgroundColor: colors.bg }]}>
        <StatusBar style={scheme === 'dark' ? 'light' : 'dark'} />
        <Stack screenOptions={{ contentStyle: { backgroundColor: colors.bg }, headerTintColor: colors.red }}>
          <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
          <Stack.Screen name="anuncio/[id]" options={{ headerShown: false }} />
          <Stack.Screen
            name="anunciar"
            options={{
              presentation: 'modal',
              title: 'Anunciar veículo',
              headerShadowVisible: false,
              headerTitleStyle: { color: colors.text },
            }}
          />
        </Stack>
      </View>
    </ThemeProvider>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: brandCharcoal },
});
