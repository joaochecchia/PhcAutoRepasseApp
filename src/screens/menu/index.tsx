import { useQuery } from '@tanstack/react-query';
import Constants from 'expo-constants';
import * as Haptics from 'expo-haptics';
import { Image } from 'expo-image';
import * as WebBrowser from 'expo-web-browser';
import {
  Activity,
  Bell,
  ChevronRight,
  Clock,
  CreditCard,
  FileText,
  LayoutDashboard,
  Lock,
  MessagesSquare,
  Server,
  ShieldCheck,
  ShoppingBag,
  Store,
  Table2,
  Tags,
  Warehouse,
  type LucideIcon,
} from 'lucide-react-native';
import { Alert, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { fetchStatus } from '@/api/ads';
import { apiOrigin } from '@/api/client';
import { AppText } from '@/components/app-text';
import { Button } from '@/components/button';
import { useTheme, type ThemePreference } from '@/hooks/use-theme';
import { radius, space } from '@/theme';

type Item = { icon: LucideIcon; label: string; note?: string; onPress?: () => void; locked?: boolean };

function soon(label: string) {
  return () => Alert.alert(label, 'Esta área do site ainda está sendo trazida para o app.');
}

const account: Item[] = [
  { icon: Tags, label: 'Meus anúncios', onPress: soon('Meus anúncios') },
  { icon: MessagesSquare, label: 'Mensagens', onPress: soon('Mensagens') },
  { icon: Bell, label: 'Avisos', onPress: soon('Avisos') },
  { icon: Clock, label: 'Fila de espera', onPress: soon('Fila de espera') },
  { icon: ShoppingBag, label: 'Minhas compras', onPress: soon('Minhas compras') },
];

const explore: Item[] = [
  { icon: Store, label: 'Lojistas', onPress: soon('Lojistas') },
  { icon: Warehouse, label: 'Pátio PHC', onPress: soon('Pátio PHC') },
  { icon: Table2, label: 'Tabela FIPE', onPress: soon('Tabela FIPE') },
  { icon: CreditCard, label: 'Planos e preços', onPress: soon('Planos e preços') },
];

const admin: Item[] = [
  { icon: LayoutDashboard, label: 'Painel administrativo', note: 'Admin e dono', locked: true },
  { icon: Activity, label: 'Observabilidade', note: 'Admin e dono', locked: true },
];

export function MenuScreen() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const status = useQuery({ queryKey: ['status'], queryFn: ({ signal }) => fetchStatus(signal), refetchInterval: 30_000 });
  const online = status.data?.status === 'UP';

  return (
    <ScrollView
      style={{ backgroundColor: colors.bg }}
      contentContainerStyle={[styles.content, { paddingTop: insets.top + space.sm }]}>
      <AppText variant="display" accessibilityRole="header">
        Menu
      </AppText>

      <View style={[styles.account, { backgroundColor: colors.subtle }]}>
        <Image source={require('@/assets/images/phc-auto-logo-disc.png')} style={styles.logo} />
        <View style={styles.flex}>
          <AppText variant="heading">Entre na sua conta</AppText>
          <AppText variant="caption" color="muted">
            Para anunciar, conversar com vendedores e salvar favoritos em todos os aparelhos.
          </AppText>
        </View>
      </View>
      <Button
        label="Entrar ou criar conta"
        onPress={() => Alert.alert('Login', 'O login com verificação por e-mail é a próxima etapa do app.')}
      />

      <Group title="Sua conta" items={account} />
      <Group title="Explorar" items={explore} />
      <ThemePicker />
      <Group title="Administração" items={admin} />

      <View style={styles.group}>
        <AppText variant="overline" color="muted" style={styles.groupTitle}>
          Sobre
        </AppText>
        <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <Row
            icon={ShieldCheck}
            label="Privacidade e termos"
            onPress={() => WebBrowser.openBrowserAsync('https://phcauto.com/privacidade')}
          />
          <Divider />
          <Pressable onPress={() => status.refetch()} accessibilityRole="button" accessibilityLabel={`Servidor ${online ? 'no ar' : 'fora do ar'}, ${apiOrigin}`} style={styles.row}>
            <Server size={20} color={colors.text} />
            <View style={styles.flex}>
              <AppText variant="bodyStrong">Servidor</AppText>
              <AppText variant="caption" color="muted" numberOfLines={1}>
                {apiOrigin}
              </AppText>
            </View>
            <View style={[styles.status, { backgroundColor: status.isPending ? colors.border : online ? colors.deal : colors.red }]} />
            <AppText variant="caption" color="muted">
              {status.isPending ? 'Verificando' : online ? 'No ar' : 'Fora do ar'}
            </AppText>
          </Pressable>
          <Divider />
          <Row icon={FileText} label="Versão" note={Constants.expoConfig?.version ?? '—'} />
        </View>
      </View>
    </ScrollView>
  );
}

