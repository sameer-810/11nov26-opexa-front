import { createContext, createElement, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { setTokenHandlers } from '../api/apiClient';
import { kvStore } from '../offline/kvStore';
import { registerForPush, unregisterPush } from '../push/push';
import { localStore } from '../offline/localStore';
import { CACHE_PREFIX, ApiError } from '../api/apiClient';
import { setOutboxUser } from '../offline/outbox';

const ME_KEY = 'opexa.me'; // last signed-in profile, so the app opens without network
import { authApi } from '../../modules/auth/api/authApi';
import type { AuthResponse, Organization, SignInInput, SignUpInput, User } from '../../modules/auth/types';

const REFRESH_KEY = 'opexa.refreshToken';

type Status = 'loading' | 'signedOut' | 'signedIn';

type AuthState = {
  status: Status;
  isSignedIn: boolean;
  user: User | null;
  organization: Organization | null;
  signIn: (input: SignInInput) => Promise<void>;
  signUp: (input: SignUpInput) => Promise<void>;
  signOut: () => Promise<void>;
  setCurrentUser: (user: User) => void;
};

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<Status>('loading');
  const [user, setUser] = useState<User | null>(null);
  const [organization, setOrganization] = useState<Organization | null>(null);
  const accessToken = useRef<string | null>(null);
  const refreshing = useRef<Promise<string | null> | null>(null);

  const clear = useCallback(async () => {
    accessToken.current = null;
    setUser(null);
    setOrganization(null);
    setStatus('signedOut');
    await kvStore.remove(REFRESH_KEY);
    await localStore.remove(ME_KEY);
    await localStore.removeByPrefix(CACHE_PREFIX); // saved screens belong to the person who signed out
    await setOutboxUser(null);
  }, []);

  const apply = useCallback(async (res: AuthResponse) => {
    accessToken.current = res.accessToken;
    await kvStore.set(REFRESH_KEY, res.refreshToken);
    setUser(res.user);
    setOrganization(res.organization);
    setStatus('signedIn');
    await localStore.set(ME_KEY, { user: res.user, organization: res.organization });
    await setOutboxUser(res.user.id);
  }, []);

  // One refresh at a time, even if several requests expire together.
  const refreshAccessToken = useCallback(() => {
    if (!refreshing.current) {
      refreshing.current = (async () => {
        const stored = await kvStore.get(REFRESH_KEY);
        if (!stored) return null;
        try {
          const res = await authApi.refresh(stored);
          await apply(res);
          return res.accessToken;
        } catch (e) {
          // No network is not "signed out": keep the session and try again later.
          if (!(e instanceof ApiError && e.code === 'NETWORK_ERROR')) await clear();
          return null;
        } finally {
          refreshing.current = null;
        }
      })();
    }
    return refreshing.current;
  }, [apply, clear]);

  useEffect(() => {
    setTokenHandlers({ getAccessToken: () => accessToken.current, refreshAccessToken });
  }, [refreshAccessToken]);

  // On app start: restore the saved session if there is one.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const token = await refreshAccessToken();
      if (cancelled || token) return;
      // Offline start: open with the saved profile if this phone still has a session.
      const saved = await localStore.get<{ user: User; organization: AuthResponse['organization'] }>(ME_KEY);
      if (saved && (await kvStore.get(REFRESH_KEY))) {
        setUser(saved.user);
        setOrganization(saved.organization);
        setStatus('signedIn');
        await setOutboxUser(saved.user.id);
      } else setStatus('signedOut');
    })();
    return () => {
      cancelled = true;
    };
  }, [refreshAccessToken]);

  const signIn = useCallback(async (input: SignInInput) => apply(await authApi.signIn(input)), [apply]);
  const signUp = useCallback(async (input: SignUpInput) => apply(await authApi.signUp(input)), [apply]);
  const signOut = useCallback(async () => {
    await unregisterPush(); // needs the session, so before revoking it
    const stored = await kvStore.get(REFRESH_KEY);
    if (stored) await authApi.signOut(stored).catch(() => undefined);
    await clear();
  }, [clear]);

  // Register this phone for push once signed in (no-op on the web).
  const userId = user?.id;
  useEffect(() => {
    if (status === 'signedIn' && userId) registerForPush();
  }, [status, userId]);

  const setCurrentUser = useCallback((u: User) => setUser(u), []);

  const value = useMemo(
    () => ({ status, isSignedIn: status === 'signedIn', user, organization, signIn, signUp, signOut, setCurrentUser }),
    [status, user, organization, signIn, signUp, signOut, setCurrentUser],
  );
  return createElement(AuthContext.Provider, { value }, children);
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
}
