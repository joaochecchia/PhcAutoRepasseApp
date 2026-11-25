import { Pressable, StyleSheet, View } from "react-native";
// O ScrollView do Gesture Handler disputa o arraste horizontal com o paginador de etapas e ganha.
import { ScrollView } from "react-native-gesture-handler";

import type { Catalog } from "@/api/announce";
import { AppText } from "@/components/app-text";
import { ChoiceRow } from "@/components/choice-row";
import { TextField } from "@/components/text-field";
import { useTheme } from "@/hooks/use-theme";
import { radius, space, touch } from "@/theme";
import { cleanMasked, displayMasked, maskInput } from "@/utils/masks";
import type { Field, VehicleType } from "./fields";


/** Sugestões do catálogo do backend para o campo, conforme o tipo de veículo. */
export function suggestionsFor(
  catalog: Catalog | undefined,
  tipo: VehicleType,
  fabricante: string,
  key: string,
): string[] {
  const c = catalog;
  if (!c) return [];
  const map: Record<string, string[] | undefined> = {
    fabricante:
      tipo === "MOTO"
        ? c.fabricantesMotos.map((item) => item.valor)
        : tipo === "CAMINHAO"
          ? c.fabricantesCaminhoes.map((item) => item.valor)
          : c.fabricantes.map((item) => item.valor),
    modelo:
      tipo === "MOTO"
        ? c.modelosMotosPorFabricante[fabricante]
        : tipo === "CAMINHAO"
          ? c.modelosCaminhoesPorFabricante[fabricante]
          : c.modelosPorFabricante[fabricante],
    cor: c.cores,
    carroceria: tipo === "CAMINHAO" ? c.carroceriasCaminhao : c.carrocerias,
    cambio:
      tipo === "MOTO"
        ? c.cambiosMotos
        : tipo === "CAMINHAO"
          ? c.cambiosCaminhao
          : c.cambios,
    combustivel: c.combustiveis,
    motorizacao: c.motorizacoes,
    tipoFreio:
      tipo === "MOTO"
        ? c.tiposFreioMotos
        : tipo === "CAMINHAO"
          ? c.tiposFreioCaminhao
          : c.tiposFreio,
    tracao: tipo === "CAMINHAO" ? c.tracoesCaminhao : c.tracoes,
    tipoDirecao: tipo === "CAMINHAO" ? c.direcoesCaminhao : c.direcoes,
    configuracao: c.configuracoesCaminhao,
    implemento: c.implementosCaminhao,
    categoria: c.categoriasMotos,
    partida: c.partidasMotos,
    refrigeracao: c.refrigeracoesMotos,
  };
  return map[key] || [];
}

/**
 * Campo do formulário de anúncio: Sim/Não em pílulas, ou texto com máscara e sugestões do catálogo.
 * `values[key]` guarda o valor limpo (sem pontos), `onChange` recebe o mesmo formato.
 * `error` aparece embaixo do campo; quem chama decide quando mostrá-lo.
 * `inline` põe Sim/Não na mesma linha do rótulo, para a etapa caber na tela.
 */
export function AdField({
  item,
  prefix = "",
  values,
  suggestions = [],
  onChange,
  error,
  onFocus,
  onBlur,
  inline = false,
}: {
  item: Field;
  prefix?: string;
  values: Record<string, string>;
  suggestions?: string[];
  onChange: (key: string, value: string) => void;
  error?: string;
  onFocus?: () => void;
  onBlur?: () => void;
  inline?: boolean;
}) {
  const { colors } = useTheme();
  const key = `${prefix}${item.key}`;
  const label = `${item.label}${item.required ? " *" : ""}`;
  const current = values[key] || "";
  if (item.kind === "boolean")
    return (
      <View style={inline ? styles.inline : styles.field}>
        <AppText variant="label" style={inline ? styles.inlineLabel : undefined}>
          {label}
        </AppText>
        <ChoiceRow
          value={current}
          options={[
            { value: "true", label: "Sim" },
            { value: "false", label: "Não" },
          ]}
          onChange={(value) => onChange(key, value)}
        />
        {error ? (
          <AppText
            variant="caption"
            color="red"
            accessibilityLiveRegion="polite"
            style={inline ? styles.inlineError : undefined}
          >
            {error}
          </AppText>
        ) : null}
      </View>
    );
  const filtered = suggestions.filter(
    (option) =>
      !current ||
      (option
        .toLocaleLowerCase("pt-BR")
        .includes(current.toLocaleLowerCase("pt-BR")) &&
        option !== current),
  );
  const mask = item.mask;
  return (
    <View style={styles.field}>
      <TextField
        label={label}
        value={mask ? displayMasked(mask, current) : current}
        maxLength={mask ? maskInput[mask].maxLength : item.maxLength}
        keyboardType={
          mask
            ? maskInput[mask].keyboardType
            : item.kind === "number"
              ? "decimal-pad"
              : "default"
        }
        multiline={item.multiline}
        style={item.multiline ? styles.multiline : undefined}
        autoCapitalize={mask === "plate" ? "characters" : undefined}
        autoCorrect={mask ? false : undefined}
        error={error}
        onFocus={onFocus}
        onBlur={onBlur}
        onChangeText={(value) =>
          onChange(key, mask ? cleanMasked(mask, value) : value)
        }
      />
      {filtered.length ? (
        <ScrollView
          horizontal
          keyboardShouldPersistTaps="handled"
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.choices}
        >
          {filtered.slice(0, 14).map((text) => (
            <Pressable
              key={text}
              onPress={() => onChange(key, text)}
              accessibilityRole="button"
              accessibilityLabel={`Escolher ${text}`}
              style={[styles.suggestion, { borderColor: colors.border }]}
            >
              <AppText variant="caption">{text}</AppText>
            </Pressable>
          ))}
        </ScrollView>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  field: { gap: space.sm },
  // Com fonte grande ou rótulo longo, Sim/Não desce para a linha de baixo.
  inline: {
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "center",
    justifyContent: "space-between",
    columnGap: space.md,
    rowGap: space.sm,
  },
  inlineLabel: { flexGrow: 1, flexShrink: 1, flexBasis: 140 },
  inlineError: { width: "100%" },
  multiline: { minHeight: 120, textAlignVertical: "top" },
  choices: { flexDirection: "row", flexWrap: "wrap", gap: space.sm },
  suggestion: {
    minHeight: touch,
    borderWidth: 1,
    paddingHorizontal: space.md,
    justifyContent: "center",
    borderRadius: radius.md,
  },
});
