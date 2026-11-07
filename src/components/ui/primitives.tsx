'use client';

import { clsx } from 'clsx';
import Link from 'next/link';
import { Eye, EyeOff, Loader2, Star, X, type LucideIcon } from 'lucide-react';
import { forwardRef, useEffect, useId, useRef, useState, type ButtonHTMLAttributes, type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes, type TextareaHTMLAttributes } from 'react';

/**
 * Patient app design system: bright, rounded, friendly, built for thumbs.
 * Primary actions are gradient pills; surfaces are white cards floating on a
 * pale blue canvas; sheets slide up from the bottom on phones and centre on
 * desktops. Brand colours come from CSS variables the platform sets.
 */
export const cx = clsx;

/* ─── Buttons ─────────────────────────────────────────────────────────── */
type Variant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'white' | 'soft';
const variants: Record<Variant, string> = {
  primary: 'bg-brand text-white shadow-glow hover:brightness-105 disabled:opacity-50 disabled:shadow-none',
  secondary: 'border border-line bg-surface text-ink hover:bg-soft disabled:text-muted',
  soft: 'bg-primary-soft text-primary hover:bg-primary/15 disabled:text-muted',
  ghost: 'text-muted hover:bg-soft hover:text-ink disabled:text-muted/60',
  danger: 'bg-danger text-white shadow-[0_14px_30px_-14px_rgb(225_29_72/0.6)] hover:brightness-105 disabled:opacity-50',
  white: 'bg-white text-primary shadow-card hover:bg-soft disabled:text-muted',
};
export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> { variant?: Variant; size?: 'sm' | 'md' | 'lg'; loading?: boolean; full?: boolean }
export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button({ variant = 'primary', size = 'md', loading, full, className, children, disabled, ...rest }, ref) {
  return (
    <button ref={ref} type={rest.type ?? 'button'} disabled={disabled || loading} aria-busy={loading || undefined} className={cx('inline-flex items-center justify-center gap-2 rounded-full font-semibold whitespace-nowrap', size === 'sm' ? 'h-10 px-4 text-sm' : size === 'lg' ? 'h-14 px-7 text-base' : 'h-12 px-5 text-sm', full && 'w-full', variants[variant], className)} {...rest}>
      {loading && <Loader2 size={16} className="animate-spin" aria-hidden />}
      {children}
    </button>
  );
});

export function IconButton({ label, icon: Icon, className, badge, ...rest }: ButtonHTMLAttributes<HTMLButtonElement> & { label: string; icon: LucideIcon; badge?: number }) {
  return (
    <button type="button" aria-label={label} title={label} className={cx('relative flex h-11 w-11 items-center justify-center rounded-full bg-surface text-ink shadow-card hover:bg-soft', className)} {...rest}>
      <Icon size={20} aria-hidden />
      {badge ? <span className="tnum absolute -top-0.5 -right-0.5 flex h-5 min-w-5 items-center justify-center rounded-full bg-danger px-1 text-[10px] font-bold text-white">{badge > 99 ? '99+' : badge}</span> : null}
    </button>
  );
}

/* ─── Surfaces ─────────────────────────────────────────────────────────── */
export function Card({ children, className, padded = true, href, onClick }: { children: ReactNode; className?: string; padded?: boolean; href?: string; onClick?: () => void }) {
  // Only default to block when the caller did not ask for a layout; otherwise 'block' would override their 'flex' and rows spill off narrow screens.
  const ownsDisplay = /(^|\s)(flex|inline-flex|grid|inline-block|hidden)(\s|$)/.test(className ?? '');
  const cls = cx('card-3d min-w-0 max-w-full rounded-3xl text-left', !ownsDisplay && 'block', padded && 'p-4', className);
  if (href) return <Link href={href} className={cls}>{children}</Link>;
  if (onClick) return <button type="button" onClick={onClick} className={cx(cls, 'w-full')}>{children}</button>;
  return <div className={cls}>{children}</div>;
}

export function SectionTitle({ title, action, href, className }: { title: string; action?: string; href?: string; className?: string }) {
  return (
    <div className={cx('mb-3 flex items-end justify-between gap-3', className)}>
      <h2 className="text-lg font-extrabold tracking-tight">{title}</h2>
      {action && href && <Link href={href} className="text-sm font-semibold text-primary">{action}</Link>}
    </div>
  );
}

export function Chip({ active, children, onClick, className }: { active?: boolean; children: ReactNode; onClick?: () => void; className?: string }) {
  return <button type="button" aria-pressed={active} onClick={onClick} className={cx('inline-flex h-10 shrink-0 items-center gap-1.5 rounded-full border px-3.5 text-sm font-semibold', active ? 'border-primary bg-primary text-white shadow-glow' : 'border-line bg-surface text-ink hover:bg-soft', className)}>{children}</button>;
}

