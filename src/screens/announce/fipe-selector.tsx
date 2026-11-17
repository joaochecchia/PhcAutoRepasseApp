import { useInfiniteQuery, useQuery } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Keyboard,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  View,
} from "react-native";
import { ChevronRight, X } from "lucide-react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import {
  announceApi,
  type FipeOption,
  type FipeReference,
} from "@/api/announce";
import { AppText } from "@/components/app-text";
import { Button } from "@/components/button";
import { Notice } from "@/components/notice";
import { TextField } from "@/components/text-field";
import { useTheme } from "@/hooks/use-theme";
import { radius, space, touch } from "@/theme";

type FipeType = "cars" | "motorcycles" | "trucks";
type Level = "brand" | "year" | "model";
type Props = {
  tipo: FipeType;
  zeroKm: boolean;
  reference: FipeReference | null;
  onBrand: (name: string) => void;
  onYear: (year: string) => void;
  onResolved: (reference: FipeReference) => void;
  onClear: () => void;
  /** Consulta avulsa (Tabela FIPE): "Zero km" aparece como ano, em vez de vir da condição do anúncio. */
  zeroKmAsYear?: boolean;
  /** A tela mostra o resultado do seu jeito (Tabela FIPE). */
  hideReference?: boolean;
};

export function FipeSelector({
  tipo,
  zeroKm,
  reference,
  onBrand,
  onYear,
  onResolved,
  onClear,
  zeroKmAsYear = false,
  hideReference = false,
}: Props) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const [brand, setBrand] = useState<FipeOption | null>(null);
  const [year, setYear] = useState<FipeOption | null>(null);
  const [model, setModel] = useState<FipeOption | null>(null);
  const [open, setOpen] = useState<Level | null>(null);
  const [term, setTerm] = useState("");
  const [search, setSearch] = useState("");
  const [error, setError] = useState("");
  const [resolving, setResolving] = useState(false);
  useEffect(() => {
    const timer = setTimeout(() => setSearch(term.trim()), 250);
    return () => clearTimeout(timer);
  }, [term]);
  const edition = useQuery({
    queryKey: ["fipe-edition", tipo],
    queryFn: ({ signal }) => announceApi.fipeEdition(tipo, signal),
  });
  const quota = useQuery({
    queryKey: ["fipe-quota-for-ad"],
    queryFn: announceApi.fipeQuota,
    enabled: Boolean(model && !reference),
    staleTime: 0,
  });
  const params =
    edition.data && open
      ? {
          tipo,
          referencia: Number(edition.data.codigo),
          ...(open !== "brand" && brand ? { marcaId: brand.codigo } : {}),
          ...(open === "year" ? { anos: true } : {}),
          ...(open === "model"
            ? { ano: zeroKm ? 32000 : Number(year?.codigo) }
            : {}),
          ...(search ? { termo: search } : {}),
        }
      : null;
  const options = useInfiniteQuery({
    queryKey: ["fipe-options-ad", params],
    initialPageParam: 0,
    queryFn: ({ pageParam, signal }) =>
      announceApi.fipePage({ ...params!, pagina: pageParam }, signal),
    getNextPageParam: (page, pages) =>
      page.temProximaPagina ? pages.length : undefined,
    enabled: Boolean(
      params &&
      (open === "brand" || brand) &&
      (open !== "model" || zeroKm || year),
    ),
  });
  const items = useMemo(
    () => (options.data?.pages.flatMap((page) => page.opcoes) ?? []).filter((item) => open !== "year" || zeroKmAsYear || !item.codigo.startsWith("32000")),
    [options.data, open, zeroKmAsYear],
  );
  function show(level: Level) {
    Keyboard.dismiss();
    setTerm("");
    setSearch("");
    setError("");
    setOpen(level);
  }
  function pick(item: FipeOption) {
    Keyboard.dismiss();
    setOpen(null);
    setTerm("");
    setSearch("");
    setError("");
    if (open === "brand") {
      setBrand(item);
      setYear(null);
      setModel(null);
      onBrand(item.nome);
      onClear();
    } else if (open === "year") {
      setYear(item);
      setModel(null);
      onYear(item.codigo);
      onClear();
    } else if (open === "model") {
      setModel(item);
      onClear();
    }
  }
  async function resolve() {
    if (!brand || !model || !model.anoId || !edition.data?.mesReferencia) {
      setError("Esta versão não tem cotação FIPE disponível.");
      return;
    }
    if (quota.data && !quota.data.ilimitado && quota.data.restantes === 0) {
      setError("Suas consultas FIPE do mês acabaram.");
      return;
    }
    setResolving(true);
    setError("");
    try {
      const result = await announceApi.fipeReference({
        tipo,
        marcaId: brand.codigo,
        modeloId: model.codigo,
        anoId: model.anoId,
        referencia: Number(edition.data.codigo),
        mesReferencia: edition.data.mesReferencia,
      });
      onResolved(result);
      setModel(null);
    } catch (reason) {
      setError(
        reason instanceof Error
          ? reason.message
          : "Não foi possível consultar a FIPE. Tente de novo.",
      );
    } finally {
      setResolving(false);
    }
  }
  const label =
    open === "brand"
      ? "Escolher marca"
      : open === "year"
        ? "Escolher ano"
        : "Escolher modelo";
  return (
    <View style={styles.root}>
      {edition.isPending ? <ActivityIndicator color={colors.red} /> : null}
      {edition.isError ? (
        <Notice
          tone="error"
          message="A tabela FIPE não carregou."
          actionLabel="Tentar de novo"
          actionLoading={edition.isFetching}
          onAction={() => edition.refetch()}
        />
      ) : null}
      {edition.data ? (
        <>
          <AppText color="muted">
            Escolha uma opção por vez. A cotação será consultada só após sua
            confirmação.
          </AppText>
          <SelectRow
            label="Marca"
            value={brand?.nome}
            placeholder="Escolher marca"
            onPress={() => show("brand")}
          />
          {brand && !zeroKm ? (
            <SelectRow
              label="Ano do modelo"
              value={year?.nome}
              placeholder="Escolher ano"
              onPress={() => show("year")}
            />
          ) : null}
          {brand && (year || zeroKm) ? (
            <SelectRow
              label="Modelo / versão"
              value={reference?.modelo || model?.nome}
              placeholder="Escolher modelo"
              onPress={() => show("model")}
            />
          ) : null}
          {model && !reference ? (
            <View
              style={[
                styles.confirm,
                { borderColor: colors.border, backgroundColor: colors.subtle },
              ]}
            >
              <AppText variant="bodyStrong">{model.nome}</AppText>
              {quota.isPending ? (
                <ActivityIndicator color={colors.red} />
              ) : null}
              {quota.data ? (
                <AppText color="muted">
                  {quota.data.ilimitado
                    ? "Sua consulta FIPE é ilimitada."
                    : `${quota.data.restantes ?? 0} de ${quota.data.limite ?? 0} consultas disponíveis neste mês.`}
                </AppText>
              ) : null}
              {quota.isError ? (
                <>
                  <AppText color="red">
                    Não foi possível conferir suas consultas FIPE.
                  </AppText>
                  <Button
                    label="Tentar de novo"
                    variant="secondary"
                    onPress={() => quota.refetch()}
                  />
                </>
              ) : null}
              <Button
                label="Consultar valor na FIPE"
                onPress={resolve}
                loading={resolving}
                disabled={
                  quota.isPending ||
                  quota.isError ||
                  (quota.data?.restantes === 0 && !quota.data?.ilimitado)
                }
              />
            </View>
          ) : null}
          {reference && !hideReference ? (
            <View
              style={[
                styles.confirm,
                {
                  borderColor: colors.dealBorder,
                  backgroundColor: colors.dealTint,
                },
              ]}
            >
              <AppText variant="bodyStrong" color="deal">
                FIPE vinculada
              </AppText>
              <AppText>{reference.modelo}</AppText>
              <AppText color="deal">
                {new Intl.NumberFormat("pt-BR", {
                  style: "currency",
                  currency: "BRL",
                }).format(reference.valorCentavos / 100)}{" "}
                · {reference.mesReferencia}
              </AppText>
            </View>
          ) : null}
        </>
      ) : null}
      {error ? <Notice tone="error" message={error} /> : null}
      <Modal
        visible={Boolean(open)}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setOpen(null)}
      >
        <View
          style={[
            styles.modal,
            {
              backgroundColor: colors.bg,
              // No iOS a folha já começa abaixo da barra de status.
              paddingTop:
                Platform.OS === "ios" ? space.lg : insets.top + space.md,
              paddingBottom: insets.bottom + space.md,
            },
          ]}
        >
          <View style={styles.modalHeader}>
            <AppText variant="title" accessibilityRole="header">
              {label}
            </AppText>
            <Pressable
              onPress={() => {
                Keyboard.dismiss();
                setOpen(null);
              }}
              hitSlop={12}
              accessibilityRole="button"
              accessibilityLabel="Fechar lista"
              style={[styles.close, { backgroundColor: colors.subtle }]}
            >
              <X size={20} color={colors.text} />
            </Pressable>
          </View>
          <TextField
            label={`Buscar ${label.replace("Escolher ", "")}`}
            placeholder="Digite o nome"
            value={term}
            onChangeText={setTerm}
            autoFocus={open !== "year"}
            keyboardType={open === "year" ? "number-pad" : "default"}
          />
          {options.isPending ? <ActivityIndicator color={colors.red} /> : null}
          {options.isError ? (
            <Notice
              tone="error"
              message="Não foi possível buscar na FIPE."
              actionLabel="Tentar de novo"
              actionLoading={options.isFetching}
              onAction={() => options.refetch()}
            />
          ) : null}
          {options.data?.pages.some((page) => page.catalogoPendente) ? (
            <Notice
              title="Catálogo FIPE carregando"
              message="O servidor ainda está montando a lista. Tente de novo em instantes."
              actionLabel="Atualizar"
              actionLoading={options.isFetching}
              onAction={() => options.refetch()}
            />
          ) : null}
          {options.data &&
          items.length === 0 &&
          !options.data.pages.some((page) => page.catalogoPendente) ? (
            <Notice
              message={
                search
                  ? `Nada encontrado para "${search}". Confira a grafia ou tente só parte do nome.`
                  : "Nenhuma opção disponível para esta escolha."
              }
            />
          ) : null}
          <FlatList
            data={items}
            keyExtractor={(item, index) =>
              `${item.codigo}-${item.anoId || ""}-${index}`
            }
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={styles.list}
            onEndReached={() => {
              if (options.hasNextPage && !options.isFetchingNextPage)
                options.fetchNextPage();
            }}
            onEndReachedThreshold={0.4}
            renderItem={({ item }) => (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`Selecionar ${item.nome}`}
                onPress={() => pick(item)}
                style={[styles.option, { borderBottomColor: colors.border }]}
              >
                <AppText>{item.nome}</AppText>
              </Pressable>
            )}
            ListFooterComponent={
              options.isFetchingNextPage ? (
                <ActivityIndicator color={colors.red} />
              ) : undefined
            }
          />
        </View>
      </Modal>
    </View>
  );
}
function SelectRow({
  label,
  value,
  placeholder,
  onPress,
}: {
  label: string;
  value?: string;
  placeholder: string;
  onPress: () => void;
}) {
  const { colors } = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${label}, ${value || "não escolhido"}`}
      accessibilityHint="Abre a lista da FIPE"
      onPress={onPress}
      style={({ pressed }) => [
        styles.row,
        {
          borderColor: colors.border,
          backgroundColor: pressed ? colors.subtle : colors.surface,
        },
      ]}
    >
      <View style={styles.rowText}>
        <AppText variant="caption" color="muted">
          {label}
        </AppText>
        <AppText variant="bodyStrong" color={value ? "text" : "red"}>
          {value || placeholder}
        </AppText>
      </View>
      <ChevronRight size={20} color={colors.muted} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  root: { gap: space.md },
  row: {
    minHeight: 68,
    padding: space.md,
    borderWidth: 1,
    borderRadius: radius.md,
    flexDirection: "row",
    alignItems: "center",
    gap: space.md,
  },
  rowText: { flex: 1, gap: space.xs },
  close: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
  },
  confirm: {
    padding: space.lg,
    borderRadius: radius.md,
    borderWidth: 1,
    gap: space.md,
  },
  modal: { flex: 1, paddingHorizontal: space.lg, gap: space.md },
  modalHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  list: { paddingBottom: space.xl },
  option: {
    minHeight: touch + 12,
    justifyContent: "center",
    borderBottomWidth: StyleSheet.hairlineWidth,
    paddingVertical: space.md,
  },
});
