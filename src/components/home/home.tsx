'use client';

import Link from 'next/link';
import { Ambulance, ArrowRight, CalendarCheck, ChevronRight, FlaskConical, Package, Pill, Siren, Star, Stethoscope } from 'lucide-react';
import { useAuth } from '@/lib/auth';
import { useGet } from '@/lib/hooks';
import { API_BASE } from '@/lib/api';
import { usePatientUi } from '@/lib/patient-ui';
import { useLocation, geoQuery } from '@/lib/location';
import { count, money } from '@/lib/format';
import { AppIcon } from '@/components/icons';
import { Avatar, Button, Card, SectionTitle, Skeleton, StatusBadge, cx } from '@/components/ui/primitives';
import { HorizontalScroller } from '@/components/ui/horizontal-scroller';
import { SmartSearch } from '@/components/search/smart-search';
import { AppShell } from '@/components/layout/app-shell';

interface Home { counts: Record<string, number>; topDoctors: { id: string; name: string; speciality: string | null; yearsOfExperience: number | null; feeMinor: number | null; rating: number | null; ratingCount: number }[]; popularTests: { code: string; name: string; providers: number; fromMinor: number | null }[] }
interface Summary { profiles: { id: string; fullName: string; relationship: string }[]; nextAppointment: { id: string; reference: string; status: string; startsAt: string; doctor: { id: string; displayName: string }; facility: string; location: { name: string; city: string } | null; patientName: string } | null; openLabOrders: number; openPharmacyOrders: number; unreadNotifications: number; activeEmergency: { id: string; reference: string; status: string } | null }

/** Phone quick actions under the search box (signed-in home): one row instead of the headline, text and two buttons. */
const QUICK = [
  { label: 'Doctor', href: '/search?type=doctors', icon: Stethoscope },
  { label: 'Lab Test', href: '/tests', icon: FlaskConical },
  { label: 'Medicines', href: '/pharmacy', icon: Pill },
  { label: 'Ambulance', href: '/emergency', icon: Ambulance },
];

