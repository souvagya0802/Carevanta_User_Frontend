'use client';

import { Check } from 'lucide-react';
import { cx } from '@/components/ui/primitives';

/** Horizontal-on-desktop, vertical-on-phone progress of an order through its happy path, with the stopped state marked. */
export function OrderTimeline({ steps, status, stopped }: { steps: { key: string; label: string }[]; status: string; stopped?: string[] }) {
  const idx = steps.findIndex((s) => s.key === status);
  const failed = stopped?.includes(status);
  return (
    <ol className="grid gap-2 sm:grid-cols-5" aria-label="Order progress">
      {steps.map((s, i) => {
        const done = idx >= 0 ? i < idx : false;
        const current = i === idx;
        return (
          <li key={s.key} className="flex items-center gap-2 sm:flex-col sm:items-start">
            <span className={cx('flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold', done ? 'bg-success text-white' : current ? (failed ? 'bg-danger text-white' : 'bg-brand text-white shadow-glow') : 'bg-soft text-muted')}>{done ? <Check size={14} /> : i + 1}</span>
            <span className={cx('text-xs font-semibold', current ? 'text-ink' : 'text-muted')}>{s.label}</span>
          </li>
        );
      })}
    </ol>
  );
}
