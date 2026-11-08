'use client';

import { createContext, useCallback, useContext, useMemo, useRef, useState, type ReactNode } from 'react';
import { AlertCircle, CheckCircle2, Info, X } from 'lucide-react';
import { ApiError } from '@/lib/api';

type Kind = 'info' | 'success' | 'error';
interface Toast {
  id: number;
  kind: Kind;
  title: string;
  description?: string;
}
interface ToastApi {
  toast: (t: Omit<Toast, 'id'>) => void;
  success: (title: string, description?: string) => void;
  error: (err: unknown, fallback?: string) => void;
}

const Ctx = createContext<ToastApi | null>(null);

export function describeError(err: unknown, fallback = 'Something went wrong'): { title: string; description?: string } {
  if (err instanceof ApiError) {
    const base = { title: err.message };
    if (err.body.requestId) return { ...base, description: `Reference ${err.body.requestId.slice(0, 8)}` };
    return base;
  }
  if (err instanceof Error) return { title: err.message || fallback };
  return { title: fallback };
}

const STYLE: Record<Kind, { bar: string; icon: ReactNode }> = {
  error: { bar: 'border-l-danger', icon: <AlertCircle size={18} className="text-danger" aria-hidden /> },
  success: { bar: 'border-l-success', icon: <CheckCircle2 size={18} className="text-success" aria-hidden /> },
  info: { bar: 'border-l-primary', icon: <Info size={18} className="text-primary" aria-hidden /> },
};

/**
 * Toasts appear at the top right of the screen, full width on phones (founder rule 2026-11-08: every toast, in every app, top right),
 * below the notch/status bar on phones, above dialogs. The same message raised twice while it is still
 * visible is shown once, so a screen and a shared hook reporting the same failure do not stack duplicates.
 */
export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<Toast[]>([]);
  const seq = useRef(0);
  const timers = useRef(new Map<number, ReturnType<typeof setTimeout>>());
  const remove = useCallback((id: number) => {
    clearTimeout(timers.current.get(id));
    timers.current.delete(id);
    setItems((xs) => xs.filter((x) => x.id !== id));
  }, []);
  const toast = useCallback(
    (t: Omit<Toast, 'id'>) => {
      setItems((xs) => {
        const dup = xs.find((x) => x.kind === t.kind && x.title === t.title && x.description === t.description);
        const id = dup?.id ?? ++seq.current;
        clearTimeout(timers.current.get(id));
        timers.current.set(id, setTimeout(() => remove(id), t.kind === 'error' ? 8000 : 4000));
        return dup ? xs : [...xs, { ...t, id }];
      });
    },
    [remove],
  );
  const value = useMemo<ToastApi>(
    () => ({
      toast,
      success: (title, description) => toast({ kind: 'success', title, description }),
      error: (err, fallback) => toast({ kind: 'error', ...describeError(err, fallback) }),
    }),
    [toast],
  );
  return (
    <Ctx.Provider value={value}>
      {children}
      <div aria-live="polite" className="pointer-events-none fixed inset-x-0 top-[max(16px,env(safe-area-inset-top))] z-[100] flex flex-col items-stretch gap-2 px-3 sm:items-end sm:px-5">
        {items.map((t) => (
          <div
            key={t.id}
            role={t.kind === 'error' ? 'alert' : 'status'}
            className={`animate-fade-up pointer-events-auto flex w-full max-w-md items-start gap-3 rounded-2xl border-l-4 bg-white p-3 pr-2 text-sm text-ink shadow-float ring-1 ring-black/5 ${STYLE[t.kind].bar}`}
          >
            <span className="mt-0.5 shrink-0">{STYLE[t.kind].icon}</span>
            <div className="min-w-0 flex-1">
              <p className="font-bold">{t.title}</p>
              {t.description && <p className="mt-0.5 text-muted">{t.description}</p>}
            </div>
            <button type="button" aria-label="Dismiss" onClick={() => remove(t.id)} className="-my-1 flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-muted hover:bg-soft hover:text-ink">
              <X size={16} />
            </button>
          </div>
        ))}
      </div>
    </Ctx.Provider>
  );
}

export function useToast(): ToastApi {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useToast must be used inside ToastProvider');
  return ctx;
}
