'use client';

import Link from 'next/link';
import { ArrowLeft, BadgeCheck } from 'lucide-react';
import type { ReactNode } from 'react';
import { useBranding, Logo } from '@/lib/branding';
import { usePatientUi } from '@/lib/patient-ui';

/** Sign-in and sign-up live inside this frame: brand story on the left (desktop) or on top (phone), the form beside it. */
export function AuthFrame({ title, subtitle, children, footer }: { title: string; subtitle: string; children: ReactNode; footer?: ReactNode }) {
  const { branding } = useBranding();
  const ui = usePatientUi();
  return (
    <main className="min-h-dvh bg-canvas lg:grid lg:grid-cols-[1.05fr_1fr]">
      <section className="relative overflow-hidden bg-brand-deep px-6 pt-[max(16px,env(safe-area-inset-top))] pb-10 text-white lg:flex lg:flex-col lg:justify-between lg:px-12 lg:py-10">
        <span className="orb -top-24 -right-20 h-72 w-72" /><span className="orb -bottom-24 left-1/4 h-72 w-72 opacity-60" />
        <div className="relative flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2.5"><Logo size="sm" onDark className="rounded-xl" /><span className="text-lg font-extrabold tracking-tight">{branding.name}</span></Link>
          <Link href="/" className="inline-flex h-11 items-center gap-1 rounded-full bg-white/15 px-4 text-sm font-semibold"><ArrowLeft size={16} aria-hidden /> Back</Link>
        </div>
        <div className="relative mt-8 lg:mt-0">
          <h1 className="text-2xl font-extrabold leading-tight tracking-tight lg:text-4xl">{ui.landing.headline}</h1>
          <p className="mt-3 max-w-md text-sm text-white/85 lg:text-base">{ui.landing.subheadline}</p>
          <ul className="mt-5 hidden space-y-2 lg:block">
            {ui.landing.points.slice(0, 4).map((p) => <li key={p} className="flex items-start gap-2 text-sm text-white/90"><BadgeCheck size={16} className="mt-0.5 shrink-0" aria-hidden /> {p}</li>)}
          </ul>
        </div>
        <p className="relative mt-6 hidden text-xs text-white/70 lg:block">{ui.landing.footerNote}</p>
      </section>
      <section className="-mt-6 rounded-t-[32px] bg-canvas px-5 pt-7 pb-[max(24px,env(safe-area-inset-bottom))] lg:mt-0 lg:flex lg:items-center lg:justify-center lg:rounded-none lg:px-12">
        <div className="animate-fade-up mx-auto w-full max-w-md">
          <h2 className="text-2xl font-extrabold tracking-tight">{title}</h2>
          <p className="mt-1 text-sm text-muted">{subtitle}</p>
          <div className="card-3d mt-5 rounded-3xl p-5">{children}</div>
          {footer && <div className="mt-4 text-center text-sm text-muted">{footer}</div>}
        </div>
      </section>
    </main>
  );
}
