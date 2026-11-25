import { useState } from 'react';
import { StyleSheet, TextInput, View, type NativeSyntheticEvent, type TargetedEvent } from 'react-native';
import Svg, { Circle, Path, Rect } from 'react-native-svg';

import { AppText } from '@/components/app-text';
import { useTheme } from '@/hooks/use-theme';
import { fonts, space } from '@/theme';
import { formatPlate } from '@/utils/masks';

function BrazilFlag() {
  return (
    <Svg width={26} height={18} viewBox="0 0 28 20">
      <Rect width={28} height={20} rx={1.5} fill="#009b3a" />
      <Path d="M14 2.5 25.5 10 14 17.5 2.5 10Z" fill="#fedf00" />
      <Circle cx={14} cy={10} r={4.6} fill="#002776" />
      <Path d="M9.6 9.2c3-.9 6.2-.5 8.8 1.1" stroke="#fff" strokeWidth={0.9} fill="none" />
    </Svg>
  );
}

/**
 * Campo de placa com cara de placa Mercosul (faixa azul com "BRASIL" e bandeira, fundo branco, letras grandes),
 * igual ao do site. Guarda só letras e números, em maiúsculas (ABC1D23). Fica branco também no tema escuro.
 */
export function PlateField({ value, onChangeText, error, onFocus, onBlur, onSubmitEditing, label = 'Placa do veículo' }: {
  value: string;
  onChangeText: (value: string) => void;
  error?: string | null;
  onFocus?: (event: NativeSyntheticEvent<TargetedEvent>) => void;
  onBlur?: (event: NativeSyntheticEvent<TargetedEvent>) => void;
  onSubmitEditing?: () => void;
  label?: string;
}) {
  const { colors } = useTheme();
  const [focused, setFocused] = useState(false);
  return (
    <View style={styles.root}>
      <View
        style={[
          styles.plate,
          { borderColor: error ? colors.red : '#1b1b1d' },
          focused && { shadowColor: colors.red, shadowOpacity: 0.35, shadowRadius: 8, elevation: 6 },
        ]}>
        <View style={styles.band}>
          <AppText style={styles.country}>BRASIL</AppText>
          <View style={styles.flag}>
            <BrazilFlag />
          </View>
        </View>
        <View style={styles.body}>
          <AppText style={styles.br}>BR</AppText>
          <TextInput
            value={value}
            onChangeText={(typed) => onChangeText(formatPlate(typed))}
            placeholder="ABC1D23"
            placeholderTextColor="#b9b9bf"
            autoCapitalize="characters"
            autoCorrect={false}
            autoComplete="off"
            maxLength={8}
            returnKeyType="search"
            onSubmitEditing={onSubmitEditing}
            onFocus={(event) => {
              setFocused(true);
              onFocus?.(event);
            }}
            onBlur={(event) => {
              setFocused(false);
              onBlur?.(event);
            }}
            accessibilityLabel={label}
            accessibilityHint="Letras e números da placa, como ABC1D23"
            style={styles.input}
          />
        </View>
      </View>
      {error ? (
        <AppText variant="caption" color="red" accessibilityLiveRegion="polite" style={styles.error}>
          {error}
        </AppText>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { alignItems: 'center', gap: space.xs },
  plate: {
    width: '100%',
    maxWidth: 360,
    borderWidth: 3,
    borderRadius: 12,
    overflow: 'hidden',
    backgroundColor: '#fff',
    shadowOffset: { width: 0, height: 4 },
  },
  band: { height: 30, backgroundColor: '#1f3c94', alignItems: 'center', justifyContent: 'center' },
  country: { color: '#fff', fontFamily: fonts.heading, fontSize: 14, letterSpacing: 4 },
  flag: { position: 'absolute', right: 10 },
  body: { justifyContent: 'center', paddingHorizontal: space.md },
  br: { position: 'absolute', left: 10, bottom: 6, color: '#1b1b1d', fontFamily: fonts.bold, fontSize: 10 },
  input: {
    height: 70,
    color: '#111',
    fontFamily: fonts.heading,
    fontSize: 42,
    letterSpacing: 3,
    textAlign: 'center',
    padding: 0,
  },
  error: { alignSelf: 'stretch', textAlign: 'center' },
});
