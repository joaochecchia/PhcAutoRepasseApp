import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import * as Haptics from 'expo-haptics';
import { Search, TicketPercent, WifiOff } from 'lucide-react-native';
import { useState } from 'react';
import { FlatList, RefreshControl, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { adminPromotionsApi } from '@/api/admin';
import { promotionsApi, type Promotion } from '@/api/promotions';
import { AppText } from '@/components/app-text';
import { showDialog } from '@/components/dialog';
import { Notice } from '@/components/notice';
import { Skeleton } from '@/components/skeleton';
import { StateView } from '@/components/state-view';
import { TextField } from '@/components/text-field';
import { useTheme } from '@/hooks/use-theme';
import { PromotionEditor } from '@/screens/my-ads/promotion-editor';
import { PromotionCard } from '@/screens/my-ads/promotions';
import { radius, space } from '@/theme';

import { AdminGate } from './admin-gate';

/** Promoções de todos os anunciantes (PromotionsManager admin do site, só DONO): editar, pausar e excluir. */
export function AdminPromotionsScreen() {
  return (
    <AdminGate owner>
      <AdminPromotions />
    </AdminGate>
  );
}

function AdminPromotions() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const cache = useQueryClient();
  const [draft, setDraft] = useState('');
  const [term, setTerm] = useState('');
  const [editing, setEditing] = useState<Promotion | undefined>(undefined);
  const [flash, setFlash] = useState('');
  const key = ['admin', 'promotions', term];
  const list = useQuery({ queryKey: key, queryFn: ({ signal }) => adminPromotionsApi.all(term, signal) });

  const refresh = () => {
    cache.invalidateQueries({ queryKey: ['admin', 'promotions'] });
    cache.invalidateQueries({ queryKey: ['store-promotions'] });
  };
  const toggle = useMutation({
    mutationFn: (promotion: Promotion) => promotionsApi.setActive(promotion.id, !promotion.ativa),
    onSuccess: (saved) => {
      Haptics.selectionAsync();
      setFlash(saved.ativa ? 'Promoção retomada.' : 'Promoção pausada.');
      refresh();
    },
    onError: (error) => showDialog({ title: 'Não foi possível alterar a promoção', message: error.message }),
  });
  const remove = useMutation({
    mutationFn: (promotion: Promotion) => promotionsApi.remove(promotion.id),
    onSuccess: () => {
      setFlash('Promoção excluída.');
      refresh();
    },
    onError: (error) => showDialog({ title: 'Não foi possível excluir a promoção', message: error.message }),
  });

  const header = (
    <View style={styles.header}>
      <AppText color="muted">
        Promoções de todos os anunciantes. Para criar, o anunciante usa Meus anúncios › Promoções.
      </AppText>
      <TextField
        label="Buscar"
        value={draft}
        onChangeText={setDraft}
        onSubmitEditing={() => setTerm(draft.trim())}
        onBlur={() => setTerm(draft.trim())}
        placeholder="Título ou anunciante"
        returnKeyType="search"
        autoCorrect={false}
      />
      {flash ? <Notice tone="success" message={flash} /> : null}
    </View>
  );

  return (
    <>
      <FlatList
        style={{ backgroundColor: colors.bg }}
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + space.xxl }]}
        data={list.data ?? []}
        keyExtractor={(item) => item.id}
        ListHeaderComponent={header}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        refreshControl={<RefreshControl refreshing={list.isRefetching} onRefresh={() => void list.refetch()} tintColor={colors.red} />}
        ItemSeparatorComponent={() => <View style={styles.gap} />}
        ListEmptyComponent={
          list.isPending ? (
            <View style={styles.gapList}>
              <Skeleton height={160} rounded={radius.lg} />
              <Skeleton height={160} rounded={radius.lg} />
            </View>
          ) : list.isError ? (
            <StateView icon={WifiOff} title="As promoções não carregaram" message={list.error.message} actionLabel="Tentar de novo" onAction={() => list.refetch()} compact />
          ) : (
            <StateView
              icon={term ? Search : TicketPercent}
              title={term ? 'Nada encontrado' : 'Nenhuma promoção'}
              message={term ? 'Tente outro título ou o nome da loja.' : 'Quando um anunciante criar uma promoção, ela aparece aqui.'}
              compact
            />
          )
        }
        renderItem={({ item }) => (
          <PromotionCard
            promotion={item}
            canEdit
            showStore
            toggling={toggle.isPending && toggle.variables?.id === item.id}
            busy={(toggle.isPending && toggle.variables?.id === item.id) || (remove.isPending && remove.variables?.id === item.id)}
            onEdit={() => setEditing(item)}
            onToggle={() => toggle.mutate(item)}
            onDelete={() => remove.mutate(item)}
          />
        )}
      />
      <PromotionEditor
        promotion={editing}
        anuncianteId={editing?.anuncianteId}
        onClose={() => setEditing(undefined)}
        onSaved={() => {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          setFlash('Promoção salva.');
          setEditing(undefined);
          refresh();
        }}
      />
    </>
  );
}

const styles = StyleSheet.create({
  content: { padding: space.lg },
  header: { gap: space.md, marginBottom: space.lg },
  gap: { height: space.md },
  gapList: { gap: space.md },
});
