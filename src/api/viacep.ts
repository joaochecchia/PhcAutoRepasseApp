export type ViaCepAddress = {
  cep: string;
  logradouro: string;
  complemento: string;
  bairro: string;
  localidade: string;
  uf: string;
  erro?: boolean;
};
export async function findAddressByCep(cep: string): Promise<ViaCepAddress> {
  const digits = cep.replace(/\D/g, "");
  if (digits.length !== 8) throw new Error("Informe os 8 números do CEP.");
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 8000);
  try {
    const response = await fetch(`https://viacep.com.br/ws/${digits}/json/`, {
      signal: controller.signal,
    });
    if (!response.ok) throw new Error("Não foi possível consultar o CEP.");
    const result = (await response.json()) as ViaCepAddress;
    if (result.erro) throw new Error("CEP não encontrado.");
    return result;
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError")
      throw new Error("A consulta do CEP demorou demais. Tente de novo.");
    throw error;
  } finally {
    clearTimeout(timer);
  }
}
