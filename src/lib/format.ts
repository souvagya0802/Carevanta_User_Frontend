const inr = new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', minimumFractionDigits: 2 });
const num = new Intl.NumberFormat('en-IN');
const dt = new Intl.DateTimeFormat('en-IN', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Asia/Kolkata' });
const d = new Intl.DateTimeFormat('en-IN', { dateStyle: 'medium', timeZone: 'Asia/Kolkata' });

/** Minor units (paise) → "₹1,234.56". */
export const money = (minor: number | null | undefined, currency = 'INR') =>
  minor == null ? '—' : currency === 'INR' ? inr.format(minor / 100) : `${currency} ${(minor / 100).toFixed(2)}`;
export const count = (n: number | null | undefined) => (n == null ? '—' : num.format(n));
export const dateTime = (iso: string | null | undefined) => (iso ? dt.format(new Date(iso)) : '—');
export const date = (iso: string | null | undefined) => (iso ? d.format(new Date(iso)) : '—');
export const pct = (v: number | null | undefined) => (v == null ? '—' : `${v}%`);
/** Title Case for enum-like values: `PENDING_VERIFICATION` → `Pending Verification`. */
export const title = (s: string | null | undefined) =>
  s ? s.toLowerCase().replace(/_/g, ' ').replace(/(^|\s)\w/g, (c) => c.toUpperCase()) : '—';
export const short = (id: string | null | undefined) => (id ? id.slice(0, 8) : '—');
export const minutes = (m: number) => `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
export const relative = (iso: string | null | undefined) => {
  if (!iso) return '—';
  const diff = (Date.now() - new Date(iso).getTime()) / 1000;
  if (diff < 60) return 'just now';
  if (diff < 3600) return `${Math.floor(diff / 60)} min ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)} h ago`;
  return `${Math.floor(diff / 86400)} d ago`;
};

/** Current time in ms. Lives here so components can read the clock without the React Compiler flagging an impure call in render. */
export const nowMs = () => Date.now();

/**
 * "Azithral 500" + "500 mg" → "Azithral 500 mg"; "Dolo 650" + "650 mg" → "Dolo 650 mg";
 * "Crocin 500 mg" + "500 mg" → "Crocin 500 mg"; "Paracetamol" + "500 mg" → "Paracetamol 500 mg".
 * The strength is never repeated when the brand name already carries it.
 */
export function medicineLabel(name: string, strength?: string | null): string {
  const n = name.trim();
  const s = strength?.trim();
  if (!s) return n;
  const squash = (x: string) => x.toLowerCase().replace(/\s+/g, '');
  if (squash(n).includes(squash(s))) return n;
  const m = /^(\d+(?:\.\d+)?(?:\s*\/\s*\d+(?:\.\d+)?)*)\s*(.*)$/.exec(s);
  if (m) {
    // Only digits, dots and slashes can reach here; escape the dots for the pattern.
    const num = m[1]!.replace(/\s+/g, '').replace(/\./g, '\\.');
    const unit = m[2]!.trim();
    const plain = n.replace(/\s*\/\s*/g, '/');
    // The name ends with the number ("Azithral 500"): add only the unit.
    if (new RegExp(`(^|[^\\d.])${num}$`).test(plain)) return unit ? `${n} ${unit}` : n;
    // The number already sits inside the name ("Dolo 650 Tablet"): leave the name alone.
    if (new RegExp(`(^|[^\\d.])${num}(?![\\d.])`).test(plain)) return n;
  }
  return `${n} ${s}`;
}

/** "+916617964132" → "+91 66179 64132"; other numbers are returned as given. */
export function phone(p: string | null | undefined): string {
  if (!p) return '—';
  const d = p.replace(/[^\d+]/g, '');
  const m = /^(?:\+?91)?([6-9]\d{4})(\d{5})$/.exec(d);
  return m ? `+91 ${m[1]} ${m[2]}` : p;
}

const my = new Intl.DateTimeFormat('en-IN', { month: 'short', year: 'numeric', timeZone: 'UTC' });
/** Expiry dates ("2027-06-12") → "Jun 2027". */
export const monthYear = (iso: string | null | undefined) => {
  if (!iso) return '—';
  const d = new Date(/^\d{4}-\d{2}-\d{2}$/.test(iso) ? `${iso}T00:00:00Z` : iso);
  return Number.isNaN(d.getTime()) ? iso : my.format(d);
};

const IST = 'Asia/Kolkata';
const slotDay = new Intl.DateTimeFormat('en-IN', { weekday: 'short', day: 'numeric', month: 'short', timeZone: IST });
const slotTime = new Intl.DateTimeFormat('en-IN', { hour: 'numeric', minute: '2-digit', hour12: true, timeZone: IST });
const dayKey = (ms: number) => new Date(ms).toLocaleDateString('en-CA', { timeZone: IST });
/** A slot start: "Today · 9:00 AM", "Tomorrow · 9:00 AM" or "Tue, 10 Nov · 9:00 AM" (IST). Pass `now` from nowMs(). */
export function slotLabel(iso: string, now: number): string {
  const t = new Date(iso).getTime();
  const time = slotTime.format(t).replace(/\s?(am|pm)$/i, (x) => ` ${x.trim().toUpperCase()}`);
  const day = dayKey(t);
  if (day === dayKey(now)) return `Today · ${time}`;
  if (day === dayKey(now + 86_400_000)) return `Tomorrow · ${time}`;
  return `${slotDay.format(t)} · ${time}`;
}
