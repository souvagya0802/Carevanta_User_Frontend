'use client';

import Link from 'next/link';
import { ArrowRight, BadgeCheck, CalendarCheck, HeartPulse, MapPin, Phone, ShieldCheck, Siren, Star } from 'lucide-react';
import { API_BASE } from '@/lib/api';
import { useBranding, Logo } from '@/lib/branding';
import { usePatientUi } from '@/lib/patient-ui';
import { AppIcon } from '@/components/icons';
import { Button, cx } from '@/components/ui/primitives';
import { HorizontalScroller } from '@/components/ui/horizontal-scroller';
import { SmartSearch } from '@/components/search/smart-search';

const PORTAL_URL = process.env.NEXT_PUBLIC_PORTAL_URL ?? 'http://localhost:3001';

/**
 * The public front door: what Carevanta is, for whom, and why to trust it.
 * Every word of copy and the hero image come from Settings → Patient App.
 */
export function Landing() {
  const ui = usePatientUi();
  const { branding } = useBranding();
  return (
    <div className="min-h-dvh bg-canvas">
      <header className="mx-auto flex max-w-6xl items-center justify-between gap-2 px-4 py-3 sm:py-4 sm:px-5 lg:px-8">
        {/* On small phones the name gives way so Sign In and Get Started always fit on one line. */}
        <Link href="/" aria-label={`${branding.name} home`} className="flex min-w-0 shrink-0 items-center gap-2.5"><Logo size="sm" className="rounded-xl" /><span className="hidden text-lg font-extrabold tracking-tight min-[400px]:inline">{branding.name}</span></Link>
        <nav className="hidden items-center gap-1 md:flex" aria-label="Landing">
          {([['Doctors', '/search?type=doctors'], ['Lab Tests', '/tests'], ['Medicines', '/pharmacy'], ['Emergency', '/emergency']] as [string, string][]).map(([l, h]) => <Link key={h} href={h} className="inline-flex h-11 items-center rounded-full px-4 text-sm font-semibold text-muted hover:bg-white hover:text-ink">{l}</Link>)}
        </nav>
        <div className="flex shrink-0 items-center gap-1.5 sm:gap-2">
          <Link href="/login" className="inline-flex h-11 items-center whitespace-nowrap rounded-full border border-line bg-white px-4 text-sm font-semibold text-ink hover:bg-soft sm:border-transparent sm:bg-transparent sm:hover:bg-white">Sign In</Link>
          <Link href="/signup"><Button size="sm">Get Started</Button></Link>
        </div>
      </header>

      {/* Hero */}
      {/* Two cards instead of one tall block: the promise and its buttons first, then search and the numbers that back it up. */}
      <section className="relative mx-auto max-w-6xl space-y-3 px-4 pt-2 pb-10 sm:px-5 lg:space-y-4 lg:px-8 lg:pt-10">
        <div className="relative z-20 rounded-4xl bg-brand-green p-5 text-white shadow-float sm:p-10 lg:p-12">
          <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden rounded-4xl"><span className="orb -top-24 -right-16 h-72 w-72" /><span className="orb -bottom-28 left-1/3 h-80 w-80 opacity-60" /></div>
          <div className="relative grid grid-cols-1 items-center gap-6 lg:grid-cols-[1.1fr_0.9fr] lg:gap-8">
            <div className="animate-fade-up min-w-0">
              <span className="inline-flex items-center gap-2 rounded-full bg-white/15 px-3 py-1 text-xs font-bold tracking-wide uppercase"><span className="flex h-5 w-5 items-center justify-center rounded-full bg-green"><ShieldCheck size={12} aria-hidden /></span> {ui.hero.badge}</span>
              <h1 className="mt-4 text-[1.75rem] font-extrabold leading-[1.1] tracking-tight sm:text-4xl lg:text-5xl">{ui.landing.headline}</h1>
              <p className="mt-3 max-w-xl text-sm text-white/85 sm:mt-4 sm:text-base">{ui.landing.subheadline}</p>
              <div className="mt-5 flex flex-col gap-2 sm:mt-6 sm:flex-row sm:flex-wrap sm:gap-3">
                <Link href="/signup" className="sm:w-auto"><Button variant="white" size="lg" full className="sm:w-auto">Create Free Account <ArrowRight size={18} /></Button></Link>
                <Link href="/home" className="sm:w-auto"><Button variant="ghost" size="lg" full className="text-white ring-1 ring-white/30 hover:bg-white/15 hover:text-white sm:w-auto sm:ring-0">Explore Without Signing In</Button></Link>
              </div>
            </div>
            {/* The drawn scene is decoration, so phones skip it; an uploaded hero image is shown on every screen. */}
            <div className={ui.heroImageUrl ? undefined : 'hidden sm:block'}>
              <HeroArt imageUrl={ui.heroImageUrl ? `${API_BASE}${ui.heroImageUrl}` : null} />
            </div>
          </div>
        </div>

        <div className="relative z-10 rounded-4xl bg-brand-green-soft p-5 shadow-card ring-1 ring-white sm:p-8 lg:grid lg:grid-cols-[1.1fr_0.9fr] lg:items-center lg:gap-8 lg:p-10">
          <div className="min-w-0">
            <p className="text-xs font-bold tracking-wide text-green-ink uppercase">Find Care Near You</p>
            <h2 className="mt-1 text-lg font-extrabold tracking-tight sm:text-xl">What Do You Need Today?</h2>
            <SmartSearch className="mt-3 max-w-xl" placeholder="Try “fever”, “child doctor” or “sugar test”" />
          </div>
          {ui.landing.stats.length > 0 && (
            <dl className="mt-4 flex flex-wrap gap-2 sm:gap-3 lg:mt-0 lg:grid lg:grid-cols-3">
              {ui.landing.stats.slice(0, 3).map((s) => <div key={s.label} className="flex max-w-full min-w-fit grow basis-[28%] lg:min-w-0 flex-col-reverse justify-end rounded-2xl bg-white p-3 shadow-card"><dt className="mt-0.5 text-[11px] font-medium leading-snug text-muted">{s.label}</dt><dd className="tnum text-sm font-extrabold leading-tight text-green-ink [overflow-wrap:break-word] min-[400px]:text-base sm:text-lg">{s.value}</dd></div>)}
            </dl>
          )}
        </div>
      </section>

      {/* What you can do */}
      <section className="mx-auto max-w-6xl px-4 sm:px-5 lg:px-8">
        <p className="text-center text-xs font-bold tracking-wide text-green-ink uppercase">Our Services</p>
        <h2 className="mt-1 text-center text-2xl font-extrabold tracking-tight">Everything Your Family Needs, in One Place</h2>
        <p className="mx-auto mt-2 max-w-2xl text-center text-sm text-muted">Tap a card to start. You can browse everything first and sign in only when you book.</p>
        <HorizontalScroller label="Services" className="mt-5" itemClassName="w-[31%] min-[400px]:w-[28%] sm:w-[22%]" gridClassName="md:grid-cols-3 md:gap-3 lg:grid-cols-6">
          {ui.categories.map((c) => (
            <Link key={c.key} href={c.href} className="card-3d flex h-full flex-col items-center gap-2.5 rounded-3xl px-2 py-4 text-center sm:gap-3 sm:p-4">
              <span className="tile-3d flex h-12 w-12 items-center justify-center rounded-2xl text-white sm:h-14 sm:w-14" style={{ '--tile': c.colour ?? ui.theme.primary } as React.CSSProperties}><AppIcon name={c.icon} size={24} /></span>
              <span className="text-xs font-bold leading-tight sm:text-sm">{c.label}</span>
            </Link>
          ))}
        </HorizontalScroller>
      </section>

      {/* How it works: numbered so the order still reads when the cards swipe sideways on phones. */}
      <section className="mx-auto mt-12 max-w-6xl px-4 sm:px-5 lg:px-8">
        <p className="text-xs font-bold tracking-wide text-green-ink uppercase">How It Works</p>
        <h2 className="mt-1 text-2xl font-extrabold tracking-tight">Care in Three Simple Steps</h2>
        <HorizontalScroller label="How It Works" className="mt-5" gridClassName="md:grid-cols-3 md:gap-4">
          {[
            { icon: MapPin, title: 'Find Care Near You', text: 'Search by what you feel, a speciality, a test or a medicine. See distance, fees and live availability.' },
            { icon: CalendarCheck, title: 'Book in a Few Taps', text: 'Pick a real slot, pay online or at the counter, and get a confirmation with the address and timing.' },
            { icon: HeartPulse, title: 'Keep Everything Together', text: 'Reports, prescriptions and visits for the whole family stay in your account, ready to share with any doctor.' },
          ].map((s, i) => (
            <div key={s.title} className="card-3d relative h-full rounded-3xl p-5 sm:p-6">
              <span className="absolute top-5 right-5 flex h-8 w-8 items-center justify-center rounded-full bg-green text-sm font-extrabold text-white"><span className="sr-only">Step </span>{i + 1}</span>
              <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary-soft text-primary"><s.icon size={22} aria-hidden /></span>
              <h3 className="mt-4 text-lg font-extrabold">{s.title}</h3>
              <p className="mt-1 text-sm text-muted">{s.text}</p>
            </div>
          ))}
        </HorizontalScroller>
      </section>

      {/* Trust */}
      {(ui.highlights.length > 0 || ui.landing.points.length > 0) && (
        <section className="mx-auto mt-12 max-w-6xl px-4 sm:px-5 lg:px-8">
          <div className="grid grid-cols-1 gap-6 rounded-4xl bg-white p-5 shadow-card sm:p-6 lg:grid-cols-2 lg:p-10">
            <div>
              <p className="inline-flex items-center gap-1.5 rounded-full bg-green-soft px-3 py-1 text-xs font-bold tracking-wide text-green-ink uppercase"><ShieldCheck size={14} aria-hidden /> Verified Care</p>
              <h2 className="mt-2 text-2xl font-extrabold tracking-tight">Why People Trust {branding.name}</h2>
              <ul className="mt-4 space-y-3">
                {ui.landing.points.map((p) => <li key={p} className="flex items-start gap-3 text-sm"><BadgeCheck size={18} className="mt-0.5 shrink-0 text-success" aria-hidden /> {p}</li>)}
              </ul>
            </div>
            {ui.highlights.length > 0 && (
              <HorizontalScroller label="Why People Trust Us" className="min-w-0" itemClassName="w-[72%] sm:w-[45%]" gridClassName="md:grid-cols-2 md:gap-3">
                {ui.highlights.map((h) => (
                  <div key={h.title} className="h-full rounded-3xl bg-soft p-4">
                    <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-green-soft text-green-ink"><AppIcon name={h.icon} size={20} /></span>
                    <p className="mt-3 text-sm font-bold">{h.title}</p>
                    <p className="mt-0.5 text-xs text-muted">{h.text}</p>
                  </div>
                ))}
              </HorizontalScroller>
            )}
          </div>
        </section>
      )}

      {/* Emergency + providers */}
      <section className="mx-auto mt-12 grid max-w-6xl gap-4 px-4 sm:px-5 lg:grid-cols-2 lg:px-8">
        <div className="relative overflow-hidden rounded-3xl bg-danger p-5 sm:p-6 text-white shadow-[0_24px_50px_-24px_rgb(225_29_72/0.7)]">
          <span className="orb -top-10 -right-10 h-40 w-40" />
          <div className="relative flex items-start gap-4">
            <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-white/20"><Siren size={28} aria-hidden /></span>
            <div><h2 className="text-xl font-extrabold">In an Emergency, Call {ui.emergencyNumber} First</h2><p className="mt-1 text-sm text-white/85">Then use the SOS button to reach verified ambulances that cover your area. You see who accepted and how far away they are.</p><a href={`tel:${ui.emergencyNumber}`} className="mt-4 inline-flex h-11 items-center gap-2 rounded-full bg-white px-5 text-sm font-bold text-danger"><Phone size={16} aria-hidden /> Call {ui.emergencyNumber}</a></div>
          </div>
        </div>
        <div className="card-3d rounded-3xl p-5 sm:p-6">
          <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-green-soft text-green-ink"><BadgeCheck size={24} aria-hidden /></span>
          <h2 className="mt-3 text-xl font-extrabold">Are You a Doctor, Hospital, Lab, Pharmacy or Ambulance Service?</h2>
          <p className="mt-1 text-sm text-muted">Join {branding.name} to reach patients around you. Verification is done against official registries; you manage bookings, reports and payouts from the provider portal.</p>
          <a href={PORTAL_URL} className="mt-3 inline-flex h-11 items-center gap-2 text-sm font-bold text-primary">Open the Provider Portal <ArrowRight size={16} aria-hidden /></a>
        </div>
      </section>

      <footer className="mx-auto mt-12 max-w-6xl px-4 pb-10 sm:px-5 text-center text-xs text-muted lg:px-8">
        <p>{ui.landing.footerNote}</p>
        {(ui.support.phone || ui.support.email) && <p className="mt-2">Help: {ui.support.phone && <a className="font-semibold" href={`tel:${ui.support.phone.replace(/\s/g, '')}`}>{ui.support.phone}</a>}{ui.support.phone && ui.support.email ? ' · ' : ''}{ui.support.email && <a className="font-semibold" href={`mailto:${ui.support.email}`}>{ui.support.email}</a>}{ui.support.hours ? ` · ${ui.support.hours}` : ''}</p>}
        <p className="mt-2">© {new Date().getFullYear()} {branding.name}</p>
      </footer>
    </div>
  );
}

