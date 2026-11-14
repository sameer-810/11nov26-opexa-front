jest.mock('expo-image-picker', () => ({
  requestCameraPermissionsAsync: jest.fn(async () => ({ status: 'granted' })),
  launchCameraAsync: jest.fn(async () => ({ canceled: false, assets: [{ uri: 'file:///selfie.jpg' }] })),
  CameraType: { front: 'front' },
}));
jest.mock('expo-image-manipulator', () => ({ manipulateAsync: jest.fn(async (uri: string) => ({ uri })), SaveFormat: { JPEG: 'jpeg' } }));
jest.mock('@react-native-async-storage/async-storage', () => require('@react-native-async-storage/async-storage/jest/async-storage-mock'));
jest.mock('@react-native-community/netinfo', () => ({ addEventListener: jest.fn(() => jest.fn()), fetch: jest.fn(async () => ({ isConnected: true })) }));
// Phone-only modules: no native code in tests.
jest.mock('expo-notifications', () => ({
  setNotificationHandler: jest.fn(),
  setNotificationChannelAsync: jest.fn(),
  getPermissionsAsync: jest.fn(async () => ({ status: 'granted' })),
  requestPermissionsAsync: jest.fn(async () => ({ status: 'granted' })),
  getExpoPushTokenAsync: jest.fn(async () => ({ data: 'ExponentPushToken[test]' })),
  getLastNotificationResponseAsync: jest.fn(async () => null),
  addNotificationResponseReceivedListener: jest.fn(() => ({ remove: jest.fn() })),
  AndroidImportance: { HIGH: 4 },
}));
jest.mock('expo-device', () => ({ isDevice: false }));

// In-memory replacement for SecureStore / localStorage in tests.
jest.mock('../src/shared/offline/kvStore', () => {
  const data = new Map<string, string>();
  return {
    kvStore: {
      get: jest.fn(async (k: string) => data.get(k) ?? null),
      set: jest.fn(async (k: string, v: string) => {
        data.set(k, v);
      }),
      remove: jest.fn(async (k: string) => {
        data.delete(k);
      }),
      __data: data,
    },
  };
});

afterEach(async () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  await require('@react-native-async-storage/async-storage').clear();
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  require('../src/shared/offline/connectivity').netStore.set({ online: true, showingSaved: false, pending: 0, failed: 0, syncing: false });
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  require('../src/shared/offline/kvStore').kvStore.__data.clear();
});