export function Badge({ children, tone = 'muted' }: { children: ReactNode; tone?: 'primary' | 'success' | 'warning' | 'danger' | 'muted' | 'violet' | 'white' }) {
  const t = { primary: 'bg-primary-soft text-primary', success: 'bg-success-soft text-success', warning: 'bg-warning-soft text-warning', danger: 'bg-danger-soft text-danger', muted: 'bg-soft text-muted', violet: 'bg-violet-soft text-violet', white: 'bg-white/20 text-white' }[tone];
  return <span className={cx('inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-bold tracking-wide uppercase', t)}>{children}</span>;
}

const STATUS_TONE: Record<string, 'primary' | 'success' | 'warning' | 'danger' | 'muted' | 'violet'> = {
  REQUESTED: 'warning', PLACED: 'warning', PRESCRIPTION_REVIEW: 'violet', CONFIRMED: 'primary', ACCEPTED: 'primary', PREPARING: 'primary', CHECKED_IN: 'primary', SAMPLE_COLLECTED: 'primary', PROCESSING: 'primary', REPORT_READY: 'success', READY_FOR_PICKUP: 'success', OUT_FOR_DELIVERY: 'primary', COMPLETED: 'success', DELIVERED: 'success', NO_SHOW: 'danger', REJECTED: 'danger', CANCELLED: 'danger', CANCELLED_BY_PATIENT: 'danger', CANCELLED_BY_PROVIDER: 'danger', CANCELLED_BY_PLATFORM: 'danger', RETURNED: 'danger', RESCHEDULED: 'muted', OFFERED: 'warning', SEARCHING: 'warning', EN_ROUTE: 'primary', ARRIVED: 'success', PATIENT_ONBOARD: 'primary', AT_DESTINATION: 'success', NO_PROVIDER_AVAILABLE: 'danger', ESCALATED: 'danger',
};
export const statusLabel = (s: string) => s.toLowerCase().replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()).replace('By Patient', 'by you').replace('By Provider', 'by provider').replace('By Platform', 'by Carevanta');
export function StatusBadge({ status }: { status: string }) { return <Badge tone={STATUS_TONE[status] ?? 'muted'}>{statusLabel(status)}</Badge>; }

export function Avatar({ name, size = 'md', className, tone }: { name: string; size?: 'sm' | 'md' | 'lg' | 'xl'; className?: string; tone?: string }) {
  const initials = name.replace(/^Dr\.?\s+/i, '').split(/\s+/).map((w) => w[0]).join('').slice(0, 2).toUpperCase();
  const dim = { sm: 'h-9 w-9 text-xs', md: 'h-12 w-12 text-sm', lg: 'h-16 w-16 text-lg', xl: 'h-24 w-24 text-2xl' }[size];
  return <span aria-hidden className={cx('flex shrink-0 items-center justify-center rounded-2xl font-extrabold text-white tile-3d', dim, className)} style={tone ? ({ '--tile': tone } as React.CSSProperties) : undefined}>{initials}</span>;
}

export function Rating({ value, count, size = 14 }: { value: number | null; count?: number; size?: number }) {
  if (value == null) return <span className="text-xs text-muted">New</span>;
  return <span className="inline-flex items-center gap-1 text-sm font-semibold"><Star size={size} className="fill-sun text-sun" aria-hidden /><span className="tnum">{value.toFixed(1)}</span>{count != null && <span className="text-xs font-normal text-muted">({count})</span>}</span>;
}

export function InfoTile({ icon: Icon, label, value, tone }: { icon: LucideIcon; label: string; value: ReactNode; tone?: string }) {
  return (
    // Phones: icon on top, label and value below, and the value may wrap — a fee or place
    // count is never cut to "₹30…". From sm up there is room for the icon beside the text.
    <div className="flex min-w-0 flex-col items-start gap-2 rounded-2xl bg-white/15 p-2.5 text-white sm:flex-row sm:items-center sm:gap-3 sm:p-3">
      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-white/20 sm:h-10 sm:w-10" style={tone ? { background: tone } : undefined}><Icon size={16} aria-hidden /></span>
      <span className="min-w-0 max-w-full"><span className="block text-[11px] font-medium leading-tight text-white/75">{label}</span><span className="tnum block text-[13px] font-bold leading-snug [overflow-wrap:anywhere] sm:text-sm">{value}</span></span>
    </div>
  );
}

