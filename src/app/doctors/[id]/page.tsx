'use client';

import Link from 'next/link';
import dynamic from 'next/dynamic';
import { useParams, useRouter } from 'next/navigation';
import { ArrowLeft, Award, BadgeCheck, Building2, CalendarCheck, Languages, MapPin, Navigation, Star, Stethoscope } from 'lucide-react';
import { useGet } from '@/lib/hooks';
import { useLocation } from '@/lib/location';
import { directionsUrl, distanceKm } from '@/lib/geo';
import { money, nowMs, relative, slotLabel } from '@/lib/format';
import { AppShell } from '@/components/layout/app-shell';
import { Avatar, Badge, Button, Card, ErrorState, InfoTile, Rating, SectionTitle, Skeleton } from '@/components/ui/primitives';

export interface DoctorProfile {
  id: string; type: string; name: string; description: string | null; rating: { average: number | null; count: number };
  doctor: { gender: string | null; yearsOfExperience: number | null; languages: string[]; bio: string | null; defaultFeeMinor: number | null; specialities: { code: string; name: string; isPrimary: boolean }[]; qualifications: { degree: string; institution: string; yearAwarded: number | null }[]; registrationVerified: boolean; councils: string[]; nextSlotAt: string | null; practisesAt: { affiliationId: string; facilityId: string; facilityName: string; facilityType: string; department: string | null; locationId: string | null; locationName: string | null; locality: string | null; city: string | null; feeMinor: number | null; engagementType: string; latitude?: number | null; longitude?: number | null }[] } | null;
  locations: { id: string; name: string; addressLine1: string; locality: string | null; city: string; district: string; pincode: string; latitude: number | null; longitude: number | null }[];
}
// Leaflet needs the browser, so the map loads on the client only.
const MapView = dynamic(() => import('@/components/map/map-view').then((m) => m.MapView), { ssr: false, loading: () => <div className="shimmer h-52 rounded-[22px]" /> });
interface Place { key: string; name: string; where: string; fee: number | null; lat: number | null; lng: number | null }
interface Review { id: string; rating: number; comment: string | null; author: string; createdAt: string }
const LANG: Record<string, string> = { en: 'English', hi: 'Hindi', bn: 'Bengali', te: 'Telugu', ta: 'Tamil', mr: 'Marathi', gu: 'Gujarati', kn: 'Kannada', ml: 'Malayalam', or: 'Odia', pa: 'Punjabi', ur: 'Urdu' };

