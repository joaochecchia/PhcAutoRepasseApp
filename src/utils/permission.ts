import * as ImagePicker from 'expo-image-picker';
import * as Location from 'expo-location';
import { Linking } from 'react-native';

import { showDialog } from '@/components/dialog';

type Status = { granted: boolean; canAskAgain: boolean };

type Explanation = {
  get: () => Promise<Status>;
  request: () => Promise<Status>;
  /** Antes do pedido do sistema, na interface do app. */
  title: string;
  message: string;
  allowLabel: string;
  /** Quando o sistema não pergunta mais: só os ajustes do aparelho liberam. */
  blockedTitle: string;
  blockedMessage: string;
};

/**
 * O pedido de permissão do sistema não aceita tema nem texto do app. Por isso a explicação vem antes, num diálogo
 * do PHC Auto, e o sistema só é chamado depois que a pessoa aceita. Recusada de vez, oferece abrir os ajustes.
 * Devolve true quando o recurso pode ser usado agora.
 */
async function askWithExplanation(options: Explanation): Promise<boolean> {
  const current = await options.get();
  if (current.granted) return true;
  if (!current.canAskAgain) {
    showDialog({
      title: options.blockedTitle,
      message: options.blockedMessage,
      actions: [
        { label: 'Agora não', kind: 'cancel' },
        { label: 'Abrir ajustes', onPress: () => Linking.openSettings() },
      ],
    });
    return false;
  }
  const accepted = await new Promise<boolean>((resolve) =>
    showDialog({
      title: options.title,
      message: options.message,
      actions: [
        { label: 'Agora não', kind: 'cancel', onPress: () => resolve(false) },
        { label: options.allowLabel, onPress: () => resolve(true) },
      ],
    }),
  );
  if (!accepted) return false;
  return (await options.request()).granted;
}

/** Câmera para fotografar. `purpose` completa a frase: "Para fotografar o veículo direto pelo app." */
export function ensureCameraPermission(purpose: string) {
  return askWithExplanation({
    get: ImagePicker.getCameraPermissionsAsync,
    request: ImagePicker.requestCameraPermissionsAsync,
    title: 'Usar a câmera',
    message: `Para ${purpose} direto pelo app. A foto só é enviada quando você confirmar.`,
    allowLabel: 'Permitir câmera',
    blockedTitle: 'Câmera desligada',
    blockedMessage: `A câmera está desligada para o PHC Auto nos ajustes do aparelho. Ative lá para ${purpose}.`,
  });
}

/** Localização aproximada para "Perto de mim". */
export function ensureLocationPermission() {
  return askWithExplanation({
    get: Location.getForegroundPermissionsAsync,
    request: Location.requestForegroundPermissionsAsync,
    title: 'Usar sua localização',
    message:
      'Para mostrar veículos e lojas perto de você. O PHC Auto usa só a região aproximada, e só quando você pede.',
    allowLabel: 'Permitir localização',
    blockedTitle: 'Localização desligada',
    blockedMessage:
      'A localização está desligada para o PHC Auto nos ajustes do aparelho. Ative lá para buscar perto de você.',
  });
}