function ThemePicker() {
  const { colors, preference, setPreference } = useTheme();
  const options: { key: ThemePreference; label: string }[] = [
    { key: 'system', label: 'Sistema' },
    { key: 'light', label: 'Claro' },
    { key: 'dark', label: 'Escuro' },
  ];
  return (
    <View style={styles.group}>
      <AppText variant="overline" color="muted" style={styles.groupTitle}>
        Aparência
      </AppText>
      <View style={[styles.segmented, { backgroundColor: colors.subtle }]} accessibilityRole="radiogroup">
        {options.map((option) => {
          const active = preference === option.key;
          return (
            <Pressable
              key={option.key}
              accessibilityRole="radio"
              accessibilityState={{ checked: active }}
              onPress={() => {
                if (active) return;
                Haptics.selectionAsync();
                setPreference(option.key);
              }}
              style={[styles.segment, active && { backgroundColor: colors.surface, borderColor: colors.border, borderWidth: StyleSheet.hairlineWidth }]}>
              <AppText variant="label" color={active ? 'text' : 'muted'}>
                {option.label}
              </AppText>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

function Group({ title, items }: { title: string; items: Item[] }) {
  const { colors } = useTheme();
  return (
    <View style={styles.group}>
      <AppText variant="overline" color="muted" style={styles.groupTitle}>
        {title}
      </AppText>
      <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        {items.map((item, index) => (
          <View key={item.label}>
            {index > 0 ? <Divider /> : null}
            <Row {...item} />
          </View>
        ))}
      </View>
    </View>
  );
}

/** Linha larga de lista: destaca o fundo ao tocar, sem escala (skill expo-animation). */
function Row({ icon: Icon, label, note, onPress, locked }: Item) {
  const { colors } = useTheme();
  return (
    <Pressable
      onPress={onPress}
      disabled={!onPress}
      accessibilityRole={onPress ? 'button' : 'text'}
      accessibilityLabel={note ? `${label}, ${note}` : label}
      style={({ pressed }) => [styles.row, pressed && { backgroundColor: colors.subtle }]}>
      <Icon size={20} color={locked ? colors.muted : colors.text} />
      <AppText variant="bodyStrong" color={locked ? 'muted' : 'text'} style={styles.flex}>
        {label}
      </AppText>
      {note ? (
        <AppText variant="caption" color="muted">
          {note}
        </AppText>
      ) : null}
      {locked ? <Lock size={16} color={colors.muted} /> : onPress ? <ChevronRight size={18} color={colors.muted} /> : null}
    </Pressable>
  );
}

function Divider() {
  const { colors } = useTheme();
  return <View style={[styles.divider, { backgroundColor: colors.border }]} />;
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: space.lg, paddingBottom: space.xxxl, gap: space.lg },
  flex: { flex: 1 },
  account: { flexDirection: 'row', alignItems: 'center', gap: space.md, padding: space.lg, borderRadius: radius.lg },
  logo: { width: 52, height: 52 },
  group: { gap: space.sm, marginTop: space.sm },
  groupTitle: { paddingHorizontal: space.xs },
  card: { borderRadius: radius.lg, borderWidth: StyleSheet.hairlineWidth, overflow: 'hidden' },
  row: { flexDirection: 'row', alignItems: 'center', gap: space.md, paddingHorizontal: space.lg, minHeight: 52, paddingVertical: space.sm },
  divider: { height: StyleSheet.hairlineWidth, marginLeft: space.lg + 20 + space.md },
  status: { width: 8, height: 8, borderRadius: 4 },
  segmented: { flexDirection: 'row', padding: 3, borderRadius: radius.md },
  segment: { flex: 1, minHeight: 40, alignItems: 'center', justifyContent: 'center', borderRadius: radius.sm + 1 },
});
