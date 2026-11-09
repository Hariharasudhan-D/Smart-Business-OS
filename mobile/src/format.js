// Indian number grouping (1,23,456) without relying on Intl support on the phone.
export function rupees(value) {
  const n = Math.round(Number(value) || 0);
  const sign = n < 0 ? '-' : '';
  const s = String(Math.abs(n));
  if (s.length <= 3) return `${sign}₹${s}`;
  const last3 = s.slice(-3);
  const rest = s.slice(0, -3).replace(/\B(?=(\d{2})+(?!\d))/g, ',');
  return `${sign}₹${rest},${last3}`;
}

export function compactRupees(value) {
  const n = Number(value) || 0;
  if (n >= 100000) return `₹${(n / 100000).toFixed(n >= 1000000 ? 0 : 1)}L`;
  if (n >= 1000) return `₹${(n / 1000).toFixed(n >= 10000 ? 0 : 1)}k`;
  return `₹${Math.round(n)}`;
}

const pad = (n) => String(n).padStart(2, '0');

/** Local calendar date as YYYY-MM-DD (the format the server uses). */
export function isoDate(d = new Date()) {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/** YYYY-MM-DD moved by n days (n may be negative). */
export function addDays(iso, n) {
  const [y, m, d] = iso.split('-').map(Number);
  return isoDate(new Date(y, m - 1, d + n));
}

export function daysAgo(n) {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d;
}

export function niceDate(iso, t) {
  const [y, m, d] = iso.split('-').map(Number);
  const today = isoDate();
  if (iso === today) return t.today;
  if (iso === addDays(today, 1)) return t.tomorrow;
  return `${d} ${t.months[m - 1]}${y !== new Date().getFullYear() ? ` ${y}` : ''}`;
}
