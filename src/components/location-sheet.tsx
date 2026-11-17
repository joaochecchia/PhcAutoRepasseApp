import * as Haptics from 'expo-haptics';
import { Globe2, Home, LocateFixed, MapPin, X, type LucideIcon } from 'lucide-react-native';
import { useState } from 'react';
import { Modal, Platform, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppText } from '@/components/app-text';
import { Button } from '@/components/button';
import { Chip } from '@/components/chip';
import { Notice } from '@/components/notice';
import { TextField } from '@/components/text-field';
import { useTheme } from '@/hooks/use-theme';
import { radius, space, touch } from '@/theme';
import { deviceLocation, UFS, type SearchLocation } from '@/utils/location';

type Props = {
  visible: boolean;
  current: SearchLocation | undefined;
  /** Mostra "Perto do meu endereço" (só com sessão). */
  signedIn: boolean;
  onApply: (location: SearchLocation) => void;
  onClose: () => void;
};

/** Escolha de região para a busca: todo o Brasil, perto de mim, endereço cadastrado, cidade ou estado. */
export function LocationSheet({ visible, current, signedIn, onApply, onClose }: Props) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const [cidade, setCidade] = useState('');
  const [uf, setUf] = useState('');
  const [locating, setLocating] = useState(false);
  const [error, setError] = useState('');

  function reset() {
    setError('');
    setLocating(false);
    setCidade(current?.modo === 'CIDADE' ? current.cidade : '');
    setUf(current?.modo === 'CIDADE' || current?.modo === 'UF' ? current.uf : '');
  }

  function apply(location: SearchLocation) {
    Haptics.selectionAsync();
    onApply(location);
  }

  async function nearMe() {
    setLocating(true);
    setError('');
    try {
      apply(await deviceLocation());
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Não foi possível obter sua localização. Tente de novo.');
    } finally {
      setLocating(false);
    }
  }

  function applyRegion() {
    const city = cidade.trim();
    if (!uf) {
      setError('Escolha o estado.');
      return;
    }
    apply(city ? { modo: 'CIDADE', cidade: city, uf } : { modo: 'UF', uf });
  }

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onShow={reset} onRequestClose={onClose}>
      <View
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
            Onde procurar
          </AppText>
          <Pressable
            onPress={onClose}
            hitSlop={12}
            accessibilityRole="button"
            accessibilityLabel="Fechar"
            style={[styles.close, { backgroundColor: colors.subtle }]}>
            <X size={20} color={colors.text} />
          </Pressable>
        </View>
        <ScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">
          <Option
            icon={Globe2}
            label="Todo o Brasil"
            hint="Veículos de qualquer lugar"
            selected={!current || current.modo === 'BRASIL'}
            onPress={() => apply({ modo: 'BRASIL' })}
          />
          <Option
            icon={LocateFixed}
            label="Perto de mim"
            hint="Usa a localização aproximada deste aparelho"
            selected={current?.modo === 'DISPOSITIVO'}
            busy={locating}
            onPress={nearMe}
          />
          {signedIn ? (
            <Option
              icon={Home}
              label="Perto do meu endereço"
              hint="Usa a cidade do seu cadastro"
              selected={current?.modo === 'ENDERECO_CADASTRADO'}
              onPress={() => apply({ modo: 'ENDERECO_CADASTRADO' })}
            />
          ) : null}
          <View style={[styles.region, { borderColor: colors.border, backgroundColor: colors.surface }]}>
            <View style={styles.regionHead}>
              <MapPin size={20} color={colors.text} />
              <AppText variant="bodyStrong">Cidade ou estado</AppText>
            </View>
            <TextField label="Cidade (opcional)" value={cidade} onChangeText={setCidade} placeholder="Ex.: Brasília" maxLength={120} />
            <AppText variant="label">Estado</AppText>
            <View style={styles.ufs}>
              {UFS.map((sigla) => (
                <Chip key={sigla} label={sigla} selected={uf === sigla} onPress={() => setUf(uf === sigla ? '' : sigla)} />
              ))}
            </View>
            <Button label={cidade.trim() ? 'Buscar nesta cidade' : 'Buscar neste estado'} onPress={applyRegion} />
          </View>
          {error ? <Notice tone="error" message={error} /> : null}
        </ScrollView>
      </View>
    </Modal>
  );
}

type OptionProps = {
  icon: LucideIcon;
  label: string;
  hint: string;
  selected: boolean;
  onPress: () => void;
  busy?: boolean;
};

function Option({ icon: Icon, label, hint, selected, onPress, busy }: OptionProps) {
  const { colors } = useTheme();
  return (
    <Pressable
      onPress={onPress}
      disabled={busy}
      accessibilityRole="radio"
      accessibilityState={{ selected, busy }}
      accessibilityLabel={label}
      accessibilityHint={hint}
      style={({ pressed }) => [
        styles.option,
        {
          borderColor: selected ? colors.red : colors.border,
          backgroundColor: selected ? colors.redTint : pressed ? colors.subtle : colors.surface,
        },
      ]}>
      <Icon size={20} color={selected ? colors.red : colors.text} />
      <View style={styles.flex}>
        <AppText variant="bodyStrong" color={selected ? 'red' : 'text'}>
          {busy ? 'Obtendo localização…' : label}
        </AppText>
        <AppText variant="caption" color="muted">
          {hint}
        </AppText>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  flex: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: space.lg,
    paddingBottom: space.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  close: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  body: { padding: space.lg, gap: space.md },
  option: {
    minHeight: touch + 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    padding: space.md,
    borderRadius: radius.md,
    borderWidth: 1,
  },
  region: { padding: space.md, borderRadius: radius.md, borderWidth: 1, gap: space.md },
  regionHead: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  ufs: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
});