/* ─── Forms ──────────────────────────────────────────────────────────────── */
const control = 'h-12 w-full rounded-2xl border border-line bg-surface px-4 text-[15px] placeholder:text-muted/70 focus:border-primary disabled:bg-soft disabled:text-muted aria-[invalid=true]:border-danger';
export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(function Input({ className, ...rest }, ref) {
  return <input ref={ref} className={cx(control, className)} {...rest} />;
});
export const PasswordInput = forwardRef<HTMLInputElement, Omit<InputHTMLAttributes<HTMLInputElement>, 'type'>>(function PasswordInput({ className, ...rest }, ref) {
  const [show, setShow] = useState(false);
  return (
    <div className="relative">
      <input ref={ref} type={show ? 'text' : 'password'} className={cx(control, 'pr-12', className)} {...rest} />
      <button type="button" aria-label={show ? 'Hide password' : 'Show password'} onClick={() => setShow((s) => !s)} className="absolute top-1/2 right-1 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full text-muted hover:text-ink">{show ? <EyeOff size={18} /> : <Eye size={18} />}</button>
    </div>
  );
});
export const Select = forwardRef<HTMLSelectElement, SelectHTMLAttributes<HTMLSelectElement>>(function Select({ className, children, ...rest }, ref) {
  return <select ref={ref} className={cx(control, 'appearance-none bg-[url("data:image/svg+xml;utf8,<svg xmlns=%27http://www.w3.org/2000/svg%27 width=%2716%27 height=%2716%27 fill=%27none%27 stroke=%27%235b6b8c%27 stroke-width=%272%27><path d=%27m4 6 4 4 4-4%27/></svg>")] bg-[length:16px] bg-[right_14px_center] bg-no-repeat pr-10', className)} {...rest}>{children}</select>;
});
export const Textarea = forwardRef<HTMLTextAreaElement, TextareaHTMLAttributes<HTMLTextAreaElement>>(function Textarea({ className, ...rest }, ref) {
  return <textarea ref={ref} className={cx(control, 'h-auto min-h-24 py-3', className)} {...rest} />;
});
export function Field({ label, error, hint, required, children, className }: { label: string; error?: string; hint?: string; required?: boolean; children: ReactNode; className?: string }) {
  const id = useId();
  return (
    <label className={cx('block', className)}>
      <span className="mb-1.5 block text-sm font-semibold text-ink">{label}{required && <span className="text-danger"> *</span>}</span>
      <span id={id}>{children}</span>
      {error ? <span role="alert" className="mt-1 block text-xs font-medium text-danger">{error}</span> : hint ? <span className="mt-1 block text-xs text-muted">{hint}</span> : null}
    </label>
  );
}
export function Checkbox({ label, className, ...rest }: InputHTMLAttributes<HTMLInputElement> & { label: ReactNode }) {
  return <label className={cx('flex items-start gap-3 text-sm', className)}><input type="checkbox" className="mt-0.5 h-5 w-5 shrink-0 rounded-md border-line accent-primary" {...rest} /><span>{label}</span></label>;
}
export function OptionCard({ selected, onSelect, title, description, right, disabled }: { selected: boolean; onSelect: () => void; title: ReactNode; description?: ReactNode; right?: ReactNode; disabled?: boolean }) {
  return (
    <button type="button" role="radio" aria-checked={selected} disabled={disabled} onClick={onSelect} className={cx('flex w-full items-center gap-3 rounded-2xl border-2 bg-surface p-3.5 text-left disabled:opacity-50', selected ? 'border-primary shadow-glow' : 'border-line hover:border-primary/40')}>
      <span className={cx('flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2', selected ? 'border-primary' : 'border-line')}>{selected && <span className="h-2.5 w-2.5 rounded-full bg-primary" />}</span>
      <span className="min-w-0 flex-1"><span className="block text-sm font-semibold">{title}</span>{description && <span className="block text-xs text-muted">{description}</span>}</span>
      {right}
    </button>
  );
}

