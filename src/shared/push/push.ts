import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import Constants from 'expo-constants';
import { api } from '../api/apiClient';
import { kvStore } from '../offline/kvStore';

const KEY = 'opexa.pushToken';
const isPhone = Platform.OS === 'ios' || Platform.OS === 'android';

if (isPhone) {
  // Show the alert even while the app is open.
  Notifications.setNotificationHandler({
    handleNotification: async () => ({ shouldShowBanner: true, shouldShowList: true, shouldPlaySound: true, shouldSetBadge: false }),
  });
}

// Asks for permission once and sends this phone's Expo push token to the API.
// Does nothing on the web, on emulators, or before the app is linked to an Expo project.
export async function registerForPush(): Promise<string | null> {
  if (!isPhone || !Device.isDevice) return null;
  try {
    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync('default', { name: 'Opexa', importance: Notifications.AndroidImportance.HIGH });
    }
    let { status } = await Notifications.getPermissionsAsync();
    if (status !== 'granted') status = (await Notifications.requestPermissionsAsync()).status;
    if (status !== 'granted') return null;
    const projectId = Constants.expoConfig?.extra?.eas?.projectId ?? Constants.easConfig?.projectId;
    if (!projectId) {
      console.warn('Push: no EAS projectId in app.json yet (run "eas init")');
      return null;
    }
    const token = (await Notifications.getExpoPushTokenAsync({ projectId })).data;
    await api('/notifications/push-token', { method: 'POST', body: { token, platform: Platform.OS } });
    await kvStore.set(KEY, token);
    return token;
  } catch (e) {
    console.warn('Push registration failed', e);
    return null;
  }
}

// On sign-out: this phone should stop getting this person's notifications.
export async function unregisterPush(): Promise<void> {
  const token = await kvStore.get(KEY);
  if (!token) return;
  await api('/notifications/push-token', { method: 'DELETE', body: { token } }).catch(() => undefined);
  await kvStore.remove(KEY);
}

// Calls back with the link of a tapped push (also the one that opened the app).
export function onPushTap(cb: (link: string | null) => void): () => void {
  if (!isPhone) return () => undefined;
  const linkOf = (r: Notifications.NotificationResponse | null) => (r?.notification.request.content.data?.link as string | undefined) ?? null;
  Notifications.getLastNotificationResponseAsync().then((r) => r && cb(linkOf(r))).catch(() => undefined);
  const sub = Notifications.addNotificationResponseReceivedListener((r) => cb(linkOf(r)));
  return () => sub.remove();
}
