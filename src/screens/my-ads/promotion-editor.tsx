import { useMutation, useQuery } from '@tanstack/react-query';
import { Check, Layers, Plus, Search as SearchIcon, TicketPercent, X } from 'lucide-react-native';
import { useMemo, useState } from 'react';
import { KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import type { PromotionCondition, PromotionConditionType, PromotionScope } from '@/api/contracts';
import { promotionsApi, type Promotion, type PromotionInput } from '@/api/promotions';
import { AppText } from '@/components/app-text';
import { Button } from '@/components/button';
import { Chip } from '@/components/chip';
import { Notice } from '@/components/notice';
import { conditionIcons } from '@/components/promotions';
import { Skeleton } from '@/components/skeleton';
import { TextField } from '@/components/text-field';
import { useTheme } from '@/hooks/use-theme';
import { fonts, radius, space } from '@/theme';
import { cleanMasked, digitsToIsoDate, displayMasked, isoDateToDigits, maskInput } from '@/utils/masks';
import { ChoiceRow } from '@/components/choice-row';

type NumberField = { label: string; placeholder: string; required?: boolean };
type ConditionMeta = { label: string; quantity?: NumberField; percent?: NumberField; money?: NumberField; note: string };

/** Campos de cada tipo de condição (os mesmos do site). Faixas e obrigatoriedade são conferidas no backend. */
const conditionMeta: Record<PromotionConditionType, ConditionMeta> = {
  PARCELAMENTO: { label: 'Parcelamento', quantity: { label: 'Em até quantas vezes', placeholder: '12', required: true }, note: 'Ex.: sem juros no cartão' },
  FINANCIAMENTO: {
    label: 'Financiamento',
    percent: { label: 'Taxa a partir de (% ao mês)', placeholder: '0,99' },
    quantity: { label: 'Em até quantas parcelas', placeholder: '60' },
    note: 'Ex.: entrada a partir de 20%',
  },
  DESCONTO: { label: 'Desconto', percent: { label: 'Desconto (%)', placeholder: '10' }, money: { label: 'Desconto (R$)', placeholder: '2.000' }, note: 'Ex.: pagamento à vista' },
  IPVA_PAGO: { label: 'IPVA pago', note: 'Ex.: IPVA 2027 pago' },
  ABAIXO_FIPE: { label: 'Abaixo da FIPE', percent: { label: 'Quanto abaixo (%)', placeholder: '8' }, note: 'Ex.: tabela de novembro' },
  DOCUMENTACAO_GRATIS: { label: 'Transferência grátis', note: 'Ex.: documentação por nossa conta' },
  BONUS_TROCA: { label: 'Bônus na troca', money: { label: 'Bônus no seu usado (R$)', placeholder: '3.000' }, note: 'Ex.: na avaliação do seu usado' },
  GARANTIA: { label: 'Garantia', quantity: { label: 'Meses de garantia', placeholder: '12' }, note: 'Ex.: motor e câmbio' },
  TANQUE_CHEIO: { label: 'Tanque cheio', note: 'Ex.: na retirada do veículo' },
  OUTRO: { label: 'Outra condição', note: 'Ex.: Película de brinde' },
};
const conditionOrder = Object.keys(conditionMeta) as PromotionConditionType[];
const MAX_CONDITIONS = 6;
const moneyFormat = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 });
const adStatusShort: Record<string, string> = { RASCUNHO: 'Rascunho', PAUSADO: 'Pausado', RESERVADO: 'Reservado' };

type ConditionDraft = {
  tipo: PromotionConditionType;
  quantidade: string;
  percentual: string;
  /** Reais, só dígitos. */
  valor: string;
  observacao: string;
  discountIn: 'percentual' | 'valor';
};

