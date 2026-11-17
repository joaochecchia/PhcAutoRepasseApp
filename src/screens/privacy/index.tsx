import { useQuery } from '@tanstack/react-query';
import * as WebBrowser from 'expo-web-browser';
import { router } from 'expo-router';
import { FileText, Mail } from 'lucide-react-native';
import { Linking, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { getJson } from '@/api/client';
import { AppText } from '@/components/app-text';
import { Button } from '@/components/button';
import { Notice } from '@/components/notice';
import { Skeleton } from '@/components/skeleton';
import { useSession } from '@/hooks/use-session';
import { useTheme } from '@/hooks/use-theme';
import { radius, space } from '@/theme';

type PrivacyInfo = {
  encarregado: { nome: string; email: string; atendimento: string };
  operadores: { nome: string; finalidade: string; dados: string; local: string }[];
  retencao: { dado: string; prazo: string }[];
  cookies: { nome: string; finalidade: string; duracao: string }[];
};

const POLICY_URL = 'https://phcauto.com/documentos/termos-uso-politica-privacidade-v1.1.pdf';

const rights: [string, string][] = [
  ['Saber e acessar', 'Confirmar que tratamos seus dados e receber uma cópia completa, em Minha conta.'],
  ['Corrigir', 'Atualizar dados incompletos ou errados em Minha conta.'],
  ['Levar para outro serviço', 'A cópia dos seus dados vem em JSON, legível por outros sistemas.'],
  ['Excluir', 'Apagar sua conta e todos os seus anúncios. Só o mínimo exigido por lei fica guardado, pelo prazo abaixo.'],
  ['Saber com quem compartilhamos', 'A lista completa de empresas que recebem dados está nesta página.'],
  ['Revogar consentimento', 'Desligar o contato por WhatsApp ou telefone em cada anúncio, a qualquer momento.'],
  ['Reclamar à ANPD', 'Se não resolvermos, você pode peticionar à Autoridade Nacional de Proteção de Dados.'],
];

/** Transparência ao titular (LGPD, arts. 9º, 18 e 41). Os dados vêm do backend para não divergir do que roda. */
export function PrivacyScreen() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const signedIn = useSession().status === 'authenticated';
  const info = useQuery({
    queryKey: ['privacy'],
    queryFn: ({ signal }) => getJson<PrivacyInfo>('/compliance/privacidade', undefined, { signal }),
  });

  return (
    <ScrollView
      style={{ backgroundColor: colors.bg }}
      contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + space.xl }]}>
      <AppText color="muted">
        O que guardamos, com quem compartilhamos, por quanto tempo e como exercer seus direitos.
      </AppText>
      <Button
        label="Termos de uso e Política de Privacidade"
        variant="secondary"
        icon={<FileText size={16} color={colors.text} />}
        accessibilityHint="Abre o documento completo em PDF"
        onPress={() => WebBrowser.openBrowserAsync(POLICY_URL)}
      />

      <Section title="Seus direitos">
        {rights.map(([title, text]) => (
          <View key={title} style={styles.item}>
            <AppText variant="bodyStrong">{title}</AppText>
            <AppText color="muted">{text}</AppText>
          </View>
        ))}
        {!signedIn ? (
          <Button label="Entrar para baixar ou excluir seus dados" variant="secondary" onPress={() => router.push('/entrar')} />
        ) : null}
      </Section>

      {info.isError ? (
        <Notice
          tone="error"
          message="Não foi possível carregar as informações de privacidade."
          actionLabel="Tentar de novo"
          actionLoading={info.isFetching}
          onAction={() => info.refetch()}
        />
      ) : !info.data ? (
        <View style={styles.skeleton}>
          <Skeleton height={120} rounded={radius.md} />
          <Skeleton height={120} rounded={radius.md} />
        </View>
      ) : (
        <>
          <Section title="Com quem compartilhamos" note="Empresas que tratam dados em nosso nome. Não vendemos nem alugamos seus dados.">
            {info.data.operadores.map((operator) => (
              <View key={operator.nome} style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                <AppText variant="bodyStrong">{operator.nome}</AppText>
                <AppText>{operator.finalidade}</AppText>
                <AppText variant="caption" color="muted">
                  {operator.dados} · {operator.local}
                </AppText>
              </View>
            ))}
          </Section>
          <Section title="Por quanto tempo guardamos">
            {info.data.retencao.map((row) => (
              <View key={row.dado} style={styles.item}>
                <AppText variant="bodyStrong">{row.dado}</AppText>
                <AppText color="muted">{row.prazo}</AppText>
              </View>
            ))}
          </Section>
          <Section title="Cookies">
            <AppText color="muted">
              O app não usa cookies nem o Pixel da Meta. Sua sessão fica guardada no armazenamento seguro do aparelho. Os
              cookies descritos na Política valem só para o site.
            </AppText>
          </Section>
          <Section title="Encarregado de dados">
            {info.data.encarregado.nome !== 'A definir' ? <AppText variant="bodyStrong">{info.data.encarregado.nome}</AppText> : null}
            <Button
              label={info.data.encarregado.email}
              variant="ghost"
              icon={<Mail size={16} color={colors.red} />}
              accessibilityHint="Abre o e-mail para falar com o encarregado de dados"
              onPress={() => Linking.openURL(`mailto:${info.data.encarregado.email}`)}
              style={styles.mail}
            />
            <AppText variant="caption" color="muted">
              Atendimento: {info.data.encarregado.atendimento}. Respondemos em até 15 dias.
            </AppText>
          </Section>
        </>
      )}
    </ScrollView>
  );
}

function Section({ title, note, children }: { title: string; note?: string; children: React.ReactNode }) {
  return (
    <View style={styles.section}>
      <AppText variant="heading" accessibilityRole="header">
        {title}
      </AppText>
      {note ? <AppText color="muted">{note}</AppText> : null}
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  content: { padding: space.lg, gap: space.xl },
  section: { gap: space.md },
  item: { gap: 2 },
  card: { padding: space.md, borderRadius: radius.md, borderWidth: StyleSheet.hairlineWidth, gap: 2 },
  skeleton: { gap: space.md },
  mail: { alignSelf: 'flex-start', paddingHorizontal: 0 },
});
