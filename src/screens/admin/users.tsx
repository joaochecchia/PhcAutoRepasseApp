import { useInfiniteQuery, useQuery, type QueryClient } from '@tanstack/react-query';
import { router } from 'expo-router';
import { Search, UserPlus, UsersRound, WifiOff } from 'lucide-react-native';
import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, RefreshControl, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { adminApi, type AdminUser, type AdminUserFilters, type AdminUsersPage } from '@/api/admin';
import { AppText } from '@/components/app-text';
import { Button } from '@/components/button';
import { Chip } from '@/components/chip';
import { Skeleton } from '@/components/skeleton';
import { StateView } from '@/components/state-view';
import { TextField } from '@/components/text-field';
import { useTheme } from '@/hooks/use-theme';
import { radius, space } from '@/theme';

import { AdminGate } from './admin-gate';
import { formatDate, formatDocument, roleLabels } from './format';
import { Tag } from './ui';

export const usersKey = ['admin', 'users'] as const;
type Filters = Omit<AdminUserFilters, 'pagina'>;

/** Acha a conta nas listas já carregadas (não há GET de um usuário só no painel). */
export function cachedAdminUser(cache: QueryClient, id: string): AdminUser | null {
  for (const [, data] of cache.getQueriesData<{ pages: AdminUsersPage[] }>({ queryKey: usersKey })) {
    const found = data?.pages?.flatMap((page) => page.usuarios).find((user) => user.id === id);
    if (found) return found;
  }
  return null;
}

/** Atualiza a conta em todas as listas carregadas, depois de mudar papel, situação ou dados. */
export function patchAdminUser(cache: QueryClient, id: string, patch: Partial<AdminUser>) {
  cache.setQueriesData<{ pages: AdminUsersPage[]; pageParams: unknown[] }>({ queryKey: usersKey }, (data) =>
    data?.pages
      ? {
          ...data,
          pages: data.pages.map((page) => ({
            ...page,
            usuarios: page.usuarios.map((user) => (user.id === id ? { ...user, ...patch } : user)),
          })),
        }
      : data,
  );
}

const roleOptions = [
  { value: '', label: 'Todos' },
  { value: 'CLIENTE', label: 'Cliente' },
  { value: 'ADMIN', label: 'Admin' },
  { value: 'DONO', label: 'Dono' },
];
const typeOptions = [
  { value: '', label: 'PF e PJ' },
  { value: 'PF', label: 'PF' },
  { value: 'PJ', label: 'PJ' },
];
const activeOptions = [
  { value: '', label: 'Todas' },
  { value: 'true', label: 'Ativas' },
  { value: 'false', label: 'Bloqueadas' },
];

/** Usuários (AdminUsers do site, só DONO): busca, filtros, plano vigente e acesso a cada conta. */
export function UsersScreen() {
  return (
    <AdminGate owner>
      <Users />
    </AdminGate>
  );
}

