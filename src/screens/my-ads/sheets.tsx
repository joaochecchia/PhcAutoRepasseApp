import { X, type LucideIcon } from 'lucide-react-native';
import { useState, type ReactNode } from 'react';
import { Modal, Platform, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { isSale, SOLD_RETENTION_DAYS, type RetireReason } from '@/api/my-ads';
import { AppText } from '@/components/app-text';
import { Button } from '@/components/button';
import { Chip } from '@/components/chip';
import { Notice } from '@/components/notice';
import { TextField } from '@/components/text-field';
import { useTheme } from '@/hooks/use-theme';
import { radius, space, touch } from '@/theme';
import { cleanMasked, displayMasked, maskInput } from '@/utils/masks';

/** Folha que sobe do rodapé, com fundo escurecido. Fechar tocando fora ou no voltar do Android. */
function Sheet({ visible, onClose, children }: { visible: boolean; onClose: () => void; children: ReactNode }) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  return (
    <Modal visible={visible} transparent animationType="fade" statusBarTranslucent navigationBarTranslucent onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <Pressable
          style={[StyleSheet.absoluteFill, { backgroundColor: colors.scrim }]}
          onPress={onClose}
          accessible={false}
          importantForAccessibility="no"
        />
        <View
          accessibilityViewIsModal
          style={[
            styles.sheet,
            { backgroundColor: colors.elevated, borderColor: colors.border, paddingBottom: insets.bottom + space.lg },
          ]}>
          <View style={[styles.grabber, { backgroundColor: colors.border }]} />
          {children}
        </View>
      </View>
    </Modal>
  );
}

export type SheetAction = {
  key: string;
  label: string;
  icon: LucideIcon;
  hint?: string;
  destructive?: boolean;
  disabled?: boolean;
  onPress: () => void;
};

/** Ações de um anúncio em Meus anúncios. */
export function ActionsSheet({
  title,
  subtitle,
  actions,
  onClose,
}: {
  title: string | null;
  subtitle?: string;
  actions: SheetAction[];
  onClose: () => void;
}) {
  const { colors } = useTheme();
  return (
    <Sheet visible={Boolean(title)} onClose={onClose}>
      <View style={styles.head}>
        <AppText variant="heading" numberOfLines={2} accessibilityRole="header">
          {title}
        </AppText>
        {subtitle ? (
          <AppText variant="caption" color="muted">
            {subtitle}
          </AppText>
        ) : null}
      </View>
      {actions.map(({ key, label, icon: Icon, hint, destructive, disabled, onPress }) => (
        <Pressable
          key={key}
          disabled={disabled}
          onPress={() => {
            onClose();
            // No iOS outro Modal só abre depois que este terminou de fechar.
            setTimeout(onPress, Platform.OS === 'ios' ? 350 : 0);
          }}
          accessibilityRole="button"
          accessibilityLabel={label}
          accessibilityHint={hint}
          accessibilityState={{ disabled }}
          style={({ pressed }) => [
            styles.action,
            { borderTopColor: colors.border, opacity: disabled ? 0.45 : 1 },
            pressed && { backgroundColor: colors.subtle },
          ]}>
          <Icon size={20} color={destructive ? colors.red : colors.text} />
          <View style={styles.actionText}>
            <AppText color={destructive ? 'red' : 'text'}>{label}</AppText>
            {hint ? (
              <AppText variant="caption" color="muted">
                {hint}
              </AppText>
            ) : null}
          </View>
        </Pressable>
      ))}
    </Sheet>
  );
}

const saleReasons: [RetireReason, string][] = [
  ['VENDIDO_PHC', 'Vendi pelo PHC Auto'],
  ['VENDIDO_FORA', 'Vendi por outro canal'],
];
const otherReasons: [RetireReason, string][] = [
  ['DESISTI_DE_VENDER', 'Desisti de vender'],
  ['AJUSTAR_ANUNCIO', 'Vou ajustar preço, fotos ou dados'],
  ['POUCOS_CONTATOS', 'Recebi poucos contatos'],
  ['PAUSA_TEMPORARIA', 'Pausa por um tempo'],
  ['OUTRO', 'Outro motivo'],
];

/**
 * Questionário ao tirar da vitrine ("retire") ou marcar como vendido ("sold", pergunta só onde vendeu).
 * Só o motivo vai ao backend, que guarda a resposta como estatística anônima.
 */
