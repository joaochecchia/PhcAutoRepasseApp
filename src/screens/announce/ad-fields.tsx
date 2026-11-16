import { File } from "expo-file-system";
import * as ImageManipulator from "expo-image-manipulator";
import type * as ImagePicker from "expo-image-picker";
import { Pressable, ScrollView, StyleSheet, View } from "react-native";

import type { Catalog, UploadFile } from "@/api/announce";
import { AppText } from "@/components/app-text";
import { TextField } from "@/components/text-field";
import { useTheme } from "@/hooks/use-theme";
import { radius, space, touch } from "@/theme";
import { cleanMasked, displayMasked, maskInput } from "@/utils/masks";
import type { Field, VehicleType } from "./fields";

type Option = { value: string; label: string };

/** Opções em pílulas (uma escolha). Usado em Sim/Não, condição, tipo de preço e situação. */
export function ChoiceRow({
  value,
  options,
  onChange,
}: {
  value: string | undefined;
  options: Option[];
  onChange: (value: string) => void;
}) {
  const { colors } = useTheme();
  return (
    <View style={styles.choices}>
      {options.map((item) => {
        const selected = value === item.value;
        return (
          <Pressable
            key={item.value}
            accessibilityRole="radio"
            accessibilityState={{ selected }}
            accessibilityLabel={item.label}
            onPress={() => onChange(item.value)}
            style={[
              styles.chip,
              {
                borderColor: selected ? colors.red : colors.border,
                backgroundColor: selected ? colors.redTint : colors.surface,
              },
            ]}
          >
            <AppText variant="label" color={selected ? "red" : "text"}>
              {item.label}
            </AppText>
          </Pressable>
        );
      })}
    </View>
  );
}

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
 */
export function AdField({
  item,
  prefix = "",
  values,
  suggestions = [],
  onChange,
}: {
  item: Field;
  prefix?: string;
  values: Record<string, string>;
  suggestions?: string[];
  onChange: (key: string, value: string) => void;
}) {
  const { colors } = useTheme();
  const key = `${prefix}${item.key}`;
  const label = `${item.label}${item.required ? " *" : ""}`;
  const current = values[key] || "";
  if (item.kind === "boolean")
    return (
      <View style={styles.field}>
        <AppText variant="label">{label}</AppText>
        <ChoiceRow
          value={current}
          options={[
            { value: "true", label: "Sim" },
            { value: "false", label: "Não" },
          ]}
          onChange={(value) => onChange(key, value)}
        />
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

const MAX_PHOTO_BYTES = 3 * 1024 * 1024;

/** Reduz a foto para até 1600 px e 3 MB em JPEG, como o site faz antes de enviar. */
export async function preparePhoto(
  asset: ImagePicker.ImagePickerAsset,
  name: string,
): Promise<UploadFile> {
  if (asset.fileSize && asset.fileSize > 60 * 1024 * 1024)
    throw new Error("Uma foto passa de 60 MB.");
  let image = await ImageManipulator.manipulateAsync(
    asset.uri,
    [{ resize: { width: Math.min(asset.width, 1600) } }],
    { compress: 0.85, format: ImageManipulator.SaveFormat.JPEG },
  );
  for (const quality of [0.75, 0.65]) {
    if (new File(image.uri).size <= MAX_PHOTO_BYTES) break;
    image = await ImageManipulator.manipulateAsync(image.uri, [], {
      compress: quality,
      format: ImageManipulator.SaveFormat.JPEG,
    });
  }
  if (new File(image.uri).size > MAX_PHOTO_BYTES)
    throw new Error("Uma foto continua acima de 3 MB após a preparação.");
  return { uri: image.uri, name, type: "image/jpeg" };
}

const styles = StyleSheet.create({
  field: { gap: space.sm },
  multiline: { minHeight: 120, textAlignVertical: "top" },
  choices: { flexDirection: "row", flexWrap: "wrap", gap: space.sm },
  chip: {
    minHeight: touch,
    borderWidth: 1,
    paddingHorizontal: space.md,
    justifyContent: "center",
    borderRadius: radius.pill,
  },
  suggestion: {
    minHeight: touch,
    borderWidth: 1,
    paddingHorizontal: space.md,
    justifyContent: "center",
    borderRadius: radius.md,
  },
});
