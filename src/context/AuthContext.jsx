import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { authApi } from '../api/auth';
import { SESSION_EXPIRED_EVENT, SESSION_STORAGE_KEY, clearSession, loadSession, saveSession } from '../auth/session';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [session, setSession] = useState(() => loadSession());

  useEffect(() => {
    const onExpired = () => setSession(null);
    // signing in or out in another tab updates this one too
    const onStorage = (e) => {
      if (e.key === SESSION_STORAGE_KEY || e.key === null) setSession(loadSession());
    };
    window.addEventListener(SESSION_EXPIRED_EVENT, onExpired);
    window.addEventListener('storage', onStorage);
    return () => {
      window.removeEventListener(SESSION_EXPIRED_EVENT, onExpired);
      window.removeEventListener('storage', onStorage);
    };
  }, []);

  // sign out by itself when the token's expiry time arrives
  useEffect(() => {
    if (!session) return undefined;
    const wait = Date.parse(session.expiresAt) - Date.now();
    const timer = setTimeout(() => {
      clearSession();
      setSession(null);
    }, Math.min(Math.max(wait, 0), 2 ** 31 - 1));
    return () => clearTimeout(timer);
  }, [session]);

  const login = useCallback(async (email, password) => {
    const next = await authApi.login(email, password);
    saveSession(next);
    setSession(next);
  }, []);

  const logout = useCallback(() => {
    // The request reads the token before it is cleared below; if it fails (offline), the token still
    // disappears from this browser and expires on its own.
    authApi.logout().catch(() => {});
    clearSession();
    setSession(null);
  }, []);

  const value = useMemo(() => ({ user: session?.name ?? session?.email ?? null, isAuthenticated: !!session, login, logout }), [session, login, logout]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>');
  return ctx;
}
