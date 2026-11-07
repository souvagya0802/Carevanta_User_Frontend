'use client';

import Link from 'next/link';
import dynamic from 'next/dynamic';
import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useState } from 'react';
import { AlertTriangle, FlaskConical, List, Map as MapIcon, MapPin, Pill, Search, SlidersHorizontal, Sparkles, X } from 'lucide-react';
import { useGet } from '@/lib/hooks';
import { useLocation, geoQuery } from '@/lib/location';
import { medicineLabel, money } from '@/lib/format';
import { AppShell } from '@/components/layout/app-shell';
import { ProviderCard, type ProviderHit } from '@/components/provider-card';
import { TYPE_COLOUR } from '@/components/icons';
import { NoSpecialistsNote, SmartSearch, noSpecialists, type Suggestions } from '@/components/search/smart-search';
import { Button, Chip, EmptyState, ErrorState, PageTitle, Select, Sheet, Skeleton } from '@/components/ui/primitives';

// Leaflet needs the browser, so the map loads on the client only.
const MapView = dynamic(() => import('@/components/map/map-view').then((m) => m.MapView), { ssr: false, loading: () => <div className="shimmer h-[55dvh] rounded-[22px]" /> });

type Kind = 'doctors' | 'facilities' | 'labs' | 'pharmacies';
const KINDS: { key: Kind; label: string; types: string[] }[] = [
  { key: 'doctors', label: 'Doctors', types: ['DOCTOR'] },
  { key: 'facilities', label: 'Hospitals & Clinics', types: ['HOSPITAL', 'CLINIC'] },
  { key: 'labs', label: 'Labs & Scans', types: ['DIAGNOSTIC_LAB', 'IMAGING_CENTRE'] },
  { key: 'pharmacies', label: 'Pharmacies', types: ['PHARMACY'] },
];

export default function SearchPage() {
  return <Suspense fallback={<AppShell><Skeleton card rows={4} /></AppShell>}><SearchInner /></Suspense>;
}

/**
 * Results for a submitted search. The words are first "understood" by the
 * API (symptom → specialists, everyday name → test, typo → correction), then
 * the matching providers are listed. The URL holds the state so back/forward
 * and shared links work: ?q=fever&type=doctors&speciality=PAEDIATRICS
 */
