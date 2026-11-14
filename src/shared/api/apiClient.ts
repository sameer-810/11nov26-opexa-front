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

// Calls the API. If the access token has expired, refreshes it once and retries.
// Signed-in GET answers are saved on the device; without network the saved copy is
// returned instead (the offline bar tells the person they are seeing saved data).
export async function api<T>(path: string, options: Options = {}): Promise<T> {
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