export function RetireSheet({
  target,
  busy,
  error,
  onSubmit,
  onClose,
}: {
  target: { title: string; mode: 'retire' | 'sold' } | null;
  busy: boolean;
  error: string;
  onSubmit: (reason: RetireReason) => void;
  onClose: () => void;
}) {
  const { colors } = useTheme();
  const [reason, setReason] = useState<RetireReason | null>(null);
  const mode = target?.mode ?? 'retire';
  const options = mode === 'sold' ? saleReasons : [...otherReasons, ...saleReasons];
  const selling = mode === 'sold' || (reason !== null && isSale(reason));
  const close = () => {
    if (busy) return;
    setReason(null);
    onClose();
  };
  return (
    <Sheet visible={Boolean(target)} onClose={close}>
      <ScrollView contentContainerStyle={styles.form} bounces={false}>
        <AppText variant="title" accessibilityRole="header">
          {mode === 'sold' ? 'Marcar como vendido' : 'Por que retirar o anúncio?'}
        </AppText>
        <AppText color="muted">
          <AppText variant="bodyStrong">{target?.title}</AppText>{' '}
          {mode === 'sold'
            ? 'sai da vitrine e libera uma vaga do seu plano. Onde você vendeu?'
            : 'sai da vitrine. A resposta é anônima e nos ajuda a melhorar o PHC Auto.'}
        </AppText>
        <View accessibilityRole="radiogroup" style={styles.options}>
          {options.map(([value, label]) => {
            const selected = reason === value;
            return (
              <Pressable
                key={value}
                disabled={busy}
                onPress={() => setReason(value)}
                accessibilityRole="radio"
                accessibilityState={{ checked: selected, disabled: busy }}
                accessibilityLabel={label}
                style={[
                  styles.option,
                  {
                    borderColor: selected ? colors.red : colors.border,
                    backgroundColor: selected ? colors.redTint : colors.surface,
                  },
                ]}>
                <View style={[styles.radio, { borderColor: selected ? colors.red : colors.muted }]}>
                  {selected ? <View style={[styles.radioDot, { backgroundColor: colors.red }]} /> : null}
                </View>
                <AppText color={selected ? 'red' : 'text'} style={styles.flex}>
                  {label}
                </AppText>
              </Pressable>
            );
          })}
        </View>
        {selling ? (
          <Notice
            message={`Por privacidade, ${SOLD_RETENTION_DAYS} dias depois da venda o anúncio é apagado de vez, com fotos, placa e endereço. Até lá, você pode publicar de novo se a venda não fechar.`}
          />
        ) : null}
        {error ? <Notice tone="error" message={error} /> : null}
        <View style={styles.buttons}>
          <Button label="Cancelar" variant="secondary" disabled={busy} onPress={close} style={styles.flex} />
          <Button
            label={selling ? 'Marcar como vendido' : 'Retirar da vitrine'}
            disabled={!reason}
            loading={busy}
            onPress={() => reason && onSubmit(reason)}
            style={styles.flex2}
          />
        </View>
      </ScrollView>
    </Sheet>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  flex2: { flex: 2 },
  backdrop: { flex: 1, justifyContent: 'flex-end' },
  sheet: {
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    borderWidth: StyleSheet.hairlineWidth,
    borderBottomWidth: 0,
    paddingTop: space.sm,
    maxHeight: '88%',
  },
  grabber: { alignSelf: 'center', width: 36, height: 5, borderRadius: 3, marginBottom: space.sm },
  head: { paddingHorizontal: space.lg, paddingBottom: space.md, gap: 2 },
  action: {
    minHeight: touch + 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    paddingHorizontal: space.lg,
    paddingVertical: space.sm,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  actionText: { flex: 1, gap: 2 },
  form: { paddingHorizontal: space.lg, paddingBottom: space.sm, gap: space.md },
  options: { gap: space.sm },
  option: {
    minHeight: touch + 4,
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    paddingHorizontal: space.md,
    borderRadius: radius.md,
    borderWidth: 1,
  },
  radio: { width: 20, height: 20, borderRadius: 10, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
  radioDot: { width: 10, height: 10, borderRadius: 5 },
  buttons: { flexDirection: 'row', gap: space.sm, marginTop: space.xs },
});

export type ListFilters = {
  marca?: string;
  modelo?: string;
  /** Reais, só dígitos (como no formulário de anúncio). */
  precoMinimo?: string;
  precoMaximo?: string;
  condicao?: 'ZERO_KM' | 'USADO' | 'REPASSE';
  /** Publicados nos últimos N dias. */
  periodo?: 7 | 30 | 90;
};

export const hasListFilters = (filters: ListFilters) => Object.values(filters).some((value) => value !== undefined && value !== '');

const conditionOptions: { value: NonNullable<ListFilters['condicao']>; label: string }[] = [
  { value: 'ZERO_KM', label: 'Zero km' },
  { value: 'USADO', label: 'Seminovo' },
  { value: 'REPASSE', label: 'Repasse' },
];
const periodOptions: { value: NonNullable<ListFilters['periodo']>; label: string }[] = [
  { value: 7, label: 'Últimos 7 dias' },
  { value: 30, label: 'Últimos 30 dias' },
  { value: 90, label: 'Últimos 90 dias' },
];

/** Filtros de Meus anúncios (marca, modelo, preço, condição e período de publicação), como no site. */
export function FiltersSheet({
  visible,
  initial,
  onApply,
  onClose,
}: {
  visible: boolean;
  initial: ListFilters;
  onApply: (filters: ListFilters) => void;
  onClose: () => void;
}) {
  const [draft, setDraft] = useState<ListFilters>(initial);
  const set = <K extends keyof ListFilters>(key: K, value: ListFilters[K]) =>
    setDraft((current) => ({ ...current, [key]: value || undefined }));
  const invalidRange =
    Boolean(draft.precoMinimo && draft.precoMaximo) && Number(draft.precoMinimo) > Number(draft.precoMaximo);
  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onShow={() => setDraft(initial)}
      onRequestClose={onClose}>
      <FiltersBody
        draft={draft}
        set={set}
        invalidRange={invalidRange}
        onClear={() => setDraft({})}
        onApply={() => onApply(draft)}
        onClose={onClose}
      />
    </Modal>
  );
}

function FiltersBody({
  draft,
  set,
  invalidRange,
  onClear,
  onApply,
  onClose,
}: {
  draft: ListFilters;
  set: <K extends keyof ListFilters>(key: K, value: ListFilters[K]) => void;
  invalidRange: boolean;
  onClear: () => void;
  onApply: () => void;
  onClose: () => void;
}) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  return (
    <View
      style={[
        filterStyles.page,
        {
          backgroundColor: colors.bg,
          paddingTop: Platform.OS === 'ios' ? space.lg : insets.top + space.md,
          paddingBottom: insets.bottom + space.md,
        },
      ]}>
      <View style={[filterStyles.pageHeader, { borderBottomColor: colors.border }]}>
        <AppText variant="title" accessibilityRole="header">
          Filtrar anúncios
        </AppText>
        <Pressable
          onPress={onClose}
          hitSlop={12}
          accessibilityRole="button"
          accessibilityLabel="Fechar filtros"
          style={[filterStyles.close, { backgroundColor: colors.subtle }]}>
          <X size={20} color={colors.text} />
        </Pressable>
      </View>
      <ScrollView contentContainerStyle={filterStyles.pageBody} keyboardShouldPersistTaps="handled">
        <TextField label="Marca" value={draft.marca ?? ''} onChangeText={(value) => set('marca', value)} maxLength={80} />
        <TextField label="Modelo" value={draft.modelo ?? ''} onChangeText={(value) => set('modelo', value)} maxLength={120} />
        <View style={filterStyles.row}>
          <View style={styles.flex}>
            <TextField
              label="Preço mínimo (R$)"
              value={displayMasked('money', draft.precoMinimo ?? '')}
              keyboardType="number-pad"
              maxLength={maskInput.money.maxLength}
              onChangeText={(value) => set('precoMinimo', cleanMasked('money', value))}
            />
          </View>
          <View style={styles.flex}>
            <TextField
              label="Preço máximo (R$)"
              value={displayMasked('money', draft.precoMaximo ?? '')}
              keyboardType="number-pad"
              maxLength={maskInput.money.maxLength}
              error={invalidRange ? 'Menor que o mínimo.' : null}
              onChangeText={(value) => set('precoMaximo', cleanMasked('money', value))}
            />
          </View>
        </View>
        <AppText variant="label">Condição</AppText>
        <View style={filterStyles.chipRow}>
          {conditionOptions.map((option) => (
            <Chip
              key={option.value}
              label={option.label}
              selected={draft.condicao === option.value}
              onPress={() => set('condicao', draft.condicao === option.value ? undefined : option.value)}
            />
          ))}
        </View>
        <AppText variant="label">Publicados</AppText>
        <View style={filterStyles.chipRow}>
          {periodOptions.map((option) => (
            <Chip
              key={option.value}
              label={option.label}
              selected={draft.periodo === option.value}
              onPress={() => set('periodo', draft.periodo === option.value ? undefined : option.value)}
            />
          ))}
        </View>
      </ScrollView>
      <View style={[filterStyles.pageFooter, { borderTopColor: colors.border }]}>
        <Button label="Limpar" variant="secondary" onPress={onClear} style={styles.flex} />
        <Button label="Ver anúncios" disabled={invalidRange} onPress={onApply} style={styles.flex2} />
      </View>
    </View>
  );
}

const filterStyles = StyleSheet.create({
  page: { flex: 1 },
  pageHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: space.lg,
    paddingBottom: space.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  close: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  pageBody: { padding: space.lg, gap: space.md },
  row: { flexDirection: 'row', gap: space.sm },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  pageFooter: {
    flexDirection: 'row',
    gap: space.sm,
    paddingHorizontal: space.lg,
    paddingTop: space.md,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
});
