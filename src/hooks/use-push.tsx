import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import * as Haptics from 'expo-haptics';
import * as Notifications from 'expo-notifications';
import { router, usePathname, type Href } from 'expo-router';
import { useEffect, useRef } from 'react';
import { AppState, Linking, Platform } from 'react-native';
import { useAnimatedReaction } from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';

import { noticeRoute, noticesApi } from '@/api/notices';
import {
  askPushPermission,
  ensurePushChannels,
  markPushInviteSeen,
  pushInviteSeen,
  pushStatus,
  pushSupport,
  syncPush,
  unregisterPush,
  type PushStatus,
} from '@/api/push';
import { showDialog } from '@/components/dialog';
import { showInAppNotice } from '@/components/in-app-notice';
import { useIntroProgress } from '@/hooks/use-intro';
import { useNoticesSummary } from '@/hooks/use-notices';
import { isStaff, useSession } from '@/hooks/use-session';

/** Mesma chave da tela Menu › Notificações: ativar num lugar atualiza os outros. */
export const pushStatusKey = ['push-status'] as const;

export function usePushStatus() {
  const queryClient = useQueryClient();
  // Voltando dos ajustes do aparelho, a permissão pode ter mudado.
  useEffect(() => {
    const subscription = AppState.addEventListener('change', (next) => {
      if (next === 'active') queryClient.invalidateQueries({ queryKey: pushStatusKey });
    });
    return () => subscription.remove();
  }, [queryClient]);
  return useQuery({ queryKey: pushStatusKey, queryFn: pushStatus, staleTime: 0, enabled: Platform.OS !== 'web' });
}

/**
 * Ativa as notificações: mostra o pedido do sistema e, com sessão, registra o aparelho. Se o sistema já não deixa
 * perguntar (a pessoa recusou antes), abre os ajustes do app no aparelho.
 */
export function useEnablePush() {
  const queryClient = useQueryClient();
  const authenticated = useSession().status === 'authenticated';
  return useMutation({
    mutationFn: async () => {
      const before = await pushStatus();
      if (before.permission !== 'granted' && !before.canAsk) {
        await Linking.openSettings();
        return before;
      }
      const after = await askPushPermission();
      return after.permission === 'granted' && authenticated ? syncPush() : after;
    },
    onSuccess: (next) => {
      queryClient.setQueryData<PushStatus>(pushStatusKey, next);
      if (next.permission === 'granted') Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    },
  });
}

/** Tela aberta agora: o push da conversa que a pessoa já está lendo não aparece. */
let currentPath = '';

/** Abre a tela do aviso (anúncio, lote ou conversa) e o marca como lido. */
function openNotice(data: Record<string, unknown> | undefined, onRead: () => void) {
  const { link, aviso } = data ?? {};
  if (typeof aviso === 'string') noticesApi.markRead([aviso]).then(onRead).catch(() => undefined);
  const route = typeof link === 'string' ? noticeRoute(link) : null;
  router.push((route ?? '/avisos') as Href);
}

let onNoticeRead: () => void = () => undefined;

if (Platform.OS !== 'web') {
  // Só roda com o app em primeiro plano: em vez da notificação do sistema, o aviso aparece dentro do app. Na
  // conversa que a pessoa já está lendo, não aparece nada.
  Notifications.setNotificationHandler({
    handleNotification: async (notification) => {
      const { title, body, data } = notification.request.content;
      const link = data?.link;
      const viewing = typeof link === 'string' && link === currentPath;
      if (!viewing && title) {
        showInAppNotice({
          id: notification.request.identifier,
          title,
          body: body ?? undefined,
          kind: typeof data?.tipo === 'string' ? data.tipo : undefined,
          onPress: () => openNotice(data, onNoticeRead),
        });
      }
      return { shouldShowBanner: false, shouldShowList: false, shouldPlaySound: false, shouldSetBadge: true };
    },
  });
}

