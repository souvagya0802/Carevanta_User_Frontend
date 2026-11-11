'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { Bell, ClipboardList, Home, Search, Siren, UserRound } from 'lucide-react';
import { useIsFetching, useIsMutating } from '@tanstack/react-query';
import { type ReactNode, useSyncExternalStore } from 'react';
import { useAuth, useSessionPhase } from '@/lib/auth';
import { Splash } from '@/components/layout/splash';
import { useGet } from '@/lib/hooks';
import { useBranding, Logo } from '@/lib/branding';
import { usePatientUi } from '@/lib/patient-ui';
import { LocationPill } from '@/components/map/location-pill';
import { Avatar, Button, cx } from '@/components/ui/primitives';

/**
 * App frame. Phones: slim top bar, content, floating pill bottom navigation
 * with a raised coral emergency button in the middle. Desktops: a top
 * navigation bar and a centred content column. Browsing works signed out;
 * screens that need an account wrap themselves in <RequireSignIn>.
 */
const TABS = [
  { href: '/', label: 'Home', icon: Home, match: (p: string) => p === '/' || p === '/home' },
  { href: '/search', label: 'Find Care', icon: Search, match: (p: string) => p.startsWith('/search') || p.startsWith('/doctors') || p.startsWith('/providers') || p.startsWith('/tests') || p.startsWith('/pharmacy') || p.startsWith('/book') },
  { href: '/emergency', label: 'Emergency', icon: Siren, match: (p: string) => p.startsWith('/emergency'), emergency: true },
  { href: '/care', label: 'My Care', icon: ClipboardList, match: (p: string) => p.startsWith('/care') || p.startsWith('/appointments') || p.startsWith('/orders') || p.startsWith('/records') },
  { href: '/account', label: 'Account', icon: UserRound, match: (p: string) => p.startsWith('/account') || p.startsWith('/family') || p.startsWith('/notifications') },
];

const noop = () => () => {};

/**
 * The signed-out part of the header (Sign In). While auth settles it is never shown to someone
 * with a stored session: a neutral placeholder takes its place (see globals.css .when-session).
 */
function SignedOutSlot({ pending, placeholder, children }: { pending: boolean; placeholder: ReactNode; children: ReactNode }) {
  if (!pending) return <>{children}</>;
  return <><span className="when-session">{placeholder}</span><span className="when-no-session">{children}</span></>;
}

