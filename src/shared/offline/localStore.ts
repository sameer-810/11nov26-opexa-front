import AsyncStorage from '@react-native-async-storage/async-storage';

// Larger, non-secret storage (screen data cache, offline queue). Works on web too.
export const localStore = {
  get: async <T>(key: string): Promise<T | null> => {
    try {
      const v = await AsyncStorage.getItem(key);
      return v ? (JSON.parse(v) as T) : null;
    } catch {
      return null;
    }
  },
  set: async (key: string, value: unknown) => {
    try {
      await AsyncStorage.setItem(key, JSON.stringify(value));
    } catch {
      /* storage full or unavailable: the app still works online */
    }
  },
  remove: (key: string) => AsyncStorage.removeItem(key).catch(() => undefined),
  removeByPrefix: async (prefix: string) => {
    try {
      const keys = (await AsyncStorage.getAllKeys()).filter((k) => k.startsWith(prefix));
      if (keys.length) await AsyncStorage.multiRemove(keys);
    } catch {
      /* ignore */
    }
  },
};
