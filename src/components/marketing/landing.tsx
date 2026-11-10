'use client';

import Link from 'next/link';
import { ArrowRight, BadgeCheck, CalendarCheck, HeartPulse, MapPin, Phone, ShieldCheck, Siren, Star } from 'lucide-react';
import { API_BASE } from '@/lib/api';
import { useBranding, Logo } from '@/lib/branding';
import { usePatientUi } from '@/lib/patient-ui';
import { AppIcon } from '@/components/icons';
import { Button, cx } from '@/components/ui/primitives';
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
      <header className="mx-auto flex max-w-6xl items-center justify-between gap-2 px-4 py-4 sm:px-5 lg:px-8">
        {/* On small phones the name gives way so Sign In and Get Started always fit on one line. */}
        <Link href="/" aria-label={`${branding.name} home`} className="flex min-w-0 shrink-0 items-center gap-2.5"><Logo size="sm" className="rounded-xl" /><span className="hidden text-lg font-extrabold tracking-tight min-[400px]:inline">{branding.name}</span></Link>
        <nav className="hidden items-center gap-1 md:flex" aria-label="Landing">
          {([['Doctors', '/search?type=doctors'], ['Lab Tests', '/tests'], ['Medicines', '/pharmacy'], ['Emergency', '/emergency']] as [string, string][]).map(([l, h]) => <Link key={h} href={h} className="rounded-full px-4 py-2 text-sm font-semibold text-muted hover:bg-white hover:text-ink">{l}</Link>)}
        </nav>
        <div className="flex shrink-0 items-center gap-1.5 sm:gap-2">
          <Link href="/login" className="inline-flex h-11 items-center whitespace-nowrap rounded-full border border-line bg-white px-4 text-sm font-semibold text-ink hover:bg-soft sm:border-transparent sm:bg-transparent sm:hover:bg-white">Sign In</Link>
          <Link href="/signup"><Button size="sm">Get Started</Button></Link>
        </div>
      </header>

      {/* Hero */}
      <section className="relative mx-auto max-w-6xl px-5 pt-4 pb-10 lg:px-8 lg:pt-10">
        <div className="relative z-20 rounded-[36px] bg-brand-deep p-6 text-white shadow-float sm:p-10 lg:p-14">
          <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden rounded-[36px]"><span className="orb -top-24 -right-16 h-72 w-72" /><span className="orb -bottom-28 left-1/3 h-80 w-80 opacity-60" /></div>
          <div className="relative grid grid-cols-1 items-center gap-8 lg:grid-cols-[1.1fr_0.9fr]">
            <div className="animate-fade-up min-w-0">
              <span className="inline-flex items-center gap-2 rounded-full bg-white/15 px-3 py-1 text-xs font-bold tracking-wide uppercase"><ShieldCheck size={14} aria-hidden /> {ui.hero.badge}</span>
              <h1 className="mt-4 text-3xl font-extrabold leading-[1.1] tracking-tight sm:text-4xl lg:text-5xl">{ui.landing.headline}</h1>
              <p className="mt-4 max-w-xl text-sm text-white/85 sm:text-base">{ui.landing.subheadline}</p>
              <SmartSearch tone="hero" className="mt-5 max-w-xl" placeholder="Try “fever”, “child doctor” or “sugar test”" />
              <div className="mt-6 flex flex-wrap gap-3">
                <Link href="/signup"><Button variant="white" size="lg">Create Free Account <ArrowRight size={18} /></Button></Link>
                <Link href="/home"><Button variant="ghost" size="lg" className="text-white hover:bg-white/15 hover:text-white">Explore Without Signing In</Button></Link>
              </div>
              {ui.landing.stats.length > 0 && (
                <dl className="mt-8 grid max-w-md grid-cols-3 gap-3">
                  {ui.landing.stats.slice(0, 3).map((s) => <div key={s.label} className="min-w-0 rounded-2xl bg-white/12 p-3"><dt className="text-[11px] font-medium text-white/75">{s.label}</dt><dd className="tnum text-base font-extrabold leading-tight [overflow-wrap:anywhere] sm:text-lg">{s.value}</dd></div>)}
                </dl>
              )}
            </div>
            <HeroArt imageUrl={ui.heroImageUrl ? `${API_BASE}${ui.heroImageUrl}` : null} />
          </div>
        </div>
      </section>

      {/* What you can do */}
      <section className="mx-auto max-w-6xl px-5 lg:px-8">
        <h2 className="text-center text-2xl font-extrabold tracking-tight">Everything your family needs, in one place</h2>
        <p className="mx-auto mt-2 max-w-2xl text-center text-sm text-muted">Tap a card to start. You can browse everything first and sign in only when you book.</p>
        <div className="stagger mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
          {ui.categories.map((c) => (
            <Link key={c.key} href={c.href} className="card-3d flex flex-col items-center gap-3 rounded-3xl p-4 text-center">
              <span className="tile-3d flex h-14 w-14 items-center justify-center rounded-2xl text-white" style={{ '--tile': c.colour ?? ui.theme.primary } as React.CSSProperties}><AppIcon name={c.icon} size={26} /></span>
              <span className="text-sm font-bold">{c.label}</span>
            </Link>
          ))}
        </div>
      </section>

      {/* How it works */}
      <section className="mx-auto mt-12 max-w-6xl px-5 lg:px-8">
        <div className="grid gap-4 lg:grid-cols-3">
          {[
            { icon: MapPin, title: 'Find care near you', text: 'Search by what you feel, a speciality, a test or a medicine. See distance, fees and live availability.' },
            { icon: CalendarCheck, title: 'Book in a few taps', text: 'Pick a real slot, pay online or at the counter, and get a confirmation with the address and timing.' },
            { icon: HeartPulse, title: 'Keep everything together', text: 'Reports, prescriptions and visits for the whole family stay in your account, ready to share with any doctor.' },
          ].map((s, i) => (
            <div key={s.title} className="card-3d relative rounded-3xl p-6">
              <span className="absolute top-5 right-5 text-5xl font-extrabold text-primary/10">{i + 1}</span>
              <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary-soft text-primary"><s.icon size={22} aria-hidden /></span>
              <h3 className="mt-4 text-lg font-extrabold">{s.title}</h3>
              <p className="mt-1 text-sm text-muted">{s.text}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Trust */}
      {(ui.highlights.length > 0 || ui.landing.points.length > 0) && (
        <section className="mx-auto mt-12 max-w-6xl px-5 lg:px-8">
          <div className="grid gap-6 rounded-[36px] bg-white p-6 shadow-card lg:grid-cols-2 lg:p-10">
            <div>
              <h2 className="text-2xl font-extrabold tracking-tight">Why people trust {branding.name}</h2>
              <ul className="mt-4 space-y-3">
                {ui.landing.points.map((p) => <li key={p} className="flex items-start gap-3 text-sm"><BadgeCheck size={18} className="mt-0.5 shrink-0 text-success" aria-hidden /> {p}</li>)}
              </ul>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              {ui.highlights.map((h) => (
                <div key={h.title} className="rounded-3xl bg-soft p-4">
                  <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-white text-primary shadow-card"><AppIcon name={h.icon} size={20} /></span>
                  <p className="mt-3 text-sm font-bold">{h.title}</p>
                  <p className="mt-0.5 text-xs text-muted">{h.text}</p>
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* Emergency + providers */}
      <section className="mx-auto mt-12 grid max-w-6xl gap-4 px-5 lg:grid-cols-2 lg:px-8">
        <div className="relative overflow-hidden rounded-[32px] bg-danger p-6 text-white shadow-[0_24px_50px_-24px_rgb(225_29_72/0.7)]">
          <span className="orb -top-10 -right-10 h-40 w-40" />
          <div className="relative flex items-start gap-4">
            <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-white/20"><Siren size={28} aria-hidden /></span>
            <div><h2 className="text-xl font-extrabold">In an emergency, call {ui.emergencyNumber} first</h2><p className="mt-1 text-sm text-white/85">Then use the SOS button to reach verified ambulances that cover your area. You see who accepted and how far away they are.</p><a href={`tel:${ui.emergencyNumber}`} className="mt-4 inline-flex h-11 items-center gap-2 rounded-full bg-white px-5 text-sm font-bold text-danger"><Phone size={16} aria-hidden /> Call {ui.emergencyNumber}</a></div>
          </div>
        </div>
        <div className="card-3d rounded-[32px] p-6">
          <h2 className="text-xl font-extrabold">Are you a doctor, hospital, lab, pharmacy or ambulance service?</h2>
          <p className="mt-1 text-sm text-muted">Join {branding.name} to reach patients around you. Verification is done against official registries; you manage bookings, reports and payouts from the provider portal.</p>
          <a href={PORTAL_URL} className="mt-4 inline-flex items-center gap-2 text-sm font-bold text-primary">Open the Provider Portal <ArrowRight size={16} aria-hidden /></a>
        </div>
      </section>

      <footer className="mx-auto mt-12 max-w-6xl px-5 pb-10 text-center text-xs text-muted lg:px-8">
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
        <div className="tilt absolute inset-0 overflow-hidden rounded-[32px] shadow-float"><img src={imageUrl} alt="" className="h-full w-full object-cover" /></div>
      ) : (
        <div className="tilt absolute inset-x-6 top-4 bottom-4 rounded-[32px] bg-white/10 ring-1 ring-white/25" aria-hidden>
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
        <p className="text-[10px] font-semibold text-muted">Report ready</p><p className="text-sm font-extrabold text-success">Liver Function Test</p>
      </div>
    </div>
  );
}
