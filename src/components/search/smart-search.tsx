'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useId, useMemo, useRef, useState, type ReactNode } from 'react';
import { ArrowRight, Clock, FlaskConical, History, Hospital, Pill, Search, Siren, Sparkles, Stethoscope, X } from 'lucide-react';
import { useDebounced, useGet } from '@/lib/hooks';
import { useLocation } from '@/lib/location';
import { usePatientUi } from '@/lib/patient-ui';
import { medicineLabel, money } from '@/lib/format';
import { stored, useStored } from '@/lib/stored';
import { Avatar, Spinner, cx } from '@/components/ui/primitives';

/** What the API understood from free text (see GET /discovery/suggest). */
export interface Suggestions {
  query: string;
  understood: { label: string; kind: 'condition' | 'speciality' | 'test'; corrected: boolean; from: string } | null;
  emergency: { message: string; number: string } | null;
  conditions: { id: string; name: string; kind: string; isRedFlag: boolean; matchedTerm: string; corrected: boolean; approved: boolean }[];
  specialities: { code: string; name: string; doctors: number; via: 'symptom' | 'speciality'; because: string | null; relevance: string }[];
  awaitingReview: string[];
  doctors: { id: string; name: string; specialities: string[]; feeMinor: number | null; rating: number | null; city: string | null; distanceKm: number | null; matchedByName: boolean }[];
  places: { id: string; type: string; name: string; city: string | null; distanceKm: number | null }[];
  tests: { code: string; name: string; category: string; providers: number; fromMinor: number | null }[];
  medicines: { id: string; name: string; genericName: string | null; strength: string | null; requiresPrescription: boolean; pharmacies: number; fromMinor: number | null }[];
  disclaimer: string;
}

const PLACE_LABEL: Record<string, string> = { HOSPITAL: 'Hospital', CLINIC: 'Clinic', DIAGNOSTIC_LAB: 'Lab', IMAGING_CENTRE: 'Scan centre', PHARMACY: 'Pharmacy', AMBULANCE_OPERATOR: 'Ambulance' };

// Read after hydration (external store), so a saved history never makes the server HTML differ.
const recentStore = stored<string[]>('carevanta.recentSearches');
const NO_RECENT: string[] = [];
function remember(q: string) {
  const prev = Array.isArray(recentStore.get()) ? recentStore.get()! : [];
  recentStore.set([q, ...prev.filter((x) => x.toLowerCase() !== q.toLowerCase())].slice(0, 6));
}

/** "Dermatology" → "dermatologists", "Paediatrics" → "paediatricians"; anything else → "Orthopaedics doctors". */
export function specialistsWord(speciality: string): string {
  const s = speciality.trim();
  const lower = s.toLowerCase();
  if (lower === 'general medicine') return 'general physicians';
  if (/ology$/.test(lower)) return `${lower.replace(/ology$/, 'ologists')}`;
  if (/iatrics$/.test(lower)) return `${lower.replace(/iatrics$/, 'iatricians')}`;
  if (/iatry$/.test(lower)) return `${lower.replace(/iatry$/, 'iatrists')}`;
  return `${s} doctors`;
}

/**
 * The words were understood as one or more specialities, but none has a doctor
 * listed: say so plainly instead of a silent dead end.
 */
export function noSpecialists(d: Pick<Suggestions, 'specialities' | 'doctors'> | undefined): Suggestions['specialities'] {
  if (!d || !d.specialities.length || d.doctors.length) return [];
  return d.specialities.every((s) => s.doctors === 0) ? d.specialities : [];
}

/** The plain-words notice plus the two ways forward (General Physician, all doctors). */
export function NoSpecialistsNote({ specialities, nearYou, onGo, className }: { specialities: Suggestions['specialities']; nearYou: boolean; onGo: (href: string, label: string) => void; className?: string }) {
  const first = specialities[0];
  if (!first) return null;
  const isGp = first.code === 'GENERAL_MEDICINE';
  return (
    <div role="status" className={cx('rounded-2xl bg-warning-soft p-3 text-sm', className)}>
      <p className="font-bold">No {specialistsWord(first.name)} are listed {nearYou ? 'near you ' : ''}yet.</p>
      <p className="mt-0.5 text-muted">{isGp ? 'Try a nearby town, or browse every doctor listed.' : 'A General Physician can see you first and refer you if needed.'}</p>
      <div className="mt-2 flex flex-wrap gap-2">
        {!isGp && <button type="button" onClick={() => onGo('/search?type=doctors&speciality=GENERAL_MEDICINE', 'General Physician')} className="inline-flex h-10 items-center rounded-full bg-white px-4 text-sm font-bold text-primary shadow-card">See a General Physician</button>}
        <button type="button" onClick={() => onGo('/search?type=doctors', 'All doctors')} className="inline-flex h-10 items-center rounded-full px-3 text-sm font-semibold text-primary">Browse all doctors</button>
      </div>
    </div>
  );
}

