import { DMSans_400Regular, DMSans_500Medium, DMSans_600SemiBold, DMSans_700Bold } from '@expo-google-fonts/dm-sans';
import { Manrope_700Bold, Manrope_800ExtraBold } from '@expo-google-fonts/manrope';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useFonts } from 'expo-font';
import { DarkTheme, DefaultTheme, Stack, ThemeProvider } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

import { startChat, stopChat } from '@/api/chat-socket';
import { DialogHost } from '@/components/dialog';
import { InAppNoticeHost } from '@/components/in-app-notice';
import { SplashOverlay } from '@/components/splash-overlay';
import { FavoritesProvider } from '@/hooks/use-favorites';
import { IntroProvider } from '@/hooks/use-intro';
import { PushNotifications } from '@/hooks/use-push';
import { SessionProvider, useSession } from '@/hooks/use-session';
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
          <SessionProvider>
            <FavoritesProvider>
              <IntroProvider>
                <Navigation />
                <ChatConnection />
                <PushNotifications />
                <InAppNoticeHost />
                <DialogHost />
                <SplashOverlay ready />
              </IntroProvider>
            </FavoritesProvider>
          </SessionProvider>
        </AppThemeProvider>
      </QueryClientProvider>
    </GestureHandlerRootView>
  );
}

/** Chat em tempo real enquanto houver sessão; sai da conta, desconecta. */
function ChatConnection() {
  const status = useSession().status;
  useEffect(() => {
    if (status === 'authenticated') startChat();
    else if (status === 'anonymous') stopChat();
  }, [status]);
  return null;
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
          <Stack.Screen name="lote/[id]" options={{ headerShown: false }} />
          <Stack.Screen name="privacidade" options={{ title: 'Privacidade', headerShadowVisible: false, headerTitleStyle: { color: colors.text } }} />
          <Stack.Screen name="planos" options={{ title: 'Planos e preços', headerShadowVisible: false, headerTitleStyle: { color: colors.text } }} />
          <Stack.Screen name="assinar" options={{ presentation: 'modal', title: 'Pagamento', headerShadowVisible: false, headerTitleStyle: { color: colors.text } }} />
          <Stack.Screen name="tabela-fipe" options={{ title: 'Tabela FIPE', headerShadowVisible: false, headerTitleStyle: { color: colors.text } }} />
          <Stack.Screen name="patio" options={{ title: 'Pátio PHC Auto', headerShadowVisible: false, headerTitleStyle: { color: colors.text } }} />
          <Stack.Screen name="lojistas" options={{ title: 'Lojistas', headerShadowVisible: false, headerTitleStyle: { color: colors.text } }} />
          <Stack.Screen name="loja/[slug]" options={{ title: 'Loja', headerShadowVisible: false, headerTitleStyle: { color: colors.text } }} />
          <Stack.Screen name="entrar" options={{ presentation: 'modal', title: 'Entrar', headerShadowVisible: false, headerTitleStyle: { color: colors.text } }} />
          <Stack.Screen name="auth" options={{ headerShown: false, animation: 'none' }} />
          <Stack.Screen name="cadastro" options={{ presentation: 'modal', title: 'Criar conta', headerShadowVisible: false, headerTitleStyle: { color: colors.text } }} />
          <Stack.Screen name="redefinir-senha" options={{ presentation: 'modal', title: 'Senha', headerShadowVisible: false, headerTitleStyle: { color: colors.text } }} />
          <Stack.Screen name="minha-conta/index" options={{ title: 'Minha conta', headerShadowVisible: false, headerTitleStyle: { color: colors.text } }} />
          <Stack.Screen name="minha-conta/excluir" options={{ presentation: 'modal', title: 'Excluir conta', headerShadowVisible: false, headerTitleStyle: { color: colors.text } }} />
          <Stack.Screen name="avisos" options={{ title: 'Avisos', headerShadowVisible: false, headerTitleStyle: { color: colors.text } }} />
          <Stack.Screen name="notificacoes" options={{ title: 'Notificações', headerShadowVisible: false, headerTitleStyle: { color: colors.text } }} />
          <Stack.Screen name="fila-espera" options={{ title: 'Fila de espera', headerShadowVisible: false, headerTitleStyle: { color: colors.text } }} />
          <Stack.Screen name="meus-anuncios/index" options={{ title: 'Meus anúncios', headerShadowVisible: false, headerTitleStyle: { color: colors.text } }} />
          <Stack.Screen name="meus-anuncios/[id]" options={{ title: 'Editar anúncio', headerShadowVisible: false, headerTitleStyle: { color: colors.text } }} />
          <Stack.Screen name="meus-anuncios/lote/[id]" options={{ title: 'Editar lote', headerShadowVisible: false, headerTitleStyle: { color: colors.text } }} />
          <Stack.Screen name="meus-anuncios/estatisticas" options={{ title: 'Estatísticas', headerShadowVisible: false, headerTitleStyle: { color: colors.text } }} />
          <Stack.Screen name="mensagens/index" options={{ title: 'Mensagens', headerShadowVisible: false, headerTitleStyle: { color: colors.text } }} />
          <Stack.Screen name="mensagens/[id]" options={{ title: 'Conversa', headerShadowVisible: false, headerTitleStyle: { color: colors.text } }} />
          <Stack.Screen name="admin/index" options={{ title: 'Painel administrativo', headerShadowVisible: false, headerTitleStyle: { color: colors.text } }} />
          <Stack.Screen name="admin/observabilidade" options={{ title: 'Observabilidade', headerShadowVisible: false, headerTitleStyle: { color: colors.text } }} />
          <Stack.Screen name="admin/usuarios/index" options={{ title: 'Usuários', headerShadowVisible: false, headerTitleStyle: { color: colors.text } }} />
          <Stack.Screen name="admin/usuarios/[id]" options={{ title: 'Conta', headerShadowVisible: false, headerTitleStyle: { color: colors.text } }} />
          <Stack.Screen name="admin/usuarios/novo" options={{ presentation: 'modal', title: 'Novo usuário', headerShadowVisible: false, headerTitleStyle: { color: colors.text } }} />
          <Stack.Screen name="admin/limite" options={{ title: 'Limite de anúncios', headerShadowVisible: false, headerTitleStyle: { color: colors.text } }} />
          <Stack.Screen name="admin/impulsos" options={{ title: 'Impulsionados', headerShadowVisible: false, headerTitleStyle: { color: colors.text } }} />
          <Stack.Screen name="admin/promocoes" options={{ title: 'Promoções', headerShadowVisible: false, headerTitleStyle: { color: colors.text } }} />
          <Stack.Screen name="admin/banners/index" options={{ title: 'Banners', headerShadowVisible: false, headerTitleStyle: { color: colors.text } }} />
          <Stack.Screen name="admin/banners/[id]" options={{ title: 'Banner', headerShadowVisible: false, headerTitleStyle: { color: colors.text } }} />
          <Stack.Screen name="admin/conversas/index" options={{ title: 'Conversas', headerShadowVisible: false, headerTitleStyle: { color: colors.text } }} />
          <Stack.Screen name="admin/conversas/[id]" options={{ title: 'Conversa', headerShadowVisible: false, headerTitleStyle: { color: colors.text } }} />
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
