// Indian number formatting: 1,23,456.50
export const formatNumber = (n: number, maxDecimals = 3) =>
  new Intl.NumberFormat('en-IN', { maximumFractionDigits: maxDecimals }).format(n);

export const formatMoney = (n: number) =>
  new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 2 }).format(n);

// Short Indian style: ₹1.25 Cr, ₹4.5 L, else full rupees.
// The minus goes before the rupee sign, as formatMoney writes it: -₹2.2 L.
export const formatShortMoney = (n: number): string => {
  const a = Math.abs(n);
  if (a < 1e5) return formatMoney(n);
  return `${n < 0 ? '-' : ''}₹${a >= 1e7 ? `${(a / 1e7).toFixed(2)} Cr` : `${(a / 1e5).toFixed(1)} L`}`;
};

export const parseNumber = (s: string): number | null => {
  const t = s.replace(/[,\s₹]/g, '');
  if (t === '') return null;
  const n = Number(t);
  return Number.isFinite(n) ? n : null;
};

export const formatDate = (iso: string | null | undefined) =>
  iso ? new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : '—';

export const formatDateTime = (iso: string | null | undefined) =>
  iso ? new Date(iso).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' }) : '—';

// Today's date on this phone/computer (India time for our users), as YYYY-MM-DD.
// Not toISOString(): that is UTC and shows yesterday between midnight and 5:30 am IST.
export function todayLocal(d = new Date()): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}