/** Hero visual: the uploaded image when there is one, else a composed "3D" scene of floating cards. */
function HeroArt({ imageUrl }: { imageUrl: string | null }) {
  return (
    <div className="relative mx-auto h-72 w-full max-w-sm sm:h-80 lg:h-96">
      {imageUrl ? (
        <div className="tilt absolute inset-0 overflow-hidden rounded-3xl shadow-float"><img src={imageUrl} alt="" className="h-full w-full object-cover" /></div>
      ) : (
        <div className="tilt absolute inset-x-6 top-4 bottom-4 rounded-3xl bg-white/10 ring-1 ring-white/25" aria-hidden>
          <span className="absolute top-8 left-1/2 flex h-24 w-24 -translate-x-1/2 items-center justify-center rounded-full bg-white text-4xl font-extrabold text-primary shadow-float">Dr</span>
          <span className="absolute top-36 left-1/2 w-40 -translate-x-1/2 text-center text-sm font-bold">Dr. Anjali Maity</span>
          <span className="absolute top-42 left-1/2 w-40 -translate-x-1/2 text-center text-xs text-white/80">General Medicine · 12 yrs</span>
        </div>
      )}
      <div className={cx('animate-float absolute -left-2 top-10 rounded-2xl bg-white p-3 text-ink shadow-float', imageUrl && 'left-0')} aria-hidden>
        <p className="text-[10px] font-semibold text-muted">Next Slot</p><p className="text-sm font-extrabold">Today · 10:30 AM</p>
      </div>
      <div className="animate-float absolute -right-2 top-28 rounded-2xl bg-white p-3 text-ink shadow-float [animation-delay:1.2s]" aria-hidden>
        <p className="flex items-center gap-1 text-sm font-extrabold"><Star size={14} className="fill-sun text-sun" /> 4.8 <span className="text-[10px] font-medium text-muted">(212)</span></p>
      </div>
      <div className="animate-float absolute bottom-4 left-4 rounded-2xl bg-white p-3 text-ink shadow-float [animation-delay:2s]" aria-hidden>
        <p className="text-[10px] font-semibold text-muted">Report ready</p><p className="text-sm font-extrabold text-green-ink">Liver Function Test</p>
      </div>
    </div>
  );
}