export function AppShell({ children, hideTop }: { children: ReactNode; hideTop?: boolean }) {
  const pathname = usePathname();
  const { me } = useAuth();
  const { restoring, pending } = useSessionPhase();
  const { branding } = useBranding();
  const ui = usePatientUi();
  // The server never has requests in flight, so only show the loading bar once the page has hydrated.
  const hydrated = useSyncExternalStore(noop, () => true, () => false);
  const inFlight = useIsFetching() + useIsMutating();
  const busy = hydrated && inFlight > 0;
  const unread = useGet<{ unread: number }>(me ? '/portal/notifications/unread-count' : null, { refetchInterval: 45_000 });
  return (
    <div className="min-h-dvh bg-canvas">
      <div aria-hidden className={cx('pointer-events-none fixed inset-x-0 top-0 z-50 h-0.5 overflow-hidden transition-opacity duration-300', busy ? 'opacity-100' : 'opacity-0')}><div className="activity-bar h-full w-full bg-primary" /></div>
      {/* Desktop header */}
      <header className="sticky top-0 z-30 hidden border-b border-white/60 bg-canvas/85 backdrop-blur lg:block">
        <div className="mx-auto flex h-16 max-w-6xl items-center gap-6 px-6">
          <Link href="/" className="flex items-center gap-2.5"><Logo size="sm" className="rounded-xl" /><span className="text-lg font-extrabold tracking-tight">{branding.name}</span></Link>
          <nav aria-label="Main" className="flex items-center gap-1">
            {TABS.map((t) => <Link key={t.href} href={t.href} aria-current={t.match(pathname) ? 'page' : undefined} className={cx('rounded-full px-4 py-2 text-sm font-semibold', t.emergency ? 'text-danger hover:bg-danger-soft' : t.match(pathname) ? 'bg-primary-soft text-primary' : 'text-muted hover:bg-white hover:text-ink')}>{t.label}</Link>)}
          </nav>
          <div className="ml-auto flex items-center gap-2">
            <LocationPill />
            {me ? (
              <>
                <Link href="/notifications" aria-label="Notifications" className="relative flex h-11 w-11 items-center justify-center rounded-full bg-white shadow-card"><Bell size={18} />{(unread.data?.unread ?? 0) > 0 && <span className="absolute -top-0.5 -right-0.5 h-4 min-w-4 rounded-full bg-danger px-1 text-center text-[10px] font-bold leading-4 text-white">{unread.data!.unread}</span>}</Link>
                <Link href="/account" className="flex items-center gap-2 rounded-full bg-white py-1 pr-3 pl-1 shadow-card"><Avatar name={me.fullName} size="sm" className="rounded-full" /><span className="text-sm font-semibold">{me.fullName.split(' ')[0]}</span></Link>
              </>
            ) : restoring ? <span aria-hidden className="shimmer block h-11 w-28 rounded-full" /> : <SignedOutSlot pending={pending} placeholder={<span aria-hidden className="shimmer block h-11 w-28 rounded-full" />}><Link href="/login"><Button size="sm">Sign In</Button></Link></SignedOutSlot>}
          </div>
        </div>
      </header>
      {/* Phone top bar */}
      {!hideTop && (
        <header className="sticky top-0 z-30 flex items-center gap-2 bg-canvas/85 px-4 pt-[max(10px,env(safe-area-inset-top))] pb-2 backdrop-blur lg:hidden">
          {/* On small phones the name gives way so the location and sign-in buttons always fit on one line. */}
          <Link href="/" aria-label={`${branding.name} home`} className="flex shrink-0 items-center gap-2"><Logo size="nav" className="rounded-2xl" /><span className="hidden text-base font-extrabold tracking-tight min-[400px]:inline">{branding.name}</span></Link>
          <div className="ml-auto flex min-w-0 items-center gap-2">
            <LocationPill compact />
            {me ? <Link href="/notifications" aria-label="Notifications" className="relative flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-white shadow-card"><Bell size={18} />{(unread.data?.unread ?? 0) > 0 && <span className="absolute -top-0.5 -right-0.5 h-4 min-w-4 rounded-full bg-danger px-1 text-center text-[10px] font-bold leading-4 text-white">{unread.data!.unread}</span>}</Link> : restoring ? <span aria-hidden className="shimmer block h-11 w-11 shrink-0 rounded-full" /> : <SignedOutSlot pending={pending} placeholder={<span aria-hidden className="shimmer block h-11 w-11 shrink-0 rounded-full" />}><Link href="/login" className="flex h-11 shrink-0 items-center whitespace-nowrap rounded-full bg-primary px-4 text-sm font-semibold text-white shadow-glow">Sign In</Link></SignedOutSlot>}
          </div>
        </header>
      )}
      {ui.announcement && (
        <div role="status" className={cx('mx-auto max-w-6xl px-4 lg:px-6')}><div className={cx('rounded-2xl px-4 py-2 text-sm font-medium', ui.announcement.tone === 'warning' ? 'bg-warning-soft text-ink' : ui.announcement.tone === 'success' ? 'bg-success-soft text-ink' : 'bg-primary-soft text-ink')}>{ui.announcement.text}{ui.announcement.link && <> <a href={ui.announcement.link} className="underline underline-offset-2" target="_blank" rel="noreferrer">Read more</a></>}</div></div>
      )}
      <main className="mx-auto w-full max-w-6xl px-4 pt-3 pb-28 lg:px-6 lg:pt-6 lg:pb-12">
        {/* While a stored session restores, the splash stands in for the page so nothing renders signed-out and no page query competes with the sign-in. */}
        {(restoring || pending) && <div className={restoring ? undefined : 'when-session'}><Splash /></div>}
        {!restoring && <div className={pending ? 'when-no-session' : 'contents'}><div key={pathname} className="animate-fade-up">{children}</div></div>}
      </main>
      {/* Phone bottom nav */}
      {/* Five equal columns that can shrink, so the bar never runs past the screen edge, even at 320 px. */}
      <nav aria-label="Quick navigation" className="fixed inset-x-2 bottom-[max(10px,env(safe-area-inset-bottom))] z-40 min-[380px]:inset-x-3 lg:hidden">
        {/* Solid, not see-through: page content scrolling behind the bar made the labels hard to read. */}
        <div className="mx-auto grid max-w-md border border-line bg-white grid-cols-5 items-end rounded-[28px] px-1 py-1.5 shadow-float">
          {TABS.map((t) => {
            const active = t.match(pathname);
            if (t.emergency) return <Link key={t.href} href={t.href} aria-label="Emergency" className="pulse-ring relative -mt-6 flex h-14 w-14 flex-col items-center justify-center justify-self-center rounded-full bg-danger text-white shadow-[0_16px_34px_-12px_rgb(225_29_72/0.75)] min-[380px]:h-16 min-[380px]:w-16"><Siren size={22} aria-hidden /><span className="text-[10px] font-bold">SOS</span></Link>;
            return (
              <Link key={t.href} href={t.href} aria-current={active ? 'page' : undefined} className="flex min-w-0 flex-col items-center gap-0.5 py-1 text-[10px] font-semibold">
                <span className={cx('flex h-9 w-10 items-center justify-center rounded-2xl transition-colors min-[380px]:h-10 min-[380px]:w-12', active ? 'bg-primary text-white shadow-glow' : 'text-muted')}><t.icon size={20} aria-hidden /></span>
                <span className={cx('w-full truncate text-center', active ? 'text-primary' : 'text-muted')}>{t.label}</span>
              </Link>
            );
          })}
        </div>
      </nav>
    </div>
  );
}

/** Wrap a screen that needs an account; sends visitors to sign in and brings them back. */
export function RequireSignIn({ children, message }: { children: ReactNode; message?: string }) {
  const { me, loading } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  if (loading) return <div className="space-y-3"><div className="shimmer h-28 rounded-3xl" /><div className="shimmer h-40 rounded-3xl" /></div>;
  if (!me) {
    return (
      <div className="card-3d mx-auto mt-6 max-w-md rounded-3xl p-6 text-center">
        <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-primary-soft text-primary"><UserRound size={26} aria-hidden /></span>
        <h2 className="mt-3 text-lg font-extrabold">Sign In to Continue</h2>
        <p className="mt-1 text-sm text-muted">{message ?? 'Your bookings, reports and family profiles are kept safely in your account.'}</p>
        <div className="mt-5 grid gap-2"><Button full onClick={() => router.push(`/login?next=${encodeURIComponent(pathname)}`)}>Sign In</Button><Button full variant="secondary" onClick={() => router.push(`/signup?next=${encodeURIComponent(pathname)}`)}>Create an Account</Button></div>
      </div>
    );
  }
  return <>{children}</>;
}
