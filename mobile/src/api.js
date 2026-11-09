import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';
import { API_URL } from './config';

// ---------- the sign-in ----------
// Kept in the phone's encrypted store (iOS Keychain / Android Keystore), not in plain app storage, so
// another app or a copied backup cannot read the token. In a browser (preview only) it uses storage.
// The token lasts 90 days and is renewed while the app is used, so the app stays signed in until
// "Sign out" — which also ends the token on the server.
const SESSION_KEY = 'gc.session';
const RENEW_WHEN_DAYS_LEFT = 30;
let session = null;
let onSignedOut = () => {};
const secure = Platform.OS !== 'web';

const store = {
  get: (key) => (secure ? SecureStore.getItemAsync(key) : AsyncStorage.getItem(key)),
  set: (key, value) => (secure ? SecureStore.setItemAsync(key, value) : AsyncStorage.setItem(key, value)),
  remove: (key) => (secure ? SecureStore.deleteItemAsync(key) : AsyncStorage.removeItem(key)),
};

export function setSignedOutHandler(fn) {
  onSignedOut = fn;
}

async function saveSession(next) {
  session = next;
  try {
    await store.set(SESSION_KEY, JSON.stringify(next));
  } catch {
    // could not save: the sign-in just won't survive closing the app
  }
}

export async function loadSession() {
  try {
    let raw = await store.get(SESSION_KEY);
    if (!raw && secure) {
      // Older versions kept the sign-in in plain storage: move it into the encrypted store once.
      raw = await AsyncStorage.getItem(SESSION_KEY);
      if (raw) {
        await store.set(SESSION_KEY, raw);
        await AsyncStorage.removeItem(SESSION_KEY);
      }
    }
    session = raw ? JSON.parse(raw) : null;
    if (session && Date.parse(session.expiresAt) <= Date.now()) {
      session = null;
      await store.remove(SESSION_KEY);
    }
  } catch {
    session = null;
  }
  if (session) renewIfNeeded();
  return session;
}

/** Swaps the token for a fresh one when it has under 30 days left (quietly; errors are ignored). */
async function renewIfNeeded() {
  const daysLeft = (Date.parse(session?.expiresAt) - Date.now()) / 86_400_000;
  if (!session || !(daysLeft < RENEW_WHEN_DAYS_LEFT)) return;
  try {
    const next = await requestOnce('/auth/refresh', { method: 'POST', timeoutMs: 15000 });
    if (next?.token) await saveSession(next);
  } catch {
    // try again next time the app opens
  }
}

/** Forgets the sign-in on this phone (used when the server says it has ended). */
async function forgetSession() {
  session = null;
  cache.clear();
  try {
    await store.remove(SESSION_KEY);
    await AsyncStorage.removeItem(CACHE_KEY);
  } catch {
    // nothing saved
  }
}

/** "Sign out": ends the token on the server too, so a copy of it stops working, then forgets it here. */
export async function signOut() {
  if (session) {
    try {
      await requestOnce('/auth/logout', { method: 'POST', timeoutMs: 8000 });
    } catch {
      // offline: the token is still forgotten here, and it expires on its own
    }
  }
  await forgetSession();
}

// ---------- remembered answers, so screens open instantly ----------
// Every successful read is kept in memory; screens show it at once (peek) and refresh in the background.
// Small answers (reports, customers, the cake list) are also saved on the phone, so even a fresh start
// shows the last numbers immediately. Big lists (all sales, purchases) stay in memory only.
const CACHE_KEY = 'gc.cache.v1';
const cache = new Map();
const KEEP_ON_PHONE = (path) =>
  path.startsWith('/report') || path === '/customers' || path === '/products' || path === '/website-cakes' || (path.startsWith('/sales/feed') && path.includes('page=0'));
let cacheLoad = null;
let saveTimer = null;

/** Reads the answers saved on the phone. Call once at start, before the first screen. */
export function loadCache() {
  cacheLoad ??= AsyncStorage.getItem(CACHE_KEY)
    .then((raw) => {
      if (raw) for (const [path, data] of JSON.parse(raw)) if (!cache.has(path)) cache.set(path, data);
    })
    .catch(() => {});
  return cacheLoad;
}

/** The last answer for a read, or undefined if it was never loaded. */
export const peek = (path) => cache.get(path);