function SearchInner() {
  const params = useSearchParams();
  const router = useRouter();
  const { place, locate, asking } = useLocation();
  const q = params.get('q')?.trim() ?? '';
  const typeParam = params.get('type');
  const specialityParam = params.get('speciality') ?? '';
  // The saved place is only known after hydration, so the defaults follow it until the patient picks.
  const [sortChoice, setSort] = useState<'distance' | 'rating' | 'fee' | null>(null);
  const sort = sortChoice ?? (place ? 'distance' : 'rating');
  const [radiusChoice, setRadius] = useState<number | null>(null);
  // A place known only to the district or state is approximate: search wider by default.
  const radius = radiusChoice ?? (place?.approximate ? 30 : 15);
  const [filters, setFilters] = useState(false);
  const [view, setView] = useState<'list' | 'map'>('list');
  const [picked, setPicked] = useState<string | null>(null);

  const understood = useGet<Suggestions>(q.length >= 2 ? `/discovery/suggest?q=${encodeURIComponent(q)}&limit=6${place ? `&lat=${place.lat}&lng=${place.lng}` : ''}` : null);
  const u = understood.data;
  const testCode = u?.understood?.kind === 'test' ? u.tests[0]?.code : undefined;

  // Without an explicit tab, open the one that matches what was understood.
  const kind: Kind = (KINDS.find((k) => k.key === typeParam)?.key) ?? (testCode ? 'labs' : u && !u.specialities.length && !u.doctors.length && u.places.length ? (u.places[0]!.type === 'PHARMACY' ? 'pharmacies' : u.places[0]!.type.includes('LAB') || u.places[0]!.type.includes('IMAGING') ? 'labs' : 'facilities') : 'doctors');
  const types = KINDS.find((k) => k.key === kind)!.types;

  // Specialities with no listed doctors are dead ends, so they are not offered.
  const liveSpecs = u?.specialities.filter((s) => s.doctors > 0) ?? [];
  // ...but when every understood speciality is empty, say so plainly (the list below then shows all doctors).
  const noneListed = noSpecialists(u);
  const understoodSpecs = liveSpecs.map((s) => s.code);
  // A plain string so the results query only changes when the chosen specialities really change.
  const specKey = (specialityParam ? [specialityParam] : kind === 'doctors' ? understoodSpecs : []).join(',');
  // Search by name only when the words were not a symptom, speciality or test.
  const byName = q && !u?.understood ? q : '';
  const waiting = q.length >= 2 && understood.isPending;
  const url = (() => {
    const parts = [`limit=40`, `sort=${sort}`, types.length === 1 ? `type=${types[0]}` : '', specKey ? `speciality=${encodeURIComponent(specKey)}` : '', kind === 'labs' && testCode ? `serviceCode=${testCode}` : '', byName ? `q=${encodeURIComponent(byName)}` : ''].filter(Boolean);
    return `/discovery/providers?${parts.join('&')}${geoQuery(place, radius)}`;
  })();
  const results = useGet<{ items: ProviderHit[]; radiusKm: number | null }>(waiting ? null : url);
  const items = (results.data?.items ?? []).filter((p) => types.includes(p.type));
  const onMap = items.flatMap((p) => (p.latitude != null && p.longitude != null ? [{ id: p.id, lat: p.latitude, lng: p.longitude, title: p.name, colour: TYPE_COLOUR[p.type] }] : []));
  const showMap = view === 'map' && onMap.length > 0;
  const pickedHit = items.find((p) => p.id === picked) ?? null;
  const specs = useGet<{ code: string; name: string; doctors: number }[]>(kind === 'doctors' ? '/public/catalogue/specialities' : null);

  const setParams = (next: Record<string, string | null>) => {
    const sp = new URLSearchParams(params.toString());
    for (const [k, v] of Object.entries(next)) { if (v) sp.set(k, v); else sp.delete(k); }
    router.replace(`/search?${sp.toString()}`);
  };

  return (
    <AppShell>
      <PageTitle title="Find care" subtitle={place ? `Near ${place.label}, within ${radius} km` : 'Set your location to see distance and what is nearby'} right={<Button size="sm" variant="secondary" onClick={() => setFilters(true)}><SlidersHorizontal size={16} /> Filters</Button>} />
      <SmartSearch key={q} initial={q} onSearch={(text) => setParams({ q: text, speciality: null, type: null })} />
      <div className="no-scrollbar -mx-4 mt-3 flex gap-2 overflow-x-auto px-4">{KINDS.map((k) => <Chip key={k.key} active={kind === k.key} onClick={() => setParams({ type: k.key, speciality: null })}>{k.label}</Chip>)}</div>

      {u?.emergency && (
        <div role="alert" className="mt-4 flex items-start gap-3 rounded-3xl bg-danger p-4 text-white shadow-[0_20px_40px_-20px_rgb(225_29_72/0.7)]">
          <AlertTriangle size={22} className="mt-0.5 shrink-0" aria-hidden />
          <div><p className="font-extrabold">This can be an emergency</p><p className="mt-0.5 text-sm text-white/90">{u.emergency.message}</p><a href={`tel:${u.emergency.number}`} className="mt-3 inline-flex h-10 items-center rounded-full bg-white px-4 text-sm font-bold text-danger">Call {u.emergency.number}</a></div>
        </div>
      )}

      {/* What we understood, in plain words, with a way to undo it. */}
      {u?.understood && (
        <div className="mt-3 rounded-3xl bg-white p-3 shadow-card">
          <p className="flex flex-wrap items-center gap-1.5 text-sm">
            <Sparkles size={15} className="text-primary" aria-hidden />
            {u.understood.corrected ? <>Showing results for <b>{u.understood.label}</b></> : u.understood.from.toLowerCase() !== u.understood.label.toLowerCase() ? <>“{q}” means <b>{u.understood.label}</b></> : <>Results for <b>{u.understood.label}</b></>}
            {kind === 'doctors' && liveSpecs.length === 1 && !specialityParam && <span className="text-muted">· {liveSpecs[0]!.name}</span>}
          </p>
          {kind === 'doctors' && liveSpecs.length > 1 && (
            <div className="no-scrollbar -mx-3 mt-2 flex gap-2 overflow-x-auto px-3">
              <Chip active={!specialityParam} onClick={() => setParams({ speciality: null })}>All {liveSpecs.length}</Chip>
              {liveSpecs.map((s) => <Chip key={s.code} active={specialityParam === s.code} onClick={() => setParams({ speciality: s.code })}>{s.name} <span className="text-[11px] opacity-70">{s.doctors}</span></Chip>)}
            </div>
          )}
          {kind === 'doctors' && !specialityParam && noneListed.length > 0 && <NoSpecialistsNote className="mt-2" specialities={noneListed} nearYou={!!place} onGo={(href) => router.push(href)} />}
          {u.awaitingReview.length > 0 && !u.specialities.length &&<p className="mt-2 text-xs text-muted">We are still confirming which specialist to suggest for {u.awaitingReview.join(', ').toLowerCase()}. Browse specialities below, or start with a General Physician.</p>}
        </div>
      )}

      {/* Tests and medicines that match the words, whichever tab is open. */}
      {u && (u.tests.length > 0 || u.medicines.length > 0) && kind !== 'labs' && (
        <div className="no-scrollbar -mx-4 mt-3 flex gap-2 overflow-x-auto px-4">
          {u.tests.slice(0, 4).map((t) => <Link key={t.code} href={`/tests/${t.code}`} className="flex shrink-0 items-center gap-2 rounded-2xl bg-white px-3 py-2 text-sm shadow-card"><FlaskConical size={15} className="text-violet" /><span className="font-semibold">{t.name}</span>{t.fromMinor != null && <span className="text-xs text-muted">from {money(t.fromMinor)}</span>}</Link>)}
          {u.medicines.slice(0, 4).map((m) => <Link key={m.id} href={`/pharmacy?q=${encodeURIComponent(m.name)}`} className="flex shrink-0 items-center gap-2 rounded-2xl bg-white px-3 py-2 text-sm shadow-card"><Pill size={15} className="text-warning" /><span className="font-semibold">{medicineLabel(m.name, m.strength)}</span>{m.fromMinor != null && <span className="text-xs text-muted">from {money(m.fromMinor)}</span>}</Link>)}
        </div>
      )}

      {kind === 'doctors' && !u?.specialities.length && specs.data && (
        <div className="no-scrollbar -mx-4 mt-2 flex gap-2 overflow-x-auto px-4">
          <Chip active={!specialityParam} onClick={() => setParams({ speciality: null })}>All specialities</Chip>
          {specs.data.filter((s) => s.doctors > 0).map((s) => <Chip key={s.code} active={specialityParam === s.code} onClick={() => setParams({ speciality: specialityParam === s.code ? null : s.code })}>{s.name} <span className="text-[11px] opacity-70">{s.doctors}</span></Chip>)}
        </div>
      )}
      {!place && <button type="button" onClick={() => void locate()} className="mt-3 flex w-full items-center gap-3 rounded-2xl bg-primary-soft p-3 text-left text-sm"><MapPin size={18} className="shrink-0 text-primary" aria-hidden /><span className="min-w-0 flex-1"><span className="font-bold">Use my location</span><span className="block text-xs text-muted">See how far each option is and sort by distance.</span></span><span className="text-xs font-bold text-primary">{asking ? 'Finding…' : 'Allow'}</span></button>}

      {onMap.length > 0 && (
        <div className="mt-4 flex items-center justify-between gap-2">
          <p className="text-xs font-semibold text-muted">{items.length} {items.length === 1 ? 'result' : 'results'}</p>
          <div role="group" aria-label="Show results as" className="flex rounded-full bg-white p-1 shadow-card">
            <button type="button" aria-pressed={view === 'list'} onClick={() => setView('list')} className={`flex h-10 items-center gap-1.5 rounded-full px-4 text-sm font-bold ${view === 'list' ? 'bg-primary text-white' : 'text-muted'}`}><List size={15} aria-hidden /> List</button>
            <button type="button" aria-pressed={view === 'map'} onClick={() => setView('map')} className={`flex h-10 items-center gap-1.5 rounded-full px-4 text-sm font-bold ${view === 'map' ? 'bg-primary text-white' : 'text-muted'}`}><MapIcon size={15} aria-hidden /> Map</button>
          </div>
        </div>
      )}

      <div className="mt-4">
        {showMap ? (
          <div className="space-y-3">
            <MapView className="h-[55dvh] min-h-72" markers={onMap} you={place} selectedId={picked} onSelect={setPicked} label="Results on a map. Tap a pin to see the provider." />
            {pickedHit ? <ProviderCard p={pickedHit} priceLabel={kind === 'labs' && testCode ? 'from' : undefined} /> : <p className="text-center text-xs text-muted">Tap a pin to see who it is.{onMap.length < items.length ? ` ${items.length - onMap.length} more without a map location are in the list.` : ''}</p>}
          </div>
        ) : waiting || results.isPending ? <Skeleton card rows={4} /> : results.isError ? <ErrorState error={results.error} retry={() => results.refetch()} /> : items.length === 0 ? (
          <EmptyState icon={Search} title={place ? `Nothing within ${radius} km` : 'No matches yet'} description={q ? `Nothing listed for “${q}” here yet. Try another tab, a simpler word, or widen the distance.` : place ? 'Widen the distance in Filters, or try another speciality.' : 'Try a different word, or browse by speciality above.'}
            action={q ? <Button variant="soft" onClick={() => setParams({ q: null, speciality: null })}><X size={14} /> Clear search</Button> : place ? <Button variant="soft" onClick={() => setRadius(Math.min(200, radius * 2))}>Search within {Math.min(200, radius * 2)} km</Button> : undefined} />
        ) : (
          <div className="stagger grid grid-cols-1 gap-3 lg:grid-cols-2">{items.map((p) => <ProviderCard key={p.id} p={p} priceLabel={kind === 'labs' && testCode ? 'from' : undefined} />)}</div>
        )}
      </div>
      <p className="mt-6 text-center text-xs text-muted">{u?.disclaimer ?? 'Only verified providers are shown.'} Fees are what the provider published.</p>

      <Sheet open={filters} onClose={() => setFilters(false)} title="Filters" footer={<Button full onClick={() => setFilters(false)}>Show results</Button>}>
        <div className="space-y-4">
          <label className="block"><span className="mb-1.5 block text-sm font-semibold">Sort by</span><Select value={sort} onChange={(e) => setSort(e.target.value as typeof sort)}><option value="distance" disabled={!place}>Nearest first</option><option value="rating">Best rated</option><option value="fee">Lowest fee</option></Select></label>
          <label className="block"><span className="mb-1.5 block text-sm font-semibold">Distance: within {radius} km</span><input type="range" min={2} max={100} step={1} value={radius} onChange={(e) => setRadius(Number(e.target.value))} className="w-full accent-primary" disabled={!place} /><span className="text-xs text-muted">{place ? 'From your saved location.' : 'Set a location first.'}</span></label>
          {kind === 'doctors' && specs.data && <label className="block"><span className="mb-1.5 block text-sm font-semibold">Speciality</span><Select value={specialityParam} onChange={(e) => setParams({ speciality: e.target.value || null })}><option value="">Any</option>{specs.data.map((s) => <option key={s.code} value={s.code}>{s.name} ({s.doctors})</option>)}</Select></label>}
        </div>
      </Sheet>
    </AppShell>
  );
}
