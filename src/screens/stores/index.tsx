import { useInfiniteQuery } from '@tanstack/react-query';
import { Image } from 'expo-image';
import { router } from 'expo-router';
import { ChevronDown, ChevronRight, MapPin, Search as SearchIcon, Store, UserRound, WifiOff, X } from 'lucide-react-native';
import { useEffect, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, StyleSheet, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { searchStores } from '@/api/ads';
import { authApi } from '@/api/auth';
import { mediaUrl } from '@/api/client';
import type { PublicProfile } from '@/api/contracts';
import { AppText } from '@/components/app-text';
import { LocationSheet } from '@/components/location-sheet';
import { Skeleton } from '@/components/skeleton';
import { StateView } from '@/components/state-view';
import { useSession } from '@/hooks/use-session';
import { useTheme } from '@/hooks/use-theme';
import { fonts, radius, space } from '@/theme';
import { locationLabel, type SearchLocation } from '@/utils/location';

/** Encontrar lojistas por nome e região (StoresPage do site, sem o id). */
export function StoresScreen() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const session = useSession();
  const signedIn = session.status === 'authenticated';
  // Com sessão, começa perto do endereço do cadastro (como no site); sem sessão, lojas de todo o Brasil.
  const [chosen, setLocal] = useState<SearchLocation | null>(null);
  const local: SearchLocation = chosen ?? (signedIn ? { modo: 'ENDERECO_CADASTRADO' } : { modo: 'BRASIL' });
  const [text, setText] = useState('');
  const [nome, setNome] = useState('');
  const [sheet, setSheet] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setNome(text.trim()), 400);
    return () => clearTimeout(timer);
  }, [text]);

  const stores = useInfiniteQuery({
    queryKey: ['stores', local, nome, session.status === 'authenticated' ? session.user.usuarioId : null],
    initialPageParam: 0,
    enabled: session.status !== 'loading',
    queryFn: async ({ pageParam, signal }) => {
      let region: { cidade?: string; uf?: string; latitude?: number; longitude?: number } = {};
      if (local.modo === 'CIDADE') region = { cidade: local.cidade, uf: local.uf };
      else if (local.modo === 'UF') region = { uf: local.uf };
      else if (local.modo === 'DISPOSITIVO') region = { latitude: local.latitude, longitude: local.longitude };
      else if (local.modo === 'ENDERECO_CADASTRADO' && session.status === 'authenticated') {
        const profile = await authApi.profile(session.user.usuarioId, signal);
        const { cidade, uf } = profile.endereco ?? {};
        if (!cidade || !uf)
          throw new Error('Seu cadastro ainda não tem cidade e estado. Escolha outra região para buscar lojas.');
        region = { cidade, uf };
      }
      return searchStores({ ...region, nome }, pageParam, signal);
    },
    getNextPageParam: (page) => (page.temProximaPagina ? page.pagina + 1 : undefined),
  });

  const first = stores.data?.pages[0];
  const items = stores.data?.pages.flatMap((page) => page.lojistas) ?? [];
  const regional = local.modo !== 'BRASIL';

  return (
    <View style={[styles.flex, { backgroundColor: colors.bg }]}>
      <FlatList
        data={items}
        keyExtractor={(item) => item.id}
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + space.xl }]}
        keyboardDismissMode="on-drag"
        keyboardShouldPersistTaps="handled"
        onEndReachedThreshold={0.5}
        onEndReached={() => {
          if (stores.hasNextPage && !stores.isFetchingNextPage) stores.fetchNextPage();
        }}
        refreshing={stores.isRefetching && !stores.isFetchingNextPage}
        onRefresh={() => stores.refetch()}
        ListHeaderComponent={
          <View style={styles.header}>
            <AppText color="muted">Lojas que anunciam no PHC Auto. Toque numa loja para ver os veículos dela.</AppText>
            <View style={[styles.input, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <SearchIcon size={20} color={colors.muted} />
              <TextInput
                value={text}
                onChangeText={setText}
                placeholder="Nome da loja"
                placeholderTextColor={colors.muted}
                returnKeyType="search"
                autoCorrect={false}
                maxLength={160}
                accessibilityLabel="Buscar loja pelo nome"
                style={[styles.textInput, { color: colors.text }]}
              />
              {text ? (
                <Pressable onPress={() => setText('')} hitSlop={12} accessibilityRole="button" accessibilityLabel="Limpar nome">
                  <X size={18} color={colors.muted} />
                </Pressable>
              ) : null}
            </View>
            <Pressable
              onPress={() => setSheet(true)}
              accessibilityRole="button"
              accessibilityLabel={`Região: ${locationLabel(local)}. Toque para mudar`}
              style={({ pressed }) => [styles.location, pressed && { opacity: 0.6 }]}>
              <MapPin size={16} color={regional ? colors.red : colors.muted} />
              <AppText variant="label" color={regional ? 'red' : 'text'} numberOfLines={1} style={styles.shrink}>
                {locationLabel(local)}
              </AppText>
              <ChevronDown size={16} color={colors.muted} />
            </Pressable>
            {first ? (
              <AppText variant="label" color="muted">
                {first.total} {first.total === 1 ? 'loja encontrada' : 'lojas encontradas'}
                {regional ? (first.raioKmAplicado ? ` até ${first.raioKmAplicado} km` : ' na região') : ' em destaque'}
              </AppText>
            ) : null}
          </View>
        }
        ListEmptyComponent={
          stores.isPending ? (
            <View style={styles.list}>
              {[0, 1, 2, 3].map((key) => (
                <Skeleton key={key} height={76} rounded={radius.lg} />
              ))}
            </View>
          ) : stores.isError ? (
            <StateView
              icon={WifiOff}
              title="Não carregamos as lojas"
              message={stores.error.message}
              actionLabel="Tentar de novo"
              onAction={() => stores.refetch()}
              compact
            />
          ) : (
            <StateView
              icon={Store}
              title="Nenhuma loja encontrada"
              message="Tente outra cidade, outro estado ou outro nome."
              actionLabel={regional ? 'Buscar em todo o Brasil' : undefined}
              onAction={() => setLocal({ modo: 'BRASIL' })}
              compact
            />
          )
        }
        ItemSeparatorComponent={Separator}
        renderItem={({ item }) => <StoreRow store={item} />}
        ListFooterComponent={stores.isFetchingNextPage ? <ActivityIndicator color={colors.red} style={styles.more} /> : undefined}
      />
      <LocationSheet
        visible={sheet}
        current={local}
        signedIn={signedIn}
        onClose={() => setSheet(false)}
        onApply={(next) => {
          setLocal(next);
          setSheet(false);
        }}
      />
    </View>
  );
}

