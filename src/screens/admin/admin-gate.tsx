import { router } from 'expo-router';
import { LockKeyhole } from 'lucide-react-native';
import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';

import { StateView } from '@/components/state-view';
import { isStaff, useSession } from '@/hooks/use-session';
import { useTheme } from '@/hooks/use-theme';

/**
 * Esconde a área de quem não é da administração. É só conveniência: quem autoriza cada chamada é o servidor.
 * {@code owner}: só o DONO (usuários, limite de anúncios, promoções de todos).
 */
export function AdminGate({ owner, children }: { owner?: boolean; children: ReactNode }) {
  const { colors } = useTheme();
  const session = useSession();
  if (session.status === 'loading') return <View style={[styles.root, { backgroundColor: colors.bg }]} />;
  const papel = session.status === 'authenticated' ? session.user.papel : undefined;
  const allowed = owner ? papel === 'DONO' : isStaff(papel);
  if (allowed) return children;
  return (
    <View style={[styles.root, { backgroundColor: colors.bg }]}>
      <StateView
        icon={LockKeyhole}
        title="Acesso restrito"
        message={
          owner
            ? 'Esta área do painel é só da conta Dono.'
            : 'O painel administrativo é exclusivo para contas Admin e Dono.'
        }
        actionLabel={session.status === 'authenticated' ? 'Voltar' : 'Entrar'}
        onAction={() => (session.status === 'authenticated' ? router.back() : router.push('/entrar'))}
      />
    </View>
  );
}

const styles = StyleSheet.create({ root: { flex: 1 } });
