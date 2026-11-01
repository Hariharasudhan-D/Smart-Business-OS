const tones = {
  green: 'bg-emerald-50 text-emerald-700 ring-emerald-600/20',
  amber: 'bg-amber-50 text-amber-700 ring-amber-600/20',
  red: 'bg-red-50 text-red-700 ring-red-600/20',
  blue: 'bg-sky-50 text-sky-700 ring-sky-600/20',
  slate: 'bg-slate-100 text-slate-700 ring-slate-500/20',
  indigo: 'bg-indigo-50 text-indigo-700 ring-indigo-600/20',
};
export default function Badge({ tone = 'slate', children }) {
  return <span className={`inline-flex items-center whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset ${tones[tone]}`}>{children}</span>;
}
// Shared status -> colour mapping so every page agrees.
const statusTones = {
  Paid: 'green',
  'In Stock': 'green',
  Pending: 'amber',
  'Low Stock': 'amber',
  Partial: 'blue',
  'Out of Stock': 'red',
};
export const statusTone = (s) => statusTones[s] ?? 'slate';
