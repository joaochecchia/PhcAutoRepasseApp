import { useMutation } from '@tanstack/react-query';
import { ScanSearch } from 'lucide-react-native';
import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';

import { normalizePlate, platesApi, type PlateSuggestion } from '@/api/plates';
import { AppText } from '@/components/app-text';
import { Button } from '@/components/button';
import { Notice } from '@/components/notice';
import { useTheme } from '@/hooks/use-theme';
import { radius, space } from '@/theme';

/** Tipos de anúncio com placa (os que têm o campo "Placa completa"); barco e linha amarela não têm. */
export const plateVehicleTypes = ['CARRO', 'MOTO', 'CAMINHAO', 'CAMINHONETE'];

/**
 * Valores do formulário a partir da sugestão (chaves do rascunho: comuns sem prefixo, específicas com "TIPO.").
 * Só entra o que veio preenchido; o resto continua como está. Igual ao site (PlatePrefill.tsx).
 */
export function plateSuggestionValues(suggestion: PlateSuggestion, tipo: string): Record<string, string> {
  const filled: Record<string, string> = {};
  const put = (key: string, value: string | number | boolean | null | undefined) => {
    if (value != null && value !== '' && value !== false) filled[key] = String(value);
  };
  put('fabricante', suggestion.fabricante);
  put('modelo', suggestion.modelo);
  put('versao', suggestion.versao);
  put('anoFabricacao', suggestion.anoFabricacao);
  put('anoModelo', suggestion.anoModelo);
  put('cor', suggestion.cor);
  const p = `${tipo}.`;
  put(`${p}placa`, suggestion.placa);
  put(`${p}combustivel`, suggestion.combustivel);
  put(`${p}cambio`, suggestion.cambio);
  put(`${p}carroceria`, suggestion.carroceria);
  put(`${p}motorizacao`, suggestion.motorizacao);
  put(`${p}turbo`, suggestion.turbo);
  put(`${p}numeroPortas`, suggestion.numeroPortas);
  put(`${p}numeroLugares`, suggestion.numeroLugares);
  put(`${p}cilindradas`, suggestion.cilindradas);
  put(`${p}numeroEixos`, suggestion.numeroEixos);
  put(`${p}pesoBrutoTotalKg`, suggestion.pesoBrutoTotalKg);
  return filled;
}

/**
 * Início do cadastro: a placa (obrigatória) e o botão que preenche o formulário com o que a consulta devolve. A base
 * pode errar, então "Preencher manualmente" segue sem a consulta e tudo continua editável. O preenchimento não conta
 * no limite mensal da consulta por placa (só tem um teto diário contra abuso).
 */
export function PlatePrefillCard({ plateField, plate, applied, onSuggestion, onClear, onManual }: {
  /** Campo "Placa completa" do formulário (AdField), já ligado ao valor e à validação. */
  plateField: ReactNode;
  plate: string;
  applied: PlateSuggestion | null;
  onSuggestion: (suggestion: PlateSuggestion) => void;
  onClear: () => void;
  onManual: () => void;
}) {
  const { colors } = useTheme();
  const lookup = useMutation({ mutationFn: platesApi.suggestion, onSuccess: onSuggestion });
  const normalized = normalizePlate(plate);
  return (
    <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.red }]}>
      <View style={styles.head}>
        <View style={[styles.icon, { backgroundColor: colors.redTint }]}>
          <ScanSearch size={20} color={colors.red} />
        </View>
        <View style={styles.flex}>
          <AppText variant="heading" accessibilityRole="header">
            Comece pela placa
          </AppText>
          <AppText variant="caption" color="muted">
            Buscamos marca, modelo, versão, anos, cor, combustível, câmbio e a FIPE. Depois é só conferir.
          </AppText>
        </View>
      </View>
      {plateField}
      <Button
        label={applied ? 'Buscar de novo' : 'Buscar dados pela placa'}
        icon={<ScanSearch size={18} color={colors.onRed} />}
        loading={lookup.isPending}
        disabled={!normalized}
        onPress={() => lookup.mutate(normalized)}
      />
      {lookup.isError ? <Notice tone="error" message={lookup.error.message} /> : null}
      {applied ? (
        <Notice
          tone="success"
          title="Dados preenchidos pela placa"
          message={[
            'Confira cada campo nas próximas etapas: a base pode ter erros, e você pode mudar qualquer informação.',
            applied.fipeProvavel && applied.versoesPossiveis.length
              ? `A versão é provável. Outras possíveis: ${applied.versoesPossiveis.join(' · ')}.`
              : '',
            applied.fipe ? '' : 'A FIPE não foi vinculada automaticamente: escolha marca, ano e modelo na próxima etapa.',
          ]
            .filter(Boolean)
            .join(' ')}
          actionLabel="Limpar e preencher manualmente"
          onAction={onClear}
        />
      ) : (
        <Button label="Preencher tudo manualmente" variant="ghost" onPress={onManual} />
      )}
      <AppText variant="caption" color="muted">
        Zero km sem placa, barco ou máquina? Escolha o tipo e a condição abaixo. A consulta não mostra dados do
        proprietário.
      </AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  card: { padding: space.lg, borderRadius: radius.lg, borderWidth: 2, gap: space.md },
  head: { flexDirection: 'row', gap: space.md, alignItems: 'flex-start' },
  icon: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
});
