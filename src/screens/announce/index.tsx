import { router } from 'expo-router';
import { Camera, CircleCheck, Table2, UserRound, type LucideIcon } from 'lucide-react-native';
import { Alert, ScrollView, StyleSheet, View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppText } from '@/components/app-text';
import { Button } from '@/components/button';
import { useTheme } from '@/hooks/use-theme';
import { radius, space } from '@/theme';

const steps: { icon: LucideIcon; title: string; text: string }[] = [
  { icon: UserRound, title: 'Entre na sua conta', text: 'Confira seus dados de anunciante, como no site.' },
  { icon: Table2, title: 'Escolha o veículo na FIPE', text: 'Marca, modelo e versão vêm da tabela oficial.' },
  { icon: Camera, title: 'Fotos, vídeo e laudo', text: 'Até 8 fotos direto da câmera ou da galeria.' },
  { icon: CircleCheck, title: 'Publique', text: 'O anúncio aparece no app e no site ao mesmo tempo.' },
];

/** Entrada do fluxo de anúncio (modal aberto pelo botão central da barra). */
export function Announce() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  return (
    <View style={[styles.root, { backgroundColor: colors.bg }]}>
      <ScrollView contentContainerStyle={styles.content}>
        <AppText variant="display">Venda seu veículo pela PHC Auto</AppText>
        <AppText color="muted">Carros, motos, caminhões, caminhonetes, barcos e linha amarela.</AppText>
        <View style={styles.steps}>
          {steps.map(({ icon: Icon, title, text }, index) => (
            // Entrada escalonada: acontece uma vez, ao abrir o fluxo.
            <Animated.View
              key={title}
              entering={FadeInDown.delay(80 + index * 60).duration(320)}
              style={[styles.step, { backgroundColor: colors.subtle }]}>
              <View style={[styles.number, { backgroundColor: colors.redTint }]}>
                <Icon size={20} color={colors.red} />
              </View>
              <View style={styles.flex}>
                <AppText variant="bodyStrong">
                  {index + 1}. {title}
                </AppText>
                <AppText variant="caption" color="muted">
                  {text}
                </AppText>
              </View>
            </Animated.View>
          ))}
        </View>
      </ScrollView>
      <View style={[styles.actions, { paddingBottom: insets.bottom + space.md, borderTopColor: colors.border }]}>
        <Button
          label="Entrar para anunciar"
          onPress={() => Alert.alert('Login', 'O login e o cadastro do anúncio são a próxima etapa do app.')}
        />
        <Button label="Agora não" variant="ghost" onPress={() => router.back()} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  flex: { flex: 1 },
  content: { padding: space.lg, gap: space.sm },
  steps: { gap: space.md, marginTop: space.xl },
  step: { flexDirection: 'row', alignItems: 'center', gap: space.md, padding: space.lg, borderRadius: radius.lg },
  number: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  actions: { paddingHorizontal: space.lg, paddingTop: space.md, gap: space.xs, borderTopWidth: StyleSheet.hairlineWidth },
});
