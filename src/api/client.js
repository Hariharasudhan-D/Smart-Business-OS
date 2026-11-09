// Single place that talks to the Java backend. Every src/api/<entity>.js builds on this.
// In dev the Vite server proxies /api to http://localhost:8080 (see vite.config.js).
// For a deployed build set VITE_API_URL, e.g. https://my-backend.example.com/api
import { SESSION_EXPIRED_EVENT, clearSession, loadSession } from '../auth/session';

const BASE = (import.meta.env.VITE_API_URL || '/api').replace(/\/$/, '');

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const STARTING = [502, 503, 504];

/**
 * A sleeping Render server answers 502/503/504 (or drops the connection) for up to about a minute
 * while it starts. Those are retried for ~90 s; writes only on 502/503/504, which never reach the app.
 */
export async function request(path, options = {}) {
  const isRead = (options.method ?? 'GET') === 'GET';
  for (let attempt = 0; ; attempt++) {
    try {
      return await requestOnce(path, options);
    } catch (err) {
      const retryable = STARTING.includes(err.status) || (isRead && err.status === 'offline');
      if (!retryable || attempt >= 15) throw err;
      await sleep(6000);
    }
  }
}

async function requestOnce(path, options = {}) {
  const headers = { 'Content-Type': 'application/json' };
  const session = loadSession();
  if (session) headers.Authorization = `Bearer ${session.token}`;

  let res;
  try {
    res = await fetch(`${BASE}${path}`, { ...options, headers });
  } catch {
    const err = new Error('Cannot reach the server. Is the backend running?');
    err.status = 'offline';
    throw err;
  }
  if (!res.ok) {
    // A rejected token anywhere else in the app means the sign-in ended: go back to the login page.
    if (res.status === 401 && path !== '/auth/login') {
      clearSession();
      window.dispatchEvent(new Event(SESSION_EXPIRED_EVENT));
      throw new Error('Your sign-in has ended. Please sign in again.');
    }
    let message = `Request failed (${res.status})`;
    try {
      const body = await res.json();
      if (body?.message) message = body.message;
    } catch {
      // response had no JSON body; keep the generic message
    }
    const err = new Error(message);
    err.status = res.status;
    throw err;
  }
  return res.status === 204 ? null : res.json();
}

export function createRestApi(resource) {
  return {
    list: () => request(`/${resource}`),
    create: (input) => request(`/${resource}`, { method: 'POST', body: JSON.stringify(input) }),
    update: (id, patch) => request(`/${resource}/${id}`, { method: 'PATCH', body: JSON.stringify(patch) }),
    remove: (id) => request(`/${resource}/${id}`, { method: 'DELETE' }),
  };
}
