/** Identificação da empresa, como no rodapé do site (`CompanyInfo`). A razão social segue o cartão CNPJ. */
export const company = {
  razaoSocial: 'PHC AUTO REPASSE LEVES E PESADOS TRANSPORTE E LOCACAO DE VEICULOS LTDA',
  cnpj: '07.593.679/0001-19',
  endereco: 'SDN, Asa Norte, Sala 6126, Brasília/DF',
  instagram: 'phc.autorepasse',
} as const;

/** "5561996317461" → "(61) 99631-7461". */
export function formatPhone(phone: string) {
  const local = phone.startsWith('55') ? phone.slice(2) : phone;
  const match = /^(\d{2})(\d{4,5})(\d{4})$/.exec(local);
  return match ? `(${match[1]}) ${match[2]}-${match[3]}` : phone;
}
