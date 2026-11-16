import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

/**
 * Tokens da sessão: Keychain (iOS) e Keystore (Android), só neste aparelho e disponíveis depois do primeiro
 * desbloqueio (o app pode renovar a sessão em segundo plano). Nunca em AsyncStorage, log ou URL.
 *
 * Na web (só usada para conferir telas em desenvolvimento) não há armazenamento seguro: fica só na memória.
 */
const options: SecureStore.SecureStoreOptions = {
  keychainAccessible: SecureStore.AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY,
};
const memory = new Map<string, string>();
const web = Platform.OS === 'web';

export const secureStorage = {
  async get(key: string) {
    if (web) return memory.get(key) ?? null;
    try {
      return await SecureStore.getItemAsync(key, options);
    } catch {
      return null;
    }
  },
  async set(key: string, value: string) {
    if (web) {
      memory.set(key, value);
      return;
    }
    await SecureStore.setItemAsync(key, value, options);
  },
  async remove(key: string) {
    if (web) {
      memory.delete(key);
      return;
    }
    await SecureStore.deleteItemAsync(key, options).catch(() => undefined);
  },
};