/** Hoje no fuso de Brasília (aaaa-mm-dd), o mesmo das datas da promoção. */
function todayInBrasilia() {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo' }).format(new Date());
}
function addDays(iso: string, days: number) {
  const date = new Date(`${iso}T12:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}
function draftOf(condition: PromotionCondition): ConditionDraft {
  return {
    tipo: condition.tipo,
    quantidade: condition.quantidade == null ? '' : String(condition.quantidade),
    percentual: condition.percentual == null ? '' : String(condition.percentual).replace('.', ','),
    valor: condition.valorCentavos == null ? '' : String(Math.round(condition.valorCentavos / 100)),
    observacao: condition.observacao ?? '',
    discountIn: condition.tipo === 'DESCONTO' && condition.valorCentavos != null ? 'valor' : 'percentual',
  };
}
const emptyDraft = (tipo: PromotionConditionType): ConditionDraft => ({
  tipo,
  quantidade: '',
  percentual: '',
  valor: '',
  observacao: '',
  discountIn: 'percentual',
});
const parseInteger = (text: string) => (text.trim() ? Number.parseInt(text.replace(/\D/g, ''), 10) : null);
const parsePercent = (text: string) => (text.trim() ? Number(text.trim().replace(',', '.')) : null);

function toInput(draft: ConditionDraft): PromotionInput['condicoes'][number] {
  const meta = conditionMeta[draft.tipo];
  const discount = draft.tipo === 'DESCONTO';
  return {
    tipo: draft.tipo,
    quantidade: meta.quantity ? parseInteger(draft.quantidade) : null,
    percentual: meta.percent && (!discount || draft.discountIn === 'percentual') ? parsePercent(draft.percentual) : null,
    valorCentavos: meta.money && (!discount || draft.discountIn === 'valor') && draft.valor ? Number(draft.valor) * 100 : null,
    observacao: draft.observacao.trim() || null,
  };
}

/** Prévia do texto da etiqueta; o texto definitivo vem do backend ao salvar. */
function previewOf(draft: ConditionDraft) {
  const c = toInput(draft);
  const pct = c.percentual == null || Number.isNaN(c.percentual) ? null : String(c.percentual).replace('.', ',');
  const reais = c.valorCentavos == null ? null : moneyFormat.format(c.valorCentavos / 100);
  switch (draft.tipo) {
    case 'FINANCIAMENTO':
      return c.percentual === 0
        ? 'Financiamento com taxa zero'
        : pct
          ? `Financiamento a ${pct}% a.m.`
          : c.quantidade
            ? `Financiamento em até ${c.quantidade}x`
            : 'Financiamento facilitado';
    case 'PARCELAMENTO':
      return c.quantidade ? `Em até ${c.quantidade}x` : 'Parcelamento';
    case 'DESCONTO':
      return pct ? `${pct}% de desconto` : reais ? `${reais} de desconto` : 'Desconto';
    case 'ABAIXO_FIPE':
      return pct ? `${pct}% abaixo da FIPE` : 'Abaixo da FIPE';
    case 'BONUS_TROCA':
      return reais ? `${reais} de bônus na troca` : 'Bônus na troca';
    case 'GARANTIA':
      return c.quantidade ? `Garantia de ${c.quantidade} ${c.quantidade === 1 ? 'mês' : 'meses'}` : 'Garantia';
    case 'OUTRO':
      return draft.observacao.trim() || 'Outra condição';
    default:
      return conditionMeta[draft.tipo].label;
  }
}

type Props = {
  /** null: nova promoção. undefined: fechado. */
  promotion: Promotion | null | undefined;
  onClose: () => void;
  onSaved: (promotion: Promotion, created: boolean) => void;
  /** Painel do DONO: as opções são as do anunciante da promoção, não as da conta logada. */
  anuncianteId?: string | null;
};

/** Criar e editar promoção (PromotionEditor do site), numa folha cheia. */
export function PromotionEditor({ promotion, onClose, onSaved, anuncianteId }: Props) {
  return (
    <Modal visible={promotion !== undefined} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      {promotion !== undefined ? <EditorBody key={promotion?.id ?? 'new'} promotion={promotion} onClose={onClose} onSaved={onSaved} anuncianteId={anuncianteId} /> : null}
    </Modal>
  );
}

function EditorBody({
  promotion,
  onClose,
  onSaved,
  anuncianteId,
}: {
  promotion: Promotion | null;
  onClose: () => void;
  onSaved: Props['onSaved'];
  anuncianteId?: string | null;
}) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const editing = Boolean(promotion);
  const today = todayInBrasilia();
  const [title, setTitle] = useState(promotion?.titulo ?? '');
  const [description, setDescription] = useState(promotion?.descricao ?? '');
  const [conditions, setConditions] = useState<ConditionDraft[]>(
    promotion ? promotion.condicoes.map(draftOf) : [emptyDraft('PARCELAMENTO')],
  );
  const [scope, setScope] = useState<PromotionScope>(promotion?.abrangencia ?? 'TODOS');
  const [selected, setSelected] = useState<Set<string>>(
    () => new Set([...(promotion?.anuncioIds ?? []), ...(promotion?.loteIds ?? [])]),
  );
  const [start, setStart] = useState(isoDateToDigits(promotion?.inicio ?? today));
  const [end, setEnd] = useState(isoDateToDigits(promotion?.fim));
  const [active, setActive] = useState(promotion?.ativa ?? true);
  const [filter, setFilter] = useState('');
  const [error, setError] = useState('');

  const options = useQuery({
    queryKey: ['promotion-options', anuncianteId ?? 'mine'],
    queryFn: ({ signal }) => promotionsApi.options(signal, anuncianteId),
  });
  const available = useMemo(() => new Set((options.data ?? []).map((option) => option.id)), [options.data]);
  // Vendidos e excluídos somem das opções: a seleção guarda só o que ainda pode entrar.
  const chosen = options.data ? [...selected].filter((id) => available.has(id)) : [...selected];
  const dropped = options.data
    ? [...(promotion?.anuncioIds ?? []), ...(promotion?.loteIds ?? [])].filter((id) => !available.has(id)).length
    : 0;
  const visible = useMemo(() => {
    const term = filter.trim().toLocaleLowerCase('pt-BR');
    return (options.data ?? []).filter((option) => !term || option.titulo.toLocaleLowerCase('pt-BR').includes(term));
  }, [options.data, filter]);
  const usedTypes = new Set(conditions.map((condition) => condition.tipo));
  const preview = conditions[0] ? previewOf(conditions[0]) : '';

  const save = useMutation({
    mutationFn: (input: PromotionInput) => (promotion ? promotionsApi.update(promotion.id, input) : promotionsApi.create(input)),
    onSuccess: (saved) => onSaved(saved, !promotion),
    onError: (reason) => setError(reason.message),
  });

  function updateCondition(index: number, patch: Partial<ConditionDraft>) {
    setConditions((current) => current.map((condition, i) => (i === index ? { ...condition, ...patch } : condition)));
  }
  function toggleOption(id: string) {
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function submit() {
    setError('');
    if (title.trim().length < 3) return setError('Dê um título com pelo menos 3 letras.');
    if (!conditions.length) return setError('Inclua ao menos uma condição.');
    for (const condition of conditions) {
      const meta = conditionMeta[condition.tipo];
      if (meta.quantity?.required && !condition.quantidade) return setError(`${meta.label}: informe ${meta.quantity.label.toLowerCase()}.`);
      if (condition.tipo === 'DESCONTO' && !(condition.discountIn === 'percentual' ? condition.percentual : condition.valor))
        return setError('Desconto: informe o valor.');
      if (condition.tipo === 'OUTRO' && !condition.observacao.trim()) return setError('Outra condição: descreva a condição.');
    }
    if (scope === 'SELECIONADOS' && !chosen.length) return setError('Escolha ao menos um veículo ou lote.');
    const inicio = digitsToIsoDate(start);
    if (!inicio) return setError('Informe a data de início no formato dd/mm/aaaa.');
    const fim = end ? digitsToIsoDate(end) : null;
    if (end && !fim) return setError('Confira a data final (dd/mm/aaaa) ou deixe em branco.');
    if (fim && fim < inicio) return setError('A data final precisa ser depois do início.');
    const list = options.data ?? [];
    save.mutate({
      titulo: title.trim(),
      descricao: description.trim() || null,
      abrangencia: scope,
      condicoes: conditions.map(toInput),
      anuncioIds: scope === 'SELECIONADOS' ? list.filter((o) => o.tipo === 'ANUNCIO' && selected.has(o.id)).map((o) => o.id) : [],
      loteIds: scope === 'SELECIONADOS' ? list.filter((o) => o.tipo === 'LOTE' && selected.has(o.id)).map((o) => o.id) : [],
      inicio,
      fim,
      ativa: active,
    });
  }

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      style={[
        styles.root,
        {
          backgroundColor: colors.bg,
          paddingTop: Platform.OS === 'ios' ? space.lg : insets.top + space.md,
          paddingBottom: insets.bottom + space.md,
        },
      ]}>
      <View style={[styles.header, { borderBottomColor: colors.border }]}>
        <AppText variant="title" accessibilityRole="header">
          {editing ? 'Editar promoção' : 'Nova promoção'}
        </AppText>
        <Pressable
          onPress={onClose}
          disabled={save.isPending}
          hitSlop={12}
          accessibilityRole="button"
          accessibilityLabel="Fechar sem salvar"
          style={[styles.close, { backgroundColor: colors.subtle }]}>
          <X size={20} color={colors.text} />
        </Pressable>
      </View>
      <ScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">
        <View style={[styles.preview, { backgroundColor: colors.subtle }]} accessibilityLiveRegion="polite">
          <View style={[styles.tag, { backgroundColor: colors.red }]}>
            <TicketPercent size={14} color={colors.onRed} />
            <AppText variant="label" color="onRed">
              {preview || 'Escolha uma condição'}
            </AppText>
          </View>
          <AppText variant="caption" color="muted">
            Assim a etiqueta aparece na foto dos veículos da promoção.
          </AppText>
        </View>

        <TextField label="Título" value={title} onChangeText={setTitle} maxLength={60} placeholder="Ex.: Feirão de novembro" />
        <TextField
          label={`Descrição (opcional) · ${description.length}/600`}
          value={description}
          onChangeText={setDescription}
          maxLength={600}
          multiline
          style={styles.multiline}
          placeholder="Bancos parceiros, entrada mínima, condições de pagamento."
        />

        <View style={styles.group}>
          <AppText variant="heading">Condições</AppText>
          <AppText variant="caption" color="muted">
            A primeira vai na etiqueta da foto. Inclua até {MAX_CONDITIONS}.
          </AppText>
          <View style={styles.wrap}>
            {conditionOrder.map((tipo) => {
              const Icon = conditionIcons[tipo];
              const used = usedTypes.has(tipo);
              return (
                <Chip
                  key={tipo}
                  label={conditionMeta[tipo].label}
                  selected={used}
                  icon={used ? <X size={14} color={colors.red} /> : <Plus size={14} color={colors.text} />}
                  trailing={<Icon size={14} color={used ? colors.red : colors.muted} />}
                  accessibilityLabel={used ? `Remover ${conditionMeta[tipo].label}` : `Adicionar ${conditionMeta[tipo].label}`}
                  onPress={() => {
                    if (!used && conditions.length >= MAX_CONDITIONS) return;
                    setConditions((current) =>
                      used ? current.filter((condition) => condition.tipo !== tipo) : [...current, emptyDraft(tipo)],
                    );
                  }}
                />
              );
            })}
          </View>
          {conditions.map((condition, index) => {
            const meta = conditionMeta[condition.tipo];
            const Icon = conditionIcons[condition.tipo];
            const discount = condition.tipo === 'DESCONTO';
            return (
              <View key={condition.tipo} style={[styles.condition, { borderColor: colors.border, backgroundColor: colors.surface }]}>
                <View style={styles.conditionHead}>
                  <Icon size={16} color={colors.red} />
                  <AppText variant="bodyStrong" style={styles.flex}>
                    {meta.label}
                    {index === 0 ? (
                      <AppText variant="caption" color="muted">
                        {' '}
                        · na etiqueta
                      </AppText>
                    ) : null}
                  </AppText>
                  {index > 0 ? (
                    <Pressable
                      onPress={() =>
                        setConditions((current) => {
                          const next = [...current];
                          [next[0], next[index]] = [next[index], next[0]];
                          return next;
                        })
                      }
                      hitSlop={8}
                      accessibilityRole="button"
                      accessibilityLabel={`Usar ${meta.label} na etiqueta`}
                      style={styles.textButton}>
                      <AppText variant="label" color="red">
                        Usar na etiqueta
                      </AppText>
                    </Pressable>
                  ) : null}
                </View>
                {discount ? (
                  <ChoiceRow
                    value={condition.discountIn}
                    options={[
                      { value: 'percentual', label: 'Em %' },
                      { value: 'valor', label: 'Em R$' },
                    ]}
                    onChange={(value) => updateCondition(index, { discountIn: value as ConditionDraft['discountIn'] })}
                  />
                ) : null}
                {meta.quantity ? (
                  <TextField
                    label={`${meta.quantity.label}${meta.quantity.required ? ' *' : ''}`}
                    value={condition.quantidade}
                    keyboardType="number-pad"
                    maxLength={3}
                    placeholder={meta.quantity.placeholder}
                    onChangeText={(value) => updateCondition(index, { quantidade: value.replace(/\D/g, '') })}
                  />
                ) : null}
                {meta.percent && (!discount || condition.discountIn === 'percentual') ? (
                  <TextField
                    label={meta.percent.label}
                    value={condition.percentual}
                    keyboardType="decimal-pad"
                    maxLength={6}
                    placeholder={meta.percent.placeholder}
                    onChangeText={(value) => updateCondition(index, { percentual: value.replace(/[^\d,]/g, '') })}
                  />
                ) : null}
                {meta.money && (!discount || condition.discountIn === 'valor') ? (
                  <TextField
                    label={meta.money.label}
                    value={displayMasked('money', condition.valor)}
                    keyboardType="number-pad"
                    maxLength={maskInput.money.maxLength}
                    placeholder={meta.money.placeholder}
                    onChangeText={(value) => updateCondition(index, { valor: cleanMasked('money', value) })}
                  />
                ) : null}
                <TextField
                  label={condition.tipo === 'OUTRO' ? 'Condição *' : 'Observação (opcional)'}
                  value={condition.observacao}
                  maxLength={condition.tipo === 'OUTRO' ? 40 : 80}
                  placeholder={meta.note}
                  onChangeText={(value) => updateCondition(index, { observacao: value })}
                />
              </View>
            );
          })}
        </View>

        <View style={styles.group}>
          <AppText variant="heading">Vale para</AppText>
          <ChoiceRow
            value={scope}
            options={[
              { value: 'TODOS', label: 'Todos os veículos' },
              { value: 'SELECIONADOS', label: 'Escolher veículos e lotes' },
            ]}
            onChange={(value) => setScope(value as PromotionScope)}
          />
          <AppText variant="caption" color="muted">
            {scope === 'TODOS'
              ? 'Todos os anúncios publicados ganham a etiqueta, inclusive os que você publicar depois.'
              : 'Só os escolhidos ganham a etiqueta. Na página da loja e nos outros anúncios, o comprador vê que a loja tem promoção.'}
          </AppText>
          {scope === 'SELECIONADOS' ? (
            options.isError ? (
              <Notice
                tone="error"
                message="Não foi possível carregar seus veículos."
                actionLabel="Tentar de novo"
                onAction={() => options.refetch()}
              />
            ) : !options.data ? (
              <Skeleton height={140} rounded={radius.md} />
            ) : options.data.length === 0 ? (
              <Notice message="Nenhum anúncio à venda ou lote para escolher. Use “Todos os veículos” ou anuncie primeiro." />
            ) : (
              <View style={[styles.picker, { borderColor: colors.border }]}>
                <View style={[styles.search, { borderBottomColor: colors.border }]}>
                  <SearchIcon size={16} color={colors.muted} />
                  <TextInput
                    value={filter}
                    onChangeText={setFilter}
                    placeholder="Filtrar por marca ou modelo"
                    placeholderTextColor={colors.muted}
                    accessibilityLabel="Filtrar veículos"
                    style={[styles.searchInput, { color: colors.text }]}
                  />
                  <AppText variant="caption" color="muted">
                    {chosen.length} {chosen.length === 1 ? 'escolhido' : 'escolhidos'}
                  </AppText>
                </View>
                {dropped > 0 ? (
                  <AppText variant="caption" color="muted" style={styles.dropped}>
                    {dropped} {dropped === 1 ? 'veículo saiu' : 'veículos saíram'} da promoção por terem sido vendidos ou excluídos.
                  </AppText>
                ) : null}
                {visible.length === 0 ? (
                  <AppText color="muted" style={styles.dropped}>
                    Nenhum veículo com esse nome.
                  </AppText>
                ) : (
                  visible.map((option) => {
                    const checked = selected.has(option.id);
                    const meta =
                      option.tipo === 'LOTE'
                        ? `${option.disponiveis ?? 0} ${option.disponiveis === 1 ? 'disponível' : 'disponíveis'}`
                        : [
                            option.status ? adStatusShort[option.status] : null,
                            option.tipoPreco === 'SOB_CONSULTA' || option.precoCentavos == null
                              ? 'Sob consulta'
                              : moneyFormat.format(option.precoCentavos / 100),
                          ]
                            .filter(Boolean)
                            .join(' · ');
                    return (
                      <Pressable
                        key={option.id}
                        onPress={() => toggleOption(option.id)}
                        accessibilityRole="checkbox"
                        accessibilityState={{ checked }}
                        accessibilityLabel={`${option.tipo === 'LOTE' ? 'Lote ' : ''}${option.titulo}, ${meta}`}
                        style={[styles.option, { borderTopColor: colors.border }]}>
                        <View
                          style={[
                            styles.checkbox,
                            checked ? { backgroundColor: colors.red, borderColor: colors.red } : { borderColor: colors.border },
                          ]}>
                          {checked ? <Check size={14} color={colors.onRed} strokeWidth={3} /> : null}
                        </View>
                        <View style={styles.flex}>
                          <View style={styles.optionTitle}>
                            {option.tipo === 'LOTE' ? <Layers size={14} color={colors.muted} /> : null}
                            <AppText numberOfLines={2} style={styles.flex}>
                              {option.titulo}
                            </AppText>
                          </View>
                          <AppText variant="caption" color="muted">
                            {meta}
                          </AppText>
                        </View>
                      </Pressable>
                    );
                  })
                )}
              </View>
            )
          ) : null}
        </View>

        <View style={styles.group}>
          <AppText variant="heading">Período</AppText>
          <TextField
            label="Começa em"
            value={displayMasked('date', start)}
            keyboardType="number-pad"
            maxLength={maskInput.date.maxLength}
            placeholder="dd/mm/aaaa"
            onChangeText={(value) => setStart(cleanMasked('date', value))}
          />
          <View style={styles.wrap}>
            <Chip label="Hoje" selected={start === isoDateToDigits(today)} onPress={() => setStart(isoDateToDigits(today))} />
          </View>
          <TextField
            label="Termina em (opcional)"
            value={displayMasked('date', end)}
            keyboardType="number-pad"
            maxLength={maskInput.date.maxLength}
            placeholder="dd/mm/aaaa"
            onChangeText={(value) => setEnd(cleanMasked('date', value))}
          />
          <View style={styles.wrap}>
            {[7, 15, 30].map((days) => {
              const base = digitsToIsoDate(start) ?? today;
              const value = isoDateToDigits(addDays(base, days));
              return <Chip key={days} label={`Em ${days} dias`} selected={end === value} onPress={() => setEnd(value)} />;
            })}
            <Chip label="Sem data final" selected={!end} onPress={() => setEnd('')} />
          </View>
          <AppText variant="caption" color="muted">
            {end ? 'O último dia conta.' : 'Sem data final: fica no ar até você pausar.'}
          </AppText>
          <ChoiceRow
            value={String(active)}
            options={[
              { value: 'true', label: 'Deixar no ar' },
              { value: 'false', label: 'Salvar pausada' },
            ]}
            onChange={(value) => setActive(value === 'true')}
          />
        </View>
      </ScrollView>
      <View style={[styles.footer, { borderTopColor: colors.border }]}>
        {error ? <Notice tone="error" message={error} /> : null}
        <View style={styles.buttons}>
          <Button label="Cancelar" variant="secondary" disabled={save.isPending} onPress={onClose} style={styles.flex} />
          <Button
            label={editing ? 'Salvar promoção' : 'Criar promoção'}
            loading={save.isPending}
            onPress={submit}
            style={styles.flex2}
          />
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  flex: { flex: 1 },
  flex2: { flex: 2 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: space.lg,
    paddingBottom: space.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  close: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  body: { padding: space.lg, gap: space.lg },
  preview: { padding: space.md, borderRadius: radius.md, gap: space.sm, alignItems: 'flex-start' },
  tag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: space.sm + 2,
    paddingVertical: 4,
    borderRadius: radius.pill,
  },
  multiline: { minHeight: 90, textAlignVertical: 'top' },
  group: { gap: space.md },
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  condition: { padding: space.md, borderRadius: radius.md, borderWidth: 1, gap: space.md },
  conditionHead: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  textButton: { minHeight: 36, justifyContent: 'center' },
  picker: { borderWidth: 1, borderRadius: radius.md, overflow: 'hidden' },
  search: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    paddingHorizontal: space.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  searchInput: { flex: 1, minHeight: 44, fontFamily: fonts.body, fontSize: 15 },
  dropped: { padding: space.md },
  option: {
    minHeight: 56,
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    paddingHorizontal: space.md,
    paddingVertical: space.sm,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  optionTitle: { flexDirection: 'row', alignItems: 'center', gap: space.xs },
  checkbox: { width: 22, height: 22, borderRadius: 6, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
  footer: { paddingHorizontal: space.lg, paddingTop: space.md, borderTopWidth: StyleSheet.hairlineWidth, gap: space.sm },
  buttons: { flexDirection: 'row', gap: space.sm },
});
