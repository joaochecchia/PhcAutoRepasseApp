import { router } from 'expo-router';
import { PencilLine, ShieldCheck, UserRound } from 'lucide-react-native';
import { ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import type { UserProfile } from '@/api/contracts';
import { AppText } from '@/components/app-text';
import { Button } from '@/components/button';
import { Notice } from '@/components/notice';
import { Skeleton } from '@/components/skeleton';
import { useTheme } from '@/hooks/use-theme';
import { radius, space } from '@/theme';
import { formatCep, formatCnpj, formatPhone } from '@/utils/masks';

/** CPF com o meio escondido: a pessoa reconhece o próprio sem expor o número inteiro na tela. */
const maskedCpf = (cpf: string) => (cpf.length === 11 ? `***.${cpf.slice(3, 6)}.${cpf.slice(6, 9)}-**` : '—');

/**
 * Primeiro passo do Anunciar, como no site ("Primeiro, vamos conhecer você"): conferir os dados do anunciante.
 * Eles ficam no cadastro; o anúncio público mostra só a cidade do veículo. Sem endereço, não dá para anunciar.
 */
export function AdvertiserReview({
  profile,
  loading,
  error,
  onRetry,
  onContinue,
}: {
  profile: UserProfile | undefined;
  loading: boolean;
  error: string | null;
  onRetry: () => void;
  onContinue: () => void;
}) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const edit = () => router.push({ pathname: '/minha-conta', params: { origem: 'anunciar' } });
  const address = profile?.endereco;
  const pj = profile?.tipoPessoa === 'PJ';
  const rows: [string, string][] = profile
    ? [
        [pj ? 'Nome fantasia' : 'Nome', profile.nome],
        ...(pj ? ([['Razão social', profile.razaoSocial || '—']] as [string, string][]) : []),
        [pj ? 'CNPJ' : 'CPF', pj ? formatCnpj(profile.cnpj ?? '') || '—' : maskedCpf(profile.cpf ?? '')],
        ['E-mail', profile.email],
        ['Telefone', formatPhone(profile.telefone ?? '') || '—'],
        [
          'Endereço',
          address
            ? `${address.rua}${address.numero ? `, ${address.numero}` : ''} · ${address.bairro}\n${address.cidade}/${address.uf} · ${formatCep(address.cep)}`
            : 'Não informado',
        ],
      ]
    : [];

  return (
    <ScrollView style={{ backgroundColor: colors.bg }} contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + space.xxl }]}>
      <AppText variant="overline" color="red">
        Anunciar · antes de começar
      </AppText>
      <AppText variant="display" accessibilityRole="header">
        Confira seus dados
      </AppText>
      <AppText color="muted">São os dados do anunciante. O anúncio público mostra só a cidade do veículo.</AppText>

      {error ? (
        <Notice tone="error" message={error} actionLabel="Tentar de novo" onAction={onRetry} />
      ) : loading || !profile ? (
        <View style={styles.card}>
          {[0, 1, 2, 3].map((key) => (
            <Skeleton key={key} height={40} />
          ))}
        </View>
      ) : (
        <>
          <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <View style={styles.head}>
              <View style={[styles.icon, { backgroundColor: colors.subtle }]}>
                <UserRound size={20} color={colors.text} />
              </View>
              <AppText variant="heading" style={styles.flex}>
                {pj ? 'Pessoa jurídica' : 'Pessoa física'}
              </AppText>
            </View>
            {rows.map(([label, value]) => (
              <View key={label} style={[styles.row, { borderTopColor: colors.border }]} accessible accessibilityLabel={`${label}: ${value}`}>
                <AppText variant="caption" color="muted" style={styles.label}>
                  {label}
                </AppText>
                <AppText variant="bodyStrong" style={styles.flex}>
                  {value}
                </AppText>
              </View>
            ))}
          </View>
          <View style={styles.note}>
            <ShieldCheck size={16} color={colors.muted} />
            <AppText variant="caption" color="muted" style={styles.flex}>
              Documentos e endereço completo fazem parte do cadastro e não aparecem na vitrine.
            </AppText>
          </View>
          {address ? null : <Notice tone="info" message="Para anunciar, complete seu endereço no cadastro." />}
          {address ? <Button label="Está tudo certo, continuar" onPress={onContinue} /> : null}
          <Button
            label={address ? 'Corrigir meus dados' : 'Completar meus dados'}
            variant={address ? 'secondary' : 'primary'}
            icon={<PencilLine size={16} color={address ? colors.text : colors.onRed} />}
            onPress={edit}
          />
        </>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { padding: space.lg, gap: space.lg },
  flex: { flex: 1 },
  card: { borderRadius: radius.lg, borderWidth: StyleSheet.hairlineWidth, overflow: 'hidden', gap: space.sm },
  head: { flexDirection: 'row', alignItems: 'center', gap: space.md, padding: space.lg },
  icon: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  row: { flexDirection: 'row', gap: space.md, paddingHorizontal: space.lg, paddingVertical: space.md, borderTopWidth: StyleSheet.hairlineWidth },
  label: { width: 96, paddingTop: 2 },
  note: { flexDirection: 'row', gap: space.sm, alignItems: 'flex-start' },
});
