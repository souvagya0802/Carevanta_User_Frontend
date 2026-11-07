'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useState, useSyncExternalStore, type ReactNode } from 'react';
import { api, session } from './api';

export interface Me {
  id: string;
  fullName: string;
  email: string | null;
  phone: string | null;
  status: string;
  emailVerified?: boolean;
  phoneVerified?: boolean;
  mustChangePassword: boolean;
  roles: string[];
  permissions: string[];
}

/** A contact has been confirmed. PENDING_VERIFICATION accounts are not verified yet. */
export const isVerified = (me: Me) => me.status !== 'PENDING_VERIFICATION';

interface AuthState {
  me: Me | null;
  /** True while a stored session is being restored (only when one exists). */
  loading: boolean;
  can: (...permissions: string[]) => boolean;
  login: (identifier: string, password: string) => Promise<Me>;
  logout: () => Promise<void>;
  reload: () => Promise<void>;
}

const AuthContext = createContext<AuthState | null>(null);

/**
 * Tells the CSS before React hydrates whether a session is being restored
 * (see the inline script in app/layout.tsx), so signed-in visitors never see
 * the signed-out header or landing flash while the session loads.
 */
function markSession(on: boolean) {
  if (typeof document === 'undefined') return;
  if (on) document.documentElement.dataset.session = '1';
  else delete document.documentElement.dataset.session;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * Who is signed in. A 401 whose refresh token is still stored means the
 * refresh failed for a passing reason (network, 429, 5xx), so try again a
 * couple of times before giving up for this page view (the session is kept).
 */
async function loadMe(): Promise<Me | null> {
  for (let attempt = 0; ; attempt++) {
    if (!session.accessToken && !session.hasRefreshToken()) return null;
    try {
      return (await api.get<{ data: Me }>('/auth/me')).data;
    } catch {
      if (!session.hasRefreshToken() || attempt >= 2) return null;
      await sleep(attempt === 0 ? 1200 : 3500);
    }
  }
}

// Start restoring the session as soon as this module loads on the client,
// before React hydrates and before any page query competes for the network.
let restoring: Promise<Me | null> | null = null;
const restoreSession = () => (restoring ??= loadMe());
if (typeof window !== 'undefined') {
  try {
    if (session.hasRefreshToken()) void restoreSession();
  } catch {
    /* ignore */
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [me, setMe] = useState<Me | null>(null);
  const [loading, setLoading] = useState(true);

  const reload = useCallback(async () => {
    const m = await loadMe();
    setMe(m);
    setLoading(false);
    markSession(!!m);
  }, []);

  useEffect(() => {
    let active = true;
    restoreSession().then((m) => {
      if (!active) return;
      setMe(m);
      setLoading(false);
      markSession(!!m);
    });
    const unsubscribe = session.subscribe((signedIn) => {
      if (!signedIn) { setMe(null); markSession(false); }
    });
    return () => {
      active = false;
      unsubscribe();
    };
  }, []);

  const login = useCallback(async (identifier: string, password: string) => {
    const { data } = await api.post<{ data: { accessToken: string; refreshToken: string } }>('/auth/login', { identifier, password });
    session.set(data);
    const meRes = await api.get<{ data: Me }>('/auth/me');
    setMe(meRes.data);
    setLoading(false);
    markSession(true);
    return meRes.data;
  }, []);

  const logout = useCallback(async () => {
    try {
      await api.post('/auth/logout', { allDevices: false });
    } catch {
      /* already invalid */
    }
    session.clear();
    setMe(null);
    markSession(false);
  }, []);

  const value = useMemo<AuthState>(
    () => ({
      me,
      loading,
      can: (...perms) => !!me && perms.every((p) => me.permissions.includes(p)),
      login,
      logout,
      reload,
    }),
    [me, loading, login, logout, reload],
  );
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
}

const noSubscribe = () => () => {};
/**
 * `restoring`: a stored session is being restored right now (show the splash, never the
 * signed-out UI). `pending`: auth is not settled yet but this may be a signed-out visitor
 * (also true during hydration); render both variants with the .when-session /
 * .when-no-session wrappers and let the pre-paint CSS pick.
 */
export function useSessionPhase(): { restoring: boolean; pending: boolean } {
  const { loading } = useAuth();
  const stored = useSyncExternalStore(noSubscribe, () => session.hasRefreshToken(), () => false);
  return { restoring: loading && stored, pending: loading && !stored };
}

/** Same as useAuth, but `null` outside an AuthProvider (shared hooks used in isolated tests). */
export function useOptionalAuth(): AuthState | null {
  return useContext(AuthContext);
}
