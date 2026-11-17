import { useQuery } from '@tanstack/react-query';
import Constants from 'expo-constants';
import * as Haptics from 'expo-haptics';
import { Image } from 'expo-image';
import { router, type Href } from 'expo-router';
import {
  Activity,
  AtSign,
  LogOut,
  Bell,
  BellRing,
  ChevronRight,
  Clock,
  CreditCard,
  FileText,
  LayoutDashboard,
  MessageCircle,
  MessagesSquare,
  Server,
  ShieldCheck,
  ShoppingBag,
  UserRound,
  Store,
  Table2,
  Tags,
  Warehouse,
  type LucideIcon,
} from 'lucide-react-native';
import { Linking, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { fetchStatus } from '@/api/ads';
import { authApi } from '@/api/auth';
import { apiOrigin } from '@/api/client';
import { salesApi } from '@/api/sales';
import type { SessionUser } from '@/api/session-store';
import { AppText } from '@/components/app-text';
import { Button } from '@/components/button';
import { showDialog } from '@/components/dialog';
import { Skeleton } from '@/components/skeleton';
import { company, formatPhone } from '@/data/company';
import { useAccount } from '@/hooks/use-account';
import { useNoticesSummary } from '@/hooks/use-notices';
import { isStaff, useSession } from '@/hooks/use-session';
import { useTheme, type ThemePreference } from '@/hooks/use-theme';
import { radius, space } from '@/theme';

type Item = { icon: LucideIcon; label: string; note?: string; highlight?: boolean; onPress?: () => void };

function soon(label: string) {
  return () => showDialog({ title: label, message: 'Esta área do site ainda está sendo trazida para o app.' });
}

function accountItems(unreadNotices: number): Item[] {
  return [
    { icon: UserRound, label: 'Minha conta', onPress: () => router.push('/minha-conta') },
    { icon: Tags, label: 'Meus anúncios', onPress: () => router.push('/meus-anuncios' as Href) },
    { icon: MessagesSquare, label: 'Mensagens', onPress: () => router.push('/mensagens' as Href) },
    {
      icon: Bell,
      label: 'Avisos',
      note: unreadNotices ? (unreadNotices === 1 ? '1 novo' : `${unreadNotices} novos`) : undefined,
      highlight: unreadNotices > 0,
      onPress: () => router.push('/avisos'),
    },
    { icon: Clock, label: 'Fila de espera', onPress: () => router.push('/fila-espera') },
    { icon: BellRing, label: 'Notificações', onPress: () => router.push('/notificacoes' as Href) },
    { icon: ShoppingBag, label: 'Minhas compras', onPress: soon('Minhas compras') },
  ];
}

const explore: Item[] = [
  { icon: Store, label: 'Lojistas', onPress: () => router.push('/lojistas' as Href) },
  { icon: Warehouse, label: 'Pátio PHC', onPress: () => router.push('/patio' as Href) },
  { icon: Table2, label: 'Tabela FIPE', onPress: () => router.push('/tabela-fipe' as Href) },
  { icon: CreditCard, label: 'Planos e preços', onPress: () => router.push('/planos' as Href) },
];

const admin: Item[] = [
  { icon: LayoutDashboard, label: 'Painel administrativo', onPress: soon('Painel administrativo') },
  { icon: Activity, label: 'Observabilidade', onPress: soon('Observabilidade') },
];

const papelLabels: Record<string, string> = { CLIENTE: 'Cliente', ADMIN: 'Administrador', DONO: 'Dono' };

function openExternal(url: string, label: string) {
  Linking.openURL(url).catch(() => showDialog({ title: label, message: `Não foi possível abrir o ${label} neste aparelho.` }));
}

function confirmLogout() {
  showDialog({
    title: 'Sair da conta?',
    message: 'Para voltar, você vai precisar entrar com e-mail e senha ou Google.',
    actions: [
      { label: 'Cancelar', kind: 'cancel' },
      {
        label: 'Sair',
        kind: 'destructive',
        onPress: () => {
          // Mesmo sem rede a sessão some do aparelho; o servidor revoga quando recebe o pedido.
          authApi.logout().catch(() => undefined);
        },
      },
    ],
  });
}

export function MenuScreen() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const status = useQuery({ queryKey: ['status'], queryFn: ({ signal }) => fetchStatus(signal), refetchInterval: 30_000 });
  const online = status.data?.status === 'UP';
  const session = useSession();
  const user = session.status === 'authenticated' ? session.user : null;
  const notices = useNoticesSummary();
  // O WhatsApp do atendimento vem do servidor e some se não estiver cadastrado, como no rodapé do site.
  const support = useQuery({
    queryKey: ['support-whatsapp'],
    queryFn: ({ signal }) => salesApi.supportWhatsapp(signal),
    staleTime: 60 * 60_000,
  });

  return (
    <ScrollView
      style={{ backgroundColor: colors.bg }}
      contentContainerStyle={[styles.content, { paddingTop: insets.top + space.sm }]}>
      <AppText variant="display" accessibilityRole="header">
        Menu
      </AppText>

      {user ? (
        <AccountCard user={user} />
      ) : session.status === 'loading' ? (
        <View style={[styles.account, { backgroundColor: colors.subtle }]}>
          <Skeleton width={52} height={52} rounded={26} />
          <View style={[styles.flex, { gap: space.sm }]}>
            <Skeleton width="60%" height={16} />
            <Skeleton width="80%" height={12} />
          </View>
        </View>
      ) : (
        <>
          <View style={[styles.account, { backgroundColor: colors.subtle }]}>
            <Image source={require('@/assets/images/phc-auto-logo-disc.png')} style={styles.logo} />
            <View style={styles.flex}>
              <AppText variant="heading">Entre na sua conta</AppText>
              <AppText variant="caption" color="muted">
                Para anunciar, conversar com vendedores e acompanhar suas compras.
              </AppText>
            </View>
          </View>
          <Button label="Entrar ou criar conta" onPress={() => router.push('/entrar')} />
        </>
      )}

      {user ? <Group title="Sua conta" items={accountItems(notices.data?.naoLidos ?? 0)} /> : null}
      <Group title="Explorar" items={explore} />
      <ThemePicker />
      {user && isStaff(user.papel) ? <Group title="Administração" items={admin} /> : null}

      <View style={styles.group}>
        <AppText variant="overline" color="muted" style={styles.groupTitle}>
          Sobre
        </AppText>
        <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <Row
            icon={ShieldCheck}
            label="Privacidade e termos"
            onPress={() => router.push('/privacidade' as Href)}
          />
          <Divider />
          {support.data ? (
            <>
              <Row
                icon={MessageCircle}
                label="Atendimento"
                note={formatPhone(support.data)}
                onPress={() => openExternal(`https://wa.me/${support.data}`, 'WhatsApp')}
              />
              <Divider />
            </>
          ) : null}
          <Row
            icon={AtSign}
            label="Instagram"
            note={`@${company.instagram}`}
            onPress={() => openExternal(`https://www.instagram.com/${company.instagram}/`, 'Instagram')}
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
        <View style={styles.legal}>
          <AppText variant="caption" color="muted" selectable>
            {company.razaoSocial}
          </AppText>
          <AppText variant="caption" color="muted" selectable>
            CNPJ {company.cnpj} · {company.endereco}
          </AppText>
        </View>
      </View>

      {user ? (
        <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <Pressable
            onPress={confirmLogout}
            accessibilityRole="button"
            style={({ pressed }) => [styles.row, pressed && { backgroundColor: colors.subtle }]}>
            <LogOut size={20} color={colors.red} />
            <AppText variant="bodyStrong" color="red" style={styles.flex}>
              Sair da conta
            </AppText>
          </Pressable>
        </View>
      ) : null}
    </ScrollView>
  );
}

