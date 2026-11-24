import { useQuery } from '@tanstack/react-query';
import { router, type Href } from 'expo-router';
import {
  Activity,
  BellRing,
  CarFront,
  Flag,
  GalleryHorizontal,
  ImageUp,
  MessagesSquare,
  Rocket,
  TicketPercent,
  UsersRound,
  type LucideIcon,
} from 'lucide-react-native';
import { RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { adminApi } from '@/api/admin';
import { AppText } from '@/components/app-text';
import { useOpenReports } from '@/hooks/use-open-reports';
import { usePhotosInReview } from '@/hooks/use-photos-in-review';
import { useSession } from '@/hooks/use-session';
import { useTheme } from '@/hooks/use-theme';
import { radius, space } from '@/theme';

import { AdminGate } from './admin-gate';
import { observabilityKey } from './observability';
import { AdminRow, AdminSection, Divider } from './ui';

type Entry = { icon: LucideIcon; title: string; detail: string; href: Href };

const ownerEntries: Entry[] = [
  { icon: UsersRound, title: 'Usuários', detail: 'Contas, papéis, bloqueio e planos cortesia', href: '/admin/usuarios' },
  { icon: CarFront, title: 'Limite de anúncios', detail: 'Liberar anúncios ilimitados para todos', href: '/admin/limite' },
  { icon: TicketPercent, title: 'Promoções', detail: 'Promoções de todos os anunciantes', href: '/admin/promocoes' },
];
const staffEntries: Entry[] = [
  { icon: Rocket, title: 'Impulsionados', detail: 'Anúncios nas vagas de destaque', href: '/admin/impulsos' },
  { icon: GalleryHorizontal, title: 'Banners da tela inicial', detail: 'Carrossel do site e do app', href: '/admin/banners' },
  { icon: MessagesSquare, title: 'Conversas', detail: 'Leitura das conversas para moderação', href: '/admin/conversas' },
];

/** Painel administrativo (AdminPage do site): DONO vê tudo; ADMIN, impulsos, banners, conversas e observabilidade. */
export function AdminScreen() {
  return (
    <AdminGate>
      <AdminHub />
    </AdminGate>
  );
}

function AdminHub() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const session = useSession();
  const owner = session.status === 'authenticated' && session.user.papel === 'DONO';
  const panel = useQuery({ queryKey: observabilityKey, queryFn: ({ signal }) => adminApi.observability(signal), staleTime: 30_000 });
  const activeAlerts = panel.data?.alertas?.ativos ?? [];
  const servicesDown = panel.data?.servicos.filter((service) => service.status !== 'UP').length ?? 0;
  const problems = Math.max(activeAlerts.length, servicesDown);
  const openReports = useOpenReports(true);
  const photosInReview = usePhotosInReview(true);

  return (
    <ScrollView
      style={{ backgroundColor: colors.bg }}
      contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + space.xxl }]}
      refreshControl={
        <RefreshControl
          refreshing={panel.isRefetching}
          onRefresh={() => {
            void panel.refetch();
            void openReports.refetch();
            void photosInReview.refetch();
          }}
          tintColor={colors.red}
        />
      }>
      <AppText color="muted">
        {owner
          ? 'Contas e planos, limite de anúncios, promoções, impulsos, banners, denúncias, fotos em revisão, conversas e a saúde do sistema.'
          : 'Impulsos, banners, denúncias, fotos em revisão, conversas e a saúde do sistema.'}
      </AppText>

      <AdminSection title="Saúde do sistema">
        <AdminRow
          icon={Activity}
          iconColor={problems ? 'red' : 'text'}
          title="Observabilidade"
          detail={
            panel.isPending
              ? 'Verificando os serviços…'
              : panel.isError
                ? 'Não foi possível consultar agora'
                : problems
                  ? `${problems === 1 ? '1 problema' : `${problems} problemas`} agora`
                  : 'Serviços no ar, sem alertas'
          }
          trailing={
            panel.data ? <View style={[styles.dot, { backgroundColor: problems ? colors.red : colors.deal }]} /> : null
          }
          onPress={() => router.push('/admin/observabilidade')}
        />
        <Divider />
        <AdminRow
          icon={BellRing}
          title="Alertas no celular"
          detail="Escolha em Notificações se este aparelho recebe os alertas"
          onPress={() => router.push('/notificacoes')}
        />
      </AdminSection>

      <AdminSection title="Moderação">
        <AdminRow
          icon={Flag}
          iconColor={openReports.data ? 'red' : 'text'}
          title="Denúncias"
          detail={
            openReports.isPending
              ? 'Contando as denúncias…'
              : openReports.isError
                ? 'Usuários, anúncios e a fila de denúncias'
                : openReports.data
                  ? `${openReports.data === 1 ? '1 denúncia aguardando' : `${openReports.data} denúncias aguardando`} análise`
                  : 'Nenhuma denúncia aguardando'
          }
          trailing={openReports.data ? <CountBadge value={openReports.data} /> : null}
          onPress={() => router.push('/admin/denuncias')}
        />
        <Divider />
        <AdminRow
          icon={ImageUp}
          iconColor={photosInReview.data ? 'red' : 'text'}
          title="Fotos em revisão"
          detail={
            photosInReview.isPending
              ? 'Contando as fotos…'
              : photosInReview.isError
                ? 'Fotos que a análise automática deixou para a equipe'
                : photosInReview.data
                  ? `${photosInReview.data === 1 ? '1 foto aguardando' : `${photosInReview.data} fotos aguardando`} decisão`
                  : 'Nenhuma foto aguardando'
          }
          trailing={photosInReview.data ? <CountBadge value={photosInReview.data} /> : null}
          onPress={() => router.push('/admin/fotos')}
        />
      </AdminSection>

      {owner ? <Entries title="Dono" entries={ownerEntries} /> : null}
      <Entries title="Administração" entries={staffEntries} />
    </ScrollView>
  );
}

function CountBadge({ value }: { value: number }) {
  const { colors } = useTheme();
  return (
    <View style={[styles.count, { backgroundColor: colors.red }]}>
      <AppText variant="label" color="onRed">
        {value > 99 ? '99+' : value}
      </AppText>
    </View>
  );
}

function Entries({ title, entries }: { title: string; entries: Entry[] }) {
  return (
    <AdminSection title={title}>
      {entries.map((entry, index) => (
        <View key={entry.title}>
          {index > 0 ? <Divider /> : null}
          <AdminRow icon={entry.icon} title={entry.title} detail={entry.detail} onPress={() => router.push(entry.href)} />
        </View>
      ))}
    </AdminSection>
  );
}

const styles = StyleSheet.create({
  content: { padding: space.lg, gap: space.xl },
  dot: { width: 10, height: 10, borderRadius: radius.pill },
  count: { minWidth: 24, paddingHorizontal: space.sm, paddingVertical: 2, borderRadius: radius.pill, alignItems: 'center' },
});