/** The search page reads `?q=` and shows the full result list for a submitted search. */
export const searchHref = (q: string) => `/search?q=${encodeURIComponent(q.trim())}`;

/**
 * One search box for symptoms, doctors, tests, medicines and places.
 * Suggestions appear while typing; Enter (or the button) opens the full results.
 * Works on phones: the panel sits under the box, scrolls on its own and closes on outside tap.
 */
export function SmartSearch({ initial = '', placeholder, onSearch, tone = 'light', autoFocus, className }: { initial?: string; placeholder?: string; onSearch?: (q: string) => void; tone?: 'light' | 'hero'; autoFocus?: boolean; className?: string }) {
  const router = useRouter();
  const ui = usePatientUi();
  const { place } = useLocation();
  const [q, setQ] = useState(initial);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const storedRecent = useStored(recentStore);
  const recent = Array.isArray(storedRecent) ? storedRecent : NO_RECENT;
  const box = useRef<HTMLDivElement>(null);
  const listId = useId();
  const dq = useDebounced(q.trim(), 250);
  const geo = place ? `&lat=${place.lat}&lng=${place.lng}` : '';
  const res = useGet<Suggestions>(open && dq.length >= 2 ? `/discovery/suggest?q=${encodeURIComponent(dq)}&limit=4${geo}` : null);
  const d = dq.length >= 2 ? res.data : undefined;

  // Close when tapping outside.
  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => { if (box.current && !box.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener('pointerdown', onDown);
    return () => document.removeEventListener('pointerdown', onDown);
  }, [open]);

  const submit = (text = q) => {
    const t = text.trim();
    if (t.length < 2) return;
    remember(t);

    setOpen(false);
    if (onSearch) onSearch(t);
    else router.push(searchHref(t));
  };

  // Flat list of every row so arrow keys can move through sections.
  const rows = useMemo(() => {
    const out: { key: string; href: string; label: string }[] = [];
    if (!d) return out;
    for (const s of d.specialities.filter((x) => x.doctors > 0).slice(0, 3)) out.push({ key: `s-${s.code}`, href: `/search?type=doctors&speciality=${s.code}&q=${encodeURIComponent(dq)}`, label: s.name });
    for (const x of d.doctors.slice(0, 4)) out.push({ key: `d-${x.id}`, href: `/doctors/${x.id}`, label: x.name });
    for (const x of d.places.slice(0, 3)) out.push({ key: `p-${x.id}`, href: `/providers/${x.id}`, label: x.name });
    for (const x of d.tests.slice(0, 3)) out.push({ key: `t-${x.code}`, href: `/tests/${x.code}`, label: x.name });
    for (const x of d.medicines.slice(0, 3)) out.push({ key: `m-${x.id}`, href: `/pharmacy?q=${encodeURIComponent(x.name)}`, label: x.name });
    return out;
  }, [d, dq]);
  const go = (href: string, label: string) => { remember(label); setOpen(false); router.push(href); };

  const onKey = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Escape') { setOpen(false); return; }
    if (e.key === 'ArrowDown') { e.preventDefault(); setOpen(true); setActive((i) => Math.min(rows.length - 1, i + 1)); }
    if (e.key === 'ArrowUp') { e.preventDefault(); setActive((i) => Math.max(-1, i - 1)); }
    if (e.key === 'Enter') { e.preventDefault(); const row = rows[active]; if (row) go(row.href, row.label); else submit(); }
  };
  const isActive = (key: string) => rows[active]?.key === key;
  const nothing = d && !d.understood && !d.doctors.length && !d.places.length && !d.tests.length && !d.medicines.length && !d.specialities.length;

  return (
    <div ref={box} className={cx('relative w-full min-w-0', className)}>
      <form role="search" onSubmit={(e) => { e.preventDefault(); submit(); }} className={cx('flex items-center gap-2 rounded-full bg-white p-1.5 pl-4 text-ink focus-within:ring-4 focus-within:ring-primary/25', tone === 'hero' ? 'shadow-float' : 'shadow-card')}>
        <Search size={18} className="shrink-0 text-muted" aria-hidden />
        <input
          value={q}
          onChange={(e) => { setQ(e.target.value); setOpen(true); setActive(-1); }}
          onFocus={() => setOpen(true)}
          onKeyDown={onKey}
          placeholder={placeholder ?? 'Fever, child doctor, sugar test…'}
          aria-label="Search symptoms, doctors, tests or medicines"
          role="combobox"
          aria-expanded={open}
          aria-controls={listId}
          aria-autocomplete="list"
          autoFocus={autoFocus}
          enterKeyHint="search"
          className="h-10 min-w-0 flex-1 bg-transparent text-[15px] outline-none placeholder:text-muted/70 focus-visible:outline-none"
        />
        {q && <button type="button" aria-label="Clear search" onClick={() => { setQ(''); setActive(-1); }} className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-muted hover:bg-soft"><X size={16} /></button>}
        <button type="submit" className="h-10 shrink-0 whitespace-nowrap rounded-full bg-brand px-4 text-sm font-bold text-white shadow-glow">Search</button>
      </form>

      {open && (
        <div id={listId} role="listbox" className="absolute inset-x-0 top-[calc(100%+8px)] z-50 max-h-[min(70vh,560px)] overflow-y-auto overscroll-contain rounded-3xl bg-white p-2 text-ink shadow-float ring-1 ring-black/5">
          {dq.length < 2 ? (
            <div className="p-2">
              {recent.length > 0 && (
                <>
                  <p className="mb-1.5 flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide text-muted"><History size={13} /> Recent</p>
                  <div className="mb-3 flex flex-wrap gap-1.5">{recent.map((r) => <button key={r} type="button" onClick={() => { setQ(r); submit(r); }} className="min-h-10 rounded-full bg-soft px-3.5 text-sm font-semibold">{r}</button>)}</div>
                </>
              )}
              <p className="mb-1.5 flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide text-muted"><Sparkles size={13} /> Popular</p>
              <div className="flex flex-wrap gap-1.5">{(ui.popularSearches ?? []).map((r) => <button key={r} type="button" onClick={() => { setQ(r); submit(r); }} className="min-h-10 rounded-full bg-primary-soft px-3.5 text-sm font-semibold text-primary">{r}</button>)}</div>
              <p className="mt-3 text-xs text-muted">Type how you would say it: “bukhar”, “pet dard”, “child doctor”, a doctor’s name or a medicine.</p>
            </div>
          ) : !d ? (
            <div className="flex items-center gap-2 p-3 text-sm text-muted"><Spinner /> Looking for “{dq}”…</div>
          ) : (
            <div className="space-y-1">
              {d.emergency && (
                <a href={`tel:${d.emergency.number}`} className="flex items-center gap-3 rounded-2xl bg-danger p-3 text-white">
                  <Siren size={20} className="shrink-0" aria-hidden />
                  <span className="min-w-0 flex-1 text-sm"><b className="block">This may be an emergency</b><span className="text-white/90">Call {d.emergency.number} now</span></span>
                </a>
              )}
              {d.understood && (d.understood.corrected || d.understood.from.toLowerCase() !== d.understood.label.toLowerCase()) && (
                <p className="px-3 pt-1 text-xs text-muted">Showing results for <b className="text-ink">{d.understood.label}</b>{d.understood.corrected ? '' : ` (you typed “${dq}”)`}</p>
              )}
              {noSpecialists(d).length > 0 && <NoSpecialistsNote className="mx-1" specialities={noSpecialists(d)} nearYou={!!place} onGo={go} />}
              {d.awaitingReview.length > 0 && !d.specialities.length && (
                <p className="mx-1 rounded-2xl bg-warning-soft p-3 text-sm">We know “{d.awaitingReview[0]}”, and our doctors are still confirming which specialist to suggest. Try a speciality, or see a General Physician.</p>
              )}
              <Section title="Specialists" show={d.specialities.some((x) => x.doctors > 0)}>
                {d.specialities.filter((x) => x.doctors > 0).slice(0, 3).map((s) => (
                  <Row key={s.code} active={isActive(`s-${s.code}`)} onClick={() => go(`/search?type=doctors&speciality=${s.code}&q=${encodeURIComponent(dq)}`, s.name)} icon={<span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-primary-soft text-primary"><Stethoscope size={18} /></span>}
                    title={s.name} sub={`${s.doctors} ${s.doctors === 1 ? 'doctor' : 'doctors'}${s.because ? ` · for ${s.because.toLowerCase()}` : ''}`} />
                ))}
              </Section>
              <Section title="Doctors" show={d.doctors.length > 0}>
                {d.doctors.slice(0, 4).map((x) => (
                  <Row key={x.id} active={isActive(`d-${x.id}`)} onClick={() => go(`/doctors/${x.id}`, x.name)} icon={<Avatar name={x.name} size="sm" />}
                    title={x.name} sub={[x.specialities[0], x.distanceKm != null ? `${x.distanceKm} km` : x.city, x.feeMinor != null ? `from ${money(x.feeMinor)}` : null].filter(Boolean).join(' · ')} />
                ))}
              </Section>
              <Section title="Hospitals, Labs & Pharmacies" show={d.places.length > 0}>
                {d.places.slice(0, 3).map((x) => (
                  <Row key={x.id} active={isActive(`p-${x.id}`)} onClick={() => go(`/providers/${x.id}`, x.name)} icon={<span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-success-soft text-success"><Hospital size={18} /></span>}
                    title={x.name} sub={[PLACE_LABEL[x.type] ?? x.type, x.distanceKm != null ? `${x.distanceKm} km` : x.city].filter(Boolean).join(' · ')} />
                ))}
              </Section>
              <Section title="Tests & Scans" show={d.tests.length > 0}>
                {d.tests.slice(0, 3).map((x) => (
                  <Row key={x.code} active={isActive(`t-${x.code}`)} onClick={() => go(`/tests/${x.code}`, x.name)} icon={<span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-violet-soft text-violet"><FlaskConical size={18} /></span>}
                    title={x.name} sub={x.providers ? `${x.providers} ${x.providers === 1 ? 'lab' : 'labs'}${x.fromMinor != null ? ` · from ${money(x.fromMinor)}` : ''}` : 'Not offered nearby yet'} />
                ))}
              </Section>
              <Section title="Medicines" show={d.medicines.length > 0}>
                {d.medicines.slice(0, 3).map((x) => (
                  <Row key={x.id} active={isActive(`m-${x.id}`)} onClick={() => go(`/pharmacy?q=${encodeURIComponent(x.name)}`, x.name)} icon={<span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-warning-soft text-warning"><Pill size={18} /></span>}
                    title={medicineLabel(x.name, x.strength)} sub={[x.genericName, x.requiresPrescription ? 'Prescription needed' : null, x.pharmacies ? `${x.pharmacies} in stock` : 'Out of stock nearby'].filter(Boolean).join(' · ')} />
                ))}
              </Section>
              {nothing && (
                <div className="p-3 text-sm">
                  <p className="font-semibold">No match for “{dq}”</p>
                  <p className="mt-0.5 text-muted">Try a simpler word, like “fever”, “skin doctor” or a medicine name.</p>
                </div>
              )}
              <button type="button" onClick={() => submit()} className="flex w-full items-center gap-2 rounded-2xl px-3 py-3 text-sm font-bold text-primary hover:bg-primary-soft">
                <Search size={16} /> <span className="min-w-0 flex-1 truncate text-left">See all results for “{dq}”</span><ArrowRight size={16} />
              </button>
              {(d.specialities.length > 0 || d.emergency) && <p className="px-3 pb-1 text-[11px] text-muted"><Clock size={10} className="mr-1 inline" />{d.disclaimer}</p>}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function Section({ title, show, children }: { title: string; show: boolean; children: ReactNode }) {
  if (!show) return null;
  return (
    <div className="pt-1">
      <p className="px-3 pt-1 pb-0.5 text-[11px] font-bold uppercase tracking-wide text-muted">{title}</p>
      {children}
    </div>
  );
}

function Row({ icon, title, sub, onClick, active }: { icon: ReactNode; title: string; sub: string; onClick: () => void; active: boolean }) {
  return (
    <button type="button" role="option" aria-selected={active} onClick={onClick} className={cx('flex w-full min-w-0 items-center gap-3 rounded-2xl px-2 py-2 text-left', active ? 'bg-primary-soft' : 'hover:bg-soft')}>
      <span className="shrink-0">{icon}</span>
      <span className="min-w-0 flex-1"><span className="block truncate text-sm font-bold">{title}</span>{sub && <span className="block truncate text-xs text-muted">{sub}</span>}</span>
    </button>
  );
}

/** Small link list for showing the same matches inline (used on the results page). */
export function MatchLinks({ items }: { items: { href: string; label: string }[] }) {
  return <div className="no-scrollbar -mx-4 flex gap-2 overflow-x-auto px-4">{items.map((i) => <Link key={i.href} href={i.href} className="inline-flex min-h-10 shrink-0 items-center rounded-full bg-white px-3.5 text-sm font-semibold shadow-card">{i.label}</Link>)}</div>;
}