export function StoreAvatar({ store, size = 52 }: { store: Pick<PublicProfile, 'fotoUrl'>; size?: number }) {
  const { colors } = useTheme();
  return (
    <View style={[styles.avatar, { width: size, height: size, borderRadius: size / 2, backgroundColor: colors.subtle }]}>
      {store.fotoUrl ? (
        <Image source={{ uri: mediaUrl(store.fotoUrl)! }} style={{ width: size, height: size }} contentFit="cover" />
      ) : (
        <UserRound size={size * 0.42} color={colors.muted} />
      )}
    </View>
  );
}

function StoreRow({ store }: { store: PublicProfile }) {
  const { colors } = useTheme();
  const place = [store.cidade, store.uf].filter(Boolean).join(', ') || 'Cidade não informada';
  return (
    <Pressable
      disabled={!store.slug}
      onPress={() => store.slug && router.push({ pathname: '/loja/[slug]', params: { slug: store.slug } })}
      accessibilityRole="button"
      accessibilityLabel={`${store.nome}, ${place}. Ver veículos da loja`}
      style={({ pressed }) => [
        styles.row,
        { backgroundColor: pressed ? colors.subtle : colors.surface, borderColor: colors.border },
      ]}>
      <StoreAvatar store={store} />
      <View style={styles.flex}>
        <AppText variant="bodyStrong" numberOfLines={2}>
          {store.nome}
        </AppText>
        <View style={styles.place}>
          <MapPin size={13} color={colors.muted} />
          <AppText variant="caption" color="muted" numberOfLines={1} style={styles.shrink}>
            {place}
          </AppText>
        </View>
      </View>
      <ChevronRight size={20} color={colors.muted} />
    </Pressable>
  );
}

function Separator() {
  return <View style={styles.separator} />;
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  shrink: { flexShrink: 1 },
  content: { padding: space.lg },
  header: { gap: space.md, marginBottom: space.lg },
  input: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    minHeight: 50,
    paddingHorizontal: space.lg,
    borderRadius: radius.pill,
    borderWidth: 1,
  },
  textInput: { flex: 1, fontFamily: fonts.body, fontSize: 16, paddingVertical: space.sm },
  location: { flexDirection: 'row', alignItems: 'center', gap: space.xs, minHeight: 36 },
  list: { gap: space.md },
  separator: { height: space.md },
  more: { marginTop: space.lg },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    padding: space.md,
    borderRadius: radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    minHeight: 76,
  },
  avatar: { alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  place: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 2 },
});