/**
 * Notificações push: registra o aparelho quando há sessão e a permissão já foi dada (o pedido de permissão aparece
 * em momentos com contexto, ver askForPush), abre a tela do aviso ao tocar e mantém o número no ícone (iOS).
 */
export function PushNotifications() {
  if (Platform.OS === 'web') return null;
  return (
    <>
      <PushEffects />
      <FirstRunInvite />
    </>
  );
}

/**
 * Na primeira abertura, depois da animação da logo, convida a ativar as notificações com o diálogo do app. O pedido
 * do sistema só aparece se a pessoa tocar em "Ativar" (no iOS ele só pode aparecer uma vez). Aparece uma vez por
 * aparelho, e nunca onde o push não funciona ou já está ativado.
 */
function FirstRunInvite() {
  const intro = useIntroProgress();
  const enable = useEnablePush();
  const { mutate } = enable;
  const shown = useRef(false);

  const invite = () => {
    if (shown.current) return;
    shown.current = true;
    (async () => {
      if (await pushInviteSeen()) return;
      const status = await pushStatus();
      if (status.support !== 'ok') return;
      await markPushInviteSeen();
      if (status.permission === 'granted' || !status.canAsk) return;
      showDialog({
        title: 'Ative as notificações',
        message: 'Avisamos quando alguém responder suas mensagens e quando chegar um veículo da sua fila de espera.',
        actions: [
          { label: 'Agora não', kind: 'cancel' },
          { label: 'Ativar', onPress: () => mutate() },
        ],
      });
    })().catch(() => undefined);
  };

  useAnimatedReaction(
    () => intro.get() >= 1,
    (done, previous) => {
      if (done && !previous) scheduleOnRN(invite);
    },
  );
  return null;
}

function PushEffects() {
  const session = useSession();
  const queryClient = useQueryClient();
  const pathname = usePathname();
  const summary = useNoticesSummary();
  const handled = useRef<string | null>(null);
  const response = Notifications.useLastNotificationResponse();
  const authenticated = session.status === 'authenticated';

  useEffect(() => {
    currentPath = pathname;
  }, [pathname]);

  useEffect(() => {
    onNoticeRead = () => queryClient.invalidateQueries({ queryKey: ['notices-summary'] });
  }, [queryClient]);

  const staff = session.status === 'authenticated' && isStaff(session.user.papel);
  useEffect(() => {
    ensurePushChannels(staff).catch(() => undefined);
  }, [staff]);

  useEffect(() => {
    if (session.status === 'authenticated') syncPush().catch(() => undefined);
    else if (session.status === 'anonymous') unregisterPush().catch(() => undefined);
  }, [session.status]);

  // Aviso que chega com o app aberto: atualiza o contador do Menu e a lista de avisos.
  useEffect(() => {
    const subscription = Notifications.addNotificationReceivedListener(() => {
      queryClient.invalidateQueries({ queryKey: ['notices-summary'] });
      queryClient.invalidateQueries({ queryKey: ['notices'] });
    });
    return () => subscription.remove();
  }, [queryClient]);

  // Toque na notificação, inclusive a que abriu o app: vai para o anúncio, lote ou conversa do aviso.
  useEffect(() => {
    if (!response || response.actionIdentifier !== Notifications.DEFAULT_ACTION_IDENTIFIER) return;
    const id = response.notification.request.identifier;
    if (handled.current === id) return;
    handled.current = id;
    openNotice(response.notification.request.content.data, onNoticeRead);
  }, [response]);

  const unread = authenticated ? (summary.data?.naoLidos ?? 0) : 0;
  useEffect(() => {
    if (pushSupport() === 'web') return;
    Notifications.setBadgeCountAsync(unread).catch(() => undefined);
  }, [unread]);

  return null;
}

/**
 * Pede a permissão num momento com contexto (depois de mandar a primeira mensagem ou entrar na fila). Se a pessoa
 * já respondeu, não insiste: as preferências ficam em Menu › Notificações.
 */
export function askForPush() {
  syncPush({ ask: true }).catch(() => undefined);
}
