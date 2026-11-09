import { Platform } from 'react-native';
import * as Contacts from 'expo-contacts';

/** Reading the phone's contacts only works in the installed phone app, not in a browser. */
export const contactsSupported = Platform.OS === 'android' || Platform.OS === 'ios';

/** Phone number as digits with an optional leading + (spaces, dashes and brackets removed). */
export const cleanPhone = (raw) => {
  const s = String(raw || '').trim();
  const digits = s.replace(/\D/g, '');
  return s.startsWith('+') ? `+${digits}` : digits;
};

/** Last 10 digits: the same person written as +91 98765 43210 or 098765 43210 compares equal. */
export const phoneKey = (raw) => cleanPhone(raw).replace(/\D/g, '').slice(-10);

let cache = null;
let pending = null;

/**
 * Returns the phone's contacts that have a phone number:
 * { status: 'granted' | 'denied' | 'unsupported', list: [{ id, name, phone }] }
 * With ask = true the permission popup is shown if it hasn't been granted yet;
 * with ask = false it only reads contacts when permission was already given.
 */
export function loadContacts({ ask = true } = {}) {
  if (!contactsSupported) return Promise.resolve({ status: 'unsupported', list: [] });
  if (cache) return Promise.resolve({ status: 'granted', list: cache });
  if (pending) return pending; // the launch-time request is still open: share it instead of asking twice
  const run = readContacts(ask);
  pending = run;
  run.finally(() => {
    pending = null;
  });
  return run;
}

async function readContacts(ask) {
  try {
    let perm = await Contacts.getPermissionsAsync();
    if (perm.status !== 'granted' && ask) perm = await Contacts.requestPermissionsAsync();
    if (perm.status !== 'granted') return { status: ask ? 'denied' : 'idle', list: [] };
    const { data } = await Contacts.getContactsAsync({ fields: [Contacts.Fields.PhoneNumbers], sort: Contacts.SortTypes.FirstName });
    cache = (data || [])
      .filter((c) => c.name && c.phoneNumbers?.length)
      .map((c) => {
        const primary = c.phoneNumbers.find((p) => p.isPrimary) || c.phoneNumbers[0];
        return { id: c.id, name: c.name.trim(), phone: cleanPhone(primary.number) };
      })
      .filter((c) => c.phone);
    return { status: 'granted', list: cache };
  } catch {
    return { status: 'denied', list: [] };
  }
}

/** Contacts whose name (or number, when digits are typed) contains the query, best matches first. */
export function searchContacts(list, query, limit = 6) {
  const q = query.trim().toLowerCase();
  if (!q) return [];
  const digits = q.replace(/\D/g, '');
  const starts = [];
  const rest = [];
  for (const c of list) {
    const name = c.name.toLowerCase();
    const hit = name.includes(q) || (digits.length >= 3 && phoneKey(c.phone).includes(digits));
    if (!hit) continue;
    (name.startsWith(q) ? starts : rest).push(c);
    if (starts.length >= limit) break;
  }
  return [...starts, ...rest].slice(0, limit);
}
