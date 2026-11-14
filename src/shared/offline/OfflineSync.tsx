import { useEffect } from 'react';
import NetInfo from '@react-native-community/netinfo';
import { flushOutbox } from './outbox';
import { netStore } from './connectivity';

// Mounted while signed in: sends saved changes when the network comes back,
// and checks every 30 seconds while anything is waiting.
export function OfflineSync() {
  useEffect(() => {
    flushOutbox();
    const unsub = NetInfo.addEventListener((s) => {
      const online = s.isConnected !== false && s.isInternetReachable !== false;
      if (online && !netStore.get().online) netStore.set({ online: true });
      if (online) flushOutbox();
    });
    const timer = setInterval(() => {
      if (netStore.get().pending > 0) flushOutbox();
    }, 30000);
    return () => {
      unsub();
      clearInterval(timer);
    };
  }, []);
  return null;
}
