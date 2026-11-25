import * as Location from 'expo-location';

import { ensureLocationPermission } from '@/utils/permission';

/** Onde procurar (ModoLocalizacaoBusca do backend). O raio é decidido pelo servidor e volta em raioKmAplicado. */
export type SearchLocation =
  | { modo: 'BRASIL' }
  | { modo: 'CIDADE'; cidade: string; uf: string }
  | { modo: 'UF'; uf: string }
  | { modo: 'DISPOSITIVO'; latitude: number; longitude: number }
  | { modo: 'ENDERECO_CADASTRADO' };

export const UFS = 'AC AL AP AM BA CE DF ES GO MA MT MS MG PA PB PR PE PI RJ RN RS RO RR SC SP SE TO'.split(' ');

export function locationLabel(location: SearchLocation | undefined) {
  if (!location || location.modo === 'BRASIL') return 'Todo o Brasil';
  if (location.modo === 'CIDADE') return `${location.cidade} (${location.uf})`;
  if (location.modo === 'UF') return `Estado: ${location.uf}`;
  if (location.modo === 'DISPOSITIVO') return 'Perto de mim';
  return 'Perto do meu endereço';
}

/** Parâmetros de /anuncios e /lojistas para a localização escolhida. */
export function locationParams(location: SearchLocation | undefined): Record<string, string | number | undefined> {
  if (!location || location.modo === 'BRASIL') return {};
  if (location.modo === 'CIDADE') return { modoLocalizacao: 'CIDADE', cidade: location.cidade, uf: location.uf };
  if (location.modo === 'UF') return { modoLocalizacao: 'UF', uf: location.uf };
  if (location.modo === 'DISPOSITIVO')
    return { modoLocalizacao: 'DISPOSITIVO', latitude: location.latitude, longitude: location.longitude };
  return { modoLocalizacao: 'ENDERECO_CADASTRADO' };
}

/**
 * Posição aproximada do aparelho (sem precisão alta: a busca é por região). Pede permissão na hora do uso, com a
 * explicação do app antes do pedido do sistema. Devolve null quando a pessoa não autoriza.
 */
export async function deviceLocation(): Promise<SearchLocation | null> {
  if (!(await ensureLocationPermission())) return null;
  const position =
    (await Location.getLastKnownPositionAsync({ maxAge: 10 * 60_000 })) ??
    (await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced }));
  return { modo: 'DISPOSITIVO', latitude: position.coords.latitude, longitude: position.coords.longitude };
}