/* ─── States ─────────────────────────────────────────────────────────────── */
export function Skeleton({ rows = 3, className, card }: { rows?: number; className?: string; card?: boolean }) {
  return <div role="status" aria-label="Loading" className={cx(card ? 'grid gap-3' : 'space-y-2.5', className)}>{Array.from({ length: rows }).map((_, i) => <div key={i} className={cx('shimmer rounded-2xl', card ? 'h-28' : 'h-11', !card && (i % 3 === 1 ? 'w-5/6' : i % 3 === 2 ? 'w-2/3' : 'w-full'))} />)}</div>;
}
export function Spinner({ className }: { className?: string }) { return <span role="status" aria-label="Loading" className={cx('inline-flex text-primary', className)}><Loader2 size={22} className="animate-spin" aria-hidden /></span>; }
export function EmptyState({ icon: Icon, title, description, action }: { icon?: LucideIcon; title: string; description?: string; action?: ReactNode }) {
  return (
    <div className="animate-fade-in rounded-3xl border-2 border-dashed border-line px-6 py-10 text-center">
      {Icon && <span className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-primary-soft text-primary"><Icon size={26} aria-hidden /></span>}
      <p className="font-bold">{title}</p>
      {description && <p className="mt-1 text-sm text-muted">{description}</p>}
      {action && <div className="mt-4 flex justify-center">{action}</div>}
    </div>
  );
}
export function ErrorState({ error, retry }: { error: unknown; retry?: () => void }) {
  const message = error instanceof Error ? error.message : 'Something went wrong';
  return (
    <div role="alert" className="rounded-3xl bg-danger-soft px-6 py-8 text-center">
      <p className="font-bold text-danger">Could not load this</p>
      <p className="mt-1 text-sm text-ink/80">{message}</p>
      {retry && <Button variant="white" size="sm" className="mt-4" onClick={retry}>Try again</Button>}
    </div>
  );
}

/* ─── Sheets ─────────────────────────────────────────────────────────────── */
/** Bottom sheet on phones, centred dialog on larger screens. Closes on backdrop tap and Escape. */
export function Sheet({ open, onClose, title, description, children, footer, size = 'md' }: { open: boolean; onClose: () => void; title: string; description?: string; children: ReactNode; footer?: ReactNode; size?: 'md' | 'lg' }) {
  const ref = useRef<HTMLDialogElement>(null);
  const id = useId();
  useEffect(() => { const el = ref.current; if (!el) return; if (open && !el.open) el.showModal(); if (!open && el.open) el.close(); }, [open]);
  return (
    <dialog ref={ref} onClose={onClose} onCancel={onClose} onClick={(e) => { if (e.target === e.currentTarget) onClose(); }} aria-labelledby={`${id}-t`} className={cx('fixed inset-x-0 bottom-0 top-auto m-0 w-full max-w-none overflow-hidden rounded-t-[30px] bg-surface p-0 text-ink shadow-float sm:inset-auto sm:top-1/2 sm:left-1/2 sm:m-0 sm:w-[calc(100%-32px)] sm:-translate-x-1/2 sm:-translate-y-1/2 sm:rounded-[30px]', size === 'lg' ? 'sm:max-w-2xl' : 'sm:max-w-lg')}>
      {open && (
        <div className="flex max-h-[88dvh] flex-col">
          <div className="mx-auto mt-2.5 h-1.5 w-12 rounded-full bg-line sm:hidden" aria-hidden />
          <header className="flex items-start justify-between gap-3 px-5 pt-4 pb-2">
            <div className="min-w-0"><h2 id={`${id}-t`} className="text-lg font-extrabold leading-tight">{title}</h2>{description && <p className="mt-0.5 text-sm text-muted">{description}</p>}</div>
            <button type="button" onClick={onClose} aria-label="Close" className="-mr-1 flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-soft text-muted hover:text-ink"><X size={18} aria-hidden /></button>
          </header>
          <div className="flex-1 overflow-y-auto px-5 py-3 text-sm">{children}</div>
          {footer && <div className="flex shrink-0 flex-col gap-2 border-t border-line px-5 py-4 pb-[max(16px,env(safe-area-inset-bottom))] sm:flex-row sm:justify-end">{footer}</div>}
        </div>
      )}
    </dialog>
  );
}

export function StepBar({ steps, current }: { steps: string[]; current: number }) {
  return (
    <ol className="flex items-center gap-2" aria-label="Progress">
      {steps.map((s, i) => (
        <li key={s} className="flex flex-1 items-center gap-2">
          <span className={cx('flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold', i < current ? 'bg-success text-white' : i === current ? 'bg-brand text-white shadow-glow' : 'bg-soft text-muted')} aria-current={i === current ? 'step' : undefined}>{i + 1}</span>
          <span className={cx('hidden truncate text-xs font-semibold sm:block', i === current ? 'text-ink' : 'text-muted')}>{s}</span>
          {i < steps.length - 1 && <span className={cx('h-0.5 flex-1 rounded-full', i < current ? 'bg-success' : 'bg-line')} />}
        </li>
      ))}
    </ol>
  );
}

export function PageTitle({ title, subtitle, back, right }: { title: string; subtitle?: string; back?: ReactNode; right?: ReactNode }) {
  return (
    <div className="mb-4 flex items-start gap-3">
      {back}
      <div className="min-w-0 flex-1"><h1 className="text-2xl font-extrabold tracking-tight">{title}</h1>{subtitle && <p className="mt-0.5 text-sm text-muted">{subtitle}</p>}</div>
      {right}
    </div>
  );
}
