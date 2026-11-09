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
 * { status: 'granted' | 'denied' | 'idle' | 'error' | 'unsupported', list: [{ id, name, phone, phones }] }
 * With ask = true the permission popup is shown if it hasn't been granted yet;
 * with ask = false it only reads contacts when permission was already given.
 * fresh = true reads the phone again (picks up contacts added since the app opened).
 */
export function loadContacts({ ask = true, fresh = false } = {}) {
  if (!contactsSupported) return Promise.resolve({ status: 'unsupported', list: [] });
  if (cache && !fresh) return Promise.resolve({ status: 'granted', list: cache });
  if (pending) return pending; // a read is already running: share it instead of asking twice
  const run = readContacts(ask);
  pending = run;
  run.finally(() => {
    pending = null;
  });
  return run;
}

async function readContacts(ask) {
  let perm;
  try {
    perm = await Contacts.getPermissionsAsync();
    if (perm.status !== 'granted' && ask) perm = await Contacts.requestPermissionsAsync();
  } catch {
    return { status: 'error', list: cache ?? [] };
  }
  if (perm.status !== 'granted') return { status: ask ? 'denied' : 'idle', list: [] };
  try {
    // expo-contacts 58: the old getContactsAsync() always throws; contacts are read with the new
    // Contact.getAllDetails(), which returns plain objects with only the fields asked for.
    const rows = await Contacts.Contact.getAllDetails(
      [Contacts.ContactField.FULL_NAME, Contacts.ContactField.GIVEN_NAME, Contacts.ContactField.FAMILY_NAME, Contacts.ContactField.PHONES],
      { sortOrder: Contacts.ContactsSortOrder.GivenName },
    );
    const seen = new Set();
    cache = (rows || [])
      .map((c) => {
        const name = (c.fullName || [c.givenName, c.familyName].filter(Boolean).join(' ')).trim();
        const phones = [...new Set((c.phones || []).map((p) => cleanPhone(p.number)).filter((n) => n.replace(/\D/g, '').length >= 5))];
        return { id: String(c.id), name, phone: phones[0] || '', phones };
      })
      .filter((c) => c.name && c.phone)
      // the same person saved twice (e.g. phone + Google account) shows once
      .filter((c) => {
        const key = `${c.name.toLowerCase()}|${phoneKey(c.phone)}`;
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      });
    return { status: 'granted', list: cache };
  } catch {
    return { status: 'error', list: cache ?? [] };
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
    const hit = name.includes(q) || (digits.length >= 3 && (c.phones || [c.phone]).some((p) => phoneKey(p).includes(digits)));
    if (!hit) continue;
    (name.startsWith(q) ? starts : rest).push(c);
    if (starts.length >= limit) break;
  }
  return [...starts, ...rest].slice(0, limit);
}