const greeting = () => { const h = new Date().getHours(); return h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening'; };
const when = (iso: string) => new Date(iso).toLocaleString('en-IN', { weekday: 'short', day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit', timeZone: 'Asia/Kolkata' });

export function HomeScreen() {
  const ui = usePatientUi();
  const { me } = useAuth();
  const { place } = useLocation();
  const home = useGet<Home>(`/public/patient-home?x=1${geoQuery(place)}`);
  const summary = useGet<Summary>(me ? '/patient/summary' : null, { refetchInterval: 60_000 });
  const s = summary.data;
  // Signed in on a phone, the hero shrinks to greeting + search + quick chips, so "What do you need?" is visible
  // without scrolling. Visitors (landing) and larger screens keep the full headline, text and buttons.
  const compact = !!me;

  return (
    <AppShell>
      <div className="space-y-6">
        {/* Hero */}
        <section className={cx('relative z-20 rounded-[32px] bg-brand-deep text-white shadow-float sm:p-7', compact ? 'p-4' : 'p-5')}>
          {/* Only the decorations are clipped, so the search suggestions can open below the hero. */}
          <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden rounded-[32px]"><span className="orb -top-20 -right-10 h-56 w-56" /><span className="orb -bottom-24 left-10 h-64 w-64 opacity-60" /></div>
          <div className="relative grid grid-cols-1 gap-5 lg:grid-cols-[1fr_280px] lg:items-center">
            <div className="min-w-0">
              <p className="text-sm font-medium text-white/80">{me ? `${greeting()}, ${me.fullName.split(' ')[0]}` : ui.hero.badge}</p>
              <h1 className={cx('mt-1 text-2xl font-extrabold leading-tight tracking-tight sm:text-3xl', compact && 'sr-only sm:not-sr-only sm:block')}>{ui.hero.title}</h1>
              <p className={cx('mt-2 max-w-lg text-sm text-white/85', compact && 'hidden sm:block')}>{ui.hero.subtitle}</p>
              {/* Search and the two quick actions share one row from tablet up; on phones the actions wrap under the box. */}
              <div className={cx('flex flex-col gap-3 md:flex-row md:items-center', compact ? 'mt-3 sm:mt-4' : 'mt-4')}>
                <SmartSearch tone="hero" className="min-w-0 flex-1" />
                <div className={cx('shrink-0 flex-wrap items-center gap-2', compact ? 'hidden sm:flex' : 'flex')}>
                  <Link href={ui.hero.ctaHref}><Button variant="white" size="sm">{ui.hero.ctaLabel}</Button></Link>
                  <Link href={ui.hero.secondaryHref}><Button variant="ghost" size="sm" className="text-white hover:bg-white/15 hover:text-white">{ui.hero.secondaryLabel} <ArrowRight size={14} /></Button></Link>
                </div>
              </div>
              {compact && (
                <nav aria-label="Quick actions" className="no-scrollbar -mx-4 mt-3 flex gap-2 overflow-x-auto px-4 sm:hidden">
                  {QUICK.map((q) => (
                    <Link key={q.href} href={q.href} className="flex h-10 shrink-0 items-center gap-1.5 rounded-full bg-white/15 px-3.5 text-sm font-semibold text-white ring-1 ring-white/25 active:bg-white/25">
                      <q.icon size={15} aria-hidden /> {q.label}
                    </Link>
                  ))}
                </nav>
              )}
            </div>
            {ui.heroImageUrl && <img src={`${API_BASE}${ui.heroImageUrl}`} alt="" className="tilt hidden h-56 w-full rounded-3xl object-cover shadow-float lg:block" />}
          </div>
        </section>

        {/* Signed-in strip */}
        {me && s && (s.activeEmergency || s.nextAppointment || s.openLabOrders || s.openPharmacyOrders) ? (
          <HorizontalScroller label="Your Care Right Now" itemClassName={[s.activeEmergency, s.nextAppointment, s.openLabOrders || s.openPharmacyOrders].filter(Boolean).length > 1 ? 'w-[88%] sm:w-[60%]' : 'w-full'} gridClassName="md:grid-cols-2">
            {s.activeEmergency && <Card href={`/emergency/${s.activeEmergency.id}`} className="border-2 border-danger/30 bg-danger-soft"><div className="flex items-center gap-3"><span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-danger text-white pulse-ring"><Siren size={22} aria-hidden /></span><div className="min-w-0 flex-1"><p className="text-sm font-extrabold text-danger">Ambulance request in progress</p><p className="text-xs text-muted">{s.activeEmergency.reference}</p></div><StatusBadge status={s.activeEmergency.status} /></div></Card>}
            {s.nextAppointment && (
              <Card href={`/appointments/${s.nextAppointment.id}`}>
                <div className="flex items-center gap-3">
                  <Avatar name={s.nextAppointment.doctor.displayName} />
                  <div className="min-w-0 flex-1"><p className="text-[11px] font-bold tracking-wide text-primary uppercase">Next appointment</p><p className="truncate text-sm font-extrabold">{s.nextAppointment.doctor.displayName}</p><p className="truncate text-xs text-muted">{when(s.nextAppointment.startsAt)} · {s.nextAppointment.location?.name ?? s.nextAppointment.facility}{s.nextAppointment.patientName !== me.fullName ? ` · for ${s.nextAppointment.patientName}` : ''}</p></div>
                  <StatusBadge status={s.nextAppointment.status} />
                </div>
              </Card>
            )}
            {(s.openLabOrders > 0 || s.openPharmacyOrders > 0) && (
              <Card href="/orders"><div className="flex items-center gap-3"><span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-violet-soft text-violet"><Package size={22} aria-hidden /></span><div className="min-w-0 flex-1"><p className="text-sm font-extrabold">Orders in Progress</p><p className="text-xs text-muted">{s.openLabOrders ? `${s.openLabOrders} lab` : ''}{s.openLabOrders && s.openPharmacyOrders ? ' · ' : ''}{s.openPharmacyOrders ? `${s.openPharmacyOrders} medicine` : ''}</p></div><ChevronRight size={18} className="text-muted" /></div></Card>
            )}
          </HorizontalScroller>
        ) : null}

        {/* Categories */}
        <section>
          <SectionTitle title="What Do You Need?" />
          {(() => {
            const tiles = ui.categories.map((c) => (
              <Link key={c.key} href={c.href} className="card-3d flex h-full flex-col items-center gap-2 rounded-3xl p-3 text-center">
                <span className="tile-3d flex h-12 w-12 items-center justify-center rounded-2xl text-white" style={{ '--tile': c.colour ?? ui.theme.primary } as React.CSSProperties}><AppIcon name={c.icon} size={22} /></span>
                <span className="text-xs font-bold leading-tight">{c.label}</span>
              </Link>
            ));
            // Up to six tiles sit in two neat rows of three on a phone; more than that would stack, so they swipe instead.
            return ui.categories.length > 6
              ? <HorizontalScroller label="Care Categories" itemClassName="w-[30%] sm:w-[22%]" gridClassName="md:grid-cols-4 lg:grid-cols-6" dots={false}>{tiles}</HorizontalScroller>
              : <div className="stagger grid grid-cols-3 gap-3 sm:grid-cols-4 lg:grid-cols-6">{tiles}</div>;
          })()}
        </section>

        {/* Top doctors */}
        <section>
          <RowTitle title="Top-Rated Doctors" href="/search?type=doctors" />
          {home.isPending ? <Skeleton card rows={2} className="sm:grid-cols-2" /> : (
            !home.data?.topDoctors.length ? <p className="text-sm text-muted">No doctors are listed yet.</p> : (
            <HorizontalScroller label="Top-Rated Doctors" itemClassName="w-[80%] sm:w-[45%]" gridClassName="md:grid-cols-2 lg:grid-cols-4">
              {home.data.topDoctors.map((d) => (
                <Card key={d.id} href={`/doctors/${d.id}`} className="h-full">
                  <div className="flex items-start gap-3"><Avatar name={d.name} size="lg" /><div className="min-w-0"><p className="truncate text-sm font-extrabold">{d.name}</p><p className="truncate text-xs text-muted">{d.speciality ?? 'Doctor'}{d.yearsOfExperience != null ? ` · ${d.yearsOfExperience} yrs` : ''}</p><RatingPill value={d.rating} count={d.ratingCount} /></div></div>
                  <div className="mt-3 flex items-center justify-between"><span className="text-xs text-muted">Consultation</span><span className="tnum text-sm font-extrabold">{d.feeMinor != null ? <><span className="text-xs font-semibold text-muted">from </span>{money(d.feeMinor)}</> : '—'}</span></div>
                </Card>
              ))}
            </HorizontalScroller>
          ))}
        </section>

        {/* Popular tests */}
        <section>
          <RowTitle title="Popular Lab Tests" href="/tests" />
          {home.isPending ? <Skeleton rows={3} /> : (
            !home.data?.popularTests.length ? <p className="text-sm text-muted">No tests are listed yet.</p> : (
            <HorizontalScroller label="Popular Lab Tests" itemClassName="w-[44%] sm:w-[30%]" gridClassName="md:grid-cols-4">
              {home.data.popularTests.map((t) => (
                <Card key={t.code} href={`/tests/${encodeURIComponent(t.code)}`} className="flex h-full flex-col gap-2">
                  <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-green-soft text-green-ink"><FlaskConical size={20} aria-hidden /></span>
                  <span className="line-clamp-2 min-h-10 text-sm font-bold leading-5">{t.name}</span>
                  <span className="mt-auto block text-xs text-muted">{count(t.providers)} lab{t.providers === 1 ? '' : 's'}</span>
                  {t.fromMinor != null && <span className="tnum block text-sm font-extrabold"><span className="text-xs font-semibold text-muted">from </span>{money(t.fromMinor)}</span>}
                </Card>
              ))}
            </HorizontalScroller>
          ))}
        </section>

        {/* Counts + emergency */}
        <section className="grid gap-3 sm:grid-cols-[1fr_1fr] lg:grid-cols-[2fr_1fr]">
          <div className="card-3d rounded-3xl p-4">
            <p className="text-sm font-extrabold">Verified and Listed Near {place?.label ?? 'you'}</p>
            <div className="mt-3 grid grid-cols-3 gap-2 text-center">
              {[['DOCTOR', 'Doctors', Stethoscope], ['DIAGNOSTIC_LAB', 'Labs', FlaskConical], ['PHARMACY', 'Pharmacies', Package]].map(([k, l, I]) => { const Icon = I as typeof Stethoscope; return <div key={k as string} className="rounded-2xl bg-soft p-3"><Icon size={18} className="mx-auto text-primary" aria-hidden /><p className="tnum mt-1 text-lg font-extrabold">{home.data ? count(home.data.counts[k as string] ?? 0) : '—'}</p><p className="text-[11px] text-muted">{l as string}</p></div>; })}
            </div>
          </div>
          <Link href="/emergency" className={cx('relative overflow-hidden rounded-3xl bg-danger p-4 text-white shadow-[0_20px_40px_-20px_rgb(225_29_72/0.7)]')}>
            <span className="orb -top-8 -right-8 h-28 w-28" />
            <div className="relative flex items-center gap-3"><span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white/20"><Siren size={24} aria-hidden /></span><div><p className="text-sm font-extrabold">Emergency</p><p className="text-xs text-white/85">Call {ui.emergencyNumber} first, then request an ambulance</p></div></div>
          </Link>
        </section>

        {!me && (
          <section className="card-3d flex flex-col items-start gap-3 rounded-3xl p-5 sm:flex-row sm:items-center">
            <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-primary-soft text-primary"><CalendarCheck size={22} aria-hidden /></span>
            <div className="flex-1"><p className="text-sm font-extrabold">Create a free account to book</p><p className="text-xs text-muted">Keep appointments, reports and family profiles together. Takes a minute.</p></div>
            <div className="flex gap-2"><Link href="/signup"><Button size="sm">Create Account</Button></Link><Link href="/login"><Button size="sm" variant="secondary">Sign In</Button></Link></div>
          </section>
        )}
      </div>
    </AppShell>
  );
}

/** Section heading with a "See All" link that is a full 44 px tap target. */
function RowTitle({ title, href }: { title: string; href: string }) {
  return (
    <div className="mb-2 flex items-center justify-between gap-3">
      <h2 className="text-lg font-extrabold tracking-tight">{title}</h2>
      <Link href={href} className="-mr-2 inline-flex h-11 items-center gap-0.5 rounded-[5px] px-2 text-sm font-semibold text-primary">See All <ChevronRight size={15} aria-hidden /></Link>
    </div>
  );
}

/** Green rating pill for doctor cards (green ink on the soft green tint passes WCAG AA). */
function RatingPill({ value, count: n }: { value: number | null; count: number }) {
  if (value == null) return <span className="mt-1 inline-flex rounded-[5px] bg-green-soft px-1.5 py-0.5 text-xs font-bold text-green-ink">New</span>;
  return <span className="mt-1 inline-flex items-center gap-1 rounded-[5px] bg-green-soft px-1.5 py-0.5 text-xs font-bold text-green-ink"><Star size={12} className="fill-green text-green" aria-hidden /><span className="tnum">{value.toFixed(1)}</span>{n > 0 && <span className="font-normal text-muted">({n})</span>}</span>;
}