function remember(path, data) {
  cache.delete(path); // re-insert so the newest are kept when trimming
  cache.set(path, data);
  if (!KEEP_ON_PHONE(path)) return;
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    const kept = [...cache].filter(([p]) => KEEP_ON_PHONE(p));
    const many = ([p]) => p.startsWith('/report') || p.startsWith('/sales/feed'); // one per date / search: keep the newest 30
    const reports = kept.filter(many).slice(-30);
    const lists = kept.filter((e) => !many(e));
    const text = JSON.stringify([...lists, ...reports]);
    if (text.length < 1_500_000) AsyncStorage.setItem(CACHE_KEY, text).catch(() => {});
  }, 800);
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const STARTING = [502, 503, 504];

/**
 * A free Render server sleeps when idle and takes up to about a minute to start; meanwhile it answers
 * 502/503/504 (or the connection drops). Those are retried for up to ~90 s. Writes are only retried on
 * 502/503/504, which mean the request never reached the app, so a sale is never saved twice.
 */
async function request(path, options = {}) {
  const isRead = (options.method ?? 'GET') === 'GET';
  for (let attempt = 0; ; attempt++) {
    try {
      const data = await requestOnce(path, options);
      if (isRead && session) remember(path, data);
      return data;
    } catch (err) {
      const retryable = STARTING.includes(err.code) || (isRead && err.code === 'offline');
      if (!retryable || attempt >= 15) throw err;
      await sleep(6000);
    }
  }
}

/** Starts waking the server as soon as the app opens; errors are ignored. */
export function wakeUp() {
  fetch(`${API_URL}/health`).catch(() => {});
}

/** Errors carry a short code the screens translate: offline, timeout, or the HTTP status. */
async function requestOnce(path, { method = 'GET', body, timeoutMs = 75000 } = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  const headers = { 'Content-Type': 'application/json' };
  if (session) headers.Authorization = `Bearer ${session.token}`;
  let res;
  try {
    res = await fetch(`${API_URL}${path}`, { method, headers, body: body ? JSON.stringify(body) : undefined, signal: controller.signal });
  } catch (e) {
    const err = new Error(e?.name === 'AbortError' ? 'timeout' : 'offline');
    err.code = err.message;
    throw err;
  } finally {
    clearTimeout(timer);
  }
  if (!res.ok) {
    let message = '';
    try {
      message = (await res.json())?.message ?? '';
    } catch {
      // no JSON body
    }
    if (res.status === 401 && path !== '/auth/login') {
      // The server ended this sign-in (signed out elsewhere, expired, or admin role removed).
      await forgetSession();
      onSignedOut();
    }
    const err = new Error(message || `http_${res.status}`);
    err.code = res.status;
    throw err;
  }
  return res.status === 204 ? null : res.json();
}

export async function signIn(email, password) {
  const next = await request('/auth/login', { method: 'POST', body: { email: email.trim(), password, client: 'app' } });
  await saveSession(next);
  return next;
}

/** Paths of the reads, so a screen can peek() at the last answer before asking again. */
export const paths = {
  sales: '/sales',
  websiteSales: '/website-sales',
  purchases: '/purchases',
  customers: '/customers',
  products: '/products',
  websiteCakes: '/website-cakes',
  report: (from, to, group = 'none') => `/report?from=${from}&to=${to}&group=${group}`,
  // One page of shop + website sales, or of purchases, newest first: { items, total, page, size, hasMore }.
  salesPage: (params) => `/sales/feed${query(params)}`,
  purchasesPage: (params) => `/purchases${query(params)}`,
};

/** ?a=1&b=x for the given values, skipping empty ones. */
function query(params) {
  const parts = Object.entries(params)
    .filter(([, v]) => v !== undefined && v !== null && v !== '')
    .map(([k, v]) => `${k}=${encodeURIComponent(v)}`);
  return parts.length ? `?${parts.join('&')}` : '';
}

export const api = {
  /** Any read by its path (from paths.*), so paged lists can ask for the next page. */
  get: (path) => request(path),
  sales: () => request(paths.sales),
  websiteSales: () => request(paths.websiteSales),
  // Sales, purchases and profit are calculated by the server, so they match the OS website exactly.
  report: (from, to, group = 'none') => request(paths.report(from, to, group)),
  purchases: () => request(paths.purchases),
  customers: () => request(paths.customers),
  products: () => request(paths.products),
  websiteCakes: () => request(paths.websiteCakes),
  addCustomer: (c) => request('/customers', { method: 'POST', body: c }),
  addProduct: (p) => request('/products', { method: 'POST', body: p }),
  addSale: (s) => request('/sales', { method: 'POST', body: s }),
  deleteSale: (id) => request(`/sales/${id}`, { method: 'DELETE' }),
  deletePurchase: (id) => request(`/purchases/${id}`, { method: 'DELETE' }),
};