export default function DoctorPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const q = useGet<DoctorProfile>(`/discovery/providers/${id}`);
  const { place: you } = useLocation();
  const reviews = useGet<Review[]>(`/discovery/providers/${id}/reviews?limit=5`);
  const d = q.data;
  const primary = d?.doctor?.specialities.find((s) => s.isPrimary) ?? d?.doctor?.specialities[0];
  const places: Place[] = d?.doctor ? [...d.locations.map((l) => ({ key: l.id, name: `Own chamber · ${l.name}`, where: `${l.locality ?? l.city}, ${l.district}`, fee: d.doctor!.defaultFeeMinor, lat: l.latitude, lng: l.longitude })), ...d.doctor.practisesAt.map((a) => ({ key: a.affiliationId, name: a.facilityName, where: [a.locationName, a.locality ?? a.city].filter(Boolean).join(', '), fee: a.feeMinor ?? d.doctor!.defaultFeeMinor, lat: a.latitude ?? null, lng: a.longitude ?? null }))] : [];
  const mapped = places.flatMap((p) => (p.lat != null && p.lng != null ? [{ id: p.key, lat: p.lat, lng: p.lng, title: p.name }] : []));
  // Each place shows its own fee (the affiliation fee where the doctor sits in a hospital or clinic,
  // the default fee in their own chamber); the hero says "from" the lowest of those.
  const placeFees = places.map((p) => p.fee).filter((f): f is number => f != null);
  const fromFee = placeFees.length ? Math.min(...placeFees) : d?.doctor?.defaultFeeMinor ?? null;

  return (
    <AppShell hideTop>
      {q.isPending ? <Skeleton card rows={3} /> : q.isError || !d || !d.doctor ? <div className="mx-auto max-w-2xl space-y-4 pt-2"><button type="button" onClick={() => router.back()} aria-label="Back" className="flex h-11 w-11 items-center justify-center rounded-full bg-white shadow-card"><ArrowLeft size={18} /></button><ErrorState error={q.error ?? new Error('This doctor is not listed')} retry={() => q.refetch()} /></div> : (
        <div className="space-y-5">
          <section className="relative -mx-4 -mt-3 overflow-hidden bg-brand-deep px-5 pt-[max(12px,env(safe-area-inset-top))] pb-6 text-white lg:mx-0 lg:mt-0 lg:rounded-[32px] lg:p-8">
            <span className="orb -top-16 -right-10 h-56 w-56" />
            <div className="relative">
              <button type="button" onClick={() => router.back()} aria-label="Back" className="mb-4 flex h-11 w-11 items-center justify-center rounded-full bg-white/15 lg:hidden"><ArrowLeft size={18} /></button>
              <div className="flex items-start gap-4">
                <Avatar name={d.name} size="xl" className="rounded-3xl bg-white/20 text-white" />
                <div className="min-w-0 flex-1">
                  <h1 className="text-2xl font-extrabold leading-tight">{d.name}</h1>
                  <p className="mt-1 text-sm text-white/85">{primary?.name ?? 'Doctor'}{d.doctor.specialities.length > 1 ? ` · +${d.doctor.specialities.length - 1} more` : ''}</p>
                  <div className="mt-2 flex flex-wrap items-center gap-2">{d.doctor.registrationVerified && <Badge tone="white"><BadgeCheck size={11} className="mr-1 inline" aria-hidden />Registration verified</Badge>}<span className="inline-flex items-center gap-1 text-sm font-bold"><Star size={14} className="fill-sun text-sun" aria-hidden /> {d.rating.average?.toFixed(1) ?? 'New'}{d.rating.count ? <span className="text-xs font-normal text-white/75">({d.rating.count})</span> : null}</span></div>
                </div>
              </div>
              <div className="mt-5 grid grid-cols-3 gap-2">
                <InfoTile icon={Award} label="Experience" value={d.doctor.yearsOfExperience != null ? `${d.doctor.yearsOfExperience} yrs` : '—'} />
                <InfoTile icon={Stethoscope} label="Fee from" value={money(fromFee)} />
                <InfoTile icon={Building2} label="Practises at" value={`${places.length} place${places.length === 1 ? '' : 's'}`} />
              </div>
            </div>
          </section>

          <div className="grid gap-5 lg:grid-cols-[1fr_360px]">
            <div className="space-y-5">
              {d.doctor.bio && <Card><p className="text-sm text-ink/90">{d.doctor.bio}</p></Card>}
              <section>
                <SectionTitle title="Where to See This Doctor" />
                {mapped.length > 0 && <MapView className="mb-3 h-52 lg:h-64" markers={mapped} you={you} label={`Places where ${d.name} sees patients`} />}
                <div className="stagger grid gap-2">
                  {places.map((p) => (
                    <Card key={p.key} className="flex items-center gap-3">
                      <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-primary-soft text-primary"><MapPin size={20} aria-hidden /></span>
                      <span className="min-w-0 flex-1"><span className="block truncate text-sm font-bold">{p.name}</span><span className="block truncate text-xs text-muted">{p.where}{you && p.lat != null && p.lng != null ? ` · ${distanceKm(you, { lat: p.lat, lng: p.lng }).toFixed(1)} km` : ''}</span></span>
                      <span className="tnum text-sm font-extrabold">{money(p.fee)}</span>
                      {p.lat != null && p.lng != null && <a href={directionsUrl(p.lat, p.lng)} target="_blank" rel="noreferrer" aria-label={`Directions to ${p.name}`} className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-primary-soft text-primary"><Navigation size={16} aria-hidden /></a>}
                    </Card>
                  ))}
                  {places.length === 0 && <p className="text-sm text-muted">No bookable location yet.</p>}
                </div>
              </section>
              <section className="grid gap-3 sm:grid-cols-2">
                <Card><p className="flex items-center gap-2 text-sm font-extrabold"><Award size={16} className="text-primary" aria-hidden /> Qualifications</p><ul className="mt-2 space-y-1 text-sm">{d.doctor.qualifications.map((x, i) => <li key={i}><span className="font-semibold">{x.degree}</span><span className="block text-xs text-muted">{x.institution}{x.yearAwarded ? ` · ${x.yearAwarded}` : ''}</span></li>)}{!d.doctor.qualifications.length && <li className="text-muted">Not listed</li>}</ul></Card>
                <Card><p className="flex items-center gap-2 text-sm font-extrabold"><Languages size={16} className="text-primary" aria-hidden /> Speaks</p><p className="mt-2 text-sm">{d.doctor.languages.length ? d.doctor.languages.map((l) => LANG[l] ?? l).join(', ') : 'Not stated'}</p>{d.doctor.councils.length > 0 && <p className="mt-3 text-xs text-muted">Registered with {d.doctor.councils.join(', ')}{d.doctor.registrationVerified ? ' · checked by Carevanta' : ''}</p>}</Card>
              </section>
              <section>
                <SectionTitle title="What Patients Say" />
                {reviews.isPending ? <Skeleton rows={2} /> : !reviews.data?.length ? <p className="text-sm text-muted">No published reviews yet. Reviews appear after a completed visit and moderation.</p> : (
                  <div className="stagger grid gap-2">{reviews.data.map((r) => <Card key={r.id}><div className="flex items-center justify-between"><Rating value={r.rating} /><span className="text-xs text-muted">{r.author} · {relative(r.createdAt)}</span></div>{r.comment && <p className="mt-1.5 text-sm">{r.comment}</p>}</Card>)}</div>
                )}
              </section>
            </div>
            <aside className="hidden lg:block"><BookCard id={d.id} next={d.doctor.nextSlotAt} /></aside>
          </div>
          <div className="fixed inset-x-0 bottom-[max(88px,calc(env(safe-area-inset-bottom)+76px))] z-30 px-4 lg:hidden"><div className="mx-auto max-w-md"><BookCard id={d.id} next={d.doctor.nextSlotAt} compact /></div></div>
          {/* Room for the floating Book bar (56 px, 88 px above the bottom nav edge) so the last review scrolls clear of it. */}
          <div aria-hidden className="h-[calc(env(safe-area-inset-bottom)+48px)] lg:hidden" />
        </div>
      )}
    </AppShell>
  );
}

function BookCard({ id, next, compact }: { id: string; next: string | null; compact?: boolean }) {
  const label = next ? `Next slot ${slotLabel(next, nowMs())}` : 'No open slots right now';
  if (compact) return <Link href={`/book/${id}`} className="flex items-center gap-3 rounded-full bg-brand p-1.5 pl-5 text-white shadow-float"><span className="min-w-0 flex-1 leading-tight">{next ? <><span className="block text-[10px] font-semibold text-white/80">Next Slot</span><span className="block truncate text-xs font-bold">{slotLabel(next, nowMs())}</span></> : <span className="block truncate text-xs font-semibold">{label}</span>}</span><span className="flex h-11 items-center gap-2 rounded-full bg-white px-5 text-sm font-extrabold text-primary"><CalendarCheck size={16} aria-hidden /> Book</span></Link>;
  return (
    <div className="card-3d sticky top-24 rounded-3xl p-5">
      <p className="text-sm font-extrabold">Book an Appointment</p>
      <p className="mt-1 text-xs text-muted">{label}. Pick the place, day and time; pay online or at the counter.</p>
      <Link href={`/book/${id}`}><Button full size="lg" className="mt-4"><CalendarCheck size={18} /> Choose a Slot</Button></Link>
    </div>
  );
}
