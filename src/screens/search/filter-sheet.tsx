import * as Haptics from 'expo-haptics';
import { X } from 'lucide-react-native';
import { useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import type { SearchFilters } from '@/api/ads';
import { AppText } from '@/components/app-text';
import { Button } from '@/components/button';
import { Chip } from '@/components/chip';
import { conditions, priceRanges, sortOptions, vehicleTypes } from '@/data/catalog';
import { useTheme } from '@/hooks/use-theme';
import { radius, space } from '@/theme';

type Props = {
  visible: boolean;
  initial: SearchFilters;
  onClose: () => void;
  onApply: (filters: SearchFilters) => void;
};

/**
 * Folha de filtros. Usa o Modal nativo (desliza de baixo, com o gesto de fechar do sistema no iOS).
 * Os filtros só valem ao tocar em "Ver resultados".
 */
export function FilterSheet({ visible, initial, onClose, onApply }: Props) {
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const [draft, setDraft] = useState<SearchFilters>(initial);

  function pick<K extends keyof SearchFilters>(key: K, value: SearchFilters[K]) {
    Haptics.selectionAsync();
    setDraft((current) => ({ ...current, [key]: current[key] === value ? undefined : value }));
  }

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onShow={() => setDraft(initial)}
      onRequestClose={onClose}>
      <View style={[styles.root, { backgroundColor: colors.bg, paddingBottom: insets.bottom + space.md }]}>
        <View style={[styles.header, { borderBottomColor: colors.border }]}>
          <AppText variant="title" accessibilityRole="header">
            Filtros
          </AppText>
          <Pressable onPress={onClose} hitSlop={12} accessibilityRole="button" accessibilityLabel="Fechar filtros" style={[styles.close, { backgroundColor: colors.subtle }]}>
            <X size={20} color={colors.text} />
          </Pressable>
        </View>
        <ScrollView contentContainerStyle={styles.body}>
          <Group title="Tipo de veículo">
            {vehicleTypes.map(({ key, label, icon: Icon }) => (
              <Chip
                key={key}
                label={label}
                selected={draft.tipoVeiculo === key}
                icon={<Icon size={16} color={draft.tipoVeiculo === key ? colors.red : colors.text} />}
                onPress={() => pick('tipoVeiculo', key)}
              />
            ))}
          </Group>
          <Group title="Condição">
            {conditions.map(({ key, label }) => (
              <Chip key={key} label={label} selected={draft.condicao === key} onPress={() => pick('condicao', key)} />
            ))}
          </Group>
          <Group title="Preço">
            {priceRanges.map((range) => {
              const selected = draft.precoMinimo === range.min && draft.precoMaximo === range.max;
              return (
                <Chip
                  key={range.key}
                  label={range.label}
                  selected={selected}
                  onPress={() => {
                    Haptics.selectionAsync();
                    setDraft((current) =>
                      selected
                        ? { ...current, precoMinimo: undefined, precoMaximo: undefined }
                        : { ...current, precoMinimo: range.min, precoMaximo: range.max },
                    );
                  }}
                />
              );
            })}
          </Group>
          <Group title="Ordenar por">
            {sortOptions.map(({ key, label }) => (
              <Chip
                key={key || 'relevancia'}
                label={label}
                selected={(draft.ordenacao ?? '') === key}
                onPress={() => {
                  Haptics.selectionAsync();
                  setDraft((current) => ({ ...current, ordenacao: key || undefined }));
                }}
              />
            ))}
          </Group>
        </ScrollView>
        <View style={[styles.actions, { borderTopColor: colors.border }]}>
          <Button label="Limpar" variant="secondary" onPress={() => setDraft({})} style={styles.flex} />
          <Button label="Ver resultados" onPress={() => onApply(draft)} style={styles.flex2} />
        </View>
      </View>
    </Modal>
  );
}

function Group({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={styles.group}>
      <AppText variant="heading">{title}</AppText>
      <View style={styles.wrap}>{children}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: space.lg,
    paddingVertical: space.lg,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  close: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  body: { padding: space.lg, gap: space.xxl },
  group: { gap: space.md },
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  actions: {
    flexDirection: 'row',
    gap: space.md,
    paddingHorizontal: space.lg,
    paddingTop: space.md,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderRadius: radius.sm,
  },
  flex: { flex: 1 },
  flex2: { flex: 2 },
});
