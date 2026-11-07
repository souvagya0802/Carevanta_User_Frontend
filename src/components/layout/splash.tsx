'use client';

import { Loader2 } from 'lucide-react';
import { Logo, useBranding } from '@/lib/branding';
import { cx } from '@/components/ui/primitives';

/**
 * Shown while a stored session is restored. Branded and calm, with the shape of
 * the home screen underneath, so a signed-in patient never sees a blank page or
 * the signed-out landing on a cold start.
 */
export function Splash({ full }: { full?: boolean }) {
  const { branding } = useBranding();
  return (
    <div role="status" aria-live="polite" aria-label="Signing you in" className={cx('mx-auto w-full max-w-6xl', full ? 'min-h-dvh bg-canvas px-4 pt-[max(16px,env(safe-area-inset-top))] pb-10 lg:px-6' : '')}>
      {full && (
        <div className="flex items-center gap-2.5 py-2">
          <Logo size="sm" className="rounded-xl" />
          <span className="text-lg font-extrabold tracking-tight">{branding.name}</span>
        </div>
      )}
      <div className="relative mt-3 overflow-hidden rounded-[32px] bg-brand-deep p-5 text-white shadow-float sm:p-7">
        <span aria-hidden className="orb -top-20 -right-10 h-56 w-56" />
        <p className="relative flex items-center gap-2 text-sm font-semibold text-white/90"><Loader2 size={16} className="animate-spin" aria-hidden /> Signing you in…</p>
        <div className="relative mt-3 h-7 w-3/4 rounded-full bg-white/20" />
        <div className="relative mt-2 h-4 w-1/2 rounded-full bg-white/15" />
        <div className="relative mt-5 h-12 w-full rounded-full bg-white/90" />
      </div>
      <div className="mt-6 grid grid-cols-3 gap-3 sm:grid-cols-4 lg:grid-cols-6">
        {Array.from({ length: 6 }).map((_, i) => <div key={i} className={cx('shimmer h-24 rounded-3xl', i > 2 && 'hidden sm:block', i > 3 && 'sm:hidden lg:block')} />)}
      </div>
      <div className="mt-6 grid gap-3 sm:grid-cols-2">
        <div className="shimmer h-28 rounded-3xl" />
        <div className="shimmer hidden h-28 rounded-3xl sm:block" />
      </div>
    </div>
  );
}
