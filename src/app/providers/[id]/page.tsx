'use client';

import Link from 'next/link';
import dynamic from 'next/dynamic';
import { useParams, useRouter } from 'next/navigation';
import { ArrowLeft, BadgeCheck, Bed, Clock, FlaskConical, Home, MapPin, Phone, Pill, Star, Stethoscope } from 'lucide-react';
import { useGet } from '@/lib/hooks';
import { useLocation } from '@/lib/location';
import { directionsUrl, distanceKm } from '@/lib/geo';
import { money, relative } from '@/lib/format';
import { TYPE_COLOUR, TYPE_LABEL } from '@/components/icons';
import { AppShell } from '@/components/layout/app-shell';
import { Avatar, Badge, Button, Card, ErrorState, InfoTile, Rating, SectionTitle, Skeleton } from '@/components/ui/primitives';

export interface ProviderProfile {
  id: string; type: string; name: string; description: string | null; contactPhone: string | null; rating: { average: number | null; count: number };
  facility: { ownershipType: string; bedCount: number | null; icuBedCount: number | null; hasEmergency: boolean; isOpen24x7: boolean; accreditations: string[] } | null;
  diagnostic: { offersPathology: boolean; offersImaging: boolean; homeCollectionAvailable: boolean } | null;
  pharmacy: { homeDeliveryAvailable: boolean; pharmacistName: string | null } | null;
  locations: { id: string; name: string; addressLine1: string; addressLine2: string | null; locality: string | null; city: string; district: string; state: string; pincode: string; latitude: number | null; longitude: number | null; phone: string | null; operatingHours: { dayOfWeek: number; opensAtMin: number; closesAtMin: number; isClosed: boolean }[] }[];
  departments: { code: string; name: string }[]; amenities: { code: string; name: string; category: string }[];
  services: { id: string; code: string; name: string; category: string; requiresPrescription: boolean; fastingRequired: boolean | null; preparationInstructions: string | null; priceMinor: number; homeServiceAvailable: boolean; turnaroundHours: number | null; location: { id: string; name: string } | null }[];
  doctors: { id: string; name: string; speciality: string | null; yearsOfExperience: number | null; rating: number | null; ratingCount: number; department: string | null; feeMinor: number | null; engagementType: string }[];
  coverage: { purpose: string; district: string; pincode: string | null }[];
}
// Leaflet needs the browser, so the map loads on the client only.
const MapView = dynamic(() => import('@/components/map/map-view').then((m) => m.MapView), { ssr: false, loading: () => <div className="shimmer h-56 rounded-[22px]" /> });
const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const hm = (m: number) => `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;

export default function ProviderPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const q = useGet<ProviderProfile>(`/discovery/providers/${id}`);
  const { place } = useLocation();
  const reviews = useGet<{ id: string; rating: number; comment: string | null; author: string; createdAt: string }[]>(`/discovery/providers/${id}/reviews?limit=5`);
  const p = q.data;
  const isLab = p?.type === 'DIAGNOSTIC_LAB' || p?.type === 'IMAGING_CENTRE';
  const isPharmacy = p?.type === 'PHARMACY';
  const today = new Date().getDay();
  const primary = p?.locations[0];
  const todayHours = primary?.operatingHours.filter((h) => h.dayOfWeek === today && !h.isClosed) ?? [];

  return (
    <AppShell hideTop>
      {q.isPending ? <Skeleton card rows={3} /> : q.isError || !p ? <ErrorState error={q.error} retry={() => q.refetch()} /> : (
        <div className="space-y-5">
          <section className="relative -mx-4 -mt-3 overflow-hidden px-5 pt-[max(12px,env(safe-area-inset-top))] pb-6 text-white lg:mx-0 lg:mt-0 lg:rounded-[32px] lg:p-8" style={{ background: `linear-gradient(160deg, ${TYPE_COLOUR[p.type] ?? '#1E6CFF'}, #0b1b3a)` }}>
            <span className="orb -top-16 -right-10 h-56 w-56" />
            <div className="relative">
              <button type="button" onClick={() => router.back()} aria-label="Back" className="mb-4 flex h-10 w-10 items-center justify-center rounded-full bg-white/15 lg:hidden"><ArrowLeft size={18} /></button>
              <div className="flex items-start gap-4">
                <Avatar name={p.name} size="xl" className="rounded-3xl bg-white/20" />
                <div className="min-w-0 flex-1">
                  <Badge tone="white">{TYPE_LABEL[p.type] ?? p.type}</Badge>
                  <h1 className="mt-1 text-2xl font-extrabold leading-tight">{p.name}</h1>
                  <p className="mt-1 flex items-center gap-1 text-sm text-white/85"><MapPin size={14} aria-hidden />{primary ? `${primary.locality ?? primary.city}, ${primary.district}` : ''}</p>
                  <div className="mt-2 flex flex-wrap items-center gap-2"><Badge tone="white"><BadgeCheck size={11} className="mr-1 inline" aria-hidden />Verified</Badge><span className="inline-flex items-center gap-1 text-sm font-bold"><Star size={14} className="fill-sun text-sun" aria-hidden /> {p.rating.average?.toFixed(1) ?? 'New'}{p.rating.count ? <span className="text-xs font-normal text-white/75">({p.rating.count})</span> : null}</span></div>
                </div>
              </div>
              <div className="mt-5 grid grid-cols-3 gap-2">
                <InfoTile icon={Clock} label="Today" value={todayHours.length ? todayHours.map((h) => `${hm(h.opensAtMin)}–${hm(h.closesAtMin)}`).join(', ') : p.facility?.isOpen24x7 ? 'Open 24×7' : 'Hours not set'} />
                {p.facility ? <InfoTile icon={Bed} label="Beds" value={p.facility.bedCount != null ? `${p.facility.bedCount}${p.facility.icuBedCount ? ` · ICU ${p.facility.icuBedCount}` : ''}` : '—'} /> : isLab ? <InfoTile icon={Home} label="Home collection" value={p.diagnostic?.homeCollectionAvailable ? 'Available' : 'Centre only'} /> : <InfoTile icon={Home} label="Delivery" value={p.pharmacy?.homeDeliveryAvailable ? 'Available' : 'Pickup only'} />}
                <InfoTile icon={p.facility ? Stethoscope : isLab ? FlaskConical : Pill} label={p.facility ? 'Doctors' : isLab ? 'Tests' : 'Pharmacist'} value={p.facility ? String(p.doctors.length) : isLab ? String(p.services.length) : (p.pharmacy?.pharmacistName ?? 'On duty')} />
              </div>
            </div>
          </section>

          {p.facility?.hasEmergency && <div className="flex items-center gap-3 rounded-3xl bg-danger-soft p-3 text-sm"><span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-danger text-white"><Phone size={18} aria-hidden /></span><span className="flex-1"><span className="font-extrabold text-danger">Emergency department</span><span className="block text-xs text-muted">{p.facility.isOpen24x7 ? 'Open round the clock.' : 'Check hours before travelling.'} In an emergency call 112 first.</span></span>{p.contactPhone && <a href={`tel:${p.contactPhone}`} className="rounded-full bg-white px-3 py-2 text-xs font-bold text-danger shadow-card">Call</a>}</div>}
          {p.description && <Card><p className="text-sm">{p.description}</p></Card>}

          {isPharmacy && <Link href={`/pharmacy?provider=${p.id}`}><Button full size="lg"><Pill size={18} /> Order Medicines From Here</Button></Link>}

          {p.doctors.length > 0 && (
            <section>
              <SectionTitle title="Doctors here" />
              <div className="stagger grid gap-2 lg:grid-cols-2">
                {p.doctors.map((d) => (
                  <Card key={d.id} href={`/doctors/${d.id}`} className="flex items-center gap-3">
                    <Avatar name={d.name} />
                    <span className="min-w-0 flex-1"><span className="block truncate text-sm font-extrabold">{d.name}</span><span className="block truncate text-xs text-muted">{d.speciality ?? 'Doctor'}{d.department ? ` · ${d.department}` : ''}{d.yearsOfExperience != null ? ` · ${d.yearsOfExperience} yrs` : ''}</span><Rating value={d.rating} count={d.ratingCount} /></span>
                    <span className="tnum text-sm font-extrabold">{money(d.feeMinor)}</span>
                  </Card>
                ))}
              </div>
            </section>
          )}

          {p.services.length > 0 && (
            <section>
              <SectionTitle title={isLab ? 'Tests and scans' : 'Services and prices'} />
              <div className="stagger grid gap-2 lg:grid-cols-2">
                {p.services.map((s) => (
                  <Card key={s.id} href={isLab || s.category === 'DIAGNOSTIC_TEST' || s.category === 'IMAGING' ? `/tests/${encodeURIComponent(s.code)}?provider=${p.id}` : undefined} className="flex items-center gap-3">
                    <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-violet-soft text-violet"><FlaskConical size={20} aria-hidden /></span>
                    <span className="min-w-0 flex-1"><span className="block truncate text-sm font-bold">{s.name}</span><span className="block truncate text-xs text-muted">{s.fastingRequired ? 'Fasting required · ' : ''}{s.turnaroundHours ? `Report in ${s.turnaroundHours} h` : s.category.toLowerCase().replace('_', ' ')}{s.homeServiceAvailable ? ' · home collection' : ''}</span></span>
                    <span className="tnum text-sm font-extrabold">{money(s.priceMinor)}</span>
                  </Card>
                ))}
              </div>
            </section>
          )}

          {(p.departments.length > 0 || p.amenities.length > 0) && (
            <section className="grid gap-3 sm:grid-cols-2">
              {p.departments.length > 0 && <Card><p className="text-sm font-extrabold">Departments</p><div className="mt-2 flex flex-wrap gap-1.5">{p.departments.map((d) => <Badge key={d.code} tone="primary">{d.name}</Badge>)}</div></Card>}
              {p.amenities.length > 0 && <Card><p className="text-sm font-extrabold">Facilities</p><div className="mt-2 flex flex-wrap gap-1.5">{p.amenities.map((a) => <Badge key={a.code}>{a.name}</Badge>)}</div></Card>}
            </section>
          )}

          <section>
            <SectionTitle title={p.locations.length > 1 ? 'Locations' : 'Location & hours'} />
            {p.locations.some((l) => l.latitude != null && l.longitude != null) && (
              <MapView className="mb-3 h-56 lg:h-72" you={place} markers={p.locations.flatMap((l) => (l.latitude != null && l.longitude != null ? [{ id: l.id, lat: l.latitude, lng: l.longitude, title: l.name, colour: TYPE_COLOUR[p.type] }] : []))} label={`Map of ${p.name}`} />
            )}
            <div className="grid gap-2 lg:grid-cols-2">
              {p.locations.map((l) => (
                <Card key={l.id}>
                  <p className="flex items-baseline justify-between gap-2 text-sm font-extrabold"><span>{l.name}</span>{place && l.latitude != null && l.longitude != null && <span className="tnum shrink-0 text-xs font-bold text-primary">{distanceKm(place, { lat: l.latitude, lng: l.longitude }).toFixed(1)} km away</span>}</p>
                  <p className="mt-0.5 text-xs text-muted">{l.addressLine1}{l.addressLine2 ? `, ${l.addressLine2}` : ''}, {l.locality ? `${l.locality}, ` : ''}{l.city}, {l.district} {l.pincode}</p>
                  <ul className="mt-2 grid grid-cols-2 gap-x-4 text-xs">{[1, 2, 3, 4, 5, 6, 0].map((d) => { const hs = l.operatingHours.filter((h) => h.dayOfWeek === d && !h.isClosed); return <li key={d} className="flex justify-between gap-2"><span className={d === today ? 'font-bold text-ink' : 'text-muted'}>{DAYS[d]}</span><span className="tnum">{hs.length ? hs.map((h) => `${hm(h.opensAtMin)}–${hm(h.closesAtMin)}`).join(', ') : 'Closed'}</span></li>; })}</ul>
                  <div className="mt-3 flex gap-2">
                    {l.latitude != null && l.longitude != null && <a href={directionsUrl(l.latitude, l.longitude)} target="_blank" rel="noreferrer" className="inline-flex h-10 items-center gap-1 rounded-full bg-primary-soft px-3 text-xs font-bold text-primary"><MapPin size={14} aria-hidden /> Directions</a>}
                    {(l.phone ?? p.contactPhone) && <a href={`tel:${l.phone ?? p.contactPhone}`} className="inline-flex h-10 items-center gap-1 rounded-full bg-soft px-3 text-xs font-bold"><Phone size={14} aria-hidden /> Call</a>}
                  </div>
                </Card>
              ))}
            </div>
          </section>

          <section>
            <SectionTitle title="What patients say" />
            {reviews.isPending ? <Skeleton rows={2} /> : !reviews.data?.length ? <p className="text-sm text-muted">No published reviews yet.</p> : <div className="stagger grid gap-2 lg:grid-cols-2">{reviews.data.map((r) => <Card key={r.id}><div className="flex items-center justify-between"><Rating value={r.rating} /><span className="text-xs text-muted">{r.author} · {relative(r.createdAt)}</span></div>{r.comment && <p className="mt-1.5 text-sm">{r.comment}</p>}</Card>)}</div>}
          </section>
        </div>
      )}
    </AppShell>
  );
}