/** Quem está logado: nome e e-mail vêm do perfil (GET /usuarios/{id}). */
function AccountCard({ user }: { user: SessionUser }) {
  const { colors } = useTheme();
  const profile = useAccount();
  const name = profile.data?.razaoSocial || profile.data?.nome;
  const initial = name?.trim().charAt(0).toLocaleUpperCase('pt-BR') ?? '';
  return (
    <Pressable
      onPress={() => router.push('/minha-conta')}
      accessibilityRole="button"
      accessibilityLabel={name ? `Conectado como ${name}` : 'Conectado'}
      accessibilityHint="Abre seus dados, foto e senha"
      style={({ pressed }) => [styles.account, { backgroundColor: colors.subtle }, pressed && { opacity: 0.8 }]}>
      <View style={[styles.avatar, { backgroundColor: colors.red }]}>
        <AppText variant="title" color="onRed">
          {initial}
        </AppText>
      </View>
      <View style={styles.flex}>
        {profile.isPending ? (
          <View style={{ gap: space.sm }}>
            <Skeleton width="60%" height={16} />
            <Skeleton width="80%" height={12} />
          </View>
        ) : profile.isError ? (
          <>
            <AppText variant="heading">Você está conectado</AppText>
            <Pressable onPress={() => profile.refetch()} accessibilityRole="button" hitSlop={8}>
              <AppText variant="caption" color="red">
                Não carregamos seu perfil. Tocar para tentar de novo
              </AppText>
            </Pressable>
          </>
        ) : (
          <>
            <AppText variant="heading" numberOfLines={1}>
              {name}
            </AppText>
            <AppText variant="caption" color="muted" numberOfLines={1}>
              {profile.data?.email}
            </AppText>
          </>
        )}
      </View>
      <View style={[styles.badge, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <AppText variant="label">{papelLabels[user.papel] ?? user.papel}</AppText>
      </View>
    </Pressable>
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
function Row({ icon: Icon, label, note, highlight, onPress }: Item) {
  const { colors } = useTheme();
  return (
    <Pressable
      onPress={onPress}
      disabled={!onPress}
      accessibilityRole={onPress ? 'button' : 'text'}
      accessibilityLabel={note ? `${label}, ${note}` : label}
      style={({ pressed }) => [styles.row, pressed && { backgroundColor: colors.subtle }]}>
      <Icon size={20} color={colors.text} />
      <AppText variant="bodyStrong" style={styles.flex}>
        {label}
      </AppText>
      {note ? (
        highlight ? (
          <View style={[styles.pill, { backgroundColor: colors.red }]}>
            <AppText variant="label" color="onRed">
              {note}
            </AppText>
          </View>
        ) : (
          <AppText variant="caption" color="muted">
            {note}
          </AppText>
        )
      ) : null}
      {onPress ? <ChevronRight size={18} color={colors.muted} /> : null}
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
  avatar: { width: 52, height: 52, borderRadius: 26, alignItems: 'center', justifyContent: 'center' },
  badge: { paddingHorizontal: space.sm, paddingVertical: 4, borderRadius: radius.pill, borderWidth: StyleSheet.hairlineWidth },
  group: { gap: space.sm, marginTop: space.sm },
  groupTitle: { paddingHorizontal: space.xs },
  card: { borderRadius: radius.lg, borderWidth: StyleSheet.hairlineWidth, overflow: 'hidden' },
  row: { flexDirection: 'row', alignItems: 'center', gap: space.md, paddingHorizontal: space.lg, minHeight: 52, paddingVertical: space.sm },
  divider: { height: StyleSheet.hairlineWidth, marginLeft: space.lg + 20 + space.md },
  status: { width: 8, height: 8, borderRadius: 4 },
  legal: { paddingHorizontal: space.xs, gap: 2 },
  pill: { paddingHorizontal: space.sm, paddingVertical: 2, borderRadius: radius.pill },
  segmented: { flexDirection: 'row', padding: 3, borderRadius: radius.md },
  segment: { flex: 1, minHeight: 40, alignItems: 'center', justifyContent: 'center', borderRadius: radius.sm + 1 },
});
