const inr = new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 });
const inr2 = new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', minimumFractionDigits: 2 });
export const formatINR = (n) => inr.format(n);
export const formatINR2 = (n) => inr2.format(n);
export const formatDate = (iso) => new Date(iso).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
const pad2 = (n) => String(n).padStart(2, '0');
export const localISO = (d) => `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
export const todayISO = () => localISO(new Date());
export const daysAgo = (n) => {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return localISO(d);
};
export const monthKey = (iso) => iso.slice(0, 7); // YYYY-MM
