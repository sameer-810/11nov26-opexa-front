import { Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';

// Small key-value store. Phones: encrypted SecureStore. Web: localStorage.
const web = {
  async get(key: string) {
    try {
      return globalThis.localStorage?.getItem(key) ?? null;
    } catch {
      return null;
    }
  },
  async set(key: string, value: string) {
    try {
      globalThis.localStorage?.setItem(key, value);
    } catch {
      /* storage unavailable (private mode) - session lasts until reload */
    }
  },
  async remove(key: string) {
    try {
      globalThis.localStorage?.removeItem(key);
    } catch {
      /* ignore */
    }
  },
};

const native = {
  get: (key: string) => SecureStore.getItemAsync(key),
  set: (key: string, value: string) => SecureStore.setItemAsync(key, value),
  remove: (key: string) => SecureStore.deleteItemAsync(key),
};

export const kvStore = Platform.OS === 'web' ? web : native;
