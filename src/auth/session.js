// The saved admin sign-in. It lives in localStorage so it survives closing the browser, until the
// token's own expiry (set by the server) or until the admin signs out.
const KEY = 'sbos.session';
export const SESSION_EXPIRED_EVENT = 'auth:expired';

export function loadSession() {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const session = JSON.parse(raw);
    if (!session?.token || !session?.expiresAt || Date.parse(session.expiresAt) <= Date.now()) {
      localStorage.removeItem(KEY);
      return null;
    }
    return session;
  } catch {
    return null;
  }
}

export function saveSession(session) {
  try {
    localStorage.setItem(KEY, JSON.stringify(session));
  } catch {
    // storage blocked (private mode): the sign-in just won't survive a reload
  }
}

export function clearSession() {
  try {
    localStorage.removeItem(KEY);
  } catch {
    // nothing to clear
  }
}

export const SESSION_STORAGE_KEY = KEY;
