import { StyleSheet, View } from 'react-native';

import type { MetodoPagamento } from '@/api/plans';
import { AppText } from '@/components/app-text';
import { ChoiceRow } from '@/components/choice-row';
import { TextField } from '@/components/text-field';
import { space } from '@/theme';
import { brandLabel, creditBrands, debitBrands, type Card } from '@/utils/card';

/** Campos do cartão. Os dados ficam só na memória da tela e vão do aparelho direto para a Cielo. */
export function CardForm({
  card,
  metodo,
  disabled,
  onChange,
}: {
  card: Card;
  metodo: MetodoPagamento;
  disabled?: boolean;
  onChange: (key: keyof Card, value: string) => void;
}) {
  const debit = metodo === 'CARTAO_DEBITO';
  return (
    <View style={styles.root}>
      <AppText variant="heading">Cartão de {debit ? 'débito' : 'crédito'}</AppText>
      <TextField
        label="Número do cartão"
        value={card.numero}
        onChangeText={(value) => onChange('numero', value)}
        keyboardType="number-pad"
        autoComplete="cc-number"
        textContentType="creditCardNumber"
        placeholder="0000 0000 0000 0000"
        editable={!disabled}
      />
      <TextField
        label="Nome impresso no cartão"
        value={card.titular}
        onChangeText={(value) => onChange('titular', value)}
        autoCapitalize="characters"
        autoCorrect={false}
        autoComplete="name"
        textContentType="name"
        placeholder="COMO ESTÁ NO CARTÃO"
        editable={!disabled}
      />
      <View style={styles.row}>
        <View style={styles.flex}>
          <TextField
            label="Validade"
            value={card.validade}
            onChangeText={(value) => onChange('validade', value)}
            keyboardType="number-pad"
            autoComplete="cc-exp"
            placeholder="MM/AA"
            editable={!disabled}
          />
        </View>
        <View style={styles.flex}>
          <TextField
            label="CVV"
            value={card.codigoSeguranca}
            onChangeText={(value) => onChange('codigoSeguranca', value)}
            keyboardType="number-pad"
            autoComplete="cc-csc"
            secureTextEntry
            placeholder="123"
            editable={!disabled}
          />
        </View>
      </View>
      <AppText variant="label">Bandeira</AppText>
      <ChoiceRow
        value={card.bandeira}
        options={(debit ? debitBrands : creditBrands).map((brand) => ({ value: brand, label: brandLabel(brand) }))}
        onChange={(value) => onChange('bandeira', value)}
        disabled={disabled}
      />
      <AppText variant="caption" color="muted">
        {debit
          ? 'Seu banco vai confirmar a compra, às vezes com um código por SMS ou pelo aplicativo.'
          : 'Se o seu banco pedir, confirme a compra por SMS ou pelo aplicativo.'}
      </AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { gap: space.md },
  row: { flexDirection: 'row', gap: space.md },
  flex: { flex: 1 },
});
