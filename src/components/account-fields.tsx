import { CheckCircle2, CircleAlert, LoaderCircle } from 'lucide-react-native';
import { useEffect, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import type { AccountDraft } from '@/api/account';
import { findAddressByCep } from '@/api/viacep';
import { AppText } from '@/components/app-text';
import { ChoiceRow } from '@/components/choice-row';
import { TextField } from '@/components/text-field';
import { useTheme } from '@/hooks/use-theme';
import { space } from '@/theme';
import { cleanMasked, digitsToIsoDate, displayMasked, maskInput, onlyDigits, type Mask } from '@/utils/masks';

type Change = (key: string, value: string) => void;
type Errors = Record<string, string>;

const personTypes = [
  { value: 'PF', label: 'Pessoa física' },
  { value: 'PJ', label: 'Pessoa jurídica' },
];

/** Campo de texto ligado ao rascunho; com máscara, guarda só os dígitos. */
function Field({
  name,
  label,
  values,
  errors,
  onChange,
  mask,
  ...rest
}: {
  name: string;
  label: string;
  values: AccountDraft;
  errors?: Errors;
  onChange: Change;
  mask?: Mask;
} & Omit<React.ComponentProps<typeof TextField>, 'label' | 'value' | 'onChangeText' | 'onChange'>) {
  const raw = values[name] ?? '';
  return (
    <TextField
      label={label}
      value={mask ? displayMasked(mask, raw) : raw}
      onChangeText={(text) => onChange(name, mask ? cleanMasked(mask, text) : text)}
      error={errors?.[name]}
      keyboardType={mask ? maskInput[mask].keyboardType : undefined}
      maxLength={mask ? maskInput[mask].maxLength : undefined}
      autoCorrect={mask ? false : undefined}
      {...rest}
    />
  );
}

/**
 * Dados da pessoa, como no site: PF pede CPF e nascimento; PJ pede CNPJ e razão social.
 * `lockType`: no perfil o tipo de pessoa não muda (o servidor não aceita a troca).
 */
export function PersonFields({
  values,
  errors,
  onChange,
  lockType,
  lockEmail,
}: {
  values: AccountDraft;
  errors?: Errors;
  onChange: Change;
  lockType?: boolean;
  lockEmail?: boolean;
}) {
  const pj = values.tipoPessoa === 'PJ';
  const common = { values, errors, onChange };
  return (
    <View style={styles.group}>
      <View style={styles.field}>
        <AppText variant="label">Tipo de pessoa</AppText>
        <ChoiceRow value={values.tipoPessoa} options={personTypes} onChange={(v) => onChange('tipoPessoa', v)} disabled={lockType} />
      </View>
      <Field
        {...common}
        name="nome"
        label={pj ? 'Nome fantasia *' : 'Nome completo *'}
        autoComplete={pj ? 'organization' : 'name'}
        textContentType={pj ? 'organizationName' : 'name'}
        autoCapitalize="words"
        maxLength={120}
      />
      <Field
        {...common}
        name="email"
        label="E-mail *"
        keyboardType="email-address"
        autoCapitalize="none"
        autoCorrect={false}
        autoComplete="email"
        textContentType="emailAddress"
        editable={!lockEmail}
      />
      <Field {...common} name="telefone" label="Telefone de contato *" mask="phone" autoComplete="tel" textContentType="telephoneNumber" />
      {pj ? (
        <>
          <Field {...common} name="cnpj" label="CNPJ *" mask="cnpj" />
          <Field {...common} name="razaoSocial" label="Razão social *" autoCapitalize="words" maxLength={160} />
        </>
      ) : (
        <>
          <Field {...common} name="cpf" label="CPF *" mask="cpf" />
          <Field {...common} name="dataNascimento" label="Data de nascimento *" mask="date" placeholder="DD/MM/AAAA" autoComplete="birthdate-full" />
        </>
      )}
    </View>
  );
}

type CepState = { status: 'idle' | 'loading' | 'success' | 'error'; message: string };

/** Endereço do cadastro. Com os 8 números do CEP, busca no ViaCEP e preenche; a pessoa confere e põe o número. */
export function AddressFields({ values, errors, onChange }: { values: AccountDraft; errors?: Errors; onChange: Change }) {
  const { colors } = useTheme();
  const cep = onlyDigits(values['endereco.cep'] ?? '');
  const [cepState, setCepState] = useState<CepState>({ status: 'idle', message: '' });
  // O último CEP consultado: abrir o perfil já preenchido não sobrescreve o que está salvo.
  const looked = useRef(cep);
  const onChangeRef = useRef(onChange);
  useEffect(() => {
    onChangeRef.current = onChange;
  }, [onChange]);

  useEffect(() => {
    if (cep.length !== 8 || cep === looked.current) return;
    looked.current = cep;
    let active = true;
    setCepState({ status: 'loading', message: 'Buscando endereço…' });
    findAddressByCep(cep)
      .then((address) => {
        if (!active) return;
        const update = onChangeRef.current;
        update('endereco.rua', address.logradouro || '');
        update('endereco.bairro', address.bairro || '');
        update('endereco.cidade', address.localidade || '');
        update('endereco.uf', address.uf || '');
        if (address.complemento) update('endereco.complemento', address.complemento);
        setCepState({ status: 'success', message: 'Endereço encontrado. Confira e informe o número.' });
      })
      .catch((reason: Error) => {
        if (!active) return;
        setCepState({
          status: 'error',
          message: /não encontrado/i.test(reason.message)
            ? 'CEP não encontrado. Confira o número ou preencha o endereço.'
            : 'Não foi possível consultar o CEP. Preencha o endereço.',
        });
      });
    return () => {
      active = false;
    };
  }, [cep]);

  const common = { values, errors, onChange };
  const Icon = cepState.status === 'loading' ? LoaderCircle : cepState.status === 'success' ? CheckCircle2 : CircleAlert;
  return (
    <View style={styles.group}>
      <Field {...common} name="endereco.cep" label="CEP *" mask="cep" autoComplete="postal-code" textContentType="postalCode" />
      {cepState.message && cep.length === 8 ? (
        <View style={styles.cep} accessibilityLiveRegion="polite">
          <Icon size={16} color={cepState.status === 'error' ? colors.red : cepState.status === 'success' ? colors.deal : colors.muted} />
          <AppText variant="caption" color={cepState.status === 'error' ? 'red' : 'muted'} style={styles.flex}>
            {cepState.message}
          </AppText>
        </View>
      ) : null}
      <View style={styles.row}>
        <View style={styles.flex}>
          <Field {...common} name="endereco.cidade" label="Cidade *" maxLength={120} autoCapitalize="words" />
        </View>
        <View style={styles.uf}>
          <Field
            {...common}
            onChange={(key, value) => onChange(key, value.toUpperCase().replace(/[^A-Z]/g, ''))}
            name="endereco.uf"
            label="UF *"
            maxLength={2}
            autoCapitalize="characters"
            autoCorrect={false}
          />
        </View>
      </View>
      <Field {...common} name="endereco.bairro" label="Bairro *" maxLength={120} autoCapitalize="words" />
      <Field {...common} name="endereco.rua" label="Rua / avenida *" maxLength={200} autoCapitalize="words" textContentType="streetAddressLine1" />
      <View style={styles.row}>
        <View style={styles.number}>
          <Field {...common} name="endereco.numero" label="Número" maxLength={20} />
        </View>
        <View style={styles.flex}>
          <Field {...common} name="endereco.complemento" label="Complemento" maxLength={200} placeholder="Apto, bloco…" />
        </View>
      </View>
    </View>
  );
}

export const passwordCriteria: [label: string, test: (value: string) => boolean][] = [
  ['No mínimo 8 caracteres', (v) => v.length >= 8],
  ['Uma letra maiúscula', (v) => /\p{Lu}/u.test(v)],
  ['Uma letra minúscula', (v) => /\p{Ll}/u.test(v)],
  ['Um número', (v) => /\p{N}/u.test(v)],
  ['Um caractere especial, como @, #, $, %, !', (v) => /[^\p{L}\p{N}\s]/u.test(v)],
];

/** Critérios da senha (os mesmos do site), marcados conforme a pessoa digita. */
export function PasswordCriteria({ value }: { value: string }) {
  const { colors } = useTheme();
  return (
    <View style={styles.criteria} accessibilityLabel="Critérios da senha">
      {passwordCriteria.map(([label, test]) => {
        const ok = test(value);
        const Icon = ok ? CheckCircle2 : CircleAlert;
        return (
          <View key={label} style={styles.criterion} accessible accessibilityLabel={`${label}: ${ok ? 'atendido' : 'pendente'}`}>
            <Icon size={14} color={ok ? colors.deal : colors.muted} />
            <AppText variant="caption" color={ok ? 'deal' : 'muted'}>
              {label}
            </AppText>
          </View>
        );
      })}
    </View>
  );
}

const required = (values: AccountDraft, key: string) => !(values[key] ?? '').trim();

/**
 * Validação de formato antes de enviar (o servidor valida de novo e decide). Volta um erro por campo.
 * `address`: cadastro e perfil exigem endereço; `password`: só o cadastro com senha.
 */
export function validateAccount(values: AccountDraft, options: { address: boolean; password: boolean }): Errors {
  const errors: Errors = {};
  const pj = values.tipoPessoa === 'PJ';
  if (required(values, 'nome')) errors.nome = pj ? 'Informe o nome fantasia.' : 'Informe seu nome completo.';
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test((values.email ?? '').trim())) errors.email = 'Informe um e-mail válido.';
  const phone = onlyDigits(values.telefone ?? '');
  if (phone.length < 10) errors.telefone = 'Informe o telefone com DDD.';
  if (pj) {
    if (onlyDigits(values.cnpj ?? '').length !== 14) errors.cnpj = 'O CNPJ tem 14 números.';
    if (required(values, 'razaoSocial')) errors.razaoSocial = 'Informe a razão social.';
  } else {
    if (onlyDigits(values.cpf ?? '').length !== 11) errors.cpf = 'O CPF tem 11 números.';
    const iso = digitsToIsoDate(onlyDigits(values.dataNascimento ?? ''));
    if (!iso) errors.dataNascimento = 'Informe a data no formato DD/MM/AAAA.';
    else if (iso > new Date().toISOString().slice(0, 10)) errors.dataNascimento = 'A data de nascimento não pode ser no futuro.';
  }
  if (options.address) {
    if (onlyDigits(values['endereco.cep'] ?? '').length !== 8) errors['endereco.cep'] = 'O CEP tem 8 números.';
    if (!/^[A-Za-z]{2}$/.test(values['endereco.uf'] ?? '')) errors['endereco.uf'] = 'Use a sigla, ex.: SP.';
    if (required(values, 'endereco.cidade')) errors['endereco.cidade'] = 'Informe a cidade.';
    if (required(values, 'endereco.bairro')) errors['endereco.bairro'] = 'Informe o bairro.';
    if (required(values, 'endereco.rua')) errors['endereco.rua'] = 'Informe a rua.';
  }
  if (options.password) {
    const senha = values.senha ?? '';
    if (!passwordCriteria.every(([, test]) => test(senha))) errors.senha = 'A senha não atende a todos os critérios.';
    else if (senha !== values.confirmacaoSenha) errors.confirmacaoSenha = 'As senhas não coincidem.';
  }
  return errors;
}

const styles = StyleSheet.create({
  group: { gap: space.lg },
  field: { gap: space.sm },
  row: { flexDirection: 'row', gap: space.md },
  flex: { flex: 1 },
  uf: { width: 84 },
  number: { width: 110 },
  cep: { flexDirection: 'row', alignItems: 'center', gap: space.sm, marginTop: -space.sm },
  criteria: { gap: space.xs },
  criterion: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
});
