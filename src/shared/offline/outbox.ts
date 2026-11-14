import { api, ApiError } from '../api/apiClient';
import { localStore } from './localStore';
import { netStore } from './connectivity';

// Actions done without network are saved here and sent, in order, when the phone is back online.
export type OutboxItem = {
  id: string; // also the Idempotency-Key, so a resend never duplicates
  userId: string;
  label: string;
  method: 'POST' | 'PATCH';
  path: string;
  body: unknown;
  createdAt: string;
  status: 'pending' | 'failed';
  error?: string;
};

const KEY = 'opexa.outbox';
let currentUserId: string | null = null;
let flushing: Promise<void> | null = null;

export const newKey = () => `k${Date.now().toString(36)}${Math.random().toString(36).slice(2, 10)}`;

async function load(): Promise<OutboxItem[]> {
  return (await localStore.get<OutboxItem[]>(KEY)) ?? [];
}
async function save(items: OutboxItem[]) {
  await localStore.set(KEY, items);
  const mine = items.filter((i) => i.userId === currentUserId);
  netStore.set({ pending: mine.filter((i) => i.status === 'pending').length, failed: mine.filter((i) => i.status === 'failed').length });
}

export async function setOutboxUser(userId: string | null) {
  currentUserId = userId;
  await save(await load());
}

export async function listOutbox(): Promise<OutboxItem[]> {
  return (await load()).filter((i) => i.userId === currentUserId);
}

export async function discard(id: string) {
  await save((await load()).filter((i) => i.id !== id));
}

// Sends now if possible; if there is no network, keeps it for later.
export async function submitOrQueue<T>(label: string, method: 'POST' | 'PATCH', path: string, body: unknown): Promise<{ queued: true } | { queued: false; data: T }> {
  const id = newKey();
  try {
    return { queued: false, data: await api<T>(path, { method, body, headers: { 'Idempotency-Key': id } }) };
  } catch (e) {
    if (!(e instanceof ApiError) || e.code !== 'NETWORK_ERROR' || !currentUserId) throw e;
    const items = await load();
    items.push({ id, userId: currentUserId, label, method, path, body, createdAt: new Date().toISOString(), status: 'pending' });
    await save(items);
    return { queued: true };
  }
}

// Sends waiting items one by one. Stops at the first network failure; a rejected
// item (e.g. "only 2 at site") is marked failed for the person to see and discard.
export function flushOutbox(): Promise<void> {
  if (!flushing) {
    flushing = (async () => {
      netStore.set({ syncing: true });
      try {
        for (const item of await load()) {
          if (item.userId !== currentUserId || item.status !== 'pending') continue;
          try {
            await api(item.path, { method: item.method, body: item.body, headers: { 'Idempotency-Key': item.id } });
            await save((await load()).filter((i) => i.id !== item.id));
          } catch (e) {
            if (e instanceof ApiError && (e.code === 'NETWORK_ERROR' || e.status >= 500 || e.code === 'IN_PROGRESS')) break;
            const msg = e instanceof ApiError ? [e.message, ...e.details.map((d) => d.message)].join(' - ') : 'Could not send';
            await save((await load()).map((i) => (i.id === item.id ? { ...i, status: 'failed', error: msg } : i)));
          }
        }
      } finally {
        netStore.set({ syncing: false });
        flushing = null;
      }
    })();
  }
  return flushing;
}