function Users() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const [search, setSearch] = useState('');
  const [filters, setFilters] = useState<Filters>({});

  // A busca espera a pessoa parar de digitar.
  useEffect(() => {
    const timer = setTimeout(() => {
      const busca = search.trim() || undefined;
      setFilters((current) => (current.busca === busca ? current : { ...current, busca }));
    }, 350);
    return () => clearTimeout(timer);
  }, [search]);

  const users = useInfiniteQuery({
    queryKey: [...usersKey, filters],
    queryFn: ({ pageParam, signal }) => adminApi.users({ ...filters, pagina: pageParam }, signal),
    initialPageParam: 0,
    getNextPageParam: (last) => (last.temProximaPagina ? last.pagina + 1 : undefined),
  });
  const list = useMemo(() => users.data?.pages.flatMap((page) => page.usuarios) ?? [], [users.data]);
  const total = users.data?.pages[0]?.total ?? 0;
  const ids = list.map((user) => user.id).join(',');
  const plans = useQuery({
    queryKey: ['admin', 'current-plans', ids],
    queryFn: ({ signal }) => adminApi.currentPlans(ids ? ids.split(',') : [], signal),
    enabled: list.length > 0,
    staleTime: 60_000,
  });

  const setFilter = (key: keyof Filters, value: string) => setFilters((current) => ({ ...current, [key]: value || undefined }));

  const header = (
    <View style={styles.header}>
      <TextField
        label="Buscar"
        value={search}
        onChangeText={setSearch}
        placeholder="Nome, e-mail, CPF ou CNPJ"
        autoCapitalize="none"
        autoCorrect={false}
        returnKeyType="search"
        accessibilityLabel="Buscar usuários por nome, e-mail, CPF ou CNPJ"
      />
      <FilterRow label="Papel" options={roleOptions} value={filters.papel ?? ''} onChange={(value) => setFilter('papel', value)} />
      <FilterRow label="Tipo" options={typeOptions} value={filters.tipoPessoa ?? ''} onChange={(value) => setFilter('tipoPessoa', value)} />
      <FilterRow label="Situação" options={activeOptions} value={filters.ativo ?? ''} onChange={(value) => setFilter('ativo', value)} />
      <View style={styles.headerRow}>
        <AppText variant="caption" color="muted" style={styles.flex}>
          {users.data ? `${total} ${total === 1 ? 'usuário' : 'usuários'}` : ' '}
        </AppText>
        <Button
          label="Novo usuário"
          icon={<UserPlus size={16} color={colors.onRed} />}
          onPress={() => router.push('/admin/usuarios/novo')}
        />
      </View>
    </View>
  );

  return (
    <FlatList
      style={{ backgroundColor: colors.bg }}
      contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + space.xxl }]}
      data={list}
      keyExtractor={(user) => user.id}
      ListHeaderComponent={header}
      keyboardShouldPersistTaps="handled"
      keyboardDismissMode="on-drag"
      refreshControl={<RefreshControl refreshing={users.isRefetching && !users.isFetchingNextPage} onRefresh={() => void users.refetch()} tintColor={colors.red} />}
      onEndReachedThreshold={0.4}
      onEndReached={() => {
        if (users.hasNextPage && !users.isFetchingNextPage) users.fetchNextPage();
      }}
      ItemSeparatorComponent={() => <View style={styles.gap} />}
      ListEmptyComponent={
        users.isPending ? (
          <View style={styles.skeletons}>
            {[0, 1, 2].map((n) => (
              <Skeleton key={n} height={92} rounded={radius.lg} />
            ))}
          </View>
        ) : users.isError ? (
          <StateView icon={WifiOff} title="Usuários indisponíveis" message={users.error.message} actionLabel="Tentar de novo" onAction={() => users.refetch()} compact />
        ) : (
          <StateView
            icon={filters.busca ? Search : UsersRound}
            title="Nenhum usuário encontrado"
            message="Ajuste a busca ou os filtros."
            compact
          />
        )
      }
      ListFooterComponent={users.isFetchingNextPage ? <ActivityIndicator color={colors.red} style={styles.footer} /> : undefined}
      renderItem={({ item }) => {
        const plan = plans.data?.[item.id];
        return (
          <Pressable
            onPress={() => router.push({ pathname: '/admin/usuarios/[id]', params: { id: item.id } })}
            accessibilityRole="button"
            accessibilityHint="Abre o acesso, o plano e os dados da conta"
            style={({ pressed }) => [
              styles.card,
              { backgroundColor: pressed ? colors.subtle : colors.surface, borderColor: colors.border },
            ]}>
            <View style={styles.cardTop}>
              <View style={styles.flex}>
                <AppText variant="bodyStrong" numberOfLines={1}>
                  {item.nome}
                </AppText>
                <AppText variant="caption" color="muted" numberOfLines={1}>
                  {item.email}
                </AppText>
              </View>
              <Tag label={roleLabels[item.papel] ?? item.papel} tone={item.papel === 'DONO' || item.papel === 'ADMIN' ? 'warn' : 'neutral'} />
            </View>
            <AppText variant="caption" color="muted">
              {item.tipoPessoa} · {formatDocument(item.documento)}
              {item.cidade ? ` · ${item.cidade}/${item.uf}` : ''}
            </AppText>
            <View style={styles.cardTop}>
              <AppText variant="caption" style={styles.flex}>
                {plan ? `${plan.planoNome} até ${formatDate(plan.fimEm)}${plan.origem === 'CONCESSAO' ? ' · concedido' : ''}` : 'Free'}
              </AppText>
              {item.ativo ? null : <Tag label="Bloqueada" tone="bad" />}
            </View>
          </Pressable>
        );
      }}
    />
  );
}

function FilterRow({
  label,
  options,
  value,
  onChange,
}: {
  label: string;
  options: { value: string; label: string }[];
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <View style={styles.filter} accessibilityRole="radiogroup" accessibilityLabel={label}>
      <AppText variant="label" color="muted" style={styles.filterLabel}>
        {label}
      </AppText>
      <View style={styles.chips}>
        {options.map((option) => (
          <Chip key={option.value || 'todos'} label={option.label} selected={value === option.value} onPress={() => onChange(option.value)} />
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  content: { padding: space.lg },
  header: { gap: space.md, marginBottom: space.lg },
  headerRow: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  flex: { flex: 1 },
  filter: { gap: space.xs },
  filterLabel: { paddingHorizontal: 2 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  gap: { height: space.sm },
  skeletons: { gap: space.sm },
  card: { borderRadius: radius.lg, borderWidth: StyleSheet.hairlineWidth, padding: space.lg, gap: space.xs },
  cardTop: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  footer: { marginTop: space.lg },
});
