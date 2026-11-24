import { env } from '../../config/env';
import { localStore } from '../offline/localStore';
import { netStore } from '../offline/connectivity';

export type FieldError = { field: string; message: string };

export class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
    public code: string,
    public details: FieldError[] = [],
  ) {
    super(message);
  }
}

type TokenHandlers = {
  getAccessToken: () => string | null;
  // Gets a new access token using the stored refresh token. Returns null if the session is over.
  refreshAccessToken: () => Promise<string | null>;
};

let handlers: TokenHandlers = { getAccessToken: () => null, refreshAccessToken: async () => null };
export const setTokenHandlers = (h: TokenHandlers) => {
  handlers = h;
};

type Options = { method?: 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE'; body?: unknown; auth?: boolean; headers?: Record<string, string> };

async function send<T>(path: string, { method = 'GET', body, auth = true, headers = {} }: Options, token: string | null): Promise<T> {
  let res: Response;
  try {
    const isForm = typeof FormData !== 'undefined' && body instanceof FormData;
    res = await fetch(`${env.apiUrl}${path}`, {
      method,
      headers: {
        ...(isForm ? {} : { 'Content-Type': 'application/json' }),
        ...(auth && token ? { Authorization: `Bearer ${token}` } : {}),
        ...headers,
      },
      body: body === undefined ? undefined : isForm ? (body as FormData) : JSON.stringify(body),
    });
  } catch {
    netStore.set({ online: false });
    throw new ApiError('Cannot reach the server. Check your internet connection.', 0, 'NETWORK_ERROR');
  }
  netStore.set({ online: true });
  const json = await res.json().catch(() => null);
  if (!res.ok || !json?.success) {
    const err = json?.error ?? {};
    throw new ApiError(err.message ?? 'Something went wrong', res.status, err.code ?? 'UNKNOWN', err.details ?? []);
  }
  return json.data as T;
}

export const CACHE_PREFIX = 'opexa.cache:';

// Screen data reopened within FRESH_MS is shown at once from memory while a fresh copy loads in
// the background, and identical GETs running at the same time share one request. Any write (and
// sign-out) empties it, so saved changes show at once.
const FRESH_MS = 15000;
const recent = new Map<string, { at: number; data: unknown }>();
const inFlight = new Map<string, Promise<unknown>>();
export const clearApiMemory = () => { recent.clear(); inFlight.clear(); };

function fetchShared<T>(path: string, options: Options): Promise<T> {
  const pending = inFlight.get(path);
  if (pending) return pending as Promise<T>;
  const p = load<T>(path, options)
    .then((data) => { if (inFlight.get(path) === p) recent.set(path, { at: Date.now(), data }); return data; })
    .finally(() => { if (inFlight.get(path) === p) inFlight.delete(path); });
  inFlight.set(path, p);
  return p;
}

export async function api<T>(path: string, options: Options = {}): Promise<T> {
  if ((options.method ?? 'GET') !== 'GET') { clearApiMemory(); return load<T>(path, options); }
  const hit = recent.get(path);
  if (hit && Date.now() - hit.at < FRESH_MS) {
    fetchShared<T>(path, options).catch(() => undefined); // refresh in the background
    return hit.data as T;
  }
  return fetchShared<T>(path, options);
}

async function load<T>(path: string, options: Options): Promise<T> {
  const auth = options.auth ?? true;
  const cacheable = auth && (options.method ?? 'GET') === 'GET';
  try {
    let data: T;
    let token = auth ? handlers.getAccessToken() : null;
    // Started offline: there is no access token yet, get one now that we may be online.
    if (auth && !token) token = await handlers.refreshAccessToken();
    try {
      data = await send<T>(path, options, token);
    } catch (err) {
      if (auth && err instanceof ApiError && err.status === 401 && err.code === 'TOKEN_EXPIRED') {
        const fresh = await handlers.refreshAccessToken();
        if (!fresh) throw err;
        data = await send<T>(path, options, fresh);
      } else throw err;
    }
    if (cacheable) {
      localStore.set(CACHE_PREFIX + path, data);
      netStore.set({ showingSaved: false });
    }
    return data;
  } catch (err) {
    if (cacheable && err instanceof ApiError && err.code === 'NETWORK_ERROR') {
      const saved = await localStore.get<T>(CACHE_PREFIX + path);
      if (saved !== null) {
        netStore.set({ showingSaved: true });
        return saved;
      }
    }
    throw err;
  }
}

// Downloads a file the API returns (e.g. an Excel template) and returns it as a Blob.
export async function apiBlob(path: string): Promise<Blob> {
  const go = async (token: string | null) => {
    let res: Response;
    try {
      res = await fetch(`${env.apiUrl}${path}`, { headers: token ? { Authorization: `Bearer ${token}` } : {} });
    } catch {
      throw new ApiError('Cannot reach the server. Check your internet connection.', 0, 'NETWORK_ERROR');
    }
    if (res.status === 401) throw new ApiError('Session expired', 401, 'TOKEN_EXPIRED');
    if (!res.ok) throw new ApiError('Download failed', res.status, 'DOWNLOAD_FAILED');
    return res.blob();
  };
  try {
    return await go(handlers.getAccessToken());
  } catch (err) {
    if (err instanceof ApiError && err.code === 'TOKEN_EXPIRED') {
      const fresh = await handlers.refreshAccessToken();
      if (fresh) return go(fresh);
    }
    throw err;
  }
}
