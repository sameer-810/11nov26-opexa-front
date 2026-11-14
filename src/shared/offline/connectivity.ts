import { useSyncExternalStore } from 'react';

// App-wide network state, shown by the offline bar on every screen.
export type NetState = { online: boolean; showingSaved: boolean; pending: number; failed: number; syncing: boolean };

let state: NetState = { online: true, showingSaved: false, pending: 0, failed: 0, syncing: false };
const listeners = new Set<() => void>();

export const netStore = {
  get: () => state,
  set: (patch: Partial<NetState>) => {
    const next = { ...state, ...patch };
    if (Object.keys(patch).every((k) => next[k as keyof NetState] === state[k as keyof NetState])) return;
    state = next;
    listeners.forEach((l) => l());
  },
  subscribe: (l: () => void) => {
    listeners.add(l);
    return () => listeners.delete(l);
  },
};

export const useNetState = () => useSyncExternalStore(netStore.subscribe, netStore.get, netStore.get);
