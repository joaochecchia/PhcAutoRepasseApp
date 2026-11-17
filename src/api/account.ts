import { File, Paths } from 'expo-file-system';
import { Platform } from 'react-native';

import { digitsToIsoDate, isoDateToDigits, onlyDigits } from '@/utils/masks';

import type { UploadFile } from './announce';
import { getJson, request, upload } from './client';
import type { Address, UserProfile } from './contracts';

/** Formulário de conta como no site: chaves planas, endereço em "endereco.campo". */
export type AccountDraft = Record<string, string>;
export type TermsVersions = { versaoTermosUso: string; versaoPoliticaPrivacidade: string };
/** Redefinição e troca de senha (credenciais): primeiro o código por e-mail, depois o token de uso único. */
export type PasswordStep = {
  status: 'AUTORIZADA' | 'SEGUNDO_FATOR_NECESSARIO';
  challengeId: string | null;
  challengeExpiresIn: number;
  emailMascarado: string | null;
  token: string | null;
};

const optional = (value: string | undefined) => value?.trim() || null;

export function addressFromDraft(values: AccountDraft): Address {
  return {
    cep: onlyDigits(values['endereco.cep'] ?? ''),
    cidade: values['endereco.cidade']?.trim() ?? '',
    bairro: values['endereco.bairro']?.trim() ?? '',
    rua: values['endereco.rua']?.trim() ?? '',
    numero: optional(values['endereco.numero']),
    complemento: optional(values['endereco.complemento']),
    uf: values['endereco.uf']?.trim() ?? '',
  };
}

/** Perfil do servidor no formato do formulário. */
export function draftFromProfile(profile: UserProfile): AccountDraft {
  const draft: AccountDraft = {
    tipoPessoa: profile.tipoPessoa,
    nome: profile.nome ?? '',
    email: profile.email ?? '',
    telefone: onlyDigits(profile.telefone ?? ''),
    cpf: onlyDigits(profile.cpf ?? ''),
    // O formulário guarda a data como DDMMAAAA (máscara); o servidor usa AAAA-MM-DD.
    dataNascimento: isoDateToDigits(profile.dataNascimento),
    cnpj: onlyDigits(profile.cnpj ?? ''),
    razaoSocial: profile.razaoSocial ?? '',
  };
  for (const [key, value] of Object.entries(profile.endereco ?? {})) draft[`endereco.${key}`] = value ?? '';
  return draft;
}

/** Dados pessoais comuns a cadastro, cadastro social e perfil (mesmos campos do site). */
function personFields(values: AccountDraft) {
  const pf = values.tipoPessoa !== 'PJ';
  return {
    nome: values.nome?.trim(),
    email: values.email?.trim(),
    telefone: onlyDigits(values.telefone ?? ''),
    cpf: pf ? onlyDigits(values.cpf ?? '') : undefined,
    dataNascimento: pf ? (digitsToIsoDate(onlyDigits(values.dataNascimento ?? '')) ?? undefined) : undefined,
    cnpj: pf ? undefined : onlyDigits(values.cnpj ?? ''),
    razaoSocial: pf ? undefined : values.razaoSocial?.trim(),
    endereco: addressFromDraft(values),
  };
}

/** Cadastro: o aceite vai com a data e as versões dos documentos vigentes, para comprovação. */
export function registrationPayload(values: AccountDraft, versions: TermsVersions, withPassword: boolean) {
  return {
    tipoPessoa: values.tipoPessoa,
    ...personFields(values),
    ...(withPassword ? { senha: values.senha, confirmacaoSenha: values.confirmacaoSenha } : {}),
    aceitouTermos: true,
    aceiteTermosEm: new Date().toISOString(),
    versaoTermosUso: versions.versaoTermosUso,
    versaoPoliticaPrivacidade: versions.versaoPoliticaPrivacidade,
  };
}

export const accountApi = {
  termsVersions: (signal?: AbortSignal) => getJson<TermsVersions>('/compliance/documentos-vigentes', undefined, { signal }),

  /** Conta e foto na mesma requisição: o servidor grava os dois juntos ou nada. */
  async register(values: AccountDraft, versions: TermsVersions, photo: UploadFile | null) {
    const payload = registrationPayload(values, versions, true);
    if (!photo) return request<{ id: string }>('/usuarios/registrar', { method: 'POST', body: payload, timeoutMs: 30_000 });
    const form = new FormData();
    const json = Platform.OS === 'web' ? null : new File(Paths.cache, `cadastro-${Date.now()}.json`);
    try {
      if (json) {
        json.write(JSON.stringify(payload));
        form.append('cadastro', { uri: json.uri, name: 'cadastro.json', type: 'application/json' } as unknown as Blob);
      } else {
        form.append('cadastro', new Blob([JSON.stringify(payload)], { type: 'application/json' }));
      }
      form.append('foto', photo as unknown as Blob);
      return await upload<{ id: string }>('/usuarios/registrar', form, { auth: false, timeoutMs: 60_000 });
    } finally {
      json?.delete();
    }
  },

  /** Merge patch: número e complemento vazios vão como null e são apagados. */
  updateProfile: (usuarioId: string, values: AccountDraft) =>
    request<UserProfile>(`/usuarios/${encodeURIComponent(usuarioId)}`, {
      method: 'PATCH',
      body: personFields(values),
      auth: true,
    }),

  uploadPhoto(usuarioId: string, photo: UploadFile) {
    const form = new FormData();
    form.append('arquivo', photo as unknown as Blob);
    return upload<void>(`/usuarios/${encodeURIComponent(usuarioId)}/foto`, form, { method: 'PUT', timeoutMs: 60_000 });
  },

  /** Esqueci a senha (sem sessão). */
  requestReset: (email: string) =>
    request<PasswordStep>('/credenciais/redefinicoes', { method: 'POST', body: { email: email.trim() } }),
  authorizeReset: (challengeId: string, codigo: string) =>
    request<PasswordStep>('/credenciais/redefinicoes/autorizar', { method: 'POST', body: { challengeId, codigo } }),
  /** Troca de senha de quem está logado: o código vai para o e-mail da conta. */
  requestChange: () => request<PasswordStep>('/credenciais/senha/desafio', { method: 'POST', auth: true }),
  authorizeChange: (challengeId: string, codigo: string) =>
    request<PasswordStep>('/credenciais/senha/autorizar', { method: 'POST', body: { challengeId, codigo }, auth: true }),
  confirmPassword: (token: string, novaSenha: string, confirmacaoSenha: string) =>
    request<void>('/credenciais/redefinicoes/confirmar', { method: 'POST', body: { token, novaSenha, confirmacaoSenha } }),

  /** Cópia de tudo o que a PHC guarda sobre a pessoa (LGPD: acesso e portabilidade). Volta o caminho do arquivo. */
  async downloadMyData(usuarioId: string) {
    const data = await request<unknown>(`/usuarios/${encodeURIComponent(usuarioId)}/dados-pessoais`, {
      auth: true,
      timeoutMs: 60_000,
    });
    const file = new File(Paths.cache, 'meus-dados-phcauto.json');
    if (file.exists) file.delete();
    file.write(JSON.stringify(data, null, 2));
    return file.uri;
  },

  /** Exclui a própria conta; quem tem senha local confirma com ela. O backend encerra a sessão. */
  deleteAccount: (usuarioId: string, senha?: string) =>
    request<void>(`/usuarios/${encodeURIComponent(usuarioId)}/exclusao`, {
      method: 'POST',
      body: { senha: senha || undefined },
      auth: true,
      timeoutMs: 30_000,
    }),
};
